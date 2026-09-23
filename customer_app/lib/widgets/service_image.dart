import 'package:flutter/material.dart';

class ServiceImage extends StatelessWidget {
  final String url;
  final double height;
  final BorderRadius borderRadius;

  const ServiceImage({
    super.key,
    required this.url,
    this.height = 120,
    this.borderRadius = const BorderRadius.all(Radius.circular(18)),
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: borderRadius,
      child: Image.network(
        url,
        height: height,
        width: double.infinity,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => Container(
          height: height,
          color: const Color(0xFFF7E9DD),
          alignment: Alignment.center,
          child: const Icon(Icons.home_repair_service_rounded, color: Color(0xFF176B5B), size: 34),
        ),
      ),
    );
  }
}
