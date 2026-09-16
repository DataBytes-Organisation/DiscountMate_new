---
title: "Recipe Retrieval Augmented Generation & LLM Documentation "
sidebar_label: "LLM Retrieval Augmented Generation"
sidebar_position: 2
---

# Recipe RAG & LLM Pipeline Documentation and Review


For a step by step walkthrough on the general structure and implementation, from a data science point of view, of the RAG pipeline please see the notebook exploration in the following location `experimental\LLM_RAG_TESTING\LLM_RAG_EXPERIMENT.ipynb`. Note that the full pipeline has been deployed and the experimental notebook can be used mainly for testing and insights. The following documentation covers the full pipeline which was submitted via PR #274.

Importantly for both the `Backend\ml-service\recipe_rag\rag_pipeline.py` and the exploration notebook you will need the OpenRouter and HuggingFace API keys added to the backend '.env' folder. These can be requested from your academic project mentor. These will be added in the following format:
:::tip[Key Environment Variables]
```
OPEN_ROUTER_API_KEY = sk-or-v1.....................................
HUGGING_FACE_TOKEN = "hf_T................................." 
GOOGLE_CLOUD_PROJECT=sit-26t1-discountmate-935cb94
RAG_BUCKET_NAME=discountmate-ml-models
RAG_OBJECT_PREFIX=recipe_rag/
```
:::

## High-Level Overview: RAG and LLM Access via Hosted APIs

**Retrieval-Augmented Generation (RAG):** RAG, which stands for Retrieval-Augmented Generation, is an AI framework that combines the strengths of traditional information retrieval systems (such as search and databases) with the capabilities of generative large language models (LLMs).

RAGs operate with a few main steps to help enhance generative AI outputs ([What is Retrieval-Augmented Generation (RAG)?](https://cloud.google.com/use-cases/retrieval-augmented-generation)):

- Retrieval and pre-processing: RAGs leverage powerful search algorithms to query external data, such as web pages, knowledge bases, and databases. Once retrieved, the relevant information undergoes pre-processing, including tokenization, stemming, and removal of stop words.
- Grounded generation: The pre-processed retrieved information is then seamlessly incorporated into the pre-trained LLM. This integration enhances the LLM's context, providing it with a more comprehensive understanding of the topic. This augmented context enables the LLM to generate more precise, informative, and engaging responses.

The goal therefore for discountmate is to prevent chatbots and LLMs from inventing recipes (although they are well equipped to do so) but instead we want the LLMs to utilise and present to the end user the recipes that we have previously scraped. 

The pipeline calls into LLMs hosted via APIs, and uses a **cascade** based approach:

- **Primary:** [OpenRouter](https://openrouter.ai) — the website states that they are 'a unified interface for LLMs'. OpenRouter lets you call many model providers (NVIDIA Nemotron family, Meta, Mistral, Anthropic, OpenAI, Google Gemini) through a single OpenAI-compatible REST endpoint. Authentication is an `OPEN_ROUTER_API_KEY` bearer token. OpenRouter exposes generous free tiers for several Nemotron and Qwen models, which is why we picked it as primary.
- **Fallback:** [HuggingFace Inference Router](https://huggingface.co/docs/api-inference) — also OpenAI-compatible, used when OpenRouter is rate-limited or returns 5xx. Authentication is a `HUGGING_FACE_TOKEN`

The key benefit of the router/cascade approach is **resilience**: if the cheapest free model is busy, the request automatically falls through to the next model and then to the next provider, instead of returning a hard error to the user.

Schematic Overview of RAG: ![RAG General](img\general_rag_overview.png "RAG")

**Note** that the *gemini* models via the Google AI SDK were also tested initially however strict rate limits, even after one or two prompts,  were encountered even on the free models. Thus development with this model did not continue and the OpenRouter API became the primary method for LLM utilisation in this feature. 

## High-Level Overview of the Recipe RAG Pipeline

The main objective of the RAG-LLM pipeline looks something like the following:

> Let a user have a natural-language conversation about recipes — "what can I make with chicken and rice?", "show me the full lentil patties recipe", "what's a quick vegetarian dinner?" — and return answers that are **grounded in real recipes** that have been scraped. The pipeline was originally designed to allow for placeholder for later GCP product retrieval for 'on special products' substituted directly into the LLM response, however this has been swapped out in the short/intermediate term for real product cards via the MongoDB inventory. The product cards with product images allow for a more interactive experience. 

The high-level flow for a single chat turn is:

1. **Embed** the user's query with `all-mpnet-base-v2` via the sentence transformer library
2. **Retrieve** the top-k recipes by cosine similarity over the precomputed recipe embedding matrix.
3. **Match** each ingredient line against the product embedding index to get candidate barcodes/product IDs.
5. **Build prompt**: a system prompt + retrieved recipes + the constrained list of product names (now being computed via MongoDB).
6. **Generate** with the LLM cascade with OpenRouter `nemotron-3-super-120b-a12b:free` as the first line model.
7. **Return** the answer to the frontend immediately, and  fetch the product cards (see PR #277) for the chat bubble.

## High-Level Overview: ML Model Deployment via Flask and Node

DiscountMate's backend follows a **two-process micro-service architecture**:

- A **Node.js / Express** server (`Backend/server.js`) is the public API. It handles authentication. It is the **only** process the frontend ever talks to.
- A **Python / Flask** ML service (`Backend/ml-service/app.py`) hosts every model that needs a Python runtime — the recipe RAG, the OCR receipt parser, weekly specials, recommendations, etc. It is configured  on `http://localhost:5001` by default as per the app.py. 

The Node server proxies any request whose URL starts with `/api/ml/...` through to Flask using `axios`. The browser never knows that Python exists; it just sees one consistent Express API.

## 1 RAG Layer Walkthrough

This section walks through the Python modules in `[Backend/ml-service/recipe_rag/]`

### 1.1 preprocess.py — Recipe ingestion and chunk generation

The Woolworths recipes were scraped as JSON-LD pages — semi-structured JSON inside HTML. `preprocess.py` is the pure data-transformation layer that flattens those pages into:

- a single readable **text chunk** per recipe (the unit of embedding), and
- a parallel **metadata dict** (name, ingredients, instructions, prep/cook time, servings) used for retrieval display and downstream prompt construction.

Key functions within this script:
- `parse_duration(iso_str)` — converts ISO-8601 durations like `PT30M`, `PT1H15M` into readable strings like `30m`, `1h 15m`.
- `recipe_json_to_text(data)` — the per-recipe transformer. Accepts either a bare dict or a JSON-LD `@graph` list, extracts the entry with `@type == "Recipe"`, strips known Woolworths boilerplate from the description, and formats the recipe into a uniform multi-line text block plus a metadata dictionary. Returns `(None, None)` for non-Recipe pages or generic landing-page boilerplate so they are skipped from the index.
- `load_recipes_from_directory(recipe_dir)` — bulk loader that walks a folder of `.json` files, applies `recipe_json_to_text` to each, and returns a list of `{text, metadata, source_file}` dicts. It tracks and prints skip and error counts so corrupt files are visible.
- `extract_unique_ingredients(recipes)` — builds a deduplicated list of ingredient strings and a `{ingredient → [recipe_indices]}` reverse-mapping. This is the input to the *ingredient* embedding step (see 4.4).

### 1.2 Embeddings and Models

An **embedding** is a fixed-length numeric vector that represents the meaning of a piece of text. Two pieces of text that are semantically similar (e.g. "creamy chicken pasta" and "chicken alfredo") will have vectors with a small cosine distance, even though they share few words. This is what makes "find the most relevant recipe" possible in a way that keyword search cannot achieve.

The **`sentence-transformers/all-mpnet-base-v2`** model was used for embeddings. It maps sentences & paragraphs to a 768 dimensional dense vector space and can be used for tasks like clustering or semantic search [HuggingFace Sentence Transformer](https://huggingface.co/sentence-transformers/all-mpnet-base-v2)

Embeddings are computed **offline** (not at every request). The build script:

1. Calls `load_recipes_from_directory` to get the text chunks.
2. Calls `model.encode(texts)` to produce an `(N, 768)` numpy array.
3. Saves the array to `recipe_index.npz` and the metadata to `recipe_metadata.json` inside `Backend/ml-service/recipe_rag/index/`.

The same procedure is repeated for the product CSV to produce `product_index.npz` and `product_metadata.json`. The product embeddings are computed by embedding each product's name/description string.

These `.npz` files are several hundred MB and **must not be committed to git** (the repo's `.gitignore` excludes `index/*.npz` and `index/*.json`). Instead, they are uploaded to the team's **Google Cloud Storage bucket** under:

```
gs://discountmate-ml-models/recipe_rag/
```

This bucket is the shared source of truth for index artefacts. Anyone who clones the repo can fetch them on first run via the loader described below.

### 1.3 gcs_loader.py — Local cache + GCS fallback

The Index folder files are too big for git, but they must exist on disk before the pipeline can start. `gcs_loader.py` is the bridge: it transparently downloads any missing index file from GCS on first use, then caches it locally so subsequent runs are offline.

How it differs from a pure-local loader:

- A pure-local loader would simply `np.load("index/recipe_index.npz")` and crash if the file was missing.
- This loader checks first if the file exists locally, and only contacts GCS when it does not. On a developer machine with the indexes already present, it makes **zero network calls**.
- It is **environment-aware**: in Cloud Run (detected via the `K_SERVICE` env var), it writes to `/tmp/recipe_rag/` because the container filesystem is read-only elsewhere. In local dev it writes to `Backend/ml-service/recipe_rag/index/`.

Key functions as part of the this python script:

- `_is_gcp_serverless()` — returns `True` when `K_SERVICE` or `GAE_SERVICE` env vars are set, indicating a Cloud Run / App Engine runtime.
- `_resolve_local_index_dir()` — picks the cache directory based on the environment (`/tmp/recipe_rag` in Cloud Run, repo-local otherwise).
- `_download_one(blob_name, dest_path)` — atomic download of a single GCS object to a local path. Uses Application Default Credentials, writes to a `.{name}.download` temp file first and `os.replace`s on success so a half-finished download never poisons the cache.
- `get_local_index_dir()` — convenience getter that returns the resolved cache directory as a string.
- `ensure_index_file(filename, index_dir=None)` — the **public API used by the rest of the pipeline**. Returns the local path to the file, downloading from GCS if missing. Idempotent and safe to call repeatedly.
- `ensure_all_indexes(index_dir=None)` — bulk variant that downloads every file listed in `INDEX_FILES` in parallel using a `ThreadPoolExecutor`. Used at startup if you want to pre-warm the cache.

This means the developer workflow is now: `gcloud auth application-default login` once, then `python app.py` — the indexes appear automatically on first launch.

### 1.4 rag_pipeline.py — The runtime pipeline

This is the single module loaded by Flask at startup that holds the embedding model, the recipe index, the product matcher, the MongoDB resolver and the LLM client. One instance, shared across all concurrent requests, with per-session chat history stored in an in-memory dict.

The module is structured around four cooperating classes plus a top-level `RecipeRAG` orchestrator.

#### `LLMClient` (top of file)
Wraps the OpenRouter → HuggingFace cascade. Knows the list of models for each provider, sends OpenAI-compatible `chat/completions` requests, and on any failure (timeout, 4xx, 5xx) falls through to the next model and then the next provider, raising only if every option has been exhausted. This is what makes the chatbot resilient to free-tier rate limits.

#### `RecipeRetriever`
Loads and searches the recipe embedding index.

- `__init__(embedding_model, index_dir)` — stores the model, calls `_load()`.
- `_load()` — calls `ensure_index_file("recipe_index.npz")` and `ensure_index_file("recipe_metadata.json")` (so missing files are fetched from GCS), validates that the embedding matrix length matches the metadata list, and pre-normalises the embeddings for cosine similarity. Raises `FileNotFoundError` (not a soft warning) if GCS is also unreachable — without a recipe index the pipeline cannot function.
- `search(query, top_k)` — encodes the query, computes a cosine similarity vector against the precomputed embedding matrix using a single matrix multiply, returns the top-k recipes with their rank, score, text and metadata.

#### `ProductMatcher`
Loads and searches the **ingredient → product candidate** embedding index. This is the layer that maps each recipe ingredient line ("400 g chicken breast, diced") to a candidate supermarket product record from the scraped CSV.

- `__init__(embedding_model, index_dir, threshold=0.55)` — stores config, calls `_try_load()`.
- `_try_load()` — same GCS-aware loading as `RecipeRetriever`, but **degrades gracefully**: if the product index is missing it disables product annotations (sets `self.enabled = False`) rather than crashing the whole chatbot. This is a deliberate choice — the chatbot is still useful without product cards.
- `_prune_match_cache()` — TTL + LRU-style eviction for the per-ingredient candidate cache so memory does not grow unbounded.
- `batch_find_product_candidates(ingredients)` — the workhorse called per chat turn. Batch-encodes all unseen ingredient strings at once, computes one `(n_products, n_ingredients)` similarity matrix, and returns `{ingredient → candidate | None}` for each. Caches results so repeated ingredients (e.g. "salt") are free on subsequent turns.
- `find_query_product_candidates(query, top_k)` — same idea but applied to the *user's query directly*, used to seed product candidates before generation when the user asks something like "what beef products do you have?".

#### `MongoProductResolver`
Connects to MongoDB and resolves the candidate barcodes/product IDs from `ProductMatcher` into real product documents with live names, prices and images. See PR #277 which adds this modification from the original substitution from the scraped csv and pulls from mongo directly. Once the migration from MongoDB to GCP postgres, this section will need to be reworked. 

#### `RecipeRAG` (the orchestrator)
Loads the embedding model once, instantiates the retriever, the product matcher, the Mongo resolver and the LLM client, and exposes the public `chat(session_id, message, top_k)` method that Flask calls. It also manages:

- a per-session `sessions[session_id]` list capped at `MAX_TURNS_PER_SESSION` to bound prompt length and cost;
- a `_context_store[context_id]` mapping that lets the frontend fetch product cards in a second async call after the LLM response has already been sent to the user.

### 1.4 Google Cloud Storage for key vector files

`recipe_index.npz` and `product_index.npz` were uploaded by hand once into `gs://discountmate-ml-models/recipe_rag/` and the GCS loader pulls them down whenever a fresh clone is run.

## 2. Backend Layer — Flask Service + Node Proxy

### 2.1 Backend/ml-service/app.py — The Flask ML service

The Flask app is the only public surface of the Python ML world. It does three things: instantiate the heavy ML objects **once** at startup, expose them as HTTP endpoints, and translate Python exceptions into well-formed JSON error responses.

At process start, after importing the `RecipeRAG` class, the module-level code attempts `rag = RecipeRAG()`. This single line triggers:

1. Loading `all-mpnet-base-v2` into RAM (~440 MB).
2. Loading the recipe embedding matrix and metadata (via the GCS loader if needed).
3. Loading the product embedding matrix and metadata (optional — falls back to disabled).

If any *required* step fails the whole RAG is marked `RAG_READY = False` and every `/api/recipe/*` endpoint returns HTTP 503 with a structured error. This is by design — a broken RAG should not crash the OCR endpoint or the weekly specials endpoint, which live in the same Flask proces

The RAG-related endpoints are:

- `GET  /health` — process liveness check.
- `GET  /api/recipe/stats` — diagnostic: is the RAG warm? how many recipes are loaded? how many sessions are active? Used by the frontend chat panel to show "RAG offline" gracefully.
- `GET  /api/recipe/search?q=...&top_k=...` — **retrieval only**, no LLM. Returns the top-k recipes by cosine similarity. Fast, free, used for autocomplete-style features and for debugging retrieval quality without paying for LLM tokens.
- `POST /api/recipe/chat` — **full RAG**. Body is `{session_id, message, top_k?}`. Returns the LLM-generated answer plus a `recipe_context_id` for the second-stage product fetch and a `limit_reached` flag once the session has used its quota of turns.
- `POST /api/recipe/reset` — clears one session's chat history.
- `GET  /api/recipe/products?context_id=...` — second-stage product card fetch. Returns the list of MongoDB-resolved products (name, price, image URL, internal product URL) for a previously completed chat turn. The frontend calls this asynchronously after the chat bubble has rendered so the user sees the text immediately and product cards appear a moment later. This was implemented as part of PR #277.

The Node proxy uses a generous 200 s axios timeout to allow for the LLM API and RAG pipeline to finish processing. Future efforts could look into speeding this up or implement streaming where tokens are streamed live to the user rather than being delivered all at once, however this will require significant modification to the architecture.

### 2.2 Backend/src/controllers/ml.controller.js — Express → Flask proxy

The controller file is a collection of thin **API-gateway-pattern** handlers. Each one:

1. Reads the request body or query string from Express.
2. Calls the corresponding Flask URL with `axios`, forwarding the payload verbatim.
3. Returns Flask's response body directly to the browser, or translates connection errors (`ECONNREFUSED`, `ETIMEDOUT`) into well-formed 503/504 responses with friendly messages.

The controller's job is purely **transport and error translation**. This keeps the boundary clean: any change to the RAG logic is a Python-only change; any change to auth, routing or CORS is a Node-only change.

The recipe-specific handlers are:

- `getRecipeStats` → `GET /api/recipe/stats`
- `getRecipeSearch` → `GET /api/recipe/search`
- `postRecipeChat` → `POST /api/recipe/chat` (note the 200 s timeout)
- `postRecipeReset` → `POST /api/recipe/reset`
- `getRecipeProducts` → `GET /api/recipe/products`

### 2.3 Backend/src/routers/ml.router.js — URL → handler binding

The router is the Express equivalent of a Python decorator list: it declares which URL maps to which controller function, and provides the swagger-jsdoc annotations that auto-generate API docs. It is mounted under `/api/ml` in `server.js`, so the publicly callable URLs are:

```
GET  /api/ml/recipe/stats
GET  /api/ml/recipe/search?q=...&top_k=...
POST /api/ml/recipe/chat
POST /api/ml/recipe/reset
GET  /api/ml/recipe/products?context_id=...
```

This is the URL space the React frontend uses; it does not know that Python or port 5001 exists.

### 2.4 How GET and POST work end-to-end

The contract is identical to any REST app:

- **GET** is used for safe, idempotent retrieval — stats, search, product cards. Parameters are URL query strings.
- **POST** is used when the request has a body or causes server-side state changes — chat turns mutate the session history, reset clears it. Parameters are JSON in the request body.

Each call follows the same path: browser → Express (Node, port 5000) → Flask (Python, port 5001) → ML pipeline → MongoDB if needed → response back up the stack. CORS is handled by Express; auth would be added at the Express layer (a single middleware on the `/api/ml` router would protect every ML endpoint at once).

---
## 3. Frontend Layer

The frontend is an **Expo + React Native (web)** app under Frontend/, using `expo-router` for file-system-based routing. The chatbot lives in Frontend/app/(tabs)/RecipeBot.tsx and is mounted as a floating button in Frontend/app/(tabs)/_layout.tsx so it overlays every screen of the app rather than being confined to one tab.

Conceptually the chat component does three things:

1. **Maintains local chat state** — a `useState` array of `{role, content}` objects rendered as message bubbles, plus a client-generated `session_id` (a UUID) that uniquely identifies the conversation for the backends’ per-session history.
2. **Calls the backend** — a `fetch('/api/ml/recipe/chat', {method: 'POST', body: …})` for each user message, followed by an asynchronous `fetch('/api/ml/recipe/products?context_id=…')` once the chat response arrives, so product cards stream in after the text as per the recent update from PR#277.
3. **Renders LLM markdown** — the assistant's reply often contains markdown (bold recipe names, numbered instruction lists, bullet ingredient lists). The `react-native-markdown-display` library was used to convert that markdown into native components so it looks consistent across the web build and any future mobile build. Without markdown rendering the output would see contain asterisks and hashes.

Product cards (returned from the second-stage fetch) are rendered as horizontally-scrollable tiles below the assistant bubble — name, price, image — each linking out to the product detail page via the same `product_url` MongoDB returns. 

The chat component talks only to `/api/ml/...` URLs. It has zero knowledge of LLM providers, embedding models, or MongoDB. If the team swaps the LLM tomorrow, the React code does not change.

---

## 7. Cloud Deployment — Next Steps

The current setup is deliberately **local-dev-first**: Node on port 5000, Flask on port 5001, MongoDB Atlas via connection string, GCS for index artefacts.

- **Cloud Run** for the Flask ML service. Build the existing `Backend/ml-service/` folder into a container (Python 3.10 base image, `pip install -r requirements.txt`, `CMD ["python", "app.py"]`). Allocate at least **2 GB RAM** for the MPNet model + recipe matrix, ideally **4 GB** if the product matrix is loaded too. The `gcs_loader` already handles Cloud Run by writing the index cache to `/tmp/recipe_rag/`.
- **Cloud Run** (separate service) for the Express server. Tiny resource footprint, point `ML_SERVICE_URL` at the Flask Cloud Run service's internal URL.
- **Secrets** (`OPEN_ROUTER_API_KEY`, `HUGGING_FACE_TOKEN`, `MONGO_URI`) should move into **Google Secret Manager**, injected as env vars at deploy time. Do not commit them. The current `.env` pattern works locally; Secret Manager is the production equivalent.
- **Auth** between the two Cloud Run services: enable IAM authentication on Flask and grant the Express service account the `roles/run.invoker` role on it, so the ML service is not internet-exposed.

**Port-related changes specifically:**

- Cloud Run injects the listen port via the `$PORT` env var (default 8080), not a static `5001`. The current code already reads `ML_SERVICE_PORT` from env, so set `ML_SERVICE_PORT=$PORT` in the Cloud Run config, or change `app.py` to read `PORT` directly.
- Likewise, the Node `ML_SERVICE_URL` should be the Cloud Run service URL (e.g. `https://discountmate-ml-xxxx.a.run.app`), not `http://localhost:5001`.


