# 05 - Operations runbook

How the system is run, diagnosed, and changed.

## Monthly cadence

| Window | What happens |
|---|---|
| Days 1–14 | No scheduled runs. Manual replays possible; the cutoff guard is stricter in this window. |
| Day 15 onward | Intake router runs. Routed properties fire on webhook. Manual-upload properties run on their own schedules, staggered. |
| After each tracker | Model published, reporting feeds refreshed, export archived. |
| Retention window | Published-copy cleanup, one file per property per run. |

The storage API throttles under concurrent load. Sleep modules follow storage operations, and the router spaces property invocations apart. Removing these delays has caused intermittent failures.

## Failure triage

### Operation count is the fastest signal

Every tracker run reports an operation count. Because the module topology is fixed, the count tells you how far it got.

| Family | Ops at failure | Died at |
|---|---:|---|
| Standard | 10 | Export header read |
| Specialized | 9 | Export header read |
| Either | 32 | Completed successfully |

A standard-family scenario warning at 10 operations died reading the export header - before any decisioning, before any write. That's a read-path or configuration problem, not a mapping problem. Knowing this collapses most investigations to a single module.

### Empty intake folder

Interpretation depends entirely on the property's intake family:

| Family | Meaning | Action |
|---|---|---|
| Routed | The router didn't deliver - mail query, filename classification, route filter, or upload collision | Trace the router upstream |
| Manual | Usually not uploaded yet | Confirm with the uploader; safe no-op |

Manual-family scenarios treat this as a successful no-op by design. They do not alert.

### Wrong file in intake

| Family | Cause |
|---|---|
| Routed | Misroute, or a stale file never archived |
| Manual | Human upload error - verify month and sheet before replaying |

### Same failure across multiple properties

Check for a shared origin before investigating individually. Four of the standard properties are clones of a fifth; a defect introduced before cloning appears identically in all of them. See [case study 01](../case-studies/01-control-character-contamination.md).

### Run succeeded but output looks wrong

Diff the newest published copy against the previous one. Publication is timestamped and never overwrites specifically so this is always possible. A successful run with a plausible operation count is not evidence of a correct write - see [case study 02](../case-studies/02-sparse-row-mapping-defect.md).

## Standing controls

| Control | Prevents | Note |
|---|---|---|
| Exactly-one-file intake | Ambiguous processing when multiple exports are staged | Standard family iterates up to 10 files - multiple files means multiple processings |
| Marker-row region detection | Writing into historical or human-maintained zones | If the marker row changes, header detection must be revalidated |
| Reporting-cutoff guard | Phantom future months | Throws when nothing valid exists |
| Narrow window patching | Overwriting months outside the export's coverage | Standard across the family |
| Authoritative width assertion | Misaligned mapping from sparse data | Throws on mismatch |
| Batch subresponse validation | Silent partial failures behind an HTTP 200 envelope | Fully implemented in 2 of 7 |
| Timestamped publication | Losing the ability to diff runs | Also the corruption detector |
| Feed clear-and-reload | Stale rows lingering downstream | Generation-1 can clear then write nothing |
| Capped retention | Unbounded growth from timestamped copies | One delete per property per run |

## Change protocol

Structural changes follow a fixed sequence. It exists because a bad write to a live financial model is expensive to detect and expensive to undo.

```
1. Read live state          - fetch current configuration and its version
2. Reconcile documentation  - if docs disagree with live, fix the docs FIRST
3. Plan                     - submit intended changes with an expected-version check
4. Review the diff          - structural diff returned before anything is written
5. Apply                    - same operations, same version check, explicit confirmation
6. Verify                   - post-write structural diff as proof
7. Record                   - changelog entry and named rollback point
```

Rules that have earned their place:

Use this trust order: live configuration, live data, reference documentation, then older documentation. Confirm the documented state against the live configuration before making a change.

Verify change reports against live state before recording completion. Previous reports have disagreed with the resulting configuration, and those discrepancies are retained in the changelog.

Apply a validated fix only to properties with the same semantics. Two properties have custom mappers that must remain unchanged unless they are tested separately.

Record a rollback point for each scenario before applying a change.

Update the affected scenario section and add one changelog entry. Leave unrelated sections unchanged so their reconciliation history remains intact.

## Known open items

The following items remain open:

| Item | Risk | Status |
|---|---|---|
| Generation-1 feed refresh on 6 of 7 properties | Can clear the reporting layer then write nothing | Generation-2 pattern proven on one property; port pending |
| Batch subresponse validation partial | Silent partial failures possible on 5 properties | Standard mappers reject width mismatches but use permissive accessors |
| Standard header parser fragility | Exact two-token split, null-unsafe; throws before its own guard can run | Guard is null-safe but cannot protect against an upstream throw |
| Staging area accumulates | Storage growth | No cleanup step |
| Standard family iterates up to 10 intake files | Multiple files processed in one run | No one-file guard on the standard family |
| Legacy fixed-name published copies | Count toward retention cap, sort before timestamped copies | Persist until manually removed |

## Non-tracker scenarios

The workspace contains additional scenarios unrelated to this pipeline - evaluation tools, migration utilities, and diagnostic scratch scenarios, some inactive. They are inventoried separately and deliberately excluded from tracker logic. One inactive test scenario is explicitly marked do-not-activate.

Keeping that inventory current matters: an unlabelled inactive scenario is indistinguishable from a broken active one during triage.
