import { settings, type NtuEnv } from './ntu/service';
import { hash, iso, NtuError } from './ntu/core';

export interface StudyEnv extends NtuEnv { MEDIA: R2Bucket; NTU_RUNNER_TOKEN?: string }
export interface StudyConfig { enabled:number; auto_analyze:number; interval_minutes:number; model:string; revision:number; daily_jobs:number }
export interface Source {id:string;course_id:string;content_id:string;title:string;kind:string;source_url:string;body:string;due_at:string|null;fingerprint:string;checked_at:string;version_id:string|null;created_at:string;updated_at:string}
export const PROCESSOR = 'study-v1';
export const MAX_FILE = 25 * 1024 * 1024;
const now = () => new Date().toISOString();
export const reply = (value:unknown,status=200) => Response.json(value,{status,headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store'}});
export async function config(env:StudyEnv) { return (await env.DB.prepare('SELECT * FROM study_settings WHERE id=1').first<StudyConfig>())!; }
export async function runnerAuthorized(env:StudyEnv, request:Request) {
  if(!env.NTU_RUNNER_TOKEN || env.NTU_RUNNER_TOKEN.length < 32) return false;
  const value = request.headers.get('authorization') ?? '';
  if(value.length>300) return false;
  const a=await hash(value), b=await hash(`Bearer ${env.NTU_RUNNER_TOKEN}`);
  let diff=0; for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
export async function runnerConfig(env:StudyEnv) {
  const c=await config(env), ntu=await settings(env,true);
  const ready=!!ntu.secrets.cookie && ntu.config.courseIds.length>0;
  const last=await env.DB.prepare("SELECT * FROM automation_runs WHERE workflow='ntu-sync' ORDER BY started_at DESC LIMIT 1").first<{id:string;status:string;started_at:string;lease_until:number}>();
  return {enabled:!!c.enabled,ready,autoAnalyze:!!c.auto_analyze,intervalMinutes:c.interval_minutes,model:c.model || ntu.config.model,
    courseIds:ntu.config.courseIds,cookie:c.enabled?ntu.secrets.cookie:null,glmKey:c.enabled?ntu.secrets.glmKey:null,last,
    // The runner never receives admin sessions, Cloudflare tokens or Telegram credentials.
    baselineCourses:(await env.DB.prepare('SELECT course_id FROM study_course_state').all<{course_id:string}>()).results!.map(r=>r.course_id),processorVersion:PROCESSOR};
}
export async function saveConfig(env:StudyEnv,input:Record<string,any>) {
  if(!Number.isInteger(input.dailyJobs)||input.dailyJobs<1||input.dailyJobs>10)throw new NtuError('每日分析次数需为 1–10。');
  if(typeof input.enabled!=='boolean'||typeof input.autoAnalyze!=='boolean'||![30,60,120,360].includes(input.intervalMinutes)||!Number.isInteger(input.revision)||typeof input.model!=='string'||!/^$|^glm-[\w.-]{1,60}$/.test(input.model))throw new NtuError('设置格式不正确。');
  const ntu=await settings(env);
  if(input.enabled && (!ntu.configured.cookie || !ntu.config.courseIds.length))throw new NtuError('先到 NTU 通知中心连接学校账号并选择课程。');
  if(input.autoAnalyze && !ntu.configured.glmKey)throw new NtuError('自动分析需要先配置智谱通用 API Key。');
  const r=await env.DB.prepare('UPDATE study_settings SET enabled=?,auto_analyze=?,interval_minutes=?,model=?,daily_jobs=?,revision=revision+1 WHERE id=1 AND revision=?').bind(Number(input.enabled),Number(input.autoAnalyze),input.intervalMinutes,input.model,input.dailyJobs,input.revision).run();
  if(!r.meta.changes)throw new NtuError('设置已变化，请刷新页面后再保存。');
}
export async function manifest(env:StudyEnv,offset:number) {
  const ntu=await settings(env);
  const rows=(await env.DB.prepare('SELECT * FROM study_sources ORDER BY id LIMIT 500 OFFSET ?').bind(offset).all<Source>()).results ?? [];
  return {sources:rows.filter(s=>ntu.config.courseIds.includes(s.course_id)),next:rows.length===500?offset+500:null};
}
export async function beginRun(env:StudyEnv) {
  const c=await config(env);if(!c.enabled)throw new NtuError('同步已暂停。');
  const id=crypto.randomUUID(), time=Date.now();
  await env.DB.prepare("UPDATE automation_runs SET status='interrupted',finished_at=?,error='服务器任务中断，等待下一轮恢复' WHERE workflow='ntu-sync' AND status='running' AND lease_until<?").bind(now(),time).run();
  const r=await env.DB.prepare("INSERT INTO automation_runs(id,workflow,status,started_at,lease_until) SELECT ?,'ntu-sync','running',?,? WHERE NOT EXISTS(SELECT 1 FROM automation_runs WHERE workflow='ntu-sync' AND (status='running' OR started_at>?))").bind(id,now(),time+15*60000,new Date(time-c.interval_minutes*60000).toISOString()).run();
  return {id:r.meta.changes?id:null};
}
export async function liveRun(env:StudyEnv,id:unknown) {
  if(typeof id!=='string')throw new NtuError('缺少同步标识。');
  const c=await config(env);if(!c.enabled)throw new NtuError('同步已暂停。');
  const r=await env.DB.prepare("UPDATE automation_runs SET lease_until=? WHERE id=? AND workflow='ntu-sync' AND status='running' AND lease_until>?").bind(Date.now()+15*60000,id,Date.now()).run();
  if(!r.meta.changes)throw new NtuError('同步任务已过期。');
}
export async function finishRun(env:StudyEnv,input:Record<string,any>) {
  if(!['completed','partial','needs_auth','failed'].includes(input.status))throw new NtuError('运行状态不正确。');
  const active=await env.DB.prepare("SELECT id FROM automation_runs WHERE id=? AND status='running' AND lease_until>?").bind(String(input.runId),Date.now()).first();
  if(!active)throw new NtuError('同步任务已过期。');
  const ntu=await settings(env);
  for(const courseId of Array.isArray(input.completedCourses)?input.completedCourses:[])if(ntu.config.courseIds.includes(courseId))await env.DB.prepare('INSERT OR IGNORE INTO study_course_state(course_id,baseline_at) VALUES(?,?)').bind(courseId,now()).run();
  await env.DB.prepare("UPDATE automation_runs SET status=?,finished_at=?,result=?,error=?,lease_until=0 WHERE id=? AND status='running'")
    .bind(input.status,now(),JSON.stringify(input.counts??{}).slice(0,3000),String(input.error??'').slice(0,1000)||null,String(input.runId)).run();
  if(input.status!=='completed') {
    const text=input.status==='needs_auth'?'课程文件同步需要更新学校登录 Cookie。':'课程文件同步部分失败，请在私有课程资料页查看。';
    await env.DB.prepare("INSERT OR IGNORE INTO ntu_delivery(id,category,text,created_at) VALUES(?,'health',?,?)")
      .bind(`study-health:${now().slice(0,10)}`,`${text}\nhttps://wzt.hk/admin/study`,now()).run();
  }
}
export async function upsertSource(env:StudyEnv,input:Record<string,any>) {
  await liveRun(env,input.runId);
  const ntu=await settings(env);
  if(!ntu.config.courseIds.includes(input.courseId)||typeof input.contentId!=='string'||input.contentId.length>150||typeof input.attachmentId!=='string'||input.attachmentId.length>1000||typeof input.title!=='string'||!['material','assignment'].includes(input.kind)||!/^[a-f0-9]{64}$/.test(input.fingerprint))throw new NtuError('课程资料格式不正确。');
  const id=await hash(`${input.courseId}:${input.contentId}:${input.attachmentId}`);
  const old=await env.DB.prepare('SELECT id,fingerprint FROM study_sources WHERE id=?').bind(id).first<{id:string;fingerprint:string}>();
  const time=now();
  await env.DB.prepare(`INSERT INTO study_sources(id,course_id,content_id,title,kind,source_url,body,due_at,fingerprint,checked_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version_id=CASE WHEN study_sources.fingerprint=excluded.fingerprint THEN study_sources.version_id ELSE NULL END,title=excluded.title,kind=excluded.kind,body=excluded.body,due_at=excluded.due_at,fingerprint=excluded.fingerprint,checked_at=excluded.checked_at,updated_at=excluded.updated_at`)
    .bind(id,input.courseId,input.contentId,input.title.slice(0,300),input.kind,`https://ntulearn.ntu.edu.sg/ultra/courses/${encodeURIComponent(input.courseId)}/outline`,String(input.body??'').slice(0,30000),iso(input.dueAt),input.fingerprint,time,time,time).run();
  // Do not announce historical assignments on the first successful course scan.
  const baseline=await env.DB.prepare('SELECT course_id FROM study_course_state WHERE course_id=?').bind(input.courseId).first();
  if(old?.fingerprint!==input.fingerprint && input.kind==='assignment' && baseline) {
    await env.DB.prepare("INSERT OR IGNORE INTO ntu_delivery(id,category,text,created_at) VALUES(?,'important',?,?)")
      .bind(`study-assignment:${id}:${input.fingerprint}`,`${old?'作业更新':'发现作业'}：${input.title.slice(0,300)}\n${String(input.body??'').slice(0,700)}\n截止时间：${iso(input.dueAt)??'未明确，请查看原文'}\n需要分析或加入日历吗？打开资料页选择：\nhttps://wzt.hk/admin/study/${id}`,time).run();
  }
  return {id};
}
export async function upload(env:StudyEnv,request:Request) {
  await liveRun(env,request.headers.get('x-run-id'));
  const sourceId=request.headers.get('x-source-id')??'', digest=request.headers.get('x-file-hash')??'';
  if(!/^[a-f0-9]{64}$/.test(sourceId)||!/^[a-f0-9]{64}$/.test(digest))throw new NtuError('文件标识不正确。');
  const source=await env.DB.prepare('SELECT * FROM study_sources WHERE id=?').bind(sourceId).first<Source>();
  if(!source)throw new NtuError('资料不存在。');
  const ntu=await settings(env);if(!ntu.config.courseIds.includes(source.course_id))throw new NtuError('课程已取消关注。');
  const expected=Number(request.headers.get('content-length'));
  if(!expected||expected>MAX_FILE)throw new NtuError('文件需小于 25 MB。');
  const reader=request.body?.getReader();if(!reader)throw new NtuError('文件为空。');
  const chunks:Uint8Array[]=[];let length=0;
  for(;;){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>MAX_FILE){await reader.cancel();throw new NtuError('文件超过 25 MB。');}chunks.push(r.value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(actual!==digest||length!==expected)throw new NtuError('文件校验失败。');
  let filename:string;try{filename=decodeURIComponent(request.headers.get('x-file-name')??'file');}catch{throw new NtuError('文件名不正确。');}
  filename=filename.replace(/[\x00-\x1f/\\]/g,'_').slice(0,200);
  const id=await hash(`${sourceId}:${digest}`), objectKey=`private/study/${sourceId}/${digest}`;
  await env.MEDIA.put(objectKey,bytes.buffer,{httpMetadata:{contentType:'application/octet-stream'}});
  await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO study_versions(id,source_id,hash,object_key,filename,size,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,sourceId,digest,objectKey,filename,length,now()),
    env.DB.prepare('UPDATE study_sources SET version_id=?,checked_at=? WHERE id=?').bind(id,now(),sourceId),
  ]);
  const c=await config(env);
  const baseline=await env.DB.prepare('SELECT course_id FROM study_course_state WHERE course_id=?').bind(source.course_id).first();
  if(c.auto_analyze && baseline && source.kind!=='assignment' && /\.(pdf|pptx|txt|md)$/i.test(filename) && ntu.configured.glmKey)await enqueue(env,id);
  return {id};
}
export async function enqueue(env:StudyEnv,versionId:string) {
  const v=await env.DB.prepare('SELECT source_id FROM study_versions WHERE id=?').bind(versionId).first<{source_id:string}>();
  if(!v)throw new NtuError('先等待原文件下载完成。');
  const c=await config(env), ntu=await settings(env);
  if(!ntu.configured.glmKey)throw new NtuError('先在 NTU 通知中心配置智谱通用 API Key。');
  const model=c.model||ntu.config.model, id=await hash(`${versionId}:${PROCESSOR}:${model}`);
  await env.DB.prepare(`INSERT INTO automation_jobs(id,workflow,source_id,version_id,processor_version,model,created_at,updated_at) VALUES(?,'study',?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET status='pending',attempts=0,available_at=0,error=NULL,updated_at=excluded.updated_at WHERE automation_jobs.status IN ('failed','needs_ocr')`)
    .bind(id,v.source_id,versionId,PROCESSOR,model,now(),now()).run();
  return {id};
}
export async function claim(env:StudyEnv) {
  const c=await config(env);if(!c.enabled)return {job:null};
  const ntu=await settings(env);if(!ntu.configured.glmKey)return {job:null};
  await env.DB.prepare("UPDATE automation_jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'pending' END,lease_token=NULL,error='执行中断，等待重试' WHERE status='processing' AND lease_until<?").bind(Date.now()).run();
  const candidates=(await env.DB.prepare("SELECT j.*,s.course_id FROM automation_jobs j JOIN study_sources s ON s.id=j.source_id WHERE j.status='pending' AND j.available_at<=? ORDER BY j.created_at LIMIT 100").bind(Date.now()).all<Record<string,any>>()).results ?? [];
  const job=candidates.find(j=>ntu.config.courseIds.includes(j.course_id));if(!job)return {job:null};
  const token=crypto.randomUUID();
  // D1 batch is transactional: concurrent runners cannot overspend the daily allowance.
  const day=new Date(Math.floor((Date.now()+8*3600000)/86400000)*86400000-8*3600000).toISOString();
  const results=await env.DB.batch([
    env.DB.prepare("UPDATE automation_jobs SET status='processing',attempts=attempts+1,lease_token=?,lease_until=?,updated_at=? WHERE id=? AND status='pending' AND (SELECT COUNT(*) FROM study_attempts WHERE started_at>=?)<?").bind(token,Date.now()+30*60000,now(),job.id,day,c.daily_jobs),
    env.DB.prepare("INSERT INTO study_attempts(token,job_id,started_at) SELECT ?,id,? FROM automation_jobs WHERE id=? AND lease_token=?").bind(token,now(),job.id,token),
  ]);
  if(!results[0].meta.changes)return {job:null};
  const version=await env.DB.prepare('SELECT * FROM study_versions WHERE id=?').bind(job.version_id).first();
  const source=await env.DB.prepare('SELECT title,body FROM study_sources WHERE id=?').bind(job.source_id).first();
  return {job:{...job,lease_token:token},version,source};
}
export async function complete(env:StudyEnv,input:Record<string,any>) {
  const job=await env.DB.prepare("SELECT * FROM automation_jobs WHERE id=? AND lease_token=? AND status='processing' AND lease_until>?").bind(String(input.id),String(input.token),Date.now()).first<Record<string,any>>();
  if(!job)throw new NtuError('任务租约已过期。');
  if(input.action==='heartbeat') {
    await env.DB.prepare("UPDATE automation_jobs SET lease_until=? WHERE id=? AND lease_token=? AND status='processing'").bind(Date.now()+30*60000,job.id,input.token).run();return;
  }
  if(input.status==='completed') {
    if(typeof input.markdown!=='string'||input.markdown.length<50||input.markdown.length>500000)throw new NtuError('笔记格式或长度不正确。');
    await env.DB.batch([
      env.DB.prepare('INSERT OR REPLACE INTO study_notes(id,source_id,version_id,markdown,model,processor_version,usage,created_at) SELECT id,source_id,version_id,?,model,processor_version,?,? FROM automation_jobs WHERE id=? AND lease_token=? AND status=\'processing\'').bind(input.markdown,JSON.stringify(input.usage??{}).slice(0,20000),now(),job.id,input.token),
      env.DB.prepare("UPDATE automation_jobs SET status='completed',lease_token=NULL,lease_until=0,error=NULL,updated_at=? WHERE id=? AND lease_token=?").bind(now(),job.id,input.token),
    ]);
  } else {
    const status=input.status==='needs_ocr'?'needs_ocr':job.attempts>=3?'failed':'pending';
    await env.DB.prepare('UPDATE automation_jobs SET status=?,lease_token=NULL,lease_until=0,available_at=?,error=?,updated_at=? WHERE id=? AND lease_token=?')
      .bind(status,Date.now()+Math.min(60,5*2**job.attempts)*60000,String(input.error??'分析失败').slice(0,500),now(),job.id,input.token).run();
  }
}
export async function fileResponse(env:StudyEnv,versionId:string) {
  const version=await env.DB.prepare('SELECT object_key,filename,size FROM study_versions WHERE id=?').bind(versionId).first<{object_key:string;filename:string;size:number}>();
  if(!version)return new Response('Not found',{status:404});
  const file=await env.MEDIA.get(version.object_key);if(!file)return new Response('Not found',{status:404});
  return new Response(file.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(version.filename)}`,'Content-Length':String(version.size),'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
