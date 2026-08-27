---
name: Evomon Wiki page slugs
description: The public catalog IDs are not reliably the same as individual Evomon Wiki page URLs.
---

Use a normalized creature name slug for both Wiki detail pages and the traits index; do not join trait assignments using the catalog's internal ID, which may be an asset-style identifier such as `evomon-003`.

**Why:** The public detail pages and `/traits` monster index resolve by creature name (for example, `bubblade`), while some catalog IDs do not resolve as Wiki URLs. Joining by internal ID silently loses detail-only data, especially shiny stats, evolution lines, and legendary traits.

**How to apply:** Keep the internal ID for application routing and identity, but derive a URL-safe, lowercase name slug when calling or linking to the Evomon Wiki or joining source indexes. Use the internal ID only as a compatibility fallback. If one evolution member has a recorded legendary trait, apply it to the full evolution line.