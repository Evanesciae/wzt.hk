import type {APIRoute} from 'astro';
import {env} from 'cloudflare:workers';
import {authorized,tick,report,putFrame,type BrowserEnv} from '../../server/ntu/browser';
import {reply} from '../../server/study';
import {safeError} from '../../server/ntu/core';
const handle:APIRoute=async({request})=>{
  const e=env as unknown as BrowserEnv;if(!await authorized(e,request))return reply({error:'UNAUTHORIZED'},401);
  try{
    if(request.method==='GET')return reply(await tick(e));
    if(request.headers.get('content-type')==='image/jpeg')return reply(await putFrame(e,request));
    const raw=await request.text();if(raw.length>12000)return reply({error:'TOO_LARGE'},413);
    return reply(await report(e,JSON.parse(raw)));
  }catch(error){return reply({error:safeError(error)},400);}
};
export const GET=handle;
export const POST=handle;
