# NTULearn persistent browser

An outbound-only Playwright Chromium worker retains a dedicated NTULearn profile on the VPS. The existing website authenticates the administrator and relays short-lived click/type/key commands and screenshots. No VNC, debugging port, SSH port or browser port is published.

## Login and operation

Open `/admin/ntu/browser` from the school connection settings. Start a 20-minute interactive window, click the remote field, and send text using the form below the screenshot. Complete the school's login/MFA yourself. A successful authenticated `/users/me` request allows the worker to save BbRouter into the website's existing encrypted NTU settings without changing selected courses or other keys. Close the interactive window to retain background maintenance. Pause stops browser maintenance but preserves the profile; the file-sync toggle is separate.

Background checks run every ten minutes; on failure, at most one normal SSO navigation is attempted per thirty minutes. There is no automated password entry, CAPTCHA solving, MFA approval or promise of indefinite login. School maximum session age and SSO policy remain authoritative. Account-based acceptance and longevity need a real login and observation across the previous expiry window.

Commands are AES-GCM encrypted with session/id associated data, expire after 45 seconds, and are removed when claimed. Delivery is at-most-once, so an ambiguous network failure may require manually re-entering input. Expired encrypted commands are removed on the next worker poll. This is deletion from the active database, not a promise of erasure from provider backups. Only one login window is active; opening another invalidates the previous generation. Screenshots are private R2 objects, available only to authenticated admin requests during an active window, and removed on close/pause or the next post-expiry worker poll. Responses are not cacheable. Do not enable request-body tracing for these endpoints.

The browser navigates only to NTU and supported identity-provider domains; resource hosts are separately limited in browser.py. Unsupported SSO providers must be reviewed and added explicitly. A remote browser cannot use a local hardware passkey as if it were attached to the VPS; use a school-supported alternate MFA method if offered. Downloads remain the responsibility of the existing runner.

## Deployment

- `/opt/wzt-ntu-browser`: this directory, including Dockerfile, compose.yml and seccomp.json.
- `/etc/wzt-ntu/browser.env`: root-owned mode 0600, containing `WZT_SITE_URL=https://wzt.hk` and a random `NTU_BROWSER_TOKEN` of at least 32 characters. Set the same secret on the website Worker. This token is separate from NTU_RUNNER_TOKEN and cannot read course files or service secrets.
- `/var/lib/wzt-ntu-browser`: owned by uid/gid 10001, mode 0700, mounted at `/profile`. Contains the Chromium profile, mode-0600 session-cookie snapshot and heartbeat. Treat this entire directory as a credential; exclude it from Git, public backups and diagnostics.
- Apply additive migration 0017 before deploying the website.
- `docker compose build && docker compose up -d` starts the service. Chromium runs as non-root with its sandbox enabled, Docker's default capabilities removed, read-only image, bounded memory/CPU/PIDs, and an upstream seccomp profile allowing sandbox namespaces. Do not fix launch failures by disabling the sandbox or making the container privileged.
- `docker compose stop` is the reversible rollback. The previous website can still use manual Cookie entry. Keep migration 0017 and stored course files on rollback.
- Logs intentionally omit exception bodies, typed content and URLs. The process watchdog exits a wedged worker for Docker restart. Health status alone does not cause restart.

## Validation

`npm run test:ntu`, `npm run check`, `npm run build`, and `python -m unittest discover -s services/ntu-browser -v`. Browser tests use mocks and need only httpx. Runtime requires Python 3.12 and the pinned Playwright/browser version. Verify the actual login screen, command roundtrip, pause, restart persistence and successful account handoff separately.

`seccomp.json` is copied from Microsoft Playwright v1.63.0's `utils/docker/seccomp_profile.json` (Apache-2.0): https://github.com/microsoft/playwright/blob/v1.63.0/utils/docker/seccomp_profile.json .
