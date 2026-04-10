# Data Directory

Runtime JSON datasets in `public/data/` loaded dynamically by the application. All historical data is in Bulgarian.

## Contents

- [Files](#files)
- [Date Encoding](#date-encoding)
- [Data Structures](#data-structures)
  - [Gantt Dataset](#gantt-dataset-dataset-json) — `dataset-*.json`
  - [Event / Person Overlay](#event--person-overlay-eventsjson-personsjson) — `events.json`, `persons.json`
  - [Date Markers](#date-markers-datesjson) — `dates.json`
  - [Manifest](#manifest-manifestjson) — `manifest.json`
  - [Defaults](#defaults-defaultsjson) — `defaults.json`
  - [Quotes](#quotes-quotesjson) — `quotes.json`
  - [Source](#source-shared-across-all-types) — shared across all types

## Files

| File             | Description                                                                                                                                                                                                                                                                                                                                                             |
|------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `manifest.json`  | Registry of all data files. Each entry has a `file` path and optional `datasets` array indicating which dataset must be active for that file to display.                                                                                                                                                                                                                |
| `defaults.json`  | Controls initial visibility. Maps each dataset ID to lists of event and line UUIDs that are shown on first load.                                                                                                                                                                                                                                                        |
| `dataset-*.json` | Gantt datasets. Each file defines a dataset with an `id`, `name`, and `data` array of entities (countries, organizations). Each entity contains `periods` — time ranges with names, dates, and sourced references. Dataset files cover topics such as nations, international organizations (EU, NATO, BRICS, etc.), geopolitical regions, and military/political pacts. |
| `events.json`    | Key historical events rendered as colored background regions on the timeline (e.g., Egyptian pyramids, World Wars). Each event has periods with date ranges, descriptions, and sources.                                                                                                                                                                                 |
| `events-religions.json` | Additional events overlay loaded conditionally when the religions dataset is active. Same structure as `events.json`.                                                                                                                                                                                                                                            |
| `persons.json`   | Historical figures rendered similarly to events. Each person entry covers their lifetime or period of influence, with biographical descriptions and sources.                                                                                                                                                                                                            |
| `dates.json`     | Vertical marker lines on the timeline for key dates (e.g., start of the Common Era, Bulgarian anniversary years). Each entry has a date, label, and line style (color, width, type).                                                                                                                                                                                    |
| `quotes.json`    | Array of historical quotes displayed in the quotes carousel. Each quote includes Bulgarian translation, original text, English translation, attribution, and source URLs. Not listed in `manifest.json` — loaded directly by the QuotesComponent.                                                                                                                        |

## Date Encoding

All dates use two parallel representations:

- **`range`** — array of two ISO 8601 strings (start, end). BCE dates use zero-padded negative years: `"-001500-01-01"` for 1500 BCE. An open-ended range uses `null` as the second element.
- **`from` / `to`** — objects with numeric fields used for programmatic sorting and display:
  - `dateYear` (number) — negative for BCE, positive for CE
  - `dateMonth` (number, optional) — 1-based month

For point-in-time dates (date markers), a single `date` string and `dateYear` number are used instead of a range.

## Data Structures

### Gantt Dataset (`dataset-*.json`)

Top-level object representing a thematic dataset.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique dataset identifier (e.g., `"nations"`) |
| `name` | string | Display name (Bulgarian) |
| `description` | string? | Dataset description |
| `knowledge` | string? | Links to a knowledge-base markdown file |
| `metadata.color` | string? | Default color |
| `metadata.styles` | object? | Named style presets (`{ [name]: { opacity?, color? } }`) |
| `metadata.resetZoom` | boolean? | Reset zoom when switching to this dataset |
| `data` | GanttEntity[] | Rows on the chart |

**GanttEntity** — a row on the chart (country, organization, empire):

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display label (e.g., `"България"`) |
| `id` | string | UUID v4 |
| `code` | string? | Country code for flag display (e.g., `"bg"`) |
| `description` | string? | Tooltip description |
| `datasets` | string[]? | Other datasets this entity also appears in |
| `knowledgeId` | string? | Override knowledge-base article ID |
| `periods` | GanttPeriod[] | Time bars within this entity |

**GanttPeriod** — a single time bar within an entity:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Period label (e.g., `"Древна Тракия (1500–480 г.пр.н.е.)"`) |
| `description` | string? | Detailed description |
| `comment` | string? | Editorial note (not displayed to users) |
| `type` | string? | Period category |
| `flag` | string? | Country flag code override for this period |
| `style` | string? | References a named style from `metadata.styles` |
| `meta.style.color` | string \| LinearGradient? | Color override |
| `meta.visible` | boolean? | Visibility override |
| `date.range` | [string, string?] | ISO 8601 start/end (`null` = open-ended) |
| `date.from` | DatePoint? | Programmatic start (`{ dateYear, dateMonth? }`) |
| `date.to` | DatePoint? | Programmatic end |
| `sources` | Source[]? | References |

---

### Event / Person Overlay (`events.json`, `persons.json`)

Top-level object for a collection of events or historical figures, rendered as semi-transparent colored regions behind the Gantt bars.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Collection name (e.g., `"Събития"`, `"Личности"`) |
| `type` | `"events"` | Always `"events"` |
| `content` | string? | Content identifier (e.g., `"events"`, `"persons"`) |
| `data` | EventGroup[] | Groups of related periods |

**EventGroup** — a group of related periods (e.g., one person's life, or one multi-phase event):

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID v4 |
| `datasets` | string[]? | Which datasets this group is associated with |
| `tags` | string[]? | Categorical tags (e.g., `"литература"`, `"България"`) |
| `meta.style.color` | string? | Background color (typically rgba with low alpha) |
| `meta.visible` | boolean? | Visibility override |
| `style.color` | string? | Color |
| `periods` | EventPeriod[] | Time spans within this group |

**EventPeriod** — a single time span within a group:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name (e.g., `"Египетските пирамиди"`) |
| `description` | string? | Subtitle / short description |
| `comment` | string? | Editorial note explaining date choices or historiographic context |
| `date.range` | [string, string?] | ISO 8601 start/end (`null` = open-ended) |
| `date.from` | DatePoint? | Programmatic start (`{ dateYear, dateMonth? }`) |
| `date.to` | DatePoint? | Programmatic end |
| `sources` | Source[]? | References |

---

### Date Markers (`dates.json`)

Vertical lines drawn on the timeline at specific points in time.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `"lines"` | Always `"lines"` |
| `type` | `"lines"` | Always `"lines"` |
| `name` | string | Collection name (e.g., `"Ключови дати"`) |
| `data` | DateLine[] | Individual date markers |

**DateLine** — a single vertical marker:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | UUID v4 |
| `name` | string | Label (e.g., `"Нова ера (1 г.)"`) |
| `description` | string? | Tooltip description |
| `datasets` | string[]? | Associated datasets |
| `tags` | string[]? | Categorical tags |
| `date.date` | string? | ISO 8601 date string |
| `date.dateYear` | number | Numeric year |
| `color` | string? | CSS color (e.g., `"#1d4ed8"`) — top-level line color |
| `lineStyle.type` | string? | `"solid"`, `"dashed"`, or `"dotted"` |
| `lineStyle.width` | number? | Line width in pixels |
| `lineStyle.shadowBlur` | number? | Glow effect radius |
| `lineStyle.shadowColor` | string? | Glow color |
| `sources` | Source[]? | References |

---

### Manifest (`manifest.json`)

Array of entries that tell the application which files to load and their dataset dependencies. Files without `datasets` are always loaded; files with `datasets` are conditionally loaded when the user activates that dataset.

| Field | Type | Description |
|-------|------|-------------|
| `file` | string | Filename relative to `public/data/` |
| `datasets` | string[]? | Only load when one of these datasets is active |

---

### Defaults (`defaults.json`)

Controls which events and date markers are visible on initial load, plus application-level defaults. Keyed by dataset ID, with `_global` for items visible regardless of active dataset.

| Field | Type | Description |
|-------|------|-------------|
| `fuzzySearchThreshold` | number? | Fuse.js fuzzy search threshold (e.g., `0.2`) |
| `infoPanelPosition` | string? | Default info panel position (e.g., `"bottom"`) |
| `singleSelectionMode` | boolean? | Whether only one item can be selected at a time |
| `_global.events` | string[] | Event group UUIDs visible in all datasets |
| `_global.lines` | string[] | Date line UUIDs visible in all datasets |
| `[datasetId].events` | string[] | Event group UUIDs visible when this dataset is active |
| `[datasetId].lines` | string[] | Date line UUIDs visible when this dataset is active |

---

### Quotes (`quotes.json`)

Array of historical quotes displayed in a rotating carousel on the main page. Not registered in `manifest.json` — loaded directly by the QuotesComponent.

| Field | Type | Description |
|-------|------|-------------|
| `quote` | string | Quote text in Bulgarian |
| `from` | string | Attribution (e.g., `"Марк Аврелий, Размисли, Книга II.17"`) |
| `date` | string? | Date or date range (e.g., `"170–180"`, `"~1803"`) |
| `original` | string? | Original text in source language |
| `en` | string? | English translation |
| `sources` | string[]? | Reference URLs |

---

### Source (shared across all types)

Every period and date marker can include sourced references.

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Source title (e.g., `"Траки – Уикипедия"`) |
| `url` | string[] | One or more reference URLs |
| `quote` | string? | Relevant quote in Bulgarian |
| `quoteOriginal` | string? | Original quote in source language (when non-Bulgarian) |
| `date` | string? | Specific date the source refers to |
| `from` | DatePoint? | Source-specific start date (`{ dateYear }`) |
| `to` | DatePoint? | Source-specific end date (`{ dateYear }`) |
