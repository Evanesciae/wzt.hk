# NTU initial deployment — 2026-10-09

Implemented against current main `46783b7`; preserves the existing site, D1, R2, admin authentication and notification infrastructure. PR: https://github.com/Evanesciae/wzt.hk/pull/4.

## Online state

- Website version initially deployed: `369dbee7-8d67-4072-9075-4ffd1af65d8f`, source `199b4e6` (later changes to runner logging/CI/documentation do not alter website behavior).
- Previous production version: `d2043698-15c7-426a-b6b8-5520a76ac265`.
- Additive migration `0016_study_pipeline.sql` applied successfully. Existing NTU migration 0015 was already present.
- Pre-change D1 export: protected `/var/backups/wzt-site/pre-study-20261009.sql` on the VPS. Do not put database exports in Git.
- VPS container `wzt-ntu-runner` is healthy, without exposed ports; 768 MB / 0.75 CPU limit, restart enabled, zero restarts at acceptance check. Its authenticated website connection returned 200.
- Public home, knowledge and travel pages returned 200. Anonymous private-page access redirects to login; private file and runner endpoints return 401. Private API responses carry no-store.
- Settings remain disabled, no courses selected, no school Cookie or GLM key configured. No school downloads or paid model calls have been performed. This is a deployed foundation awaiting account connection, not a claim of live course acceptance.

## User steps

1. At https://wzt.hk/admin/ntu, save the BbRouter Cookie and select courses. Telegram credentials and announcement enable settings are optional on that same page.
2. At https://wzt.hk/admin/study, enable server synchronization. Allow the first pass to import historical material quietly.
3. For analysis, enter an eligible GLM general API key and model, then manually queue one course file first. Review notes before enabling automatic analysis. Default limit is 2 file-analysis attempts per Singapore day.

Secrets belong in the site's protected form, not in a chat, issue or repository. Muse configuration is out of scope.

## Verification

13 Node tests and 7 Python tests passed. Astro check reports 0 errors (2 pre-existing pasteboard deprecation hints); production build succeeds. Real local login, CSRF rejection, settings save, private pages, sanitized Markdown and mathematical typesetting were checked with synthetic data, including a browser visual check. GitHub CI also passed before deployment follow-up changes; CI now includes the Python suite.

Compatible dependency security fixes applied; Astro resolved to 7.3.8. `npm audit` still reports the existing MapLibre sanitizer advisory, whose fix requires a major version upgrade. The site's map popups use `setText`; no `setHTML` call was found in the app. Track the upgrade separately; the dependency is not claimed vulnerability-free.

See `services/ntu-runner/README.md` for recovery, quota semantics, limits (25 MB, 300 pages, text-only extraction), and follow-up work: live account acceptance, reliable assignment deadline association, OCR/diagrams, independent outage detection and private search. The original public knowledge base is unchanged.
