# StarCi Skills 1.0.0

Cây này chính là runtime. Đọc tiếp `SKILL.vi.md` nếu có, hoặc `SKILL.md`; đó là cửa vào duy nhất,
đóng băng phạm vi của một nhiệm vụ, chọn đúng một operator sở hữu kết quả, rồi định tuyến giữa các
operator dựa trên kết quả có kiểu.

## Thứ tự nạp

1. `SKILL.md`: cửa vào, vòng lặp định tuyến, và tuyên bố về thẩm quyền.
2. `routing.json`: bảng đóng ánh xạ `failure.owningDomain` của mọi operator sang bước kế tiếp. Bảng
   được kiểm đối chiếu với chính schema của các operator, nên thiếu một route là lỗi build.
3. `resources/`: profile thực thi nào chạy từng vai trò của operator, nó được dùng quyền nào lúc
   chạy, và câu trả lời thường trực về tìm mạng, ràng Grammar, sinh hình. Cũng được kiểm.
4. Đúng một operator mà nhiệm vụ cần: `operator.md` (Việc, Context, Đầu vào, Yêu cầu, Các bước, Đầu ra,
   Dừng, Kế tiếp) cùng `operator.json` (id, domain, resources). Mã dừng tra ở `errors/INDEX.md`.
5. Chỉ những topic knowledge mà operator đó bind.

Không nạp trước cả cây. Một operator bind tập topic nhỏ nhất mà quyết định của nó cần, mỗi topic kèm
fingerprint và danh sách rule đầy đủ, và không được phát ra mã nào ngoài danh sách ấy.

## Bố cục

```text
SKILL.md                 một cửa vào, mười bốn operator, một bảng định tuyến
routing.json             14 operator, 73 route, bốn loại: operator | resume | user | external
alias/                   alias.json (sổ cho máy: vị trí, scheme, bind, ai ghi, vùng) + INDEX.md (bản đồ sinh theo vùng); operator chỉ đọc qua alias
resources/               agents/profiles/{openai,claude}.json (6 profile) + orchestrator.json (mỗi operator một agent, tối đa 3); có kiểm
operators/INDEX.md       ma trận sinh tự động: mỗi operator đọc gì (tĩnh, động), ghi gì, các bước và mã dừng
errors/                  errors.json (mã dừng dùng chung cho nhiều operator, có scope) + INDEX.md (sinh, gộp với từng operators/<id>/errors.json): mỗi mã một cách xử lý, terminate hoặc fallback
operators/<id>/          operator.md (+vi) một file viết tay cho mỗi operator, operator.json (id, domain, resources), errors.json (mã riêng), validate.mjs, self-test.mjs
knowledge/
  ui/composition/        cây phải chứa gì, trước khi nó tồn tại      -> frontend.direction.decide
  ui/presentation/       ranh giới do app sở hữu lấy giá trị CSS nào -> frontend.presentation.resolve
  ui/proof/              thứ chỉ đúng sai sau khi đã render          -> frontend.surface.audit
  patterns/fe, be        quy ước code trích từ hai source thật
  grammars/<họ>/         cách một họ hình ảnh hiện thực Common
templates/               mỗi loại tài liệu một template; mỗi template mang khối json template-contract dùng để kiểm cả cây;
                         kinds/ định kiểu mọi file đi qua giữa các bước (<kind>.contract.json + <kind>.skeleton.md cho markdown, <kind>.schema.json cho dữ liệu); step/ giữ hai gate request.json và response.json
scripts/                 validate-routing.mjs, validate-resources.mjs, validate-knowledge-citations.mjs, validate-alias.mjs, validate-templates.mjs, validate-operator.mjs, validate-request.mjs, validate-response.mjs, validate-step.mjs, run-operator-self-tests.mjs;
                         device-state.mjs và workspace-portable.mjs (+ spec), thứ package.json của backend gọi tới
readiness/               các schema workspaces/ mà khai báo route portable và hydrate gọi tên trong $schema
```

`npm test` chạy kiểm định tuyến, kiểm resources, kiểm trích dẫn knowledge, kiểm template, mọi self-test của operator, và các spec của script. Head đã publish phải xanh, không xanh
thì không được publish.

## Luật áp dụng khắp nơi

- Một operator làm đúng một việc trong một lượt tuyến tính. Nó không gọi operator khác, không điều
  phối workflow, không tự dừng giữa chừng, không trả chỉ dẫn điều khiển dạng văn xuôi. Chỉ cha mới
  ánh xạ một output đã validate sang bước chuyển kế tiếp.
- Chỉ trường đã validate mới định tuyến được. Văn xuôi trong receipt, kết quả kể bằng lời, hay
  output trượt validator đều không định tuyến.
- Thẩm quyền nằm trong schema của operator, không nằm ở file này hay ở `SKILL.md`. `git.publish`
  không diễn đạt được force push; `release.deploy` không chạy nổi khi thiếu authorization đã khai;
  `uat.verify` không có trường nào chứa nổi credential.
- File `.md` tiếng Anh là authority duy nhất lúc chạy. File `.vi.md` cùng tên là bản đọc cho người,
  không bao giờ vào context manifest, danh sách phụ thuộc, input của validator, hay binding của
  operator.
- Mã rule là địa chỉ công khai ổn định. Chỉ thêm; không đánh số lại, không dùng lại, không lặng lẽ
  đổi nghĩa.

## Dòng dõi

Cây này thay thế runtime v7.6 vào ngày 2026-09-02. Toàn bộ cây v7.6, gồm 13 skill, 113 operator,
template và các contract runtime, được giữ nguyên trên nhánh `v7` của cùng repository. Tài liệu v8
nào dẫn tới một file chỉ có ở v7 thì gọi tên nhánh đó.
