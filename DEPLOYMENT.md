# GitHub Pages

## Fly.io backend

The root `Dockerfile` builds the existing Express server and runs only its
compiled output as a non-root user. No database, volume, or application secret
is needed by the current API routes. `.dockerignore` limits the build context
and excludes local environment and credential files.

After signing in with `fly auth login`, create the app in your Fly organization
and deploy from the repository root:

```sh
fly apps create terapagos-evomon-api
fly deploy --remote-only --ha=false
node scripts/verify-api.mjs https://terapagos-evomon-api.fly.dev
```

The app name must be available and owned by your account. If you choose another
name, update `fly.toml` and the public `VITE_API_URL` accordingly. The Fly config
uses one shared CPU and 512 MB RAM in `iad`, HTTPS, a health check, and automatic
stop/start when idle. `--ha=false` avoids creating a second standby Machine.
Fly.io hosting is usage-billed; this configuration is not a guarantee of free
hosting. Stopping clears the six-hour in-memory wiki cache, so the first catalog
request after a cold start can take longer.

The `Verify Fly backend image` workflow builds the production container and
checks health, a nonempty catalog, skills, and CORS. This check uses live public
wiki data, so a wiki outage can fail it without a code change. Backend deployment
uses authenticated Fly tooling; no Fly token is stored in the repository.

The `Build and deploy Evomon to GitHub Pages` workflow builds the Vite frontend
on Ubuntu with Node 22 and pnpm 10. It installs the workspace using the frozen
lockfile, sets `PORT=3000` and `BASE_PATH=/Evomon-Pokedex/`, and publishes only
`artifacts/evomon-pokedex/dist/public`.

## Setup

1. In repository **Settings > Pages**, select **GitHub Actions** as the source.
2. Deploy the existing Express API separately (for example, on Fly.io).
   Pages cannot run `artifacts/api-server`. The local catalog is empty, so the
   API is required for catalog data and skills.
3. In **Settings > Secrets and variables > Actions > Variables**, create the
   repository variable `VITE_API_URL` with the public HTTPS backend origin,
   for example `https://your-app.fly.dev` (no `/api` suffix).
   The client adds `/api/evomon`. This URL is included in browser JavaScript:
   never put passwords, API tokens, or other secrets in this variable.
4. Merge the changes into `main`, or manually run the workflow on `main`.

Pull requests build and verify the site without deploying. Deployments require
`VITE_API_URL`; absent configuration fails explicitly instead of publishing an
empty catalog. Set this as a repository variable, not only an environment
variable, because the build job needs it before the deployment job starts.

The expected site is https://terapagos.github.io/Evomon-Pokedex/.
Verify the catalog, Skills, an Evomon detail page, and browser back/forward.
Opening or refreshing `/Evomon-Pokedex/skills` or an Evomon detail URL uses
the generated `404.html` app shell. GitHub Pages returns HTTP 404 for these
deep links, but the client renders the requested screen.

The API must allow requests from `https://terapagos.github.io`; the current
Express app enables CORS. Check `/api/healthz` and `/api/evomon` on the backend
and confirm that the browser can read the catalog response. No Fly.io token is
needed by the Pages workflow.

Replit keeps using same-origin `/api` requests when `VITE_API_URL` is unset.
Build for a root-hosted site with `BASE_PATH=/` instead of the Pages path.

## Build verification

On Linux (the lockfile deliberately excludes Windows native dependencies):

```sh
pnpm install --frozen-lockfile
PORT=3000 BASE_PATH=/Evomon-Pokedex/ pnpm --filter @workspace/evomon-pokedex build
cp artifacts/evomon-pokedex/dist/public/index.html artifacts/evomon-pokedex/dist/public/404.html
node scripts/verify-pages.mjs
```
