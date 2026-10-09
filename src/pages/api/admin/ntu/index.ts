import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { overview, runSync, saveSettings, testIntegration, type NtuEnv } from '../../../../server/ntu/service';
import { safeError } from '../../../../server/ntu/core';
const bindings = () => env as unknown as NtuEnv;
const reply = (data:unknown,status=200) => Response.json(data,{status,headers:{'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store'}});
export const GET: APIRoute = async ({locals}) => {
  if(!locals.adminSession) return reply({error:'请先登录管理中心。'},401);
  try {return reply(await overview(bindings()));} catch(e) {return reply({error:safeError(e)},503);}
};
export const POST: APIRoute = async ({request,locals}) => {
  if(!locals.adminSession) return reply({error:'请先登录管理中心。'},401);
  try {
    const raw=await request.text(); if(raw.length>30000)return reply({error:'提交内容过长。'},413);
    const body=JSON.parse(raw);
    if(body.action==='save') return reply(await saveSettings(bindings(),body));
    if(body.action==='sync') return reply(await runSync(bindings(),true));
    if(body.action==='read' && typeof body.id==='string') {
      await bindings().DB.prepare('UPDATE ntu_items SET read_at=? WHERE id=?').bind(new Date().toISOString(),body.id).run();return reply({message:'已标记为已读。'});
    }
    if(body.action==='retry-ai') {
      await bindings().DB.prepare("UPDATE ntu_items SET ai_status='pending' WHERE ai_status='failed'").run(); return reply({message:'已安排重新生成，将在下一次同步时执行。'});
    }
    return reply(await testIntegration(bindings(),body.action));
  } catch(e) {return reply({error:e instanceof SyntaxError?'请求格式不正确。':safeError(e)},400);}
};
