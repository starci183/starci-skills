---
id: fe-patterns-loading-audit
title: audit.md
slug: /fe/patterns/loading/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo được của luật Loading.
---

# audit.md

> Version: `2.00` · Module: `loading`

Audit này kiểm hai thứ: luật có chọn được **một** mã từ tình huống đã nêu hay không, và mỗi mã thực
sự đang được **tầng nào** giữ — chứ không phải tầng nào người đọc tưởng.

## Verdict

Chấp nhận. Bảy mã bảo toàn số và nguyên nghĩa; cả bảy đều neo được vào code thật. Nhưng bốn trong
bảy chỉ do người đọc giữ, và đó là kết luận quan trọng nhất của bản audit này chứ không phải một ghi
chú bên lề.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `LOADING-1` vs `LOADING-2` | Loại trừ được: cây thứ hai nằm trong file/prop riêng, hay viết tại call site |
| `LOADING-2` vs `LOADING-3` | Loại trừ được: một phần tử giữ hình, hay một vùng giữ chiều cao |
| `LOADING-2` vs `LOADING-5` | Loại trừ được: nhánh còn lại là element khác, hay là `null` |
| `LOADING-3` vs `LOADING-5` | Loại trừ được: thứ bị bỏ là một vùng, hay một control chưa có đích |
| `LOADING-3` vs `LOADING-6` | Loại trừ được: chiều cao của một vùng, hay nhiều vùng chờ lẫn nhau |
| `LOADING-4` vs `LOADING-7` | Loại trừ được: thông báo ở từng ô, hay một lần ở khung vùng |
| `LOADING-6` vs `LOADING-7` | Loại trừ được: dùng chung cờ, hay thiếu hẳn tình huống `pending` |
| Nhiều mã cùng đúng | Chấp nhận. Đây không phải một thang bậc; một surface có thể vi phạm bốn mã cùng lúc và phải sửa cả bốn |

## Findings

- **Bảy mã đều neo được.** Không mã nào phải ghi `chưa neo được`. Neo trải trên ba loại bằng chứng
  khác nhau — một leaf, một union kiểu, một file test — và điều đó tự nó là bằng chứng rằng luật
  không chỉ nói về một tầng.
- **Chỉ hai mã có lint đứng sau.** `sources/fe/loading.mjs` phát ba rule, và cả ba đều nhắm vào cùng
  một sai lầm: cây thứ hai mô tả cây thứ nhất. `LOADING-1` lấy hai rule, `LOADING-2` lấy một.
- **`LOADING-3` được giữ bởi kiểu, nhưng chỉ nửa trên.** Union child-spec bắt buộc `repeats: true` đi
  kèm `restingCount: number` và cấm `repeats: false` mang con số đó. Nó làm cho việc **quên khai báo**
  số dòng nghỉ trở thành không viết được. Nó **không** ép ai render những dòng ấy ra màn hình.
- **`LOADING-5` sống trong một NGOẠI LỆ của lint, không phải trong một rule.**
  `no-resting-branch-at-call-site` bỏ qua ternary có nhánh `null` và làm rõ trong comment rằng đó là
  `LOADING-5` và nó đúng. Một ngoại lệ bảo vệ dạng đúng khỏi bị báo nhầm; nó không phát hiện được
  dạng sai.
- **Bốn mã còn lại không có gì cơ học đứng sau.** `LOADING-4`, `LOADING-5`, `LOADING-6`, `LOADING-7`
  đều compile sạch, lint sạch, render ra màn hình, và sai.
- **Mối nối block↔leaf là chỗ hỏng thầm lặng nhất** và không mã nào riêng lẻ phủ hết nó: block tự vẽ
  dáng nghỉ là `LOADING-1` nếu nó gọi twin, nhưng chỉ là `LOADING-7` viết cẩu thả nếu nó vẽ inline —
  và bản inline thì không rule nào thấy.

## Decisions

- Giữ đúng bảy mã, đúng số, đúng nghĩa: `LOADING-1` … `LOADING-7`. Không thêm, không bớt, không đánh
  số lại. Các số này đã bị trích dẫn từ nơi khác.
- Giữ nguyên mọi quyết định của bản luật phẳng, kể cả bảng mối nối hai nửa và bảng **Forbidden** —
  bảng đó nay nằm trong cột *Forbids* của Situation Codes.
- Ghi **tầng giữ** ra thành một bảng riêng thay vì để người đọc suy đoán. Một luật không nói tầng thì
  bị đọc như thể có enforcement, và người đầu tiên tin cách đọc đó chính là người ship ra đúng cái
  defect mà luật được viết để chặn.
- Ghi **anchor** ra thành một bảng riêng. Luật không chỉ được vào code thật là đề xuất, không phải
  luật.
- Xếp `LOADING-3` vào `unrepresentable` và làm rõ ngay tại chỗ rằng tầng đó chỉ giữ phần **khai báo**.
  Không làm tròn lên, cũng không hạ xuống `documented` — cả hai cách đều nói sai một nửa sự thật.
- Giữ mọi ví dụ ở dạng TSX thường, không tên sản phẩm, không component library.

## Rủi ro còn mở

### Bốn mã chỉ do người đọc giữ

- **`LOADING-4` — giấu khỏi trợ năng.** Một rule sẽ phải thấy được: element nào đang ở **nhánh nghỉ**
  của một biểu thức điều kiện, và nhánh ấy có đặt `aria-hidden` hay không. Phần "đang ở nhánh nghỉ"
  là khả thi khi hình dạng là `isLoading ? X : Y` hoặc `className={isLoading ? … : …}`; nó **không**
  khả thi khi cờ đã bị đổi tên, tính toán lại, hoặc truyền qua ba tầng props. Rule viết được sẽ là
  một rule đúng trong đa số trường hợp và im lặng ở phần còn lại — và một rule im lặng có chọn lọc
  còn nguy hiểm hơn không có rule, vì nó tạo ra niềm tin rằng chỗ nào không đỏ là chỗ đó đúng.
- **`LOADING-5` — control chưa có đích.** Một rule sẽ phải biết `href`, `onPress` hay `id` của control
  ấy tại thời điểm render có phải `undefined` hay không. Đó là câu hỏi về **giá trị lúc chạy**, không
  phải về **hình dạng cú pháp**, nên ESLint không trả lời được. Chỗ này chỉ có thể lên tầng
  `unrepresentable`: nếu control nhận đích qua một type buộc phải có đích — `href: string` chứ không
  phải `href?: string` — thì một control không đích trở thành không viết được. Đó là một đề xuất rule
  change thật, và nó chưa được đưa ra.
- **`LOADING-6` — mỗi vùng một cờ.** Một rule sẽ phải biết hai cờ có đến từ **hai request khác nhau**
  hay không. Cái nó thấy được chỉ là cú pháp: `a.isLoading || b.isLoading`, hoặc một `isLoading` được
  truyền xuống nhiều hơn một component con trong cùng một file. Cả hai heuristic đó đều báo nhầm ở
  trường hợp hợp lệ đã ghi trong Ngoại lệ — hai phần đọc từ **cùng** một câu trả lời. Ranh giới thật
  nằm ở tầng dữ liệu, và ESLint không nhìn thấy tầng dữ liệu.
- **`LOADING-7` — `pending` trong union.** Một rule sẽ phải thấy: type nào đang là state union của một
  block, và trong đó có literal `"pending"` hay không. Việc này khả thi hơn ba mã trên, nhưng nó cần
  **type information**, tức là một typed lint rule chứ không phải một rule cú pháp — và nó cần một
  quy ước xác định "đây là một block" mà hiện chưa có gì cơ học nói ra. Đây là mã có khả năng lên
  `enforced` cao nhất trong bốn mã, và nên là ứng viên đầu tiên.

### Lỗ trong hai mã đang được coi là `enforced`

- **`LOADING-1` bắt theo TÊN FILE.** `no-resting-twin-component` chỉ nổ khi file tên `…Skeleton`. Một
  twin đặt tên `CoursePlaceholder`, `RestingCard` hay `CardShell` đi qua sạch sẽ. Rule bắt được cái
  tên phổ biến nhất, không bắt được cái ý định.
- **`LOADING-2` bắt theo CHÍNH TẢ CỦA CỜ.** `WAITING_FLAG` nhận `isLoading`, `isSkeleton`,
  `isPending`. Một ternary trên `loading`, `busy` hay `!data` không bị nhìn thấy. Đây là chỗ dễ lách
  nhất mà không ai cố ý lách: người ta chỉ đặt tên biến khác đi.
- **Cả ba rule chỉ soi `/src/components/`.** Một twin nằm trong thư mục page, feature hay module thì
  ngoài tầm. Điều này là cố ý — cây component là nơi luật này áp — nhưng nó có nghĩa là con số "hai
  mã đã enforced" chỉ đúng bên trong cây đó.

### Bất đồng được ghi lại, không sửa lén

- **`LOADING-3` gộp hai việc vào một mã**: "giữ chiều cao" và "số dòng lặp là một quyết định". Chúng
  được giữ bởi hai tầng khác nhau — cái sau là `unrepresentable`, cái trước là `documented` — và một
  mã mang hai tầng là chỗ bảng *Tầng giữ* buộc phải nói thêm một câu. Nếu thực tế cho thấy hai việc
  ấy cần tách, đó là một **đề xuất rule change** và phải qua changelog, không phải một lần đọc khác
  đi. Luật phẳng đã gộp chúng, nên bản này bảo toàn.
- **Bảy mã không phải một thang.** Ai quen với các module đánh số theo bậc sẽ đọc `LOADING-1`…`7` như
  thể `7` nặng hơn `1`. Không phải. Đã làm rõ ở `INDEX.md`, và vẫn là chỗ dễ đọc nhầm nhất của bản
  này.

## Re-audit Triggers

- Có thêm hoặc bớt một rule trong `sources/fe/loading.mjs` — bảng *Tầng giữ* phải đổi theo cùng lúc.
- Có đề xuất buộc `href`/`onPress` thành bắt buộc trong type của control, tức là `LOADING-5` xin lên
  tầng `unrepresentable`.
- Có typed lint rule kiểm state union của block, tức là `LOADING-7` xin lên tầng `enforced`.
- Một trong các file neo bị đổi tên, chuyển chỗ hoặc mất đi — mã tương ứng lập tức mất neo và tụt về
  đề xuất cho tới khi có neo mới.
- Xuất hiện một twin đặt tên không kết thúc bằng `Skeleton`, hoặc một cờ chờ đặt tên ngoài
  `isLoading`/`isSkeleton`/`isPending`.
- Có yêu cầu lặp lại mà một câu hỏi phân định trong `example.md` vẫn không giải quyết được.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
