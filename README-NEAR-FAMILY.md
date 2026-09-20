# Near Family Development

Brand: **Near Family**
Tagline: **When you can't be there, we're there.**

## Current architecture
- Customer: existing index.html, UI preserved
- Partner: partner.html foundation
- Admin: admin.html Near Family control center
- Backend: Firebase Auth, Firestore, Storage, FCM planned
- Payments: intentionally not enabled yet

## Backend collections
users, familyMembers, addresses, bookings, partners, services, supportTickets

## Booking lifecycle
requested -> matching -> assigned -> accepted -> on_the_way -> arrived -> in_progress -> completed
Cancellation/refund states will be added with payment integration.

## Required configuration
Add Firebase Web App config to firebase-config.js. Do not commit service-account credentials.

## Security
Firestore and Storage rules are included and should be tested with the Firebase Emulator before production.

## Next implementation
1. Connect Firebase Auth
2. Connect customer signup/login
3. Persist family members, addresses and bookings
4. Build partner authentication/KYC
5. Implement partner matching/dispatch
6. Add FCM notifications and live booking status
7. Add Maps/location
8. Add Razorpay
9. Production hardening and Play Store release
