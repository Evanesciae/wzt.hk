import type { APIRoute } from 'astro';
import {env} from 'cloudflare:workers';
import {browserStatus,control,getFrame,type BrowserEnv} from '../../../../server/ntu/browser';
import {reply} from '../../../../server/study';
import {safeError} from '../../../../server/ntu/core';
export const GET:APIRoute=async({locals,url})=>{
  if(!locals.adminSession)return reply({error:'UNAUTHORIZED'},401);
  const e=env as unknown as BrowserEnv;
  if(url.searchParams.has('frame'))return getFrame(e,url.searchParams.get('frame')!);
  return reply(await browserStatus(e));
};
export const POST:APIRoute=async({locals,request})=>{
  if(!locals.adminSession)return reply({error:'UNAUTHORIZED'},401);
  try{const raw=await request.text();if(raw.length>12000)return reply({error:'TOO_LARGE'},413);return reply(await control(env as unknown as BrowserEnv,JSON.parse(raw)));}
  catch(error){return reply({error:safeError(error)},400);}
};
