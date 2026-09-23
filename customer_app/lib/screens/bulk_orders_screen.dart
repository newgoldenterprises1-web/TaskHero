import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';

class BulkOrdersScreen extends StatelessWidget {
  final AppState state;

  const BulkOrdersScreen({super.key, required this.state});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
        children: [
          const Text(
            'Community Bulk Orders',
            style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 6),
          const Text(
            'Coordinate essentials and family needs together.',
            style: TextStyle(color: NFColors.muted),
          ),
          const SizedBox(height: 18),
          ClipRRect(
            borderRadius: BorderRadius.circular(28),
            child: Image.network(
              'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop',
              height: 190,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                height: 190,
                color: NFColors.beige,
                alignment: Alignment.center,
                child: const Icon(Icons.groups_rounded, size: 58, color: NFColors.teal),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _ActionCard(
                  icon: Icons.request_quote_outlined,
                  title: 'Get Bulk Quote',
                  onTap: () => _showMessage(context, 'Bulk quote request started.'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ActionCard(
                  icon: Icons.receipt_long_outlined,
                  title: 'Active Orders',
                  onTap: () => _showMessage(context, 'No active bulk orders yet.'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          const Text(
            'How it works',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 10),
          const _StepTile(number: '1', title: 'Tell us what your community needs'),
          const _StepTile(number: '2', title: 'Receive one coordinated quote'),
          const _StepTile(number: '3', title: 'Track delivery and assistance'),
        ],
      ),
    );
  }

  void _showMessage(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: NFColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 2),
            Icon(icon, color: NFColors.teal, size: 28),
            const SizedBox(height: 14),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          ],
        ),
      ),
    );
  }
}

class _StepTile extends StatelessWidget {
  final String number;
  final String title;

  const _StepTile({required this.number, required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          CircleAvatar(
            radius: 16,
            backgroundColor: NFColors.beige,
            child: Text(number, style: const TextStyle(color: NFColors.earth, fontWeight: FontWeight.w900)),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700))),
        ],
      ),
    );
  }
}
