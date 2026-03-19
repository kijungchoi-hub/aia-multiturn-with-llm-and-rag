# Verification Summary

- Generated at: 2026-03-19 19:09:45
- Scope: local runtime verification

## Covered Checks

- intent classification
- visible query rewrite validation
- multi-domain retrieval
- multi-search comparison
- original query vs rewritten query comparison
- score and reranker score comparison
- CSV reflection check for `data/MULTITURN_20260306.csv`

## Local Runtime Rewrite Test

Artifacts used:

- `logs/test-local-intent-multidomain-multisearch.latest.json`
- `logs/test-local-intent-multidomain-multisearch.latest.md`

Verified results:

- greeting intent routed to `answer_direct`
- compound question routed to `search`
- supervisor returned a `rewritten_query`
- judge returned `suggested_rewrite` and `retry_allowed: true`
- retrieval covered multiple domains including `research`, `general`, `memory`, and `dialog`
- `/chat` returned citations and `retrieval_used: true`

Rewrite comparison summary:

- original query: `Dify workflow 문서와 memory 사용 가이드를 같이 찾아서 요약해 주세요.`
- rewritten query: `Dify workflow 문서와 memory 사용 가이드를 같이 찾아서 요약해 주세요. 기준일 절차 조건 예외`
- top hit changed: `true`
- original top1: `Dify DSL “스켈레톤” 예시(YAML)`
  - score: `3.75`
  - reranker_score: `4.125`
- rewritten top1: `2) 문서유형 필터 정의`
  - score: `4`
  - reranker_score: `4.4`

## CSV Reflection Check

Target file:

- `data/MULTITURN_20260306.csv`

Verified results:

- CSV rows were loaded into the runtime corpus
- runtime `corpus_size` was observed as `525`
- row-based queries from the CSV produced search hits from `data/MULTITURN_20260306.csv`
- `/chat` also returned CSV-backed citations for tested CSV questions

Example observations:

- row 1 question returned CSV hits with `row_no: 1`
- row 2 question returned CSV hits with `row_no: 2`
- source path matched `data/MULTITURN_20260306.csv`

## Known Limitation

- CSV ingestion is working, but citation titles are still shown mainly as the `구분` value such as `API+RAG`
- row number and question preview are not yet reflected in citation titles
- this is a presentation issue, not a CSV loading issue