from __future__ import annotations

import argparse
import asyncio
import json
import os
import urllib.request

from mcp_server_qdrant.embeddings.base import EmbeddingProvider
from mcp_server_qdrant.mcp_server import QdrantMCPServer
from mcp_server_qdrant.settings import QdrantSettings, ToolSettings


class OllamaEmbeddingProvider(EmbeddingProvider):
    def __init__(self) -> None:
        self.url = os.environ.get("OLLAMA_URL", "http://host.docker.internal:11434").rstrip("/")
        self.model = os.environ.get("OLLAMA_EMBEDDING_MODEL", "qwen3-embedding:8b")
        self.dimensions = int(os.environ.get("OLLAMA_EMBEDDING_DIMENSIONS", "4096"))

    def _embed(self, inputs: list[str]) -> list[list[float]]:
        body = json.dumps({"model": self.model, "input": inputs}).encode("utf-8")
        request = urllib.request.Request(
            f"{self.url}/api/embed",
            data=body,
            method="POST",
            headers={"content-type": "application/json"},
        )
        with urllib.request.urlopen(request, timeout=300) as response:
            result = json.loads(response.read())
        embeddings = result.get("embeddings", [])
        if len(embeddings) != len(inputs):
            raise RuntimeError(f"Ollama returned {len(embeddings)} embeddings for {len(inputs)} inputs")
        return embeddings

    async def embed_documents(self, documents: list[str]) -> list[list[float]]:
        return await asyncio.to_thread(self._embed, documents)

    async def embed_query(self, query: str) -> list[float]:
        return (await asyncio.to_thread(self._embed, [query]))[0]

    def get_vector_name(self) -> str:
        return "ollama-" + self.model.lower().replace(":", "-").replace("/", "-")

    def get_vector_size(self) -> int:
        return self.dimensions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--transport", choices=["stdio", "sse", "streamable-http"], default="stdio")
    args = parser.parse_args()
    server = QdrantMCPServer(
        tool_settings=ToolSettings(),
        qdrant_settings=QdrantSettings(),
        embedding_provider=OllamaEmbeddingProvider(),
    )
    server.run(transport=args.transport)


if __name__ == "__main__":
    main()
