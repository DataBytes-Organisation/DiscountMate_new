Multi-Store Catalogue Scraper - README
FILE: catalogue_scraper_main.py
-------------------------------------------------------------------------------------------------------------
***************IMPORTANT NOTE**********************
The catalogue_tracking.csv file MUST be present in the catalogue_data/ directory

Status:
*As of 9/12/2025 ~3176 catalogues have been download totalling approx ~97,000 JPEG files representing each catalogue page ~40gb
For docker: The “— automated” bypasses all user selections and immediately passes an “update only config” which going forward should be the standard process.

As part of an update only scrape, the expected weekly download would be:
max: 6 states x 4 stores =~ 24 catalogues
min: 1 national catalogue x 4 stores =~ 4 catalogues

************* ATTRIBUTION **************************
In line with current Deakin University guidelines(Accessed 09/12/2025):
https://www.deakin.edu.au/students/study-support/study-resources/artificial-intelligence/acknowledging-your-use

This component was developed with the assistance of 'Claude Sonnet 4.5' (via GitHub Copilot Pro – Education License) for code scaffolding, refactoring, and productionisation tasks.

The author contributed and is responsible for:
- URL pattern investigation and parsing logic
- Architectural design of the scraping pipeline
- Development of the tracking CSV mechanism, including update modes and backup provisions
- Integration, testing, reliability improvements, and validation against live data
- All decision-making regarding process design and operational logic

All submitted code and documentation are supplied as open source and intended for extension and review by future student cohorts.

***************IMPORTANT NOTE - MongoDB Support**********************

MongoDB storage mode is currently a placeholder and non-operational. The script defaults to CSV storage when MongoDB is selected.

Future Development:
- Implement MongoDB integration for centralized catalogue tracking
- Enable multi-user/multi-instance access to shared scraping history

Current Requirement:
- The catalogue_tracking.csv file MUST be present in the catalogue_data/ directory
- This CSV file tracks download history and prevents duplicate downloads
- If running in Docker or across multiple environments, ensure the catalogue_data/ folder (including CSV tracker) persists between runs
- Without the tracking CSV, the script will re-download all catalogues
**********************************************************************

Overview
This Python script automatically downloads catalogue images from Australian retailers (Woolworths, Coles, Aldi, IGA) and tracks metadata in CSV format. It is designed for automated execution via Docker or manual runs with user configuration.

Quick Start - Docker/Automated Mode
To run the script in automated mode (downloads only NEW catalogues):

python catalogue_scraper_main.py --automated
OR

python catalogue_scraper_main.py --update-only

This will:

Download from all 4 stores (Woolworths, Coles, Aldi, IGA)
Check catalogues from 2020 to current year + 1 (future-proof)
Only download NEW catalogues (skips existing)
Save tracking data to CSV
Require no user input
Applied automatic 'update only' Configuration Mode


To run with interactive prompts:

python catalogue_scraper_main.py

You will be prompted to select:

Stores (individual or all)
Years (specific years or all)
Mode (update only, refresh all, or custom)
Storage type (CSV, JSON, or MongoDB placeholder)


Installation Requirements
Required Python Packages
Install these packages before running:

pip install requests
pip install urllib3
pip install pandas


Built-in Modules (No Installation Needed)
The following modules are part of Python's standard library:

sys
json
os
re
shutil
datetime
typing
random
time
logging
pathlib



Configuration Details
Automated Configuration Settings
When running in automated mode, the script uses these defaults:

Stores: woolworths, coles, aldi, iga
Years: 2020 to current_year + 1 (automatically updates each year)
Mode: Update only (new catalogues)
Storage: CSV
Year Range Logic
The script automatically calculates the year range:

Start year: 2020 (configurable in code)
End year: Current year + 1 (catches early releases for next year)
Example in 2025: Downloads catalogues from 2020-2026
Example in 2027: Downloads catalogues from 2020-2028
Output Structure
Folder Structure
Downloaded catalogues are organized as:

catalogues/
  woolworths/
    2024/
      weekly-woolworths-catalogue-december-4-10-2024-vic/
        page_001.jpg
        page_002.jpg
        metadata.json
    2025/
      ...
  coles/
    ...
  aldi/
    ...
  iga/
    ...

Tracking Data
Metadata is saved in:

catalogue_data/
  catalogue_tracking.csv
  catalogue_tracking.json (if JSON mode selected)
  logs/
    scraper_log_20251208_143022.txt

CSV Columns
The tracking CSV contains:

store: Store slug (woolworths, coles, aldi, iga)
title: Catalogue title
slug: Unique identifier
year: Catalogue year
state: Australian state (NSW, VIC, QLD, SA, WA, TAS, NT, ACT)
catalogue_on_sale_date: When catalogue is valid (YYYY-MM-DD)
scraped_date: When downloaded (ISO format)
page_count: Expected number of pages
pages_downloaded: Actual pages downloaded
downloaded: Boolean flag
id: API identifier


Operating Modes
1. Update Mode (Default for Automated)
Downloads only NEW catalogues not already in tracking database.

python catalogue_scraper_main.py --automated


2. Refresh Mode
Re-downloads ALL catalogues after creating full backup of images and tracking files.

Manual mode only - select option 2 when prompted.

3. Custom Mode
Downloads to separate dated folder without affecting main catalogue folder.

Manual mode only - select option 3 when prompted.

Logging
Detailed logs are saved to:

catalogue_data/logs/scraper_log_YYYYMMDD_HHMMSS.txt


Log entries include:

API requests and responses
Download progress (every 10 pages)
Errors and warnings
Session start/end timestamps
Final summary statistics
Error Handling
The script handles:

Missing catalogues (404 errors)
Network timeouts (30 second timeout)
Consecutive failures (stops after 3 consecutive page failures)
Invalid API responses
Existing file detection (skips re-download)
Backup Process
In refresh mode, the script creates timestamped backups:

catalogues_backup_20251208_143022/
catalogue_data/catalogue_tracking.csv.backup_20251208_143022
catalogue_data/catalogue_tracking.json.backup_20251208_143022

Docker Integration
For automated scheduling, add to Dockerfile or docker-compose:

CMD ["python", "catalogue_scraper_main.py", "--automated"]

Or use cron/scheduler:

0 2 * * * cd /app && python catalogue_scraper_main.py --automated


This runs daily at 2 AM to check for new catalogues.

Troubleshooting
No new catalogues found
--This is normal if all current catalogues are already downloaded. The script checks for new releases each run.

SSL/HTTPS warnings
--The script disables SSL verification for the CDN. This is intentional and warnings are suppressed.

Download stops early
--Check logs for 404 errors or network issues. The script stops after 3 consecutive page failures to avoid infinite loops.

Year range not updating
--Verify the datetime module is working correctly. The year range auto-calculates based on current system date.

Performance Notes
Progress updates print every 5% completion
Detailed logs written for every operation
Random delays removed for faster downloads
Existing files skipped automatically