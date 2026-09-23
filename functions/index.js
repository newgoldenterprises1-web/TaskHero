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
function serviceAreaRadiusKm(p){
  const value=Number(p.serviceRadiusKm ?? p.maxServiceRadiusKm);
  return Number.isFinite(value)&&value>0&&value<=500 ? value : null;
}
function partnerMatchesServiceArea(p,booking,distance){
  const configured=serviceAreaRadiusKm(p);
  if(configured!==null){
    // A configured service radius is enforced only when both sides have coordinates.
    // If the booking has no coordinates, keep the partner eligible for manual/locality fallback.
    return distance===null || distance<=configured;
  }
  // If a partner explicitly supplies service-area labels, use the booking label/address
  // as an additional server-side locality check. Without either field, do not invent geography.
  const areas=Array.isArray(p.serviceAreas)?p.serviceAreas.map(x=>String(x||"").trim().toLowerCase()).filter(Boolean):[];
  if(!areas.length)return true;
  const haystack=[booking.location?.label,booking.address].map(x=>String(x||"").toLowerCase()).join(" ");
  return areas.some(area=>haystack.includes(area));
}
async function findPartners(booking){
  const snap=await db.collection("partners")
    .where("online","==",true)
    .where("approved","==",true)
    .where("available","==",true)
    .limit(100).get();
  const category=String(booking.category||"").trim();
  return snap.docs.map(d=>({id:d.id,...d.data()}))
    .filter(p=>{
      const categories=Array.isArray(p.serviceCategories)?p.serviceCategories:[];
      const skills=Array.isArray(p.skills)?p.skills:[];
      return categories.includes(category)||skills.includes(category);
    })
    .map(p=>{
      const distance=distanceKm(booking.location,partnerLocation(p));
      return {...p,distanceKm:distance,locationFresh:partnerHasFreshLocation(p)};
    })
    .filter(p=>!p.currentBookingId
      && !(booking.rejectedPartnerIds||[]).includes(p.id)
      && partnerMatchesServiceArea(p,booking,p.distanceKm))
    .sort((a,b)=>{
      // Prefer an eligible partner with a fresh location, then proximity,
      // then lower active load, then higher rating.
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

async function dispatchPendingBookingForPartner(partnerId){
  const partnerRef=db.collection("partners").doc(partnerId);
  const partnerSnap=await partnerRef.get();
  if(!partnerSnap.exists)return null;
  const partner=partnerSnap.data()||{};
  if(partner.approved!==true || partner.online!==true || partner.available!==true || partner.currentBookingId)return null;
  const categories=Array.isArray(partner.serviceCategories)?partner.serviceCategories.filter(Boolean).slice(0,30):[];
  const skills=Array.isArray(partner.skills)?partner.skills.filter(Boolean).slice(0,30):[];
  if(!categories.length&&!skills.length)return null;

  const pendingSnap=await db.collection("bookings")
    .where("status","==","searching_partner")
    .orderBy("createdAt","asc")
    .limit(50).get();

  for(const doc of pendingSnap.docs){
    const booking=doc.data()||{};
    if(booking.partnerId ||
       !(categories.includes(String(booking.category||"")) || skills.includes(String(booking.category||""))) ||
       (booking.rejectedPartnerIds||[]).includes(partnerId)) continue;

    let assigned=false;
    try{
      await db.runTransaction(async(tx)=>{
        const bookingSnap=await tx.get(doc.ref);
        const livePartnerSnap=await tx.get(partnerRef);
        if(!bookingSnap.exists || !livePartnerSnap.exists)return;
        const b=bookingSnap.data()||{};
        const p=livePartnerSnap.data()||{};
        if(b.partnerId || b.status!== "searching_partner" ||
           (b.rejectedPartnerIds||[]).includes(partnerId) ||
           p.approved!==true || p.online!==true || p.available!==true || p.currentBookingId)return;
        const dispatchDistance=distanceKm(b.location,partnerLocation(p));
        if(!partnerMatchesServiceArea(p,b,dispatchDistance))return;
        tx.update(doc.ref,{
          partnerId,
          status:"partner_assigned",
          dispatchedAt:FieldValue.serverTimestamp(),
          updatedAt:FieldValue.serverTimestamp()
        });
        tx.update(partnerRef,{
          currentBookingId:doc.id,
          updatedAt:FieldValue.serverTimestamp()
        });
        assigned=true;
      });
    }catch(err){
      console.warn("Pending booking dispatch failed",partnerId,doc.id,err);
    }
    if(assigned){
      await notifyUser(booking.customerId,"Near Family — Partner assigned","A verified partner has been assigned to your request.",{
        bookingId:doc.id,status:"partner_assigned"
      });
      await notifyUser(partnerId,"New Near Family job","You have a new service request.",{
        bookingId:doc.id,status:"partner_assigned"
      });
      return doc.id;
    }
  }
  return null;
}

exports.onPartnerAvailabilityUpdated=onDocumentUpdated("partners/{partnerId}",async(event)=>{
  const before=event.data.before.data()||{};
  const after=event.data.after.data()||{};
  const becameEligible=after.approved===true && after.online===true && after.available===true && !after.currentBookingId;
  if(!becameEligible)return;
  const relevantChange=
    before.approved!==after.approved ||
    before.online!==after.online ||
    before.available!==after.available ||
    before.currentBookingId!==after.currentBookingId ||
    Number(before.serviceRadiusKm||0)!==Number(after.serviceRadiusKm||0) ||
    JSON.stringify(before.serviceAreas||[])!==JSON.stringify(after.serviceAreas||[]) ||
    JSON.stringify(before.skills||[])!==JSON.stringify(after.skills||[]) ||
    JSON.stringify(before.serviceCategories||[])!==JSON.stringify(after.serviceCategories||[]) ||
    JSON.stringify(before.partnerLocation||null)!==JSON.stringify(after.partnerLocation||null);
  if(!relevantChange)return;
  await dispatchPendingBookingForPartner(event.params.partnerId);
});

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
        if(livePartner.approved!==true || livePartner.online!==true || livePartner.available!==true || livePartner.currentBookingId)return;
        const liveDistance=distanceKm(currentBooking.location,partnerLocation(livePartner));
        if(!partnerMatchesServiceArea(livePartner,currentBooking,liveDistance))return;

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
    if(partner.approved!==true || partner.online!==true || partner.available!==true || partner.currentBookingId!==bookingId) throw new Error("This booking is no longer assigned to this partner");
    const acceptDistance=distanceKm(b.location,partnerLocation(partner));
    if(!partnerMatchesServiceArea(partner,b,acceptDistance)) throw new Error("This booking is outside your service area");
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
  let result=null;
  await db.runTransaction(async(tx)=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new Error("Booking not found");
    const b=snap.data()||{};
    if(b.partnerId!==uid) throw new Error("Booking is not assigned to this partner");
    if(!["partner_assigned","requested","searching_partner"].includes(b.status) || b.partnerAccepted===true) throw new Error("Booking cannot be rejected now");
    const oldPartnerRef=db.collection("partners").doc(uid);
    const oldPartnerSnap=await tx.get(oldPartnerRef);
    const oldPartner=oldPartnerSnap.data()||{};
    tx.update(ref,{
      partnerId:FieldValue.delete(),
      partnerAccepted:false,
      status:"searching_partner",
      rejectedPartnerIds:FieldValue.arrayUnion(uid),
      updatedAt:FieldValue.serverTimestamp()
    });
    tx.update(oldPartnerRef,{currentBookingId:FieldValue.delete(),updatedAt:FieldValue.serverTimestamp()});
    const candidates=await findPartners(b);
    const next=candidates.find(p=>p.id!==uid && !(b.rejectedPartnerIds||[]).includes(p.id));
    if(next){
      const nextRef=db.collection("partners").doc(next.id);
      const nextSnap=await tx.get(nextRef);
      const nextPartner=nextSnap.data()||{};
      const d=distanceKm(b.location,partnerLocation(nextPartner));
      if(nextPartner.approved===true && nextPartner.online===true && nextPartner.available===true &&
         !nextPartner.currentBookingId && partnerMatchesServiceArea(nextPartner,b,d)){
        tx.update(ref,{partnerId:next.id,status:"partner_assigned",dispatchedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
        tx.update(nextRef,{currentBookingId:bookingId,updatedAt:FieldValue.serverTimestamp()});
        result={ok:true,reassignedTo:next.id};
      }
    }
  });
  if(result?.reassignedTo){
    await notifyUser(result.reassignedTo,"New Near Family job","You have a new service request.",{bookingId,status:"partner_assigned"});
  }
  await auditSecurityEvent({type:"booking_rejected",uid,bookingId,reassignedTo:result?.reassignedTo||null});
  return result||{ok:true,reassignedTo:null};
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
