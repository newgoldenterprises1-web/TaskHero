function requestLocation(){
  if(!navigator.geolocation)return manualLocation();
  $('locationText').textContent='Detecting...';
  navigator.geolocation.getCurrentPosition(pos=>{
    state.location.lat=pos.coords.latitude;
    state.location.lng=pos.coords.longitude;
    state.location.label='Current location';
    $('locationText').textContent='Current location detected';
    save();
  },()=>manualLocation(),{enableHighAccuracy:true,timeout:9000,maximumAge:300000});
}

function manualLocation(){
  const value=prompt('Location permission is unavailable. Enter your city/locality or full address:','');
  if(value&&value.trim()){
    state.location.label=value.trim();
    state.location.lat=null;
    state.location.lng=null;
    $('locationText').textContent=value.trim();
    save();
    toast('Location saved');
  }
}

function restoreLocationLabel(){
  const label=state.location.label.trim();
  if($('locationText'))$('locationText').textContent=label||'Detecting...';
}