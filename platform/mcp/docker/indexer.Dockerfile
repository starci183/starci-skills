FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY scripts/qdrant-source-index.py /app/index.py

ENTRYPOINT ["python", "/app/index.py"]
