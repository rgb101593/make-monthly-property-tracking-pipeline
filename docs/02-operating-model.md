# 02 - The operating model

The target of the automation is a multi-sheet Excel financial model, one per property. Understanding its structure explains most of the automation's design constraints.

> Investor-level data (roster, funded amounts, ownership splits, distributions) exists in the live workbook and is entirely excluded from this documentation. The sheet that holds it is described only by role.

## Sheet roles

| Sheet | Category | Depends on | Role |
|---|---|---|---|
| Source Cash Flow | Core | Benchmark tabs | Actuals hub and calculation spine |
| Summary | Core | Source Cash Flow, benchmarks | Actual-vs-underwriting comparison engine |
| Working Payment Calculator | Core | Summary, benchmarks, Source Cash Flow | Distribution and payment support *(contains restricted data)* |
| SCF_Feed | Feed | Source Cash Flow | Normalized long-form export |
| Summary_Feed | Feed | Summary | Normalized long-form export |
| Historical benchmark | Benchmark | - | Prior-period operating history |
| Underwriting operating statement | Benchmark | - | Forward plan, row-based benchmark |
| Underwriting summary | Benchmark | - | Deal constants |
| Waterfall model | Benchmark | - | Partnership distribution logic |
| Graph sheets | Presentation | Core tabs | Chart pages |
| Scenario analysis | Ancillary | Source Cash Flow | Sale/refinance scenarios |
| Version, Notes, Incentive support | Admin | - | Change log and commentary |

Dependency direction is strictly one-way: benchmarks → core → feeds → presentation. Benchmark tabs have no inbound dependencies and are maintained through underwriting revision, not monthly close.

## Source Cash Flow - the spine

The automation writes to exactly one zone of one sheet. Everything else is derived.

| Zone | Rows | Contents | Automation relevance |
|---|---|---|---|
| Header and date spine | 1:5 | Time axis, period labels, category IDs | Read - month headers live here |
| Marker row | 6 | Region boundary sentinel | Read - defines the writable left edge |
| Detailed operating import | 7:~360 | Mapped line items by category code | WRITE TARGET |
| Manual bridge | ~364:378 | Bank balances, loan reconciliation | Never touched - human-maintained |
| Normalized analytics | ~380:577 | NOI, financing, returns, ratios, per-unit | Never touched - formula-derived |

Two conditions prevent the use of fixed ranges:

The import block height varies by property. There is no universal row count, so each property's bounds are derived separately.

The height can also change over time. A row insertion near the marker shifted one property's bounds, requiring its ranges to be derived again.

The automation locates the writable region by scanning the marker row for a sentinel string. It uses labels and documented zones instead of fixed offsets.

## The category-code contract

Column D of the import zone holds category IDs, explicitly labelled in the workbook as automation ingestion keys. These are the join key between the incoming export and the model.

This is why mapping is code-based rather than positional. Row order can change, rows can be inserted, and the model and export can disagree about ordering - as long as the codes match, the mapping holds.

The corollary is a maintenance rule: deleting or renaming a category ID breaks ingestion for that line silently. The line simply stops being populated. Nothing errors.

## Summary - the comparison engine

Summary aligns actuals from Source Cash Flow against underwriting benchmarks in a repeating six-row block per category:

```
row n     Category label
row n+1   Actual              ← pulled from Source Cash Flow by date
row n+2   Underwriting        ← pulled from the benchmark tabs
row n+3   Variance            ← actual − underwriting
row n+4   Cumulative          ← running variance (or running average for ratios)
row n+5   Actual / UW ratio   ← relative performance, drives charts
```

Eighteen comparison categories follow this pattern: gross potential rent, loss-to-lease, vacancy, concessions, bad debt, rental income, economic vacancy, other income, total income, operating expenses, operating expense ratio, controllable expenses, NOI, capital expenses, management fees, debt service, preferred equity payments, and cash flow to members.

The predictable repetition is what makes `Summary_Feed` possible as a single dynamic-array formula.

## The feed contract

The two feed tabs are the cleanest interface in the system and the only thing the reporting layer reads.

| Feed | Columns | Implementation |
|---|---|---|
| `SCF_Feed` | `date, category, value` | One dynamic-array spill formula reshaping the normalized block |
| `Summary_Feed` | `date, category, under_category, value` | One dynamic-array spill formula reshaping Summary blocks |

Each is a single formula. No helper columns, no manual maintenance, no drift between the model and its export.

The design guidance embedded in the workbook is explicit: automation should prefer the feed tabs over reading formatted analytical sheets. Formatted sheets are fragile - merged cells, conditional formatting, variable heights. Feeds are stable long-form tables.

This is the contract that lets the operating model and the reporting layer evolve independently.

## Modern Excel dependencies

The model uses `LET`, `XLOOKUP`, `XMATCH`, `FILTER`, `BYROW`, `HSTACK`, and dynamic arrays. Two consequences:

1. Compatibility with older Excel is limited. Opening and saving in a legacy client can damage spill formulas.
2. Reads must happen against a live-calculated workbook. One property's feed refresh triggers a full recalculation before reading, precisely because spill ranges may not be current after a programmatic patch. That's the [generation-2 pattern](03-orchestration.md#feed-refresh-two-generations).

## Known debt

The following existing issues are outside the monthly write path:

- Broken references exist across several sheets, concentrated in the ancillary scenario sheet and the payment calculator. They predate the automation and do not affect the write path or the feeds.
- One defined name resolves to an error.
- The staging area accumulates copies with no cleanup step.

None of these issues blocks the monthly process. They remain documented for follow-up.

## Constraints the model imposes on the automation

| Model property | Automation consequence |
|---|---|
| Variable import-block height | Discover bounds at runtime; never share ranges between properties |
| Category IDs as join keys | Map by code, not position |
| One-way dependency chain | Write only to the import zone; everything else derives |
| Dynamic-array feeds | Recalculate before reading feeds |
| Formula rows inside the write window *(one property)* | Write values, then restore formulas in a dependent batch |
| Human-maintained bridge rows | Never write outside the discovered region |
