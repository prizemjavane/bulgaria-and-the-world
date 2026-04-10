# Knowledge Base

Markdown files rendered on the main timeline page via the `marked` library. Each file provides background context for a corresponding dataset. Content is in Bulgarian.

## Linking

Each Gantt dataset file can reference its knowledge base article via the `knowledge` field (e.g., `"knowledge": "nations"`), which resolves to `nations.md`. When the user selects a dataset, the IndexComponent fetches the corresponding Markdown via `DataService.getKnowledge()` and renders it alongside the chart.
