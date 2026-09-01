# Garment identity ambiguity benchmark

Fit-check garment identity uses visual embedding retrieval first. Strong, separated results auto-match immediately. Results that would otherwise require confirmation get one conservative direct-image comparison across the query crop and up to three candidate images. The direct model may auto-match at confidence `>= 0.92`, or return a confident exact-item `none` result so the observation stays unresolved without showing correction UI. Weak embedding results do not invoke the model.

This design keeps the common path fast and makes correction a last resort. Its tradeoff is one extra multimodal request, candidate-image fetch latency, and model cost for ambiguous observations. Direct comparison can distinguish instance details that global embeddings flatten, but should be judged on a representative closet fixture set before thresholds change.

## Fixture format

Use consented/de-identified crops and keep fixtures outside the repository when they contain user photos.

```json
[
  {
    "id": "case-001",
    "queryImage": "images/query-001.jpg",
    "expectedWardrobeItemId": "item-a",
    "candidates": [
      {
        "wardrobeItemId": "item-a",
        "image": "images/item-a.jpg",
        "embeddingScore": 0.88,
        "category": "top",
        "description": "navy shirt with contrast buttons"
      }
    ]
  }
]
```

Candidate order and scores must be the actual output of the production embedding retrieval path. Use `expectedWardrobeItemId: null` when the query is a genuinely new item.

## Running

Embedding-policy baseline only:

```sh
bun run --cwd apps/web benchmark:garment-identity --fixtures=/absolute/path/to/fixtures.json
```

Embedding policy plus live direct comparison:

```sh
GEMINI_API_KEY=... bun run --cwd apps/web benchmark:garment-identity --fixtures=/absolute/path/to/fixtures.json --model
```

To estimate dollars from observed token usage, also provide current prices rather than baking volatile prices into code:

```sh
BENCHMARK_INPUT_USD_PER_MILLION_TOKENS=... \
BENCHMARK_OUTPUT_USD_PER_MILLION_TOKENS=... \
GEMINI_API_KEY=... \
bun run --cwd apps/web benchmark:garment-identity --fixtures=/absolute/path/to/fixtures.json --model
```

The JSON report includes accuracy, automatic-match coverage and precision, fallback call rate, p50/p95 measured latency, token usage, and cost when pricing is supplied. Its embedding timing intentionally covers only local decision policy because the fixtures contain precomputed retrieval scores; it does not pretend to measure query embedding or Convex vector-search latency. Direct comparison timing includes local fixture reads and the model request, while production candidate network fetches may differ.

Do not present a benchmark as production evidence unless the fixture labels were manually verified, the sample includes duplicate-looking and genuinely new items, and the model run used real credentials. No production benchmark result is checked into this repository.
