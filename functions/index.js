const {onCall}=require("firebase-functions/v2/https");
const {onDocumentCreated,onDocumentUpdated}=require("firebase-functions/v2/firestore");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
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
  cancel:{max:5,windowMs:10*60*1000}
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
  if(!allowed) throw new Error("Too many requests. Please try again later.");
}

async function auditSecurityEvent(event){
  try{
    await db.collection("securityEvents").add({
      ...event,
      createdAt:FieldValue.serverTimestamp()
    });
  }catch(err){console.error("Security audit write failed",err);}
}

const ACTIVE_STATUSES=new Set(["requested","partner_assigned","partner_on_the_way","service_started"]);
const normalizeStatus=s=>String(s||"requested").toLowerCase().replace(/\s+/g,"_");

exports.health=onCall(CALLABLE_OPTIONS,()=>({ok:true,service:"near-family-functions"}));

exports.createBooking=onCall(CALLABLE_OPTIONS,async(request)=>{
  if(!request.auth) throw new Error("Authentication required");
  await rateLimit(request.auth.uid,"create");
  const data=request.data||{};
  const allowed=["service","category","price","name","phone","for","forWho","familyMemberId","address","date","time","instructions","photos","location"];
  const keys=Object.keys(data);
  if(keys.some(k=>!allowed.includes(k))) throw new Error("Invalid booking fields");
  const service=String(data.service||"").trim();
  const category=String(data.category||"").trim();
  const name=String(data.name||"").trim();
  const phone=String(data.phone||"").trim();
  const address=String(data.address||"").trim();
  const date=String(data.date||"").trim();
  const time=String(data.time||"").trim();
  if(!service||!category||!name||phone.length<10||!address||!date||!time) throw new Error("Required booking details are missing");
  if(service.length>160||category.length>120||name.length>120||phone.length>30||address.length>1000||date.length>40||time.length>80) throw new Error("Booking field is too long");
  const price=Number(data.price);
  if(!Number.isFinite(price)||price<0||price>1000000) throw new Error("Invalid booking price");
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

async function findPartner(booking){
  const snap=await db.collection("partners")
    .where("online","==",true)
    .where("approved","==",true)
    .where("serviceCategories","array-contains",booking.category||"")
    .limit(20).get();
  const candidates=snap.docs.map(d=>({id:d.id,...d.data()}))
    .filter(p=>p.available!==false && !(booking.rejectedPartnerIds||[]).includes(p.id))
    .sort((a,b)=>(Number(a.activeJobs||0)-Number(b.activeJobs||0))||((Number(a.rating||0)*-1)-(Number(b.rating||0)*-1)));
  return candidates[0]||null;
}

exports.onBookingCreated=onDocumentCreated("bookings/{bookingId}",async(event)=>{
  const ref=event.data?.ref;
  const booking=event.data?.data();
  if(!ref||!booking)return;
  if(booking.partnerId)return;
  const partner=await findPartner(booking);
  if(partner){
    await ref.update({
      status:"partner_assigned",
      partnerId:partner.id,
      dispatchedAt:FieldValue.serverTimestamp(),
      updatedAt:FieldValue.serverTimestamp()
    });
    await notifyUser(booking.customerId,"Near Family — Partner assigned","A partner has been assigned to your request.",{bookingId:event.params.bookingId,status:"partner_assigned"});
    await notifyUser(partner.id,"New Near Family job","You have a new service request.",{bookingId:event.params.bookingId,status:"partner_assigned"});
  }else{
    await ref.update({status:"searching_partner",updatedAt:FieldValue.serverTimestamp()});
    await notifyUser(booking.customerId,"Near Family — Finding a partner","We're finding an available verified partner for your request.",{bookingId:event.params.bookingId,status:"searching_partner"});
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
    if(b.status!=="partner_assigned") throw new Error("Booking is no longer available");
    tx.update(ref,{partnerAccepted:true,acceptedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
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
  if(!["partner_assigned","requested","searching_partner"].includes(b.status)) throw new Error("Booking cannot be rejected now");
  await ref.update({partnerId:FieldValue.delete(),partnerAccepted:false,status:"searching_partner",rejectedPartnerIds:FieldValue.arrayUnion(uid),updatedAt:FieldValue.serverTimestamp()});
  const updated=(await ref.get()).data()||{};
  const partner=await findPartner(updated);
  if(partner && partner.id!==uid){
    await ref.update({partnerId:partner.id,status:"partner_assigned",dispatchedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
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
    result={ok:true,status:next};
  });
  await auditSecurityEvent({type:"booking_status_changed",uid,bookingId,status:next});
  return result;
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
