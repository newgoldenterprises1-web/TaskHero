const assert=require("node:assert/strict");
const {
  SERVICE_CATALOG
}=require("../lib/catalog");
const {
  assertText,
  validClientRequestId,
  bookingDocId,
  assertAllowedFields,
  validateBookingDate,
  validateBookingLocation
}=require("../lib/booking-validation");

assert.equal(SERVICE_CATALOG["Parent Daily Assistance"].price,299);
assert.equal(SERVICE_CATALOG["Parent Daily Assistance"].category,"Family Assistance");

assert.equal(assertText("  Shahed  ",80,"Name"),"Shahed");
assert.equal(validClientRequestId("client_1234567890"),true);
assert.equal(validClientRequestId("too-short"),false);

const id1=bookingDocId("user-a","client_1234567890");
const id2=bookingDocId("user-a","client_1234567890");
const id3=bookingDocId("user-b","client_1234567890");
assert.equal(id1,id2);
assert.notEqual(id1,id3);

assert.doesNotThrow(()=>assertAllowedFields({service:"Parent Daily Assistance",clientRequestId:"client_1234567890"}));
assert.throws(()=>assertAllowedFields({service:"Parent Daily Assistance",unexpected:true}),/Invalid booking fields/);

const today=new Date();
const yyyy=today.getUTCFullYear();
const mm=String(today.getUTCMonth()+1).padStart(2,"0");
const dd=String(today.getUTCDate()).padStart(2,"0");
const validToday=`${yyyy}-${mm}-${dd}`;
assert.equal(validateBookingDate(validToday),validToday);
assert.throws(()=>validateBookingDate("2026-02-30"),/Invalid service date/);
assert.throws(()=>validateBookingDate("not-a-date"),/Invalid service date/);

assert.deepEqual(validateBookingLocation({lat:17.4,lng:78.4,label:"Hyderabad"}),{
  lat:17.4,lng:78.4,label:"Hyderabad"
});
assert.equal(validateBookingLocation(null),null);
assert.throws(()=>validateBookingLocation({lat:100,lng:0}),/Invalid booking location/);

console.log("Near Family booking validation tests passed.");
