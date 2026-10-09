import type {APIRoute} from 'astro';
import {env} from 'cloudflare:workers';
import {fileResponse,reply,type StudyEnv} from '../../../../../server/study';
export const GET:APIRoute=async({params,locals})=>locals.adminSession?fileResponse(env as unknown as StudyEnv,params.id??''):reply({error:'UNAUTHORIZED'},401);
