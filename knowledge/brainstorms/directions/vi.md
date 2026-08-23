---
title: Directions · Vietnamese
---

# Hướng thị giác

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@direction-schema` | `knowledge/brainstorms/directions/schema.json` | file | Defines the only direction artifact this module may return. |
| `@visual-vocabulary-schema` | `knowledge/brainstorms/directions/vocabulary.schema.json` | file | Defines the live token inventory used to judge reuse and new verdicts. |
| `@artifact-validator` | `scripts/validate-artifact.mjs` | script | Enforces batch diversity and token provenance before selection. |

Đầu vào là yêu cầu sản phẩm cùng vốn thị giác đang sống của frontend, và đầu ra là **3–4 hướng thị
giác** cùng một recommendation dựa trên evidence. Một hướng quyết định quan hệ dự kiến giữa vai trò ngữ nghĩa và token. Nó
không quyết định layout, giải phẫu block hay class.

Khi routed grammar cung cấp MASTER visual system, dừng trước candidate generation: trả system đó cùng page
deviation có evidence nếu có. StarCi dùng closed path này; page không chọn lại style, palette, typography,
density, shape, depth hay motion.

## Luật

Gu thị giác là một quyết định sản phẩm. Máy có thể từ chối token bịa, phương án trùng hay recommendation
không truy được về bằng chứng; máy không thể tuyên bố một phương án hợp lệ là đẹp. Tầng này chọn đúng một
object làm recommendation tạm thời để thiết kế cấu trúc tiếp tục mà không mở checkpoint owner riêng.
Owner duyệt hoặc phản biện direction đó khi nó đã nằm trong cache candidate và kết quả được implement trong cùng invocation.

Kho style bên ngoài chỉ là nguồn đề xuất. Một đề xuất chỉ thành candidate sau khi được phát biểu bằng
vốn của project này, hoặc gọi tên mọi token mới mà nó sẽ cần.
Khi grammar đã route emit visual contract, trục, role token và giá trị chính xác của contract là đầu vào
cố định, không phải trục candidate. Mọi direction mang cùng `lockedTokens`; chỉ composition được phép đổi.

## Đầu vào

| # | Đầu vào | Thiếu nó thì |
|---|---|---|
| 1 | Yêu cầu, đối tượng, tác vụ và cảm giác mong muốn | trang trí thay chỗ cho ý định sản phẩm |
| 2 | Bản kiểm kê CSS custom property được sinh từ source | candidate gọi tên giá trị sản phẩm không biểu đạt được |
| 3 | Current source screen và bằng chứng thương hiệu của project này | ngôn ngữ thị giác đang ship bị bỏ qua |
| 4 | Hướng dẫn design system vendor mà frontend đang dùng | ngữ nghĩa component và ý định thị giác mâu thuẫn |
| 5 | Bộ trục direction đóng | bốn cái tên che một lựa chọn thị giác |

Kho công khai, tên style, palette và cặp font có thể mở rộng vùng tìm kiếm. Chúng không bao giờ đứng
trên năm đầu vào và không được chép vào cây làm canon.

## Đọc bằng chứng

1. Nói đối tượng, tác vụ và cảm giác dự kiến, mỗi thứ một câu. Từ chối khi yêu cầu không cho cơ sở để
   nói bất cứ thứ nào.
2. Kiểm kê vốn đang sống và ghi digest nội dung của nó thành `vocabularyAt` trong mọi direction.
   Token `reuse` phải có trong kiểm kê; token `new` phải chưa có.
3. Đọc màn hình đã duyệt như bằng chứng, không như lệnh lặp lại. Ghi cái đã được chấp nhận và nhu cầu
   của bề mặt mới khác nó ở đâu.
4. Chọn bộ trục trước khi đặt tên hướng. Hai bộ giống nhau là một hướng; hai nhãn trục khác nhau nhưng
   có cùng toàn bộ ánh xạ vai trò sang token cũng chỉ là một hướng vì chúng render giống nhau.
5. Ánh xạ mọi vai trò ngữ nghĩa vào một quyết định token. Token mới mang lý do vốn hiện tại không trả
   lời được.
6. Gọi tên điều mỗi hướng từ chối. Một hướng không có ranh giới chỉ là tính từ, chưa phải quyết định.

## Trục direction

| Trục | Giá trị |
|---|---|
| tương phản | mềm / cân bằng / mạnh |
| mật độ | gọn / cân bằng / thoáng |
| hình | vuông / mềm / tròn |
| độ sâu | phẳng / phân lớp / nổi |
| chuyển động | tĩnh / tiết chế / biểu cảm |

Các giá trị dùng để so sánh, không phải CSS. Cách biểu đạt chính xác nằm trong ánh xạ vai trò sang
token bên cạnh chúng.

## Vai trò ngữ nghĩa

Mọi direction giải cùng mười ba vai trò: `ground`, `surface`, `content`, `mutedContent`, `accent`,
`separator`, `display`, `body`, `label`, `radius`, `elevation`, `duration`, và `easing`.

Một vai trò có đúng một phán quyết:

| Phán quyết | Nghĩa | Bằng chứng phải nợ |
|---|---|---|
| `reuse` | custom property được gọi tên có trong kiểm kê | chỗ xuất hiện trong kiểm kê |
| `new` | chưa property nào trả lời vai trò này | property đề xuất, giá trị CSS chính xác và lý do nó cần thiết |
| `none` | một vai trò radius, elevation hay motion tuỳ chọn được chủ ý bỏ | vì sao sự vắng mặt thuộc direction |

Tên token dùng lại được neo vào trạng thái source trong `vocabularyAt`. Token mới mang giá trị CSS chính
xác vì preview và same-session source implementation phải buộc vào cùng một quyết định. Utility class, font tải về và biến vendor sao
chép vẫn nằm ngoài artifact; cài dependency cần một lần duyệt riêng.

## Quy tắc

1. Direction không mang class. Raw visual value chỉ xuất hiện trong quyết định token `new` hoặc map `lockedTokens` do grammar sở hữu.
2. Mọi direction mang digest kiểm kê trong `vocabularyAt`; mọi token `reuse` có ở đó và mọi token `new` vắng mặt.
3. Mọi direction ánh xạ đủ mười ba vai trò; `none` chỉ hợp lệ với radius, elevation, duration và easing.
4. Mọi direction gọi tên ba đến năm từ tính cách và một đến năm điều từ chối rõ ràng.
5. Không hai direction nào trong một lô trùng cả bộ trục hoặc toàn bộ ánh xạ vai trò sang token.
6. Có ít nhất một direction khác đáng kể current-source precedent gần nhất khi source có precedent.
7. Chỉ trả ít hơn ba khi bằng chứng chỉ cho phép ít hơn, và nói lý do; không bao giờ nhồi cho đủ.
8. Feedback thay cache round; direction không trở thành durable authority ngoài invocation.
9. Mọi batch schema 2 đề xuất đúng một candidate và ghi lý do dựa trên evidence.
10. Visual contract của grammar được chép byte-for-byte vào `lockedTokens`; đổi trục, role token hay giá trị đều làm direction bị từ chối.
11. Routed MASTER thay direction brainstorming; page chỉ ghi deviation.

## Preview

Render mọi candidate trên **cùng một bề mặt tham chiếu và cùng nội dung**: navigation, heading, body
text, action, form control, hàng lặp, bề mặt có biên, overlay và lỗi đã ngã ngũ. Preview được giải token
từ kiểm kê, nhưng không được đưa vào giá trị vắng mặt trong quyết định JSON.

Cùng nội dung là mẫu đối chứng. Đổi layout hay copy giữa các candidate khiến người chủ so hai sản phẩm
thay vì hai direction. HTML và JSON là session evidence dựng lại được; approval bind selected candidate với disclosed source boundary.

## Từ chối

Từ chối khi thiếu đối tượng hay cảm giác dự kiến, bằng chứng thương hiệu mâu thuẫn mà chưa có phán quyết
của người chủ, không kiểm kê được vốn đang sống, hoặc một giá trị thị giác bắt buộc chưa có token và
chưa ai cho phép tạo token mới. Trả về quyết định còn thiếu cùng những vai trò nó chặn.

## Đầu ra

Đầu ra là JSON được kiểm bởi `@direction-schema`. Lượt mới ghi `schema: 2`, gồm `recommended.id` và lý do
dựa trên evidence, rồi kiểm với cả schema lẫn vốn được sinh trước khi thiết kế cấu trúc:

```bash
node @artifact-validator \
  --schema @direction-schema \
  --data <batch.json> --vocabulary <visual-vocabulary.json>
```

Vòng direction không có approval hash và không có checkpoint owner riêng. Object direction được đề xuất
được chép nguyên vào mọi candidate layout trong cùng cache round, nơi một `OK` duyệt đồng thời ý định thị giác,
composition và disclosed source boundary. Snapshot vốn khớp `@visual-vocabulary-schema`.

## Ví dụ đã giải

Với catalogue khoá học cho người cần so sánh nhanh, một candidate có thể là `quiet-precision`: tương
phản cân bằng, mật độ gọn, hình mềm, độ sâu phẳng và chuyển động tiết chế. Nó dùng lại token nền, bề mặt
và chữ của project, từ chối gradient trang trí cùng bề mặt nổi, và không đề xuất vốn mới. Candidate
khác phải lệch trên một bộ trục thật, không chỉ gọi cùng lựa chọn đó là `editorial`.

## Phạm vi

Tầng này quyết định ý định thị giác và vốn token ngữ nghĩa của nó. Nó không đặt region, thiết kế trạng
thái block, chọn utility class, gán raw value cho token hay viết source frontend.
