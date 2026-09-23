import 'package:flutter/material.dart';

import '../state/app_state.dart';

class LoginScreen extends StatefulWidget {
  final AppState state;

  const LoginScreen({super.key, required this.state});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final phone = TextEditingController();
  final otp = TextEditingController();
  bool otpSent = false;

  void submit() {
    if (phone.text.trim().length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid mobile number.')),
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

    widget.state.login('Near Family Customer', phone.text.trim());
    Navigator.pushReplacementNamed(context, '/app');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(22),
            child: Column(
              children: [
                const Icon(
                  Icons.home_rounded,
                  size: 66,
                  color: Color(0xFF176B5B),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Welcome back 👋',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 22),
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
                    child: Text(otpSent ? 'Verify OTP' : 'Continue'),
                  ),
                ),
                TextButton(
                  onPressed: () =>
                      Navigator.pushReplacementNamed(context, '/signup'),
                  child: const Text('Create account'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    phone.dispose();
    otp.dispose();
    super.dispose();
  }
}
