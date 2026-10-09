# Private NTULearn runner

The website owns settings, state, leases, history and notes in its existing D1 database. Originals use `private/study/` in the existing R2 bucket. This single outbound-only Python container keeps versioned working copies; it does not run a second database or expose a port. Endpoint mapping is adapted from NTUlearn-agent; see LICENSE.

## Enable

1. Log in at `https://wzt.hk/admin/ntu`, save the NTULearn BbRouter Cookie, read courses, select the desired courses, and save. Do not paste credentials into chat or Git.
2. Telegram settings and announcement monitoring remain on that page. The course-file runner uses the same selected courses but has its own enable switch.
3. Open `https://wzt.hk/admin/study` and enable server synchronization. First import establishes a baseline without analyzing or announcing historical material.
4. Save a permitted **general API** GLM key in the NTU settings if analysis is wanted. A Coding Plan or a key accepted by an HTTP endpoint is not proof of permission for this use. Choose an available model. File analysis is separately opt-in, default off; historical files and assignments require a manual queue action.
5. Default quota: 2 analysis attempts per Singapore day, configurable 1–10. A file may require up to 12 model requests, each up to 7,000 output tokens. This is an execution limit, not a currency budget. Completed chunks are reused on retry.

## Operations

- Deployment directory: `/opt/wzt-ntu`; protected env: `/etc/wzt-ntu/runner.env` (root, 0600); working copies: `/var/lib/wzt-ntu` (uid 10001).
- Compose: `docker compose -f /opt/wzt-ntu/compose.yml ps`, `logs --tail=30`, `stop`, `up -d --build`.
- Limits: 768 MB RAM, 0.75 CPU, 64 processes, no privileges, read-only image, bounded logs, one worker. A 45-minute process watchdog exits wedged parsers so Docker can restart. Health status alone does not restart Docker containers.
- File max 25 MB; leaves at least 5 GB free. No automatic destructive cleanup. R2 originals and local working copies are redundant; local generated Markdown also retained. D1 history/notes require D1 backups/time travel; local files alone do not restore all state.
- A metadata change downloads a new version; unchanged metadata is rechecked weekly to detect silent binary replacements. Content hashes deduplicate files and jobs. Files deleted at the school are retained as an archive; deletion reconciliation is not implemented.
- Expired Cookie suspends school polling until the saved Cookie changes, including across container restarts. Update it through the website. Network failures retry on subsequent cycles. Jobs have leases, 3 attempts, exponential backoff, and a daily quota.
- Runner bearer token grants access only to this study workflow, including Cookie/GLM credentials while enabled and private study files. It is not a GitHub/Cloudflare/admin credential. To revoke it, change `NTU_RUNNER_TOKEN` on both Worker and VPS, then recreate the container. Website pause stops new work but a model request already in progress may finish.
- Notification delivery reuses the existing NTU outbox. Enable NTU Telegram and announcement scheduling for automatic delivery. A health issue queues at most one notice per UTC day. Server total outage detection is not yet independently monitored.

## Scope and verification limits

PDF, PPTX, TXT and Markdown text extraction; image-only or largely empty documents are held for OCR. There is no visual understanding/OCR service yet, no DOCX/PPT binary parser, no recordings transcription. Notes explicitly state text-only coverage and preserve source page numbers. Citation validation checks page membership, not factual accuracy.

School requests are restricted to HTTPS on `ntulearn.ntu.edu.sg`. External/CDN attachments are rejected rather than forwarding the Cookie. Blackboard deployments differ: actual account synchronization still needs a valid user Cookie and live acceptance test. The source `dueDate` is used only if supplied; otherwise the UI says unknown. Calendar events are handled by the existing notification workflow; a full gradebook-to-content deadline join is a follow-up.

Tests: `npm run test:ntu`; `python -m unittest discover -s services/ntu-runner -v`; `npm run check`; `npm run build`. Browser preview used synthetic private course data, real login/CSRF and rendered KaTeX. No real school downloads, paid GLM requests or Telegram test messages are implied by these checks.

## Rollback

Stop only `wzt-ntu-runner` with its Compose file. Roll the website back to the recorded pre-deployment Worker version. Migration 0016 is additive: leave its private tables in place when rolling back so new files/notes are not lost. Do not restore an old full database over newer website edits unless deliberate data recovery is required. Keep protected database backups outside Git.

## Next increments

First live course import and one manually selected analysis; deadline mapping from real school payloads; OCR and visual formulas; more visible server heartbeat and storage usage; search across private notes; optional upload for materials unavailable at the school. Muse and NAS integration are outside this initial setup.
