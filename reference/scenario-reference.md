# Scenario reference

How the scenario family is organized, and what varies between its members. Exact ranges, module identifiers, schedules, storage paths, and workbook dimensions are deliberately omitted; they are operational configuration rather than architecture.

Trust order for anyone maintaining this: live configuration first, then live data, then this file. Before changing a scenario, read its live configuration and confirm this description still holds.

## Shared architecture

Every property tracker follows the module topology described in [Orchestration](../docs/03-orchestration.md#the-universal-skeleton). Core module identifiers mean the same thing in each one, which is what makes a defect report portable across the family.

Identical modules do not mean identical configuration. Every path, range, workbook name, and spreadsheet identifier is property-specific and is resolved from that property's own live configuration. Copying any of them between properties is treated as a defect.

Sleep modules follow every storage list, download, and upload, and precede the final archive move. The storage API throttles under concurrent load, so these delays are load-bearing rather than cosmetic.

The reporting-cutoff guard sits immediately after the export-header parser. Its module identifier varies per property, which makes it the one genuinely property-specific position in an otherwise shared topology.

## Two intake families

| | Routed family | Manual family |
|---|---|---|
| Trigger | Webhook from the intake router | Self-scheduled within the monthly window |
| Export arrives via | Automated mail, attachment extraction, routed upload | A person uploads it |
| Export layout | Shared standard layout | Distinct layout per property |
| Header parser | Common two-token month format | Property-specific format |
| Empty intake folder | Upstream problem, trace the router | Usually not uploaded yet, safe no-op |
| Intake guard | None; iterates over every staged file | Limit-one listing with an existence guard |
| Mapping | Shared mapper semantics | Custom hardened mapper |
| Write | Direct range patch | Batched patch |

The two families need different triage. An empty folder is an incident for one and routine for the other, and encoding that difference is what keeps the monthly run quiet enough that real failures stand out.

## What varies within the routed family

Members share parser, mapper, and write strategy. They differ in the row bounds of their model block and, for one member, in the row where export data begins.

One member is the designated clone baseline. It is kept free of property-specific exceptions so that adding a property starts from a clean copy.

One member carries a documented row-bound exception created by a historical row insertion near the marker row. Applying another member's bounds to it clips data at both ends. This has been attempted and reverted, and the exception is recorded so a future cleanup does not repeat it.

## What varies within the specialized family

Both members assert their block dimensions exactly and throw on a missing or failed batch subresponse. Beyond that they diverge:

**Match key.** One requires a compound key of code and normalized label, with no code-only fallback, because duplicate codes appear on subtotal rows. The other matches on code first and falls back to label only when the model's code cell is blank.

**No-match behavior.** One writes a zero for an unmatched non-blank code. The other leaves the existing value untouched. These are opposite and both are correct, because the two models mean different things by an absent row. Normalizing them to a single behavior would be a regression.

**Protected formulas.** One member has live subtotal formulas inside its write window. The patch writes them as values, then dependent batch requests restore the formulas. Every subresponse must be validated, because a silent failure here leaves subtotals frozen as stale constants.

**Feed refresh.** One member runs the hardened generation-2 pattern: a single batched call performs a full recalculation, then dependent feed reads, and the builder throws on an empty feed before anything downstream is cleared. The rest run generation 1, which can clear and then write nothing. Porting generation 2 across the family is open work.

Each member keeps an explicit, enumerated alias list for names that differ across exports in ways normalization does not catch. Aliases are added one at a time after checking both sides. No generic similarity fallback exists, because the unmapped row is the signal the gates depend on.

## Intake router

Reads the newest qualifying message from a saved mail folder, filtered by sender and subject, requiring attachments. It classifies attachments by filename keyword and routes each to its property.

Each route performs a configuration lookup, a storage upload, a fixed delay, then a webhook call into the property tracker. The delay spaces property runs apart so the storage API does not throttle.

Uploads refuse to overwrite, so a duplicate filename surfaces as a collision rather than a silent replacement. Webhook targets come from configuration rather than hardcoded values. Most storage paths are still hardcoded, and standardizing the rest is open work.

Because the router always takes the newest qualifying message, a rerun reprocesses the same one. It does not walk backward through history.

A separate webhook-triggered fallback router exists with reduced coverage. It does not reach every property and should not be treated as a complete manual path.

## Retention

Published copies are timestamped and never overwrite, so the distribution folder grows without bound. A scheduled scenario caps it.

One router fans out to an independent route per property, so a failure in one cleanup cannot affect another. Each route lists that property's published folder, aggregates the filenames, applies a shared cap, and deletes at most one file per run.

The planner matches only filenames containing that property's exact model name, sorts ascending because the timestamp prefix sorts chronologically, and no-ops at or below the cap. A missing oldest path is a safe no-op.

Deleting one file per property per run means a folder far over cap converges over several months. This is the only component with delete authority, so it is the one place where conservative beats efficient.

Legacy fixed-name copies predating timestamped publication still count toward the cap and sort after timestamped copies, so they persist until someone removes them.
