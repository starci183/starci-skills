---
name: starci
description: Thực hiện op phát triển sản phẩm đã chọn, dùng cây completion nghiệp vụ, tài nguyên có phạm vi và kết quả gắn bằng chứng. Câu hỏi thông thường không cần tạo workflow.
---

# StarCi Work 3.0

Bản hướng dẫn tiếng Việt; [SKILL.md](SKILL.md) là thẩm quyền runtime.

Mỗi prompt, AI tự chọn op chain từ scope sản phẩm: tối đa ba lớp tuần tự, mỗi lớp tối đa ba op đồng thời (tối đa chín invocation). Xong tập đã chọn hoặc gặp blocker thì báo kết quả rồi dừng. Không reset hạn mức bằng batch, agent, task hay subchain mới trong cùng prompt.

Mỗi prompt có thể yêu cầu một hoặc nhiều piece. Tự chọn op phù hợp từ catalogue theo kết quả mong muốn và scope `.work`; không bắt user nhớ tên op hay duyệt lại từng bước trong phạm vi. Nói gọn piece → op và các lớp chạy rồi làm theo quyền đã có. Xếp prerequisite được chọn trước consumer và kiểm chứng kết quả thật trước khi sang lớp kế; không tự thêm prerequisite ngoài scope. Thiếu quyết định nghiệp vụ quan trọng hoặc effect mới vẫn cần hỏi.

## Đọc đúng phần cần dùng

1. Đọc [v3/README.md](v3/README.md) để biết storage, CLI và giới hạn.
2. Tìm op trong [catalogue](v3/ops/catalog.json); đọc commonDocument và document đúng đường dẫn catalogue, không đoán tên file hoặc nạp tất cả op.
3. Đọc goal, node, tổ tiên áp dụng, dependency và resource trong `.work` canonical; kiểm tra source đúng repo/revision trước khi kết luận.
4. Dùng schema và [tài liệu core](v3/core/README.md) hiện hành cho trường máy. Prose không ghi đè schema/quyền tool.

## Chọn một phần rồi dừng

Mục đích mới bắt đầu bằng goal.setup: mục tiêu nghiệp vụ, phạm vi, applicability và cây ban đầu. Nó không cấp quyền code toàn cây. Review/diagnose không đồng nghĩa được sửa, deploy hoặc tạo account.

Nêu gọn specific goal, đầu ra, phạm vi ghi và done-when. Tái dùng quyền rõ ràng đã có; chỉ hỏi quyết định thiếu hoặc quyền mới. Không cần request/response file.

Có thể tìm các piece chưa hoàn thành đủ điều kiện, nhưng chỉ làm phần request cho phép. Prerequisite thiếu là blocker cụ thể, không tự gọi op khác. Kết thúc bằng kết quả thật, evidence, commit nếu có và phần chưa chứng minh.

Scope và cạnh dependency thuộc `.work`, không thuộc chain cố định trong op. Op đọc graph của node được giao; không tự thêm, xóa hay bỏ qua prerequisite để được pass. Đổi scope phải là phần được chọn và cho phép rõ. Input ngữ nghĩa đổi làm phần đã hoàn thành bị ảnh hưởng chuyển thành suspended theo graph; giữ commit/evidence cũ, chỉ làm lại piece được chọn sau đó, không tự chạy lại cả graph.

## Chứng cứ và sự thật

Tách yêu cầu mong muốn, quan sát thực tế và suy luận. Source facts cần repo/revision/path; execution claims cần output tool thật. Không bịa account, route, ảnh, commit, approval, kết quả test hoặc bản deploy.

Validator chỉ chứng minh các kiểm tra đã cài, không chứng minh nhận xét AI tự viết là thật. Ảnh UI không thay UAT hành vi; login không thay downstream journey; HEAD không thay build đang phục vụ. Requirement đổi phải xem lại/retest phần bị ảnh hưởng.

Secret ở sealed/vault owner; `.work` chỉ giữ ref. Rà soát/redact artifact trước khi lưu. Có account record không tự cấp quyền login/mutate/reset/provision; tuân thủ hướng dẫn browser/tool thực tế.

## Song song và lưu kết quả

Coordinator có thể tự giao op độc lập cho agent trong giới hạn 3×3 nếu có tool và không trái hướng dẫn ưu tiên cao hơn. Tối đa ba worker thực thi trên toàn prompt, không phải ba cho mỗi parent; coordinator đang làm op cũng chiếm một slot. Tách quyền ghi, browser context và mutable data; không tách được thì chạy tuần tự trong hạn mức hoặc để prompt sau. Ba là tối đa, không bắt đủ ba agent. Worker tự đọc contract, trả kết quả rồi dừng, không spawn đệ quy/gọi successor. Chỉ coordinator tiến lớp tiếp. Retry cũng tính invocation/lớp; không giấu chain vô hạn trong một piece. Các bước tool của một op hữu hạn không phải op riêng.

Chỉ sửa node lá/resource/evidence được giao; cha tự tổng hợp. Ghi full commit SHA và bản integrated/served phù hợp. Giữ thay đổi của người dùng, commit đúng phạm vi; không push/publish/deploy khi chưa được yêu cầu.

Không tự migrate/xóa `.worktrees` hay checkout Git. Các script/routing/session/chain v2 được giữ để tham chiếu, không tham gia execution mới.
