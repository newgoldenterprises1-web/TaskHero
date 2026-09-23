# Near Family App Architecture

The actual Customer mobile application is under `customer_app/`.

It is a Flutter application, not a browser website and not an Android WebView wrapper.

Rules:
- Run Customer mobile code from `customer_app/`.
- Keep screens in separate Dart files.
- Keep models, state, theme and widgets separate.
- Do not move the complete app into `main.dart`.
- Do not replace the mobile app with an HTML/WebView wrapper.
- The older root `customer/` web frontend is not the native mobile application.
- Backend services can be shared conceptually, but mobile UI/state remains in the Flutter app.
