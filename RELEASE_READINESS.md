# Near Family Release Readiness

Status: IN DEVELOPMENT

## Architecture

- [x] Customer screens split into separate HTML files
- [x] Customer CSS separated
- [x] Customer JS separated
- [x] Customer service catalogue separated
- [x] Customer shell loader separated
- [x] Admin markup separated from admin JS/CSS
- [x] Backend lifecycle module separated
- [x] Backend service catalogue separated
- [x] Backend booking validation separated
- [x] Developer architecture lock documented

## Customer flow

- [x] Splash
- [x] Authentication foundation
- [x] Home
- [x] Service categories
- [x] Service details
- [x] Help for My Family
- [x] Saved addresses
- [x] Booking request
- [x] Booking photos
- [x] Booking history
- [x] Realtime booking updates
- [x] Booking cancellation request
- [x] Rebooking
- [x] Support request foundation
- [x] Device location with manual fallback
- [ ] Production Firebase configuration verification
- [ ] Production hosting verification

## Partner flow

- [x] Partner profile
- [x] Approval state
- [x] Online/available controls
- [x] Location update
- [x] Matching foundation
- [x] Accept/reject
- [x] On the way
- [x] Start service
- [x] Completion proof
- [x] Completion lifecycle cleanup
- [x] Cancellation resolution
- [x] Suspension handling
- [x] Automatic reassignment

## Admin flow

- [x] Operations dashboard
- [x] Partner approval
- [x] Partner suspension
- [x] Booking cancellation resolution
- [x] Completion proof verification
- [x] Lifecycle integrity audit
- [x] Security alerts foundation

## Security

- [x] Server-authoritative booking creation
- [x] Booking idempotency
- [x] Ownership validation
- [x] Partner authorization
- [x] Transactional booking lifecycle
- [x] Storage lifecycle restrictions
- [x] Rate limiting
- [x] Security audit events
- [x] App Check integration foundation
- [ ] Production App Check enforcement verification
- [ ] Production Firestore/Storage deployment verification

## Automated tests

- [x] Booking lifecycle unit tests
- [x] Booking validation tests
- [ ] Full Firebase emulator/integration test suite
- [ ] Production smoke test

## Intentionally not active

Payment integration is intentionally not connected yet. It is not to be marked as a defect until the payment phase is explicitly started.

## Current hard blocker for a true 100% production-ready claim

`firebase-config.js` still contains placeholder Firebase client configuration. Until real Firebase project configuration is provided and deployment/smoke tests succeed, the application can be code-complete but must not be called production-verified.
