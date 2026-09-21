# Near Family Security Fortress

This repository uses a server-authoritative security model for customer bookings and partner job lifecycle.

## Active controls

- Firestore field-level authorization for users, family members, addresses, partners, bookings and support tickets.
- Direct customer booking creation is blocked; bookings are created through the validated Cloud Function.
- Booking lifecycle changes are server-authoritative Cloud Functions.
- Partner approval, rating and active-job fields cannot be changed by the partner client.
- Customer booking photo uploads are restricted to the owning customer, booking path, images and 8 MB.
- Partner completion proof uploads are restricted to the assigned partner and image files.
- Completion proof URLs are validated by the Cloud Function to belong to the same booking.
- Callable endpoints have per-user rate limits and security audit events.
- Firebase App Check / reCAPTCHA Enterprise support is wired in.
- Cloud Functions App Check enforcement is controlled by `ENFORCE_APP_CHECK=true`; do not enable enforcement until the real Firebase Web App and reCAPTCHA Enterprise configuration is deployed.
- Security Rules are covered by Firebase Emulator tests in `security-tests/` and GitHub Actions.

## Production activation checklist

1. Replace all Firebase client placeholders in `firebase-config.js`.
2. Configure Firebase Phone Authentication and authorized domains.
3. Configure Web App Check with reCAPTCHA Enterprise.
4. Set `ENFORCE_APP_CHECK=true` for the Cloud Functions deployment.
5. Deploy Firestore rules, Storage rules and Functions.
6. Run the emulator security suite before every security-sensitive rules change.
7. Configure admin custom claims through a trusted server/admin process; never allow the client to self-assign `admin=true`.
8. Keep payment/pricing authoritative on the backend when Razorpay is introduced.

## Important

Security rules are defense in depth. Cloud Functions using the Firebase Admin SDK bypass Firestore Security Rules, so all sensitive business logic in those functions must validate authentication, ownership, role and state transitions explicitly.
