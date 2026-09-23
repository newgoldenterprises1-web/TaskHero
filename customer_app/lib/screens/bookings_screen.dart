import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';

class BookingsScreen extends StatelessWidget {
  final AppState state;

  const BookingsScreen({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const Text(
            'My Bookings',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          const Text(
            'Track every request in one place.',
            style: TextStyle(color: NFColors.muted),
          ),
          const SizedBox(height: 18),
          if (state.bookings.isEmpty)
            const Card(
              elevation: 0,
              child: Padding(
                padding: EdgeInsets.all(28),
                child: Column(
                  children: [
                    Text('📅', style: TextStyle(fontSize: 36)),
                    SizedBox(height: 10),
                    Text(
                      'No bookings yet',
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          for (final booking in state.bookings)
            Card(
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.category,
                      style: const TextStyle(
                        color: NFColors.teal,
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                      ),
                    ),
                    Text(
                      booking.service,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text('For: ' + booking.forPerson),
                    Text('📍 ' + booking.address),
                    Text('🗓 ' + booking.date + ' • ' + booking.time),
                    const SizedBox(height: 8),
                    Chip(
                      label: Text(
                        booking.status == 'requested'
                            ? 'Request Confirmed'
                            : booking.status,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
