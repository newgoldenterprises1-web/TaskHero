(async function(){
  const files=[
    ['customer-splash-slot','customer/pages/splash.html'],
    ['customer-auth-slot','customer/pages/auth.html'],
    ['customer-app-slot','customer/pages/app-shell.html'],
    ['customer-modal-slot','customer/pages/modals.html']
  ];
  async function load(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('Failed to load '+url);return r.text();}
  const chunks=await Promise.all(files.map(async ([id,url])=>[id,await load(url)]));
  for(const [id,content] of chunks)document.getElementById(id).innerHTML=content;
  const [header,home,bookings,family,profile,nav]=await Promise.all([
    load('customer/pages/header.html'),load('customer/pages/home.html'),
    load('customer/pages/bookings.html'),load('customer/pages/family.html'),
    load('customer/pages/profile.html'),load('customer/pages/navigation.html')
  ]);
  document.getElementById('appHeader').innerHTML=header;
  document.getElementById('customerPages').innerHTML=home+bookings+family+profile;
  document.getElementById('customerNav').innerHTML=nav;
  const scripts=[
    'customer/js/catalog.js',
    'customer/js/app.js',
    'customer/js/auth.js',
    'customer/js/navigation.js',
    'customer/js/booking.js',
    'customer/js/family.js',
    'customer/js/profile.js',
    'customer/js/location.js',
    'customer/js/notifications.js'
  ];
  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=()=>reject(new Error('Failed to load '+src));
      document.body.appendChild(s);
    });
  }
  for(const src of scripts)await loadScript(src);
  if(typeof window.initNearFamily==='function')window.initNearFamily();
})().catch(e=>{console.error(e);document.body.innerHTML='<div style="padding:24px;font-family:system-ui">Near Family could not load. Please refresh.</div>';});