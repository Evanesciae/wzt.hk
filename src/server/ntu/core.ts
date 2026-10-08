export const NTU_ORIGIN = 'https://ntulearn.ntu.edu.sg';
export interface Config {
  enabled: boolean; telegramEnabled: boolean; aiEnabled: boolean;
  interval: number; digestHour: number; mode: 'digest' | 'all'; reminder24: boolean;
  courseIds: string[]; chatId: string; model: string;
}
export const defaults: Config = {
  enabled: false, telegramEnabled: false, aiEnabled: false, interval: 30,
  digestHour: 21, mode: 'digest', reminder24: true, courseIds: [], chatId: '', model: 'glm-4.7-flash',
};
export class NtuError extends Error {}
export function validateConfig(value: unknown): Config {
  const c = value as Config;
  if (!c || typeof c !== 'object' || !['enabled','telegramEnabled','aiEnabled','reminder24'].every(k => typeof (c as unknown as Record<string, unknown>)[k] === 'boolean')
    || ![30,60,120].includes(c.interval) || !Number.isInteger(c.digestHour) || c.digestHour < 0 || c.digestHour > 23
    || !['digest','all'].includes(c.mode) || !Array.isArray(c.courseIds) || c.courseIds.length > 20
    || !c.courseIds.every(id => typeof id === 'string' && /^[\w.-]{1,100}$/.test(id))
    || typeof c.chatId !== 'string' || !/^-?\d{0,20}$/.test(c.chatId)
    || typeof c.model !== 'string' || !/^glm-[a-zA-Z0-9.-]{1,60}$/.test(c.model)) throw new NtuError('设置格式不正确。');
  return { enabled:c.enabled, telegramEnabled:c.telegramEnabled, aiEnabled:c.aiEnabled, interval:c.interval,
    digestHour:c.digestHour, mode:c.mode, reminder24:c.reminder24, courseIds:[...new Set(c.courseIds)], chatId:c.chatId, model:c.model };
}
export function plain(value: unknown): string {
  return String(value ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,'')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\n{3,}/g,'\n\n').trim().slice(0,30000);
}
export function important(text: string) { return /\b(exam|examination|quiz|test|midterm|mid-term|assessment|deadline|reschedul|cancel|venue|urgent)\w*\b|考试|测验|截止|改期|取消|地点变更/i.test(text); }
export function iso(value: unknown): string | null {
  if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
export function ntuURL(path: string): URL {
  const url = new URL(path, NTU_ORIGIN);
  if (url.origin !== NTU_ORIGIN || url.username || url.password || !url.pathname.startsWith('/learn/api/public/')) throw new NtuError('NTULearn 返回了不受信任的分页地址。');
  return url;
}
export async function hash(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2,'0')).join('');
}
export function safeError(error: unknown) { return error instanceof NtuError ? error.message : '服务暂时不可用，请稍后重试。'; }
export function singapore(date: string) { return new Date(date).toLocaleString('zh-CN',{timeZone:'Asia/Singapore',hour12:false}); }
export function reminderDue(due: string | null, now: number) { return !!due && Date.parse(due) > now && Date.parse(due) <= now + 86400000; }
