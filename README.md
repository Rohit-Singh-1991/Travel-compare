# PackCompare

PackCompare compares holiday packages across travel sites. This repository is the independent source of truth for development and deployment; Lovable is no longer used for development.

## Development

- Install [Bun](https://bun.sh/) or Node.js 20+.
- Install dependencies with `bun install` (or `npm install`).
- Run locally with `bun run dev`.
- Build with `bun run build`.

## Environment variables

Configure `FIRECRAWL_API_KEY` in the Vercel project environment settings. Do not commit secrets. See `.env.example` for the variable name.

## Deployment

Vercel project: `travel-compare`; connected repository: `Rohit-Singh-1991/Travel-compare`.
