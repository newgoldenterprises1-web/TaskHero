import 'package:flutter/material.dart';

import '../state/app_state.dart';

class ProfileScreen extends StatelessWidget {
  final AppState state;

  const ProfileScreen({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const Text(
            'Profile',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 18),
          Card(
            elevation: 0,
            child: ListTile(
              contentPadding: const EdgeInsets.all(16),
              leading: const CircleAvatar(
                radius: 28,
                child: Icon(Icons.person),
              ),
              title: Text(
                state.userName ?? 'Customer',
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              subtitle: Text(state.userPhone ?? ''),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            elevation: 0,
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.location_on_outlined),
                  title: const Text('Saved Addresses'),
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Address module will connect here.'),
                    ),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.support_agent_outlined),
                  title: const Text('Help & Support'),
                  onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Support module will connect here.'),
                    ),
                  ),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(
                    Icons.logout,
                    color: Colors.redAccent,
                  ),
                  title: const Text(
                    'Logout',
                    style: TextStyle(color: Colors.redAccent),
                  ),
                  onTap: () {
                    state.logout();
                    Navigator.pushNamedAndRemoveUntil(
                      context,
                      '/login',
                      (_) => false,
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
