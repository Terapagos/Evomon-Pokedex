# Independent evomon site

Frontend: https://evomon.dat.place/

This repository owns this frontend and its deployment. Cloudflare serves only the frontend build directory specified in wrangler.json; private source, backend files and credentials are excluded. The Fly backend remains separate. bio is not involved in building or publishing this app.

Build and test using the repository's existing tools, then run wrangler deploy (Wrangler 4) with your existing Cloudflare login. Frontend CI publishes a downloadable build artifact without any Cloudflare credentials in GitHub. Automatic production deployments can be connected later with a deliberately scoped deployment credential.

The Cloudflare Worker also redirects the old dat.place/evomon address to this subdomain. Browser storage is isolated by subdomain: save any old browser-only keys or preferences before clearing dat.place storage. Backend records are preserved.

To restore old browser-specific keys/settings, open https://dat.place/evomon/__move in the browser that used the old site. The explicit two-tab transfer uses exact origins and approved per-app storage keys only; it does not send storage to a backend or put credentials in URLs.
