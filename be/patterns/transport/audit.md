---
id: be-patterns-transport-audit
title: audit.md
slug: /be/patterns/transport/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo của luật Transport.
---

# audit.md

> Version: `2.00` · Module: `transport`

Audit này kiểm hai chuyện: luật có chọn được **một cửa duy nhất** từ dữ kiện đã nêu hay không, và mỗi
mã đang được giữ ở **tầng nào** — chứ không phải tầng nào ta muốn nó được giữ.

## Verdict

Chấp nhận. Ba mã giữ nguyên số và nguyên nghĩa, cả ba đều neo được vào code thật, và bảng tầng giữ
nói thẳng rằng một mã hiện chỉ có người đọc giữ. Nhưng chấp nhận **kèm hai finding phải mang theo**:
danh sách bốn ca không phủ hết những cửa đang tồn tại, và rule đọc route đang bị dạng khai báo phổ
biến nhất trong source làm cho mù một nửa.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `TRANSPORT-1` vs `TRANSPORT-2` | Loại trừ được: hoặc chỉ ra được một trong bốn ca kèm bằng chứng trong file, hoặc không. Không chỉ ra được thì mặc định thắng |
| `TRANSPORT-1` vs `TRANSPORT-3` | Loại trừ được: một bên chọn giao thức, một bên chọn địa chỉ. Trả lời cái này không miễn cái kia |
| `TRANSPORT-2` vs `TRANSPORT-3` | Loại trừ được: một file có thể qua mã này và trượt mã kia |
| Ca external vs ca operator | Loại trừ được khi đã nêu **ai chọn thời điểm gọi** |
| Ca bytes vs `TRANSPORT-1` | Loại trừ được khi đã nêu payload là byte thật hay field mã hoá thành chuỗi |
| Ca machine vs ca operator | Loại trừ được khi đã nêu có phiên hay không, chứ không phải phiên của ai |
| Bốn ca vs ngoại lệ probe | Loại trừ được bằng đúng một câu hỏi: cửa này có phải trả lời khi tầng feature đã chết không |
| Thiếu dữ kiện về ca | Mặc định vào schema; gánh nặng chứng minh nằm ở phía cửa không phải GraphQL |

## Findings

- Hai mã có rule giữ: `TRANSPORT-2` (`rest-door-needs-a-reason`) và `TRANSPORT-3`
  (`door-lives-in-features`). Mã còn lại — `TRANSPORT-1` — chỉ có người đọc giữ.
- **`TRANSPORT-1` không thể có rule, và lý do đáng ghi lại.** Vi phạm của nó là một **sự vắng mặt**:
  một thao tác lẽ ra phải nằm trong schema thì không bao giờ được viết ra, vì đã có người viết một
  route thay thế. Parser thấy token đang tồn tại; nó không thấy một mutation ai đó quyết định không
  khai báo. Cái giữ `TRANSPORT-1` trên thực tế là rule của `TRANSPORT-2` đánh vào cùng một quyết định
  từ đầu bên kia — route thay thế ấy vẫn phải tự biện minh, và phần lớn không biện minh nổi.
- **`TRANSPORT-3` hiện đang giữ sạch.** Quét `@Controller` khắp cây năng lực của source tham chiếu
  cho ra **không** kết quả nào; toàn bộ cửa nằm dưới cây `features`. Đây là loại neo mạnh nhất một
  mã có thể có: cái nó cấm hiện không tồn tại, và cây thư mục tự chứng minh điều đó mà không cần ai
  mở tài liệu ra tra.
- **Rule đọc route bị dạng khai báo object làm mù.** Hàm đọc route chỉ nhận chuỗi literal; gặp
  `@Controller({ path: … , version: … })` nó trả về chuỗi rỗng. Toàn bộ controller trong cây door HTTP
  của source tham chiếu dùng đúng dạng object ấy, nên **hai trong bốn nhánh nhận diện theo route —
  `pods|internal|agents` và `api/ops` — hiện không bao giờ khớp được**. Hai ca ấy hiện chỉ còn sống
  nhờ nhánh đọc nội dung file (guard operator, service token), và ca machine thì không còn nhánh nào
  cả.
- **Đo thật trên source tham chiếu: 19 controller trong cây door HTTP.** Sáu cái được nhận vì đường
  dẫn có chữ `webhook`; năm cái được nhận qua nhánh byte; **tám cái không cho rule thấy lý do nào**.
  Con số này không kết luận rằng tám cửa ấy sai — nó kết luận rằng lý do của chúng, nếu có, hiện
  không nằm trong file. Đó đúng là hạng vấn đề mà bản luật phẳng mô tả: thiết kế phần lớn mạch lạc mà
  trông như một mớ hỗn độn.
- **Có cửa được nhận đúng vì một lý do sai.** Các controller xử lý bước redirect và callback của một
  luồng OAuth dùng `@Res()` để phát 302 cho trình duyệt, không phải để stream byte. Rule cho chúng
  qua ở nhánh **bytes**. Kết quả cuối cùng là đúng — chúng thật sự không thể là GraphQL — nhưng lý do
  được ghi nhận không phải lý do thật của chúng, và một bằng chứng đúng-vì-tình-cờ sẽ hỏng ngay lúc
  có người dọn `@Res()` đi.
- **Lối ra thứ năm hiện không có thực thể nào.** Trong source tham chiếu, health là một **năng lực**
  nằm dưới cây platform và được phơi ra bằng một query GraphQL cùng một socket gateway; không có
  controller probe nào. Ngoại lệ probe vì thế đang là một lối ra **được phép mà chưa dùng**. Ghi lại
  ở đây để lần sau không ai đọc nó thành một lỗ hổng đã bị lợi dụng.
- **Rule chỉ tồn tại ở canon, chưa được cổng của repository bật.** `sources/be/transport.mjs` công bố
  cả hai rule ở mức `error` trong `recommended`, và `sources/be/index.mjs` gom law `transport` vào
  plugin. Nhưng file cấu hình lint của repository tham chiếu liệt kê từng rule một và **không liệt kê
  hai rule này**. Nói cách khác: tầng giữ ở canon là `enforced`, còn cổng thực tế đang im lặng.

## Decisions

- Giữ đúng ba mã: `TRANSPORT-1`, `TRANSPORT-2`, `TRANSPORT-3`, nguyên số, nguyên nghĩa. Mã bị trích
  dẫn từ file luật khác và từ task record, nên đánh số lại là làm hỏng một trích dẫn đã có người viết
  ra.
- Không thêm mã mới trong lần chuyển này. Module vào với ba mã và ra với ba mã. Những ca chưa được
  phủ nằm ở mục "Rủi ro còn mở", không được lén thành mã thứ tư.
- Giữ **danh sách bốn ca là đóng**, đúng như bản phẳng quyết định. Một danh sách mở thì không phải
  danh sách; đúng lúc nó mở ra là lúc nó thôi ngăn được điều gì.
- Giữ nguyên tắc **bằng chứng đọc từ file, không đọc từ sổ đăng ký**. Đây là quyết định trung tâm của
  bản phẳng và được giữ nguyên vẹn: sổ đăng ký mục ngay lần đầu có người quên cập nhật, và nó cho
  phép một cửa được biện minh bằng một tài liệu thay vì bằng việc nó làm.
- Giữ ràng buộc của `TRANSPORT-3` ở đúng `src/modules/**`, và giữ nguyên miễn trừ cho ứng dụng riêng
  dưới `apps/*`.
- Ghi bảng **Tầng giữ** vào `INDEX.md` và ghi trung thực: một dòng `documented` là hiện trạng, không
  phải chỗ trống cần che.
- Ghi bảng **Anchor**: mỗi mã trỏ vào một path thật và nói rõ nhìn cái gì ở đó. Luật không chỉ được
  vào code thật là đề xuất, không phải luật.
- Giữ mọi ví dụ ở dạng TypeScript trung tính. Chỗ bản phẳng nêu tên một module riêng, ví dụ được viết
  lại bằng hình dáng chung mà backend nào cũng có.

## Rủi ro còn mở

- **`TRANSPORT-1` chỉ `documented`, và không rule nào giữ nổi.** Để giữ được nó, rule sẽ phải thấy
  **một thao tác lẽ ra phải tồn tại nhưng không tồn tại** — tức là so danh sách nghiệp vụ với danh
  sách resolver, rồi nói ra cái thiếu. Không có danh sách nghiệp vụ nào ở dạng máy đọc được, và cũng
  không nên có: thứ ấy chính là sổ đăng ký mà `TRANSPORT-2` cấm, chỉ khác chiều. Cái xấp xỉ khả thi
  duy nhất đã có sẵn — `rest-door-needs-a-reason` đánh vào chính route đã thay chỗ cho mutation. Chấp
  nhận rằng `TRANSPORT-1` được giữ **gián tiếp**, và nói ra điều đó thay vì để bảng tầng giữ trông
  đẹp hơn thực tế.
- **Nhánh route của `rest-door-needs-a-reason` hiện chết một nửa.** Một rule giữ được ca machine và
  ca operator theo route sẽ phải đọc thêm **dạng object** của `@Controller`: lấy thuộc tính `path`
  trong object literal, và khi `path` là một lời gọi hàm thì thừa nhận rằng route không đọc được và
  chuyển hẳn sang bằng chứng từ đường dẫn file. Làm được, và là thay đổi rule chứ không phải một lần
  đọc khác đi — nên nó thuộc `changelog.md`, không thuộc chỗ này.
- **Luồng redirect của trình duyệt không nằm trong bốn ca.** Một controller phát 302 cho user agent
  trong luồng OAuth không phải webhook, không phải byte, không phải máy tự đăng ký, và cũng không
  phải một danh tính khác hạng — nó là **một trình duyệt đang điều hướng**, thứ không cầm GraphQL
  client nào. Bản phẳng chốt bốn ca và audit này **giữ nguyên bốn ca**; nhưng hiện trạng là những cửa
  ấy đang lọt qua nhánh byte nhờ một `@Res()` dùng cho việc khác. Đây là bất đồng được ghi ra, không
  phải một lần sửa lén: hoặc luật cần một ca thứ năm nói rõ về điều hướng trình duyệt, hoặc những cửa
  ấy cần một bằng chứng khác trong file. Cần thầy quyết trước khi ai đó "dọn dẹp" `@Res()` và làm tám
  cửa đang xanh chuyển đỏ mà không hiểu vì sao.
- **Tám controller hiện không cho rule thấy lý do.** Trước khi bật rule ở mức `error`, tám file ấy
  phải được đọc từng cái và xếp vào một trong hai kết cục: hoặc lý do có thật và phải được đưa vào
  file (đổi tên thư mục, đổi route, hoặc thêm guard nói đúng chủ thể), hoặc không có lý do và thao
  tác phải về schema. Bật `error` trước khi làm việc đó sẽ chặn mọi commit chạm vào chúng, và đó là
  cách một rule đúng bị gỡ bỏ.
- **`TRANSPORT-2` và `TRANSPORT-3` được đánh `enforced` ở canon, nhưng cổng của repository chưa bật
  hai rule ấy.** Bảng Tầng giữ nói tầng mà **canon** giữ; nó không hứa rằng mọi repository đã nối
  dây. Rủi ro thật là đọc nhầm bảng ấy thành "chỗ này đã có máy canh". Chưa có, cho tới khi hai tên
  rule xuất hiện trong cấu hình lint có hiệu lực.
- **Không mã nào ở tầng `unrepresentable`.** Về nguyên tắc có thể đẩy `TRANSPORT-3` lên tầng ấy bằng
  cách khiến decorator door không import nổi từ trong cây năng lực. Chưa đề xuất trong phiên bản này;
  nếu đề xuất, đó là một rule change và phải đi qua `changelog.md`.

## Re-audit Triggers

- Có đề xuất thêm hoặc bỏ một mã `TRANSPORT-<n>`, hoặc thêm một ca thứ năm vào danh sách bốn ca.
- Có rule mới trong `sources/be/transport.mjs`, hoặc một rule đổi mức giữa `off`, `warn` và `error`.
- Hai rule của module được nối vào cấu hình lint có hiệu lực của một repository — lúc đó số nợ phải
  được đo lại từ đầu.
- Xuất hiện một `@Controller` trong cây năng lực mà không ai báo đỏ.
- Một controller được dọn `@Res()` và mất bằng chứng đang giữ nó xanh.
- Hàm đọc route học được dạng object của `@Controller` — mọi con số đo trước đó hết hiệu lực.
- Xuất hiện một sổ đăng ký route "đã duyệt" ở bất kỳ đâu trong repository.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
- Một anchor trong `INDEX.md` trỏ vào path không còn tồn tại.
