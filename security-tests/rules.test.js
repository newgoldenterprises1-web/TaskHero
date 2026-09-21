const fs=require("fs");
const assert=require("assert");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
}=require("@firebase/rules-unit-testing");
const {doc,setDoc,getDoc,updateDoc,collection,addDoc}=require("firebase/firestore");
const {ref,uploadBytes}=require("firebase/storage");

const projectId="demo-near-family";
let testEnv;

describe("Near Family security rules",function(){
  this.timeout(20000);

  before(async()=>{
    testEnv=await initializeTestEnvironment({
      projectId,
      firestore:{rules:fs.readFileSync("../firestore.rules","utf8")},
      storage:{rules:fs.readFileSync("../storage.rules","utf8")}
    });
  });

  after(async()=>{await testEnv.cleanup();});
  beforeEach(async()=>{await testEnv.clearFirestore();});

  it("blocks unauthenticated user data access",async()=>{
    const db=testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db,"users","customer-a")));
  });

  it("blocks clients from security telemetry",async()=>{
    const db=testEnv.authenticatedContext("customer-a").firestore();
    await assertFails(getDoc(doc(db,"securityEvents","e1")));
    await assertFails(setDoc(doc(db,"securityEvents","e1"),{type:"tamper"}));
    await assertFails(getDoc(doc(db,"securityRateLimits","customer-a_create")));
  });

  it("allows a customer to create only their own user profile",async()=>{
    const db=testEnv.authenticatedContext("customer-a").firestore();
    await assertSucceeds(setDoc(doc(db,"users","customer-a"),{
      name:"Customer",phone:"+911234567890",updatedAt:new Date()
    }));
    await assertFails(setDoc(doc(db,"users","customer-b"),{
      name:"Attack",phone:"+911234567890",updatedAt:new Date()
    }));
  });

  it("prevents customers from directly creating bookings",async()=>{
    const db=testEnv.authenticatedContext("customer-a").firestore();
    await assertFails(addDoc(collection(db,"bookings"),{
      service:"Home Help",category:"Home Services",price:500,name:"Customer",
      phone:"+911234567890",for:"Me",forWho:"Me",address:"Test",date:"2026-09-21",
      time:"10:00",instructions:"",photos:[],location:null,customerId:"customer-a",
      status:"requested",createdAt:new Date(),updatedAt:new Date()
    }));
  });

  it("prevents customers from changing booking lifecycle fields",async()=>{
    await testEnv.withSecurityRulesDisabled(async(ctx)=>{
      await setDoc(doc(ctx.firestore(),"bookings","b1"),{
        customerId:"customer-a",partnerId:"partner-a",status:"partner_assigned",
        service:"Home Help",category:"Home Services",price:500,createdAt:new Date()
      });
    });
    const db=testEnv.authenticatedContext("customer-a").firestore();
    await assertFails(updateDoc(doc(db,"bookings","b1"),{status:"completed"}));
    await assertFails(updateDoc(doc(db,"bookings","b1"),{partnerId:"attacker"}));
    await assertFails(updateDoc(doc(db,"bookings","b1"),{price:1}));
  });

  it("allows only the assigned partner to read a booking",async()=>{
    await testEnv.withSecurityRulesDisabled(async(ctx)=>{
      await setDoc(doc(ctx.firestore(),"bookings","b2"),{
        customerId:"customer-a",partnerId:"partner-a",status:"partner_assigned"
      });
    });
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext("customer-a").firestore(),"bookings/b2")));
    await assertSucceeds(getDoc(doc(testEnv.authenticatedContext("partner-a").firestore(),"bookings/b2")));
    await assertFails(getDoc(doc(testEnv.authenticatedContext("partner-b").firestore(),"bookings/b2")));
  });

  it("prevents partners from changing protected profile fields",async()=>{
    await testEnv.withSecurityRulesDisabled(async(ctx)=>{
      await setDoc(doc(ctx.firestore(),"partners","partner-a"),{
        approved:true,activeJobs:0,rating:5,name:"P",phone:"1",serviceCategories:["Home Services"],
        online:true,available:true
      });
    });
    const db=testEnv.authenticatedContext("partner-a").firestore();
    await assertSucceeds(updateDoc(doc(db,"partners","partner-a"),{online:false,updatedAt:new Date()}));
    await assertFails(updateDoc(doc(db,"partners","partner-a"),{approved:true,updatedAt:new Date()}));
    await assertFails(updateDoc(doc(db,"partners","partner-a"),{rating:5,updatedAt:new Date()}));
  });

  it("blocks direct support-ticket status escalation",async()=>{
    const db=testEnv.authenticatedContext("customer-a").firestore();
    await assertFails(addDoc(collection(db,"supportTickets"),{
      customerId:"customer-a",subject:"x",message:"x",status:"closed",
      createdAt:new Date(),updatedAt:new Date()
    }));
  });

  it("allows booking photo upload only to its customer",async()=>{
    await testEnv.withSecurityRulesDisabled(async(ctx)=>{
      await setDoc(doc(ctx.firestore(),"bookings","b3"),{
        customerId:"customer-a",partnerId:"partner-a",status:"partner_assigned"
      });
    });
    const bytes=new Uint8Array([137,80,78,71]);
    const customerStorage=testEnv.authenticatedContext("customer-a").storage();
    const partnerStorage=testEnv.authenticatedContext("partner-a").storage();
    await assertSucceeds(uploadBytes(ref(customerStorage,"users/customer-a/bookings/b3/photo.png"),bytes,{contentType:"image/png"}));
    await assertFails(uploadBytes(ref(partnerStorage,"users/customer-a/bookings/b3/hack.png"),bytes,{contentType:"image/png"}));
  });
});