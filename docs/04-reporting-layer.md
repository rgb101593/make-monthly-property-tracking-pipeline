# 04 - Reporting layer

The reporting layer sits downstream of the Excel operating model:

```
Operating model -> normalized feeds -> Google Sheets model -> Looker Studio
```

This public description omits live workbook names, tab counts, field inventories, chart counts, row counts, and per-property bindings.

## Contract boundary

Google Sheets receives normalized feed rows rather than formatted workbook ranges. A combined reporting model derives period helpers and comparison fields, while a compact summary model supports trailing-period visuals.

The feed contract uses stable business-safe fields such as date, category, comparison category, source type, and value. Labels are treated as versioned schema because a renamed category can break a dashboard filter without raising an error.

## Period logic

The model derives the latest available reporting month from the data rather than from the current calendar. If a feed has not refreshed, the dashboard shows the latest available period and keeps its date visible instead of rendering an empty current month.

Reusable fields identify the latest period, the prior available period, and trailing windows. Currency metrics may be annualized where appropriate; ratios and occupancy measures retain their native form.

## Dashboard boundaries

Looker Studio consumes the reporting models through property-isolated data sources. Standard pages combine:

- current-period indicators;
- actual-versus-benchmark comparisons;
- cumulative trends; and
- trailing-period summaries.

The separation between detailed and compact reporting models keeps each visual's source predictable and limits the effect of a property-specific failure.

## Refresh ordering

Order is explicit:

```
write normalized feeds
-> recalculate reporting models
-> refresh data sources
-> render dashboard visuals
```

A partial feed write can otherwise leave a dashboard showing incomplete data without an explicit error. The [hardened refresh](03-orchestration.md#feed-refresh-hardening) validates required feed responses before clearing downstream data.

## Change controls

- Feed shapes and category labels are versioned contracts.
- Workbook and data-source bindings remain isolated by property.
- New properties follow a repeatable provisioning checklist rather than copied live identifiers.
- Troubleshooting starts at the feed boundary before changing dashboard configuration.

These controls show the integration design without publishing company-specific reporting dimensions or operational inventory.
