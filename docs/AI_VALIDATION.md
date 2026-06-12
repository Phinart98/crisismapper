# AI Validation

**Status: not yet run.** The validation harness is built and ready, but a
labeled photo dataset has not been assembled yet, so no accuracy figures exist.
We publish no accuracy number anywhere until this report contains one — the
landing page intentionally claims only what is verifiable today: every AI
suggestion is reviewed and confirmed or corrected by a human reporter before
submission.

## Why this exists

UNDP Q&A #15 encourages external datasets for model validation "provided they
include thorough documentation and a clear description of any underlying
assumptions." This document is where that validation lands when it runs, and
the assumptions below are fixed in advance so the methodology cannot drift to
fit the results.

## How to run it

The harness (`scripts/validate-ai.mjs`) plays a labeled photo set through the
real production endpoint (`/api/ai/classify`), including the EXIF strip,
compression bounds, and provider fallback chain, then overwrites this file
with the results.

1. Assemble 50 to 100 ground-level damage photos with known severity. Planned
   sources: the xBD dataset (Maxar building damage labels, academic license)
   and Copernicus EMS rapid mapping activations.
2. Place the photos in `data/damage-samples/` (gitignored) with a
   `labels.json`:

   ```json
   [
     { "filename": "img001.webp", "ground_truth_severity": "severe", "source": "xBD/hurricane-michael" },
     { "filename": "img002.jpg", "ground_truth_severity": "negligible", "source": "Copernicus EMS EMSR512" }
   ]
   ```

3. Run `npm run dev` in one shell and `node scripts/validate-ai.mjs` in
   another.

## What the report will contain

- Dataset description: source, photo count, ground-truth severity distribution.
- Accuracy summary: exact severity match, near match (one tier off), false
  positives and false negatives, and mean confidence overall versus on matches
  versus on misses (whether confidence is informative matters as much as raw
  accuracy).
- A full 4x5 confusion matrix across the predicted and actual tiers.
- Per-photo source attribution and license notes.

## Fixed assumptions

These hold regardless of results:

- Ground-level or near-ground photos only. Satellite top-down imagery is
  excluded: CrisisMapper is a ground-truth complement to satellite assessment,
  not a satellite classifier.
- Ground-truth labels are mapped to the 4-tier Copernicus EMS-aligned scale
  (`negligible` / `moderate` / `severe` / `destroyed`) before scoring.
- Photos are compressed to 200 KB WebP or less before classification, matching
  what a reporter's device actually sends. Scoring pristine full-resolution
  imagery would overstate field accuracy.
