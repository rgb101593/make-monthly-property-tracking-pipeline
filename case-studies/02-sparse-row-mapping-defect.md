# Case study 02 - A correct fix that caused a worse bug

Sequence: a guard fix exposed an existing mapping defect; the next run corrupted a year of monthly data; comparison with the previous published output identified the damage; replay restored it.

The mapping defect existed before the guard change. Establishing that sequence prevented the team from reverting the correct guard fix.

---

## Stage 1 - the original problem

A property's operating model was at July. The incoming export's latest month was June - a stale file.

Decision logic classified this as `OVERWRITE` but left the target column at the model's latest - July. The mapper then right-aligned June's data into July's column.

Result: the current month's header and data were cleared and replaced with the prior month's values. The model's latest month regressed from July to June.

Diagnosis: `OVERWRITE` conflated "months match" with "months don't advance." A third mode was needed.

## Stage 2 - the fix

Two changes:

1. Guard timezone corrected to the business timezone (it had been set to an unrelated zone).
2. `PRIOR_MONTH` introduced: when the export is behind, target `model_col + month_gap` - the export's *own* historical column - rather than the model's latest.

Verified by self-test across older, equal, and newer export months. Live diff against the rollback version contained exactly these two changes and nothing else.

The fix was correct. It has not been revised since.

## Stage 3 - what the fix exposed

The next run preserved the current month correctly. It also corrupted every mapped cell across the reporting window.

The mapper inferred the width of the incoming value block from the first row returned by the API. That row was sparse - it had four populated columns where the block was eleven wide.

```
Assumed width:  4 columns   (from row 1)
Actual width:  11 columns

Every subsequent row was right-aligned into a 4-column frame.
Eleven months of data landed in the wrong months.
```

This defect had existed the entire time. It never fired because previous runs happened to receive a fully-populated first row. The guard fix changed which rows came back first, and the latent defect became live.

The change exposed an existing width-inference defect; it did not introduce the defect.

That distinction mattered: reverting the guard fix would have re-hidden the defect while leaving it armed for a future run.

## Stage 4 - detection

Detection did not come from an error. The run reported success: status OK, expected operation count, normal duration.

It came from diffing the published output against the previous known-good publication. Because every run publishes a timestamped copy rather than overwriting a fixed filename, two consecutive outputs can always be compared cell by cell.

That retention design - originally about not losing history - turned out to be the corruption detector. It is the single most useful property of the publication model.

## Stage 5 - the repair

The mapper was rewritten to:

- Derive width from the authoritative model patch width, not from returned data.
- Require the maximum export row width to equal that width - throw on mismatch.
- Pad sparse rows through the existing safe-number path.
- Never right-align from a truncated first row.

Validated against a synthetic sparse-first-row fixture: all eleven months mapped correctly. Live diff against the prior version contained only the mapper change.

Repair used the pipeline itself: the same verified export was copied from the archive back into intake and reprocessed. The run completed in the normal runtime at the expected operation count.

Verification: the new output matched the known-good pre-corruption baseline with zero cell differences through the full model range. Every damaged cell was correct. The model's latest month was June, July absent as intended, intake empty, export archived.

## Changes made

Array dimensions now come from the authoritative write range. Returned data is validated against those dimensions.

The mapper now fails on a width mismatch instead of producing a misaligned result. This stops the run before any cells are patched.

Timestamped publication allows any two consecutive outputs to be compared. That comparison was how this incident was detected.

The incident review distinguishes the change that exposed the defect from the code that caused it. Reverting the previous change would have restored the hidden failure mode.

The corrected mapper was applied only to the four properties with matching semantics. The two custom mappers were left unchanged.

## Result

The mapper had passed for months because the first returned row happened to have the expected width. The revised implementation validates the complete data shape before writing; HTTP status and cell count alone are not treated as sufficient checks.
