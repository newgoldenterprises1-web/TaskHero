// Small Firebase adapter. UI stays independent from Firebase details.
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
    async createBooking(data){
      const u=await this.signIn();if(!u)return null;
      const ref=await this.db.collection("bookings").add({...data,customerId:u.uid,createdAt:this.firebase.firestore.FieldValue.serverTimestamp(),updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()});
      return ref.id;
    },
    async getBooking(id){
      if(!this.ready)return null;
      const s=await this.db.collection("bookings").doc(id).get();
      return s.exists?{id:s.id,...s.data()}:null;
    }
  };
})();