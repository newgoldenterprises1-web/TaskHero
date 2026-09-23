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

  const partnerRef=db.collection("partners").doc(partnerId);
  const result={partnerId,status:decision==="approve"?"approved":decision==="suspend"?"suspended":"rejected",releasedBookingId:null};

  await db.runTransaction(async(tx)=>{
    const snap=await tx.get(partnerRef);
    if(!snap.exists) throw new Error("Partner not found");
    const partner=snap.data()||{};

    const patch={
      approved:decision==="approve",
      approvalStatus:result.status,
      approvalNote:note,
      reviewedBy:adminUid,
      reviewedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp()
    };

    if(decision==="approve"){
      tx.update(partnerRef,patch);
      return;
    }

    patch.online=false;
    patch.available=false;
    tx.update(partnerRef,patch);

    const bookingId=String(partner.currentBookingId||"").trim();
    if(!bookingId)return;

    const bookingRef=db.collection("bookings").doc(bookingId);
    const bookingSnap=await tx.get(bookingRef);
    if(!bookingSnap.exists)return;

    const booking=bookingSnap.data()||{};
    const bookingStatus=normalizeStatus(booking.status);
    const releasableStatus=ACTIVE_STATUSES.has(bookingStatus) || bookingStatus==="cancellation_requested";
    if(booking.partnerId!==partnerId || !releasableStatus)return;

    if(booking.partnerAccepted===true){
      tx.update(bookingRef,{
        partnerId:FieldValue.delete(),
        partnerAccepted:false,
        status:"searching_partner",
        partnerSuspendedAt:FieldValue.serverTimestamp(),
        partnerSuspendedBy:adminUid,
        updatedAt:FieldValue.serverTimestamp()
      });
      result.releasedBookingId=bookingId;
    }else{
      tx.update(bookingRef,{
        partnerId:FieldValue.delete(),
        status:"searching_partner",
        partnerSuspendedAt:FieldValue.serverTimestamp(),
        partnerSuspendedBy:adminUid,
        updatedAt:FieldValue.serverTimestamp()
      });
      result.releasedBookingId=bookingId;
    }

    tx.update(partnerRef,{
      currentBookingId:FieldValue.delete(),
      activeJobs:Math.max(0,Number(partner.activeJobs||0)-(booking.partnerAccepted===true?1:0)),
      updatedAt:FieldValue.serverTimestamp()
    });
  });

  await db.collection("users").doc(partnerId).set({
    partnerApprovalStatus:result.status,
    partnerApprovalNote:note,
    updatedAt:FieldValue.serverTimestamp()
  },{merge:true});

  await notifyUser(
    partnerId,
    "Near Family — Partner account update",
    decision==="approve"
      ? "Your partner account has been approved."
      : result.releasedBookingId
        ? "Your partner account was suspended and your active booking was released for reassignment."
        : "Your partner account status was updated by Near Family operations.",
    {partnerId,status:result.status,releasedBookingId:result.releasedBookingId}
  );

  if(result.releasedBookingId){
    await tryRedispatchBooking(result.releasedBookingId,partnerId);
  }

  await auditSecurityEvent({
    type:"partner_approval_changed",
    uid:adminUid,
    partnerId,
    decision,
    releasedBookingId:result.releasedBookingId
  });

  return {ok:true,...result};
});
const ACTIVE_STATUSES=new Set(["requested","partner_assigned","partner_on_the_way","service_started"]);
const normalizeStatus=s=>String(s||"requested").toLowerCase().replace(/\s+/g,"_");

exports.adminRunLifecycleAudit=onCall(CALLABLE_OPTIONS,async(request)=>{
  const adminUid=requireAdmin(request);
  const limitCount=Math.min(200,Math.max(20,Number(request.data?.limit||100)));

  const [bookingsSnap,partnersSnap]=await Promise.all([
    db.collection("bookings").orderBy("createdAt","desc").limit(limitCount).get(),
    db.collection("partners").orderBy("createdAt","desc").limit(limitCount).get()
  ]);

  const bookings=bookingsSnap.docs.map(d=>({id:d.id,...d.data()}));
  const partners=partnersSnap.docs.map(d=>({id:d.id,...d.data()}));
  const partnerMap=new Map(partners.map(p=>[p.id,p]));
  const bookingMap=new Map(bookings.map(b=>[b.id,b]));
  const issues=[];

  function issue(type,severity,entityId,details){
    if(issues.length>=100)return;
    issues.push({type,severity,entityId,details});
  }

  for(const booking of bookings){
    const status=normalizeStatus(booking.status);
    const isActive=ACTIVE_STATUSES.has(status)||status==="cancellation_requested";
    const partnerId=String(booking.partnerId||"").trim();

    if(["partner_assigned","partner_on_the_way","service_started","cancellation_requested"].includes(status) && !partnerId){
      issue("booking_missing_partner","high",booking.id,{status});
    }

    if(["requested","searching_partner"].includes(status) && partnerId){
      issue("booking_has_stale_partner","high",booking.id,{status,partnerId});
    }

    if(booking.partnerAccepted===true && !partnerId){
      issue("booking_accepted_without_partner","high",booking.id,{status});
    }

    if(isActive && partnerId){
      const partner=partnerMap.get(partnerId);
      if(!partner){
        issue("booking_partner_missing","high",booking.id,{status,partnerId});
      }else{
        if(partner.currentBookingId!==booking.id){
          issue("partner_booking_pointer_mismatch","high",booking.id,{status,partnerId,currentBookingId:partner.currentBookingId||null});
        }
        if(status==="partner_assigned" && partner.approved!==true){
          issue("assigned_to_unapproved_partner","high",booking.id,{partnerId});
        }
        if(status==="partner_assigned" && partner.online!==true){
          issue("assigned_to_offline_partner","medium",booking.id,{partnerId});
        }
      }
    }

    if(status==="completed"){
      if(!booking.completedAt)issue("completed_missing_timestamp","medium",booking.id,{});
      if(!booking.completionProofUrl)issue("completed_missing_proof","high",booking.id,{});
      else if(booking.completionProofVerified!==true)issue("completed_proof_unverified","medium",booking.id,{});
    }

    if(status==="cancellation_requested" && !booking.cancellationPreviousStatus){
      issue("cancellation_missing_previous_status","high",booking.id,{});
    }

    if(["completed","cancelled"].includes(status) && partnerId){
      const partner=partnerMap.get(partnerId);
      if(partner?.currentBookingId===booking.id){
        issue("terminal_booking_still_claimed","high",booking.id,{partnerId});
      }
    }
  }

  for(const partner of partners){
    const currentBookingId=String(partner.currentBookingId||"").trim();
    const activeJobs=Math.max(0,Number(partner.activeJobs||0));

    if(activeJobs>1){
      issue("partner_active_jobs_overflow","high",partner.id,{activeJobs});
    }

    if(activeJobs>0 && !currentBookingId){
      issue("partner_active_jobs_without_booking","high",partner.id,{activeJobs});
    }

    if(activeJobs===0 && currentBookingId){
      issue("partner_booking_without_active_job","high",partner.id,{currentBookingId});
    }

    if(partner.available===true && partner.online!==true){
      issue("partner_available_offline","high",partner.id,{});
    }

    if(partner.approved!==true && (partner.online===true||partner.available===true)){
      issue("unapproved_partner_operational","high",partner.id,{approved:partner.approved===true,online:partner.online===true,available:partner.available===true});
    }

    if(currentBookingId){
      const booking=bookingMap.get(currentBookingId);
      if(!booking){
        issue("partner_points_to_missing_booking","high",partner.id,{currentBookingId});
      }else{
        const status=normalizeStatus(booking.status);
        if(!ACTIVE_STATUSES.has(status) && status!=="cancellation_requested"){
          issue("partner_points_to_terminal_booking","high",partner.id,{currentBookingId,status});
        }
        if(String(booking.partnerId||"")!==partner.id){
          issue("partner_booking_reverse_pointer_mismatch","high",partner.id,{currentBookingId,bookingPartnerId:booking.partnerId||null});
        }
      }
    }
  }

  const severityCounts=issues.reduce((acc,item)=>{
    acc[item.severity]=(acc[item.severity]||0)+1;
    return acc;
  },{});

  await auditSecurityEvent({
    type:"booking_lifecycle_audit",
    uid:adminUid,
    metadata:{
      bookingsChecked:bookings.length,
      partnersChecked:partners.length,
      issueCount:issues.length,
      severityCounts
    }
  });

  return {
    ok:true,
    generatedAt:new Date().toISOString(),
    checked:{bookings:bookings.length,partners:partners.length},
    issues,
    summary:{issueCount:issues.length,severityCounts}
  };
});


exports.health=onCall(CALLABLE_OPTIONS,()=>({ok:true,service:"near-family-functions"}));

const SERVICE_CATALOG={
  "Parent Daily Assistance":{category:"Family Assistance",price:299},
  "Hospital Companion":{category:"Health & Hospital",price:499},
  "Medicine Pickup & Delivery":{category:"Pickups & Errands",price:149},
  "Grocery & Essentials Pickup":{category:"Pickups & Errands",price:149},
  "Electrician Visit":{category:"Home Services",price:199},
  "Plumbing Assistance":{category:"Home Services",price:199},
  "Laptop & Mobile Repair":{category:"Repairs & Maintenance",price:249},
  "Appliance Repair":{category:"Repairs & Maintenance",price:299},
  "Document Pickup & Submission":{category:"Pickups & Errands",price:199},
  "Family Function Assistance":{category:"Events & Special Help",price:499},
  "Doctor Appointment Assistance":{category:"Health & Hospital",price:299},
  "Home Check & Small Tasks":{category:"Family Assistance",price:249}
};

function validClientRequestId(value){
  const v=String(value||"").trim();
  return v.length>=16 && v.length<=128 && /^[A-Za-z0-9._-]+$/.test(v);
}
function bookingDocId(uid,clientRequestId){
  const crypto=require("crypto");
  return crypto.createHash("sha256").update(uid+"|"+clientRequestId).digest("hex");
}

exports.createBooking=onCall(CALLABLE_OPTIONS,async(request)=>{
  if(!request.auth) throw new Error("Authentication required");
  await rateLimit(request.auth.uid,"create");
  const data=request.data||{};
  if(data===null || typeof data!=="object" || Array.isArray(data)) throw new Error("Invalid booking payload");
  const allowed=["service","category","price","name","phone","for","forWho","familyMemberId","address","addressId","date","time","instructions","photos","location","clientRequestId"];
  const keys=Object.keys(data);
  if(keys.some(k=>!allowed.includes(k))) throw new Error("Invalid booking fields");

  const clientRequestId=String(data.clientRequestId||"").trim();
  if(!validClientRequestId(clientRequestId)) throw new Error("Invalid booking request id");

  const service=assertText(data.service,160,"Service");
  const category=assertText(data.category,120,"Category");
  const name=assertText(data.name,120,"Name");
  const phone=String(data.phone||"").trim();
  const address=String(data.address||"").trim();
  const date=String(data.date||"").trim();
  const time=String(data.time||"").trim();
  if(!service||!category||!name||phone.length<10||!address||!date||!time) throw new Error("Required booking details are missing");
  if(service.length>160||category.length>120||name.length>120||phone.length>30||address.length>1000||date.length>40||time.length>80) throw new Error("Booking field is too long");

  const catalog=SERVICE_CATALOG[service];
  if(!catalog || catalog.category!==category) throw new Error("Service is not available");
  const price=Number(data.price);
  if(price!==catalog.price) throw new Error("Invalid service price");

  if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) throw new Error("Invalid service date");
  const requestedDate=new Date(date+"T00:00:00Z");
  if(Number.isNaN(requestedDate.getTime())) throw new Error("Invalid service date");
  const today=new Date();
  const todayUtc=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));
  if(requestedDate<todayUtc) throw new Error("Service date cannot be in the past");

  if(data.photos!==undefined && (!Array.isArray(data.photos) || data.photos.length)) throw new Error("Booking photos must be uploaded after booking creation");
  if(data.location!==null && data.location!==undefined){
    const lat=Number(data.location.lat),lng=Number(data.location.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180) throw new Error("Invalid booking location");
  }

  const forWho=String(data.forWho||"Me").trim();
  if(!["Me","Family"].includes(forWho)) throw new Error("Invalid booking target");
  const familyMemberId=data.familyMemberId?String(data.familyMemberId).trim():"";
  if(forWho==="Family" && !familyMemberId) throw new Error("Family member is required");
  if(forWho==="Me" && familyMemberId) throw new Error("Family member is not valid for this booking");

  const addressId=data.addressId?String(data.addressId).trim():"";
  if(addressId && !/^[A-Za-z0-9_-]{1,150}$/.test(addressId)) throw new Error("Invalid address id");

  const bookingRef=db.collection("bookings").doc(bookingDocId(request.auth.uid,clientRequestId));
  const familyRef=familyMemberId?db.collection("familyMembers").doc(familyMemberId):null;
  const addressRef=addressId?db.collection("addresses").doc(addressId):null;
  let result;

  await db.runTransaction(async(tx)=>{
    const existing=await tx.get(bookingRef);
    if(existing.exists){
      const old=existing.data()||{};
      if(old.customerId!==request.auth.uid || old.clientRequestId!==clientRequestId) throw new Error("Booking request could not be verified");
      result={id:existing.id,status:old.status||"requested",duplicate:true};
      return;
    }

    let family=null;
    if(familyRef){
      const familySnap=await tx.get(familyRef);
      if(!familySnap.exists) throw new Error("Family member not found");
      family=familySnap.data()||{};
      if(family.customerId!==request.auth.uid) throw new Error("Family member does not belong to this account");
    }

    let savedAddress=null;
    if(addressRef){
      const addressSnap=await tx.get(addressRef);
      if(!addressSnap.exists) throw new Error("Saved address not found");
      savedAddress=addressSnap.data()||{};
      if(savedAddress.customerId!==request.auth.uid) throw new Error("Saved address does not belong to this account");
      if(String(savedAddress.address||"").trim()!==address) throw new Error("Saved address does not match the booking address");
    }

    const target=forWho==="Family"
      ? String(family.name||"Family")+" ("+String(family.relationship||"Family")+")"
      : "Me";

    const payload={
      service,category,price,name,phone,
      for:target,forWho,
      familyMemberId:familyMemberId||null,
      address,addressId:addressId||null,date,time,
      instructions:String(data.instructions||"").slice(0,4000),
      photos:[],
      location:data.location||null,
      customerId:request.auth.uid,
      clientRequestId,
      status:"requested",
      createdAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp()
    };
    tx.create(bookingRef,payload);
    result={id:bookingRef.id,status:"requested",duplicate:false};
  });

  if(!result.duplicate) await auditSecurityEvent({type:"booking_created",uid:request.auth.uid,bookingId:result.id,clientRequestId});
  return result;
});

exports.attachBookingPhotos=onCall(CALLABLE_OPTIONS,async(request)=>{
  if(!request.auth) throw new Error("Authentication required");
  const bookingId=String(request.data?.bookingId||"").trim();
  const photos=request.data?.photos;
  if(!bookingId || bookingId.length>128 || !Array.isArray(photos) || photos.length>5) throw new Error("Invalid booking photos request");
  const ref=db.collection("bookings").doc(bookingId);
  await db.runTransaction(async(tx)=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new Error("Booking not found");
    const b=snap.data()||{};
    if(b.customerId!==request.auth.uid) throw new Error("Not your booking");
    if(["completed","cancelled"].includes(String(b.status||""))) throw new Error("Photos cannot be added to this booking");
    const safe=photos.map(p=>{
      if(!p || typeof p!=="object") throw new Error("Invalid booking photo");
      const name=String(p.name||"photo").slice(0,160);
      const url=String(p.url||"");
      const prefix="https://firebasestorage.googleapis.com/";
      const encoded="/o/users%2F"+encodeURIComponent(request.auth.uid)+"%2Fbookings%2F"+encodeURIComponent(bookingId)+"%2F";
      const raw="/o/users/"+request.auth.uid+"/bookings/"+bookingId+"/";
      if(!url.startsWith(prefix) || !(url.includes(encoded)||url.includes(raw))) throw new Error("Booking photo does not belong to this booking");
      return {name,url};
    });
    tx.update(ref,{photos:safe,updatedAt:FieldValue.serverTimestamp()});
  });
  return {ok:true,bookingId,photos};
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

async function tryRedispatchBooking(bookingId,excludedPartnerId=null){
  const ref=db.collection("bookings").doc(bookingId);
  let assignedPartner=null;

  for(let attempt=0;attempt<5;attempt++){
    const snap=await ref.get();
    if(!snap.exists)return null;
    const booking=snap.data()||{};
    const status=normalizeStatus(booking.status);
    if(!["requested","searching_partner"].includes(status) || booking.partnerId)return booking.partnerId||null;

    const candidates=await findPartners({
      ...booking,
      rejectedPartnerIds:[...(booking.rejectedPartnerIds||[]),...(excludedPartnerId?[excludedPartnerId]:[])]
    });

    let assigned=false;
    for(const candidate of candidates){
      try{
        await db.runTransaction(async(tx)=>{
          const liveBookingSnap=await tx.get(ref);
          if(!liveBookingSnap.exists)return;
          const liveBooking=liveBookingSnap.data()||{};
          if(liveBooking.partnerId || !["requested","searching_partner"].includes(normalizeStatus(liveBooking.status)))return;
          if((liveBooking.rejectedPartnerIds||[]).includes(candidate.id) || candidate.id===excludedPartnerId)return;

          const partnerRef=db.collection("partners").doc(candidate.id);
          const partnerSnap=await tx.get(partnerRef);
          if(!partnerSnap.exists)return;
          const partner=partnerSnap.data()||{};
          if(partner.approved!==true || partner.online!==true || partner.available!==true || partner.currentBookingId)return;

          const d=distanceKm(liveBooking.location,partnerLocation(partner));
          if(!partnerMatchesServiceArea(partner,liveBooking,d))return;

          tx.update(ref,{
            partnerId:candidate.id,
            status:"partner_assigned",
            partnerAccepted:false,
            dispatchedAt:FieldValue.serverTimestamp(),
            reassignedAt:FieldValue.serverTimestamp(),
            updatedAt:FieldValue.serverTimestamp()
          });
          tx.update(partnerRef,{
            currentBookingId:bookingId,
            updatedAt:FieldValue.serverTimestamp()
          });
          assigned=true;
        });
      }catch(err){
        console.warn("Redispatch attempt failed",bookingId,candidate.id,err);
      }
      if(assigned){
        assignedPartner=candidate;
        break;
      }
    }

    if(assignedPartner)break;

    await ref.update({
      status:"searching_partner",
      updatedAt:FieldValue.serverTimestamp()
    });

    if(booking.customerId){
      await notifyUser(
        booking.customerId,
        "Near Family — Finding a new partner",
        "Your previous partner is unavailable. We're finding another available verified partner.",
        {bookingId,status:"searching_partner"}
      );
    }
    return null;
  }

  if(assignedPartner){
    await notifyUser(
      booking.customerId,
      "Near Family — Partner reassigned",
      "Your request has been reassigned to another available verified partner.",
      {bookingId,status:"partner_assigned",partnerId:assignedPartner.id}
    );
    await notifyUser(
      assignedPartner.id,
      "New Near Family job",
      "You have a reassigned service request.",
      {bookingId,status:"partner_assigned"}
    );
    return assignedPartner.id;
  }

  if(booking.customerId){
    await notifyUser(
      booking.customerId,
      "Near Family — Finding a new partner",
      "Your previous partner is unavailable. We're finding another available verified partner.",
      {bookingId,status:"searching_partner"}
    );
  }
  return null;
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


async function requirePartnerBase(request){
  if(!request.auth) throw new Error("Authentication required");
  const snap=await db.collection("partners").doc(request.auth.uid).get();
  if(!snap.exists) throw new Error("Partner profile not found");
  const partner=snap.data()||{};
  return {uid:request.auth.uid,partner};
}
async function requirePartner(request){
  const result=await requirePartnerBase(request);
  if(result.partner.approved!==true) throw new Error("Partner is not approved yet");
  if(result.partner.online!==true) throw new Error("Partner is not currently online");
  return result;
}

exports.updatePartnerProfile=onCall(CALLABLE_OPTIONS,async(request)=>{
  const {uid}=await requirePartnerBase(request);
  const data=request.data||{};
  const name=String(data.name||"").trim();
  const phone=String(data.phone||"").trim();
  const serviceCategories=Array.isArray(data.serviceCategories)
    ? [...new Set(data.serviceCategories.map(x=>String(x||"").trim()).filter(Boolean))].slice(0,12)
    : [];
  const allowedCategories=["Family Assistance","Home Services","Health & Hospital","Pickups & Errands","Repairs & Maintenance","Events & Special Help"];
  if(name.length>120 || phone.length>30 || serviceCategories.some(x=>!allowedCategories.includes(x))) throw new Error("Invalid partner profile");
  if(!name || phone.length<10 || !serviceCategories.length) throw new Error("Name, phone and at least one service category are required");
  const ref=db.collection("partners").doc(uid);
  await db.runTransaction(async(tx)=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new Error("Partner profile not found");
    const p=snap.data()||{};
    if(p.approved===true && serviceCategories.length===0) throw new Error("Approved partners need a service category");
    tx.update(ref,{name,phone,serviceCategories,updatedAt:FieldValue.serverTimestamp()});
  });
  await auditSecurityEvent({type:"partner_profile_updated",uid});
  return {ok:true};
});

exports.updatePartnerAvailability=onCall(CALLABLE_OPTIONS,async(request)=>{
  const {uid}=await requirePartner(request);
  const field=String(request.data?.field||"");
  const next=request.data?.value===true;
  if(!["online","available"].includes(field)) throw new Error("Invalid availability field");
  const ref=db.collection("partners").doc(uid);
  let result;
  await db.runTransaction(async(tx)=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new Error("Partner profile not found");
    const p=snap.data()||{};
    if(p.approved!==true) throw new Error("Partner is not approved yet");
    if(next && !p.partnerLocation) throw new Error("Current location is required before going online");
    if(field==="available" && next && p.online!==true) throw new Error("Partner must be online before becoming available");

    if(field==="online" && !next && p.currentBookingId){
      throw new Error("Partner cannot go offline while a job is assigned. Complete, reject, or resolve the active job first.");
    }

    if(field==="online" && !next && p.available===true){
      tx.update(ref,{online:false,available:false,updatedAt:FieldValue.serverTimestamp()});
      result={online:false,available:false};
      return;
    }
    tx.update(ref,{[field]:next,updatedAt:FieldValue.serverTimestamp()});
    result={online:field==="online"?next:p.online,available:field==="available"?next:p.available};
  });
  await auditSecurityEvent({type:"partner_availability_changed",uid,field,value:next});
  return result;
});

exports.updatePartnerLocation=onCall(CALLABLE_OPTIONS,async(request)=>{
  const {uid,partner}=await requirePartnerBase(request);
  const lat=Number(request.data?.lat),lng=Number(request.data?.lng),accuracy=Number(request.data?.accuracy||0);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180||!Number.isFinite(accuracy)||accuracy<0||accuracy>10000) throw new Error("Invalid partner location");
  const ref=db.collection("partners").doc(uid);
  if(partner.approved!==true) throw new Error("Partner is not approved yet");
  await ref.update({
    partnerLocation:{lat:Number(lat.toFixed(6)),lng:Number(lng.toFixed(6)),accuracy:Math.round(accuracy),updatedAt:FieldValue.serverTimestamp()},
    updatedAt:FieldValue.serverTimestamp()
  });
  return {ok:true};
});

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
    if(next==="completed" || next==="cancelled"){
      const partnerRef=db.collection("partners").doc(uid);
      const partnerSnap=await tx.get(partnerRef);
      const partner=partnerSnap.data()||{};
      // Only release this partner's slot when this booking still owns it.
      // This prevents a late completion/cancellation from clearing a newer job.
      if(partner.currentBookingId===bookingId){
        const shouldDecrement=b.partnerAccepted===true;
        const currentJobs=Math.max(0,Number(partner.activeJobs||0));
        tx.update(partnerRef,{
          ...(shouldDecrement?{activeJobs:Math.max(0,currentJobs-1)}:{}),
          currentBookingId:FieldValue.delete(),
          updatedAt:FieldValue.serverTimestamp()
        });
      }
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
  if(!isAdmin){
    const {partner}=await requirePartnerBase(request);
    if(partner.approved!==true) throw new Error("Partner is not approved yet");
  }

  const ref=db.collection("bookings").doc(bookingId);
  let result;
  let shouldRedispatch=false;
  await db.runTransaction(async(tx)=>{
    const snap=await tx.get(ref);
    if(!snap.exists) throw new Error("Booking not found");
    const b=snap.data()||{};
    if(b.status!=="cancellation_requested") throw new Error("Cancellation is not pending");
    if(!isAdmin && b.partnerId!==request.auth.uid) throw new Error("Not authorized to resolve this cancellation");

    const previousStatus=normalizeStatus(b.cancellationPreviousStatus);
    const fallbackStatus=b.partnerAccepted===true?"partner_assigned":(b.partnerId?"partner_assigned":"searching_partner");
    const restoredStatus=ACTIVE_STATUSES.has(previousStatus)?previousStatus:fallbackStatus;

    if(decision==="reject"){
      tx.update(ref,{
        status:restoredStatus,
        cancellationRejectedAt:FieldValue.serverTimestamp(),
        cancellationRejectedBy:request.auth.uid,
        updatedAt:FieldValue.serverTimestamp()
      });
      result={status:restoredStatus};
      return;
    }

    tx.update(ref,{
      status:"cancelled",
      cancelledAt:FieldValue.serverTimestamp(),
      cancellationResolvedAt:FieldValue.serverTimestamp(),
      cancellationResolvedBy:request.auth.uid,
      updatedAt:FieldValue.serverTimestamp()
    });

    if(b.partnerId){
      const partnerRef=db.collection("partners").doc(b.partnerId);
      const partnerSnap=await tx.get(partnerRef);
      const partner=partnerSnap.data()||{};
      if(partner.currentBookingId===bookingId){
        const currentJobs=Math.max(0,Number(partner.activeJobs||0));
        const patch={
          currentBookingId:FieldValue.delete(),
          updatedAt:FieldValue.serverTimestamp()
        };
        if(b.partnerAccepted===true)patch.activeJobs=Math.max(0,currentJobs-1);
        tx.update(partnerRef,patch);
      }
    }
    result={status:"cancelled"};
  });

  await auditSecurityEvent({
    type:"booking_cancellation_resolved",
    uid:request.auth.uid,
    bookingId,
    decision,
    isAdmin,
    status:result.status
  });

  return {ok:true,...result};
});

function completionStoragePath(proofUrl,bookingId){
  const url=String(proofUrl||"");
  if(!(url.startsWith("https://firebasestorage.googleapis.com/")||url.startsWith("https://firebasestorage.app/")))return null;
  const marker="/o/";
  const start=url.indexOf(marker);
  if(start<0)return null;
  const encodedPath=url.slice(start+marker.length).split("?")[0];
  let path;
  try{path=decodeURIComponent(encodedPath)}catch(e){return null}
  const prefix="bookings/"+bookingId+"/completion/";
  return path.startsWith(prefix)?path:null;
}

exports.verifyBookingCompletionProof=onCall(CALLABLE_OPTIONS,async(request)=>{
  const adminUid=requireAdmin(request);
  const bookingId=String(request.data?.bookingId||"").trim();
  const note=String(request.data?.note||"").trim().slice(0,1000);
  if(!bookingId||bookingId.length>128)throw new Error("Invalid bookingId");

  const ref=db.collection("bookings").doc(bookingId);
  const snap=await ref.get();
  if(!snap.exists)throw new Error("Booking not found");
  const booking=snap.data()||{};
  if(normalizeStatus(booking.status)!=="completed")throw new Error("Booking is not completed");
  const proofUrl=String(booking.completionProofUrl||"");
  if(!proofUrl)throw new Error("Completion proof is missing");

  const storagePath=completionStoragePath(proofUrl,bookingId);
  if(!storagePath)throw new Error("Completion proof does not belong to this booking");

  let exists=true;
  try{
    const bucket=require("firebase-admin/storage").getStorage().bucket();
    const result=await bucket.file(storagePath).exists();
    exists=result[0]===true;
  }catch(err){
    console.error("Completion proof existence check failed",err);
    throw new Error("Completion proof could not be verified");
  }
  if(!exists)throw new Error("Completion proof file was not found");

  await ref.update({
    completionProofVerified:true,
    completionProofVerifiedBy:adminUid,
    completionProofVerifiedAt:FieldValue.serverTimestamp(),
    completionProofVerificationNote:note,
    updatedAt:FieldValue.serverTimestamp()
  });

  await auditSecurityEvent({
    type:"booking_completion_proof_verified",
    uid:adminUid,
    bookingId,
    metadata:{storagePath,note}
  });

  return {ok:true,bookingId,verified:true};
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
      cancellationPreviousStatus:b.status,
      cancellationRequestedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp()
    });
  });
  if(partnerId) await notifyUser(partnerId,"Near Family — Cancellation requested","The customer has requested cancellation of a booking.",{bookingId,status:"cancellation_requested"});
  await auditSecurityEvent({type:"booking_cancellation_requested",uid:request.auth.uid,bookingId,partnerId});
  return {ok:true,status:"cancellation_requested"};
});
