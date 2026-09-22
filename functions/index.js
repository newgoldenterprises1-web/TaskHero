const {onCall}=require("firebase-functions/v2/https");
const {onDocumentCreated,onDocumentUpdated}=require("firebase-functions/v2/firestore");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {Timestamp}=require("firebase-admin/firestore");
const {getMessaging}=require("firebase-admin/messaging");

initializeApp();
const db=getFirestore();

const CALLABLE_OPTIONS={
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === "true"
};

const RATE_WINDOWS={
  create:{max:20,windowMs:10*60*1000},
  support:{max:5,windowMs:10*60*1000},
  accept:{max:30,windowMs:10*60*1000},
  reject:{max:30,windowMs:10*60*1000},
  status:{max:30,windowMs:10*60*1000},
  cancel:{max:5,windowMs:10*60*1000},
  resolve_cancel:{max:20,windowMs:10*60*1000}
};

async function rateLimit(uid,action){
  const cfg=RATE_WINDOWS[action]||{max:20,windowMs:10*60*1000};
  const id=uid+"_"+action;
  const ref=db.collection("securityRateLimits").doc(id);
  const now=Date.now();
  let allowed=true;
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref);
    const old=snap.exists?snap.data()||{}:{};
    const windowStart=Number(old.windowStart||0);
    const count=Number(old.count||0);
    if(windowStart && now-windowStart<cfg.windowMs){
      if(count>=cfg.max){allowed=false;return;}
      tx.update(ref,{count:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp()});
    }else{
      tx.set(ref,{uid,action,count:1,windowStart:now,updatedAt:FieldValue.serverTimestamp()},{merge:true});
    }
  });
  if(!allowed){
    await auditSecurityEvent({type:"rate_limit_blocked",uid,action});
    throw new Error("Too many requests. Please try again later.");
  }
}

function securitySeverity(type){
  if(["rate_limit_blocked","booking_rejected","booking_cancellation_requested"].includes(type)) return "medium";
  if(["security_check"].includes(type)) return "low";
  if(["booking_status_changed","booking_accepted","booking_created","support_ticket_created"].includes(type)) return "info";
  return "high";
}

async function auditSecurityEvent(event){
  try{
    await db.collection("securityEvents").add({
      ...event,
      severity:event.severity||securitySeverity(event.type),
      createdAt:FieldValue.serverTimestamp()
    });
  }catch(err){console.error("Security audit write failed",err);}
}

async function createSecurityAlert({type,severity="high",uid=null,reason,sourceEventId=null,metadata={}}){
  try{
    const bucket=Math.floor(Date.now()/15/60/1000);
    const id=[type,uid||"system",bucket].join("_").replace(/[^A-Za-z0-9_-]/g,"_");
    await db.collection("securityAlerts").doc(id).set({
      type,severity,uid,reason:String(reason||"Suspicious security activity").slice(0,500),
      sourceEventId:sourceEventId||null,metadata,status:"open",
      createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()
    },{merge:true});
  }catch(err){console.error("Security alert write failed",err);}
}

exports.onSecurityEventCreated=onDocumentCreated("securityEvents/{eventId}",async(event)=>{
  const data=event.data?.data()||{};
  const uid=data.uid||null;
  if(!uid)return;
  const now=Date.now();
  const since15=Timestamp.fromMillis(now-15*60*1000);
  const sinceHour=Timestamp.fromMillis(now-60*60*1000);
  const recent=await db.collection("securityEvents")
    .where("uid","==",uid)
    .where("createdAt",">=",sinceHour)
    .orderBy("createdAt","desc")
    .limit(100).get();
  const events=recent.docs.map(d=>d.data()||{});
  const recent15=events.filter(e=>e.createdAt?.toMillis && e.createdAt.toMillis()>=since15.toMillis());

  const rateBlocks15=recent15.filter(e=>e.type==="rate_limit_blocked").length;
  if(rateBlocks15>=3){
    await createSecurityAlert({
      type:"repeated_rate_limit_blocks",severity:"high",uid,
      reason:"Repeated rate-limit blocks detected within 15 minutes.",
      sourceEventId:event.params.eventId,
      metadata:{count:rateBlocks15,windowMinutes:15}
    });
  }

  const cancellationsHour=events.filter(e=>e.type==="booking_cancellation_requested").length;
  if(cancellationsHour>=5){
    await createSecurityAlert({
      type:"cancellation_abuse_signal",severity:"medium",uid,
      reason:"Multiple booking cancellation requests detected within one hour.",
      sourceEventId:event.params.eventId,
      metadata:{count:cancellationsHour,windowMinutes:60}
    });
  }

  const statusChanges10=events.filter(e=>e.type==="booking_status_changed" && e.createdAt?.toMillis && e.createdAt.toMillis()>=now-10*60*1000).length;
  if(statusChanges10>=6){
    await createSecurityAlert({
      type:"rapid_booking_status_changes",severity:"high",uid,
      reason:"A rapid sequence of booking status changes was detected within 10 minutes.",
      sourceEventId:event.params.eventId,
      metadata:{count:statusChanges10,windowMinutes:10}
    });
  }

  const rejectsHour=events.filter(e=>e.type==="booking_rejected").length;
  if(rejectsHour>=8){
    await createSecurityAlert({
      type:"partner_rejection_spike",severity:"medium",uid,
      reason:"A high number of partner booking rejections was detected within one hour.",
      sourceEventId:event.params.eventId,
      metadata:{count:rejectsHour,windowMinutes:60}
    });
  }
});

function requireAdmin(request){
  if(!request.auth) throw new Error("Authentication required");
  if(request.auth.token?.admin!==true) throw new Error("Admin access required");
  return request.auth.uid;
}

exports.listSecurityAlerts=onCall(CALLABLE_OPTIONS,async(request)=>{
  const adminUid=requireAdmin(request);
  const limitCount=Math.min(100,Math.max(1,Number(request.data?.limit||50)));
  const snap=await db.collection("securityAlerts").orderBy("createdAt","desc").limit(limitCount).get();
  return {
    adminUid,
    alerts:snap.docs.map(d=>({id:d.id,...d.data()}))
  };
});

exports.resolveSecurityAlert=onCall(CALLABLE_OPTIONS,async(request)=>{
  const adminUid=requireAdmin(request);
  const alertId=String(request.data?.alertId||"");
  if(!alertId||alertId.length>150) throw new Error("Invalid alertId");
  const note=String(request.data?.note||"").trim().slice(0,1000);
  const ref=db.collection("securityAlerts").doc(alertId);
  const snap=await ref.get();
  if(!snap.exists) throw new Error("Security alert not found");
  await ref.update({
    status:"resolved",
    resolvedBy:adminUid,
    resolutionNote:note,
    resolvedAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp()
  });
  await auditSecurityEvent({type:"security_alert_resolved",uid:adminUid,alertId});
  return {ok:true,status:"resolved"};
});

exports.adminListOperations=onCall(CALLABLE_OPTIONS,async(request)=>{
  const adminUid=requireAdmin(request);
  const limitCount=Math.min(100,Math.max(1,Number(request.data?.limit||50)));
  const [bookingsSnap,partnersSnap,supportSnap]=await Promise.all([
    db.collection("bookings").orderBy("createdAt","desc").limit(limitCount).get(),
    db.collection("partners").orderBy("createdAt","desc").limit(limitCount).get(),
    db.collection("supportTickets").orderBy("createdAt","desc").limit(limitCount).get()
  ]);
  const bookings=bookingsSnap.docs.map(d=>({id:d.id,...d.data()}));
  const partners=partnersSnap.docs.map(d=>({id:d.id,...d.data()}));
  const supportTickets=supportSnap.docs.map(d=>({id:d.id,...d.data()}));
  return {
    adminUid,
    bookings,
    partners,
    supportTickets,
    stats:{
      bookings:bookings.length,
      activeBookings:bookings.filter(b=>["requested","searching_partner","partner_assigned","partner_on_the_way","service_started"].includes(normalizeStatus(b.status))).length,
      completed:bookings.filter(b=>normalizeStatus(b.status)==="completed").length,
      partners:partners.length,
      pendingPartners:partners.filter(p=>p.approved!==true).length,
      openSupport:supportTickets.filter(t=>t.status==="open").length
    }
  };
});

exports.setPartnerApproval=onCall(CALLABLE_OPTIONS,async(request)=>{
  const adminUid=requireAdmin(request);
  const partnerId=String(request.data?.partnerId||"");
  const decision=String(request.data?.decision||"").toLowerCase();
  const note=String(request.data?.note||"").trim().slice(0,1000);
  if(!partnerId || partnerId.length>128 || !["approve","reject","suspend"].includes(decision)) throw new Error("Invalid partner approval request");
  const ref=db.collection("partners").doc(partnerId);
  const snap=await ref.get();
  if(!snap.exists) throw new Error("Partner not found");
  const patch={
    approved:decision==="approve",
    approvalStatus:decision==="approve"?"approved":decision==="suspend"?"suspended":"rejected",
    approvalNote:note,
    reviewedBy:adminUid,
    reviewedAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp()
  };
  if(decision!=="approve"){patch.online=false;patch.available=false;}
  await ref.update(patch);
  await db.collection("users").doc(partnerId).set({
    partnerApprovalStatus:patch.approvalStatus,
    partnerApprovalNote:note,
    updatedAt:FieldValue.serverTimestamp()
  },{merge:true});
  await notifyUser(partnerId,"Near Family — Partner application update",
    decision==="approve"?"Your partner account has been approved.":"Your partner account status was updated by Near Family operations.",
    {partnerId,status:patch.approvalStatus});
  await auditSecurityEvent({type:"partner_approval_changed",uid:adminUid,partnerId,decision});
  return {ok:true,partnerId,status:patch.approvalStatus};
});

const ACTIVE_STATUSES=new Set(["requested","partner_assigned","partner_on_the_way","service_started"]);
const normalizeStatus=s=>String(s||"requested").toLowerCase().replace(/\s+/g,"_");

exports.health=onCall(CALLABLE_OPTIONS,()=>({ok:true,service:"near-family-functions"}));

exports.createBooking=onCall(CALLABLE_OPTIONS,async(request)=>{
  if(!request.auth) throw new Error("Authentication required");
  await rateLimit(request.auth.uid,"create");
  const data=request.data||{};
  if(data===null || typeof data!=="object" || Array.isArray(data)) throw new Error("Invalid booking payload");
  const allowed=["service","category","price","name","phone","for","forWho","familyMemberId","address","date","time","instructions","photos","location"];
  const keys=Object.keys(data);
  if(keys.some(k=>!allowed.includes(k))) throw new Error("Invalid booking fields");
  const service=assertText(data.service,160,"Service");
  const category=assertText(data.category,120,"Category");
  const name=assertText(data.name,120,"Name");
  const phone=String(data.phone||"").trim();
  const address=String(data.address||"").trim();
  const date=String(data.date||"").trim();
  const time=String(data.time||"").trim();
  if(!service||!category||!name||phone.length<10||!address||!date||!time) throw new Error("Required booking details are missing");
  if(service.length>160||category.length>120||name.length>120||phone.length>30||address.length>1000||date.length>40||time.length>80) throw new Error("Booking field is too long");
  const price=Number(data.price);
  if(!Number.isFinite(price)||!Number.isInteger(Math.round(price*100))||price<0||price>1000000) throw new Error("Invalid booking price");
  if(Math.round(price*100)!==price*100) throw new Error("Price must use at most 2 decimal places");
  if(data.photos!==undefined && !Array.isArray(data.photos)) throw new Error("Invalid booking photos");
  if(Array.isArray(data.photos) && data.photos.length>5) throw new Error("Too many booking photos");
  if(data.location!==null && data.location!==undefined){
    const lat=Number(data.location.lat),lng=Number(data.location.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180) throw new Error("Invalid booking location");
  }
  const payload={
    service,category,price,name,phone,
    for:String(data.for||"Me").slice(0,160),
    forWho:String(data.forWho||"Me").slice(0,40),
    familyMemberId:data.familyMemberId?String(data.familyMemberId).slice(0,128):null,
    address,date,time,
    instructions:String(data.instructions||"").slice(0,4000),
    photos:Array.isArray(data.photos)?data.photos.slice(0,5):[],
    location:data.location||null,
    customerId:request.auth.uid,
    status:"requested",
    createdAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp()
  };
  const ref=await db.collection("bookings").add(payload);
  await auditSecurityEvent({type:"booking_created",uid:request.auth.uid,bookingId:ref.id});
  return {id:ref.id,status:"requested"};
});

function assertText(value,max,name){
  const v=String(value??"").trim();
  if(v.length>max) throw new Error(name+" is too long");
  return v;
}
async function recordAuthRisk(uid,type,details={}){
  await auditSecurityEvent({type,uid,...details});
}

exports.securityCheck=onCall(CALLABLE_OPTIONS,async(request)=>{
  if(!request.auth) throw new Error("Authentication required");
  const token=request.auth.token||{};
  await auditSecurityEvent({
    type:"security_check",
    uid:request.auth.uid,
    authProvider:token.firebase?.sign_in_provider||"unknown",
    emailVerified:token.email_verified===true,
    appCheckVerified:request.app?.appId?true:false
  });
  return {ok:true,authenticated:true,appCheckVerified:request.app?.appId?true:false};
});

exports.createSupportTicket=onCall(CALLABLE_OPTIONS,async(request)=>{
  if(!request.auth) throw new Error("Authentication required");
  await rateLimit(request.auth.uid,"support");
  const data=request.data||{};
  const subject=String(data.subject||"Support request").slice(0,120);
  const message=String(data.message||"").slice(0,4000);
  const ref=await db.collection("supportTickets").add({
    customerId:request.auth.uid,
    subject,
    message,
    status:"open",
    createdAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp()
  });
  await auditSecurityEvent({type:"support_ticket_created",uid:request.auth.uid,ticketId:ref.id});
  return {id:ref.id};
});

async function notifyUser(uid,title,body,data={}){
  if(!uid)return;
  const user=await db.collection("users").doc(uid).get();
  const token=user.data()?.fcmToken;
  if(!token)return;
  try{await getMessaging().send({token,notification:{title,body},data:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v)]))});}
  catch(err){
    if(err?.code==="messaging/registration-token-not-registered"||err?.code==="messaging/invalid-registration-token"){
      await db.collection("users").doc(uid).set({fcmToken:FieldValue.delete()},{merge:true});
      return;
    }
    console.error("FCM notification failed",err);
  }
}

function distanceKm(a,b){
  const lat1=Number(a?.lat),lon1=Number(a?.lng),lat2=Number(b?.lat),lon2=Number(b?.lng);
  if(![lat1,lon1,lat2,lon2].every(Number.isFinite)) return null;
  const R=6371,rad=Math.PI/180;
  const dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
function partnerLocation(p){
  return p.partnerLocation||p.location||null;
}
function partnerHasFreshLocation(p,maxAgeMs=30*60*1000){
  const loc=partnerLocation(p);
  const updated=loc?.updatedAt;
  if(!updated?.toMillis) return false;
  return Date.now()-updated.toMillis() <= maxAgeMs;
}
async function findPartners(booking){
  const snap=await db.collection("partners")
    .where("online","==",true)
    .where("approved","==",true)
    .where("serviceCategories","array-contains",booking.category||"")
    .limit(100).get();
  return snap.docs.map(d=>({id:d.id,...d.data()}))
    .filter(p=>p.available!==false
      && !p.currentBookingId
      && !(booking.rejectedPartnerIds||[]).includes(p.id))
    .map(p=>({...p,distanceKm:distanceKm(booking.location,partnerLocation(p)),locationFresh:partnerHasFreshLocation(p)}))
    .sort((a,b)=>{
      if(a.locationFresh!==b.locationFresh) return a.locationFresh?-1:1;
      const ad=a.distanceKm===null?Number.POSITIVE_INFINITY:a.distanceKm;
      const bd=b.distanceKm===null?Number.POSITIVE_INFINITY:b.distanceKm;
      return (ad-bd)
        || (Number(a.activeJobs||0)-Number(b.activeJobs||0))
        || (Number(b.rating||0)-Number(a.rating||0));
    });
}
async function findPartner(booking){
  const candidates=await findPartners(booking);
  return candidates[0]||null;
}

exports.onBookingCreated=onDocumentCreated("bookings/{bookingId}",async(event)=>{
  const ref=event.data?.ref;
  const booking=event.data?.data();
  if(!ref||!booking)return;
  if(booking.partnerId)return;

  const candidates=await findPartners(booking);
  let assignedPartner=null;

  for(const candidate of candidates){
    let assigned=false;
    try{
      await db.runTransaction(async(tx)=>{
        const current=await tx.get(ref);
        if(!current.exists)return;
        const currentBooking=current.data()||{};
        if(currentBooking.partnerId || !["requested","searching_partner"].includes(currentBooking.status))return;

        const partnerRef=db.collection("partners").doc(candidate.id);
        const partnerSnap=await tx.get(partnerRef);
        const livePartner=partnerSnap.data()||{};
        if(livePartner.approved!==true || livePartner.online!==true || livePartner.available===false || livePartner.currentBookingId)return;

        tx.update(ref,{
          status:"partner_assigned",
          partnerId:candidate.id,
          dispatchedAt:FieldValue.serverTimestamp(),
          updatedAt:FieldValue.serverTimestamp()
        });
        tx.update(partnerRef,{
          currentBookingId:event.params.bookingId,
          updatedAt:FieldValue.serverTimestamp()
        });
        assigned=true;
      });
    }catch(err){
      console.warn("Partner dispatch attempt failed",candidate.id,err);
    }
    if(assigned){
      assignedPartner=candidate;
      break;
    }
  }

  if(assignedPartner){
    await notifyUser(booking.customerId,"Near Family — Partner assigned","A verified partner has been assigned to your request.",{
      bookingId:event.params.bookingId,
      status:"partner_assigned",
      partnerDistanceKm:assignedPartner.distanceKm
    });
    await notifyUser(assignedPartner.id,"New Near Family job","You have a new service request.",{
      bookingId:event.params.bookingId,
      status:"partner_assigned"
    });
  }else{
    await ref.update({status:"searching_partner",updatedAt:FieldValue.serverTimestamp()});
    await notifyUser(booking.customerId,"Near Family — Finding a partner","We're finding an available verified partner for your request.",{
      bookingId:event.params.bookingId,
      status:"searching_partner"
    });
  }
});

exports.onBookingUpdated=onDocumentUpdated("bookings/{bookingId}",async(event)=>{
  const before=event.data.before.data()||{};
  const after=event.data.after.data()||{};
  if(!after || before.status===after.status)return;
  const status=normalizeStatus(after.status);
  await notifyUser(after.customerId,"Near Family booking update","Your booking is now "+status.replaceAll("_"," "),{bookingId:event.params.bookingId,status});
  if(after.partnerId)await notifyUser(after.partnerId,"Near Family job update","Booking status: "+status.replaceAll("_"," "),{bookingId:event.params.bookingId,status});
});


async function requirePartner(request){
  if(!request.auth) throw new Error("Authentication required");
  const snap=await db.collection("partners").doc(request.auth.uid).get();
  if(!snap.exists) throw new Error("Partner profile not found");
  const partner=snap.data()||{};
  if(partner.approved!==true) throw new Error("Partner is not approved yet");
  if(partner.online!==true) throw new Error("Partner is not currently online");
  return {uid:request.auth.uid,partner};
}

exports.acceptBooking=onCall(CALLABLE_OPTIONS,async(request)=>{
  const {uid}=await requirePartner(request);
  const bookingId=String(request.data?.bookingId||"");
  if(!bookingId || bookingId.length>128) throw new Error("Invalid bookingId");
  await rateLimit(uid,"accept");
  const ref=db.collection("bookings").doc(bookingId);
  let result;
  await db.runTransaction(async(tx)=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new Error("Booking not found");
    const b=snap.data()||{};
    if(b.partnerId!==uid) throw new Error("Booking is not assigned to this partner");
    if(b.status!=="partner_assigned" || b.partnerAccepted===true) throw new Error("Booking is no longer available");
    const partnerRef=db.collection("partners").doc(uid);
    const partnerSnap=await tx.get(partnerRef);
    const partner=partnerSnap.data()||{};
    if(partner.approved!==true || partner.online!==true || partner.currentBookingId!==bookingId) throw new Error("This booking is no longer assigned to this partner");
    tx.update(ref,{partnerAccepted:true,acceptedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
    tx.update(partnerRef,{activeJobs:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp()});
    result={id:snap.id,...b,partnerAccepted:true};
  });
  await auditSecurityEvent({type:"booking_accepted",uid,bookingId});
  return result;
});

exports.rejectBooking=onCall(CALLABLE_OPTIONS,async(request)=>{
  const {uid}=await requirePartner(request);
  const bookingId=String(request.data?.bookingId||"");
  if(!bookingId || bookingId.length>128) throw new Error("Invalid bookingId");
  await rateLimit(uid,"reject");
  const ref=db.collection("bookings").doc(bookingId);
  const snap=await ref.get();
  if(!snap.exists) throw new Error("Booking not found");
  const b=snap.data()||{};
  if(b.partnerId!==uid) throw new Error("Booking is not assigned to this partner");
  if(!["partner_assigned","requested","searching_partner"].includes(b.status) || b.partnerAccepted===true) throw new Error("Booking cannot be rejected now");
  await ref.update({partnerId:FieldValue.delete(),partnerAccepted:false,status:"searching_partner",rejectedPartnerIds:FieldValue.arrayUnion(uid),updatedAt:FieldValue.serverTimestamp()});
  await db.collection("partners").doc(uid).set({currentBookingId:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
  const updated=(await ref.get()).data()||{};
  const partner=await findPartner(updated);
  if(partner && partner.id!==uid){
    await db.runTransaction(async(tx)=>{
      const bookingRef=db.collection("bookings").doc(bookingId);
      const partnerRef=db.collection("partners").doc(partner.id);
      const bookingSnap=await tx.get(bookingRef);
      const partnerSnap=await tx.get(partnerRef);
      const liveBooking=bookingSnap.data()||{};
      const livePartner=partnerSnap.data()||{};
      if(liveBooking.partnerId || livePartner.currentBookingId || livePartner.approved!==true || livePartner.online!==true || livePartner.available===false)return;
      tx.update(bookingRef,{partnerId:partner.id,status:"partner_assigned",dispatchedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
      tx.update(partnerRef,{currentBookingId:bookingId,updatedAt:FieldValue.serverTimestamp()});
    });
    await notifyUser(partner.id,"New Near Family job","You have a new service request.",{bookingId,status:"partner_assigned"});
    await auditSecurityEvent({type:"booking_rejected",uid,bookingId,reassignedTo:partner.id});
    return {ok:true,reassignedTo:partner.id};
  }
  await auditSecurityEvent({type:"booking_rejected",uid,bookingId,reassignedTo:null});
  return {ok:true,reassignedTo:null};
});

exports.updateJobStatus=onCall(CALLABLE_OPTIONS,async(request)=>{
  const {uid}=await requirePartner(request);
  const bookingId=String(request.data?.bookingId||"");
  const next=normalizeStatus(request.data?.status);
  const allowed={partner_assigned:["partner_on_the_way","cancelled"],partner_on_the_way:["service_started","cancelled"],service_started:["completed","cancelled"]};
  if(!bookingId || bookingId.length>128 || !allowed[next]) throw new Error("Invalid status request");
  await rateLimit(uid,"status");
  const ref=db.collection("bookings").doc(bookingId);
  let result;
  await db.runTransaction(async(tx)=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new Error("Booking not found");
    const b=snap.data()||{};
    if(b.partnerId!==uid) throw new Error("Booking is not assigned to this partner");
    if(b.partnerAccepted!==true) throw new Error("Partner must accept the booking before changing its status");
    if(!(allowed[b.status]||[]).includes(next)) throw new Error("Invalid status transition");
    const patch={status:next,updatedAt:FieldValue.serverTimestamp()};
    if(next==="partner_on_the_way")patch.onTheWayAt=FieldValue.serverTimestamp();
    if(next==="service_started")patch.serviceStartedAt=FieldValue.serverTimestamp();
    if(next==="completed"){
      const proofUrl=String(request.data?.proofUrl||"");
      const encodedPrefix="/o/bookings%2F"+encodeURIComponent(bookingId)+"%2Fcompletion%2F";
      const rawPrefix="/o/bookings/"+bookingId+"/completion/";
      if(!proofUrl || !(proofUrl.startsWith("https://firebasestorage.googleapis.com/") || proofUrl.startsWith("https://firebasestorage.app/")) || !(proofUrl.includes(encodedPrefix)||proofUrl.includes(rawPrefix))) throw new Error("Completion proof must be a Firebase Storage file for this booking");
      patch.completedAt=FieldValue.serverTimestamp();
      patch.completionProofUrl=proofUrl;
      patch.completionNotes=String(request.data?.notes||"").slice(0,4000);
    }
    if(next==="cancelled")patch.cancelledAt=FieldValue.serverTimestamp();
    tx.update(ref,patch);
    if((next==="completed" || next==="cancelled") && b.partnerAccepted===true){
      const partnerRef=db.collection("partners").doc(uid);
      const partnerSnap=await tx.get(partnerRef);
      const currentJobs=Math.max(0,Number(partnerSnap.data()?.activeJobs||0));
      tx.update(partnerRef,{
        activeJobs:Math.max(0,currentJobs-1),
        currentBookingId:FieldValue.delete(),
        updatedAt:FieldValue.serverTimestamp()
      });
    }
    result={ok:true,status:next};
  });
  await auditSecurityEvent({type:"booking_status_changed",uid,bookingId,status:next});
  return result;
});


exports.resolveBookingCancellation=onCall(CALLABLE_OPTIONS,async(request)=>{
  if(!request.auth) throw new Error("Authentication required");
  const bookingId=String(request.data?.bookingId||"");
  const decision=String(request.data?.decision||"").toLowerCase();
  if(!bookingId || bookingId.length>128 || !["approve","reject"].includes(decision)) throw new Error("Invalid cancellation resolution");
  await rateLimit(request.auth.uid,"resolve_cancel");
  const isAdmin=request.auth.token?.admin===true;
  const ref=db.collection("bookings").doc(bookingId);
  let result;
  await db.runTransaction(async(tx)=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new Error("Booking not found");
    const b=snap.data()||{};
    if(b.status!=="cancellation_requested") throw new Error("Cancellation is not pending");
    if(!isAdmin && b.partnerId!==request.auth.uid) throw new Error("Not authorized to resolve this cancellation");
    if(decision==="reject"){
      const restoredStatus=b.partnerAccepted===true?"partner_assigned":"searching_partner";
      tx.update(ref,{
        status:restoredStatus,
        cancellationRejectedAt:FieldValue.serverTimestamp(),
        cancellationRejectedBy:request.auth.uid,
        updatedAt:FieldValue.serverTimestamp()
      });
      result={status:restoredStatus};
      return;
    }
    const partnerWasAccepted=b.partnerAccepted===true;
    tx.update(ref,{
      status:"cancelled",
      cancelledAt:FieldValue.serverTimestamp(),
      cancellationResolvedAt:FieldValue.serverTimestamp(),
      cancellationResolvedBy:request.auth.uid,
      updatedAt:FieldValue.serverTimestamp()
    });
    if(partnerWasAccepted && b.partnerId){
      const partnerRef=db.collection("partners").doc(b.partnerId);
      const partnerSnap=await tx.get(partnerRef);
      const jobs=Math.max(0,Number(partnerSnap.data()?.activeJobs||0));
      tx.update(partnerRef,{activeJobs:Math.max(0,jobs-1),currentBookingId:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});
    }
    result={status:"cancelled"};
  });
  await auditSecurityEvent({
    type:"booking_cancellation_resolved",
    uid:request.auth.uid,
    bookingId,
    decision,
    isAdmin
  });
  return {ok:true,...result};
});

exports.requestBookingCancellation=onCall(CALLABLE_OPTIONS,async(request)=>{
  if(!request.auth) throw new Error("Authentication required");
  const bookingId=String(request.data?.bookingId||"");
  if(!bookingId || bookingId.length>128) throw new Error("Invalid bookingId");
  await rateLimit(request.auth.uid,"cancel");
  const ref=db.collection("bookings").doc(bookingId);
  let partnerId=null;
  await db.runTransaction(async(tx)=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new Error("Booking not found");
    const b=snap.data()||{};
    if(b.customerId!==request.auth.uid) throw new Error("Not your booking");
    if(["completed","cancelled","cancellation_requested"].includes(b.status)) throw new Error("Booking cannot be cancelled now");
    partnerId=b.partnerId||null;
    tx.update(ref,{
      status:"cancellation_requested",
      cancellationRequestedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp()
    });
  });
  if(partnerId) await notifyUser(partnerId,"Near Family — Cancellation requested","The customer has requested cancellation of a booking.",{bookingId,status:"cancellation_requested"});
  await auditSecurityEvent({type:"booking_cancellation_requested",uid:request.auth.uid,bookingId,partnerId});
  return {ok:true,status:"cancellation_requested"};
});
