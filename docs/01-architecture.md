# 01 - Architecture

## Layer model

The pipeline has six layers with defined responsibilities and data contracts.

| Layer | System | Responsibility | Failure mode if it breaks |
|---|---|---|---|
| Intake | Mail + routing scenario | Classify the monthly export by property, stage it to that property's folder, signal the property scenario | Export lands in the wrong property folder, or not at all |
| Orchestration | Make.com property scenarios | Discover structure, decide the target month, map values, patch the model | Wrong month written, or misaligned mapping |
| Operating model | Excel via Microsoft Graph | Hold actuals, benchmarks, waterfall, and derived analytics | Downstream reporting silently wrong |
| Feed contract | Excel dynamic-array tabs | Flatten model output to long-form normalized tables | Reporting layer receives a shape it can't parse |
| Reporting model | Google Sheets | Union the feeds, derive period helpers | Dashboards blank or stale |
| Presentation | Looker Studio | Per-property dashboard pages | Stakeholders see nothing |

The reporting layer reads from a defined feed contract rather than from the operating model itself. The operating model is a formula-heavy workbook of many sheets and chart pages. Two dynamic-array tabs expose its reporting data as normalized long-form tables:

```
SCF_Feed      → date, category, value
Summary_Feed  → date, category, under_category, value
```

Everything downstream reads only these. The workbook's internal layout can change without breaking reporting, as long as the feed shape holds.

## Two intake families

The properties split into two families by how their export arrives. This distinction drives trigger design, guard placement, and - importantly - failure triage.

| | Family 1 - Routed (5 properties) | Family 2 - Manual (2 properties) |
|---|---|---|
| Trigger | Webhook from the intake router | Self-scheduled, monthly window |
| Export arrives via | Automated mail → attachment extraction → routed upload | A person uploads it |
| Empty intake folder means | Upstream problem - trace the router | Usually "not uploaded yet" - safe no-op |
| Wrong file present | Router misroute or stale unarchived file | Human upload error |

The two families require different handling. An empty folder for a routed property indicates an upstream failure. For a manual property, it normally means the file has not been uploaded yet. The scenarios apply different alert rules to these cases.

## End-to-end flow

```
  1. Trigger              webhook from router, or scheduled window
        ↓
  2. Locate model         find the property's operating workbook in cloud storage
        ↓
  3. Verify intake        confirm exactly one export is staged
        ↓
  4. Stage a copy         copy the export to a working area - reads never touch the original
        ↓
  5. Read structure       model month headers, export month headers, marker row
        ↓
  6. Decide               compare latest months → run mode + target column
        ↓
  7. Guard                clamp against the reporting cutoff, or throw
        ↓
  8. Extend headers       if months are missing, generate all of them in one batch
        ↓
  9. Map                  match export rows to model rows by normalized category code
        ↓
 10. Patch                write only the covered month window
        ↓
 11. Publish              timestamped copy to shared storage
        ↓
 12. Refresh feeds        clear and reload the reporting model tabs
        ↓
 13. Archive              move the processed export out of intake
```

Steps 5–7 are where the engineering lives. Everything else is plumbing.

## Structure discovery, not configuration

The naive version of this system hard-codes ranges per property. That fails immediately: the detailed import block in the operating model varies in height across properties, and it shifts whenever someone inserts a row.

Instead:

- The writable region's left edge is found by reading a marker row and scanning for the first cell exactly matching a sentinel string. Everything left of it is historical and must not be touched.
- The model's latest month is found by scanning the header row for the largest date serial - not the rightmost non-blank cell, which breaks on trailing formatting.
- The export's latest month is parsed per-family, because the three export layouts label months differently.
- The write window is computed from the intersection of what the export covers and what the model can accept.

The standing rule: never copy a range, path, or file identifier between properties. Resolve it from the target property's own live configuration.

## Storage convention

Three storage systems, each with a distinct role:

```
Shared storage (exchange layer)
  /<workspace>/automation/<Property>/
      Incoming/          ← export lands here
      Archive/           ← processed exports, timestamped
      Updated Tracker/   ← published model copies, timestamped, capped

Cloud drive (processing layer)
  /<org>/Automation/<Property>/
      Tracker/           ← the authoritative model - the ONLY true write target
      _ingest_staging/   ← disposable copies of exports for safe reading

Spreadsheet layer (reporting)
  One workbook per property - downstream contract only, never a source
```

The authoritative model has one storage location. Copies in shared storage are distribution files, and the spreadsheet layer is downstream only. Neither is used as a write source.

## Scale

| Dimension | Shape |
|---|---|
| Scenario family | One intake router, one manual fallback router, one tracker per property, one retention job |
| Tracker topology | Fixed module sequence shared across every property |
| Operating model | Multi-sheet workbook with chart pages and dynamic-array feed tabs |
| Reporting model | Union of two feeds plus derived period fields and one parameter |
| Cadence | Monthly, within a fixed window, in a fixed timezone |
