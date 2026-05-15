# AI Validation Report

> **Status:** Template — populated by `scripts/validate-ai.mjs` after a real dataset is sourced and the harness is run against the live `/api/ai/classify` endpoint.
>
> Run with `npm run dev` in one shell and `node scripts/validate-ai.mjs` in another. The script will overwrite this file in place.

## Dataset

- **Source:** _to be filled by harness_ (xBD academic dataset OR Copernicus EMS Activations)
- **Photo count:** _N_
- **Severity distribution (ground truth):**
  - negligible: _N_
  - moderate: _N_
  - severe: _N_
  - destroyed: _N_

## Accuracy summary

| Metric | Value |
| --- | --- |
| Exact severity match | _N / N (NN%)_ |
| Near match (one tier off) | _N / N (NN%)_ |
| False positives (model said damaged, truth was negligible) | _N_ |
| False negatives (model said negligible, truth was severe/destroyed) | _N_ |
| Mean confidence overall | _0.NN_ |
| Mean confidence on matches | _0.NN_ |
| Mean confidence on misses | _0.NN_ |

## Confusion matrix

|  | predicted negligible | predicted moderate | predicted severe | predicted destroyed | predicted unknown |
| --- | --- | --- | --- | --- | --- |
| actual negligible | — | — | — | — | — |
| actual moderate | — | — | — | — | — |
| actual severe | — | — | — | — | — |
| actual destroyed | — | — | — | — | — |

## Assumptions

- Ground-level or near-ground-level photos only — Copernicus EMS top-down satellite imagery is excluded.
- Photos pre-compressed to ≤200 KB WebP (matching what a reporter's device sends).
- Ground-truth labels mapped to the Copernicus EMS 4-tier scale (`negligible` / `moderate` / `severe` / `destroyed`).

## Photo source attribution + license

_Filled by harness from the `source` field in `labels.json`._

## Notes

_Free-form observations from the validator run — e.g. which categories the model struggled with, whether confidence correlated with accuracy, qualitative reasoning quality samples._
