const {onCall}=require("firebase-functions/v2/https");
const {onDocumentCreated,onDocumentUpdated}=require("firebase-functions/v2/firestore");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {getMessaging}=require("firebase-admin/messaging");

initializeApp();
const db=getFirestore();

const ACTIVE_STATUSES=new Set(["requested","partner_assigned","partner_on_the_way","service_started"]);
const normalizeStatus=s=>String(s||"requested").toLowerCase().replace(/\s+/g,"_");

exports.health=onCall(()=>({ok:true,service:"near-family-functions"}));

exports.createSupportTicket=onCall(async(request)=>{
  if(!request.auth) throw new Error("Authentication required");
  const data=request.data||{};
  const ref=await db.collection("supportTickets").add({
    customerId:request.auth.uid,
    subject:String(data.subject||"Support request"),
    message:String(data.message||""),
    status:"open",
    createdAt:FieldValue.serverTimestamp(),
    updatedAt:FieldValue.serverTimestamp()
  });
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

exports.acceptBooking=onCall(async(request)=>{
  const {uid}=await requirePartner(request);
  const bookingId=String(request.data?.bookingId||"");
  if(!bookingId) throw new Error("bookingId required");
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
  return result;
});

exports.rejectBooking=onCall(async(request)=>{
  const {uid}=await requirePartner(request);
  const bookingId=String(request.data?.bookingId||"");
  if(!bookingId) throw new Error("bookingId required");
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
    return {ok:true,reassignedTo:partner.id};
  }
  return {ok:true,reassignedTo:null};
});

exports.updateJobStatus=onCall(async(request)=>{
  const {uid}=await requirePartner(request);
  const bookingId=String(request.data?.bookingId||"");
  const next=normalizeStatus(request.data?.status);
  const allowed={partner_assigned:["partner_on_the_way","cancelled"],partner_on_the_way:["service_started","cancelled"],service_started:["completed","cancelled"]};
  if(!bookingId || !allowed[next]) throw new Error("Invalid status request");
  const ref=db.collection("bookings").doc(bookingId);
  const snap=await ref.get();
  if(!snap.exists) throw new Error("Booking not found");
  const b=snap.data()||{};
  if(b.partnerId!==uid) throw new Error("Booking is not assigned to this partner");
  if(!(allowed[b.status]||[]).includes(next)) throw new Error("Invalid status transition");
  const patch={status:next,updatedAt:FieldValue.serverTimestamp()};
  if(next==="partner_on_the_way")patch.onTheWayAt=FieldValue.serverTimestamp();
  if(next==="service_started")patch.serviceStartedAt=FieldValue.serverTimestamp();
  if(next==="completed"){\n    if(!request.data?.proofUrl) throw new Error("Completion proof is required");\n    patch.completedAt=FieldValue.serverTimestamp();\n    patch.completionProofUrl=String(request.data.proofUrl);\n    patch.completionNotes=String(request.data.notes||"");\n  }
  if(next==="cancelled")patch.cancelledAt=FieldValue.serverTimestamp();
  await ref.update(patch);
  return {ok:true,status:next};
});
