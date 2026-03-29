FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY pyproject.toml uv.lock README.md ./

RUN pip install --no-cache-dir uv \
    && uv sync --frozen --no-dev

COPY config ./config
COPY sql ./sql
COPY main.py ./

CMD ["python", "main.py", "--help"]
