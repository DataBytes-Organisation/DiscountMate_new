FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml README.md ./
COPY alembic.ini ./
COPY config ./config
COPY common ./common
COPY features ./features
COPY migrations ./migrations
COPY main.py ./

RUN pip install --no-cache-dir uv \
    && uv sync

CMD ["python", "main.py", "--help"]
