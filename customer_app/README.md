# Near Family Customer App

This folder is the actual mobile app source.

## Run on a USB-connected Android phone

From this folder:

```powershell
flutter create .
flutter clean
flutter pub get
flutter devices
flutter run
```

Do not use the repository root `index.html` for the mobile app.

Customer mobile source is modular:

```
lib/
├── app/
├── data/
├── models/
├── screens/
├── state/
├── theme/
└── widgets/
```

The current build is a local/demo mobile flow. Firebase OTP, Firestore, Storage, push notifications and production location services will be connected in dedicated service modules after the native shell is verified.
