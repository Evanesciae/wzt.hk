import type {APIRoute} from 'astro';
import {env} from 'cloudflare:workers';
import {reply,type StudyEnv,type Source} from '../../../../../server/study';
export const GET:APIRoute=async({params,locals})=>{
  if(!locals.adminSession)return reply({error:'UNAUTHORIZED'},401);
  const s=await (env as unknown as StudyEnv).DB.prepare('SELECT * FROM study_sources WHERE id=?').bind(params.id??'').first<Source>();
  if(!s?.due_at)return reply({error:'没有明确截止时间。'},404);
  const esc=(v:string)=>v.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const time=(v:string)=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//wzt.hk//Study//ZH','BEGIN:VEVENT',`UID:${s.id}@wzt.hk`,`DTSTAMP:${time(new Date().toISOString())}`,`DTSTART:${time(s.due_at)}`,`SUMMARY:${esc(s.title)} 截止`,`DESCRIPTION:${esc(s.body.slice(0,1000))}`,`URL:https://wzt.hk/admin/study/${s.id}`,'END:VEVENT','END:VCALENDAR'];
  return new Response(lines.join('\r\n')+'\r\n',{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="assignment.ics"','Cache-Control':'private, no-store','CDN-Cache-Control':'no-store'}});
};
