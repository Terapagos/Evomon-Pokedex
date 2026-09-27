# GitHub Pages

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
