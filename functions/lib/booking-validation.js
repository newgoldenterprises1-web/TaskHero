const crypto=require("crypto");

const BOOKING_FIELDS=[
  "service","category","price","name","phone","for","forWho",
  "familyMemberId","address","addressId","date","time",
  "instructions","photos","location","clientRequestId"
];

function assertText(value,max,name){
  const v=String(value??"").trim();
  if(v.length>max)throw new Error(name+" is too long");
  return v;
}

function validClientRequestId(value){
  const v=String(value||"").trim();
  return v.length>=16 && v.length<=128 && /^[A-Za-z0-9._-]+$/.test(v);
}

function bookingDocId(uid,clientRequestId){
  return crypto.createHash("sha256").update(uid+"|"+clientRequestId).digest("hex");
}

function assertAllowedFields(data){
  if(data===null||typeof data!=="object"||Array.isArray(data))throw new Error("Invalid booking payload");
  if(Object.keys(data).some(k=>!BOOKING_FIELDS.includes(k)))throw new Error("Invalid booking fields");
}

function validateBookingDate(value){
  const date=String(value||"").trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error("Invalid service date");
  const requestedDate=new Date(date+"T00:00:00Z");
  if(Number.isNaN(requestedDate.getTime()))throw new Error("Invalid service date");
  const [year,month,day]=date.split("-").map(Number);
  if(requestedDate.getUTCFullYear()!==year||requestedDate.getUTCMonth()+1!==month||requestedDate.getUTCDate()!==day){
    throw new Error("Invalid service date");
  }
  const today=new Date();
  const todayUtc=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()));
  if(requestedDate<todayUtc)throw new Error("Service date cannot be in the past");
  return date;
}

function validateBookingLocation(location){
  if(location===null||location===undefined)return null;
  const lat=Number(location.lat),lng=Number(location.lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat<-90||lat>90||lng<-180||lng>180){
    throw new Error("Invalid booking location");
  }
  const label=String(location.label||"").trim().slice(0,200);
  return {lat,lng,...(label?{label}:{})};
}

module.exports={
  BOOKING_FIELDS,
  assertText,
  validClientRequestId,
  bookingDocId,
  assertAllowedFields,
  validateBookingDate,
  validateBookingLocation
};
