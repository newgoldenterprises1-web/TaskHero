class Booking {
  final String id;
  final String service;
  final String category;
  final int price;
  final String forPerson;
  final String address;
  final String date;
  final String time;
  String status;

  Booking({
    required this.id,
    required this.service,
    required this.category,
    required this.price,
    required this.forPerson,
    required this.address,
    required this.date,
    required this.time,
    this.status = 'requested',
  });
}
