# Case study 03 - Rejecting future-dated reporting periods

Problem: The upstream property management system sometimes emits a column header for a month that has not closed. The data behind it is empty or partial, but the header parses cleanly as a valid, current month.

Constraint: The automation cannot ask a human. It runs unattended, monthly, across the portfolio.

---

## Validation problem

The input is well formed. A value such as `Aug 2026` passes the parser even when the reporting period has not closed, and the source data contains no separate closed-period flag.

An export month ahead of the model triggers `NEW_MONTH`, which generates missing header columns and extends the model. An invalid future month would therefore affect the model structure, trailing-window calculations, and downstream dashboards.

The cell values cannot provide a reliable substitute. Both open and closed periods may contain a mixture of populated and blank lines.

## External validation rule

The values alone do not show whether the reporting period has closed. The guard therefore checks the business calendar.

Reporting close follows a predictable rhythm. A month's operating statement is not available the day the month ends - it takes a couple of weeks to close. So for any given date, there is a knowable latest month that *could* legitimately be reported.

That turns an unanswerable data-validation question into an answerable temporal one.

## The rule

```
Given today's business date in a fixed timezone:

  days 1–14         → allow at most the month TWO months back
  days 15–month-end → allow at most the PREVIOUS month
```

The two-week split follows the normal upstream close schedule. Before mid-month, the latest permitted report is two months back. From mid-month onward, the previous month is permitted.

The automation runs days 15–30, so the second branch is the normal path. The first exists because manual replays happen, and a replay on the 3rd must not accept a month that a scheduled run on the 20th would have accepted.

## Behavior

```
parsed export month  ≤ cutoff   → pass through unchanged
parsed export month  > cutoff   → walk back to the latest valid month in the export
no valid month at or below cutoff → THROW
```

If the export contains no reportable month, the third branch stops the run without writing. The failure is recorded and can be replayed after a valid export arrives.

## Placement

The guard sits between header parsing and decision logic:

```
parse export header  →  GUARD  →  decide run mode  →  compute window  →  map  →  write
```

Everything downstream consumes the guard's *effective* month and column. Nothing reads the raw parsed value. That's enforced by rewiring each consumer explicitly - the raw output is simply not referenced past the guard.

This placement matters. Guarding after the decision would mean the run mode was already chosen from bad input. Guarding at write time would mean header generation had already extended the model.

## Preserving each property parser

The guard has to re-parse the export header to walk back to a valid month. But the three export layouts label months differently, and each property's parser encodes its own quirks - which columns are subtotals, whether suffixes are allowed, whether month names are abbreviated or full, what the column offset base is.

The tempting move is one canonical parser in the guard. That would have been a regression: a guard that parses differently from its upstream parser can disagree with it, and a disagreement between them is a silent misalignment.

Each property's guard uses the same parsing rules as its upstream parser. The guards cover several distinct export formats.

## Verification

Each property was tested with these cases:

| Test | Expected |
|---|---|
| Current-calendar-month header inside the run window | Rolls back one month |
| Valid prior-month header | Passes through unchanged |
| Header outside the cutoff window | Rolls back to the latest valid month |
| Export containing no valid month | Throws |
| Boundary: day 14 vs day 15 | Different cutoffs applied |

Also verified that each guard's rollback used its own property's parsing rules, not a neighbor's.

## Design decisions

The source data cannot determine whether a reporting period has closed, so the guard uses the business calendar as an external constraint.

The guard either selects the latest permitted month or stops the run. It does not continue with a warning.

The guard runs immediately after parsing so downstream modules receive only the effective month and column.

Each guard uses the same parsing rules as its corresponding upstream parser. This preserves property-specific formats instead of approximating them with one shared parser.

## Result

The source system continues to expose open-month headers by design. The reporting-cutoff guard applies the consuming system's close schedule before any downstream write, without requiring a source-system change.
