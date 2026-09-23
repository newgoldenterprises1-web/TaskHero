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


# Phone testing

## Project type

The current Near Family frontend is a modular HTML/CSS/JavaScript web application.

It does not use Flutter, so do not run `flutter clean` or `flutter pub get`. There is no `pubspec.yaml` in this repository.

## Clean pull on Windows

```powershell
cd TaskHero
git checkout main
git fetch origin main
git reset --hard origin/main
git clean -fd
```

## Run on Android/iPhone over Wi-Fi

Keep the PC and phone on the same Wi-Fi network.

```powershell
py -m http.server 8080 --bind 0.0.0.0
```

Find the PC LAN address:

```powershell
ipconfig
```

Use the active adapter's IPv4 address, for example `192.168.1.25`, then open this on the phone:

```text
http://192.168.1.25:8080/
```

Use the actual IPv4 address from your PC.

## Firewall

If the phone cannot connect, allow Python through Windows Defender Firewall on the Private network. Make sure the phone and PC are on the same non-isolated Wi-Fi.

## Clean browser test

Use a private/incognito tab on the phone or clear site data for the local address before testing.

## Customer smoke check

From the repository root:

```powershell
node customer/test/smoke.js
```

This checks Customer JavaScript syntax and inline HTML handlers.

## Important

Firebase configuration is still environment-dependent. Local fallback mode can run, but real OTP, Firestore, Storage and push notifications require the project's actual Firebase configuration and deployment.


## Android phone app

The Customer app can be run as a native Android app through the `android/` wrapper. Open `android/` in Android Studio, connect the USB-debugging phone, and run the `app` configuration.

The wrapper packages the modular Customer frontend into the APK at build time and loads it through Android's secure WebViewAssetLoader origin. Android's documentation recommends WebViewAssetLoader for local web content instead of `file://` access. cite-placeholder
