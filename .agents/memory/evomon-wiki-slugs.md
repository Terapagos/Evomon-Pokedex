---
name: Evomon Wiki page slugs
description: The public catalog IDs are not reliably the same as individual Evomon Wiki page URLs.
---

Use a normalized creature name to fetch a Wiki detail page instead of the catalog's internal ID, which may be an asset-style identifier such as `evomon-003`.

**Why:** The public detail pages resolve by creature name (for example, `bubblade`), while some catalog IDs do not resolve as Wiki URLs. Fetching by internal ID silently loses detail-only data, especially shiny stats and evolution lines.

**How to apply:** Keep the internal ID for application routing and identity, but derive a URL-safe, lowercase name slug when calling or linking to the Evomon Wiki.