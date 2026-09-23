import 'package:flutter/foundation.dart';

import '../data/service_catalog.dart';
import '../models/booking.dart';
import '../models/family_member.dart';
import '../models/service.dart';

class AppState extends ChangeNotifier {
  String? userName;
  String? userPhone;
  final List<FamilyMember> families = [];
  final List<Booking> bookings = [];

  List<Service> get services => serviceCatalog;
  bool get isLoggedIn => userName != null && userPhone != null;

  void login(String name, String phone) {
    userName = name;
    userPhone = phone;
    notifyListeners();
  }

  void logout() {
    userName = null;
    userPhone = null;
    notifyListeners();
  }

  void addFamily(FamilyMember value) {
    families.add(value);
    notifyListeners();
  }

  void removeFamily(int index) {
    families.removeAt(index);
    notifyListeners();
  }

  void addBooking(Booking value) {
    bookings.insert(0, value);
    notifyListeners();
  }
}
