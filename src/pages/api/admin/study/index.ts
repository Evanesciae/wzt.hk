import type { APIRoute } from 'astro';
import {env} from 'cloudflare:workers';
import {saveConfig,enqueue,reply,type StudyEnv} from '../../../../server/study';
import {safeError} from '../../../../server/ntu/core';
export const POST:APIRoute=async({request,locals})=>{
  if(!locals.adminSession)return reply({error:'UNAUTHORIZED'},401);
  try{
    const raw=await request.text();if(raw.length>5000)return reply({error:'TOO_LARGE'},413);
    const body=JSON.parse(raw),e=env as unknown as StudyEnv;
    if(body.action==='save')await saveConfig(e,body);
    else if(body.action==='analyze'&&typeof body.versionId==='string')return reply(await enqueue(e,body.versionId));
    else return reply({error:'操作不正确。'},400);
    return reply({ok:true});
  }catch(error){return reply({error:safeError(error)},400);}
};
