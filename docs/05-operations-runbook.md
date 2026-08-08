# 05 - Operations runbook

This public runbook describes operational controls without publishing live schedules, scenario inventories, module identifiers, rollout counts, file caps, or company-specific thresholds.

## Run behavior

Routed intake treats an unexpectedly empty folder as an upstream delivery problem. Manual intake treats the same condition as a safe no-op until an export is supplied. Successful runs publish a timestamped model, refresh reporting feeds, and archive the source only after required writes complete.

Storage calls are spaced to respect service throttling. Those delays are part of the operating design rather than cosmetic steps.

## Failure triage

| Symptom | First check |
|---|---|
| Empty routed intake | Trace mail filtering, classification, upload, and routing |
| Empty manual intake | Confirm whether the source has been supplied |
| Wrong file staged | Check route classification or human upload error |
| Similar failures across trackers | Investigate shared configuration lineage before treating them independently |
| Successful run with incorrect output | Diff timestamped publications against a known-good baseline |
| Reporting layer empty after refresh | Verify every required feed response before inspecting the dashboard |

Operation telemetry identifies the failed stage, but this repository does not publish production operation counts or module positions.

## Standing controls

| Control | Purpose |
|---|---|
| Intake cardinality guard | Prevent ambiguous processing of multiple staged exports |
| Runtime boundary discovery | Keep writes outside historical and human-maintained regions |
| Reporting cutoff | Reject future or not-yet-closed periods |
| Narrow patch window | Avoid overwriting unrelated periods |
| Authoritative width assertion | Stop sparse-row misalignment |
| `2xx` batch-response validation | Detect partial failures hidden by a successful envelope |
| Timestamped publication | Preserve comparison and rollback evidence |
| Validate-before-clear refresh | Prevent an empty feed from erasing usable reporting data |
| Bounded retention | Limit delete authority and preserve recoverability |

## Change protocol

Structural changes follow a plan/apply process:

1. Read live configuration and its version.
2. Reconcile documentation against live state.
3. Produce a version-checked plan and structural diff.
4. Review the intended operations before writing.
5. Apply the same reviewed operations with explicit confirmation.
6. Verify the resulting live structure independently.
7. Record a named rollback point and focused change note.

Validated fixes are applied only to trackers with matching semantics. Custom parsers and mappers require their own tests.

## Known debt

Open work is described by behavior rather than deployment count:

- migrate remaining clear-then-write refreshes to validate-before-clear ordering;
- make every batch consumer reject missing or non-`2xx` subresponses;
- harden older header parsing against malformed input;
- add cleanup for staging copies; and
- enforce intake cardinality consistently.

Unrelated diagnostic and migration scenarios are inventoried privately because they are not part of the public pipeline architecture.
