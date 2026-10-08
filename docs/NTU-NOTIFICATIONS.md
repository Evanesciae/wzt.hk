# NTU notification center

Private page: `/admin/ntu`. Uses the existing admin session and CSRF protection;
NTU routes require a real session even when `DISABLE_ADMIN_AUTH=true`.

## Setup

1. Log in to NTULearn, copy only the `BbRouter` cookie value, and use **保存并读取课程**.
2. Select current courses (up to 20).
3. Create a personal Telegram bot with BotFather. Send `/start` to that bot.
   Save its token, discover/select your own private chat, then send a test message.
4. Optionally provide a Zhipu **general API** key, choose a model available to the
   account, and test. Coding Plan subscription quotas are not assumed to apply.
   The endpoint is fixed to `https://open.bigmodel.cn/api/paas/v4/chat/completions`.
5. Enable Telegram notifications and automatic synchronization, then save.

Cookie, bot token, and GLM key are AES-256-GCM encrypted in D1, using the Worker
secret `NTU_ENCRYPTION_KEY` (32 random bytes, base64). Credentials are write-only
in the UI/API. Do not rotate this secret without decrypting and re-encrypting
stored credentials, or clear and re-enter all credentials afterwards. Never
store this key alongside D1 backups. No upstream error bodies are logged.

## Operation

Cloudflare cron runs every 15 minutes. Saved preferences gate sync to 30/60/120
minutes. Manual sync runs immediately. A D1 lease prevents overlapping syncs.
Schedules use Asia/Singapore; daily ordinary notifications are grouped and
released at the configured cutoff during the next sync. Important changes are
released after sync. Disabling auto-sync pauses automatic delivery as well.

The first complete fetch per course establishes a baseline without sending old
announcements. Subsequent content changes create transactional outbox records.
Calendar events within the next 24 hours generate one reminder per event/time.
Reminders require a successful current fetch; cancelled/missing calendar items
invalidate pending reminders. Calendar fetch covers yesterday to 120 days ahead.
Dates inferred from prose never schedule alarms. Other NTU exam systems and
attachments are not covered.

The Blackboard mapping follows Zhu-Qianyu/NTUlearn-agent, MIT license preserved
in `src/server/ntu/UPSTREAM-LICENSE`. Requests use the fixed NTULearn host,
reject redirects and off-origin pagination, and never send cookies to GLM.

AI processes up to five changed/pending items per run, validates its JSON output,
and retains source text. Failed summaries fall back to original notices; the UI
can queue failed summaries for another attempt. This setting also processes
historical items after first sync; API usage is billed by the provider.

Outbox entries are deduplicated by item/version and retried with backoff. Telegram
has no transactional idempotency key: if Telegram accepts a message but its reply
or the subsequent D1 write is lost, a retry may duplicate that message. Batches
are bounded to 15 sends/run. Login/feed failures alert at most once per UTC day,
and partial sync never advances the global last-success timestamp.

## Validation and deployment

- `npm run test:ntu`: SQLite-backed integration tests with mocked NTULearn,
  Telegram, and GLM; no private accounts or external messages involved.
- `npm run check` and `npm run build`.
- Apply `0015_ntu_notifications.sql` (new tables only).
- Provision `NTU_ENCRYPTION_KEY` as a Cloudflare Worker secret, then deploy.
- Verify `/admin/ntu` redirects unauthenticated users, `/api/admin/ntu` returns
  401/no-store, and unrelated public site routes still work.
- Real feed, Telegram delivery and GLM account access require the owner to enter
  their credentials and run the GUI connection tests. A deployed empty settings
  page does not imply these external services have been connected.

Rollback the Worker to the previous version if needed; the additive tables can
remain. Disable the cron separately if rolling back to a handler without a
scheduled export. Keep the encryption secret for a later redeployment.

## Initial release verification

This is a historical record, not the current deployment status. On 2026-10-08,
the main branch was deployed again without the NTU module. Its D1 tables and
encryption secret remain, but the settings and course tables are empty. The
`codex/ntu-bootstrap` branch restores this module on top of main commit
`46783b732ffa053faa30fe038a288454d2ebf2d2`; restoring the code does not connect
NTULearn, Telegram, or GLM until their credentials are configured and verified.

Deployed 2026-10-05 to `wzt.hk`, Worker version
`cc5c6a6e-c0cf-4816-88e8-b74435a501d6`. Cron schedule is every 15 minutes.
Remote migration and encryption secret were verified; no real account credentials
were populated. Homepage, login, travel, knowledge base, public meme page and a
D1-backed trip returned HTTP 200. The NTU page redirects to login and its API
returns 401 with `private, no-store` without a session. Local browser checks covered
login, empty-state desktop/mobile layouts and persisted settings; local HTTP checks
also covered CSRF rejection and credential save/clear without response disclosure.
