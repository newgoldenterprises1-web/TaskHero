import 'package:flutter/material.dart';

import '../state/app_state.dart';
import '../theme/app_theme.dart';
import '../widgets/service_image.dart';
import '../widgets/trust_strip.dart';
import 'service_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  final AppState state;
  const HomeScreen({super.key, required this.state});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String query = '';

  static const _serviceImages = <int, String>{
    1: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=900&auto=format&fit=crop',
    2: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=900&auto=format&fit=crop',
    3: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=900&auto=format&fit=crop',
    4: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=900&auto=format&fit=crop',
  };

  @override
  Widget build(BuildContext context) {
    final services = widget.state.services.where((service) {
      final q = query.trim().toLowerCase();
      return q.isEmpty || service.name.toLowerCase().contains(q) || service.category.toLowerCase().contains(q);
    }).take(4).toList();

    return SafeArea(
      child: CustomScrollView(
        slivers: [
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
            sliver: SliverToBoxAdapter(
              child: Row(
                children: [
                  Container(
                    width: 46,
                    height: 46,
                    decoration: BoxDecoration(color: NFColors.navy, borderRadius: BorderRadius.circular(15)),
                    child: const Icon(Icons.home_rounded, color: NFColors.peach, size: 27),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Near Family', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
                        SizedBox(height: 2),
                        Text("When you can't be there, we're there.", style: TextStyle(color: NFColors.muted, fontSize: 10, fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () {},
                    style: IconButton.styleFrom(backgroundColor: Colors.white, side: const BorderSide(color: NFColors.border)),
                    icon: const Icon(Icons.notifications_none_rounded, color: NFColors.navy),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            sliver: SliverToBoxAdapter(
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Hi, ' + (widget.state.userName ?? 'there').split(' ').first,
                      style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: NFColors.navy),
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () {},
                    icon: const Icon(Icons.location_on_outlined, size: 17, color: NFColors.teal),
                    label: const Text('Current location', style: TextStyle(color: NFColors.teal, fontSize: 11, fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 0),
            sliver: SliverToBoxAdapter(
              child: TextField(
                onChanged: (value) => setState(() => query = value),
                decoration: InputDecoration(prefixIcon: const Icon(Icons.search_rounded), hintText: 'Search medicine, hospital, electrician...', suffixIcon: IconButton(onPressed: () {}, icon: const Icon(Icons.tune_rounded))),
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
                      subtitle: 'Trusted help when you need it.',
                      icon: Icons.auto_awesome_rounded,
                      accent: NFColors.teal,
                      action: 'View Services',
                      imageUrl: _serviceImages[1]!,
                      onTap: () {
                        if (widget.state.services.isNotEmpty) {
                          Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceDetailScreen(state: widget.state, service: widget.state.services.first)));
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _FeatureCard(
                      title: 'Community Bulk Orders',
                      subtitle: 'Combine family & community needs.',
                      icon: Icons.groups_rounded,
                      accent: NFColors.earth,
                      action: 'Get Bulk Quote',
                      imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=900&auto=format&fit=crop',
                      onTap: () {},
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
                  Expanded(child: _MiniAction(icon: Icons.request_quote_outlined, label: 'Get Bulk Quote', onTap: () {})),
                  const SizedBox(width: 10),
                  Expanded(child: _MiniAction(icon: Icons.receipt_long_outlined, label: 'View Active Orders', onTap: () {})),
                ],
              ),
            ),
          ),
          const SliverPadding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 10),
            sliver: SliverToBoxAdapter(child: TrustStrip()),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
            sliver: SliverToBoxAdapter(
              child: Row(
                children: [
                  const Expanded(child: Text('Popular Services', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900))),
                  TextButton(onPressed: () {}, child: const Text('View all', style: TextStyle(color: NFColors.teal, fontWeight: FontWeight.w800))),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
            sliver: SliverGrid(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final service = services[index];
                  final image = _serviceImages[service.id];
                  return InkWell(
                    borderRadius: BorderRadius.circular(22),
                    onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ServiceDetailScreen(state: widget.state, service: service))),
                    child: Container(
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22), border: Border.all(color: NFColors.border)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (image != null) ServiceImage(url: image, height: 106, borderRadius: const BorderRadius.vertical(top: Radius.circular(22)))
                          else Container(height: 106, decoration: const BoxDecoration(color: NFColors.beige, borderRadius: BorderRadius.vertical(top: Radius.circular(22))), child: Center(child: Text(service.icon, style: const TextStyle(fontSize: 36)))),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(service.category, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: NFColors.teal, fontSize: 9, fontWeight: FontWeight.w800)),
                                const SizedBox(height: 4),
                                Text(service.name, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13)),
                                const SizedBox(height: 6),
                                Text('₹' + service.price.toString(), style: const TextStyle(color: NFColors.navy, fontWeight: FontWeight.w900, fontSize: 15)),
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
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.78),
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

  const _FeatureCard({required this.title, required this.subtitle, required this.icon, required this.accent, required this.action, required this.imageUrl, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(24),
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: NFColors.border)),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 120,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  ServiceImage(url: imageUrl, height: 120, borderRadius: BorderRadius.zero),
                  DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [accent.withOpacity(0.10), NFColors.navy.withOpacity(0.75)]))),
                  Positioned(
                    left: 12, top: 12,
                    child: Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.white.withOpacity(0.9), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: accent, size: 19)),
                  ),
                  Positioned(left: 12, right: 10, bottom: 12, child: Text(title, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w900))),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(subtitle, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(color: NFColors.muted, fontSize: 10, height: 1.3)),
                const SizedBox(height: 10),
                Text(action, style: TextStyle(color: accent, fontSize: 11, fontWeight: FontWeight.w900)),
              ]),
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

  const _MiniAction({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 17),
      label: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis),
      style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44), foregroundColor: NFColors.teal, side: const BorderSide(color: NFColors.border), backgroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
    );
  }
}