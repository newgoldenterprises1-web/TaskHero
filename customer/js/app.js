const CATS=window.NEAR_FAMILY_CATS||[];
const SERVICES=window.NEAR_FAMILY_SERVICES||[];
let state={user:JSON.parse(localStorage.getItem('nf_user')||'null'),families:JSON.parse(localStorage.getItem('nf_families')||'[]'),addresses:JSON.parse(localStorage.getItem('nf_addresses')||'[]'),bookings:JSON.parse(localStorage.getItem('nf_bookings')||'[]'),cat:'all',selected:null,familyBookingTarget:null,location:{label:'',lat:null,lng:null},unsubscribeBookings:null,bookingSubmitting:false};

function save(){localStorage.setItem('nf_user',JSON.stringify(state.user));localStorage.setItem('nf_families',JSON.stringify(state.families));localStorage.setItem('nf_addresses',JSON.stringify(state.addresses));localStorage.setItem('nf_bookings',JSON.stringify(state.bookings))}
function $(id){return document.getElementById(id)}

function $(id){return document.getElementById(id)}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200)}

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}

function renderAll(){renderCategories();renderServices();renderBookings();renderFamilyPage();renderAddresses();let n=state.bookings.filter(b=>!['completed','Completed','cancelled'].includes(String(b.status))).length;$('bookingBadge').classList.toggle('hide',!n);if(n)$('bookingBadge').textContent=n}

