# Tài nguyên

Khai báo `resources` của operator chọn vai trò; `agents/profiles/<runtime>.json` chọn model và quyền.
[Tương tác](interaction.vi.md) sở hữu giao tiếp và [identity](identity.md) sở hữu credential provider.
Quyền của operator luôn bị giới hạn bởi tác vụ, dù model có khả năng rộng hơn.

## Vai trò và runtime

| Vai trò | OpenAI profile / model | Claude profile / model |
| --- | --- | --- |
| Suy luận, lập kế hoạch, đánh giá bằng chứng | `sol-reviewer` / `gpt-5.6-sol` | `fable` / `claude-fable-5-1` |
| Triển khai, viết nội dung, thực hiện thao tác | `sol-fresh` / `gpt-5.6-sol` | `opus` / `claude-opus-5` |

Sol phục vụ cả hai vai trò bằng context và quyền riêng. Reviewer chỉ viết quyết định và bằng chứng của mình,
chuyển việc sửa cho operator sở hữu. Agent mới chỉ nhận input được khai báo; reviewer không nhận lời giải thích
của producer. Mỗi lần chạy ghi boundProfile và ranProfile theo `orchestrator.json#profileEquivalents`;
không âm thầm đổi model. `astra` và `fable-legacy` đã ngừng dùng cho tác vụ mới, chỉ giữ để đọc receipt cũ.

Chế độ web, Grammar và ảnh nằm trong khai báo tool và knowledge của từng operator. Ảnh phải phục vụ nội dung
hoặc tác vụ; một vùng trống chưa đủ lý do tạo artwork. Owner và cách đọc reference nằm trong knowledge family.

## Ma trận thực thi

Các giá trị bên dưới đối chiếu trực tiếp operator.json. Scheduler/isolation có một nơi định nghĩa tại
orchestrator.json; mode không tạo thêm user session hoặc hạn mức parallel riêng.

| Operator | Profile | Grammar | Tools | Mode | Why |
| --- | --- | --- | --- | --- | --- |
| `api.verify` | sol-reviewer | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `print:decision-points` | isolated | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `architecture.decide` | sol-reviewer | no | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `visualize:html` | isolated | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `backend.generate` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:commit-session-branch`, `shell:declared-commands` | isolated | Thực thi trong phạm vi ghi và tác động được giao |
| `backend.plan` | sol-reviewer | no | `fileread:context-aliases`, `git:read` | isolated | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `business.decide` | sol-reviewer | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `websearch:bounded` | isolated | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `business.reconcile` | sol-reviewer | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read` | isolated | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `content.generate` | sol-fresh | no | `fileread:context-aliases`, `shell:declared-commands`, `websearch:bounded`, `imagegen:required`, `objectstorage:read` | isolated | Thực thi trong phạm vi ghi và tác động được giao |
| `data.plan` | sol-reviewer | no | `fileread:context-aliases`, `git:read` | isolated | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `data.seed` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `secrets:resolve-by-name`, `http:probe`, `database:namespaced-write` | inline | Thực thi trong phạm vi ghi và tác động được giao |
| `environment.preflight` | sol-reviewer | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `container:read` | inline | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `git.publish` | sol-fresh | no | `fileread:context-aliases`, `git:merge-and-push`, `shell:declared-commands`, `ci:read` | inline | Thực thi trong phạm vi ghi và tác động được giao |
| `identity.provision` | sol-fresh | no | `fileread:context-aliases`, `shell:declared-commands`, `http:probe`, `secrets:resolve-by-name`, `sourcewrite:declared-write-set`, `browsercontrol:required` | inline | Thực thi trong phạm vi ghi và tác động được giao |
| `interface.audit` | sol-reviewer | yes | `fileread:context-aliases`, `git:read`, `websearch:bounded`, `visualize:html`, `browsercontrol:required`, `http:probe`, `host:loopback`, `secrets:resolve-by-name`, `print:decision-points` | isolated | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `interface.fix` | sol-fresh | yes | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `shell:declared-commands`, `git:commit-session-branch` | inline | Thực thi trong phạm vi ghi và tác động được giao |
| `interface.generate` | sol-fresh | yes | `fileread:context-aliases`, `git:commit-session-branch`, `websearch:bounded`, `imagegen:judged`, `visualize:html`, `host:loopback`, `print:decision-points`, `registry:read`, `sourcewrite:declared-write-set`, `shell:declared-commands` | isolated | Thực thi trong phạm vi ghi và tác động được giao |
| `interface.plan` | sol-reviewer | yes | `fileread:context-aliases`, `git:read` | isolated | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `knowledge.repair` | sol-fresh | no | `fileread:context-aliases`, `git:read-write`, `sourcewrite:declared-paths` | isolated | Thực thi trong phạm vi ghi và tác động được giao |
| `library.update` | sol-fresh | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:commit-session-branch`, `shell:declared-commands`, `registry:publish`, `secrets:resolve-by-name` | isolated | Thực thi trong phạm vi ghi và tác động được giao |
| `migration.release` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `secrets:resolve-by-name` | inline | Thực thi trong phạm vi ghi và tác động được giao |
| `quality.verify` | sol-reviewer | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe` | inline | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `release.deploy` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `http:probe`, `container:operate`, `ci:read`, `secrets:resolve-by-name` | inline | Thực thi trong phạm vi ghi và tác động được giao |
| `runtime.serve` | sol-fresh | no | `fileread:context-aliases`, `git:merge-into-integration-branch`, `shell:declared-commands`, `http:probe`, `container:operate`, `secrets:resolve-by-name` | inline | Thực thi trong phạm vi ghi và tác động được giao |
| `service.operate` | sol-fresh | no | `fileread:context-aliases`, `shell:declared-commands`, `container:operate`, `http:probe`, `secrets:resolve-by-name` | inline | Thực thi trong phạm vi ghi và tác động được giao |
| `uat.plan` | sol-reviewer | no | `fileread:context-aliases` | isolated | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `uat.verify` | sol-reviewer | no | `fileread:context-aliases`, `sourcewrite:declared-write-set`, `git:read`, `websearch:bounded`, `visualize:html`, `browsercontrol:required`, `http:probe`, `secrets:resolve-by-name`, `database:namespaced-write`, `print:decision-points` | isolated | Suy luận và kiểm bằng chứng trong ranh giới operator |
| `workspace.bind` | sol-fresh | no | `fileread:context-aliases`, `git:read`, `shell:declared-commands`, `secrets:resolve-by-name` | inline | Thực thi trong phạm vi ghi và tác động được giao |

## Thay đổi

Đổi profile phải đồng bộ bảng này, assignment trong package và mirror. Gate từ chối assignment không tồn tại
hoặc đã ngừng dùng, grant không được phép và sai mode khai báo.
