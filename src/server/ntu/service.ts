import { defaults, hash, important, iso, NtuError, plain, reminderDue, safeError, singapore, validateConfig, type Config } from './core';
import { bb, pages, calendarItems, sendTelegram, sourceURL, summarize, telegram } from './integrations';
export interface NtuEnv { DB: D1Database; NTU_ENCRYPTION_KEY?: string }
type Secrets = {cookie?:string;telegramToken?:string;glmKey?:string};
type Stored = {config:string;secrets:string;revision:number};
interface Course {id:string;name:string;code:string;baseline:number;updated_at:string}
export interface Item { id:string;course_id:string;kind:string;title:string;body:string;source_url:string;source_date:string|null;due_at:string|null;fingerprint:string;summary:string|null;important:number;ai_status:string;read_at:string|null;updated_at:string }
const nowISO = () => new Date().toISOString();
async function key(env:NtuEnv) {
  if (!env.NTU_ENCRYPTION_KEY) throw new NtuError('服务器尚未配置凭据加密密钥。');
  return crypto.subtle.importKey('raw',Uint8Array.from(atob(env.NTU_ENCRYPTION_KEY),c=>c.charCodeAt(0)), 'AES-GCM', false,['encrypt','decrypt']);
}
export async function seal(env:NtuEnv,name:string,text:string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(name)},await key(env),new TextEncoder().encode(text)));
  return btoa(String.fromCharCode(...iv,...bytes));
}
async function unseal(env:NtuEnv,name:string,text:string) {
  const bytes = Uint8Array.from(atob(text),c=>c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12),additionalData:new TextEncoder().encode(name)},await key(env),bytes.slice(12)));
}
async function stored(env:NtuEnv) { return env.DB.prepare('SELECT * FROM ntu_settings WHERE id=1').first<Stored>(); }
export async function settings(env:NtuEnv, decrypt = false) {
  const row = await stored(env); const encrypted = JSON.parse(row?.secrets ?? '{}') as Secrets;
  const secrets:Secrets = {};
  if (decrypt) for (const n of Object.keys(encrypted) as (keyof Secrets)[]) if(encrypted[n]) secrets[n] = await unseal(env,n,encrypted[n]!);
  return {config:{...defaults,...JSON.parse(row?.config ?? '{}')} as Config,secrets,configured:{cookie:!!encrypted.cookie,telegramToken:!!encrypted.telegramToken,glmKey:!!encrypted.glmKey},revision:row?.revision ?? 0};
}
export async function saveSettings(env:NtuEnv,input:{config:unknown;secrets?:Secrets;clear?:string[];revision:number}) {
  const config = validateConfig(input.config); const old = await stored(env);
  if (input.revision !== (old?.revision ?? 0)) throw new NtuError('设置已在另一个窗口更新，请刷新后重试。');
  const encrypted = JSON.parse(old?.secrets ?? '{}') as Secrets;
  for (const name of ['cookie','telegramToken','glmKey'] as const) {
    if (input.clear?.includes(name)) delete encrypted[name];
    const value = input.secrets?.[name];
    if (value !== undefined && typeof value !== 'string') throw new NtuError('凭据格式不正确。');
    if (value?.trim()) {
      let text = value.trim(); if (name === 'cookie') text = text.replace(/^BbRouter=/,'');
      if (text.length > 8000 || /[\r\n]/.test(text) || (name==='cookie' && /[;\s]/.test(text))) throw new NtuError('请只填写 Cookie 的值，不要粘贴整段请求头。');
      if (name === 'telegramToken' && !/^\d+:[A-Za-z0-9_-]{20,}$/.test(text)) throw new NtuError('Telegram Token 格式不正确。');
      encrypted[name] = await seal(env,name,text);
    }
  }
  if (config.enabled && (!encrypted.cookie || !config.courseIds.length)) throw new NtuError('请先填写 Cookie、读取课程并选择至少一门课程。');
  if (config.telegramEnabled && (!encrypted.telegramToken || !config.chatId)) throw new NtuError('启用推送前请填写 Telegram Token 和 Chat ID。');
  if (config.aiEnabled && !encrypted.glmKey) throw new NtuError('启用摘要前请填写智谱通用 API Key。');
  const courses = (await env.DB.prepare('SELECT id FROM ntu_courses').all<{id:string}>()).results ?? [];
  if (config.courseIds.some(id => !courses.some(c => c.id===id))) throw new NtuError('课程列表已变化，请重新读取课程。');
  if (old) {
    const result = await env.DB.prepare('UPDATE ntu_settings SET config=?,secrets=?,revision=revision+1 WHERE id=1 AND revision=?').bind(JSON.stringify(config),JSON.stringify(encrypted),input.revision).run();
    if(!result.meta.changes) throw new NtuError('设置保存冲突，请刷新重试。');
  } else await env.DB.prepare('INSERT INTO ntu_settings(id,config,secrets,revision) VALUES(1,?,?,1)').bind(JSON.stringify(config),JSON.stringify(encrypted)).run();
  return {revision:input.revision+1};
}
export async function refreshCourses(env:NtuEnv) {
  const {secrets} = await settings(env,true); if(!secrets.cookie) throw new NtuError('请先保存 NTULearn Cookie。');
  await bb(secrets.cookie,'/learn/api/public/v1/users/me');
  const enrollments = await pages(secrets.cookie,'/learn/api/public/v1/users/me/courses');
  const active = enrollments.filter(e=>e.availability?.available === 'Yes' && typeof e.courseId==='string');
  if(active.length > 100) throw new NtuError('可用课程过多，请联系维护者。');
  for (const row of active) {
    const c = await bb(secrets.cookie,`/learn/api/public/v1/courses/${encodeURIComponent(row.courseId)}`);
    await env.DB.prepare('INSERT INTO ntu_courses(id,name,code,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,code=excluded.code')
      .bind(row.courseId,plain(c.name || c.displayName || row.courseId),plain(c.courseId || row.courseId),nowISO()).run();
  }
  return {message:`连接成功，读取到 ${active.length} 门可用课程。`};
}
export async function saveSchoolConnection(env:NtuEnv,input:{revision:number;courseIds:string[];cookie?:string;enabled:boolean;interval:number}) {
  const current=await settings(env);
  return saveSettings(env,{revision:input.revision,config:{...current.config,courseIds:input.courseIds,enabled:input.enabled,interval:input.interval,telegramEnabled:false,aiEnabled:false},secrets:{cookie:input.cookie}});
}
export async function overview(env:NtuEnv) {
  const [s,state,courses,items,counts,delivery] = await Promise.all([
    settings(env),env.DB.prepare('SELECT last_attempt,last_success,error,warning,lock_until FROM ntu_state WHERE id=1').first(),
    env.DB.prepare('SELECT * FROM ntu_courses ORDER BY name').all<Course>(),
    env.DB.prepare('SELECT * FROM ntu_items ORDER BY updated_at DESC LIMIT 200').all<Item>(),
    env.DB.prepare("SELECT COUNT(*) total,SUM(read_at IS NULL) unread,SUM(due_at > ?) upcoming FROM ntu_items").bind(nowISO()).first(),
    env.DB.prepare("SELECT status,COUNT(*) count FROM ntu_delivery GROUP BY status").all(),
  ]);
  return {config:s.config,configured:s.configured,revision:s.revision,encryptionReady:!!env.NTU_ENCRYPTION_KEY,state,courses:courses.results ?? [],items:items.results ?? [],counts,delivery:delivery.results ?? []};
}
export async function testIntegration(env:NtuEnv,action:string) {
  const {config,secrets} = await settings(env,true);
  if(action==='courses') return refreshCourses(env);
  if(action==='telegram-test') {
    await sendTelegram(secrets.telegramToken ?? '',config.chatId,'✓ NTU 通知中心已连接。考试提醒与课程公告将发送到这里。\nhttps://wzt.hk/admin/ntu');
    return {message:'测试消息已发送，请查看 Telegram。'};
  }
  if(action==='telegram-chats') {
    if(!secrets.telegramToken) throw new NtuError('请先保存 Telegram Token。');
    const updates = await telegram(secrets.telegramToken,'getUpdates',{limit:100,timeout:0});
    const chats = new Map<string,{id:string;name:string}>();
    for(const u of updates) { const c=u.message?.chat; if(c?.type==='private') chats.set(String(c.id),{id:String(c.id),name:c.first_name || c.username || '私人聊天'}); }
    return {chats:[...chats.values()],message:chats.size?'请选择你自己的聊天并保存。':'未找到聊天。请向机器人发送 /start 后重试；也可以手动填写 Chat ID。'};
  }
  if(action==='glm-test') {
    if(!secrets.glmKey) throw new NtuError('请先保存智谱通用 API Key。');
    const result=await summarize(secrets.glmKey,config.model,{title:'Connection test',body:'This is a connection test. No course information is included.'});
    return {message:`智谱连接成功：${result.summary}`};
  }
  throw new NtuError('未知操作。');
}
async function queue(env:NtuEnv,id:string,item:Item|null,category:string,text:string) {
  await env.DB.prepare("INSERT INTO ntu_delivery(id,item_id,fingerprint,category,text,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET fingerprint=excluded.fingerprint,text=excluded.text,status='pending',next_attempt=0 WHERE ntu_delivery.status='superseded'").bind(id,item?.id ?? null,item?.fingerprint ?? null,category,text,nowISO()).run();
}
function itemText(item:Item,name:string,prefix:string) {
  return `${prefix} · ${name}\n${item.title}\n${item.due_at ? `日历时间：${singapore(item.due_at)}（新加坡）\n` : ''}${item.summary || item.body.slice(0,850) || '请打开课程查看详情。'}\n${item.summary?'AI 摘要，请以原文为准。\n':''}${item.source_url}`;
}
async function syncCourse(env:NtuEnv,cookie:string,course:Course) {
  const since = new Date(Date.now()-86400000).toISOString(); const until=new Date(Date.now()+120*86400000).toISOString();
  const [announcements,events] = await Promise.all([
    pages(cookie,`/learn/api/public/v1/courses/${encodeURIComponent(course.id)}/announcements`),
    calendarItems(cookie,course.id,since,until),
  ]);
  const inputs = [...announcements.map(a=>({row:a,kind:'announcement'})),...events.map(a=>({row:a,kind:'calendar'}))];
  for(const {row,kind} of inputs) {
    if(!row.id) throw new NtuError('NTULearn 返回了缺少标识的数据，本轮未完成。');
    const id=`${course.id}:${kind}:${row.id}`; const title=plain(row.title || '未命名通知'); const body=plain(row.body || row.description || '');
    const due=kind==='calendar'?iso(row.start):null; const fingerprint=await hash(JSON.stringify({title,body,due,end:row.end ?? null}));
    const old=await env.DB.prepare('SELECT * FROM ntu_items WHERE id=?').bind(id).first<Item>();
    if(old?.fingerprint===fingerprint) continue;
    const date=iso(row.modified) || iso(row.created);
    const item:Item={id,course_id:course.id,kind,title,body,due_at:due,source_date:date,source_url:sourceURL(course.id),fingerprint,summary:null,important:Number(important(`${title}\n${body}`)),ai_status:'pending',read_at:null,updated_at:nowISO()};
    const writes = [
      env.DB.prepare(`INSERT INTO ntu_items(id,course_id,kind,title,body,source_url,source_date,due_at,fingerprint,important,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,source_date=excluded.source_date,due_at=excluded.due_at,fingerprint=excluded.fingerprint,important=excluded.important,summary=NULL,ai_status='pending',read_at=NULL,updated_at=excluded.updated_at`)
        .bind(id,course.id,kind,title,body,item.source_url,date,due,fingerprint,item.important,item.updated_at),
      env.DB.prepare("UPDATE ntu_delivery SET status='superseded' WHERE item_id=? AND status='pending'").bind(id),
    ];
    if(course.baseline) writes.push(env.DB.prepare('INSERT OR IGNORE INTO ntu_delivery(id,item_id,fingerprint,category,text,created_at) VALUES(?,?,?,?,?,?)').bind(`change:${id}:${fingerprint}`,id,fingerprint,item.important?'important':'ordinary',itemText(item,course.name,old?'内容更新':'新通知'),nowISO()));
    await env.DB.batch(writes);
  }
  // Only complete a baseline after both upstream feeds and all writes succeeded.
  await env.DB.prepare('UPDATE ntu_courses SET baseline=1,updated_at=? WHERE id=?').bind(nowISO(),course.id).run();
  // Calendar removals cancel old reminders only after a complete successful calendar fetch.
  const live=new Set(events.map(e=>`${course.id}:calendar:${e.id}`));
  const existing=(await env.DB.prepare("SELECT id FROM ntu_items WHERE course_id=? AND kind='calendar' AND due_at>? AND due_at<?").bind(course.id,since,until).all<{id:string}>()).results ?? [];
  for(const e of existing) if(!live.has(e.id)) await env.DB.batch([
    env.DB.prepare("UPDATE ntu_items SET due_at=NULL,fingerprint='removed:' || fingerprint WHERE id=?").bind(e.id),
    env.DB.prepare("UPDATE ntu_delivery SET status='superseded' WHERE item_id=? AND status='pending'").bind(e.id),
  ]);
}
async function enrich(env:NtuEnv,config:Config,secrets:Secrets,deadline:number) {
  if(!config.aiEnabled || !secrets.glmKey) return;
  const items=(await env.DB.prepare("SELECT * FROM ntu_items WHERE ai_status='pending' ORDER BY important DESC,updated_at DESC LIMIT 5").all<Item>()).results ?? [];
  for(const item of items) {
    if(Date.now()>deadline) break;
    if(!config.courseIds.includes(item.course_id)) continue;
    try {
      const s=await summarize(secrets.glmKey,config.model,item); item.summary=s.summary; item.important=Number(!!item.important || s.important);
      await env.DB.prepare("UPDATE ntu_items SET summary=?,important=?,ai_status='done' WHERE id=? AND fingerprint=?").bind(s.summary,item.important,item.id,item.fingerprint).run();
      const course=await env.DB.prepare('SELECT name FROM ntu_courses WHERE id=?').bind(item.course_id).first<{name:string}>();
      await env.DB.prepare("UPDATE ntu_delivery SET text=?,category=CASE WHEN category='ordinary' AND ?=1 THEN 'important' ELSE category END WHERE item_id=? AND fingerprint=? AND status='pending' AND category IN ('ordinary','important')")
        .bind(itemText(item,course?.name ?? item.course_id,'课程通知'),item.important,item.id,item.fingerprint).run();
    } catch(error) {
      await env.DB.prepare("UPDATE ntu_items SET ai_status='failed' WHERE id=? AND fingerprint=?").bind(item.id,item.fingerprint).run();
      await env.DB.prepare('UPDATE ntu_state SET warning=? WHERE id=1').bind(safeError(error)).run();
      break; // Avoid repeated charges/failures; original notices remain deliverable.
    }
  }
}
async function deliver(env:NtuEnv,config:Config,secrets:Secrets) {
  if(!config.telegramEnabled || !secrets.telegramToken || !config.chatId) return;
  const sg=new Date(Date.now()+8*3600000); const today=sg.toISOString().slice(0,10);
  let cutoff=Date.parse(`${today}T${String(config.digestHour).padStart(2,'0')}:00:00+08:00`);
  if(cutoff>Date.now()) cutoff-=86400000;
  const rows=(await env.DB.prepare("SELECT * FROM ntu_delivery WHERE status='pending' AND next_attempt<=? ORDER BY CASE WHEN category='ordinary' THEN 1 ELSE 0 END,created_at LIMIT 100").bind(Date.now()).all<{id:string;item_id:string|null;fingerprint:string|null;category:string;text:string;attempts:number;created_at:string}>()).results ?? [];
  const eligible:typeof rows=[];
  for(const row of rows) {
    if(row.item_id) {
      const item=await env.DB.prepare('SELECT course_id,due_at,fingerprint FROM ntu_items WHERE id=?').bind(row.item_id).first<Pick<Item,'course_id'|'due_at'|'fingerprint'>>();
      if(!item || item.fingerprint!==row.fingerprint || !config.courseIds.includes(item.course_id) || (row.category==='reminder' && (!config.reminder24 || !item.due_at || Date.parse(item.due_at)<=Date.now()))) {
        await env.DB.prepare("UPDATE ntu_delivery SET status='superseded' WHERE id=?").bind(row.id).run(); continue;
      }
      if(row.category==='reminder') {
        const fresh=await env.DB.prepare('SELECT c.updated_at >= s.last_attempt AS fresh FROM ntu_courses c, ntu_state s WHERE c.id=? AND s.id=1').bind(item.course_id).first<{fresh:number}>();
        if(!fresh?.fresh) continue;
      }
    }
    if(row.category==='ordinary' && config.mode==='digest' && Date.parse(row.created_at)>cutoff) continue;
    eligible.push(row);
  }
  // Group ordinary announcements into bounded digest messages; preserve per-item retry state.
  const batches:{rows:typeof rows;text:string}[]=[];
  for(const row of eligible) {
    const digest=row.category==='ordinary' && config.mode==='digest';
    const last=batches.at(-1);
    if(digest && last?.rows.every(r=>r.category==='ordinary') && last.text.length+row.text.length+8<3500) {
      last.rows.push(row);last.text+='\n\n——\n'+row.text;
    } else batches.push({rows:[row],text:(digest?'每日公告汇总\n':'')+row.text});
  }
  for(const batch of batches.slice(0,15)) {
    try {
      await sendTelegram(secrets.telegramToken,config.chatId,batch.text);
      await env.DB.batch(batch.rows.map(row=>env.DB.prepare("UPDATE ntu_delivery SET status='sent',sent_at=?,error=NULL WHERE id=?").bind(nowISO(),row.id)));
    } catch(error) {
      await env.DB.batch(batch.rows.map(row=>env.DB.prepare('UPDATE ntu_delivery SET attempts=attempts+1,next_attempt=?,error=? WHERE id=?').bind(Date.now()+Math.min(3600000,60000*2**Math.min(row.attempts,6)),safeError(error),row.id)));
      await env.DB.prepare('UPDATE ntu_state SET warning=? WHERE id=1').bind(safeError(error)).run(); break;
    }
  }
}
export async function runSync(env:NtuEnv,manual=false) {
  const start=Date.now(); const {config,secrets}=await settings(env,true);
  if(!config.enabled && !manual) return {message:'自动同步已暂停。'};
  if(!secrets.cookie || !config.courseIds.length) { if(!manual)return {message:'等待配置。'}; throw new NtuError('请先保存 Cookie 并选择课程。'); }
  const state=await env.DB.prepare('SELECT last_attempt FROM ntu_state WHERE id=1').first<{last_attempt:string|null}>();
  if(!manual && state?.last_attempt && Date.parse(state.last_attempt)+config.interval*60000>start) return {message:'尚未到同步时间。'};
  const token=crypto.randomUUID();
  const lock=await env.DB.prepare('UPDATE ntu_state SET lock_token=?,lock_until=?,last_attempt=?,error=NULL,warning=NULL WHERE id=1 AND lock_until<?').bind(token,start+14*60000,nowISO(),start).run();
  if(!lock.meta.changes) throw new NtuError('已有同步任务运行中，请稍后刷新。');
  let completed=0; const errors:string[]=[];
  try {
    const all=(await env.DB.prepare('SELECT * FROM ntu_courses ORDER BY updated_at').all<Course>()).results ?? [];
    const courses=all.filter(c=>config.courseIds.includes(c.id));
    for(const course of courses) {
      if(Date.now()-start>180000) {errors.push('本轮达到时间限制，剩余课程将在下一轮继续。');break;}
      try {await syncCourse(env,secrets.cookie,course);completed++;}
      catch(error) {errors.push(`${course.name}：${safeError(error)}`); if(safeError(error).includes('登录'))break;}
    }
    await enrich(env,config,secrets,start+240000);
    if(config.reminder24) {
      const items=(await env.DB.prepare("SELECT * FROM ntu_items WHERE due_at>? AND due_at<=? ORDER BY due_at").bind(nowISO(),new Date(Date.now()+86400000).toISOString()).all<Item>()).results ?? [];
      for(const item of items) if(config.courseIds.includes(item.course_id) && reminderDue(item.due_at,Date.now())) {
        const c=courses.find(c=>c.id===item.course_id);
        // Never send stale reminders for a course whose latest fetch failed.
        const latest=await env.DB.prepare('SELECT updated_at FROM ntu_courses WHERE id=?').bind(item.course_id).first<{updated_at:string}>();
        if(!latest || Date.parse(latest.updated_at)<start) continue;
        await queue(env,`reminder:${item.id}:${item.due_at}`,item,'reminder',itemText(item,c?.name ?? item.course_id,'24 小时内到期'));
      }
    }
    if(errors.length) {
      const error=errors.join('\n').slice(0,3000);
      await env.DB.prepare('UPDATE ntu_state SET error=? WHERE id=1').bind(error).run();
      await queue(env,`health:${new Date().toISOString().slice(0,10)}`,null,'health',`NTU 同步需要检查\n${error.slice(0,1500)}\nhttps://wzt.hk/admin/ntu`);
    } else {
      await env.DB.batch([env.DB.prepare('UPDATE ntu_state SET last_success=? WHERE id=1').bind(nowISO()),env.DB.prepare("UPDATE ntu_delivery SET status='superseded' WHERE category='health' AND status='pending'")]);
    }
    await deliver(env,config,secrets);
    return {message:errors.length?`已同步 ${completed} 门课程，部分失败，请查看同步状态。`:`同步完成：${completed} 门课程。`};
  } catch(error) {
    await env.DB.prepare('UPDATE ntu_state SET error=? WHERE id=1').bind(safeError(error)).run(); throw error;
  } finally { await env.DB.prepare('UPDATE ntu_state SET lock_token=NULL,lock_until=0 WHERE id=1 AND lock_token=?').bind(token).run(); }
}
