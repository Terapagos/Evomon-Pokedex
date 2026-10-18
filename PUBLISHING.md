# Publishing at dat.place/evomon

This repository owns the application source and the reviewed static release in
site/. The initial release is copied byte for byte from the existing dat.place
site, preserving appearance and public URLs.

Build with BASE_PATH=/evomon/ and VITE_API_URL=https://terapagos-evomon-api.fly.dev, then run scripts/prepare-dat-place.mjs; replace site/ with artifacts/evomon-pokedex/dist/public/.

Commit the updated site/ here, then run Publish dat.place from app repositories
in Terapagos/bio. That workflow publishes only site/, not private source or
backend data. The bio repository keeps the homepage and publishing workflow.

This supersedes older instructions to commit compiled files into bio. Keep the
/evomon/ asset base. Domain settings, browser data, and backend hosting are unchanged.
