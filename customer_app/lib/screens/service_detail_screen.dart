import 'package:flutter/material.dart';

import '../models/service.dart';
import '../state/app_state.dart';
import '../theme/app_theme.dart';
import 'booking_form_screen.dart';

class ServiceDetailScreen extends StatelessWidget {
  final AppState state;
  final Service service;

  const ServiceDetailScreen({
    super.key,
    required this.state,
    required this.service,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Service')),
      body: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 38,
              backgroundColor: NFColors.beige,
              child: Text(
                service.icon,
                style: const TextStyle(fontSize: 34),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              service.category,
              style: const TextStyle(
                color: NFColors.teal,
                fontWeight: FontWeight.w800,
              ),
            ),
            Text(
              service.name,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              service.description,
              style: const TextStyle(color: NFColors.muted, height: 1.4),
            ),
            const SizedBox(height: 18),
            const Text(
              "What's included",
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 10),
            const Text(
              '✓ Verified partner assignment\n'
              '✓ Service coordination\n'
              '✓ Status updates\n'
              '✓ Support if something changes',
            ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '₹' + service.price.toString(),
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                FilledButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => BookingFormScreen(
                        state: state,
                        service: service,
                      ),
                    ),
                  ),
                  child: const Text('Book Now'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
