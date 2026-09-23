import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../screens/splash_screen.dart';
import '../screens/login_screen.dart';
import '../screens/signup_screen.dart';
import 'main_shell.dart';

class NearFamilyApp extends StatefulWidget {
  const NearFamilyApp({super.key});

  @override
  State<NearFamilyApp> createState() => _NearFamilyAppState();
}

class _NearFamilyAppState extends State<NearFamilyApp> {
  final AppState state = AppState();

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        return MaterialApp(
          debugShowCheckedModeBanner: false,
          title: 'Near Family',
          theme: buildNearFamilyTheme(),
          routes: {
            '/': (_) => SplashScreen(state: state),
            '/login': (_) => LoginScreen(state: state),
            '/signup': (_) => SignupScreen(state: state),
            '/app': (_) => MainShell(state: state),
          },
        );
      },
    );
  }

  @override
  void dispose() {
    state.dispose();
    super.dispose();
  }
}
