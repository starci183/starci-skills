---
name: starci
description: Thực hiện op phát triển sản phẩm đã chọn, dùng cây completion nghiệp vụ, tài nguyên có phạm vi và kết quả gắn bằng chứng. Câu hỏi thông thường không cần tạo workflow.
---

# StarCi Work 3.0

Bản hướng dẫn tiếng Việt; [SKILL.md](SKILL.md) là thẩm quyền runtime.

Mỗi prompt, AI chọn preset trong [skills/catalog.json](skills/catalog.json), chọn mode/nhánh theo scope rồi dùng recipe cố định; không tự brainstorm workflow hoặc ghép op tùy ý. Tổng mọi skill tối đa ba lớp tuần tự, mỗi lớp tối đa ba op đồng thời (chín invocation). Không reset theo batch, agent, task, skill hoặc subchain.

Một prompt có thể chọn nhiều piece/skill; nói gọn piece → preset/mode/nhánh và các lớp chạy. User không cần nhớ tên op hoặc duyệt lại bước đã cho phép. Recipe là trần, không cấp quyền thêm code/account/publish/deploy ngoài yêu cầu. Giữ thứ tự từng recipe trong hạn mức chung, phần không vừa để prompt sau. Thiếu prerequisite thì dừng consumer; không có preset phù hợp thì báo gap, không tự sửa thư viện hay bịa chain. Thiếu quyết định quan trọng hoặc effect mới vẫn phải hỏi.

## Đọc đúng phần cần dùng

1. Đọc [v3/README.md](v3/README.md) để biết storage, CLI và giới hạn.
2. Đọc catalogue skill, document và recipe của skill được chọn; rồi đọc commonDocument và document của các op được chọn trong [catalogue op](v3/ops/catalog.json). Resolve path theo catalogue. Link từ skill con về entry đã đọc không phải dispatch đệ quy.
3. Đọc goal, node, tổ tiên áp dụng, dependency và resource trong `.work` canonical; kiểm tra source đúng repo/revision trước khi kết luận.
4. Dùng schema và [tài liệu core](v3/core/README.md) hiện hành cho trường máy. Prose không ghi đè schema/quyền tool.

## Chọn một phần rồi dừng

Mục đích mới chọn starci-goal để xác định nghiệp vụ, phạm vi và cây ban đầu, không tự cấp quyền code cả cây. Nhập từ code chọn starci-migrate: hành vi quan sát không là nghiệp vụ được duyệt; lá chưa xác minh dùng suspended + suspensionReason cụ thể, không bịa completion cũ. Review/diagnose không cấp quyền sửa/deploy/account.

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

Không tự migrate/xóa `.worktrees` hay checkout Git. V2 alias/routing/session/request-response đã bỏ khỏi package; tra lịch sử bằng Git, không fallback thực thi. Các tên cũ còn trong kiểm tra an toàn migration/installer không phải storage authority hiện hành.
