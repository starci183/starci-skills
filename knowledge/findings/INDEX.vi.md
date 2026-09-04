# Findings

Thư mục này là thứ cây học được từ chính những biên nhận nó sinh ra. Mọi lượt audit và mọi lượt đi thử
đều kết thúc bằng một bảng phán quyết, và cho tới nay một lần hỏng trong bảng ấy chỉ sống trong phiên đã
ghi nó: lượt sinh kế tiếp của cùng bề mặt chưa từng thấy nó, còn một khuyết tật mà không rule nào phủ
lại được gặp lại ở phiên sau như thể lần đầu. Sổ cái ở đây là ký ức mà những biên nhận ấy để lại, và hai
script bên cạnh là hai cách duy nhất nó được ghi và được đọc ngược về luật.

## Sổ cái

Mỗi họ grammar một file, `<family>.jsonl`, trong đó `<family>` là họ mà route đã bind (`grammarId` của
route, cùng đoạn mà `@knowledge/grammars/<family>` phân giải qua). Mỗi dòng một đối tượng JSON, theo
hình dạng dòng mà [kind findings](../../templates/kinds/findings.schema.json) công bố dưới `$defs.line`:
id, thời điểm ghi, phiên và nhánh đã sinh ra nó, operator, họ, bề mặt và đơn vị nó nói về, rule nó rớt
hay `null` khi không rule nào phủ, mã nó mang, câu quan sát đúng như biên nhận đã đo, mức nặng, và
`fixed`.

Luật của sổ cái gói trong ba câu. Mọi nhánh `interface.audit` và `uat.verify` đã xong mà phán quyết
mang một lần hỏng thì ghi thêm các finding của nó, mỗi finding một dòng. Không gì sửa một dòng: một
finding được đóng bằng cách ghi thêm dòng thứ hai cùng id với `fixed` gọi tên nhánh, dạng
`<sessionId>:<N/M>`, mà biên nhận của nó đã phán lại cùng bề mặt và đơn vị ấy và không còn mang lần
hỏng nữa, và dòng mới nhất của mỗi id là trạng thái của finding. Một finding ghi hai lần chỉ được thêm
một lần, vì id của nó suy từ điều nó nói về chứ không từ lúc nó được viết.

Việc ghi thêm thuộc về orchestrator, tại transition chấp nhận biên nhận, qua
`node scripts/record-findings.mjs <branch>`; một agent cô lập không bao giờ với tới thư mục này.
Script đọc phán quyết đã được kiểm của nhánh, ghi thêm những dòng sổ cái chưa có, đóng các finding
đang mở của cùng bề mặt và đơn vị mà nhánh đã phán lại và thấy đạt, rồi vật chất hoá các dòng đang mở
của sổ cái cho những bề mặt nhánh đã quan sát thành `response/data/findings.json` cạnh biên nhận, theo
[kind findings](../../templates/kinds/findings.schema.json) — chính file mà lượt `interface.generate`
kế tiếp của bề mặt ấy bind làm `inputs.findings`. `scripts/validate-session.mjs` từ chối một phiên mà
trong đó một nhánh audit hay đi thử đã xong mang một lần hỏng mà sổ cái của họ không giữ, gọi tên
nhánh ấy, nên một biên nhận không thể được chấp nhận rồi bị quên.

## Ai đọc nó

Một lượt sinh trả lời điều sổ cái biết. `interface.generate` bind file đã vật chất hoá làm đầu vào
`findings`, và biên nhận quyết định của nó gọi tên mọi dòng đang mở cho bề mặt của mình dưới
`## Findings answered`, kèm cách hướng đã trả lời; một lượt sinh bỏ qua một finding đã biết bị
validator của nó từ chối. Một finding thuộc về một bề mặt khi `surface` của nó là target của lượt sinh
hoặc đơn vị mà lượt ấy chạy.

Một finding không rule mà gặp ở hai phiên là một rule cây còn thiếu. `node scripts/promote-findings.mjs`
gom các finding đang mở có `rule` là `null`, nhóm theo họ và theo mã hay câu quan sát chúng dùng chung,
và với mỗi nhóm gặp ở ít nhất hai phiên khác nhau thì soạn `proposals/<slug>.md` theo
hình dạng rule mà các topic proof dùng (`Case | When | Observe`), kèm một bản nháp ghi chú bằng chứng
dưới `tests/evidence/`. Nó không bao giờ ghi vào `knowledge/ui/`: một đề xuất chỉ thành luật khi một
người tự tay soạn rule theo [`UPDATE.md`](../../UPDATE.vi.md), với hai lần xuất hiện làm bằng chứng, và
một file đề xuất đã có thì không bao giờ bị ghi đè. Một bản nháp không mang heading rule riêng và không
trích số thứ tự nào, để gate trích dẫn đọc thư mục này không nhầm một bản nháp thành một rule đã công
bố.

## Thư mục này không phải gì

Nó không phải luật, và không gì bind nó làm context. Một dòng ở đây ghi rằng một bề mặt đã rớt một rule
vào một ngày; rule vẫn ở nơi nó được công bố, và một finding mâu thuẫn với một rule là bằng chứng chống
lại rule ấy, được ghi đúng như nó vốn có.
