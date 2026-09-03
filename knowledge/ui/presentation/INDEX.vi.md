# UI presentation

Presentation là tầng quyết định UI cuối cùng:

```text
business
-> composition chọn cấu trúc DOM, layout và Grammar object
-> presentation chốt giá trị CSS trên boundary do app sở hữu
-> UI đã render
```

Các rule trong folder này là bắt buộc có điều kiện: khi phần `Khi nào` khớp, presentation phải dùng
rule đó hoặc giữ giá trị tương đương đã được public Grammar API cung cấp.

## Authority

Presentation được phép:

- đặt quan hệ giữa các Grammar object đã được composition chọn;
- style boundary page, section, container hoặc content region do app sở hữu;
- chọn public prop của `Text` và `Heading` dựa trên cấp độ thông tin business;
- chốt wrapping, measure và overflow cho content do app sở hữu.

Presentation không được:

- chọn lại hoặc dựng lại cấu trúc DOM, flex/grid layout hay Grammar component;
- thêm padding, typography hoặc paint vào bên trong `Card`, `Input`, `Button` hay Grammar object khác;
- reach-through vào Grammar component bằng selector hoặc consumer class;
- quyết định responsive transformation, CTA priority, state, focus hay motion; chúng thuộc nhóm
  knowledge khác.

Layout class có thể xuất hiện trong ví dụ vì composition đã chọn chúng từ trước. Chúng chỉ là context,
không phải recommendation của presentation.

## Danh mục

| Quyết định | Knowledge |
| --- | --- |
| Khoảng cách giữa các object đã ghép | [Gap](gap.vi.md) |
| Inset page/section/container của app | [Padding](padding.vi.md) |
| External offset ngoại lệ hoặc auto placement | [Margin](margin.vi.md) |
| Cấp độ size, weight và heading | [Font](font.vi.md) |
| Nhấn mạnh text default, muted và accent | [Tone](tone.vi.md) |
| Surface ngữ nghĩa của vùng do app sở hữu, kèm foreground đi cặp | [Surface](surface.vi.md) |
| Separator hay border vẽ cạnh do app sở hữu, và cạnh nào bỏ đường kẻ | [Boundary](boundary.vi.md) |
| Góc của surface, mark hay pill do app sở hữu tròn tới đâu | [Radius](radius.vi.md) |
| Giới hạn width và height của content region | [Measure](measure.vi.md) |
| Wrapping, alignment và truncation | [Text flow](text-flow.vi.md) |
| Scroll và clipping boundary do app sở hữu | [Overflow](overflow.vi.md) |

## Cấu trúc rule

`GAP-1`, `FONT-1` và các tên `PREFIX-n` khác là địa chỉ thứ tự ổn định. Con số không phải bước
Tailwind, giá trị CSS, component variant hay mức độ nghiêm trọng.

Bảng "Common đã sở hữu" trong mỗi topic được sinh ra từ claim `data-contract` mà package công bố,
bằng `scripts/generate-presentation-owned.mjs`, nên không ai sửa tay: một hàng sai thì sửa component,
không sửa bảng. Một case bên dưới bảng chỉ được thêm khi hai block bằng chứng được uỷ quyền cùng cho
thấy tình huống đó, đúng luật bằng chứng mà các idiom của family đang dùng; xuất hiện một lần là
quyết định sản phẩm, chưa phải rule.

Mỗi rule chỉ có heading và đúng một bảng:

| Case | When | Common render |
| --- | --- | --- |
| Case 1 | Điều kiện cụ thể chọn rule. | TSX inline qua API public hiện có của `@starci/grammar/common`, kèm prop, class hoặc giá trị đã resolve khi source chứng minh được. |

Chỉ thêm `Case 2`, `Case 3` và các row tiếp theo khi chúng là những đầu vào khác nhau nhưng cùng một
quyết định. Code nằm trong bảng. Không thêm `Why`, `When not to use`, code block rời, audit verdict,
API tưởng tượng hay ví dụ placeholder.
