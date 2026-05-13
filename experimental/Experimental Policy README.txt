# Experimental (Not Deployed)
 
This directory contains research prototypes, proof-of-concepts, and exploratory scripts that are **not currently deployed** and **not integrated** into the main DiscountMate production pipeline.
 
These contributions are still valuable for academic assessment and knowledge transfer (e.g., pull requests, evidence of work, technical exploration). However, pushing non-production-ready scripts into the main code paths can increase onboarding effort for future cohorts and create ambiguity about what is actively used. This folder provides a clear location for experimental work so the repository remains navigable and maintainable.
 
---
 
## What belongs here?
 
Place work in `/experimental` if it is any of the following:
 
- A proof-of-concept or prototype (early-stage exploration)
- A notebook (.ipynb) used for analysis or experimentation
- A script that is not yet validated, scalable, or production-integrated
- An approach that may be revisited in future semesters
- A feature candidate awaiting data, evaluation, or integration work
 
If your contribution is production-ready and integrated into the pipeline, it should live in the relevant non-experimental module folder (see “Moving to Deployment” below).
 
---
 
## Contribution workflow (students)
 
1. Create a self-contained folder under `/experimental` for your work:
   - Use a descriptive folder name (see Naming Conventions below)
   - Keep all code, notebooks, and small supporting assets inside that folder
   - Avoid writing files outside your experimental folder unless explicitly required
 
2. Add a `STATUS.txt` file to your folder using the template below.
 
3. Commit and open a pull request.
 
This approach preserves academic evidence (commits/PRs) while keeping the production repo structure clean.
 
---
 
## Folder structure (examples)
 
experimental/
├── reverse_image_search/
│   ├── STATUS.txt
│   ├── cnn_prototype.ipynb
│   ├── requirements.txt  (optional, if different from repo root)
│   └── README.md         (optional, if you want deeper notes)
├── receipt_ocr/
│   ├── STATUS.txt
│   ├── ocr_pipeline_prototype.ipynb
│   └── sample_outputs/   (optional, small outputs only)
└── retailer_api_exploration/
    ├── STATUS.txt
    └── search_endpoint_notes.md
 
---
 
## Naming conventions
 
### Folder names
Use concise, descriptive names:
- reverse_image_search
- receipt_ocr
- retailer_api_exploration
- price_forecasting_prototype
 
Avoid:
- test
- misc
- random
- new_stuff
 
### File names
Prefer explicit maturity/status cues:
- *_prototype.ipynb
- *_draft.py
- *_exploration.ipynb
- *_baseline.py
 
Avoid:
- final_final_v3.ipynb
- test.py
- new.py
 
---
 
## STATUS.txt (required in each experimental subfolder)
 
Each experimental subfolder must include a `STATUS.txt` file that clearly states the purpose, limitations, and next steps.
 
A template is provided below.
 
**
Status: Experimental / Not deployed
 
Purpose:
[1–2 lines: what problem this prototype targets and why it exists.]
 
Current limitations:
- [Limitation 1]
- [Limitation 2]
- [Limitation 3]
 
Inputs / assumptions:
- [What data or assets it expects]
- [What environment it expects]
 
How to run (optional):
- [Minimal steps / command / notebook order]
 
Next steps:
- [Step 1]
- [Step 2]
- [Step 3]
 
Owner / contributors:
- [Name(s), if relevant]
 
**
 
---
 
## Moving to deployment (when work becomes production-ready)
 
When an experimental component is validated and ready for integration:
 
1. Create a production version under the appropriate module directory (example suggestions):
   - `src/pipelines/` (end-to-end pipelines)
   - `src/services/`  (APIs / application services)
   - `src/models/`    (model training/inference code)
   - `src/utils/`     (shared utilities)
   - `infra/` or `deploy/` (deployment-related scripts, Docker, cron)
 
2. Copy or refactor the relevant logic from `/experimental/<your_feature>/` into the production location.
 
3. Keep the experimental folder as a historical record, but update `STATUS.txt` to:
   - Status: Deployed / Integrated
   - Link to the production path and PR
   - Summarise what changed
 
This allows future cohorts to see both:
- the exploration history, and
- the final integrated implementation.
 
---