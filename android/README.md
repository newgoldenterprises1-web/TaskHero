# Near Family Android App

This is the native Android wrapper for the existing modular Near Family Customer web frontend.

The web frontend remains separate under the repository root:

- customer/pages/
- customer/js/
- customer/css/

The Android app copies those frontend files into APK assets at build time. It uses Android WebViewAssetLoader with the secure appassets origin instead of file:// loading.

## Build and run

Open this `android/` folder in Android Studio.

With a USB-debugging-enabled Android phone connected, choose the `app` run configuration and press Run.

For command-line builds when Gradle/JDK are installed:

```text
gradle :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The debug package name is:

```text
com.nearfamily.customer.debug
```

The app launches the Customer app inside a native Android window. It is not a browser tab.

The build uses Android Gradle Plugin 9.4.0, which requires Gradle 9.6.0 and JDK 17. AndroidX WebKit 1.17.0 is used for WebViewAssetLoader.
