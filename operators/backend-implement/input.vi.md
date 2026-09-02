# Input cho `backend.implement`

Input có hai phần đóng: `context` khai đúng phần vật liệu sẵn có mà operator được đọc, và `input` khai
outcome cần hiện thực cùng ranh giới nó được ghi. Trường không khai báo là không hợp lệ.

## Vỏ ngoài

- `schemaVersion`: đúng bằng `8`.
- `operatorId`: đúng bằng `backend.implement`.
- `context`: các binding thẩm quyền và bằng chứng, mô tả trong `context.vi.md`.
- `input`: đúng một lần hiện thực backend đã đóng băng.

## Các binding context

`context.authority` và `context.patterns` luôn bắt buộc. `context.sourceRefs` phải chứa backend source
đã route, và `sourceHead` của nó phải bằng đúng `input.project.sourceHead`.

`context.authority.decisions` liệt kê mọi phát biểu nghiệp vụ đã duyệt, mỗi mục gồm một mã và chính
phát biểu đó. Mỗi mã xuất hiện một lần. `context.patterns` bind mỗi khía cạnh một tham chiếu, và một
khía cạnh xuất hiện nhiều nhất một lần, vì hai họ cùng bind cho một khía cạnh nghĩa là chẳng họ nào
được bind cả.

`context.knowledgeRefs` và `context.priorReceiptRefs` là bằng chứng và được phép rỗng.

## Contract đã đóng băng

`input.contract` mang `status: "frozen"`, tham chiếu và fingerprint của nó, cùng ít nhất một operation.
Mỗi operation khai:

- `operationId` và `name`, không trùng trong contract;
- `transport`: `graphql-mutation`, `graphql-query`, `rest`, `worker`, `cron` hoặc `event-consumer`;
- `writerRef`: file duy nhất thực hiện việc ghi, phải nằm trong trần được sửa;
- `storeRefs`: những store mà operation chạm tới;
- `transactionBoundary`: `single-transaction`, `per-item`, `read-only` hoặc `none`;
- `idempotencyKind`: `none`, `natural-key`, `request-token` hoặc `event-id`;
- `migrationRefs`: những migration operation này mang theo, có thể rỗng;
- `authorityDecisionIds`: các quyết định đã duyệt mà nó hiện thực, ít nhất một;
- `facets`: những mặt của contract mà phần đối chiếu phải phủ;
- `proofKinds`: những proof sẽ đo nó.

Bốn quy tắc nhất quán được cưỡng chế ngay ở tầng hợp lệ của input chứ không báo lại sau:

1. một operation có `writerRef` nằm ngoài `input.scope.mutableFileRefs` đang nêu tên một writer mà lần
   gọi này không có quyền chạm tới;
2. một operation mang migration thì phải khai mặt `migration` và proof `migration-replay`, vì một
   migration không có proof chạy lại là một thay đổi schema chưa ai chạy lại lần nào;
3. một operation `read-only` không được mang migration, vì đó là một mutation đi vào qua đúng cái ranh
   giới đã tuyên bố là không mutate;
4. một `event-consumer` với `idempotencyKind: "none"` sẽ áp dụng hai lần khi sự kiện được gửi lại, nên
   contract bị từ chối thay vì để bản sao lộ ra ở production.

## Ranh giới hiện thực

- `input.project` ràng backend source đã xác minh và write root duy nhất cho artifact.
- `input.outcome` phát biểu đúng một thứ đang được hiện thực và loại của nó: `feature`, `repair`,
  `migration` hoặc `integration`.
- `input.scope` chia đôi file được sửa và file chỉ quan sát. Hai tập rời nhau, và mọi writer trong
  contract đều nằm trong tập được sửa.

## Input khi resume

`resume` là `null` với một lần gọi mới. Lần gọi tiếp nối cung cấp đúng receipt đã blocked, token dùng
một lần của nó, và những tham chiếu được thêm vào từ lúc đó.

Project, source head, outcome, fingerprint của contract, và trần được sửa phải bằng đúng receipt đã
blocked. Một resume không thêm được delta nào về thẩm quyền, contract, pattern hay scope thì không hợp
lệ và trả `NO_PROGRESS`. Một quyết định nghiệp vụ được duyệt sẽ đến dưới dạng fingerprint mới của thẩm
quyền: cùng một fingerprint không thể cho ra một đáp án khác.
