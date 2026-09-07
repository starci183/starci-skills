# starci-fix — bản đọc tiếng Việt

Bản [SKILL.md](SKILL.md) tiếng Anh là runtime authority. Tái hiện và sửa lỗi backend/frontend đã chọn với kiểm chứng có giới hạn.

## Đọc contract thật

Đọc [entry chính](../../SKILL.md), [hướng dẫn Work](../../v3/README.md), [contract core](../../v3/core/README.md), [schema metadata](../../v3/schemas/work.schema.json) và [recipe cố định](recipe.json). Resolve op đã chọn qua [catalogue thật](../../v3/ops/catalog.json), rồi đọc toàn bộ commonDocument và document tiếng Anh được catalogue trỏ tới. Thiếu/sai file cài thì dừng; không thay bằng op/path/field đoán.

Recipe là nơi duy nhất khai chuỗi. Chọn đúng một mode theo outcome người dùng; cùng lựa chọn nhánh áp dụng xuyên các wave, không bật nhánh ngoài scope. Câu hỏi chỉ đọc được trả lời/inspect, không khởi chạy preset có ghi.

## Giới hạn thực thi

Nói ngắn goal cụ thể, ID target thật, mode/nhánh, ceiling ghi source/resource và done-when. Dùng lại quyền đã có; chỉ hỏi quyết định quan trọng còn thiếu hoặc effect mới. Consumer cần node scope-owned có sẵn. Chỉ op scope/planning đã chọn được khai target downstream trong scope rõ; thiếu target/dependency chặn nhánh, không thêm setup op.

Budget wave/width trong common được chia sẻ cho mọi skill, worker và retry của cùng prompt; không reset theo recipe. Song song cần ownership/session/data độc lập; không bắt buộc ba agent. Worker trả kết quả, không dispatch successor. Coordinator chỉ tiến wave hợp lệ đã chọn; không bịa workflow mới. Thứ tự recipe là lịch chạy, không cấp quyền tự thêm dependsOn/refs vào .work.

## Ranh giới chuyên môn

Chỉ dùng khi yêu cầu sửa, không dùng cho chẩn đoán chỉ đọc. Chọn đúng nhánh backend/frontend thuộc lỗi đã cho phép; mỗi sửa theo nhánh chẩn đoán tương ứng. Không đổi expected behavior đã duyệt để khớp code. Quyết định business/API hoặc ownership mới chặn nhánh. Quality regression không đồng nghĩa UAT browser hoàn chỉnh.

## Kết quả

Dùng đúng write matrix và completion profile của op đã chọn. Chốt semantic edit trước verify; observation thật ghi ở evidence, không sửa prose node đã freeze. Giữ rõ fail/suspended/chưa test. Trả file/node ID thật, commit thật khi áp dụng, evidence đã inspect và gap. Không tạo request.json/response.json, successor ẩn, done giả hoặc effect sản phẩm chỉ do đọc skill.
