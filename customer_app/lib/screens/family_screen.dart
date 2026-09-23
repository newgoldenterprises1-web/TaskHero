import 'package:flutter/material.dart';

import '../models/family_member.dart';
import '../state/app_state.dart';

class FamilyScreen extends StatelessWidget {
  final AppState state;

  const FamilyScreen({super.key, required this.state});

  Future<void> addMember(BuildContext context) async {
    final name = TextEditingController();
    final relationship = TextEditingController();

    final result = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Add Family Member'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: relationship,
              decoration: const InputDecoration(
                labelText: 'Relationship',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Save'),
          ),
        ],
      ),
    );

    if (result == true &&
        name.text.trim().isNotEmpty &&
        relationship.text.trim().isNotEmpty) {
      state.addFamily(
        FamilyMember(
          name: name.text.trim(),
          relationship: relationship.text.trim(),
        ),
      );
    }

    name.dispose();
    relationship.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'My Family ❤️',
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              FilledButton.tonal(
                onPressed: () => addMember(context),
                child: const Text('+ Add'),
              ),
            ],
          ),
          const SizedBox(height: 18),
          if (state.families.isEmpty)
            const Card(
              elevation: 0,
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text('Add Mom, Dad or another family member.'),
              ),
            ),
          for (var i = 0; i < state.families.length; i++)
            Card(
              elevation: 0,
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: const CircleAvatar(child: Text('❤️')),
                title: Text(
                  state.families[i].name,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                subtitle: Text(state.families[i].relationship),
                trailing: IconButton(
                  onPressed: () => state.removeFamily(i),
                  icon: const Icon(
                    Icons.delete_outline,
                    color: Colors.redAccent,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
