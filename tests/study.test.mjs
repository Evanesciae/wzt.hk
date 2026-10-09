import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const dir=await mkdtemp(join(tmpdir(),'study-test-'));
await build({entryPoints:['src/server/study.ts','src/server/study-markdown.ts','src/server/ntu/service.ts','src/server/ntu/core.ts'],outdir:dir,bundle:true,platform:'node',format:'esm',packages:'external'});
// Resolve external dependencies from this worktree instead of the temporary bundle.
const {symlink}=await import('node:fs/promises');await symlink(join(process.cwd(),'node_modules'),join(dir,'node_modules'));
const svc=await import(pathToFileURL(join(dir,'study.js'))),ntu=await import(pathToFileURL(join(dir,'ntu/service.js'))),core=await import(pathToFileURL(join(dir,'ntu/core.js')));
const {studyMarkdown}=await import(pathToFileURL(join(dir,'study-markdown.js')));
const schema=(await Promise.all(['0015_ntu_notifications.sql','0016_study_pipeline.sql'].map(p=>readFile('migrations/'+p,'utf8')))).join('\n');
after(()=>rm(dir,{recursive:true,force:true}));
async function fixture(){
  const db=new DatabaseSync(':memory:');db.exec(schema);const objects=new Map();
  const wrap=(sql,args=[])=>({bind:(...a)=>wrap(sql,a),first:async()=>db.prepare(sql).get(...args)??null,all:async()=>({results:db.prepare(sql).all(...args)}),run:async()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}})});
  const env={NTU_ENCRYPTION_KEY:Buffer.alloc(32,8).toString('base64'),NTU_RUNNER_TOKEN:'x'.repeat(48),MEDIA:{put:async(k,v)=>objects.set(k,new Uint8Array(v)),get:async k=>objects.has(k)?{body:objects.get(k)}:null},DB:{prepare:wrap,batch:async statements=>{db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out;}catch(e){db.exec('ROLLBACK');throw e;}}}};
  db.prepare('INSERT INTO ntu_courses(id,name,code,updated_at) VALUES(?,?,?,?)').run('_1_1','SC1001','SC1001',new Date().toISOString());
  await ntu.saveSettings(env,{revision:0,config:{...core.defaults,courseIds:['_1_1']},secrets:{cookie:'private-cookie',glmKey:'private-glm'}});
  await svc.saveConfig(env,{revision:0,enabled:true,autoAnalyze:true,intervalMinutes:60,dailyJobs:2,model:''});
  const run=await svc.beginRun(env);
  const input={runId:run.id,courseId:'_1_1',contentId:'content',attachmentId:'file',title:'Lecture',kind:'material',fingerprint:'a'.repeat(64),body:'Some material'};
  async function source(extra={}){return svc.upsertSource(env,{...input,...extra});}
  async function upload(sid,text='lecture text',name='lecture.txt'){
    const bytes=new TextEncoder().encode(text),digest=await core.hash(text);
    return svc.upload(env,new Request('https://wzt.hk/api/ntu-runner',{method:'POST',headers:{'x-run-id':run.id,'x-source-id':sid,'x-file-hash':digest,'x-file-name':encodeURIComponent(name),'content-length':String(bytes.length)},body:bytes}));
  }
  return {db,env,run,input,source,upload,objects};
}
test('runner token required; credentials only leave the settings gate',async()=>{
  const f=await fixture();assert.equal(await svc.runnerAuthorized(f.env,new Request('https://wzt.hk')),false);
  assert.equal(await svc.runnerAuthorized(f.env,new Request('https://wzt.hk',{headers:{Authorization:'Bearer '+'x'.repeat(48)}})),true);
  f.db.exec('UPDATE study_settings SET enabled=0');const config=await svc.runnerConfig(f.env);assert.equal(config.cookie,null);assert.equal(config.glmKey,null);assert.equal('telegramToken' in config,false);f.db.close();
});
test('first course import stays quiet; changed metadata invalidates current file until upload succeeds',async()=>{
  const f=await fixture();const s=await f.source({kind:'assignment'});const v=await f.upload(s.id);assert.equal(f.db.prepare('SELECT count(*) n FROM automation_jobs').get().n,0);assert.equal(f.db.prepare('SELECT count(*) n FROM ntu_delivery').get().n,0);
  f.db.prepare('INSERT INTO study_course_state VALUES(?,?)').run('_1_1',new Date().toISOString());
  await f.source({kind:'assignment',fingerprint:'b'.repeat(64)});assert.equal(f.db.prepare('SELECT version_id FROM study_sources').get().version_id,null);
  await f.source({kind:'assignment',fingerprint:'b'.repeat(64)});assert.equal(f.db.prepare('SELECT count(*) n FROM ntu_delivery').get().n,1);
  await f.upload(s.id);assert.equal(f.db.prepare('SELECT version_id FROM study_sources').get().version_id,v.id);
  assert.equal(f.objects.size,1);assert.ok([...f.objects.keys()][0].startsWith('private/study/'));f.db.close();
});
test('version jobs deduplicate; leases reject stale completion; retries respect daily allowance',async()=>{
  const f=await fixture();f.db.prepare('INSERT INTO study_course_state VALUES(?,?)').run('_1_1',new Date().toISOString());
  const s=await f.source(),v=await f.upload(s.id);await svc.enqueue(f.env,v.id);assert.equal(f.db.prepare('SELECT count(*) n FROM automation_jobs').get().n,1);
  const first=await svc.claim(f.env);assert.ok(first.job);assert.equal((await svc.claim(f.env)).job,null);
  f.db.exec('UPDATE automation_jobs SET lease_until=0');const second=await svc.claim(f.env);assert.ok(second.job);
  await assert.rejects(svc.complete(f.env,{id:first.job.id,token:first.job.lease_token,status:'completed',markdown:'X'.repeat(100)}),/过期/);
  await svc.complete(f.env,{id:second.job.id,token:second.job.lease_token,status:'failed',error:'Test interruption'});
  f.db.exec('UPDATE automation_jobs SET available_at=0');assert.equal((await svc.claim(f.env)).job,null);
  f.db.exec("UPDATE study_attempts SET started_at='2020-01-01T00:00:00Z'");const third=await svc.claim(f.env);assert.ok(third.job);
  await svc.complete(f.env,{id:third.job.id,token:third.job.lease_token,status:'completed',markdown:'# Lesson\n\n'+'Verified material. '.repeat(10)});
  assert.equal(f.db.prepare('SELECT count(*) n FROM study_notes').get().n,1);assert.equal(f.db.prepare('SELECT status FROM automation_jobs').get().status,'completed');
  const response=await svc.fileResponse(f.env,v.id);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(await response.text(),'lecture text');f.db.close();
});
test('expired sync cannot alter sources; removed courses cannot upload',async()=>{
  const f=await fixture();assert.equal((await svc.beginRun(f.env)).id,null);f.db.exec('UPDATE automation_runs SET lease_until=0');await assert.rejects(f.source(),/过期/);f.db.close();
});
test('model markdown strips active HTML and remote images while rendering math',()=>{
  const html=studyMarkdown('# Lesson\n\n<script>alert(1)</script><img src="https://evil.test/x"><a href="javascript:alert(1)">bad</a>\n\n$x^2$');
  assert.ok(!html.includes('<script'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('javascript:'));assert.match(html,/katex/);
  const dangerous=studyMarkdown('$\\href{javascript:alert(1)}{click}$');assert.ok(!dangerous.includes('href="javascript:'));
});
