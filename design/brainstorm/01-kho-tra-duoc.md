# Brainstorm 01 — kho phải tra được, không phải file phải mở

> Brainstorm, chưa phải quyết định. Mục tiêu: chốt hình dạng của tầng dữ liệu **trước khi** viết
> dòng skill đầu tiên, vì bộ trước làm ngược thứ tự và trả giá.

## Bài học đắt nhất từ bộ trước

`matrix.md` — bảng tra "hình dữ liệu nào thì lấy component nào" — sống **75 KB dưới dạng một file
markdown phải mở cả**. Mỗi lần tra một hàng là nạp toàn bộ. Script tra chỉ ra đời ở ngày cuối.

`ui-ux-pro-max` có kho **743 KB** và chưa bao giờ gặp vấn đề đó, vì họ để dữ liệu ở dạng **tra
được** ngay từ đầu.

Khác biệt không nằm ở dung lượng. Nằm ở **định dạng**: một bảng có cột thì lọc được, một bài văn
thì phải đọc hết mới biết có gì.

## Họ làm thế nào — số đo thật

Cấu trúc một skill của `ui-ux-pro-max`:

```
ui-ux-pro-max/
  SKILL.md              13,6 KB   cửa vào duy nhất
  data/                 ~1,2 MB   13 CSV + 23 CSV con trong stacks/
  scripts/               96 KB    core.py · search.py · validate_data.py · tests/
  references/            31 KB    đúng 2 file
```

| Quan sát | Con số | Ý nghĩa |
|---|---|---|
| Tỉ lệ data trên tài liệu | ~1,2 MB data · 31 KB references | **dữ liệu áp đảo văn xuôi** |
| `references/` | **2 file** | tài liệu là ngoại lệ, không phải mặc định |
| `scripts/` có mấy vai | **3 + tests** | `core` logic · `search` tra · `validate_data` gác chính data |
| Chia nhỏ data | `data/stacks/` 23 file | chia theo **trục người ta hỏi**, không theo chủ đề tác giả |

Skill `design/` của họ còn đi xa hơn: `data/` và `scripts/` **chia song song** theo loại việc con
— `cip/`, `icon/`, `logo/` — mỗi loại có `core` + `search` + `generate` riêng.

## Ba điều mình chưa có, xếp theo mức nghiêm trọng

**Không có `validate_data`.** Bộ trước có `validate.mjs` gác **tài liệu** — chính tả, bảng, link
chết. Không có gì gác **dữ liệu**: một hàng matrix thiếu cột, một entry registry sai tier, một
token khai derive sai — không ai bắt. Họ có file riêng cho việc này.

**Kho là markdown, không phải bảng.** `matrix.md` có cấu trúc bảng nhưng nằm trong markdown, nên
mọi thao tác đều là parse text. CSV thì đọc bằng cột, lọc bằng cột, và **validate được từng ô**.

**Script không tách vai.** `matrix.mjs` vừa parse vừa tra vừa format. Họ tách `core` khỏi `search`
— logic dùng lại được, và `tests/` chỉ cần test `core`.

## Bốn phương án cho tầng dữ liệu

**A — giữ markdown, thêm script tra.** Đúng cái bộ trước đã làm. Rẻ nhất, và đã chứng minh là
không đủ: script phải parse markdown, mà markdown thì không có schema, nên không validate được ô.

**B — CSV, một file một miền.** Bám sát họ. Tra bằng cột, validate được từng ô, `git diff` đọc
được từng dòng. Đổi lại: mất khả năng viết văn giải thích ngay cạnh dữ liệu.

**C — CSV cho dữ liệu, markdown cho lý lẽ, ghép bằng khoá.** Mỗi hàng CSV có một `id`, lý lẽ dài
nằm trong `references/<id>.md`. Giữ được cả hai, nhưng thêm một tầng phải đồng bộ — và **thứ phải
đồng bộ tay là thứ sẽ trôi**.

**D — JSON có schema.** Validate mạnh nhất, nhưng `git diff` khó đọc và người không sửa tay được.

## Đo rồi

| Thành phần | Dung lượng | Tỉ lệ | |
|---|---:|---:|---|
| **văn xuôi** | **41,0 KB** | **56,6%** | |
| bảng | 29,9 KB | 41,3% | 180 hàng |
| heading | 1,4 KB | 1,9% | |

**Hơn một nửa file là văn xuôi**, không phải bảng. 180 hàng bảng chiếm 29,9 KB — trung bình 170
byte một hàng, tức các ô khá dài, có markdown và link bên trong.

### Một phép đo sai trước đó, ghi lại để không lặp

Lần đếm đầu tiên cho ra *"code fence 70,1%"*. Sai. `matrix.md` gần như **không có code fence** —
chỉ có một dòng mở đầu bằng bốn backtick, là backtick trong văn bản. Script đếm thấy
`startsWith("```")` nên bật cờ fence và không bao giờ tắt, nên toàn bộ phần còn lại bị tính là code.

Số 70% đã suýt lái cả kế hoạch sang hướng "tách ví dụ code" — một việc không tồn tại.

**Bài học không phải là cẩn thận hơn.** Là: một phép đo cho ra con số bất ngờ thì phải kiểm bằng
cách thứ hai trước khi dùng nó để quyết. Ở đây cách thứ hai chỉ mất một lệnh grep đếm ``` — và nó
ra 2 dòng, mâu thuẫn ngay với giả định 50 KB code.

## Kết luận sau khi đo

Vấn đề không phải định dạng của bảng. Là **41 KB văn xuôi nằm cùng file với bảng tra**.

Mỗi lần tra một hàng phải mở cả 72,5 KB, trong đó 56,6% là giải thích mà lúc tra không ai cần.

Ba lớp, ghép bằng khoá:

| Lớp | Định dạng | Cỡ thật | Đọc khi |
|---|---|---:|---|
| bảng tra | CSV, một hàng một ca, 180 hàng | ~30 KB thô, ~15 KB sau khi bỏ markdown trong ô | mỗi lần tra, qua script |
| lý lẽ · điều cấm · ngoại lệ | markdown, tách theo section | ~41 KB | chỉ khi phân vân |
| heading và điều hướng | biến mất — CSV có cột `section` | — | — |

Một lượt tra bình thường chạm **một hàng CSV**. 41 KB kia nằm yên.

Và phần 41 KB đó sẽ co lại nữa: scan bộ trước cho thấy **46% luật cấm đã có máy gác**, nên phần
văn xuôi cần giữ nhỏ hơn con số hiện tại.

## Câu còn treo

1. **Chia data theo trục nào?** Họ chia `stacks/` theo framework vì người dùng hỏi theo framework.
   Mình chia theo gì — theo tầng (atom/frame/composite), hay theo hình dữ liệu người ta đang cầm?
   Câu này quyết định cả cây thư mục.

2. **`core` có cần tách không khi chỉ có một `search`?** Họ tách vì có `design_system.py` 59 KB
   dùng chung. Mình chưa có thứ tương đương — tách sớm là kiến trúc thừa.

3. **`references/` được phép có mấy file?** Họ giữ **2**. Bộ trước của mình có **8**, cộng 15
   `axis-notes`. Con số đó có phải dấu hiệu văn xuôi đang lấn chỗ dữ liệu không?

4. **Python hay Node?** Họ dùng Python. Repo này là Node. Không có lý do đổi, nhưng ghi ra để
   không ai tưởng phải bám cả cái đó.

## Trục chia data — chốt

Dữ liệu tự trả lời câu này. `matrix.md` đã chia **15 section theo hình dữ liệu đang cầm** — bề mặt
có nhãn · hàng không có card · đóng mở khi bấm · chữ · viewer · nhãn phân loại · số đo · cặp
label-value · khung và nhịp · trang và overlay · async · form · nút · điều hướng · danh tính.

Đó chính là trục người ta hỏi. Không phát minh trục mới.

**Một file CSV, không chia nhỏ.** 180 hàng, ~15 KB — chia thành 15 file là phân mảnh vô ích và
buộc script phải mở nhiều file cho một câu hỏi. `ui-ux-pro-max` chia `stacks/` thành 23 file vì
mỗi framework là một kho riêng biệt, người dùng chỉ chạm một cái; ở đây một câu hỏi có thể chạm
nhiều section, nên gộp là đúng.

Cột: `id · section · you_have · choose · entry_point · dont_choose`.

## Việc tiếp

1. ~~Đo tỉ lệ bảng / văn xuôi~~ — xong, sau khi sửa một phép đo sai
2. ~~Chốt trục chia data~~ — xong, dùng 15 section sẵn có
3. Rút 180 hàng ra `data/matrix.csv`, gắn `id` cho từng hàng
4. Tách 41 KB văn xuôi sang `references/`, tham chiếu ngược bằng `id`
5. Lọc phần văn xuôi: bỏ những gì máy đã gác — dự kiến co đáng kể
6. `search` tra CSV · `validate_data` gác schema từng ô
7. **Chỉ khi đó** mới viết `SKILL.md`

Thứ tự này là điều bộ trước làm ngược: viết skill trước, dựng kho sau, script tra sau cùng — kết
quả là một file 72,5 KB phải mở cả để lấy một hàng 170 byte.

## Hai điều ghi lại cho lần sau

**Không quyết hình dạng dữ liệu trước khi đếm byte của nó.** Giả định "bảng là phần nặng nhất của
một bảng tra" nghe hiển nhiên, và nó sai: văn xuôi mới là phần nặng.

**Một con số bất ngờ phải kiểm bằng cách thứ hai trước khi dùng để quyết.** Phép đếm đầu cho 70%
code trong một file không có code. Cách kiểm thứ hai tốn một lệnh grep.
