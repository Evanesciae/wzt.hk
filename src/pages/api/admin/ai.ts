import type { APIRoute } from 'astro';
import { AiNotConfiguredError, aiExpand, aiPolish, aiTitleSummary, aiTripPlan } from '../../../server/ai';

export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, any>;
  try { body = await request.json(); } catch { return Response.json({ error: 'BAD_REQUEST' }, { status: 400 }); }
  const task = body.task;
  try {
    if (task === 'polish') return Response.json({ text: await aiPolish(String(body.text ?? ''), body.strict) });
    if (task === 'expand') return Response.json({ text: await aiExpand(String(body.text ?? ''), body.strict) });
    if (task === 'title-summary') return Response.json(await aiTitleSummary(String(body.text ?? '')));
    if (task === 'trip-plan') return Response.json({ plan: await aiTripPlan({
      outline: String(body.text ?? ''), destination: body.destination, startDate: body.startDate, endDate: body.endDate,
    }) });
    return Response.json({ error: 'UNKNOWN_TASK' }, { status: 422 });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return Response.json({ error: 'AI_NOT_CONFIGURED' }, { status: 503 });
    console.error(error);
    return Response.json({ error: 'AI_FAILED' }, { status: 500 });
  }
};
