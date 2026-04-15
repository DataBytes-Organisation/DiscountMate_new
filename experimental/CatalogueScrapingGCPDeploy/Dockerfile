FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1
ENV PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
# Tell PaddleOCR/PaddlePaddle to use CPU only (no CUDA in Cloud Run Jobs)
# Tell PaddlePaddle to use CPU only — Cloud Run Services have no CUDA
ENV CUDA_VISIBLE_DEVICES=""
# Cloud Run injects PORT; server.py reads it at startup
ENV PORT=8080

RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    # Required by opencv-python for libGL.so.1
    libgl1-mesa-glx \
    tesseract-ocr \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt /app/requirements.txt

# PaddlePaddle must be installed before paddleocr to satisfy its runtime check.
# Use the CPU-only wheel; there is no CUDA available in Cloud Run Jobs by default.
RUN pip install --no-cache-dir paddlepaddle==2.6.2
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app/

# Cloud Run Service: server.py listens on $PORT and exposes:
#   GET  /health  — health check probe
#   POST /run     — triggers the full pipeline, blocks until complete
#
# Environment variables expected at runtime (set via --set-env-vars):
#   GCS_BUCKET          — GCS bucket for model weights and pipeline outputs
#   GCP_PROJECT         — GCP project ID
#   MODELS_LOCAL_DIR    — local cache path for downloaded models (default: /tmp/models)
#   CATALOGUE_STORES    — comma-separated store slugs (default: all four stores)
#   CATALOGUE_YEARS     — comma-separated years to scrape (default: 2020–current)
CMD ["python", "server.py"]
