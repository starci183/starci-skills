# Layout goal

Gate Layout phải xuất được bố cục hoàn chỉnh cho từng surface, gồm `business`, `main`, `extends`,
phân bố responsive/CSS và inventory block đủ chi tiết để Gate Block tiếp tục mà không đoán.

Gate phải biến bằng chứng source/contract thành closed `grammarFacts`, chạy đúng
`.claude/grammars/<context.grammar>/` và gắn receipt cùng mọi quyết định surface, interaction, region, state
vào candidate. LLM chỉ được tạo biến thể trong phần grammar chưa khóa; không được thay Accordion,
ListBox, rail hay owner đã resolve bằng markup tự ghép.

Trước khi đề xuất block mới, gate phải đối chiếu contract registry và source hiện có để xác định block
nào đã tồn tại hoặc trùng vai trò: `reuse`, `extend`, `new-required` hay `not-applicable`. Tên giống
nhau không đủ để kết luận trùng; phải so owner, business role, data, states và render boundary.

Mọi lựa chọn bố cục phải follow sát các module `fe/intent` áp dụng cho audience/outcome hiện tại,
nhưng intent không được phép vượt contract, backend truth, accessibility hoặc user autonomy.
