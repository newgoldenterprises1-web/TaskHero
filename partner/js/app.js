let partnerUser=null,partnerData={},unsubscribe=null,activeUnsub=null;
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const pretty=s=>String(s||"").replaceAll("_"," ");
function statusClass(s){return "pill px-3 py-1 text-xs font-bold bg-[#e9f6f1] text-[#176b5b]";}
function setStatus(t,ok=false){$("status").textContent=t;$("status").className="text-xs px-3 py-2 rounded-full "+(ok?"bg-[#dcefe7] text-[#176b5b]":"bg-amber-50 text-amber-700");}
function functionsApi(){return firebase.app().functions();}
async function initPartner(){
 try{
  await NearFamilyBackend.init();
  if(!NearFamilyBackend.ready){setStatus("Firebase setup required");return;}
  partnerUser=await NearFamilyBackend.signIn(); $("uid").textContent="Partner ID: "+partnerUser.uid; setStatus("Connected",true);
  const ref=NearFamilyBackend.db.collection("partners").doc(partnerUser.uid);
  const snap=await ref.get();
  if(!snap.exists) await ref.set({name:"",phone:"",serviceCategories:[],online:false,available:false,approved:false,activeJobs:0,rating:0,createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
  unsubscribe=ref.onSnapshot(s=>{partnerData=s.data()||{};renderProfile();renderApproval();});
  $("refreshBtn").onclick=loadRequests; $("saveProfile").onclick=saveProfile;
  $("onlineBtn").onclick=()=>togglePartner("online"); $("availableBtn").onclick=()=>togglePartner("available");
  loadRequests();
  subscribePartnerBookings();
  setupPartnerPush();
 }catch(e){console.error(e);setStatus("Connection error");$("msg").textContent=e.message||String(e);}
}
function renderProfile(){
 $("pName").value=partnerData.name||"";$("pPhone").value=partnerData.phone||"";$("pServices").value=(partnerData.serviceCategories||[]).join(", ");
 $("onlineBtn").textContent=partnerData.online?"Online":"Offline"; $("onlineBtn").className="pill px-4 py-2 text-xs font-bold "+(partnerData.online?"bg-[#176b5b] text-white":"bg-[#eef4f2] text-slate-600");
 $("availableBtn").textContent=partnerData.available?"Available":"Unavailable"; $("availableBtn").className="pill px-4 py-2 text-xs font-bold "+(partnerData.available?"bg-[#176b5b] text-white":"bg-[#eef4f2] text-slate-600");
}
function renderApproval(){
 $("approval").classList.remove("hidden");
 $("approvalText").textContent=partnerData.approved?"Your partner account is approved. You can receive assigned jobs.":"Your profile is saved, but admin approval is still required before you can receive jobs.";
}
async function saveProfile(){
 try{await NearFamilyBackend.updatePartnerProfile({name:$("pName").value.trim(),phone:$("pPhone").value.trim(),serviceCategories:$("pServices").value.split(",").map(x=>x.trim()).filter(Boolean)});$("msg").textContent="Profile saved.";renderApproval();}catch(e){$("msg").textContent=e.message||String(e);}
}
async function updatePartnerLocation(){
 if(!navigator.geolocation)return;
 return new Promise(resolve=>navigator.geolocation.getCurrentPosition(async pos=>{
   try{
     await NearFamilyBackend.updatePartnerLocation(
       Number(pos.coords.latitude.toFixed(6)),
       Number(pos.coords.longitude.toFixed(6)),
       Math.round(pos.coords.accuracy||0)
     );
   }catch(e){console.warn("Partner location update failed",e)}
   resolve();
 },()=>resolve(),{enableHighAccuracy:true,timeout:9000,maximumAge:300000})); 
}
async function togglePartner(field){
 try{
   const next=!Boolean(partnerData[field]);
   if(next && (field==="online" || field==="available")) await updatePartnerLocation();
   await NearFamilyBackend.updatePartnerAvailability(field,next);
 }catch(e){$("msg").textContent=e.message||String(e);}
}
function requestCard(b){
 return '<div class="border border-[#dcefe7] rounded-2xl p-4"><div class="flex justify-between gap-3"><div><b>'+esc(b.serviceName||b.service||b.category||"Service request")+'</b><div class="text-xs text-slate-500 mt-1">'+esc(b.date||"")+' '+esc(b.time||"")+'</div></div><span class="'+statusClass(b.status)+'">'+esc(pretty(b.status))+'</span></div><div class="text-sm mt-3">'+esc(b.address||b.location||"Location not provided")+'</div><div class="text-xs text-slate-500 mt-1">'+esc(b.instructions||"No special instructions")+'</div><div class="flex gap-2 mt-4">'+(b.status==="partner_assigned"&&!b.partnerAccepted?'<button onclick="acceptJob(\''+b.id+'\')" class="px-4 py-2 rounded-xl bg-[#176b5b] text-white text-xs font-bold">Accept</button><button onclick="rejectJob(\''+b.id+'\')" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">Reject</button>':'<button onclick="openActive(\''+b.id+'\')" class="px-4 py-2 rounded-xl bg-[#e9f6f1] text-[#176b5b] text-xs font-bold">Open Job</button>')+'</div></div>';
}
async function loadRequests(){
 if(!partnerUser)return;
 try{
  const snap=await NearFamilyBackend.db.collection("bookings").where("partnerId","==",partnerUser.uid).orderBy("createdAt","desc").limit(30).get();
  renderRequests(snap.docs.map(d=>({id:d.id,...d.data()})));
 }catch(e){$("requests").innerHTML='<div class="text-sm text-red-500">Unable to load assigned jobs.</div>';console.warn(e);}
}
function renderRequests(list){
 $("requests").innerHTML=list.length?list.map(requestCard).join(""):'<div class="text-sm text-slate-400">No assigned jobs right now.</div>';
 const active=list.find(x=>["partner_assigned","partner_on_the_way","service_started","cancellation_requested"].includes(x.status));
 if(active)openActive(active.id); else $("activeSection").classList.add("hidden");
}
function subscribePartnerBookings(){
 if(unsubscribe)unsubscribe();
 unsubscribe=NearFamilyBackend.db.collection("bookings").where("partnerId","==",partnerUser.uid).orderBy("createdAt","desc").limit(30)
 .onSnapshot(snap=>renderRequests(snap.docs.map(d=>({id:d.id,...d.data()}))),err=>console.warn("Partner realtime booking sync unavailable",err));
}
async function setupPartnerPush(){
 const key=window.NEAR_FAMILY_FIREBASE_CONFIG?.messagingVapidKey;
 if(!key||key.startsWith("REPLACE_")||!window.Notification)return;
 try{
  const token=await NearFamilyBackend.registerMessagingToken(key);
  if(token) $("msg").textContent="Notifications enabled for job updates.";
 }catch(e){console.warn("Partner push unavailable",e);}
}
async function resolveCancellation(id,decision){
 const label=decision==="approve"?"approve the cancellation":"reject the cancellation";
 if(!confirm("Do you want to "+label+"?"))return;
 try{await NearFamilyBackend.resolveBookingCancellation(id,decision);await loadRequests();openActive(id);}
 catch(e){alert(e.message||String(e));}
}
async function acceptJob(id){
 try{await functionsApi().httpsCallable("acceptBooking")({bookingId:id});await loadRequests();openActive(id);}catch(e){alert(e.message||String(e));}
}
async function rejectJob(id){
 if(!confirm("Reject this job and allow reassignment?"))return;
 try{await functionsApi().httpsCallable("rejectBooking")({bookingId:id});await loadRequests();}catch(e){alert(e.message||String(e));}
}
async function openActive(id){
 const b=await NearFamilyBackend.getBooking(id); if(!b)return;
 $("activeSection").classList.remove("hidden");$("activeStatus").textContent=pretty(b.status);$("activeStatus").className=statusClass(b.status);
 let action="";
 if(b.status==="cancellation_requested")action='<div class="space-y-2"><p class="text-sm text-amber-700 font-bold">Customer requested cancellation.</p><div class="flex gap-2"><button onclick="resolveCancellation(\''+b.id+'\',\'approve\')" class="px-4 py-3 rounded-xl bg-red-50 text-red-700 text-sm font-bold">Approve Cancellation</button><button onclick="resolveCancellation(\''+b.id+'\',\'reject\')" class="px-4 py-3 rounded-xl bg-[#176b5b] text-white text-sm font-bold">Reject Cancellation</button></div></div>';
 else if(b.status==="partner_assigned"&&b.partnerAccepted)action='<button onclick="moveStatus(\''+b.id+'\',\'partner_on_the_way\')" class="px-4 py-3 rounded-xl bg-[#176b5b] text-white text-sm font-bold">Start Navigation / On the way</button>';
 else if(b.status==="partner_on_the_way")action='<button onclick="moveStatus(\''+b.id+'\',\'service_started\')" class="px-4 py-3 rounded-xl bg-[#176b5b] text-white text-sm font-bold">Start Service</button>';
 else if(b.status==="service_started")action='<div class="space-y-3"><input id="proof_'+b.id+'" type="file" accept="image/*" class="w-full border border-[#dcefe7] rounded-xl p-3 text-sm"><textarea id="notes_'+b.id+'" class="w-full border border-[#dcefe7] rounded-xl p-3 text-sm" placeholder="Completion notes"></textarea><button onclick="completeJob(\''+b.id+'\')" class="px-4 py-3 rounded-xl bg-[#176b5b] text-white text-sm font-bold">Upload proof & Complete</button></div>';
 else if(b.status==="completed")action='<div class="text-sm text-[#176b5b] font-bold">✓ Job completed</div>';
 $("activeJob").innerHTML='<div class="grid sm:grid-cols-2 gap-4"><div><div class="text-xs text-slate-400">Service</div><div class="font-bold">'+esc(b.serviceName||b.service||b.category||"Service")+'</div><div class="text-xs text-slate-400 mt-3">Customer / family</div><div>'+esc(b.familyMemberName||b.customerName||"Customer")+'</div></div><div><div class="text-xs text-slate-400">Location</div><div>'+esc(b.address||b.location||"Not provided")+'</div><div class="text-xs text-slate-400 mt-3">Instructions</div><div>'+esc(b.instructions||"None")+'</div></div></div><div class="mt-5">'+action+'</div>';
}
async function moveStatus(id,status){try{await functionsApi().httpsCallable("updateJobStatus")({bookingId:id,status});await loadRequests();openActive(id);}catch(e){alert(e.message||String(e));}}
async function completeJob(id){
 const file=$("proof_"+id)?.files?.[0]; if(!file){alert("Please upload completion proof.");return;}
 try{const path="bookings/"+id+"/completion/"+Date.now()+"_"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const snap=await NearFamilyBackend.storage.ref(path).put(file);const url=await snap.ref.getDownloadURL();const notes=$("notes_"+id)?.value||"";await functionsApi().httpsCallable("updateJobStatus")({bookingId:id,status:"completed",proofUrl:url,notes});await loadRequests();openActive(id);}catch(e){alert(e.message||String(e));}
}
window.addEventListener("load",initPartner);
