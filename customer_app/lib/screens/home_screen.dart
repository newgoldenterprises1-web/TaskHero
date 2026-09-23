import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';
import 'service_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  final AppState state;

  const HomeScreen({super.key, required this.state});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String query = '';

  @override
  Widget build(BuildContext context) {
    final list = widget.state.services.where((service) {
      final q = query.toLowerCase();
      return q.isEmpty ||
          service.name.toLowerCase().contains(q) ||
          service.category.toLowerCase().contains(q);
    }).toList();

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 18),
        children: [
          Row(
            children: [
              const Icon(
                Icons.home_rounded,
                color: NFColors.navy,
                size: 38,
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Near Family',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
                ),
              ),
              IconButton(
                onPressed: () {},
                icon: const Icon(
                  Icons.location_on_outlined,
                  color: NFColors.teal,
                ),
              ),
            ],
          ),
          Text(
            'Hi, ' + (widget.state.userName ?? 'there').split(' ').first + ' 👋',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 16),
          TextField(
            onChanged: (value) => setState(() => query = value),
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Search medicine, hospital, electrician...',
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: NFColors.teal,
              borderRadius: BorderRadius.circular(28),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '♥ HELP FOR MY FAMILY',
                  style: TextStyle(
                    color: Colors.white70,
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                  ),
                ),
                SizedBox(height: 10),
                Text(
                  'Be there for the people who matter.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  'Trusted on-ground help even when you are miles away.',
                  style: TextStyle(color: Colors.white70),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const Text(
            'Popular Services',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          for (final service in list)
            Card(
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                contentPadding: const EdgeInsets.all(12),
                leading: CircleAvatar(
                  radius: 26,
                  backgroundColor: NFColors.beige,
                  child: Text(
                    service.icon,
                    style: const TextStyle(fontSize: 22),
                  ),
                ),
                title: Text(
                  service.name,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                subtitle: Text(
                  service.category + ' • ₹' + service.price.toString(),
                ),
                trailing: const Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 15,
                ),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ServiceDetailScreen(
                      state: widget.state,
                      service: service,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
