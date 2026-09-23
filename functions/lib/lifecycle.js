const ACTIVE_STATUSES=new Set([
  "requested",
  "searching_partner",
  "partner_assigned",
  "partner_on_the_way",
  "service_started"
]);

const BOOKING_TRANSITIONS=Object.freeze({
  requested:new Set(["searching_partner","partner_assigned","cancellation_requested"]),
  searching_partner:new Set(["partner_assigned","cancellation_requested"]),
  partner_assigned:new Set(["partner_on_the_way","searching_partner","cancellation_requested"]),
  partner_on_the_way:new Set(["service_started","cancellation_requested"]),
  service_started:new Set(["completed","cancellation_requested"]),
  cancellation_requested:new Set([]),
  completed:new Set([]),
  cancelled:new Set([])
});

function normalizeStatus(status){
  return String(status||"requested").toLowerCase().replace(/\s+/g,"_");
}

function canTransition(from,to){
  const current=normalizeStatus(from);
  const next=normalizeStatus(to);
  return BOOKING_TRANSITIONS[current]?.has(next)===true;
}

module.exports={
  ACTIVE_STATUSES,
  BOOKING_TRANSITIONS,
  normalizeStatus,
  canTransition
};
