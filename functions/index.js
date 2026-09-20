const {onCall,onDocumentCreated,onDocumentUpdated}=require("firebase-functions/v2/https");
const {initializeApp}=require("firebase-admin/app");
const {getFirestore,FieldValue}=require("firebase-admin/firestore");
const {getMessaging}=require("firebase-admin/messaging");

initializeApp();
const db=getFirestore();

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

exports.onBookingCreated=onDocumentCreated("bookings/{bookingId}",async(event)=>{
  const booking=event.data?.data();
  if(!booking) return;
  // Matching/dispatch will be implemented after partner geo/service indexing is configured.
  await event.data.ref.update({status:booking.status||"requested",updatedAt:FieldValue.serverTimestamp()});
});

exports.onBookingUpdated=onDocumentUpdated("bookings/{bookingId}",async(event)=>{
  const before=event.data.before.data();
  const after=event.data.after.data();
  if(!after || before?.status===after.status) return;
  const uid=after.customerId;
  if(!uid) return;
  const user=await db.collection("users").doc(uid).get();
  const token=user.data()?.fcmToken;
  if(!token) return;
  await getMessaging().send({token,notification:{
    title:"Near Family booking update",
    body:"Your booking is now "+String(after.status).replaceAll("_"," ")
  },data:{bookingId:event.params.bookingId,status:String(after.status)}});
});