function toggleAuth(sign){$('loginBox').classList.toggle('hide',sign);$('signupBox').classList.toggle('hide',!sign)}

async function login(){
  let phone=$('loginPhone').value.trim();
  if(phone.length<10)return toast('Please enter a valid mobile number.');
  if(NearFamilyBackend.ready){
    try{
      if(!$('loginOtp').classList.contains('hidden')){
        let code=$('loginOtp').value.trim();
        if(code.length!==6)return toast('Please enter the 6-digit OTP.');
        const u=await NearFamilyBackend.confirmPhoneCode(code);
        if(!u)return toast('OTP verification failed.');
        let cloudUser=null;
        try{const snap=await NearFamilyBackend.db.collection('users').doc(u.uid).get();if(snap.exists)cloudUser=snap.data()||null}catch(e){console.warn('Unable to load customer profile',e)}
        state.user={name:cloudUser?.name||'Near Family Customer',phone:cloudUser?.phone||phone,uid:u.uid};
      }else{
        await NearFamilyBackend.startPhoneVerification(phone,'loginRecaptcha');
        $('loginOtp').classList.remove('hidden');$('loginBtn').textContent='Verify OTP';$('loginPhone').disabled=true;
        return toast('OTP sent to your mobile.');
      }
    }catch(e){console.warn(e);return toast('OTP could not be sent. Check Firebase Phone Auth setup.')}
  }
  if(!state.user?.uid)state.user={name:'Near Family Customer',phone};
  save();
  if(NearFamilyBackend.ready)await NearFamilyBackend.saveUser({name:state.user.name,phone});
  startApp();
}

async function signup(){
  let name=$('signupName').value.trim(),phone=$('signupPhone').value.trim();
  if(!name||phone.length<10)return toast('Please enter your name and mobile number.');
  if(NearFamilyBackend.ready){
    try{
      if(!$('signupOtp').classList.contains('hidden')){
        let code=$('signupOtp').value.trim();
        if(code.length!==6)return toast('Please enter the 6-digit OTP.');
        const u=await NearFamilyBackend.confirmPhoneCode(code);
        if(!u)return toast('OTP verification failed.');
        state.user={name,phone,uid:u.uid};
      }else{
        await NearFamilyBackend.startPhoneVerification(phone,'signupRecaptcha');
        $('signupOtp').classList.remove('hidden');$('signupBtn').textContent='Verify OTP';$('signupPhone').disabled=true;
        return toast('OTP sent to your mobile.');
      }
    }catch(e){console.warn(e);return toast('OTP could not be sent. Check Firebase Phone Auth setup.')}
  }
  if(!state.user?.uid)state.user={name,phone};
  save();
  if(NearFamilyBackend.ready)await NearFamilyBackend.saveUser({name:state.user.name,phone});
  startApp();
}

async function startApp(){
  $('splash').style.display='none';$('auth').classList.remove('active');$('app').classList.add('active');
  $('hello').textContent='Hi, '+(state.user?.name?.split(' ')[0]||'there')+' 👋';
  $('profileName').textContent=state.user?.name||'Customer';$('profilePhone').textContent=state.user?.phone||'';
  renderAll();ensureLocation();
  if(window.NearFamilyBackend?.ready&&state.user){
    try{await NearFamilyBackend.saveUser({name:state.user.name,phone:state.user.phone});}catch(e){console.warn('User cloud sync unavailable',e)}
    if(!state.cloudHydrated){
      await syncCustomerData();
      await syncCloudBookings();
    }
    subscribeToBookingUpdates();
    await setupCustomerPushNotifications();
  }
}

async function logout(){
  if(state.unsubscribeBookings){state.unsubscribeBookings();state.unsubscribeBookings=null}
  if(window.NearFamilyBackend?.ready){
    try{await NearFamilyBackend.signOut()}catch(e){console.warn('Firebase sign-out failed',e)}
  }
  state.user=null;state.cloudHydrated=false;save();
  $('app').classList.remove('active');$('auth').classList.add('active');toggleAuth(false);
  toast('Logged out');
}
