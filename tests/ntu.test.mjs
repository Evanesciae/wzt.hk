import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const dir=await mkdtemp(join(tmpdir(),'ntu-test-'));
await build({entryPoints:['src/server/ntu/service.ts','src/server/ntu/core.ts','src/server/ntu/integrations.ts'],outdir:dir,bundle:true,platform:'node',format:'esm'});
const svc=await import(pathToFileURL(join(dir,'service.js')));
const core=await import(pathToFileURL(join(dir,'core.js')));
const integrations=await import(pathToFileURL(join(dir,'integrations.js')));
const schema=await readFile('migrations/0015_ntu_notifications.sql','utf8');
const nativeFetch=globalThis.fetch;
function fixture() {
  const db=new DatabaseSync(':memory:');db.exec(schema);
  const wrap=(sql,args=[])=>({bind:(...a)=>wrap(sql,a),first:async()=>db.prepare(sql).get(...args)??null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});
  const env={NTU_ENCRYPTION_KEY:Buffer.alloc(32,8).toString('base64'),DB:{prepare:wrap,batch:async statements=>{db.exec('BEGIN');try {const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}}};
  db.prepare('INSERT INTO ntu_courses(id,name,code,updated_at) VALUES(?,?,?,?)').run('_1_1','SC1001','SC1001',new Date().toISOString());
  const feed={announcements:[{id:'a1',title:'Welcome',body:'Old announcement',created:'2026-01-01T00:00:00Z'}],events:[],messages:[],failNtu:false,failTelegram:false,failAI:false};
  globalThis.fetch=async(url,options={})=>{
    const u=new URL(url);
    if(u.hostname==='ntulearn.ntu.edu.sg') {
      assert.equal(options.headers.Cookie,'BbRouter=private-cookie');assert.equal(options.redirect,'manual');
      if(feed.failNtu)return new Response('',{status:401});
      return Response.json({results:u.pathname.includes('announcements')?feed.announcements:feed.events});
    }
    if(u.hostname==='open.bigmodel.cn') {
      assert.ok(!options.body.includes('private-cookie'));
      if(feed.failAI)return new Response('',{status:429});
      return Response.json({choices:[{message:{content:JSON.stringify({summary:'中文重点摘要',important:true})}}]});
    }
    if(u.hostname==='api.telegram.org') {
      if(feed.failTelegram)return Response.json({ok:false},{status:429});
      feed.messages.push(JSON.parse(options.body));return Response.json({ok:true,result:{message_id:feed.messages.length}});
    }
    throw new Error('unexpected host');
  };
  async function configure(overrides={}) {
    const old=await svc.settings(env);
    await svc.saveSettings(env,{revision:old.revision,config:{...core.defaults,enabled:true,telegramEnabled:true,mode:'all',courseIds:['_1_1'],chatId:'123',...overrides},secrets:{cookie:'private-cookie',telegramToken:'123:'+ 'a'.repeat(30),glmKey:'private-glm'}});
  }
  return {db,env,feed,configure};
}
test('settings encrypt credentials, never expose values, and reject stale writes',async()=>{
  const f=fixture();await f.configure();const row=f.db.prepare('SELECT * FROM ntu_settings').get();assert.ok(!row.secrets.includes('private-cookie'));
  const view=await svc.overview(f.env);assert.ok(!JSON.stringify(view).includes('private-glm'));assert.equal(view.configured.cookie,true);
  assert.equal((await svc.settings(f.env,true)).secrets.cookie,'private-cookie');
  await assert.rejects(svc.saveSettings(f.env,{revision:0,config:core.defaults}),/窗口更新/);
  await assert.rejects(svc.saveSettings(f.env,{revision:1,config:{...core.defaults,interval:1}}),/格式/);
  const encrypted=JSON.parse(row.secrets);encrypted.glmKey=encrypted.cookie;f.db.prepare('UPDATE ntu_settings SET secrets=?').run(JSON.stringify(encrypted));
  await assert.rejects(svc.settings(f.env,true));f.db.close();
});
test('first sync baselines; new and modified announcements notify exactly once',async()=>{
  const f=fixture();await f.configure();await svc.runSync(f.env,true);assert.equal(f.feed.messages.length,0);
  f.feed.announcements.push({id:'a2',title:'Exam tomorrow',body:'Room A'});
  await svc.runSync(f.env,true);assert.equal(f.feed.messages.length,1);
  await svc.runSync(f.env,true);assert.equal(f.feed.messages.length,1);
  f.feed.announcements[1].body='Room B';await svc.runSync(f.env,true);assert.equal(f.feed.messages.length,2);assert.match(f.feed.messages[1].text,/内容更新/);assert.match(f.feed.messages[1].text,/Room B/);f.db.close();
});
test('expired login preserves data, keeps baseline incomplete, and alerts once per day',async()=>{
  const f=fixture();await f.configure();f.feed.failNtu=true;await svc.runSync(f.env,true);await svc.runSync(f.env,true);
  assert.equal(f.feed.messages.length,1);assert.equal(f.db.prepare('SELECT baseline FROM ntu_courses').get().baseline,0);
  assert.match((await svc.overview(f.env)).state.error,/登录已过期/);assert.equal((await svc.overview(f.env)).state.last_success,null);f.db.close();
});
test('calendar reminders do not repeat and removed events do not cause stale reminders',async()=>{
  const f=fixture();await f.configure();const date=new Date(Date.now()+3600000).toISOString();
  f.feed.events=[{id:'e1',title:'Quiz',start:date}];await svc.runSync(f.env,true);await svc.runSync(f.env,true);assert.equal(f.feed.messages.length,1);
  f.feed.events=[];await svc.runSync(f.env,true);assert.equal(f.db.prepare("SELECT due_at FROM ntu_items WHERE kind='calendar'").get().due_at,null);
  f.feed.events=[{id:'e1',title:'Quiz',start:date}];await svc.runSync(f.env,true);assert.equal(f.db.prepare("SELECT due_at FROM ntu_items WHERE kind='calendar'").get().due_at,date);f.db.close();
});
test('Telegram failures retain outbox messages and retry, AI failure retains raw content',async()=>{
  const f=fixture();await f.configure({aiEnabled:true});await svc.runSync(f.env,true);
  f.feed.announcements.push({id:'a2',title:'Exam',body:'Bring your calculator'});f.feed.failTelegram=true;f.feed.failAI=true;
  await svc.runSync(f.env,true);assert.equal(f.feed.messages.length,0);assert.equal(f.db.prepare("SELECT status FROM ntu_delivery WHERE category='important'").get().status,'pending');
  f.feed.failTelegram=false;f.db.exec('UPDATE ntu_delivery SET next_attempt=0');await svc.runSync(f.env,true);assert.match(f.feed.messages[0].text,/Bring your calculator/);f.db.close();
});
test('daily digest waits for cutoff; cron respects pause and interval; overlapping sync is locked',async()=>{
  const f=fixture();await f.configure({mode:'digest'});await svc.runSync(f.env,true);f.feed.announcements.push({id:'a2',title:'Lecture slides',body:'Uploaded'});await svc.runSync(f.env,true);assert.equal(f.feed.messages.length,0);
  f.db.exec("UPDATE ntu_delivery SET created_at='2020-01-01T00:00:00Z'");await svc.runSync(f.env,true);assert.match(f.feed.messages[0].text,/每日公告汇总/);
  assert.match((await svc.runSync(f.env)).message,/尚未/);
  await f.configure({enabled:false});assert.match((await svc.runSync(f.env)).message,/暂停/);
  f.db.prepare('UPDATE ntu_state SET lock_until=?').run(Date.now()+60000);await assert.rejects(svc.runSync(f.env,true),/运行中/);f.db.close();
});
test('hostile pagination cannot leak the Cookie; malformed timestamps do not become alarms',async()=>{
  assert.throws(()=>core.ntuURL('https://evil.example/learn/api/public/v1/courses'));
  assert.throws(()=>core.ntuURL('https://ntulearn.ntu.edu.sg@evil.example/learn/api/public/'));
  assert.equal(core.iso('tomorrow'),null);assert.equal(core.iso('2026-10-05T13:00:00'),null);
  let count=0;globalThis.fetch=async()=>{count++;return Response.json({results:[],paging:{nextPage:'https://evil.example/learn/api/public/'}});};
  await assert.rejects(integrations.pages('secret','/learn/api/public/v1/courses'),/不受信任/);assert.equal(count,1);
});
test('school-only settings preserve the cookie and need no model or messaging configuration',async()=>{
  const f=fixture();await f.configure();
  await svc.saveSchoolConnection(f.env,{revision:1,courseIds:['_1_1'],cookie:'',enabled:true,interval:60});
  const saved=await svc.settings(f.env,true);
  assert.equal(saved.secrets.cookie,'private-cookie');
  assert.equal(saved.config.telegramEnabled,false);assert.equal(saved.config.aiEnabled,false);
  assert.equal(saved.config.enabled,true);assert.equal(saved.config.interval,60);
  await assert.rejects(svc.saveSchoolConnection(f.env,{revision:1,courseIds:['_1_1'],enabled:true,interval:60}),/窗口更新/);
  f.db.close();
});
test('calendar queries obey upstream limits, cover the full range and deduplicate boundaries',async()=>{
  const ranges=[];
  globalThis.fetch=async url=>{
    const u=new URL(url),since=Date.parse(u.searchParams.get('since')),until=Date.parse(u.searchParams.get('until'));
    assert.equal(u.searchParams.get('courseId'),'_1_1');
    if(until-since>112*86400000)return Response.json({message:'Maximum timespan is 16 weeks'},{status:400});
    ranges.push([since,until]);return Response.json({results:[{id:'boundary'},{id:'event-'+ranges.length}]});
  };
  const start='2026-10-08T00:00:00.000Z',end='2027-02-06T00:00:00.000Z';
  const rows=await integrations.calendarItems('secret','_1_1',start,end);
  assert.equal(ranges.length,5);assert.equal(ranges[0][0],Date.parse(start));assert.equal(ranges.at(-1)[1],Date.parse(end));
  for(let i=1;i<ranges.length;i++)assert.equal(ranges[i][0],ranges[i-1][1]);
  assert.equal(rows.length,6);
  globalThis.fetch=async()=>Response.json({},{status:400});
  await assert.rejects(integrations.calendarItems('secret','_1_1',start,end),/请求参数（400）/);
});
process.on('exit',()=>{globalThis.fetch=nativeFetch;});
await test('cleanup',async()=>{await rm(dir,{recursive:true,force:true});});
