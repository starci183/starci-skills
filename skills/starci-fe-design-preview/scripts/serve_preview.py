#!/usr/bin/env python3
"""Serve a StarCi review lab on the first free localhost port."""

from __future__ import annotations

import argparse
import functools
import json
import os
import socket
from http.server import HTTPServer, SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class QuietHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args: object) -> None:
        return


def first_free_port(host: str, start_port: int) -> int:
    for port in range(start_port, 65536):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
            try:
                candidate.bind((host, port))
            except OSError:
                continue
            return port
    raise RuntimeError(f"No free TCP port found from {start_port}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--start-port", type=int, default=8080)
    parser.add_argument("--check", action="store_true", help="Print the first free port and exit")
    parser.add_argument("--once", action="store_true", help="Serve one request and exit")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    directory = args.directory.resolve()
    if not directory.is_dir():
        raise SystemExit(f"Preview directory does not exist: {directory}")
    if not (directory / "index.html").is_file():
        raise SystemExit(f"Preview directory has no index.html: {directory}")

    port = first_free_port(args.host, args.start_port)
    details = {
        "directory": str(directory),
        "host": args.host,
        "pid": os.getpid(),
        "port": port,
        "url": f"http://{args.host}:{port}/",
    }
    if args.check:
        print(json.dumps(details), flush=True)
        return

    handler = functools.partial(QuietHandler, directory=str(directory))
    server_type = HTTPServer if args.once else ThreadingHTTPServer
    server = server_type((args.host, port), handler)
    print(json.dumps(details), flush=True)
    if args.once:
        server.handle_request()
        server.server_close()
        return
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
