---
name: Evomon moves payload
description: Source-shape guidance for complete move definitions and Evomon unlock assignments.
---

Use the Moves page RSC component props as the authoritative join: `moves` contains definitions and `links` contains Evomon IDs, move names, slots, and unlock levels. Do not scrape the rendered learner chips.

**Why:** The page UI intentionally limits each move's visible learner chips, so HTML parsing can silently omit assignments even when the full link records are present in the RSC payload.

**How to apply:** Join each link to its move definition by exact move name and to the catalog by the source's pet ID. Preserve empty movesets when the Wiki has no link records rather than inferring moves.