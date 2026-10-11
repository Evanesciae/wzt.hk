import type {APIRoute} from 'astro';
import {env} from 'cloudflare:workers';
import {manualUpload} from '../../../../server/study-library';
import {reply,type StudyEnv} from '../../../../server/study';
import {safeError} from '../../../../server/ntu/core';
export const POST:APIRoute=async({request,locals})=>{
  if(!locals.adminSession)return reply({error:'UNAUTHORIZED'},401);
  try{return reply(await manualUpload(env as unknown as StudyEnv,request));}
  catch(error){return reply({error:safeError(error)},400);}
};
