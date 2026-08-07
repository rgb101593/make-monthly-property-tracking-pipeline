# Scenario reference

Per-scenario technical detail. Property names use `Property A`–`G`; scenario IDs use symbolic handles; spreadsheet and storage identifiers are omitted.

How to use this file: read the shared architecture section plus only the section for the scenario you're working on. Do not re-verify every section for every task.

Trust order: live configuration > live data > this file > older docs. Before changing a scenario, fetch its live configuration and confirm this section still matches. If it doesn't, fix the section first.

---

## Shared architecture

All seven trackers share the module topology documented in [03 - Orchestration](../docs/03-orchestration.md#the-universal-skeleton). Core module IDs mean the same thing in every property.

Module topology is shared, but configuration is property-specific. Paths, ranges, workbook names, and spreadsheet identifiers must be verified for each property.

### Storage throttling

Sleep modules sit after every storage list, download, and upload operation, and immediately before the final archive move. Exact module IDs vary per property and are listed per section.

### Guard module IDs

The reporting-cutoff guard sits immediately after the export header parser. Its module ID varies by property; the rest of the core topology uses shared IDs.

---

## Family 1 - Standard layout, routed intake

Five properties. Export sheet uses a standard two-token `Mmm YYYY` header. Triggered by webhook from the intake router.

Common configuration:

| Element | Value |
|---|---|
| Trigger | Webhook from router |
| Export header range | Standard export sheet, fixed header row |
| Header parser | Backward scan, skips subtotal columns, exact two-token split, fixed column base |
| Export data rows | Typically starting row 12 *(one exception - see Property E)* |
| Mapper | Normalized exact code match; duplicates summed; unmatched non-blank code → 0; blank-code rows preserved |
| Width handling | Derived from authoritative model patch width; maximum export row width must match |
| Write | Direct range patch |
| Feed refresh | Generation 1 |

### Property A

| Field | Value |
|---|---|
| Role | Standard |
| Model patch rows | 7:358 |
| Export data rows | 12:400 |
| Publication | Timestamped, no overwrite |
| Note | Baseline for the corrections in [case study 02](../case-studies/02-sparse-row-mapping-defect.md) |

### Property B - clone baseline

| Field | Value |
|---|---|
| Role | Standard - designated baseline for cloning new standard properties |
| Model patch rows | 7:364 |
| Export data rows | 12:400 |
| Note | Cleanest standard reference: standard export sheet, standard marker logic, standard write model |

When adding a standard property, clone this one. It is kept deliberately free of property-specific exceptions.

### Property C

| Field | Value |
|---|---|
| Role | Standard |
| Model patch rows | 7:362 |
| Export data rows | 12:400 |
| Note | Shorter model block than B and D - ends at 362, not 364 |

### Property D

| Field | Value |
|---|---|
| Role | Standard |
| Model patch rows | 7:364 |
| Export data rows | 12:400 |

### Property E - row-bound exceptions

| Field | Value |
|---|---|
| Role | Standard, shifted rows |
| Model patch rows | 7:366 |
| Export data rows | 11:370 - export data starts row 11, not 12 |
| Storage path source | Datastore-driven - the only route whose path is not hardcoded |

> Never normalize Property E to the common bounds. Its model layout differs because of a historical row insertion near the marker row. Applying another property's ranges clips it at both ends. This has been attempted and reverted.

---

## Family 2 - Specialized layout, manual intake

Two properties. Export layouts differ structurally from the standard family. A person uploads the export; the scenario is self-scheduled.

Common configuration:

| Element | Value |
|---|---|
| Trigger | Scheduled, monthly window, staggered start times |
| Intake | Lists intake folder, limit 1 |
| Existence guard | On the post-trigger sleep module - empty folder is a safe no-op |
| Ops at header stage | 9 (one fewer than standard) |
| Batch shape | Two dependent block reads rather than four discrete requests |
| Mapper | Custom, hardened - strict dimension assertions, throws on missing or failed subresponse |
| Write | Batched |

### Property F - trailing-twelve export layout

| Field | Value |
|---|---|
| Export sheet | Trailing-twelve summary sheet *(renamed upstream mid-2026; range unchanged)* |
| Header parser | Tolerant regex - allows trailing qualifiers (`Jun 2026 Actual` accepted), excludes adjusted-total columns, null-safe, different column base |
| Model block | 7:283 - 277 rows, asserted exactly |
| Export block | 7:400 - 394 rows, asserted exactly |
| Match key | `code \| normalized_label` - both required, no code-only fallback |
| Aliases | 5 approved label aliases |
| Protected formula rows | 6 subtotal rows preserved as formulas |
| Write | Values patch, then dependent formula rewrites |
| Feed refresh | Generation 1 |

Why no code-only fallback: duplicate category codes legitimately appear on subtotal and header rows. Matching on code alone would map a subtotal into a line item. Add new aliases one at a time after verifying both sides; never add a generic fallback.

Protected formula rows: six rows inside the write window are live subtotal formulas, not values. The patch writes them as values, then dependent batch requests restore the formulas. Every subresponse must be validated - a silent failure here leaves subtotals frozen as stale constants, which looks correct and is not.

### Property G - income-statement export layout, hardened feeds

| Field | Value |
|---|---|
| Export sheet | Income statement sheet |
| Header parser | Regex accepting abbreviated or full month names; excludes total / YTD / annual / budget columns; null-safe |
| Model block | 7:218 - 212 rows, asserted exactly |
| Export block | 8:500 - 493 rows, asserted exactly |
| Match key | Code first; label fallback only when the model's code cell is blank |
| Normalization | Aggressive - ampersand expansion, punctuation and dash stripping |
| Aliases | 9 label aliases |
| No-match behavior | Cell PRESERVED, not zeroed |
| Negative handling | Parenthesized negatives and currency symbols handled |
| Write | Values only - no formula rows |
| Feed refresh | Generation 2 - the hardened pattern |

No-match handling differs from the standard family. Standard mappers write `0` for an unmatched non-blank code, while this mapper leaves the existing value untouched. The standard zero-fill behavior must not be used here.

Generation-2 feed refresh is the pattern to port estate-wide: one batched call performs a full recalculation, then dependent feed reads. The payload builder validates every subresponse status and throws if either feed is empty - before the downstream clear.

---

## Intake router

| Field | Value |
|---|---|
| Schedule | Monthly, days 15–30 |
| Mail query | Saved folder, filtered by sender and subject, attachments required, newest first, limit 1 |
| Classification | Filename keyword match per property |
| Routes | 5 - the standard family only |
| Per-route flow | Datastore lookup → storage upload → breather delay → property webhook |
| Delay | Uniform, after upload, before webhook |
| Upload mode | No overwrite - a duplicate filename is a collision, not a silent replace |

The router requests one message and therefore selects the latest qualifying email on every run. Replaying it does not move backward through message history.

Webhook URLs come from the datastore, not from hardcoded values. One route's storage path is also datastore-driven; the other four are hardcoded. Standardizing the remaining four is open work.

A `is_active` field exists on the routing records but is not used as a route gate - a known discrepancy between the data model and actual behavior.

The router does not route the specialized family.

### Manual fallback router

A webhook-triggered variant with the same mail query but only 4 routes - it is not full coverage and should not be treated as a complete manual fallback.

---

## Retention

| Field | Value |
|---|---|
| Schedule | Monthly, days 15–30 |
| Structure | Scheduled bootstrap → aggregator → shared cap variable → router with 7 independent routes |
| Cap | 20 published copies per property |
| Per-route flow | List published folder → aggregate → property-specific planner → filtered delete |

Planner contract: match only files whose name contains that property's exact model name; sort ascending (the timestamp prefix sorts chronologically); no-op at or below cap; otherwise return exactly one oldest path. Delete runs only when the planner flags over-cap. A missing oldest path is a safe no-op.

Cleanup is intentionally one oldest file per property per run, not bulk deletion. A folder far over cap converges over several months. This is the only component with delete authority; conservative beats efficient.

Legacy fixed-name copies from before timestamped publication still count toward the cap and sort after timestamped copies, so they persist.
