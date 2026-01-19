FROM python:3.10-slim

# Install cron and build tools for pandas
RUN apt-get update && apt-get install -y \
    cron \
    gcc \
    libpq-dev \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy scraper script
COPY catalogue_scraper_main.py /app/catalogue_scraper_main.py

# Copy cronjob config to system cron dir
COPY cronjob /etc/cron.d/cronjob
RUN chmod 0644 /etc/cron.d/cronjob

# Log file for cron
RUN touch /var/log/cron.log

# Entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
