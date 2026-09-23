function go(page){
  ['home','bookings','family','profile'].forEach(x=>{
    const p=$(x+'Page');
    if(p)p.classList.toggle('hide',x!==page);
  });
  document.querySelectorAll('.nav').forEach(n=>n.classList.remove('text-[#176b5b]','font-bold','text-slate-400'));
  const activeIndex={home:0,bookings:2,family:3,profile:4}[page];
  const active=document.querySelectorAll('.nav')[activeIndex];
  if(active)active.classList.add('text-[#176b5b]','font-bold');
  document.querySelectorAll('.nav').forEach((n,i)=>{if(i!==activeIndex)n.classList.add('text-slate-400')});
  renderAll();
  window.scrollTo(0,0);
}

function focusSearch(){
  go('home');
  setTimeout(()=>$('search').focus(),100);
}