# exup-4 — file-upload archetype slice (devin)

Read `_common.md`. Owns: `todo-app-backend/src/modules/integrations/upload/**` (new), related wiring + specs + `.starciwork/features/upload/` records.

Mission: thêm archetype đầu tiên ngoài CRUD — file upload (attachment cho task). Reference: `.repo/fullstack-mastery-module-12-file-upload-and-storage` (đọc nó trước).
1. Survey `src/modules/integrations/` conventions trước — làm theo đúng pattern có sẵn
2. Implement slice nhỏ nhưng prod-shape: presigned/direct upload, size+mime validation, storage adapter (local volume trong dev compose, interface để swap S3/minio sau), virus-scan hook stub có contract rõ, metadata record gắn task
3. Specs: unit (validation, adapter contract) + e2e journey (upload→attach→retrieve→delete), theo đúng e2e conventions hiện có
4. Seeds: thêm seed data nếu feature cần — đi qua dir của exup-1? KHÔNG — viết seed riêng trong `.starcistacks/dev/seeds/` với prefix `30-upload` để tránh conflict
5. `.starciwork` records cho feature mới theo đúng format hiện có
Report: shape implemented, specs, records. Marker `done/exup-4.done`.
