# wzt.hk

Personal website for notes, travel logs, flights, cities, links, and small private tools.

Built with Astro and deployed to Cloudflare Workers. Runtime data lives in Cloudflare D1, media in R2, and sessions in KV.

## Development

```bash
npm install
npm run cf:migrate:local
npm run cf:dev
```

Before pushing:

```bash
npm run check
npm run build
```

## Data

Cloudflare D1 and R2 are the production source of truth. Git stores application code and reviewed migrations only; local database or media snapshots must not overwrite production data.

## Deployment

Pushing to `main` triggers the Cloudflare build. Database migrations are reviewed and applied separately.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for operational details.
