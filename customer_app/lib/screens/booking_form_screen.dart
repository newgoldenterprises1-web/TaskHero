import 'package:flutter/material.dart';

import '../models/booking.dart';
import '../models/service.dart';
import '../state/app_state.dart';

class BookingFormScreen extends StatefulWidget {
  final AppState state;
  final Service service;

  const BookingFormScreen({
    super.key,
    required this.state,
    required this.service,
  });

  @override
  State<BookingFormScreen> createState() => _BookingFormScreenState();
}

class _BookingFormScreenState extends State<BookingFormScreen> {
  final name = TextEditingController();
  final phone = TextEditingController();
  final address = TextEditingController();
  String forWho = 'Me';
  DateTime date = DateTime.now();
  String time = '10:00 AM - 12:00 PM';

  @override
  void initState() {
    super.initState();
    name.text = widget.state.userName ?? '';
    phone.text = widget.state.userPhone ?? '';
  }

  Future<void> pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: date,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => date = picked);
    }
  }

  void submit() {
    if (name.text.trim().isEmpty ||
        phone.text.trim().length < 10 ||
        address.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please complete name, phone and address.'),
        ),
      );
      return;
    }

    final booking = Booking(
      id: 'NF-' + DateTime.now().millisecondsSinceEpoch.toString(),
      service: widget.service.name,
      category: widget.service.category,
      price: widget.service.price,
      forPerson: forWho,
      address: address.text.trim(),
      date: date.day.toString() +
          '/' +
          date.month.toString() +
          '/' +
          date.year.toString(),
      time: time,
    );

    widget.state.addBooking(booking);

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Request Confirmed ❤️'),
        content: Text(
          widget.service.name + ' for ' + forWho + ' has been requested.',
        ),
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Book a Service')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          Card(
            elevation: 0,
            child: ListTile(
              leading: Text(
                widget.service.icon,
                style: const TextStyle(fontSize: 28),
              ),
              title: Text(
                widget.service.name,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
              subtitle: Text('₹' + widget.service.price.toString()),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: forWho,
            decoration: const InputDecoration(labelText: 'Who needs help?'),
            items: const [
              DropdownMenuItem(value: 'Me', child: Text('Me')),
              DropdownMenuItem(value: 'My Family', child: Text('My Family')),
            ],
            onChanged: (value) {
              setState(() => forWho = value ?? 'Me');
            },
          ),
          const SizedBox(height: 12),
          TextField(
            controller: name,
            decoration: const InputDecoration(labelText: 'Full Name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Mobile Number'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: address,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Service Address'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: pickDate,
            icon: const Icon(Icons.calendar_today_outlined),
            label: Text(
              'Date: ' +
                  date.day.toString() +
                  '/' +
                  date.month.toString() +
                  '/' +
                  date.year.toString(),
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: time,
            decoration: const InputDecoration(labelText: 'Time'),
            items: const [
              DropdownMenuItem(
                value: '10:00 AM - 12:00 PM',
                child: Text('10:00 AM - 12:00 PM'),
              ),
              DropdownMenuItem(
                value: '12:00 PM - 2:00 PM',
                child: Text('12:00 PM - 2:00 PM'),
              ),
              DropdownMenuItem(
                value: '2:00 PM - 4:00 PM',
                child: Text('2:00 PM - 4:00 PM'),
              ),
              DropdownMenuItem(
                value: '4:00 PM - 6:00 PM',
                child: Text('4:00 PM - 6:00 PM'),
              ),
              DropdownMenuItem(
                value: '6:00 PM - 8:00 PM',
                child: Text('6:00 PM - 8:00 PM'),
              ),
            ],
            onChanged: (value) {
              setState(() => time = value ?? time);
            },
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: submit,
              child: const Text('Confirm Request'),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    address.dispose();
    super.dispose();
  }
}
