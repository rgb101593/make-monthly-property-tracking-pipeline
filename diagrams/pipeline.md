# Diagrams

Mermaid source - renders natively on GitHub and adapts to light/dark themes.

## End-to-end pipeline

```mermaid
flowchart TB
    subgraph INTAKE["Intake"]
        MAIL["Monthly export<br/>arrives by mail"]
        ROUTER["Intake router<br/>classify by property"]
        MANUAL["Manual upload"]
        STAGE[("Per-property<br/>Incoming folder")]
    end

    subgraph ORCH["Orchestration - Make.com"]
        DISCOVER["Discover structure<br/>marker row, headers"]
        GUARD{"Reporting-cutoff<br/>guard"}
        DECIDE["Decision logic<br/>run mode + target"]
        MAP["Map by<br/>category code"]
        PATCH["Patch model<br/>window only"]
    end

    subgraph MODEL["Operating model - Excel"]
        SCF[["Actuals calculation layer"]]
        SUMM[["Summary<br/>actual vs underwriting"]]
        FEEDS[/"Feed tabs<br/>normalized long-form"/]
    end

    subgraph REPORT["Reporting"]
        GS["Google Sheets<br/>reporting models"]
        LOOKER["Looker Studio<br/>per-property pages"]
    end

    ARCHIVE[("Archive")]
    PUB[("Published copies<br/>timestamped, capped")]

    MAIL --> ROUTER --> STAGE
    MANUAL --> STAGE
    STAGE --> DISCOVER --> GUARD
    GUARD -->|"valid"| DECIDE
    GUARD -->|"nothing valid"| THROW(["THROW<br/>run fails, nothing written"])
    DECIDE --> MAP --> PATCH
    PATCH --> SCF --> SUMM --> FEEDS
    FEEDS --> GS --> LOOKER
    PATCH --> PUB
    STAGE -.->|"after success"| ARCHIVE
```

## Decision state machine

The core logic. Compares the model's latest month against the export's guarded effective month.

```mermaid
flowchart TB
    START(["month_gap = export_month − model_month"])
    START --> CMP{"sign of<br/>month_gap"}

    CMP -->|"positive - export ahead"| NM["NEW_MONTH"]
    CMP -->|"zero - months match"| OW["OVERWRITE"]
    CMP -->|"negative - export behind"| PM["PRIOR_MONTH"]

    NM --> BH["Generate ALL missing<br/>month headers in one batch"]
    BH --> W1["target = model_col + gap"]

    OW --> W2["target = model_col"]

    PM --> V{"does target map to<br/>a valid column?"}
    V -->|"yes"| W3["target = model_col + gap<br/>(leftward, historical)"]
    V -->|"no"| TH(["THROW"])

    W1 --> WRITE["Patch the window"]
    W2 --> WRITE
    W3 --> WRITE
```

`PRIOR_MONTH` exists because treating a stale export as an overwrite of the current column clears live data - see [case study 02](../case-studies/02-sparse-row-mapping-defect.md).

## Intake families

Why the same pipeline needs two failure interpretations.

```mermaid
flowchart LR
    subgraph F1["Routed intake"]
        direction TB
        A1["Mail arrives"] --> A2["Router classifies<br/>by filename keyword"]
        A2 --> A3["Upload to Incoming"]
        A3 --> A4["Call property webhook"]
        A4 --> A5{"Incoming<br/>empty?"}
        A5 -->|"yes"| A6["INCIDENT<br/>trace the router"]
        A5 -->|"no"| A7["Process"]
    end

    subgraph F2["Manual intake"]
        direction TB
        B1["Person uploads"] --> B2["Scheduled trigger<br/>fires in window"]
        B2 --> B3{"Incoming<br/>empty?"}
        B3 -->|"yes"| B4["Safe no-op<br/>not yet uploaded"]
        B3 -->|"no"| B5["Process"]
    end
```

An empty intake folder is an incident for one family and routine for the other. Encoding that distinction is what keeps the monthly run quiet enough that real failures stand out.

## Batch validation

The envelope can return HTTP 200 while individual subrequests fail.

```mermaid
flowchart TB
    BATCH["Batched read<br/>multiple subrequests"] --> ENV{"Envelope<br/>status"}
    ENV -->|"200"| NAIVE["Naive: assume success"]
    ENV -->|"200"| HARD["Hardened: inspect<br/>every subresponse"]

    NAIVE --> SILENT["Missing subresponse<br/>returns empty array"]
    SILENT --> BAD["Map against nothing<br/>SILENT CORRUPTION"]

    HARD --> C1{"All present?"}
    C1 -->|"no"| T1(["THROW"])
    C1 -->|"yes"| C2{"All status 2xx?"}
    C2 -->|"no"| T1
    C2 -->|"yes"| C3{"Dimensions<br/>match expected?"}
    C3 -->|"no"| T1
    C3 -->|"yes"| OK["Map"]
```

## Layer contract

Each boundary has a defined input and output contract.

```mermaid
flowchart TB
    L1["Intake<br/><i>classify and stage</i>"]
    L2["Orchestration<br/><i>discover, decide, patch</i>"]
    L3["Operating model<br/><i>formula-heavy workbook</i>"]
    L4["Feed tabs<br/><i>date, category, value</i>"]
    L5["Reporting model<br/><i>union + derived periods</i>"]
    L6["Dashboards<br/><i>per-property pages</i>"]

    L1 --> L2 --> L3 --> L4 --> L5 --> L6

    N4["THE contract layer.<br/>Everything downstream reads<br/>only this. The model's internal<br/>layout can change freely."]
    L4 -.- N4
```

The operating model contains formula-driven sheets, chart pages, and variable row heights, so it is not used directly as a reporting source. Dedicated dynamic-array tabs expose normalized long-form tables for downstream systems.
