import {hash,NtuError} from './ntu/core';
import {MAX_FILE,type StudyEnv} from './study';
export interface Folder {id:string;course_id:string;parent_id:string|null;name:string}
const now=()=>new Date().toISOString();
export function name(value:unknown){
  if(typeof value!=='string'||!value.trim()||value.trim().length>180||/[\x00-\x1f/\\]/.test(value)||['.','..'].includes(value.trim()))throw new NtuError('名称需为 1–180 个字符，不能包含斜杠。');
  return value.trim().normalize('NFC');
}
export async function destination(e:StudyEnv,course:unknown,folder:unknown){
  if(typeof course!=='string'||!await e.DB.prepare('SELECT id FROM ntu_courses WHERE id=?').bind(course).first())throw new NtuError('课程不存在。');
  const id=typeof folder==='string'&&folder?folder:null;
  if(id&&!await e.DB.prepare('SELECT id FROM study_folders WHERE id=? AND course_id=?').bind(id,course).first())throw new NtuError('文件夹不属于此课程。');
  return {courseId:course,folderId:id};
}
export async function libraryAction(e:StudyEnv,b:Record<string,any>){
  if(b.action==='create-course'){
    const title=name(b.name),code=name(b.code||title),id='local:'+crypto.randomUUID();
    await e.DB.batch([
      e.DB.prepare('INSERT INTO ntu_courses(id,name,code,updated_at) VALUES(?,?,?,?)').bind(id,title,code,now()),
      ...[['materials','课件'],['assignments','作业'],['references','参考资料']].map(([slug,label])=>e.DB.prepare('INSERT INTO study_folders(id,course_id,parent_id,name,created_at) VALUES(?,?,NULL,?,?)').bind(`default:${id}:${slug}`,id,label,now())),
    ]);return {id};
  }
  const d=await destination(e,b.courseId,b.folderId);
  if(b.action==='create-folder'){
    const title=name(b.name),id=crypto.randomUUID();let parent=d.folderId,depth=0;
    while(parent){if(++depth>=12)throw new NtuError('文件夹最多支持 12 层。');const f=await e.DB.prepare('SELECT parent_id FROM study_folders WHERE id=?').bind(parent).first<Folder>();parent=f?.parent_id??null;}
    const r=await e.DB.prepare('INSERT OR IGNORE INTO study_folders(id,course_id,parent_id,name,created_at) VALUES(?,?,?,?,?)').bind(id,d.courseId,d.folderId,title,now()).run();
    if(!r.meta.changes)throw new NtuError('当前目录已有同名文件夹。');return {id};
  }
  if(b.action==='move-file'){
    const source=await e.DB.prepare('SELECT title,origin FROM study_sources WHERE id=? AND course_id=?').bind(String(b.id),d.courseId).first<{title:string;origin:string}>();
    if(!source)throw new NtuError('文件不存在或属于另一门课程。');
    if(source.origin==='upload'&&await e.DB.prepare("SELECT id FROM study_sources WHERE course_id=? AND folder_id IS ? AND title=? AND origin='upload' AND id!=?").bind(d.courseId,d.folderId,source.title,String(b.id)).first())throw new NtuError('目标文件夹已有同名文件。');
    await e.DB.prepare('UPDATE study_sources SET folder_id=?,updated_at=? WHERE id=? AND course_id=?').bind(d.folderId,now(),String(b.id),d.courseId).run();return {ok:true};
  }
  throw new NtuError('操作不正确。');
}
export async function manualUpload(e:StudyEnv,r:Request){
  const d=await destination(e,r.headers.get('x-course-id'),r.headers.get('x-folder-id'));
  let filename:string;try{filename=name(decodeURIComponent(r.headers.get('x-file-name')??''));}catch{throw new NtuError('文件名不正确。');}
  const expected=Number(r.headers.get('content-length'));
  if(expected>MAX_FILE)throw new NtuError('单个文件不能超过 25 MB。');
  const reader=r.body?.getReader();if(!reader)throw new NtuError('文件为空。');
  const chunks:Uint8Array[]=[];let length=0;
  for(;;){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>MAX_FILE){await reader.cancel();throw new NtuError('单个文件不能超过 25 MB。');}chunks.push(part.value);}
  if(!length||(expected&&expected!==length))throw new NtuError('文件为空或传输不完整。');
  const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const old=await e.DB.prepare("SELECT id,version_id FROM study_sources WHERE course_id=? AND folder_id IS ? AND title=? AND origin='upload'").bind(d.courseId,d.folderId,filename).first<{id:string;version_id:string}>();
  const sid=old?.id??await hash(`upload:${d.courseId}:${d.folderId??''}:${filename}`);
  const occupied=!old&&await e.DB.prepare('SELECT id FROM study_sources WHERE id=?').bind(sid).first();
  const sourceId=occupied?await hash(crypto.randomUUID()):sid;
  const id=await hash(`${sourceId}:${digest}`),key=`private/study/${sourceId}/${digest}`,time=now();
  await e.MEDIA.put(key,bytes.buffer,{httpMetadata:{contentType:'application/octet-stream'}});
  await e.DB.batch([
    e.DB.prepare(`INSERT INTO study_sources(id,course_id,content_id,title,kind,source_url,body,fingerprint,checked_at,version_id,created_at,updated_at,folder_id,origin)
      VALUES(?,?,?,?,'material','','',?,?,?,?,?,?,'upload')
      ON CONFLICT(id) DO UPDATE SET fingerprint=excluded.fingerprint,checked_at=excluded.checked_at,version_id=excluded.version_id,updated_at=excluded.updated_at`).bind(sourceId,d.courseId,'upload:'+sourceId,filename,digest,time,id,time,time,d.folderId),
    e.DB.prepare('INSERT OR IGNORE INTO study_versions(id,source_id,hash,object_key,filename,size,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,sourceId,digest,key,filename,length,time),
  ]);
  return {id:sourceId,versionId:id,duplicate:old?.version_id===id};
}
