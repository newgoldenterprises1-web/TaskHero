async function manageAddresses(){const value=(prompt('Enter a new saved address/locality:','')||'').trim();if(!value)return;if(state.addresses.some(x=>(typeof x==='string'?x:x.address)===value))return toast('This address is already saved');state.addresses.unshift(value);save();if(NearFamilyBackend.ready){try{const id=await NearFamilyBackend.saveAddress(value);state.addresses[0]={id,address:value};save()}catch(e){console.warn('Cloud address save failed; keeping local copy',e)}}toast('Address saved')}

async function editAddress(i){const item=state.addresses[i];const current=typeof item==='string'?item:item?.address||'';if(!current)return;const value=(prompt('Edit saved address:',current)||'').trim();if(!value)return;const id=typeof item==='string'?null:item.id;state.addresses[i]=id?{id,address:value}:value;save();if(NearFamilyBackend.ready&&id){try{await NearFamilyBackend.saveAddress(value,id);toast('Address updated')}catch(e){state.addresses[i]=item;save();toast('Could not update address');return}}else toast('Address updated');renderAll()}

async function removeAddress(i){const item=state.addresses[i];const label=typeof item==='string'?item:item?.address||'';if(!label)return;if(!confirm('Remove this saved address?'))return;const id=typeof item==='string'?null:item.id;if(NearFamilyBackend.ready&&id){try{await NearFamilyBackend.deleteAddress(id)}catch(e){toast('Could not remove address');return}}state.addresses.splice(i,1);save();renderAll();toast('Address removed')}

async function openSupport(){
  const message=(prompt('Describe your issue or booking problem:','')||'').trim();
  if(!message)return;
  if(message.length>4000)return toast('Message is too long.');
  if(window.NearFamilyBackend?.ready){
    try{
      const result=await NearFamilyBackend.createSupportTicket('Near Family Support Request',message);
      if(result?.id){toast('Support request submitted');return;}
    }catch(e){console.warn('Cloud support ticket failed',e)}
  }
  const subject=encodeURIComponent('Near Family Support Request');
  const body=encodeURIComponent('Hello Near Family Support,\\n\\n'+message+'\\n\\nCustomer: '+(state.user?.name||'')+'\\nPhone: '+(state.user?.phone||''));
  window.location.href='mailto:support@nearfamily.in?subject='+subject+'&body='+body;
}

function renderAddresses(){const el=$('addressList');if(!el)return;el.innerHTML=state.addresses.length?state.addresses.map((item,i)=>{const label=escapeHtml(typeof item==='string'?item:item.address||'');return '<div class="bg-white border border-[#dcefe7] rounded-2xl p-4 flex items-center justify-between gap-3"><div class="text-xs">📍 '+label+'</div><div class="flex gap-3 text-xs font-bold"><button onclick="editAddress('+i+')" class="text-[#176b5b]">Edit</button><button onclick="removeAddress('+i+')" class="text-red-500">Delete</button></div></div>'}).join(''):'<div class="text-xs text-slate-500 p-4 bg-white border border-[#dcefe7] rounded-2xl">No saved addresses yet.</div>}
