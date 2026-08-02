# Media pipeline — FFmpeg and Bento4 (DASH/HLS)

Source: `src/modules/ffmpeg/` (a wrapper over `fluent-ffmpeg`), `src/modules/bento4/` (the mp4
segmenter that packages HLS/DASH), `src/modules/execa/` (running native binaries), and
`src/features/video-encoder/`. Together these encode lesson video.

## The pipeline, end to end

1. The raw video is uploaded to S3 (`@modules/s3` — see the secondary stores section of
   [typeorm-entities-and-relations](typeorm-entities-and-relations.md)).
2. A job is pushed onto the BullMQ queue `video-encoder` — see
   [background-jobs-bullmq](background-jobs-bullmq.md).
3. The worker transcodes to multiple bitrates with FFmpeg.
4. Bento4 segments the output into HLS/DASH.
5. Segments and the manifest are uploaded back to S3.
6. The CDN is synchronised through `src/modules/init/synchronizers/cdn-synchronizer/`.

## Where the orchestrator actually runs

`src/features/video-encoder/processors/video-encoder/` runs **inside the `core` app**. The name reads
like a separate service and it is not one — nothing is deployed separately for encoding. Read the
folder name as a feature, not as a deployment boundary.

## Related entities

`lesson-video.entity.ts` holds the video metadata, `lesson-video-translation.entity.ts` holds the i18n
caption and title, and `livestream-session.entity.ts` holds a livestream session.

## Why `execa/` exists

FFmpeg and Bento4 are both external processes, not pure Node libraries. `execa/` is the shared layer
for invoking a binary, so that error handling and stdout parsing are normalised in one place instead
of being re-invented per binary.
