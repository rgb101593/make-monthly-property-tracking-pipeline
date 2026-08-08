# 03 - Orchestration

The Make.com layer coordinates routed and manual intake, one property-level tracker per workbook, and conservative retention. This public reference omits production scenario identifiers, module identifiers, schedules, ranges, and portfolio counts.

## The universal skeleton

Every tracker follows the same control sequence:

| Stage | Responsibility |
|---|---|
| Trigger | Start from routed intake or a bounded manual run |
| Locate | Resolve the target workbook and staged export from live configuration |
| Stage | Read from a working copy rather than the original upload |
| Discover | Read model headers, export headers, and the writable boundary |
| Guard | Select the latest reportable source period |
| Decide | Choose new-month, overwrite, or historical-update behavior |
| Validate | Check batch responses and source dimensions |
| Map | Join values to model rows using the approved key strategy |
| Patch | Write only the computed month window |
| Publish | Produce a timestamped distribution copy |
| Refresh | Recalculate and update normalized reporting feeds |
| Archive | Move the source only after required writes succeed |

Shared topology does not imply shared configuration. Paths, workbook names, ranges, parser details, and identifiers are resolved for the target property and are never copied blindly between trackers.

## Month decision

The reporting guard supplies an effective export month. Decisioning compares it with the model's latest month:

```
month_gap = export_month - model_month

positive gap  -> NEW_MONTH    create missing headers and target the new period
zero gap      -> OVERWRITE    update the current period in place
negative gap  -> PRIOR_MONTH  target the matching historical period
```

Historical updates are rejected when the computed target falls outside the writable region. This prevents a stale export from overwriting the model's current month.

## Reporting-cutoff guard

An upstream system can publish a valid-looking header before a reporting period has closed. The guard applies a business-calendar cutoff before decisioning:

```
before the mid-month boundary  -> latest permitted period is two months back
from the boundary onward       -> latest permitted period is the previous month
```

If the parsed period is too recent, the guard walks back to the latest valid source period. If none exists, the run stops without writing. Parser differences remain explicit so the guard and upstream parser cannot disagree silently.

## Mapping strategies

All strategies derive their width from the current model patch region and validate the complete source shape before mapping.

- Standard layouts use normalized exact identifier matching, sum duplicates, and apply an explicit unmatched-value policy.
- Compound-key layouts require both identifier and normalized label when duplicate identifiers have different meanings.
- Fallback layouts use a normalized label only when the model's identifier is blank and preserve existing values when a safe match is unavailable.

Aliases are enumerated and reviewed. There is no similarity-based fallback.

## Batch validation

Microsoft Graph can return a successful batch envelope while an individual subrequest fails. The pipeline therefore validates, in order:

1. the envelope is successful;
2. every expected subresponse is present;
3. every required status is in the `2xx` range;
4. block dimensions match the discovered destination; and
5. each row conforms to the authoritative width.

Mapping begins only after all checks pass.

## Patch strategy

Most trackers use a bounded range patch. Workbooks with protected formula rows use dependent batch operations so approved formulas are restored only after the value write succeeds. Every required subresponse is checked before publication.

## Feed refresh hardening

The safe refresh path recalculates the workbook before reading dependent feeds. It validates every response and requires non-empty feed data before clearing the downstream destination.

Older clear-then-write behavior is documented as technical debt without publishing deployment counts. The hardened ordering is the required target pattern for every tracker.

## Retention

Published copies are timestamped and do not overwrite previous output. A separate retention process has narrowly scoped delete authority, filters by the exact configured model name, and removes only a bounded candidate per run. These limits favor recovery over aggressive cleanup.
