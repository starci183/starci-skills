# StarCi

Một cửa vào, mười bốn operator, một bảng định tuyến đóng. File này chọn operator đầu tiên và sắp
xếp các operator còn lại. Nó không tự làm việc gì: không quyết một giá trị, không ghi source, không
phán xét một kết quả.

## Chuẩn bị

1. Đóng băng một phạm vi nhiệm vụ: đơn vị, đích, phần bao gồm và phần loại trừ, các gốc được ghi,
   hiệu ứng ra bên ngoài, và thứ sẽ được tính là bằng chứng. Hai cách đọc làm đổi bất kỳ điểm nào
   trong số đó là một câu hỏi tập trung, không phải một phỏng đoán.
2. Chạy `workspace.bind` cho mọi nhiệm vụ có đọc hoặc ghi source đã route. Không thứ gì khác được
   phép tự tìm checkout, và một thư mục trùng tên không bao giờ là thẩm quyền route.
3. Chọn operator đầu tiên theo bảng dưới. Chỉ đọc `operator.md` và `operator.json` của đúng
   operator đó (gói chưa chuyển: `operator.json`, `context.md`, `input.md`, `execute.md`).
4. Chạy operator đó, từ đầu tới cuối, trên đúng một profile mà `operator.json` của nó gọi tên dưới
   `resources`, với đúng những quyền nó liệt kê. Một operator không có model khác, không thừa hưởng lượt nào,
   và không có quyền nào mà assignment bỏ sót.

## Cửa vào

| Yêu cầu nói về | Operator đầu tiên |
| --- | --- |
| Dự án nào, checkout nào, hay binding runtime nào | `workspace.bind` |
| Sản phẩm hứa gì, ai được hưởng, hỏng thì ra sao | `business.decide` |
| Ranh giới hệ thống, quyền sở hữu dữ liệu, hay tech stack | `architecture.decide` |
| Hành vi phía server, một hợp đồng API, lưu trữ, hay một job | `backend.implement` |
| Tạo mới, dựng lại, hay thiết kế lại một trang hoặc một surface | `fe.direction.decide` |
| Một cây đã dựng xong lấy giá trị CSS nào | `fe.presentation.resolve` |
| Ghi một cây đã resolve vào product source | `fe.source.apply` |
| Một surface đã render có thật sự đứng vững không | `fe.surface.audit` |
| Build, lint, typecheck, coverage, hay Sonar | `quality.verify` |
| Một người thật có hoàn thành được một hành trình thật không | `uat.verify` |
| Phát hành, hay khôi phục một bản phát hành | `release.deploy` |
| Observability, dịch vụ Sonar, hay một tunnel | `platform.operate` |
| Một đơn vị nội dung giáo dục | `content.generate` |
| Publish một ranh giới Git đã duyệt | `git.publish` |

Một yêu cầu không gọi tên chủ nào, hoặc gọi hai chủ có phạm vi khác nhau đáng kể, dừng lại ở đây với
một câu hỏi tập trung nêu tên các ranh giới đang cạnh tranh.

## Vòng lặp

```text
dựng input -> validate-input.mjs -> execute -> validate-output.mjs -> định tuyến
```

Định tuyến chỉ đọc hai trường của một output đã validate, không đọc gì khác:

1. Một kết quả thành công đưa nhiệm vụ tới operator kế tiếp mà kế hoạch của nó gọi tên.
2. `blocked` đọc `failure.owningDomain` và tra nó trong `routing.json`:
   - `operator` gọi operator được nêu tên, rồi quay lại đây;
   - `resume` gọi lại chính operator đó với phần delta mà token resume đòi hỏi;
   - `user` dừng và báo người phải quyết hoặc phải publish gì;
   - `external` dừng và báo thứ gì ngoài runtime phải thay đổi.
3. `uat.verify` trả `failed` và `release.deploy` trả `rolled-back` là kết quả đã quyết, không phải
   block. Chúng mang chủ của riêng mình và định tuyến theo cùng một cách.

Một output trượt validator thì không định tuyến. Văn xuôi trong receipt không định tuyến. Một kết
quả kể bằng lời không định tuyến. Chỉ một trường đã validate mới định tuyến.

`routing.json` là bảng đóng và được kiểm: mọi domain mà một operator có thể phát ra đều có đúng một
route, và không route nào gọi tên một domain nó không bao giờ phát. Thiếu một route là lỗi build,
không phải chỗ để phán đoán.

## Tiến độ

Mỗi operator tự mang ngữ nghĩa resume và fingerprint của nó, nên file này không giữ bộ đếm tiến độ
hay trạng thái handoff nào. Một route `resume` trả về `NO_PROGRESS` nghĩa là cùng một input đụng
cùng một bức tường: hãy báo bức tường thay vì thử lại.

Một vòng giữa hai operator chỉ hợp lệ khi fingerprint tiến độ còn thay đổi. Fingerprint lặp lại,
hoặc cùng một finding đáng kể xuất hiện hai lần, kết thúc vòng lặp và báo về chủ nhỏ hơn.

## Thẩm quyền

File này không cấp gì cả. Mọi ranh giới thẩm quyền đều do schema của chính operator thực thi, và file
này không nới rộng được:

- `git.publish` ghim `forcePush` và `historyRewrite` bằng `false`, nên không input hợp lệ nào mô tả
  được một lần force push, một hook bị bỏ qua, một reset, một clean, một stash, hay một lần xoá
  nhánh.
- `release.deploy` đòi authorization đã khai của nó, đúng môi trường và còn hạn.
- `uat.verify` không nhận chuỗi tự do nào trong bản ghi tài khoản, nên một credential không thể được
  ghi vào snapshot.
- `fe.presentation.resolve` và `fe.surface.audit` chỉ được gọi tên những mã rule mà knowledge được
  bind có publish.

Nếu một nhiệm vụ có vẻ cần nhiều hơn những gì một operator cho phép, thì đó chính là câu trả lời,
không phải một trở ngại cần đi vòng.

## Knowledge

Operator tự bind knowledge của mình; file này không nạp trước.

| Thư mục | Được bind bởi |
| --- | --- |
| `knowledge/ui/composition/` | `fe.direction.decide` |
| `knowledge/ui/presentation/` | `fe.presentation.resolve` |
| `knowledge/ui/proof/` | `fe.surface.audit` |
| `knowledge/patterns/fe/`, `knowledge/patterns/be/` | `fe.source.apply`, `backend.implement` |
| `knowledge/grammars/<họ>/` | mọi operator có dựng họ đó |

File `.md` tiếng Anh là authority duy nhất lúc chạy. File `.vi.md` cùng tên là bản đọc cho người và
không bao giờ vào context manifest, danh sách phụ thuộc, input của validator, hay binding của
operator.

## Điều phối

Một lần gọi một operator là một agent, tạo mới trên profile mà `operator.json` của nó gọi tên, với
đúng những quyền và ref nó khai, không hơn. `resources/orchestrator.json` chốt luật: tối đa ba agent
cùng lúc, không bao giờ hai agent chung một nơi ghi, điều phối theo `routing.json`, bàn giao chỉ qua
receipt có kiểu và `changes.md` dưới `@dynamic`, trong thư mục phiên mà orchestrator tạo trước và xoá khi chạy xong. Agent không bao giờ khởi động agent khác; một bước phản biện bên
trong operator là một bước của chính agent đó. `alias/alias.json` là nơi duy nhất một alias phân giải ra vị
trí, và `alias/INDEX.md` là bản đồ đọc được của nó theo vùng (workspaces, grammar, knowledge, worktrees, remote,
dynamic); operator chỉ đọc những gì bảng Ref của nó gọi tên.
