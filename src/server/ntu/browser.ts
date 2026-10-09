import { hash, NtuError } from './core';
import { seal, unseal, settings } from './service';
import { reply, type StudyEnv } from '../study';
export interface BrowserEnv extends StudyEnv { NTU_BROWSER_TOKEN?: string }
interface State {enabled:number;session_id:string;session_expires:number;status:string;heartbeat:number;frame_at:number;host:string;last_connected:number;user_agent:string}
const key=(sid:string)=>`private/ntu-browser/${sid}/frame.jpg`;
const row=async(e:BrowserEnv)=>(await e.DB.prepare('SELECT * FROM ntu_browser WHERE id=1').first<State>())!;
const active=(s:State)=>!!s.enabled&&s.session_expires>Date.now();
export async function authorized(e:BrowserEnv,r:Request){
  if(!e.NTU_BROWSER_TOKEN||e.NTU_BROWSER_TOKEN.length<32)return false;
  const raw=r.headers.get('authorization')??'';if(raw.length>300)return false;
  const a=await hash(raw),b=await hash(`Bearer ${e.NTU_BROWSER_TOKEN}`);let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;
}
export async function browserStatus(e:BrowserEnv){
  const s=await row(e);
  return {...s,active:active(s),online:s.heartbeat>Date.now()-120000};
}
export async function control(e:BrowserEnv,body:Record<string,any>){
  const s=await row(e);
  if(body.action==='start'){
    // A new generation invalidates stale windows, queued passwords and reports.
    const sid=crypto.randomUUID();
    await e.DB.batch([
      e.DB.prepare("UPDATE ntu_browser SET enabled=1,session_id=?,session_expires=?,frame_at=0,status='starting',host='' WHERE id=1").bind(sid,Date.now()+20*60000),
      e.DB.prepare('DELETE FROM ntu_browser_commands'),
    ]);
    if(s.session_id)await e.MEDIA.delete(key(s.session_id));
    return {sessionId:sid};
  }
  if(body.action==='end'||body.action==='pause'){
    if(body.sessionId!==s.session_id)throw new NtuError('登录窗口已变化，请刷新页面。');
    await e.DB.batch([
      e.DB.prepare("UPDATE ntu_browser SET session_expires=0,frame_at=0,enabled=?,status=CASE WHEN ?=0 THEN 'paused' ELSE status END WHERE id=1 AND session_id=?").bind(body.action==='pause'?0:s.enabled,body.action==='pause'?0:s.enabled,s.session_id),
      e.DB.prepare('DELETE FROM ntu_browser_commands WHERE session_id=?').bind(s.session_id),
    ]);
    await e.MEDIA.delete(key(s.session_id));return {ok:true};
  }
  if(body.action!=='input'||!active(s)||body.sessionId!==s.session_id)throw new NtuError('登录窗口已结束，请重新打开。');
  const c=body.command;
  if(!c||!['click','text','key','scroll','home'].includes(c.type))throw new NtuError('操作不正确。');
  let command:Record<string,unknown>;
  if(c.type==='click'){
    if(!Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.x>=1280||c.y<0||c.y>=900)throw new NtuError('点击位置不正确。');
    command={type:'click',x:c.x,y:c.y};
  }else if(c.type==='text'){
    if(typeof c.text!=='string'||!c.text.length||c.text.length>2000)throw new NtuError('输入长度不正确。');
    command={type:'text',text:c.text};
  }else if(c.type==='key'){
    if(!['Tab','Shift+Tab','Enter','Backspace','Escape','Control+A','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(c.key))throw new NtuError('按键不支持。');
    command={type:'key',key:c.key};
  }else if(c.type==='scroll'){
    if(![-600,600].includes(c.y))throw new NtuError('滚动距离不正确。');command={type:'scroll',y:c.y};
  }else command={type:'home'};
  const id=crypto.randomUUID(),payload=await seal(e,`browser:${s.session_id}:${id}`,JSON.stringify(command)),now=Date.now();
  const result=await e.DB.prepare(`INSERT INTO ntu_browser_commands(id,session_id,payload,expires,created)
    SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ntu_browser WHERE id=1 AND enabled=1 AND session_id=? AND session_expires>?)
    AND (SELECT count(*) FROM ntu_browser_commands WHERE expires>?)<8`).bind(id,s.session_id,payload,now+45000,now,s.session_id,now,now).run();
  if(!result.meta.changes)throw new NtuError('请等待前一个操作完成，或重新打开登录窗口。');return {ok:true};
}
export async function tick(e:BrowserEnv){
  const s=await row(e),now=Date.now();
  await e.DB.prepare('UPDATE ntu_browser SET heartbeat=? WHERE id=1').bind(now).run();
  await e.DB.prepare('DELETE FROM ntu_browser_commands WHERE expires<=? OR session_id!=?').bind(now,s.session_id).run();
  if(!active(s)&&s.frame_at){await e.MEDIA.delete(key(s.session_id));await e.DB.prepare('UPDATE ntu_browser SET frame_at=0 WHERE session_id=?').bind(s.session_id).run();}
  let command=null;
  if(active(s)){
    // At most once: never replay a password/Enter after a lost network response.
    const c=await e.DB.prepare('DELETE FROM ntu_browser_commands WHERE id=(SELECT id FROM ntu_browser_commands WHERE session_id=? AND expires>? ORDER BY created,id LIMIT 1) RETURNING *').bind(s.session_id,now).first<{id:string;payload:string}>();
    if(c)command=JSON.parse(await unseal(e,`browser:${s.session_id}:${c.id}`,c.payload));
  }
  const cfg=await settings(e);
  return {enabled:!!s.enabled,sessionId:s.session_id,interactive:active(s),command,revision:cfg.revision};
}
export async function report(e:BrowserEnv,b:Record<string,any>){
  const s=await row(e);if(!s.enabled||s.session_id!==b.sessionId)throw new NtuError('浏览器连接已停止或更新。');
  if(!['connected','needs_login','starting','error'].includes(b.status))throw new NtuError('状态不正确。');
  const host=typeof b.host==='string'&&/^[a-z0-9.-]{0,253}$/.test(b.host)?b.host:'';
  if(b.cookie!==undefined){
    if(typeof b.userAgent!=='string'||b.userAgent.length>512||/[\r\n]/.test(b.userAgent))throw new NtuError('浏览器信息不正确。');
    if(b.status!=='connected'||typeof b.cookie!=='string'||!b.cookie.startsWith('expires:')||b.cookie.length>8000||/[;\s]/.test(b.cookie)||!Number.isInteger(b.revision))throw new NtuError('登录凭据格式不正确。');
    await e.DB.prepare('UPDATE ntu_browser SET user_agent=? WHERE enabled=1 AND session_id=?').bind(b.userAgent,b.sessionId).run();
    const current=await settings(e,true);
    if(current.revision!==b.revision)throw new NtuError('设置已变化，稍后重试。');
    if(current.secrets.cookie!==b.cookie){
      const encrypted=await seal(e,'cookie',b.cookie);
      const changed=await e.DB.prepare(`UPDATE ntu_settings SET secrets=json_set(secrets,'$.cookie',?),revision=revision+1
        WHERE id=1 AND revision=? AND EXISTS(SELECT 1 FROM ntu_browser WHERE enabled=1 AND session_id=?)`).bind(encrypted,b.revision,b.sessionId).run();
      if(!changed.meta.changes)throw new NtuError('设置已变化，稍后重试。');
    }
  }
  await e.DB.prepare("UPDATE ntu_browser SET status=?,host=?,heartbeat=?,last_connected=CASE WHEN ?='connected' THEN ? ELSE last_connected END WHERE id=1 AND enabled=1 AND session_id=?").bind(b.status,host,Date.now(),b.status,Date.now(),b.sessionId).run();
  return {ok:true};
}
export async function putFrame(e:BrowserEnv,r:Request){
  const s=await row(e);if(!active(s)||r.headers.get('x-browser-session')!==s.session_id)throw new NtuError('登录窗口已结束。');
  if(r.headers.get('content-type')!=='image/jpeg')throw new NtuError('画面格式不正确。');
  const size=Number(r.headers.get('content-length'));if(!size||size>600000)throw new NtuError('画面过大。');
  const reader=r.body?.getReader();if(!reader)throw new NtuError('画面为空。');
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const {value,done}=await reader.read();if(done)break;total+=value.length;if(total>600000){await reader.cancel();throw new NtuError('画面过大。');}chunks.push(value);}
  const data=new Uint8Array(total);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
  if(data[0]!==255||data[1]!==216||data[2]!==255)throw new NtuError('画面格式不正确。');
  await e.MEDIA.put(key(s.session_id),data.buffer,{httpMetadata:{contentType:'image/jpeg'}});
  const result=await e.DB.prepare('UPDATE ntu_browser SET frame_at=? WHERE enabled=1 AND session_id=? AND session_expires>?').bind(Date.now(),s.session_id,Date.now()).run();
  if(!result.meta.changes)await e.MEDIA.delete(key(s.session_id));
  return {ok:true};
}
export async function getFrame(e:BrowserEnv,sid:string){
  const s=await row(e);if(!active(s)||sid!==s.session_id)return reply({error:'窗口已结束'},410);
  const object=await e.MEDIA.get(key(s.session_id));if(!object)return reply({error:'正在等待画面'},404);
  return new Response(object.body,{headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
