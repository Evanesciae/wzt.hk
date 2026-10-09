export {};
const endpoint='/api/admin/ntu/browser';
const csrf=document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content??'';
const status=document.querySelector<HTMLElement>('#browser-status')!;
const host=document.querySelector<HTMLElement>('#browser-host')!;
const view=document.querySelector<HTMLElement>('#browser-view')!;
const frame=document.querySelector<HTMLImageElement>('#browser-frame')!;
const feedback=document.querySelector<HTMLElement>('#browser-feedback')!;
const text=document.querySelector<HTMLInputElement>('#browser-text')!;
const end=document.querySelector<HTMLButtonElement>('#browser-end')!;
let sid='',busy=false,frameAt=0,objectURL='',active=false;
async function post(body:Record<string,unknown>){
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
  const data=await r.json();if(!r.ok)throw new Error(data.error??'操作失败');return data;
}
async function act(action:string,command?:Record<string,unknown>){
  if(busy)return;busy=true;
  document.querySelectorAll<HTMLButtonElement>('.study-shell button').forEach(b=>b.disabled=true);
  try{await post({action,sessionId:sid,command});feedback.textContent=action==='input'?'操作已发送，等待画面更新。':'设置已更新。';}
  catch(e){feedback.textContent=e instanceof Error?e.message:'连接失败，请重试。';}
  finally{busy=false;document.querySelectorAll<HTMLButtonElement>('.study-shell button').forEach(b=>b.disabled=false);await refresh();}
}
async function refresh(){
  try{
    const r=await fetch(endpoint,{cache:'no-store'});if(!r.ok)throw new Error('请重新登录网站后台后重试。');const s=await r.json();
    if(sid!==s.session_id){frameAt=0;frame.hidden=true;}sid=s.session_id;active=s.active;
    const labels:Record<string,string>={paused:'自动维护已暂停',starting:'正在准备学校登录页面',connected:'已连接，登录状态已保存',needs_login:'需要在下方完成学校登录',error:'浏览器暂时遇到问题，可稍后重试或返回学校首页'};
    status.textContent=!s.online?'服务器浏览器暂未连接，请稍候。':labels[s.status]??'等待浏览器';
    host.textContent=s.host?`当前页面域名：${s.host}`:'';view.hidden=!active;end.disabled=busy||!active;
    if(!active){frame.hidden=true;frame.removeAttribute('src');frameAt=0;return;}
    if(s.frame_at&&s.frame_at!==frameAt){
      const response=await fetch(`${endpoint}?frame=${encodeURIComponent(sid)}&v=${s.frame_at}`,{cache:'no-store'});
      if(response.ok){const blob=await response.blob();const old=objectURL;objectURL=URL.createObjectURL(blob);frame.src=objectURL;frame.hidden=false;frameAt=s.frame_at;if(old)URL.revokeObjectURL(old);}
    }
  }catch(e){status.textContent=e instanceof Error?e.message:'网络连接失败。';}
}
document.querySelector('#browser-start')!.addEventListener('click',()=>void act('start'));
end.addEventListener('click',()=>void act('end'));
document.querySelector('#browser-pause')!.addEventListener('click',()=>void act('pause'));
frame.addEventListener('click',e=>{const r=frame.getBoundingClientRect();void act('input',{type:'click',x:Math.min(1279,Math.floor((e.clientX-r.left)*1280/r.width)),y:Math.min(899,Math.floor((e.clientY-r.top)*900/r.height))});});
document.querySelector('#browser-input')!.addEventListener('submit',e=>{e.preventDefault();if(busy||!text.value)return;const value=text.value;text.value='';void act('input',{type:'text',text:value});});
document.querySelector<HTMLInputElement>('#browser-reveal')!.addEventListener('change',e=>{text.type=(e.target as HTMLInputElement).checked?'text':'password';});
document.querySelectorAll<HTMLButtonElement>('[data-browser-key]').forEach(b=>b.addEventListener('click',()=>void act('input',{type:'key',key:b.dataset.browserKey})));
document.querySelectorAll<HTMLButtonElement>('[data-browser-scroll]').forEach(b=>b.addEventListener('click',()=>void act('input',{type:'scroll',y:Number(b.dataset.browserScroll)})));
document.querySelector('#browser-home')!.addEventListener('click',()=>void act('input',{type:'home'}));
async function poll(){if(!busy&&!document.hidden)await refresh();window.setTimeout(poll,active?2000:10000);}void poll();
