# 03 - Orchestration

The automation layer is a family of Make.com scenarios: an automated intake router, a manual fallback router, one tracker per property, and a retention job.

## Scenario family

| Scenario | Type | Trigger | Role |
|---|---|---|---|
| `SCN-ROUTER-AUTO` | Intake | Monthly, days 15–30 | Find the latest export mail, classify attachments, stage per property, call webhooks |
| `SCN-ROUTER-MANUAL` | Intake | Webhook | Reduced-coverage manual fallback (4 of 7 properties) |
| `SCN-A` … `SCN-E` | Tracker | Webhook from router | Standard-layout properties |
| `SCN-F`, `SCN-G` | Tracker | Scheduled, days 15–30 | Manual-upload properties, specialized export layouts |
| `SCN-RETENTION` | Support | Monthly, days 15–30 | Cap published model copies per property |

## The universal skeleton

All trackers share a module topology. Core module IDs mean the same thing in every property - but identical modules do not mean identical configuration. Every path, range, workbook name, and spreadsheet ID is property-specific.

| Step | Module | Operation |
|---:|---:|---|
| 1 | 13 | Trigger - webhook (routed family) or intake listing (manual family) |
| 2 | 2 | Set run timestamp |
| 3 | 3 | Locate the operating workbook in cloud storage |
| 4 | 4 | Capture workbook file ID |
| 5 | 5 | List intake folder |
| 6 | 6 | Download the export |
| 7 | 7 | Stage a copy to the working area - all subsequent reads target this copy |
| 8 | 37 | Read model month header row |
| 9 | 19 | Parse model header - pick the largest date serial |
| 10 | 20 | Read export month header - per-family range |
| 11 | 21 | Parse export header - three variants by export layout |
| 12 | *varies* | Reporting-cutoff guard - clamp or throw |
| 13 | 111 | Read the marker row |
| 14 | 110 | Locate the writable-region boundary |
| 15 | 23 | Decision logic - run mode and target column |
| 16 | 112 | Compute write-window start column |
| - | 120 | Branch: `NEW_MONTH` → build missing headers via batch |
| - | 28 | Batched read of mapping inputs |
| - | 29 | Map export values to model rows - three variants |
| - | 30 | Write - direct patch or batched patch |
| - | 49 | Download the updated model |
| - | 52 | Publish timestamped copy, no overwrite |
| - | 104–108 | Refresh reporting feed tabs |
| - | *varies* | Archive the processed export |

Because module identifiers are stable across the family, a defect report naming one is actionable on any property. That consistency is deliberate and worth the discipline it costs.

## Decision logic

Module 23 receives the guard's *effective* month and resolves the write target. It does not receive the raw parsed value.

```
month_gap = (export_year*12 + export_month) - (model_year*12 + model_month)

gap > 0   →  NEW_MONTH     target = model_col + gap
                            build all missing headers first
gap = 0   →  OVERWRITE     target = model_col
gap < 0   →  PRIOR_MONTH   target = model_col + gap     (i.e. leftward)
                            throw if that maps outside the valid region
```

`PRIOR_MONTH` handles late or replayed files. When an export is behind the model, it updates the corresponding historical month. Treating it as an overwrite of the current column can clear live data; see [case study 02](../case-studies/02-sparse-row-mapping-defect.md).

Worked examples:

| Model latest | Export month | Resolves to |
|---|---|---|
| July (col AD) | July | `OVERWRITE` at AD |
| July (col AD) | September | `NEW_MONTH` at AF, headers for Aug + Sep generated |
| July (col AD) | June | `PRIOR_MONTH` at AC |
| July (col AD) | November *(prior year)* | `PRIOR_MONTH` at V |

## The reporting-cutoff guard

Property management systems sometimes emit headers for months that have not closed - a future-dated column with no meaningful data behind it. Writing that into the model creates a phantom month that propagates into every downstream chart.

The guard sits immediately after header parsing and before decisioning. It computes a business date in a fixed timezone and clamps:

```
days 1–14         → allow at most the month two months back
days 15–month-end → allow at most the previous month
```

If the parsed export month exceeds the cutoff, the guard walks back to the latest valid month at or below it. If no valid month exists in the export, it throws rather than writing.

Each property's guard preserves that property's own header-parsing dialect - the guard re-parses using the same rules as its upstream parser, rather than assuming a shared format. Three parser variants exist across the family:

| Family | Layout | Parsing rule |
|---|---|---|
| Standard (5) | Two-token `Mmm YYYY` | Exact split, skip subtotal rows, column offset from a fixed base |
| Specialized T-12 (1) | `Mmm YYYY` with suffixes | Tolerant regex, allows trailing qualifiers, excludes adjusted totals |
| Specialized IS (1) | Abbreviated *or* full month names | Regex accepting both, excludes total/YTD/annual/budget columns |

## Mapping

Values are matched by normalized category code, never by row position. This is what makes the family reusable across properties whose models differ in height and row order.

Three mapper variants:

Standard (5 properties) - normalized exact code match; duplicate codes summed; a non-blank code with no match writes `0`; blank-code rows preserved untouched. The mapper derives its width from the authoritative model patch width and requires the maximum export row width to match it. Sparse rows are padded rather than trusted.

Specialized T-12 (1 property) - key is `code|normalized_label`, requiring *both* to match. No code-only fallback, because duplicate codes legitimately appear on subtotal and header rows. Five explicit label aliases handle known upstream naming drift; new aliases are added one at a time after verifying both sides. Strict dimension assertions on both blocks.

Specialized IS (1 property) - code match first, with label fallback only when the model's code cell is blank. Label normalization expands ampersands and removes punctuation, with nine explicit aliases. If no match is found, the existing cell is preserved instead of being set to zero.

That last divergence is worth calling out. Two mappers in the same family have opposite no-match semantics because the underlying models mean different things by an absent row. Normalizing them to a single behavior would be a regression, and the reference documentation says so explicitly to prevent a well-meaning future cleanup.

## Batched reads and the subresponse trap

Mapping inputs are fetched in a single batched Graph call rather than sequential requests - fewer operations, and the reads are consistent with each other.

The batch envelope can return HTTP 200 when individual subrequests fail. Early versions used a permissive accessor that returned an empty array for a missing subresponse, which allowed mapping to continue after a partial failure.

The hardened pattern:

```
1. Assert every subresponse is present
2. Assert every subresponse status is < 400
3. Assert block dimensions match expected row counts exactly
4. Assert per-row widths
5. Only then map
```

Two scenarios throw on any violation. The remaining five reject width mismatches. Porting the full pattern across the family is tracked as open work.

## Write strategies

| Strategy | Used by | Mechanism |
|---|---|---|
| Direct patch | 5 standard properties | Single range write of mapped values |
| Batched patch | 2 specialized properties | Values write plus dependent formula rewrites |

One property's model has protected formula rows inside the write window - subtotals that must remain live formulas rather than pasted values. Those rows are written as values in the main patch, then rewritten as formulas in dependent batch requests ordered after it. Every subresponse is validated, because a silent failure here leaves subtotals as stale constants.

## Feed refresh: two generations

After the model is patched, the reporting feed tabs are refreshed. Two implementations exist:

Generation 1 (6 properties) - read the feed tabs, then clear and reload the reporting workbook. If a read returns empty, the clear still runs and leaves the reporting layer without data.

Generation 2 (1 property) - one batched call performs a full recalculation, *then* dependent feed reads. The builder validates every subresponse status and throws if either feed is empty - before anything is cleared.

Generation 2 is the target implementation for the remaining properties.

## Retention

Published model copies are timestamped and never overwrite, so the distribution folder grows without bound. A separate scheduled scenario caps it.

Retention controls:

- One router, one independent route per property, so a failure in one cleanup cannot affect another.
- Deletes at most one file per property per run. A folder far over cap converges over several months rather than in one bulk deletion. Slower, but a logic error can destroy at most one file per property per month.
- Matches on the property's exact model name, so a stray file in the folder is never a deletion candidate.
- No-ops silently at or below cap. The common case produces no action and no noise.
- Sorting is by filename, which is chronological because the timestamp prefix sorts lexically.

The retention scenario is the only component with delete authority. Its limits favor recoverability over faster cleanup.
