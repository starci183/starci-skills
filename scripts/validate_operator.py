#!/usr/bin/env python3
"""Read-only validation of records against a compiled operator. Requires jsonschema[format]."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import zlib

MACHINE_CHECKS = {
    "request-schema": "request", "input-files": "request", "response-schema": "response",
    "request-binding": "response", "unique-output-ids": "response",
    "output-files": "response", "png-signature": "response",
    "visual-context": "request", "generation-context": "response",
    "prompt-text": "response", "observation-references": "response",
}


def load(file):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result
    def invalid(value):
        raise ValueError(f"invalid JSON number: {value}")
    return json.loads(Path(file).read_text(encoding="utf-8-sig"), object_pairs_hook=unique, parse_constant=invalid)


def artifact(root, record):
    name = record["path"]
    if not isinstance(name, str) or "\\" in name or ":" in name or name.startswith("/") or any(part in {"", ".", ".."} for part in name.split("/")):
        raise ValueError("invalid relative artifact path")
    file = (root / name).resolve(strict=True)
    if not file.is_relative_to(root) or not file.is_file():
        raise ValueError(f"artifact escapes work root or is not a file: {name}")
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    if record["sha256"] != "sha256:" + digest.hexdigest():
        raise ValueError(f"artifact digest differs: {name}")
    return file


def verify_png(file):
    """Check PNG structure, CRCs, image stream and scanline filters, not visual quality."""
    chunks, compressed, header, palette = [], bytearray(), None, False
    ended_data = False
    with file.open("rb") as stream:
        if stream.read(8) != b"\x89PNG\r\n\x1a\n":
            raise ValueError("invalid PNG signature")
        while True:
            prefix = stream.read(8)
            if len(prefix) != 8:
                raise ValueError("truncated PNG or missing IEND")
            length, kind = struct.unpack(">I4s", prefix)
            if length > 64 * 1024 * 1024 or not all(65 <= x <= 90 or 97 <= x <= 122 for x in kind):
                raise ValueError("invalid or unsupported PNG chunk")
            data, crc = stream.read(length), stream.read(4)
            if len(data) != length or len(crc) != 4 or zlib.crc32(kind + data) & 0xffffffff != struct.unpack(">I", crc)[0]:
                raise ValueError("truncated PNG chunk or invalid CRC")
            if not chunks and kind != b"IHDR":
                raise ValueError("PNG must begin with IHDR")
            if kind == b"IHDR":
                if chunks or length != 13:
                    raise ValueError("invalid PNG IHDR")
                header = struct.unpack(">IIBBBBB", data)
            elif kind == b"PLTE":
                if palette or b"IDAT" in chunks or not length or length % 3 or length > 768:
                    raise ValueError("invalid PNG palette")
                palette = True
            elif kind == b"IDAT":
                if ended_data:
                    raise ValueError("PNG IDAT chunks must be contiguous")
                compressed.extend(data)
                if len(compressed) > 64 * 1024 * 1024:
                    raise ValueError("PNG compressed data exceeds validation limit")
            elif kind == b"IEND":
                if length or not compressed or stream.read(1):
                    raise ValueError("invalid PNG IEND or missing image data")
                break
            elif kind[0] & 32 == 0:
                raise ValueError("unsupported critical PNG chunk")
            if kind != b"IDAT" and b"IDAT" in chunks:
                ended_data = True
            chunks.append(kind)
    width, height, depth, color, compression, filtering, interlace = header
    depths = {0: {1, 2, 4, 8, 16}, 2: {8, 16}, 3: {1, 2, 4, 8}, 4: {8, 16}, 6: {8, 16}}
    if not width or not height or width > 2**31 - 1 or height > 2**31 - 1 or color not in depths or depth not in depths[color] or compression or filtering or interlace not in {0, 1}:
        raise ValueError("unsupported or invalid PNG image header")
    if color == 3 and not palette:
        raise ValueError("indexed PNG requires a palette")
    if color in {0, 4} and palette:
        raise ValueError("grayscale PNG cannot contain a palette")
    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    passes = [(0, 0, 1, 1)] if interlace == 0 else [(0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8), (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2)]
    rows, expected = [], 0
    for x, y, dx, dy in passes:
        w, h = max(0, (width - x + dx - 1) // dx), max(0, (height - y + dy - 1) // dy)
        if w and h:
            stride = 1 + (w * channels * depth + 7) // 8
            rows.append((stride, h))
            expected += stride * h
    if expected > 256 * 1024 * 1024:
        raise ValueError("PNG decoded data exceeds validation limit")
    decoder = zlib.decompressobj()
    try:
        pixels = decoder.decompress(compressed, expected + 1)
    except zlib.error as error:
        raise ValueError("invalid PNG compressed image data") from error
    if not decoder.eof or decoder.unused_data or decoder.unconsumed_tail or len(pixels) != expected:
        raise ValueError("PNG image data length or compression stream is invalid")
    offset = 0
    for stride, count in rows:
        for _ in range(count):
            if pixels[offset] > 4:
                raise ValueError("invalid PNG scanline filter")
            offset += stride


def feedback(bundle, response, failures):
    """Return bounded agent instructions; this read-only validator never invokes a tool."""
    round_number = (response or {}).get("feedbackRound", 0)
    if type(round_number) is not int or round_number < 0:
        round_number = 0
    recommendations = []
    for failure in failures:
        item = next((item for item in bundle["criteria"]["items"]
                     if item["check"]["ref"] == failure["check"] or item["id"] == failure["check"]), None)
        remedy = dict(item["onFail"]) if item else {
            "action": "retry", "fromStep": bundle["step"]["steps"][-1]["id"],
            "instruction": "Correct the reported acceptance record from actual evidence, reassess the output, and return mismatch when it cannot pass. Never invent a passing review."
        }
        if remedy["action"] == "retry" and round_number >= bundle["criteria"]["limits"]["feedbackRounds"]:
            remedy.update(action="stop", instruction=bundle["criteria"]["stopWhen"])
        recommendations.append({"criterionId": item["id"] if item else failure["check"],
                                "finding": failure["message"], **remedy})
    return recommendations


def validate(bundle, request, response, work_root, events=()):
    from jsonschema import Draft202012Validator, FormatChecker
    root = Path(work_root).resolve(strict=True)
    if not root.is_dir():
        raise ValueError("work root must be a directory")
    failures, passed, review_failures = [], [], []
    def result():
        return {"machinePassed": not failures, "accepted": bool(response and response.get("status") == "done" and not failures and not review_failures),
                "passed": passed, "failures": failures, "reviewFailures": review_failures,
                "feedback": feedback(bundle, response, failures + review_failures),
                "reviewRequired": bundle["validate"]["review"]}
    def schema_errors(schema, record):
        Draft202012Validator.check_schema(schema)
        errors = sorted(Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(record),
                        key=lambda e: str(list(e.path)))
        if errors:
            raise ValueError("; ".join(f"/{'/'.join(map(str, e.path))}: {e.message}" for e in errors[:10]))

    def check_schema(kind, record):
        schema = {"$defs": bundle["$defs"], "allOf": [bundle[kind]]}
        schema_errors(schema, record)

    # Always validate shapes before interpreting record fields, regardless of check order.
    for kind, record in (("request", request), ("response", response)):
        if record is None:
            continue
        try:
            check_schema(kind, record)
        except (ValueError, KeyError) as error:
            check_id = next((check["id"] for check in bundle["validate"]["machine"] if check["check"] == kind + "-schema"), kind + "-schema")
            failures.append({"check": check_id, "message": str(error)})
    if failures:
        return result()
    for check in bundle["validate"]["machine"]:
        operation = check["check"]
        if operation not in MACHINE_CHECKS or check["phase"] != MACHINE_CHECKS[operation]:
            failures.append({"check": check["id"], "message": "unknown check or wrong phase"})
            continue
        if check["phase"] == "response" and response is None:
            continue
        try:
            if operation == "request-schema":
                if root.name != request["workId"]:
                    raise ValueError("work root directory name differs from workId")
                work_file = root / "work.json"
                if work_file.exists() or work_file.is_symlink():
                    resolved = work_file.resolve(strict=True)
                    if not resolved.is_relative_to(root):
                        raise ValueError("work record escapes work root")
                    work = load(resolved)
                    schema_errors({"$defs": bundle["$defs"], "$ref": "#/$defs/work"}, work)
                    if work["id"] != request["workId"] or work["revision"] != request["workRevision"]:
                        raise ValueError("request does not bind the current work record revision")
                ids = [item["id"] for item in request["expected"]]
                if len(ids) != len(set(ids)):
                    raise ValueError("duplicate acceptance criterion id")
            elif operation == "input-files":
                for record in request["inputs"]["files"] + request["context"]["files"]:
                    artifact(root, record)
            elif operation == "visual-context":
                visual = request["context"]["visual"]
                if visual["mode"] != "new":
                    candidates = [file for file in request["context"]["files"] if file["path"] == visual["baselinePath"]]
                    if len(candidates) != 1 or not candidates[0]["mediaType"].startswith("image/"):
                        raise ValueError("baseline must bind exactly one image in context.files")
                    artifact(root, candidates[0])
            elif operation == "request-binding":
                if any(response[key] != request[key] for key in ("workId", "workRevision")) or response["requestId"] != request["id"]:
                    raise ValueError("response does not bind this request and work revision")
                if root.name != request["workId"]:
                    raise ValueError("work root directory name differs from workId")
            elif operation == "unique-output-ids":
                ids = [output["id"] for output in response["outputs"]]
                if len(ids) != len(set(ids)):
                    raise ValueError("duplicate output id")
            elif operation == "output-files":
                for output in response["outputs"]:
                    if "file" in output:
                        record = output["file"]
                        if not record["path"].startswith("artifacts/" + request["id"] + "/"):
                            raise ValueError("output must be inside artifacts/<requestId>/")
                        artifact(root, record)
            elif operation == "png-signature":
                for output in response["outputs"]:
                    if output["type"] == "image" and output["file"]["mediaType"] == "image/png":
                        file = artifact(root, output["file"])
                        verify_png(file)
            elif operation == "prompt-text":
                for output in response["outputs"]:
                    if "file" in output and output["file"]["mediaType"].startswith("text/"):
                        file = artifact(root, output["file"])
                        try:
                            content = file.read_text(encoding="utf-8")
                        except UnicodeError as error:
                            raise ValueError("text output is not valid UTF-8") from error
                        if "\x00" in content or (output["id"] == "generation-prompt" and not content.strip()):
                            raise ValueError("invalid or empty text output")
                        visual = request["context"].get("visual", {})
                        if output["id"] == "generation-prompt" and visual.get("mode") in {"extend", "revise"}:
                            if any(item not in content for item in visual["preserve"] + visual["change"]):
                                raise ValueError("inherited prompt must contain the exact preserve/change checklist")
            elif operation == "generation-context":
                outputs = {output["id"]: output for output in response["outputs"]}
                if response["status"] != "done" and "generation-context" not in outputs:
                    passed.append(check["id"])
                    continue
                if not {"direction", "generation-prompt", "generation-context"} <= outputs.keys() or any("file" not in outputs[key] for key in ("direction", "generation-prompt", "generation-context")):
                    raise ValueError("generation context requires direction and prompt file outputs")
                record = load(artifact(root, outputs["generation-context"]["file"]))
                schema_errors({"$defs": bundle["$defs"], "$ref": "#/$defs/image-generation"}, record)
                visual = request["context"]["visual"]
                baseline = None
                if visual["mode"] != "new":
                    baseline = next((file for file in request["context"]["files"] if file["path"] == visual["baselinePath"]), None)
                    if baseline is None:
                        raise ValueError("generation baseline is missing")
                if record["requestId"] != request["id"] or record["mode"] != visual["mode"] or record["baseline"] != baseline:
                    raise ValueError("generation context does not bind the request visual baseline")
                if record["prompt"] != outputs["generation-prompt"]["file"] or record["image"] != outputs["direction"]["file"]:
                    raise ValueError("generation context does not bind the final prompt and image")
                attempt = "artifacts/" + request["id"] + "/" + record["attemptId"]
                for file in (record["prompt"], record["image"], outputs["generation-context"]["file"]):
                    if Path(file["path"]).parent.as_posix() != attempt:
                        raise ValueError("generation files must belong to the same recorded attempt")
            elif operation == "observation-references":
                criteria = {item["id"] for item in request["expected"]}
                for observation in response.get("observations", []):
                    if observation["criterionId"] not in criteria:
                        raise ValueError("observation names an unknown request criterion")
                    for evidence_id in observation["evidenceIds"]:
                        file = (root / "evidence" / (evidence_id + ".json")).resolve(strict=True)
                        if not file.is_relative_to(root):
                            raise ValueError("evidence record escapes work root")
                        evidence = load(file)
                        schema_errors({"$defs": bundle["$defs"], "$ref": "#/$defs/evidence"}, evidence)
                        if evidence["id"] != evidence_id or any(evidence[key] != request[key] for key in ("workId", "workRevision")):
                            raise ValueError("evidence does not bind this work revision")
                        artifact(root, evidence)
            passed.append(check["id"])
        except (ValueError, OSError) as error:
            failures.append({"check": check["id"], "message": str(error)})
            if operation == "request-schema":
                break
    if response is not None:
        output_ids = {output["id"] for output in response["outputs"]}
        seen = set()
        for review in response.get("criteriaResults", []):
            if review["criterionId"] in seen or set(review["outputIds"]) - output_ids:
                failures.append({"check": "criteria-results", "message": "Review ids must be unique and reference actual response output ids."})
            seen.add(review["criterionId"])
            if review["result"] != "passed":
                review_failures.append({"check": review["criterionId"], "message": review["note"]})
        observations = response.get("observations", [])
        observation_ids = [item["criterionId"] for item in observations]
        for observation in observations:
            if observation["result"] != "passed":
                review_failures.append({"check": "request-acceptance", "message": observation["criterionId"] + ": " + observation["note"]})
        if len(observation_ids) != len(set(observation_ids)):
            failures.append({"check": "request-acceptance", "message": "Duplicate request acceptance observation."})
        if response["status"] == "done":
            expected = {item["id"] for item in request["expected"]}
            if set(observation_ids) != expected or any(item["result"] != "passed" for item in observations):
                failures.append({"check": "request-acceptance", "message": "Every request expected criterion must have exactly one passed observation before done."})
    for event in events:
        if event not in {"capability-unavailable", "essential-input-missing", "transient-execution-failure"}:
            raise ValueError("unknown execution event")
        failures.append({"check": event, "message": "Caller reported execution event: " + event})
    return result()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--operator", type=Path, required=True)
    parser.add_argument("--request", type=Path, required=True)
    parser.add_argument("--response", type=Path)
    parser.add_argument("--work-root", type=Path, required=True)
    parser.add_argument("--event", action="append", default=[], choices=("capability-unavailable", "essential-input-missing", "transient-execution-failure"))
    args = parser.parse_args(argv)
    try:
        result = validate(load(args.operator), load(args.request), load(args.response) if args.response else None, args.work_root, args.event)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["machinePassed"] and not result["reviewFailures"] else 1
    except ImportError:
        print("Install validator dependencies: python -m pip install -r tests/requirements-schema.txt", file=sys.stderr)
        return 1
    except (ValueError, OSError, KeyError) as error:
        print(f"operator validation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
