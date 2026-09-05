# Helper

Tầng hỗ trợ bên cạnh các operator. Một operator làm một việc trên một đơn vị bên trong chuỗi của phiên, dưới một goal người đã xác nhận; một helper làm việc hỗ trợ ngoài mọi quy trình — nó không mở phiên, không ghi source sản phẩm, không chạm runtime, không publish và không hỏi gì. Nó chuẩn bị và dọn dẹp. Luật nằm ở `resources/orchestrator.json#helpers`, cửa kiểm là `scripts/validate-helper.mjs`, và trang này được sinh từ mọi `helpers/<id>/helper.md` bởi `scripts/generate-helpers-index.mjs`.

Helper được gọi từ người dùng chứ không bao giờ từ một bức tường: `/helper <id> <args>`, hoặc bằng cách nêu tên công việc. Nó chạy trên profile của chính nó ở chế độ mà `helper.json` khai báo và để lại một bản ghi lần chạy dưới `@worktrees/helpers/<id>/runs/<runId>/`, để mọi bản phác nó để lại đều gọi tên được lần đọc đã sinh ra nó.

## Các helper

| Helper | Profile | Chế độ | Việc duy nhất |
| --- | --- | --- | --- |
| `generate-banks` | `sol-reviewer` | `isolated` | Read what a product has already left behind — its routes, the coverage nobody took, the findings nobody answered, the walks and the API runs that failed, the feature models and the person's own notes — and draft a bank of missions the harness can take one after another, each with the goal block a session needs and at least one observation it came from. |

## generate-banks

**Việc.** Đọc những gì một sản phẩm đã để lại — route của nó, phần coverage không ai lấy, finding không ai trả lời, các lượt đi thử và lượt chạy API đã hỏng, model tính năng và ghi chú của chính người dùng — rồi phác một kho nhiệm vụ mà harness nhận được lần lượt, mỗi nhiệm vụ mang sẵn khối goal một phiên cần và ít nhất một quan sát nó sinh ra từ đó.

**Xong khi.** Xong khi `bank-queue` xếp thứ tự một mục cho mỗi nhiệm vụ lần đọc tìm ra, mọi mục đều có một `banked-mission` mang khối goal, route, môi trường và ít nhất một evidence ref của nó, và `helper-run` gọi tên mọi đầu vào đã đọc kèm head đã đọc tại đó.

### Đọc

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/projects` | khai báo route của sản phẩm: nó có những role nào và mỗi role là gì, để nhiệm vụ được phác gọi tên những route có thật | có |
| `@workspaces/ports` | phép chiếu port của sản phẩm, để một nhiệm vụ cần runtime phục vụ gọi tên đúng slot nó sẽ chạy | không |
| `@workspaces/<project>/<role>` | các checkout đã route của sản phẩm, chỉ đọc và tại head quan sát được: thứ mà một evidence ref dạng `source:` trỏ tới, và thứ phân biệt một lời hứa đã bàn giao với một lời hứa còn nợ | không |
| `@worktrees/unchecked/<product>` | phần coverage các nhiệm vụ trước cố ý không lấy, kèm lane, unit và lý do: nguồn đầu tiên của một nhiệm vụ chưa ai chạy | không |
| `@knowledge/findings` | các finding mà audit và lượt đi thử đã ghi và chưa ai trả lời, theo từng họ | không |
| `@worktrees/uat/<flow>` | những lượt đi thử sản phẩm này đã chạy và chúng hỏng ở đâu | không |
| `@worktrees/e2e/<flow>` | những lượt chạy API sản phẩm này đã chạy và chúng hỏng ở case nào | không |
| `@worktrees/businesses` | model tính năng và những lời hứa chúng công bố, để nhiệm vụ được phác nói về một lời hứa chứ không phải về một tệp | không |
| `@worktrees/banked/<product>` | queue, mission, approval bytes và status hiện có dùng cho reuse, update và duplicate check | không |

### Ghi

| Alias | Cái gì |
| --- | --- |
| `@worktrees/banked/<product>` | hàng đợi của kho sản phẩm và một thư mục cho mỗi nhiệm vụ được phác, mỗi thư mục có bản người đọc bên cạnh bản harness đọc |
| `@worktrees/helpers/<id>` | bản ghi lần chạy này: đã đọc gì tại head nào, đã ghi gì, và giữa hai mốc thời gian nào |

### Các bước

| # | Bước | Ghi | Dừng với |
| --- | --- | --- | --- |
| 1 | Validate invocation và bind helper run vào host session Codex hoặc Claude hiện có; không tạo StarCi user session | — | `INVALID_INPUT` |
| 2 | Đọc route, port, checkout head rồi inspect queue, mission, approval bytes và status hiện có trước khi chọn reuse, update hay create | — | `PRODUCT_UNROUTED` |
| 3 | Đọc và phân loại từng unchecked-ledger source là valid, missing, invalid hay stale, giữ evidence của phân loại | — | — |
| 4 | Đọc và phân loại open finding của mọi family mà product dùng | — | — |
| 5 | Đọc và phân loại UAT walk cùng API run cuối của từng e2e flow, kể cả attempt incomplete và failed | — | — |
| 6 | Đọc và phân loại feature model cùng person note được tham chiếu; optional source vắng làm run incomplete thay vì âm thầm empty | — | — |
| 7 | Resolve duplicate open thread với bank hiện có; reuse mission không đổi, update đúng draft field đổi, hoặc create một mission cho thread mới | `banked-mission` | `BANK_EMPTY` |
| 8 | Từ chối draft không có evidence và ghi từng merge bằng kept mission, merged mission ids và supporting refs | — | `BANK_UNGROUNDED` |
| 9 | Xếp queue nhưng giữ nguyên approval bytes và mọi status running hoặc done; không mở lại terminal mission khi refresh | `bank-queue` | — |
| 10 | Record mọi run, kể cả empty và incomplete, gồm source coverage, before/after hash và entries, deduplication, output, profile, host binding và thời điểm | `helper-run` | — |

### Đầu ra

| Kind | Tệp |
| --- | --- |
| `bank-queue` | `@worktrees/banked/<product>/queue.json` |
| `banked-mission` | `@worktrees/banked/<product>/<missionId>/mission.json` |
| `helper-run` | `@worktrees/helpers/<id>/runs/<runId>/run.json` |

### Mã dừng

| Mã | Xử lý | Nghĩa |
| --- | --- | --- |
| `INVALID_INPUT` | terminate | request.json không qua gate hoặc bảng Yêu cầu của operator. |
| `PRODUCT_UNROUTED` | terminate | Sản phẩm không có khai báo route nào dưới @workspaces/projects, nên không có gì để phác nhiệm vụ lên: một kho mà các nhiệm vụ gọi tên những role không tồn tại thì lúc mở ra không lập kế hoạch được. |
| `BANK_EMPTY` | terminate | Không có gì đang mở trong phạm vi lần đọc: không mục chưa kiểm, không finding chưa trả lời, không case hỏng và không lời hứa nào của model mà bàn giao chưa chạm tới. Không ghi gì cả, vì kho rỗng là một sự thật về sản phẩm chứ không phải một cái kho. |
| `BANK_UNGROUNDED` | terminate | Một nhiệm vụ được phác không gọi tên evidence ref nào. Nó bị từ chối chứ không được nhập kho kèm một lý do nghe hợp lý, vì người chỉ duyệt kho một lần rồi harness chạy mọi nhiệm vụ trong đó. |

Nguồn: `helpers/generate-banks/helper.vi.md`. Chỉ tệp tiếng Anh mới là thẩm quyền runtime.

