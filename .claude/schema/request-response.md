# Requests and responses

Keep `requests/` and `responses/` as the two sides of an invocation. The current version 1 design is
being refined before adoption; this change does not rewrite existing execution records.

## Request

`request.inputs` holds the material the skill is asked to act on:

- `prompts`: an ordered array of prompt strings.
- `files`: staged file references, each containing `path`, `sha256` and `mediaType`.

At least one prompt or file is required. A prompt-only task and a file-only task are both valid.

`request.context` holds supporting information used to interpret the request:

- `notes`: an ordered array of background or guidance strings.
- `files`: reference documents using the same file-reference contract.

Both collections may be empty. Context is explicit and separate from the input; it does not silently
add another task or grant execution authority. A file's role determines whether it is input or
context. For example, the document to summarize is input; a terminology guide is context.

Payload excerpt (other required request envelope fields are omitted here):

```json
{
  "inputs": {
    "prompts": ["Summarize the supplied document."],
    "files": []
  },
  "context": {
    "notes": ["The audience is the engineering team."],
    "files": []
  }
}
```

## Response

`response.outputs` is an ordered array of produced outputs. Each output has an `id` and a distinct
`type`; each type accepts only its own fields.

| Type | Required payload fields | Represents |
| --- | --- | --- |
| `text` | `text`, `format` (`plain` or `markdown`) | Inline written output |
| `commit` | `repository`, `sha` (full Git object ID) | A commit in the named repository; `message` is optional |
| `image` | `file`, `alt` | An image artifact with an image media type |
| `file` | `file`, `description` | Documents, archives, audio, video or other file artifacts |

Image and general file payloads use the same `path`, `sha256`, `mediaType` file reference as request
inputs and context. Their actual bytes stay in the work directory; the JSON does not inline binary
data. Commit outputs identify repository objects instead of copying repository contents.

One response can return multiple types together. `done` requires a nonempty output array. An
unfinished or mismatched response may retain partial outputs, and records its reason. Optional
`observations` describe verification separately; a produced report can contain failing findings.
Only the work's independent completion checks determine whether its acceptance criteria are met.

Payload excerpt (other required response envelope fields are omitted here):

```json
{
  "outputs": [
    {
      "id": "summary",
      "type": "text",
      "text": "The requested summary.",
      "format": "markdown"
    }
  ]
}
```

The schema checks structure. A consumer still resolves references, verifies file digests and Git
objects, and checks output IDs and request/work ownership before using the response.


Operator acceptance uses `feedbackRound` and `criteriaResults` on the same response envelope.
Review results name operator criterion IDs, actual output IDs, a result, and an evidence-based note.
Request `observations` use request `expected` IDs instead. The compiled operator adds its exact
review-ID set and completion gate; shared response records remain usable outside an operator.
