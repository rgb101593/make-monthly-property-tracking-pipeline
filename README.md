# Property Reporting Automation

A production monthly-reporting pipeline for a multifamily real estate portfolio. It takes a property manager's raw monthly export and, without human intervention, lands it in a financial operating model, patches the correct month window, republishes the workbook, refreshes a BI data model, and archives the source file.

A portfolio of properties, one orchestration scenario each, plus shared intake and retention. Runs monthly, unattended.

> Confidentiality note: Property names, system identifiers, storage paths, endpoints, and investor data are replaced with neutral placeholders. The documented architecture, control flow, incidents, and engineering decisions reflect the production system.

---

## The problem

A property management company delivers monthly operating statements as spreadsheet exports - one per property, each on its own schedule, each with a slightly different internal layout. Someone has to open a multi-sheet financial model per property, find the right month column, paste the numbers into the right rows, verify nothing downstream broke, and refresh the dashboards.

Across the portfolio that's a recurring multi-day manual task where a single misaligned column silently corrupts a year of financial history.

## The system

```
PM export (email or manual upload)
        ↓
  [1] Intake router          - classify by property, stage to per-property folder
        ↓
  [2] Property tracker       - discover structure, decide target month, patch model
        ↓
  [3] Excel operating model  - actuals vs. underwriting, waterfall logic
        ↓
  [4] Normalized feed tabs   - the stable contract layer
        ↓
  [5] BI data model          - union + derived period fields
        ↓
  [6] Dashboards             - per-property pages, KPI / variance / trailing windows
```

| Layer | Technology | Role |
|---|---|---|
| Intake | Microsoft 365 mail, datastore-backed routing | Classify exports by property, stage to cloud storage |
| Orchestration | Make.com scenario family | Structure discovery, decisioning, patching, publication |
| Operating model | Excel + Microsoft Graph API | Financial model - actuals, benchmarks, waterfall, per-unit metrics |
| Feed contract | Excel dynamic-array spill formulas | Flatten the model into long-form normalized tables |
| Reporting model | Google Sheets | Union feeds, derive period helpers, compute trailing windows |
| Presentation | Looker Studio | Per-property dashboard pages |

## Implementation details

Row bounds, month columns, and the writable region are discovered at runtime. The detailed import block varies in height by property, so the automation finds the boundary by scanning a marker row for a sentinel string. It does not reuse fixed ranges between properties.

The month decision uses three explicit states. The system compares the latest month in the operating model with the latest month in the incoming export and selects one of these modes:

| Mode | Condition | Behavior |
|---|---|---|
| `NEW_MONTH` | export is ahead | Generate *all* missing month headers in one batched call, then patch |
| `OVERWRITE` | months match | Patch the current month column in place |
| `PRIOR_MONTH` | export is behind | Patch the corresponding *historical* column - never the latest |

The third mode was added after an earlier version treated a stale export as an overwrite of the current column and cleared a month of live data. See [case-studies/](case-studies/).

A reporting-cutoff guard prevents future-dated writes. Property management systems sometimes emit a header for a month that has not closed. The guard computes a business date in a fixed timezone. On days 1-14 it allows data through two months prior; from day 15 onward it allows data through the previous month. If no valid month exists at or below the cutoff, the run fails without writing.

The Graph `$batch` endpoint can return HTTP 200 even when an individual subrequest fails. The scenarios therefore inspect every subresponse status and verify block dimensions before mapping. This check was added after a partial failure produced a misaligned write.

Scheduled scenarios treat an empty intake folder as a successful no-op. Published files use timestamped names and are not overwritten. Retention deletes at most one file per property in each run.

## Engineering case studies

These case studies describe production defects, the investigation process, and the resulting changes.

- [Invisible control characters](case-studies/01-control-character-contamination.md) - an entire scenario family failing on the same module, traced to trailing `\r\n` inside URL fields. The first root-cause theory was wrong and is documented as such.
- [Sparse-row width inference](case-studies/02-sparse-row-mapping-defect.md) - a fix that introduced a worse bug: inferring array width from the first returned row right-aligned the mapping and corrupted historical data. Includes the detection and repair path.
- [The reporting-cutoff guard](case-studies/03-reporting-cutoff-guard.md) - preventing writes for reporting periods that have not closed.

## Documentation

| Document | Contents |
|---|---|
| [01 - Architecture](docs/01-architecture.md) | Layer model, intake families, end-to-end flow |
| [02 - Operating model](docs/02-operating-model.md) | Workbook structure, dependency chain, feed contract |
| [03 - Orchestration](docs/03-orchestration.md) | Scenario family, module topology, decision logic |
| [04 - Reporting layer](docs/04-reporting-layer.md) | Data model, derived fields, dashboard design |
| [05 - Operations](docs/05-operations-runbook.md) | Guards, failure triage, change protocol |
| [Scenario reference](reference/scenario-reference.md) | Per-scenario technical detail with neutral identifiers |
| [Diagrams](diagrams/pipeline.md) | Pipeline flow, decision state machine, batch validation |

## Executable reference

`src/` contains small, dependency-free JavaScript modules that reproduce selected control logic from this pipeline, with `node:test` suites in `test/`. They are behavioral references written for this repository against invented inputs. They are not production exports, and they contain no live identifiers, ranges, paths, or configuration.

| Module | Reproduces |
|---|---|
| `src/month-mode.js` | Selection between `NEW_MONTH`, `OVERWRITE`, and `PRIOR_MONTH`, including multi-month gaps and rejection of an out-of-range historical target |
| `src/reporting-cutoff.js` | The reporting cutoff against an injected business date, clamping a future-dated export or throwing when nothing is reportable |
| `src/sparse-rows.js` | Row normalization against an authoritative expected width, padding sparse rows and refusing a width mismatch before a payload exists |
| `src/category-map.js` | Category mapping with summed duplicates, explicit alias resolution, and a chosen no-match policy |
| `src/graph-batch.js` | Batch subresponse validation behind a successful envelope, and refusal to clear a destination when a dependent feed returns no rows |

Run them with:

```
npm test
```

The suites make no network, mailbox, storage, spreadsheet, or dashboard calls.

## Engineering practices

- Live state is the source of truth. Documentation is reconciled against live configuration before any change. Change reports that contradict live state are treated as wrong - this has happened and is documented.
- Version-checked writes. Structural changes go through a plan/apply pair with an expected-version check and a post-write structural diff as proof.
- Every change has a named rollback point. Recorded per scenario, per change.
- Evidence is never normalized before analysis. Sanitizing raw configuration before inspecting it is how the control-character defect stayed hidden.
