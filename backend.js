// Near Family client backend foundation.
// Safe to load while Firebase credentials are still placeholders.
(function(){
  const cfg=window.NEAR_FAMILY_FIREBASE_CONFIG;
  window.NearFamilyBackend={
    ready:false,
    firebase:null,
    auth:null,
    db:null,
    storage:null,
    messaging:null,
    init:async function(){
      if(!cfg || !cfg.projectId || cfg.projectId.startsWith("REPLACE_")) return false;
      if(!window.firebase) return false;
      this.firebase=window.firebase;
      this.firebase.initializeApp(cfg);
      this.auth=this.firebase.auth();
      this.db=this.firebase.firestore();
      this.storage=this.firebase.storage();
      this.ready=true;
      return true;
    },
    async createBooking(data){
      if(!this.ready) throw new Error("Firebase is not configured");
      const ref=await this.db.collection("bookings").add({
        ...data,
        createdAt:this.firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt:this.firebase.firestore.FieldValue.serverTimestamp()
      });
      return ref.id;
    },
    async getBooking(id){
      if(!this.ready) return null;
      const snap=await this.db.collection("bookings").doc(id).get();
      return snap.exists?{id:snap.id,...snap.data()}:null;
    }
  };
})();