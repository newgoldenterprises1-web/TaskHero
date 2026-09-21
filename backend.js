// Near Family Firebase data adapter
(function(){
  const cfg=window.NEAR_FAMILY_FIREBASE_CONFIG;
  const B=window.NearFamilyBackend={
    ready:false,firebase:null,auth:null,db:null,storage:null,
    async init(){
      if(!cfg?.projectId||cfg.projectId.startsWith("REPLACE_")||!window.firebase)return false;
      if(!firebase.apps.length)firebase.initializeApp(cfg);
      this.firebase=firebase;this.auth=firebase.auth();this.db=firebase.firestore();this.storage=firebase.storage();
      this.ready=true;return true;
    },
    async signIn(){
      if(!this.ready)return null;
      if(!this.auth.currentUser)await this.auth.signInAnonymously();
      return this.auth.currentUser;
    },
    async saveUser(data){
      const u=await this.signIn();if(!u)return null;
      await this.db.collection("users").doc(u.uid).set({...data,updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
      return u.uid;
    },
    async saveFamilyMember(data){
      const u=await this.signIn();if(!u)return null;
      const ref=await this.db.collection("familyMembers").add({...data,customerId:u.uid,createdAt:this.firebase.firestore.FieldValue.serverTimestamp(),updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()});
      return ref.id;
    },
    async saveAddress(address){
      const u=await this.signIn();if(!u)return null;
      const ref=await this.db.collection("addresses").add({customerId:u.uid,address:String(address),createdAt:this.firebase.firestore.FieldValue.serverTimestamp(),updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()});
      return ref.id;
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
    async createBooking(data){
      const u=await this.signIn();if(!u)return null;
      const ref=await this.db.collection("bookings").add({...data,customerId:u.uid,status:data.status||"requested",createdAt:this.firebase.firestore.FieldValue.serverTimestamp(),updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()});
      return ref.id;
    },
    async attachBookingPhotos(bookingId,photos){
      const u=await this.signIn();if(!u||!photos?.length)return false;
      await this.db.collection("bookings").doc(bookingId).update({
        photos,
        updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()
      });
      return true;
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
      return snap.docs.map(d=>d.data().address).filter(Boolean);
    },
    subscribeBookings(callback){
      if(!this.ready)return ()=>{};
      let active=true;
      this.signIn().then(u=>{
        if(!u||!active)return;
        this.db.collection("bookings").where("customerId","==",u.uid).orderBy("createdAt","desc").limit(50)
          .onSnapshot(snap=>{
            if(!active)return;
            callback(snap.docs.map(d=>({id:d.id,...d.data()})));
          },err=>console.warn("Booking realtime sync unavailable",err));
      }).catch(err=>console.warn("Booking realtime auth unavailable",err));
      return ()=>{active=false};
    }
  };
})();