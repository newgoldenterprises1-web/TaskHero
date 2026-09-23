(function(){
  const CATS=[
    ['Family Assistance','♥'],
    ['Home Services','⌂'],
    ['Health & Hospital','✚'],
    ['Pickups & Errands','▣'],
    ['Repairs & Maintenance','⚒'],
    ['Events & Special Help','★']
  ];

  const SERVICES=[
    {id:1,n:'Parent Daily Assistance',c:'Family Assistance',p:299,d:'Trusted on-ground help for parents and family members.',i:'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop'},
    {id:2,n:'Hospital Companion',c:'Health & Hospital',p:499,d:'Assistance with hospital visits, appointments and coordination.',i:'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?q=80&w=800&auto=format&fit=crop'},
    {id:3,n:'Medicine Pickup & Delivery',c:'Pickups & Errands',p:149,d:'Pickup medicines and deliver them to your family member.',i:'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=800&auto=format&fit=crop'},
    {id:4,n:'Grocery & Essentials Pickup',c:'Pickups & Errands',p:149,d:'Everyday grocery, household essentials and small shopping errands.',i:'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop'},
    {id:5,n:'Electrician Visit',c:'Home Services',p:199,d:'Switches, sockets, lights, fans and minor electrical work.',i:'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=800&auto=format&fit=crop'},
    {id:6,n:'Plumbing Assistance',c:'Home Services',p:199,d:'Leaks, taps, pipes, drainage and minor plumbing repairs.',i:'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=800&auto=format&fit=crop'},
    {id:7,n:'Laptop & Mobile Repair',c:'Repairs & Maintenance',p:249,d:'Pickup or on-site assistance for common device problems.',i:'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=800&auto=format&fit=crop'},
    {id:8,n:'Appliance Repair',c:'Repairs & Maintenance',p:299,d:'AC, refrigerator, washing machine and other appliance assistance.',i:'https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=800&auto=format&fit=crop'},
    {id:9,n:'Document Pickup & Submission',c:'Pickups & Errands',p:199,d:'Pickup, submission and delivery of documents and parcels.',i:'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=800&auto=format&fit=crop'},
    {id:10,n:'Family Function Assistance',c:'Events & Special Help',p:499,d:'Last-mile help for family functions, materials and coordination.',i:'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop'},
    {id:11,n:'Doctor Appointment Assistance',c:'Health & Hospital',p:299,d:'Appointment coordination and on-ground assistance.',i:'https://images.unsplash.com/photo-1638202993928-7d1138aeefba?q=80&w=800&auto=format&fit=crop'},
    {id:12,n:'Home Check & Small Tasks',c:'Family Assistance',p:249,d:'Routine home checks and small help when you cannot be there.',i:'https://images.unsplash.com/photo-1560185008-b033106af5c3?q=80&w=800&auto=format&fit=crop'}
  ];

  window.NEAR_FAMILY_CATS=Object.freeze(CATS);
  window.NEAR_FAMILY_SERVICES=Object.freeze(SERVICES);
})();
