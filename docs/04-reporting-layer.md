# 04 - Reporting layer

Downstream of the operating model: a Google Sheets data model per property, feeding a Looker Studio report with one page per property.

## Position

```
Operating model  →  feed tabs  →  Google Sheets workbook  →  Looker Studio
   (Excel)          (contract)      (data model)              (presentation)
```

The Google Sheets workbook is an internal data model between the automation output and the dashboards. Users do not edit it directly because ad hoc changes can break dashboard fields and bindings.

## Workbook structure

One workbook per property, four tabs:

| Tab | Role | Structure |
|---|---|---|
| `SCF_Feed` | Landing zone | `date, category, value` - written by the automation |
| `Summary_Feed` | Landing zone | `date, category, under_category, value` - written by the automation |
| `Master_Data` | Primary model | Union of both feeds + derived fields |
| `T_Summary` | Secondary model | Compact trailing-period aggregation |

The two landing tabs are cleared and reloaded on each run. The two model tabs recalculate from them.

`SCF_Feed` carries the largest row count and grows with each reporting period. `Summary_Feed` covers the comparison window only. `Master_Data` holds their union. `T_Summary` stays small because it holds one row per metric and trailing period.

## Master_Data

The primary reporting model, with many derived fields plus one user-facing parameter. It unions the detailed operating feed with the comparison feed and adds the derived fields the dashboards need.

The feeds are unioned because they have different grains. `SCF_Feed` contains detailed operating history, while `Summary_Feed` contains actual-versus-underwriting comparison lines. A `source_type` field distinguishes them in the combined dataset, allowing one Looker data source to support both views.

### Derived period fields

The dashboards need "current month," "prior month," and trailing-window behavior. Doing that in Looker per-visual would be repetitive and inconsistent. It's computed once in the model:

| Field | Purpose |
|---|---|
| `latest_date` | Most recent reporting month present in the data |
| `is_latest_available` | Flags the current reporting month - drives KPI cards |
| `months_from_latest` | Integer offset from the latest period |
| `is_prev_available_month` | Flags the immediately prior month - drives MoM comparison |
| `latest_month_label` | Display label for report headers |

`latest_date` is derived from the data instead of the calendar. If a property's feed has not refreshed, the dashboard shows the latest available month rather than an empty current month. The stale date remains visible to users.

### Field families

| Family | Purpose | Examples |
|---|---|---|
| Base identifiers | Record grain and category meaning | `date`, `category`, `under_category`, `value`, `source_type` |
| Classification helpers | Filters, labels, display conditions | expense category, reimbursement ratio category, trailing-window flag |
| Operating dimensions | Reusable numeric fields | rental income, other income, total income, operating expenses, debt service |
| Actual metrics | Actual-side comparisons | actual NOI, actual total income |
| Underwriting metrics | Plan benchmarks | underwriting NOI, underwriting operating expenses |
| Cumulative metrics | Running-position trends | cumulative NOI, cumulative rental income |
| Latest / previous | KPI cards and MoM logic | latest NOI, previous NOI, previous total expenses |
| Rolling and derived | Trailing windows | T1 / T3 / T12 monthly averages, running average ratios |

## T_Summary

A compact model computed *from* `Master_Data`, holding one row per metric-period combination across three trailing windows (T1, T3, T12).

```
Metric | Category | Period | Monthly Average | Annualized | Period Order
```

Dollar metrics are annualized by ×12. Ratio and occupancy metrics keep their native percentage form - annualizing a percentage would be meaningless, and that exception is explicit in the model rather than implied.

`Period Order` exists purely as a sort key, because `T1 / T3 / T12` sorts wrong alphabetically. A small thing that would otherwise be re-solved in every visual.

The trailing-period visuals require one row per metric and period. `T_Summary` precomputes them instead of deriving them repeatedly from the full detail table inside each visual.

## Dashboard design

One page per property, standardized layout, two data sources per page.

| Zone | Source | Contents |
|---|---|---|
| Header and controls | `Master_Data` parameter | Property name, month label, trailing-period control |
| KPI card row | `Master_Data` latest-period fields | NOI, occupancy, gross income, total expenses, OpEx ratio |
| Main analysis | `Master_Data` | Actual-vs-underwriting charts with cumulative trend lines |
| Period summaries | `T_Summary` | Compact T1 / T3 / T12 visuals |

`Master_Data` powers the large majority of content. `T_Summary` is assigned only to the compact trailing-period visuals. Keeping that split clean means a page's behavior is predictable from which source a visual uses.

The user-facing Trailing control works against both models simultaneously - the period helper fields in `Master_Data` and the period rows in `T_Summary`. That coordination is why both models must share period vocabulary exactly.

## Refresh sequence

Order matters and is not incidental:

```
1. Automation writes SCF_Feed and Summary_Feed
2. Master_Data recalculates from both feeds
3. T_Summary recalculates from Master_Data
4. Looker data sources refresh against the workbook
5. Page visuals render
```

Each step depends on the previous completing. The practical requirement is that step 1 finishes successfully before anyone reviews a dashboard - data freshness settings control step 4, but nothing enforces that steps 1–3 are complete when it fires.

A partial feed write can leave the dashboard rendering incomplete data without an explicit error. For this reason, [generation-2 feed refresh](03-orchestration.md#feed-refresh-two-generations) checks for empty feeds before clearing existing data.

## Label coupling

The reporting layer is category-driven. Category names and `under_category` labels are effectively a schema:

- Renaming a category upstream breaks chart filters that reference it.
- Changing the feed column structure breaks `Master_Data` unions.
- Altering `T_Summary` period labels breaks the trailing visuals.

These changes can produce blank or incorrect charts without raising errors. Feed schemas and category labels are therefore treated as a versioned contract and updated in both the workbook and reporting model.

## Per-property isolation

Each property has its own folder, its own workbook, and its own two data sources, named by property and source type.

Workbooks and data sources are kept separate by property. A workbook failure therefore affects one dashboard page, and each page's source is identifiable by name. This requires maintaining one workbook per property but prevents cross-property failures.

Adding a property is therefore a fixed, repeatable procedure: create the folder, create the workbook, configure both model tabs, add the page and its two sources.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Page blank or partially blank | Workbook didn't update, or page bound to wrong source | Verify the workbook exists in the expected folder; check both source bindings |
| KPI cards show a stale month | `latest_date` didn't advance - feeds not refreshed | Inspect both feed tabs for the expected month; refresh the source |
| Actual-vs-underwriting doesn't reconcile | Comparison feed labels changed | Validate category and under_category values against expected vocabulary |
| Trailing visuals blank or wrong | `T_Summary` period structure altered | Check period labels, monthly average, annualized, and sort key |
| One property updates, another doesn't | Per-property binding issue | Review that property's workbook and source assignments |
| Unexpected category gaps | Upstream category names changed | Confirm feed labels against the expected vocabulary |
