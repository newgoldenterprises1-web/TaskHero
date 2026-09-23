import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/service_image.dart';
import '../widgets/trust_strip.dart';
import 'service_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  final AppState state;
  final VoidCallback onOpenBulkOrders;

  const HomeScreen({
    super.key,
    required this.state,
    required this.onOpenBulkOrders,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String query = '';

  static const _popularHeroImage = 'https://images.unsplash.com/photo-1773227060446-93239a553f1f?auto=format&fit=crop&w=1200&q=85';
  static const _bulkHeroImage = 'https://images.unsplash.com/photo-1776905177849-9e1a4ae415b8?auto=format&fit=crop&w=1200&q=85';

  static const _serviceImages = <int, String>{
    1: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=900&auto=format&fit=crop',
    2: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=900&auto=format&fit=crop',
    3: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=900&auto=format&fit=crop',
    4: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=900&auto=format&fit=crop',
    5: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?q=80&w=900&auto=format&fit=crop',
    6: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?q=80&w=900&auto=format&fit=crop',
  };

  @override
  Widget build(BuildContext context) {
    final services = widget.state.services.where((service) {
      final q = query.trim().toLowerCase();
      return q.isEmpty ||
          service.name.toLowerCase().contains(q) ||
          service.category.toLowerCase().contains(q);
    }).take(6).toList();

    return SafeArea(
      child: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            sliver: SliverToBoxAdapter(
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: NFColors.navy,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.home_rounded,
                      color: NFColors.peach,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Near Family',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: NFColors.navy,
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          "When you can't be there, we're there.",
                          style: TextStyle(
                            color: NFColors.muted,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      border: Border.all(color: NFColors.border),
                    ),
                    child: IconButton(
                      onPressed: () {},
                      icon: const Icon(
                        Icons.notifications_none_rounded,
                        color: NFColors.navy,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    decoration: const BoxDecoration(
                      color: NFColors.navy,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      onPressed: () {},
                      icon: const Icon(
                        Icons.person_outline_rounded,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
            sliver: SliverToBoxAdapter(
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Hi, ${(widget.state.userName ?? 'there').split(' ').first}',
                      style: const TextStyle(
                        fontSize: 25,
                        fontWeight: FontWeight.w900,
                        color: NFColors.navy,
                      ),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () {},
                    icon: const Icon(
                      Icons.location_on_outlined,
                      size: 17,
                      color: NFColors.teal,
                    ),
                    label: const Text(
                      'Current location',
                      style: TextStyle(
                        color: NFColors.teal,
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            sliver: SliverToBoxAdapter(
              child: TextField(
                onChanged: (value) => setState(() => query = value),
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search_rounded),
                  hintText: 'Search for services, help or anything...',
                  suffixIcon: IconButton(
                    onPressed: () {},
                    icon: const Icon(Icons.tune_rounded),
                  ),
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
            sliver: SliverToBoxAdapter(
              child: Row(
                children: [
                  Expanded(
                    child: _FeatureCard(
                      title: 'Popular Services',
                      subtitle: 'Trusted help for you and your family.',
                      icon: Icons.favorite_rounded,
                      accent: NFColors.peach,
                      action: 'View All Services',
                      imageUrl: _popularHeroImage,
                      onTap: () {
                        if (widget.state.services.isNotEmpty) {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ServiceDetailScreen(
                                state: widget.state,
                                service: widget.state.services.first,
                              ),
                            ),
                          );
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _FeatureCard(
                      title: 'Community Bulk Orders',
                      subtitle: 'Save more together with your neighbours.',
                      icon: Icons.groups_rounded,
                      accent: NFColors.earth,
                      action: 'Get Bulk Quote',
                      imageUrl: _bulkHeroImage,
                      onTap: widget.onOpenBulkOrders,
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
            sliver: SliverToBoxAdapter(
              child: Row(
                children: [
                  Expanded(
                    child: _MiniAction(
                      icon: Icons.request_quote_outlined,
                      label: 'Get Bulk Quote',
                      onTap: widget.onOpenBulkOrders,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MiniAction(
                      icon: Icons.receipt_long_outlined,
                      label: 'View Active Orders',
                      onTap: widget.onOpenBulkOrders,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SliverPadding(
            padding: EdgeInsets.fromLTRB(16, 12, 16, 8),
            sliver: SliverToBoxAdapter(child: TrustStrip()),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
            sliver: SliverToBoxAdapter(
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Popular Services',
                      style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w900,
                        color: NFColors.navy,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () => setState(() => query = ''),
                    child: const Text(
                      'View all',
                      style: TextStyle(
                        color: NFColors.teal,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
            sliver: SliverGrid(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final service = services[index];
                  final image = _serviceImages[service.id];

                  return InkWell(
                    borderRadius: BorderRadius.circular(22),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ServiceDetailScreen(
                          state: widget.state,
                          service: service,
                        ),
                      ),
                    ),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: NFColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (image != null)
                            ServiceImage(
                              url: image,
                              height: 108,
                              borderRadius: const BorderRadius.vertical(
                                top: Radius.circular(22),
                              ),
                            )
                          else
                            Container(
                              height: 108,
                              decoration: const BoxDecoration(
                                color: NFColors.beige,
                                borderRadius: BorderRadius.vertical(
                                  top: Radius.circular(22),
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  service.icon,
                                  style: const TextStyle(fontSize: 36),
                                ),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  service.category,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    color: NFColors.teal,
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  service.name,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 13,
                                    color: NFColors.navy,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'From ₹${service.price}',
                                  style: const TextStyle(
                                    color: NFColors.navy,
                                    fontWeight: FontWeight.w900,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
                childCount: services.length,
              ),
              gridDelegate:
                  const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 0.78,
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 30),
            sliver: SliverToBoxAdapter(
              child: Container(
                height: 150,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: NFColors.border),
                ),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    const DecoratedBox(
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                          colors: [
                            NFColors.beige,
                            Colors.white,
                          ],
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(18, 18, 150, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Stronger Neighbourhoods',
                            style: TextStyle(
                              fontSize: 18,
                              height: 1.0,
                              fontWeight: FontWeight.w900,
                              color: NFColors.navy,
                            ),
                          ),
                          const SizedBox(height: 5),
                          const Text(
                            'Happier Families',
                            style: TextStyle(
                              fontSize: 18,
                              height: 1.0,
                              fontWeight: FontWeight.w900,
                              color: NFColors.earth,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Join your community and save together.',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: NFColors.muted,
                              fontSize: 10,
                              height: 1.3,
                            ),
                          ),
                          const Spacer(),
                          SizedBox(
                            height: 34,
                            child: FilledButton.icon(
                              onPressed: widget.onOpenBulkOrders,
                              icon: const Icon(Icons.groups_rounded, size: 15),
                              label: const Text(
                                'Join your community',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              style: FilledButton.styleFrom(
                                backgroundColor: NFColors.navy,
                                foregroundColor: Colors.white,
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 12),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      right: -10,
                      bottom: -4,
                      child: Container(
                        width: 145,
                        height: 125,
                        decoration: BoxDecoration(
                          color: NFColors.peach.withOpacity(0.65),
                          borderRadius: BorderRadius.circular(70),
                        ),
                        child: const Icon(
                          Icons.groups_rounded,
                          size: 64,
                          color: NFColors.navy,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FeatureCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color accent;
  final String action;
  final String imageUrl;
  final VoidCallback onTap;

  const _FeatureCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accent,
    required this.action,
    required this.imageUrl,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        height: 292,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: NFColors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ServiceImage(
              url: imageUrl,
              height: 292,
              borderRadius: BorderRadius.zero,
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.04),
                    NFColors.navy.withOpacity(0.78),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 14,
              right: 14,
              top: 14,
              child: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.92),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, color: accent, size: 18),
              ),
            ),
            Positioned(
              left: 14,
              right: 14,
              bottom: 15,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      height: 1.05,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.9),
                      fontSize: 10,
                      height: 1.25,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    decoration: BoxDecoration(
                      color: NFColors.peach,
                      borderRadius: BorderRadius.circular(13),
                    ),
                    child: Text(
                      action,
                      style: const TextStyle(
                        color: NFColors.navy,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MiniAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _MiniAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 17),
      label: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 44),
        foregroundColor: NFColors.teal,
        side: const BorderSide(color: NFColors.border),
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    );
  }
}
