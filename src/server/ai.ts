// DeepSeek (OpenAI-compatible) AI proxy client. Key stays server-side only.
// Model-agnostic via env: AI_API_KEY / AI_BASE_URL / AI_MODEL.

const AI_API_KEY = process.env.AI_API_KEY;
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

export class AiNotConfiguredError extends Error {}

interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

async function aiChat(messages: ChatMessage[], options: { json?: boolean } = {}): Promise<string> {
  if (!AI_API_KEY) throw new AiNotConfiguredError('AI_NOT_CONFIGURED');
  const res = await fetch(`${AI_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify({
      model: AI_MODEL, messages,
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`AI_REQUEST_FAILED (${res.status})`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

const STRICT_PROMPT = '你是严谨的笔记助手。只能整理、润色用户已有内容、改写表达；不得新增用户未提供的事实、数据或细节；不得臆造；不确定处标注「（待核实）」；保留所有技术细节与术语。';
const LOOSE_PROMPT = '你是写作助手。可润色、扩写、补充衔接与过渡，风格自然轻松；可合理展开但保持与原意一致。';

function modePrompt(strict?: boolean) { return strict ? STRICT_PROMPT : LOOSE_PROMPT; }

export async function aiPolish(text: string, strict?: boolean) {
  return aiChat([
    { role: 'system', content: modePrompt(strict) },
    { role: 'user', content: `润色以下内容，使其更通顺精炼，保留原意与结构。只输出完整正文（Markdown），不要解释：\n\n${text}` },
  ]);
}

export async function aiExpand(text: string, strict?: boolean) {
  return aiChat([
    { role: 'system', content: modePrompt(strict) },
    { role: 'user', content: `扩写以下内容，把要点展开成段落，补充必要衔接。只输出完整正文（Markdown），不要解释：\n\n${text}` },
  ]);
}

export async function aiTitleSummary(text: string): Promise<{ title: string; summary: string }> {
  const raw = await aiChat([
    { role: 'system', content: '你为内容生成标题和摘要。输出 JSON：{"title":"简短标题(不含书名号)","summary":"一句话摘要"}。' },
    { role: 'user', content: `内容：\n\n${text}` },
  ], { json: true });
  try {
    const parsed = JSON.parse(raw) as { title?: string; summary?: string };
    return { title: String(parsed.title ?? ''), summary: String(parsed.summary ?? '') };
  } catch { throw new Error('AI_BAD_JSON'); }
}

export interface TripPlanEvent { type: string; title: string; time?: string; note?: string; placeName?: string }
export interface TripPlanDay { date: string; city: string; title?: string; events: TripPlanEvent[] }
export interface TripPlan { title: string; summary: string; days: TripPlanDay[] }

export async function aiTripPlan(input: { outline: string; destination?: string; startDate?: string; endDate?: string }): Promise<TripPlan> {
  const schema = '{"title":string,"summary":string,"days":[{"date":"YYYY-MM-DD","city":string,"title"?:string,"events":[{"type":"place|transit|meal|stay|note","title":string,"time"?:\"HH:MM","note"?:string,"placeName"?:string}]}]}';
  const sys = `你是旅行计划助手。根据用户提纲生成结构化旅行计划。只基于提纲内容，不要臆造未提及的景点或事实；可合理补充时间安排。输出 JSON，schema：${schema}。日期必须在给定区间内、每天一条；placeName 仅当事件有地点时填（用于地理编码），不要给坐标。`;
  const user = `目的地：${input.destination ?? '未指定'}\n日期：${input.startDate ?? '未指定'} ~ ${input.endDate ?? '未指定'}\n提纲：\n${input.outline}`;
  const raw = await aiChat([{ role: 'system', content: sys }, { role: 'user', content: user }], { json: true });
  try { return JSON.parse(raw) as TripPlan; } catch { throw new Error('AI_BAD_JSON'); }
}
