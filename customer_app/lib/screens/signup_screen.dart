import 'package:flutter/material.dart';

import '../state/app_state.dart';

class SignupScreen extends StatefulWidget {
  final AppState state;

  const SignupScreen({super.key, required this.state});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final name = TextEditingController();
  final phone = TextEditingController();
  final otp = TextEditingController();
  bool otpSent = false;

  void submit() {
    if (name.text.trim().isEmpty || phone.text.trim().length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter your name and mobile number.')),
      );
      return;
    }

    if (!otpSent) {
      setState(() => otpSent = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Demo OTP: 123456')),
      );
      return;
    }

    if (otp.text.trim() != '123456') {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Use OTP 123456 for local testing.')),
      );
      return;
    }

    widget.state.login(name.text.trim(), phone.text.trim());
    Navigator.pushReplacementNamed(context, '/app');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create your account')),
      body: ListView(
        padding: const EdgeInsets.all(22),
        children: [
          TextField(
            controller: name,
            decoration: const InputDecoration(labelText: 'Full Name'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: phone,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Mobile Number (+91)',
            ),
          ),
          if (otpSent) ...[
            const SizedBox(height: 12),
            TextField(
              controller: otp,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Enter OTP'),
            ),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: submit,
              child: Text(otpSent ? 'Verify OTP' : 'Get Started'),
            ),
          ),
          TextButton(
            onPressed: () =>
                Navigator.pushReplacementNamed(context, '/login'),
            child: const Text('Already have an account? Login'),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    otp.dispose();
    super.dispose();
  }
}
