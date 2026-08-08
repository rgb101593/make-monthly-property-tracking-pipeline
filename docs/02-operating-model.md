# 02 - The operating model

The automation targets a formula-heavy Excel operating model for each property. This public description uses functional roles rather than live sheet names, ranges, workbook dimensions, or portfolio-specific configuration.

Restricted investor data exists outside the automation's approved write path and is intentionally excluded.

## Workbook roles

| Role | Responsibility | Automation access |
|---|---|---|
| Actuals hub | Holds monthly operating results and the time axis | Bounded read and write |
| Comparison layer | Compares actuals with approved benchmarks | Read only |
| Benchmark inputs | Holds historical and forward assumptions | Read only |
| Restricted calculation layer | Supports distributions and other sensitive calculations | No access |
| Feed contract | Exposes normalized reporting rows | Read only |
| Presentation and administration | Charts, scenarios, notes, and version history | No access |

Dependencies flow from benchmarks to calculations, then to normalized feeds and presentation. Monthly automation writes only to the discovered actuals region.

## Runtime structure discovery

The writable block differs between workbooks and can shift when a row is inserted. Fixed public ranges would be both fragile and unnecessarily revealing.

The pipeline therefore:

- reads the model header to find the latest valid period;
- scans a marker row to locate the writable boundary;
- derives the patch dimensions from the current workbook;
- rejects any source whose shape disagrees with that authoritative width; and
- leaves manual, restricted, and formula-derived regions untouched.

## Category mapping

Stable category identifiers are the join key between the incoming export and the model. Values are mapped by normalized identifier rather than by row position, so row insertion and source ordering do not silently shift data.

Some supported layouts require an identifier-and-label key or a label fallback. These exceptions are explicit. There is no fuzzy matching because an unmapped row is a control signal that should be reviewed rather than guessed.

## Feed contract

The reporting layer reads normalized long-form feeds instead of formatted analytical sheets. The feeds expose business-safe shapes such as:

```
date, category, value
date, category, comparison_category, value
```

This contract isolates downstream reporting from merged cells, formatting changes, variable workbook heights, and presentation-only formulas.

## Calculation behavior

The model uses modern Excel lookup and dynamic-array functions. Reads occur only after workbook recalculation because a programmatic patch may leave spill outputs stale until the calculation engine runs.

The hardened refresh path recalculates before reading dependent feeds and refuses to clear downstream data when a required feed is empty. See [Orchestration](03-orchestration.md#feed-refresh-hardening).

## Constraints imposed on automation

| Model characteristic | Required control |
|---|---|
| Variable writable region | Discover boundaries at runtime |
| Stable category identifiers | Map by identifier, not position |
| Formula-driven dependencies | Limit writes to the approved import region |
| Dynamic-array feeds | Recalculate before reading |
| Protected formula rows | Restore approved formulas through dependent batch operations |
| Human-maintained regions | Exclude them from every generated patch |

Known workbook debt is tracked privately because sheet-specific defects and operational details are not necessary to understand the public reference implementation.
