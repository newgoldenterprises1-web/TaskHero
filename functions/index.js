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
    .filter(p=>p.available!==false)
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
