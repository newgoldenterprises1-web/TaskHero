// Near Family Firebase data adapter
(function(){
  const cfg=window.NEAR_FAMILY_FIREBASE_CONFIG;
  const B=window.NearFamilyBackend={
    ready:false,firebase:null,auth:null,db:null,storage:null,appCheck:null,phoneVerifier:null,phoneConfirmation:null,
    async init(){
      if(!cfg?.projectId||cfg.projectId.startsWith("REPLACE_")||!window.firebase)return false;
      if(!firebase.apps.length)firebase.initializeApp(cfg);
      this.firebase=firebase;
      if(cfg.appCheckRecaptchaSiteKey && !cfg.appCheckRecaptchaSiteKey.startsWith("REPLACE_") && firebase.appCheck){
        try{
          this.appCheck=firebase.appCheck();
          this.appCheck.activate(new firebase.appCheck.ReCaptchaEnterpriseProvider(cfg.appCheckRecaptchaSiteKey),true);
        }catch(e){console.warn("App Check initialization failed; Firebase services remain available until enforcement is enabled.",e)}
      }
      this.auth=firebase.auth();this.db=firebase.firestore();this.storage=firebase.storage();
      this.ready=true;return true;
    },
    async startPhoneVerification(phone,containerId){
      if(!this.ready||!this.auth)return null;
      if(!phone)return null;
      phone=phone.replace(/[\s()-]/g,"");
      if(/^\d{10}$/.test(phone))phone="+91"+phone;
      if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new Error("Use an international phone number such as +91XXXXXXXXXX.");
      if(!this.phoneVerifier){
        this.phoneVerifier=new this.firebase.auth.RecaptchaVerifier(containerId,{size:"invisible"});
      }
      this.phoneConfirmation=await this.auth.signInWithPhoneNumber(phone,this.phoneVerifier);
      return true;
    },
    async confirmPhoneCode(code){
      if(!this.phoneConfirmation||!code)return null;
      const result=await this.phoneConfirmation.confirm(code);
      this.phoneConfirmation=null;
      return result?.user||null;
    },
    async signIn(){
      if(!this.ready)return null;
      if(!this.auth.currentUser)await this.auth.signInAnonymously();
      return this.auth.currentUser;
    },
    async signOut(){
      if(!this.ready||!this.auth)return;
      if(this.phoneVerifier){
        try{this.phoneVerifier.clear()}catch(e){}
        this.phoneVerifier=null;
      }
      this.phoneConfirmation=null;
      await this.auth.signOut();
    },
    async registerMessagingToken(vapidKey){
      const u=await this.signIn();
      if(!u||!vapidKey||!window.Notification||!this.firebase?.messaging)return null;
      if(Notification.permission==="denied")return null;
      const permission=await Notification.requestPermission();
      if(permission!=="granted")return null;
      const messaging=this.firebase.messaging();
      const token=await messaging.getToken({vapidKey});
      if(token){
        await this.db.collection("users").doc(u.uid).set({
          fcmToken:token,
          fcmTokenUpdatedAt:this.firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()
        },{merge:true});
      }
      return token;
    },
    async saveUser(data){
      const u=await this.signIn();if(!u)return null;
      await this.db.collection("users").doc(u.uid).set({...data,updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
      return u.uid;
    },
    async saveFamilyMember(data,id){
      const u=await this.signIn();if(!u)return null;
      const payload={name:String(data?.name||"").trim(),relationship:String(data?.relationship||"Family").trim(),phone:String(data?.phone||"").trim(),address:String(data?.address||"").trim(),notes:String(data?.notes||"").trim(),updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()};
      if(!payload.name)return null;
      if(id){
        await this.db.collection("familyMembers").doc(id).update(payload);
        return id;
      }
      const ref=await this.db.collection("familyMembers").add({...payload,customerId:u.uid,createdAt:this.firebase.firestore.FieldValue.serverTimestamp()});
      return ref.id;
    },
    async deleteFamilyMember(id){
      const u=await this.signIn();if(!u||!id)return false;
      await this.db.collection("familyMembers").doc(id).delete();return true;
    },
    async saveAddress(address,id){
      const u=await this.signIn();if(!u)return null;
      const value=String(address||"").trim();if(!value)return null;
      if(id){await this.db.collection("addresses").doc(id).update({address:value,updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()});return id;}
      const ref=await this.db.collection("addresses").add({customerId:u.uid,address:value,createdAt:this.firebase.firestore.FieldValue.serverTimestamp(),updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()});
      return ref.id;
    },
    async deleteAddress(id){
      const u=await this.signIn();if(!u||!id)return false;
      await this.db.collection("addresses").doc(id).delete();return true;
    },
    async uploadBookingPhotos(bookingId,files){
      const u=await this.signIn();if(!u||!this.storage||!files?.length)return [];
      const uploads=[];
      for(const file of Array.from(files).slice(0,5)){
        if(!file.type?.startsWith("image/"))continue;
        if(file.size>8*1024*1024)throw new Error("Each photo must be 8 MB or smaller.");
        const safeName=(file.name||"photo").replace(/[^a-zA-Z0-9._-]/g,"_");
        const ref=this.storage.ref().child("users/"+u.uid+"/bookings/"+bookingId+"/"+Date.now()+"-"+safeName);
        const snap=await ref.put(file,{contentType:file.type});
        const url=await snap.ref.getDownloadURL();
        uploads.push({name:file.name||safeName,url});
      }
      return uploads;
    },
    async updatePartnerProfile(data){
      const u=await this.signIn();if(!u||!this.firebase.functions)return false;
      const fn=this.firebase.functions().httpsCallable("updatePartnerProfile");
      await fn(data||{});return true;
    },
    async updatePartnerAvailability(field,value){
      const u=await this.signIn();if(!u||!this.firebase.functions)return false;
      const fn=this.firebase.functions().httpsCallable("updatePartnerAvailability");
      await fn({field,value:Boolean(value)});return true;
    },
    async updatePartnerLocation(lat,lng,accuracy){
      const u=await this.signIn();if(!u||!this.firebase.functions)return false;
      const fn=this.firebase.functions().httpsCallable("updatePartnerLocation");
      await fn({lat,lng,accuracy});return true;
    },
    async createBooking(data){
      const u=await this.signIn();if(!u||!this.firebase.functions)return null;
      const fn=this.firebase.functions().httpsCallable("createBooking");
      const result=await fn(data||{});
      return result?.data?.id||null;
    },
    async attachBookingPhotos(bookingId,photos){
      const u=await this.signIn();if(!u||!this.firebase.functions||!photos?.length)return false;
      const fn=this.firebase.functions().httpsCallable("attachBookingPhotos");
      await fn({bookingId,photos:Array.from(photos).slice(0,5)});
      return true;
    },
    async requestBookingCancellation(bookingId){
      const u=await this.signIn();if(!u||!this.firebase.functions)return null;
      const fn=this.firebase.functions().httpsCallable("requestBookingCancellation");
      return (await fn({bookingId})).data;
    },
    async createSupportTicket(subject,message){
      const u=await this.signIn();if(!u||!this.firebase.functions)return null;
      const fn=this.firebase.functions().httpsCallable("createSupportTicket");
      return (await fn({
        subject:String(subject||"Support request").slice(0,120),
        message:String(message||"").slice(0,4000)
      })).data;
    },
    async getBooking(id){
      if(!this.ready)return null;
      const s=await this.db.collection("bookings").doc(id).get();
      return s.exists?{id:s.id,...s.data()}:null;
    },
    async listBookings(){
      const u=await this.signIn();if(!u)return [];
      const snap=await this.db.collection("bookings").where("customerId","==",u.uid).orderBy("createdAt","desc").limit(50).get();
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    },
    async listFamilyMembers(){
      const u=await this.signIn();if(!u)return [];
      const snap=await this.db.collection("familyMembers").where("customerId","==",u.uid).orderBy("createdAt","desc").limit(50).get();
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    },
    async listAddresses(){
      const u=await this.signIn();if(!u)return [];
      const snap=await this.db.collection("addresses").where("customerId","==",u.uid).orderBy("createdAt","desc").limit(50).get();
      return snap.docs.map(d=>({id:d.id,...d.data()}));
    },
    onForegroundMessage(callback){
      if(!this.ready||!this.firebase?.messaging)return ()=>{};
      const messaging=this.firebase.messaging();
      return messaging.onMessage(payload=>callback?.(payload));
    },
    subscribeBookings(callback){
      if(!this.ready)return ()=>{};
      let active=true;
      let unsubscribe=null;
      this.signIn().then(u=>{
        if(!u||!active)return;
        unsubscribe=this.db.collection("bookings").where("customerId","==",u.uid).orderBy("createdAt","desc").limit(50)
          .onSnapshot(snap=>{
            if(!active)return;
            callback(snap.docs.map(d=>({id:d.id,...d.data()})));
          },err=>console.warn("Booking realtime sync unavailable",err));
        if(!active&&unsubscribe)unsubscribe();
      }).catch(err=>console.warn("Booking realtime auth unavailable",err));
      return ()=>{active=false;if(unsubscribe)unsubscribe();};
    }
  };
})();