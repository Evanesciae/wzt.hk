# Cloudflare deployment

The application runs on Cloudflare Workers. Runtime data is split across:

- D1 (`DB`) for trips, knowledge-base entries, flights, cities, users, and sessions.
- R2 (`MEDIA`) for original photos.
- Cloudflare Images (`IMAGES`) for on-demand responsive WebP variants.
- Workers KV (`SESSION`) for Astro session support.

The current preview resources are declared in `wrangler.jsonc`. They are intentionally separate from the production domain.

## Release flow

Develop continuously; the site does not need to be “finished” before deployment.

1. Work on a feature branch and run `npm run check && npm run build`.
2. Deploy to the preview Worker with `npm run cf:deploy`.
3. Review the preview URL.
4. Merge the reviewed branch to `main`.
5. Deploy the reviewed commit, then attach the production domain only when it is ready.

GitHub stores source code and migration files. D1 and R2 remain the runtime source of truth and must be backed up separately.

## First-time setup

Authenticate and create the Cloudflare resources:

```bash
npx wrangler login
npx wrangler d1 create wzt-hk-preview
npx wrangler r2 bucket create wzt-hk-media-preview
```

Copy the returned D1 database ID into `wrangler.jsonc`, then apply the schema:

```bash
npm run cf:migrate:remote
```

For an existing SQLite database, export a D1-compatible data-only SQL file and import it with:

```bash
npx wrangler d1 execute DB --remote --file=/path/to/data.sql
```

Upload the existing originals once:

```bash
npm run cf:upload-media
```

The upload script only sends `data/media/originals/`. Legacy thumbnails are generated from the originals on demand.

## Secrets

Set a Workers-compatible password hash without exposing the password in shell history:

```bash
npm run cf:set-admin-password
```

Optional integrations should also be stored as secrets, never committed:

```bash
npx wrangler secret put AI_API_KEY
npx wrangler secret put AVIATIONSTACK_API_KEY
```

Non-secret settings such as `ADMIN_USERNAME`, `APP_TIME_ZONE`, `AI_BASE_URL`, and `AI_MODEL` can be declared under `vars` in `wrangler.jsonc`.

## Local Cloudflare development

Apply the local D1 migration and start Wrangler:

```bash
npm run cf:migrate:local
npm run cf:dev
```

Local runtime secrets belong in `.dev.vars`, which is ignored by Git.

## Deploy and verify

```bash
npm run check
npm run build
npm run cf:deploy
```

Verify the public pages, `/admin/login`, one D1-backed detail page, and at least one `/media/` image after every migration.

## GitHub

`.github/workflows/ci.yml` validates every pull request and push to `main`. Keep deployment manual until the preview is approved. After that, connect the Worker to the GitHub repository from Cloudflare Workers → Settings → Builds, using:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`
- Production branch: `main`

Do not connect automatic deployment while `main` still contains the previous Node/SQLite implementation.

## Backups

Export D1 regularly:

```bash
npx wrangler d1 export DB --remote --output=backups/wzt-d1.sql
```

Keep an independent copy of the R2 originals. Test restoring both the D1 export and a sample of R2 objects before switching the production domain.
