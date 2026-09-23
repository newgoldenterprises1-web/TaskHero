import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../screens/home_screen.dart';
import '../screens/bookings_screen.dart';
import '../screens/bulk_orders_screen.dart';
import '../screens/family_screen.dart';
import '../screens/profile_screen.dart';
import '../widgets/bottom_nav.dart';

class MainShell extends StatefulWidget {
  final AppState state;
  const MainShell({super.key, required this.state});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(state: widget.state, onOpenBulkOrders: () => setState(() => index = 2)),
      BookingsScreen(state: widget.state),
      BulkOrdersScreen(state: widget.state),
      FamilyScreen(state: widget.state),
      ProfileScreen(state: widget.state),
    ];

    return Scaffold(
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: NearFamilyBottomNav(currentIndex: index, onChanged: (value) => setState(() => index = value)),
    );
  }
}