ONBOARDING RESOURCES

Purpose
This folder contains onboarding utilities and governance notes to help new contributors quickly understand the DiscountMate repository structure, available code/datasets, and the rules for contributing work without increasing onboarding burden for future cohorts.

Repository Discovery Tool (What it does)
The Repository Discovery Tool scans the repository and generates structured reports that document:

Code inventory: file list, file type, inferred purpose (ML/scraping/API/etc.), key imports, and Git “created/last modified” metadata.

Dataset catalog: dataset inventory with file size and basic schema preview (columns/types where readable).

Code-to-dataset usage matrix: which scripts/notebooks reference which datasets.

Reports are exported as TXT and CSV into this folder for quick review and navigation.

Experimental Work Policy
Exploratory work, prototypes, and scripts that are not production-integrated must be placed in:
/experimental

This preserves academic evidence (commits/PRs) while keeping production code paths clean. Refer to:
/experimental/README.md
for the expected folder structure, naming conventions, and required STATUS.txt file in each subfolder.

Master Data Policy (2026 Onward)
All contributors must review:
/Master_Data_2026_Onward/README DATA POLICY.md

This folder is the single source of truth for core datasets going forward and exists to prevent dataset duplication and unclear provenance.

Core rules:

Do not commit derived, sliced, or exploratory datasets (PRs containing derived CSVs should be rejected).

Perform filtering/transforms/splits in code for reproducibility.

Always start from the master dataset(s); local-only saves are permitted but must not be committed.

Ensure workflows run from master data paths before submission.

MongoDB Usage Policy (Security Critical)
A detailed MongoDB policy is available in this folder and must be read prior to commencing. 

Mongo credentials must never be committed to Git or included in .py/.ipynb files.

Store credentials in a .env file and access them via environment variables only.

Do not include connection strings or secrets in pull requests.

Recommended onboarding steps

Run the Repository Discovery Tool and review generated reports.

Read /experimental/README.md before pushing prototypes or notebooks.

Read /Master_Data_2026_Onward/README.md before using or generating datasets.

Follow dataset reproducibility rules and keep production vs experimental work clearly separated.