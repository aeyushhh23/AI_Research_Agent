# Evaluation Framework

Evaluation is intentionally dynamic. The app does not display fabricated quality metrics.

The backend evaluator loads a completed research project, its persisted sources, and tool-call telemetry, then asks the configured LLM to score:

- relevance
- factual consistency against supplied sources
- source/citation coverage
- tool selection
- tool execution success
- memory retrieval relevance
- failure handling

Scores are only meaningful after a real research run has completed. Missing sources, failed tools, or unavailable providers should reduce scores and appear in evaluator notes.

Future expansion can add a `POST /api/research/:id/evaluate` endpoint and store evaluation runs in a dedicated table.
