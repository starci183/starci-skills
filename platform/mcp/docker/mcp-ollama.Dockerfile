FROM python:3.11-slim

ARG MCP_SERVER_QDRANT_REVISION=c56ae5adf62bb78d852bf7bbcbc5d7b75e2bbe41
RUN pip install --no-cache-dir \
    "mcp-server-qdrant @ https://github.com/qdrant/mcp-server-qdrant/archive/${MCP_SERVER_QDRANT_REVISION}.zip"

WORKDIR /app
COPY platform/mcp/docker/ollama_server.py /app/ollama_server.py
EXPOSE 8000

ENTRYPOINT ["python", "/app/ollama_server.py"]
