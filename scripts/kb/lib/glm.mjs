// scripts/kb/lib/glm.mjs — GLM chat client (OpenAI-compatible) for the KB pipeline.
// The API key is read at runtime from ~/.claude/settings.json (the user's own
// GLM quota, authorized for this project). It is NEVER logged or persisted.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const GLM_CHAT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

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
    const res = await fetch(GLM_CHAT_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GLM request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    try {
      return { parsed: JSON.parse(content), raw: content, model };
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`GLM returned invalid JSON after retries: ${String(lastError)}`);
}
