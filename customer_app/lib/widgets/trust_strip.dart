import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class TrustStrip extends StatelessWidget {
  const TrustStrip({super.key});

  @override
  Widget build(BuildContext context) {
    final items = const [
      (Icons.verified_rounded, 'Verified'),
      (Icons.favorite_rounded, 'Family First'),
      (Icons.support_agent_rounded, '24/7 Support'),
    ];

    return Row(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: NFColors.border),
              ),
              child: Column(
                children: [
                  Icon(items[i].$1, size: 20, color: NFColors.teal),
                  const SizedBox(height: 6),
                  Text(
                    items[i].$2,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800),
                  ),
                ],
              ),
            ),
          ),
          if (i != items.length - 1) const SizedBox(width: 8),
        ],
      ],
    );
  }
}
