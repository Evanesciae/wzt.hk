// scripts/kb/lib/glm.mjs — GLM chat client for the KB pipeline.
//
// Uses the Anthropic-compatible endpoint (open.bigmodel.cn/api/anthropic),
// which is covered by the user's Claude Code quota (lite plan).
// NOTE: the OpenAI-compatible paas/v4 endpoint is NOT used — it requires a
// separate paid balance (429 "余额不足" observed 2026-10-07).
//
// The API key is read at runtime from ~/.claude/settings.json (the user's own
// GLM quota, authorized for this project). It is NEVER logged or persisted.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const GLM_MESSAGES_URL = 'https://open.bigmodel.cn/api/anthropic/v1/messages';

function loadKey() {
  const settings = JSON.parse(
    readFileSync(join(homedir(), '.claude', 'settings.json'), 'utf8')
  );
  const key = settings?.env?.ANTHROPIC_AUTH_TOKEN;
  if (!key) throw new Error('GLM key not found in ~/.claude/settings.json');
  return key;
}

let cachedKey = null;
function apiKey() {
  if (!cachedKey) cachedKey = loadKey();
  return cachedKey;
}

/**
 * Call a GLM chat model, expecting a JSON object back.
 * Retries once on JSON parse failure.
 */
export async function glmJson({ model, system, user, maxRetries = 1 }) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(GLM_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey(),
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: 'user', content: user }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GLM request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = (data?.content ?? [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    try {
      return { parsed: JSON.parse(content), raw: content, model };
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`GLM returned invalid JSON after retries: ${String(lastError)}`);
}
