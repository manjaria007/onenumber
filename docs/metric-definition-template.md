# OneNumber metric definition template

Create a Confluence page per definition and add the label **`metric-definition`**. Put a two-column table on the page. Row labels are matched case-insensitively, and the alternatives in brackets also work.

| Row label | Example | Notes |
|---|---|---|
| Metric (Metric name, Name) | Churn rate | Defaults to the page title |
| Aliases (Also called) | customer churn, logo churn | Comma-separated. Groups definitions that use different names |
| Owner | Priya Raman (Finance Analytics) | Person accountable for the definition |
| Team (Owning team) | Finance | Shown as the label when comparing |
| Status | Canonical | `Canonical` marks the agreed definition; anything else is treated as draft |
| Definition (Description) | Share of paying customers who cancelled in the last 90 days | Plain-English meaning |
| Time window (Window) | 90 days | Also understands weeks, months (30 days), quarters (90), years |
| Includes | paying customers | Comma-separated populations |
| Excludes (Exclusions) | trial accounts, internal test accounts | Comma-separated populations |
| Source tables (Source) | billing.subscriptions | Used if there is no SQL block |

Optionally add a **Code** block with language SQL containing the calculation. OneNumber reads its aggregation (`COUNT(DISTINCT …)`, `SUM(…)` …), source tables, `WHERE` filters and rolling window (`INTERVAL '90 days'`, `DATEADD(day, -30, …)`, `current_date - 7`). A window written in the table takes priority over one found in SQL.

## What counts as a conflict

| Difference | Severity |
|---|---|
| Different time window | High |
| Different calculation (function or column) | High |
| Same field filtered differently | High |
| Only one definition states a window | Medium |
| Different inclusions or exclusions | Medium |
| A filter present in only one definition | Medium |
| Different source tables | Low |

A metric is **trusted** when its definitions agree and exactly one is canonical, **disputed** when any conflict exists, and **unverified** otherwise.
