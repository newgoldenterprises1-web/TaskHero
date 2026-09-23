import 'dart:async';

import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';

class SplashScreen extends StatefulWidget {
  final AppState state;

  const SplashScreen({super.key, required this.state});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Timer(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      Navigator.pushReplacementNamed(
        context,
        widget.state.isLoggedIn ? '/app' : '/login',
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: NFColors.navy,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Icon(Icons.home_rounded, color: NFColors.peach, size: 86),
            SizedBox(height: 18),
            Text(
              'Near Family',
              style: TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.w900,
              ),
            ),
            SizedBox(height: 8),
            Text(
              "When you can't be there, we're there.",
              style: TextStyle(color: NFColors.beige),
            ),
          ],
        ),
      ),
    );
  }
}
