# DL-06-T16 — Complete Chatbot Workflow Evaluation and Refactor

## Task

**DL-06-T16 — Evaluate and refactor the complete chatbot workflow, including tool-selection accuracy.**

Target repository: `kevke-edu/DiscountMate_new`  
Reviewed implementation: `feature/LLMRAG_explore`

## 1. Workflow evaluated

The current chatbot path is:

1. `Frontend/app/(tabs)/RecipeBot.tsx`
2. `POST /api/ml/recipe/chat` on the Node/Express backend
3. `Backend/src/controllers/ml.controller.js` proxies to the Python ML service
4. `POST /api/recipe/chat` in `Backend/ml-service/app.py`
5. `RecipeRAG.chat()` in `Backend/ml-service/recipe_rag/rag_pipeline.py`
6. Sentence-transformer recipe retrieval
7. MongoDB/product matching
8. OpenRouter → HuggingFace LLM cascade
9. The answer returns to the frontend
10. If `products_pending=true`, the frontend asynchronously calls `/api/ml/recipe/products` and renders product cards

The two-stage answer/product-card frontend contract is retained by the refactor.

## 2. Problems found

### A. No explicit pre-execution tool selector

The existing `RecipeRAG.chat()` always performs recipe retrieval and always prefetches product candidates before the LLM has determined whether either operation is necessary. Even an unsupported request such as a weather or coding question therefore reaches retrieval/product logic first.

### B. Off-topic guardrail happens too late

Unsupported-topic handling is defined in the LLM system prompt. This means an off-topic message can consume retrieval, product lookup and LLM capacity before being rejected.

### C. Product-tool decision depends on generated prose

`_should_attach_products()` uses regex checks against the generated answer to decide whether product cards should be attached. Generated prose is not a reliable tool router. Tool permission should be decided before execution; output inspection should only control presentation.

### D. Referential follow-ups can retrieve the wrong recipe

Queries such as `show me the second one` are semantically weak embedding queries. The existing workflow runs a new recipe search instead of reusing the previous candidate set.

### E. Ordinal recipe selection can fall back to the first result

`_select_recipe_for_answer()` defaults to `results[0]` when it cannot identify a recipe name. An ordinal follow-up such as `the second one` can therefore associate products with the first recipe.

### F. Tool decisions are not observable

The API response does not expose which tools the workflow selected, making routing regressions difficult to test and diagnose.

## 3. Refactor completed

### Deterministic `ChatToolSelector`

A lightweight router now selects the minimum tool set before embeddings, MongoDB or LLM generation.

| Intent | Recipe search | Product lookup | LLM |
|---|---:|---:|---:|
| Unsupported/off-topic | No | No | No |
| Recipe browse/search | Yes | No | Yes |
| Detailed/full recipe | Yes | Yes | Yes |
| Shopping/product request | Yes | Yes | Yes |
| Referential recipe follow-up | Reuse previous candidates when available | Only if detail/product intent requires it | Yes |

### Early deterministic guardrail

Unsupported requests return the existing DiscountMate recipe-only message immediately. This prevents unnecessary embeddings, MongoDB access and provider calls.

### Previous-result reuse

The workflow stores the last recipe candidate set per session. Referential follow-ups reuse those results instead of searching for phrases such as `the second one`.

### Explicit ordinal handling

`first`, `second`, `third`, `1st`, `2nd`, and `3rd` references are resolved to safe result indexes before fuzzy/name matching.

### Product grounding tied to the intended recipe

For product-enabled turns, the selected recipe is resolved before generation so the product names supplied to the prompt are MongoDB-grounded and attached to the intended recipe.

### Product regex demoted to presentation validation

`_should_attach_products()` remains useful for deciding whether cards make sense beneath a generated response, but it no longer grants permission to execute the product tool.

### Tool-selection telemetry

Chat responses gain an additive `tool_selection` object containing:

- `intent`
- `tools`
- `reason`
- `confidence`
- `reuse_previous_results`
- `reused_previous_results` (runtime trace)

The existing frontend can ignore this field, so the API remains backwards-compatible.

### Input hardening

The refactored workflow normalises the message, caps message input at 2,000 characters, and clamps `top_k` to `1..8`.

## 4. Tool-selection evaluation

A labelled 30-case regression suite was created covering:

- recipe browsing
- detailed recipes
- shopping/product requests
- referential follow-ups
- ordinal follow-ups
- explicit unsupported topics
- off-topic messages after recipe history

Exact selected-tool-set accuracy:

- **Current workflow baseline: 10/30 = 33.3%**
- **Refactored selector: 30/30 = 100.0%**

This is a controlled regression benchmark against the reviewed routing behaviour, not a production-traffic accuracy claim.

## 5. Automated tests

`test_tool_selector.py` contains 7 unit tests covering the core routing guarantees.

Result:

```text
.......
----------------------------------------------------------------------
Ran 7 tests

OK
```

The apply script was also smoke-tested against a structural mock of the reviewed `rag_pipeline.py`; the patched file and all added Python files compile successfully.

## 6. Files in this completion bundle

- `apply_dl06_t16.py` — guarded integration script
- `repo_files/Backend/ml-service/recipe_rag/tool_selector.py` — new tool selector
- `repo_files/Backend/ml-service/test_tool_selector.py` — unit tests
- `repo_files/Backend/ml-service/evaluate_tool_selection.py` — 30-case regression evaluation
- `DL-06-T16_COMPLETION.md` — this evaluation/completion record

## 7. Apply and validate

From the extracted bundle:

```bash
python apply_dl06_t16.py /path/to/DiscountMate_new
cd /path/to/DiscountMate_new/Backend/ml-service
python test_tool_selector.py
python evaluate_tool_selection.py
python -m py_compile recipe_rag/rag_pipeline.py recipe_rag/tool_selector.py
```

The integration script:

- verifies structural anchors from the reviewed chatbot branch;
- aborts if the target differs unexpectedly;
- creates `rag_pipeline.py.dl06t16.bak` before modification;
- adds the selector and test/evaluation files;
- replaces only the chatbot orchestration and required state/import hooks.

## 8. Repository write status

The connected GitHub account has read access to `kevke-edu/DiscountMate_new` but not push permission. The implementation is therefore delivered as a ready-to-apply, tested bundle rather than committed directly to the upstream repository.
