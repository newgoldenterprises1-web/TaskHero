const assert=require("node:assert/strict");
const {
  normalizeStatus,
  canTransition,
  ACTIVE_STATUSES
}=require("../lib/lifecycle");

assert.equal(normalizeStatus("Partner On The Way"),"partner_on_the_way");
assert.equal(canTransition("requested","searching_partner"),true);
assert.equal(canTransition("searching_partner","partner_assigned"),true);
assert.equal(canTransition("partner_assigned","partner_on_the_way"),true);
assert.equal(canTransition("partner_on_the_way","service_started"),true);
assert.equal(canTransition("service_started","completed"),true);
assert.equal(canTransition("service_started","cancellation_requested"),true);

assert.equal(canTransition("completed","partner_on_the_way"),false);
assert.equal(canTransition("cancelled","partner_assigned"),false);
assert.equal(canTransition("requested","completed"),false);
assert.equal(canTransition("searching_partner","service_started"),false);

assert.equal(ACTIVE_STATUSES.has("requested"),true);
assert.equal(ACTIVE_STATUSES.has("searching_partner"),true);
assert.equal(ACTIVE_STATUSES.has("partner_assigned"),true);
assert.equal(ACTIVE_STATUSES.has("completed"),false);
assert.equal(ACTIVE_STATUSES.has("cancelled"),false);

console.log("Near Family lifecycle tests passed.");
