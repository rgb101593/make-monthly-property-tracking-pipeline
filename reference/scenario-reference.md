# Scenario reference

This repository intentionally does not publish per-property layouts, scenario identifiers, module identifiers, schedules, storage paths, workbook dimensions, or rollout counts.

## Shared contract

Every tracker follows the [universal orchestration skeleton](../docs/03-orchestration.md#the-universal-skeleton). Live configuration remains the source of truth for paths, parser selection, ranges, and workbook identity.

The public invariants are:

- routed and manual intake have different empty-folder semantics;
- structure is discovered from the target workbook at runtime;
- mapping uses an explicit identifier strategy and reviewed aliases;
- source and destination dimensions are validated before mapping;
- expected Graph responses must be present and successful;
- protected formulas are restored only through ordered dependent operations;
- required feeds are validated before downstream data is cleared; and
- source files move to archive only after required writes succeed.

## Controlled variation

Supported layouts may use exact identifier matching, a compound identifier-and-label key, or a label fallback when an identifier is absent. Unmatched-value behavior is explicit for each layout. These differences are tested separately rather than normalized into a risky universal mapper.

## Intake and retention

The intake router uses configuration-backed destinations, refuses silent overwrite, and spaces storage operations to avoid throttling. Retention has isolated, bounded delete authority and considers only files matching the configured model identity.

Detailed maintenance data remains in private operational documentation. It is unnecessary for understanding or testing this public reference implementation.
