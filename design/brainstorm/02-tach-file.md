# Brainstorm 02 — tách thành mấy file, theo trục nào

> Brainstorm, chưa quyết. Câu hỏi: bộ này chia thành bao nhiêu file, và trục chia là gì.

## Họ tách thế nào

Skill `design/` của `ui-ux-pro-max` ôm sáu miền việc, và chia **song song qua ba tầng**:

```
design/
  SKILL.md                    12,3 KB — chỉ là BẢNG ĐỊNH TUYẾN, không chứa tri thức
  data/{cip,icon,logo}/       CSV theo miền
  scripts/{cip,icon,logo}/    search.py · generate.py · core.py theo miền
  references/{miền}-{khía cạnh}.md    18 file, đặt tên có tiền tố miền
```

Ba điều đáng lấy:

**`SKILL.md` là router.** Nó có bảng `Task Category | Handler | Resource` và không dạy gì cả. Ai
muốn biết chi tiết thì mở đúng file được trỏ.

**Ba tầng chia cùng một trục.** Biết miền là biết ngay data ở đâu, script nào tra, reference nào
đọc. Không phải nhớ ba cây thư mục khác nhau.

**Tên file mang tiền tố miền.** `logo-design.md`, `logo-style-guide.md`, `cip-design.md` — nhìn tên
là biết thuộc miền nào, không cần thư mục lồng.

## Bộ FE này có những gì để tách

| Nội dung | Lượng thật | Hiện là gì |
|---|---:|---|
| bảng chọn component | 180 hàng, 15 section | markdown 72,5 KB |
| thang token | 6 thang, ~50 bậc | 6 file markdown |
| thang của 15 trục | ~90 bậc | 15 file markdown |
| cây quyết định 15 trục | ~90 câu hỏi | trong cùng 15 file |
| cặp dễ lẫn | ~60 cặp | trong cùng 15 file |
| luật phán đoán | 17 luật | 1 file |
| luật làm việc | 5 luật | 1 file |
| lý lẽ và lịch sử | ~195 KB | 15 file |

Nhìn cột giữa thì rõ: **phần lớn là bảng có hàng có cột**, đang bị viết dưới dạng văn xuôi.

## Ba phương án tách

### A — theo trục phán quyết, hai miền

`shape` (hình dữ liệu → component) và `volume` (khối lượng → bố cục). Đúng trục bộ trước dùng.

Ưu: ít miền, ranh giới sạch, khớp cách hai lane phán.
Nhược: **hai miền là quá ít để chia ba tầng** — `data/shape/` với `data/volume/` thì tầng `data`
gần như chỉ có hai thư mục, không đáng.

### B — theo miền tri thức, bốn đến năm miền

`token` · `component` · `layout` · `state`, có thể thêm `copy`.

Ưu: bám sát cách họ chia, mỗi miền đủ dữ liệu để đứng riêng, tên file tự nói.
Nhược: một câu hỏi thật thường chạm nhiều miền — chọn component xong phải hỏi token nào, rồi hỏi
state nào. Router phải nói rõ thứ tự, nếu không sẽ có người dừng ở miền đầu tiên.

### C — theo dạng dữ liệu, không theo miền

`scales.csv` (mọi thang, mọi trục, cột `axis`) · `trees.csv` (mọi cây quyết định) ·
`matrix.csv` (component) · `pairs.csv` (cặp dễ lẫn).

Ưu: **ít file nhất, và mỗi file là một schema thuần** — validate được mạnh, tra được bằng cột
`axis` hoặc cột `section`. Một thang seam và một thang radius có cùng hình dạng dữ liệu, nên nằm
chung file là hợp lý.
Nhược: xa pattern của họ nhất. Và một người muốn biết "trục color có gì" phải lọc bốn file thay vì
mở một thư mục.

## Nghiêng về đâu

**B cho cây thư mục, C cho hình dạng file bên trong.**

Cụ thể: chia `data/` theo miền như B, nhưng trong mỗi miền thì gộp theo schema như C thay vì tách
mỗi trục một file.

```
design/
  SKILL.md                      router, không dạy
  data/
    component/matrix.csv        180 hàng, cột section
    token/scales.csv            mọi thang: axis · step · value · derived · use
    token/collisions.csv        cặp token trùng số — 5/6 foundation có
    layout/arrangements.csv     volume → bố cục
    axis/trees.csv              cây quyết định: axis · order · ask · yes · no
    axis/pairs.csv              cặp dễ lẫn: axis · a · b · deciding_test · has_bitten
  scripts/
    search.mjs                  tra mọi bảng, chọn bằng cờ --data
    validate_data.mjs           gác schema từng ô
  references/
    judgement.md                17 luật máy không bắt được
    house-rules.md              5 luật làm việc
    {axis}-rationale.md         lý lẽ, đọc khi phân vân
```

Lý do không tách `search` theo miền như họ: họ tách vì mỗi miền có `generate` riêng gọi model
khác nhau. Bộ này chỉ tra, một `search` đọc được mọi CSV — tách sớm là kiến trúc thừa, đúng bẫy
`ResponsiveRow` từng mắc.

## Số đo để nghiệm thu

| Chỉ số | Bộ trước | Mục tiêu |
|---|---:|---:|
| nạp để tra một component | 72,5 KB | **< 2 KB** |
| nạp để tra một bậc thang | ~4 KB | **< 1 KB** |
| số file phải mở cho một lượt bình thường | 3–4 | **1** |
| có gác schema của dữ liệu | không | **có** |

## Câu còn treo

1. **Cây quyết định thành CSV được không?** Một cây là chuỗi câu hỏi có thứ tự, dừng ở YES đầu
   tiên — dạng `axis · order · ask · if_yes · if_no` biểu diễn được. Nhưng có cây rẽ nhánh nhiều
   tầng, ép vào bảng phẳng thì đọc khó. Cần thử một trục rồi mới quyết cho cả 15.

2. **`judgement.md` có nên thành CSV không?** 17 luật, mỗi luật có `scope` (vùng/hàng/nội
   dung/dữ liệu). Cột thì có, nhưng phần thân là lý lẽ dài. Nghiêng về **giữ markdown** — đây là
   thứ duy nhất trong bộ thật sự cần văn xuôi.

3. **Bao nhiêu skill, hay chỉ một?** Họ có 7 skill trong `.claude/skills/`. Bộ này một skill
   `design` với router bên trong, hay tách `design-audit` và `design-build` riêng?
