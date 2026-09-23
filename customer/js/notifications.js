async function setupCustomerPushNotifications(){
  if(!NearFamilyBackend.ready||!state.user)return;
  const key=window.NEAR_FAMILY_FIREBASE_CONFIG?.messagingVapidKey;
  if(!key||key.startsWith("REPLACE_")||!window.Notification)return;
  try{
    const token=await NearFamilyBackend.registerMessagingToken(key);
    if(token)toast('Notifications enabled for booking updates');
    NearFamilyBackend.onForegroundMessage(payload=>{
      const title=payload?.notification?.title||'Near Family update';
      const body=payload?.notification?.body||'Your booking has a new update.';
      toast(title+' — '+body);
    });
  }catch(e){console.warn('Push notifications unavailable; app continues normally',e)}
}

async function syncCloudBookings(){if(!NearFamilyBackend.ready||!state.user)return;try{const cloud=await NearFamilyBackend.listBookings();state.bookings=Array.isArray(cloud)?cloud.map(b=>({...b,createdAt:b.createdAt?.toDate?b.createdAt.toDate().toISOString():b.createdAt})):[];state.cloudHydrated=true;save();renderBookings();let n=state.bookings.filter(b=>!['completed','Completed','cancelled'].includes(String(b.status))).length;$('bookingBadge').classList.toggle('hide',!n);if(n)$('bookingBadge').textContent=n}catch(e){console.warn('Cloud booking sync unavailable; local data retained',e)}}

async function syncCustomerData(){if(!NearFamilyBackend.ready||!state.user)return;try{const [families,addresses]=await Promise.all([NearFamilyBackend.listFamilyMembers(),NearFamilyBackend.listAddresses()]);state.families=Array.isArray(families)?families.map(f=>({id:f.id,name:f.name,relationship:f.relationship,phone:f.phone||'',address:f.address||''})):[];state.addresses=Array.isArray(addresses)?addresses:[];state.cloudHydrated=true;save();renderAll()}catch(e){console.warn('Customer data sync unavailable; local data retained',e)}}

function subscribeToBookingUpdates(){if(!NearFamilyBackend.ready||!state.user)return;if(state.unsubscribeBookings)state.unsubscribeBookings();let initial=true;const previous={};state.unsubscribeBookings=NearFamilyBackend.subscribeBookings(items=>{const next=items.map(b=>({...b,createdAt:b.createdAt?.toDate?b.createdAt.toDate().toISOString():b.createdAt,status:b.status||'requested'}));next.forEach(b=>{const before=previous[b.id];if(!initial&&before&&before!==b.status){const label=bookingStatusLabel(b.status);toast('Booking update: '+label);if(b.status==='completed')setTimeout(()=>toast('Your service is completed ❤️'),150)}});next.forEach(b=>previous[b.id]=b.status);state.bookings=next;save();renderBookings();let n=state.bookings.filter(b=>!['completed','Completed','cancelled'].includes(String(b.status))).length;$('bookingBadge').classList.toggle('hide',!n);if(n)$('bookingBadge').textContent=n;initial=false})}

async function initNearFamily(){setTimeout(()=>{$('splash').style.display='none';if(state.user)startApp();else $('auth').classList.add('active')},1600);if(!state.user)$('auth').classList.remove('active');try{await NearFamilyBackend.init();if(NearFamilyBackend.ready&&state.user){await NearFamilyBackend.saveUser({name:state.user.name,phone:state.user.phone});if(!state.cloudHydrated){await syncCustomerData();await syncCloudBookings()}subscribeToBookingUpdates();await setupCustomerPushNotifications()}}catch(e){console.warn('Backend unavailable; local mode retained',e)}}
