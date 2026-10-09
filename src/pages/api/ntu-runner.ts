import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { runnerAuthorized,runnerConfig,manifest,beginRun,liveRun,finishRun,upsertSource,upload,claim,complete,fileResponse,reply,type StudyEnv } from '../../server/study';
import {safeError} from '../../server/ntu/core';
const handle:APIRoute=async({request,url})=>{
  const e=env as unknown as StudyEnv;
  if(!await runnerAuthorized(e,request))return reply({error:'UNAUTHORIZED'},401);
  try {
    if(request.method==='GET') {
      if(url.searchParams.has('file'))return fileResponse(e,url.searchParams.get('file')!);
      if(url.searchParams.has('offset')){const n=Number(url.searchParams.get('offset'));if(!Number.isInteger(n)||n<0||n>100000)return reply({error:'BAD_OFFSET'},400);return reply(await manifest(e,n));}
      return reply(await runnerConfig(e));
    }
    if(request.headers.get('content-type')==='application/octet-stream')return reply(await upload(e,request));
    if(Number(request.headers.get('content-length'))>2000000)return reply({error:'TOO_LARGE'},413);
    const raw=await request.text();if(raw.length>700000)return reply({error:'TOO_LARGE'},413);
    const body=JSON.parse(raw);
    switch(body.action){
      case 'begin':return reply(await beginRun(e));
      case 'ping':await liveRun(e,body.runId);break;
      case 'finish':await finishRun(e,body);break;
      case 'source':return reply(await upsertSource(e,body));
      case 'claim':return reply(await claim(e));
      case 'heartbeat':case 'complete':await complete(e,body);break;
      default:return reply({error:'UNKNOWN_ACTION'},400);
    }
    return reply({ok:true});
  }catch(error){return reply({error:safeError(error)},400);}
};
export const GET=handle;
export const POST=handle;
