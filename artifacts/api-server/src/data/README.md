# Maintained move supplement

`replit-move-supplement.json` restores moves from the repository owner's Replit
reference catalog, captured at the timestamp stored in the file. It contains
84 move definitions and 323 missing move/level assignments across 60 Evomon.
It stores public game data only, not the Replit session URL or credentials.

The published backend previously combined live wiki links with incomplete
supplemental learnsets. The Replit reference contained additional maintained
late-level and unique moves that were not in the GitHub source. For example,
Bubble's levels 60 through 140 were absent from the published catalog.

This is an additive supplement, not a replacement catalog. Existing live wiki
moves, stats, traits, and evolution lines are retained. The server merges by
Evomon name, move name, unlock level, and ultimate/regular slot after evolution
inheritance; `basic` and `level` are treated as the same regular slot to avoid
duplicates if the wiki adds a maintained move later. Live definitions win when
that exact assignment already exists.

When updating from Replit, compare every reference assignment against the live
API, review any new definitions and assignments, and update this file. Do not
make production depend on a temporary Replit development URL.
`scripts/verify-api.mjs` checks every restored assignment against the running API
as part of the production container test, including a 256 MB memory limit.
