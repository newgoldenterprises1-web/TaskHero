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
    async createBooking(data){
      const u=await this.signIn();if(!u)return null;
      const ref=await this.db.collection("bookings").add({...data,customerId:u.uid,status:data.status||"requested",createdAt:this.firebase.firestore.FieldValue.serverTimestamp(),updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()});
      return ref.id;
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
    }
  };
})();