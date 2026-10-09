const csrf=document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content??'';
const feedback=document.querySelector<HTMLElement>('#feedback')!;
let busy=false;
async function send(body:Record<string,unknown>){
  if(busy)return;busy=true;
  document.querySelectorAll<HTMLButtonElement>('.study-shell button').forEach(b=>b.disabled=true);
  feedback.hidden=false;feedback.textContent='Saving…';
  try{
    const r=await fetch('/api/admin/study',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
    const data=await r.json();if(!r.ok)throw new Error(data.error??'Could not save');
    location.reload();
  }catch(e){feedback.textContent=e instanceof Error?e.message:'Connection failed. Please try again.';}
  finally{busy=false;document.querySelectorAll<HTMLButtonElement>('.study-shell button').forEach(b=>b.disabled=false);}
}
const form=document.querySelector<HTMLFormElement>('#study-settings');
form?.addEventListener('submit',e=>{e.preventDefault();const d=new FormData(form);void send({action:'save-sync',revision:Number(form.dataset.revision),enabled:d.has('enabled'),intervalMinutes:Number(d.get('intervalMinutes'))});});
document.querySelectorAll<HTMLButtonElement>('[data-analyze]').forEach(b=>b.addEventListener('click',()=>void send({action:'analyze',versionId:b.dataset.analyze})));
