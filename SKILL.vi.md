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
3. Tìm workflow trước: đọc `when` của mọi ví dụ trong `workflows/`. Khớp trọn thì chạy đúng như đã
   ghi, preset điền vào `request.json`. Các ví dụ là tham chiếu chứ không phải toàn bộ số chuỗi có
   thể có: khi chỉ khớp một phần, hoặc bài toán nghiệp vụ khó hơn mọi `when` mô tả, cửa vào tự nghĩ
   ra chuỗi của mình từ bảng `## Kế tiếp` của các operator theo luật trong `workflows/README.md`
   (input bắt buộc phải được sinh trước, không chung alias ghi trong một bậc, vòng lặp có trần, có
   điểm kết thúc), thay vì bẻ một ví dụ gần đúng cho vừa; chuỗi tự ghép đáng giữ thì thành ví dụ mới.
   Mọi chuỗi, có sẵn hay tự ghép, đều theo cùng một luật dòng dài: chuỗi nào ghi source frontend dưới
   `mode: apply` thì phải chứng minh bề mặt bằng `frontend.surface.audit` và đi qua `uat.verify`
   trước khi tới `git.publish`, và chuỗi nào giao một luồng có người dùng chạm vào cũng vậy, vì một
   bản giao mà không ai nhìn và không ai đi thử thì không phải một bản giao.
4. Tạo phiên trước khi bất cứ điều gì khác xảy ra. Không có gì được thiết kế, ghi hay commit bên
   ngoài một phiên: hành động đầu tiên của một nhiệm vụ là thư mục phiên và một `request.json` đã
   hợp lệ. Trước khi bất kỳ file nào ngoài thư mục phiên bị đọc để sửa, và trước khi bất kỳ file nào
   ngoài thư mục phiên bị ghi, `<Source>/.worktrees/sessions/<sessionId>/state.json` và
   `step-1/parallel-1/request/request.json` đã có trên đĩa và `scripts/validate-request.mjs` xanh
   trên nhánh đó. Một agent phát hiện mình đang sửa hay công bố nguồn được route mà không có
   `step-N/parallel-M` nào dưới một phiên thì dừng và báo `SESSION_MISSING`; nó không viết phiên
   sau đó, vì phiên viết sau khi việc đã xong là ghi chép việc chứ không phải chặn việc. Thiết kế
   bằng tay rồi commit lên một nhánh phiên trong khi không có phiên nào trên đĩa cũng là đúng vi
   phạm ấy: các phương án không ai thấy, các ảnh chụp không ai chụp và UAT không ai chạy chính là
   những thứ thư mục thiếu kia lẽ ra phải chứa.
5. Chọn operator đầu tiên của chuỗi đó. Chỉ đọc `operator.md` và `operator.json` của đúng
   operator đó.
6. Chạy operator đó, từ đầu tới cuối, trên đúng một profile mà `operator.json` của nó gọi tên dưới
   `resources`, với đúng những quyền nó liệt kê. Một operator không có model khác, không thừa hưởng lượt nào,
   và không có quyền nào mà assignment bỏ sót.

## Cửa vào

| Yêu cầu nói về | Operator đầu tiên |
| --- | --- |
| Dự án nào, checkout nào, hay binding runtime nào | `workspace.bind` |
| Sản phẩm hứa gì, ai được hưởng, hỏng thì ra sao | `business.decide` |
| Ranh giới hệ thống, quyền sở hữu dữ liệu, hay tech stack | `architecture.decide` |
| Hành vi phía server, một hợp đồng API, lưu trữ, hay một job | `backend.source.apply` |
| Tạo mới, dựng lại, hay thiết kế lại một trang hoặc một surface | `frontend.direction.decide` |
| Một cây đã dựng xong lấy giá trị CSS nào | `frontend.presentation.resolve` |
| Ghi một cây đã resolve vào product source | `frontend.source.apply` |
| Một surface đã render có thật sự đứng vững không | `frontend.surface.audit` |
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
request/request.json -> validate-request.mjs -> agent ghi response/ -> validate-response.mjs + validate.mjs của operator -> định tuyến
```

Định tuyến chỉ đọc `response.json`, không đọc gì khác:

1. `done` đưa chuỗi tới bậc kế tiếp mà workflow gọi tên; `request.json` của nhánh sau trỏ tới output
   của nhánh này bằng đường dẫn tường minh.
2. `waiting` chạy cuộc trao đổi lồng mà response đang chờ (`<exchange>/request` và `response` trong
   cùng nhánh), rồi cho chính agent đó chạy tiếp; các nhánh cùng bậc vẫn chạy.
3. `blocked` đọc `stop`, tra mã trong sổ gộp (`operators/errors.json` cộng `errors.json` của chính
   operator) lấy `domain`, rồi tra domain đó trong `routing.json`:
   - `operator` gọi operator được nêu tên, rồi quay lại đây;
   - `resume` vào lại chính operator đó ở một bậc mới, `request.json.resume` trỏ về nhánh bị chặn;
   - `user` dừng và báo người phải quyết hoặc phải publish gì;
   - `external` dừng và báo thứ gì ngoài runtime phải thay đổi.
   Mã có cách xử lý `fallback` không bao giờ chặn: agent làm đúng fallback, ghi dưới
   `## Fallbacks taken`, rồi chạy tiếp, trừ khi tham số `unless` của mã nói khác.

Response trượt một trong hai validator thì không định tuyến. Văn xuôi trong `response.md` không định
tuyến. Chỉ một trường đã validate của `response.json` mới định tuyến.

`routing.json` là bảng đóng và được kiểm: mọi domain mà mã dừng của một operator bàn giao tới đều có
đúng một route, và không route nào gọi tên một domain không mã nào chạm tới. Thiếu một route là lỗi
build, không phải chỗ để phán đoán.

## Tiến độ

Mỗi operator tự mang ngữ nghĩa resume và fingerprint của nó, nên file này không giữ bộ đếm tiến độ
hay trạng thái handoff nào. Một route `resume` trả về `NO_PROGRESS` nghĩa là cùng một input đụng
cùng một bức tường: hãy báo bức tường thay vì thử lại.

Một vòng giữa hai operator chỉ hợp lệ khi fingerprint tiến độ còn thay đổi. Fingerprint lặp lại,
hoặc cùng một finding đáng kể xuất hiện hai lần, kết thúc vòng lặp và báo về chủ nhỏ hơn.

## Thẩm quyền

File này không cấp gì cả. Mọi ranh giới thẩm quyền đều do các bảng trong `operator.md` và
`validate.mjs` của chính operator thực thi, và file này không nới rộng được:

- `git.publish` không có yêu cầu nào gọi tên được force push, hook bị bỏ qua, reset, clean, stash hay
  xoá nhánh; nó merge nhánh phiên, push không force, và xung đột là `NON_FAST_FORWARD` cho người xử.
- `release.deploy`, `platform.operate` và `uat.verify` đòi `approval`, lấy từ chính khai báo của môi
  trường khi khai báo đó đánh dấu lớp thao tác bị chạm là `declared`, và từ một con người chỉ khi môi
  trường đánh dấu là `person`; `release.deploy` chỉ chạy trên đầu vào `quality-verification`.
- Bản ghi tài khoản của `uat.verify` từ chối trường password, và validator của nó bác mọi chuỗi có
  hình dạng credential trong bất cứ thứ gì nó ghi.
- `frontend.presentation.resolve` và `frontend.surface.audit` chỉ được gọi tên những mã rule mà
  knowledge được bind có publish; `frontend.source.apply` chỉ ghi class có trong inventory đã resolve.
- Operator ghi source chỉ commit trên `session/<sessionId>`; nhánh của người không bao giờ bị đụng.

Nếu một nhiệm vụ có vẻ cần nhiều hơn mức một operator cho phép, thì đó chính là câu trả lời, không
phải chướng ngại để lách.

## Knowledge

Operator tự bind knowledge của mình; file này không nạp trước.

| Thư mục | Được bind bởi |
| --- | --- |
| `knowledge/ui/composition/` | `frontend.direction.decide` |
| `knowledge/ui/presentation/` | `frontend.presentation.resolve` |
| `knowledge/ui/proof/` | `frontend.surface.audit` |
| `knowledge/patterns/fe/`, `knowledge/patterns/be/` | `frontend.source.apply`, `backend.source.apply` |
| `knowledge/grammars/<họ>/` | mọi operator có dựng họ đó |

File `.md` tiếng Anh là authority duy nhất lúc chạy. File `.vi.md` cùng tên là bản đọc cho người và
không bao giờ vào context manifest, danh sách phụ thuộc, input của validator, hay binding của
operator.

## Điều phối

Một lần gọi một operator là một agent, tạo mới trên profile mà `operator.json` của nó gọi tên, với
đúng những alias mà bảng Context của nó khai và những tool mà `operator.json` của nó khai (`@tools/<id>` từ `resources/tools.json`, mỗi tool một mode), không hơn. `resources/orchestrator.json` chốt
luật: tối đa ba agent cùng lúc, các nhánh cùng bậc không bao giờ chung alias ghi, điều phối theo
workflow và `routing.json`, bàn giao chỉ qua các trường của `response.json` trong phiên (`state.json`,
`step-N/parallel-M/{request,response}`), phiên do orchestrator tạo trước và xoá sau `git.publish`. Agent
không bao giờ khởi động agent khác; một cuộc trao đổi lồng (phản biện, review) là một agent mới do
orchestrator tạo cho nhánh đang `waiting`. `alias/alias.json` là nơi duy nhất một alias phân giải ra vị
trí, và `alias/INDEX.md` là bản đồ đọc được của nó theo vùng (workspaces, grammar, knowledge, worktrees,
remote, dynamic); operator chỉ đọc những gì bảng Context của nó gọi tên.

