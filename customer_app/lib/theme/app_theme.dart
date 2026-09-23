import 'package:flutter/material.dart';

class NFColors {
  static const navy = Color(0xFF101923);
  static const teal = Color(0xFF176B5B);
  static const peach = Color(0xFFF3B394);
  static const beige = Color(0xFFF7E9DD);
  static const surface = Color(0xFFF7FCFA);
  static const border = Color(0xFFDCEFE7);
  static const muted = Color(0xFF638079);
  static const earth = Color(0xFF6D4C41);
}

ThemeData buildNearFamilyTheme() {
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: NFColors.surface,
    colorScheme: ColorScheme.fromSeed(seedColor: NFColors.teal),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: NFColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: NFColors.border),
      ),
    ),
  );
}
