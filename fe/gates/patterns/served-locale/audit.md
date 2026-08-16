---
id: fe-patterns-served-locale-audit
title: audit.md
slug: /gates/patterns/served-locale/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo vào code thật của luật Served locale.
---

# audit.md

> Version: `2.00` · Module: `served-locale`

Audit này kiểm hai thứ: luật có chọn được **một** mã từ các dữ kiện đã nêu và chỉ từ đó hay không, và
mỗi mã có thật sự được giữ bởi tầng mà nó tự nhận hay không.

## Verdict

Chấp nhận, với hai khoảng hở đã được đo và ghi rõ. Năm mã đóng, phân định được bằng câu hỏi nghiệp vụ,
không phụ thuộc tên sản phẩm nào. Nhưng chỉ **hai trong năm** mã có rule giữ; và hai rule đó, đúng như
chính file rule tự khai, **không nhìn thấy giá trị** mà link tính ra — nên mã quan trọng nhất về mặt
đúng-sai, `LOCALE-2`, hoàn toàn là câu hỏi review.

Khoảng hở thứ hai nằm ở neo: cả năm mã đều neo được, nhưng neo của `LOCALE-4` chỉ chứng minh rằng
client **luôn khai báo một cái gì đó**, không chứng minh rằng thứ được khai báo đến từ người đọc.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `LOCALE-1` vs `LOCALE-5` | Loại trừ được: một bên nói **thiếu** chỗ khai báo, một bên nói **thừa** chỗ khai báo |
| `LOCALE-1` vs `LOCALE-2` | Loại trừ được: có link locale trong chain là `LOCALE-1`; link đó lấy giá trị ở đâu là `LOCALE-2` |
| `LOCALE-2` vs `LOCALE-3` | Loại trừ được khi đã nêu cookie đang làm **nguồn đọc** ở client hay làm **phương tiện** sang server |
| `LOCALE-3` vs `LOCALE-4` | Loại trừ được khi đã nêu giá trị **không tới được** hay câu trả lời mặc định **được chấp nhận** |
| `LOCALE-4` vs mọi mã | Loại trừ được bằng phép thử "đổi người đọc sang ngôn ngữ kia thì câu trả lời có đổi không" |
| `LOCALE-5` vs `LOCALE-2` | Không loại trừ nhau: một call site vừa viết header vừa nhận `locale` vi phạm cả hai, và luật nói ghi cả hai |
| Thiếu dữ kiện | Mặc định coi lời gọi là có dữ liệu dịch theo server; chỉ hỏi một câu khi bên yêu cầu làm rõ câu trả lời không đổi theo người đọc |

## Findings

- **Hai rule của module chỉ phủ hai mã.** `starci-fe/api-client-attaches-the-locale` giữ `LOCALE-1`,
  `starci-fe/locale-header-belongs-to-the-link` giữ `LOCALE-5`. Ba mã còn lại chỉ có người đọc giữ.
- **Cả hai rule đều là dữ kiện ở mức MỘT FILE, và file rule tự khai điều đó thay vì để nó được suy
  ra.** Chain được lắp trong một file; header được viết ở chỗ nó được viết. Cái mà không rule nào
  thấy là **giá trị**: một link tên `createAttachLocaleLink` gắn `"en"` cứng thoả cả hai rule và sai
  đúng ở chỗ luật này sinh ra để chặn. Đây là chỗ đáng khen của file rule chứ không phải chỗ đáng
  trách: nó nói ra giới hạn thay vì nhận một bảo đảm nó không có.
- **Rule thứ nhất khoá theo LINK TERMINAL chứ không theo đường dẫn, và đó là quyết định đúng.** Một
  repository có thể đặt tên thư mục client là bất cứ gì; một pattern đường dẫn đoán sai sẽ hoặc bỏ sót
  chain thật, hoặc bắn vào mọi helper nằm cạnh. Chain nhận diện được bằng **việc nó làm**.
- **Ngoại lệ `links/` được tìm ra bằng cách CHẠY, không bằng cách nghĩ.** Bản đầu của rule báo lỗi
  đúng file định nghĩa link terminal và spec của nó, trên một repository đã làm mọi thứ đúng. Ở đó
  không có cách nào đúng để thoả rule, và một rule không có cách nào thoả là một finding về rule.
  Đây là loại bằng chứng mà canon coi trọng hơn mọi lập luận: nó được đo.
- **Đo trên một cây source thật đang chạy luật này:** chuỗi header xuất hiện ở đúng **một** file
  production — chính file link locale — hai lần còn lại là prose của chính file đó. Chain lắp link
  locale nằm ngoài nhánh điều kiện của auth. Không hook nào trong tầng api mang tham số `locale`.
  Nghĩa là `LOCALE-1`, `LOCALE-2` và `LOCALE-5` không chỉ có luật, chúng có **kết quả bằng không**
  trên cây đó.
- **Spec của chain đã lệch khỏi chain, và lệch theo hướng nói lên điều gì đó.** Cùng cây source đó:
  chain ẩn danh dựng ra **bốn** phần tử và chain có auth dựng ra **năm**, trong khi spec vẫn khẳng
  định ba và bốn. Dù kết cục là gate đỏ hay spec không được chạy, kết luận cho `LOCALE-1` giống nhau:
  thứ đang giữ mã này là **rule**, không phải spec. Một phép đếm được viết trước khi link locale ra
  đời không mô tả chain hiện tại.
- **Link locale là link duy nhất không có spec.** Các link còn lại trong cùng thư mục — retry,
  timeout, terminal, bearer — đều có file `.test.ts` bên cạnh; link locale thì không. Đây là chỗ khó
  chịu nhất của bản đo: mắt xích **duy nhất** mà rule không nhìn được giá trị cũng là mắt xích
  **duy nhất** không có bài test nào nhìn hộ.
- **`LOCALE-4` neo được nhưng neo yếu, và neo đó có một nhánh tự mâu thuẫn.** Kiểu trả về của resolver
  là union locale đóng chứ không phải optional, nên không có đường nào gửi đi một request không khai
  báo — đó là neo. Nhưng nhánh không có địa chỉ (render phía server) trả về app default, nghĩa là với
  người đọc ngôn ngữ kia, lần render đầu tiên khai báo **đúng cái ngôn ngữ sai**, và chỉ được sửa ở
  lần fetch phía client. Quyết định này có trong source, có lý do viết kèm, và cùng hình dạng với link
  bearer; nó được **bảo toàn** ở `INDEX.md` như một ngoại lệ đóng. Chỗ audit không đồng ý nằm ở
  `Rủi ro còn mở`, không nằm trong một lần sửa âm thầm.

## Decisions

- Giữ đúng năm mã: `LOCALE-1`…`LOCALE-5`, nguyên số và nguyên nghĩa. Chúng đang được trích dẫn từ nơi
  khác; đổi số ở đây là làm gãy một trích dẫn đã có người viết ra.
- Giữ nguyên mọi quyết định của file luật phẳng: gắn **vô điều kiện** vì khách vãng lai cũng đọc bằng một
  ngôn ngữ; **địa chỉ** là nguồn mạnh nhất; **cookie không phải phương tiện** cross-origin; mặc định
  của server là **sàn**; **một** file viết header.
- Không tô một mã thành `enforced` khi rule chỉ chạm được vỏ của nó. `LOCALE-2` có một nửa **có thể**
  bắt bằng máy, nhưng nửa quyết định thì không, nên nó ở `documented` — nửa vời mà gọi là enforced thì
  bảng `Tầng giữ` mất luôn công dụng.
- Ghi ngoại lệ `links/` vào luật thay vì để nó sống trong comment của rule. Một ngoại lệ đã được đo
  mà chỉ nằm trong file rule là một ngoại lệ người đọc luật không biết mình được hưởng.
- Giữ mọi ví dụ ở dạng TS/TSX thường, không tên sản phẩm, không tên repository. Chỗ nào file luật phẳng gọi
  tên một component riêng thì bản này gọi theo vai trò.
- Luật là **bắt buộc**: không có lời gọi nào nhỏ tới mức được miễn khai báo mã.

## Rủi ro còn mở

Ba mã dưới đây chỉ ở tầng `documented`. Với mỗi mã, câu hỏi là: **một rule sẽ phải nhìn thấy gì** thì
mới giữ được nó — hoặc vì sao không rule nào giữ được.

- **`LOCALE-2` — nguồn của giá trị.** Đây là mã có rule khả thi **một nửa**, và nửa rẻ nhất là nửa
  cấm: trong tầng api, báo mọi tham số tên `locale`/`lang` trong một params type, và mọi khoá ngôn ngữ
  nằm trong một object `headers` ở call site. Nửa **không** làm được là nửa quyết định: "hàm này có
  đọc địa chỉ không". Nó nằm trong thân một hàm, thường ở file khác, và về mặt kiểu thì
  `getLocale?: () => Locale` giống hệt nhau dù bên trong đọc `window.location` hay `return "en"`.
  Chỉ có một dạng bằng chứng thay thế được: một spec dựng link với một địa chỉ cố định rồi khẳng định
  header phát ra. Trên cây source đã đo, **spec đó không tồn tại** — nên hiện tại mã này không được
  giữ bởi rule, cũng không được giữ bởi test.
- **`LOCALE-3` — cookie qua ranh giới origin.** Đây là mã **không rule nào ở mức file giữ được**, và
  nên nói thẳng lý do thay vì hẹn một rule sau này. Câu hỏi quyết định là "API có cùng origin với app
  không" — một dữ kiện của **môi trường triển khai**, sống trong cấu hình runtime, khác nhau giữa
  local, preview và production, và không có mặt trong bất kỳ file source nào rule đọc. Thứ duy nhất
  rule bắt được là một proxy yếu: `credentials: "include"` xuất hiện trên một chain ẩn danh. Proxy đó
  trả lời một câu hỏi khác và sẽ báo nhầm ở mọi repo cùng origin.
- **`LOCALE-4` — mặc định của server.** Cũng là mã không rule nào giữ được, và vì một lý do sạch sẽ:
  nó là dữ kiện về một **câu trả lời**, mà gate thì không bao giờ thấy response. Cách rẻ nhất để lấy
  lại tín hiệu **không phải** một rule mới, mà là một **nghĩa vụ test**: mỗi chain có một spec chặn
  `fetch` và khẳng định request đi ra có mang header. Spec đó bắt được cả trường hợp không gửi gì lẫn
  trường hợp chain mới quên link — nghĩa là nó phủ luôn phần `LOCALE-1` mà rule đang phủ, và phủ thêm
  phần `LOCALE-2` mà rule không phủ được. Đây là **đề xuất rule change**, nên nó nằm ở đây chứ không
  nằm trong `INDEX.md`.

  Rủi ro còn lại của mã này không đo được bằng code: nó là rủi ro **của người kiểm**. Một đội test
  toàn bộ ở ngôn ngữ mặc định sẽ không bao giờ thấy nó, và một bug report từ người đọc ngôn ngữ kia
  sẽ bị đóng vì "không tái hiện được".

- **Nhánh render không có địa chỉ.** Ngoại lệ đóng ở `LOCALE-2`/`LOCALE-4` cho phép trả app default
  khi không đọc được địa chỉ. Audit này bảo toàn quyết định đó vì nó có trong source thật và có
  cùng hình dạng với link bearer, nhưng ghi lại chỗ không đồng ý: với người đọc ngôn ngữ kia, lần
  render đầu **khai báo sai ngôn ngữ một cách tự tin**, và một khai báo sai tự tin khó nhìn ra hơn một
  khai báo thiếu. Nếu địa chỉ đọc được ở phía server — nó **có** ở phía server, chỉ là không ở trong
  một link chạy chung cho cả hai phía — thì nhánh này biến mất. Đó là một đề xuất thay đổi, không phải
  một lần chọn khác đi.

- **Link locale không có spec.** Đã ghi ở `Findings`; nhắc lại ở đây vì nó là rủi ro chứ không chỉ là
  một số đo. Chừng nào chưa có spec, `LOCALE-2` không có tầng nào giữ ngoài người đọc.

## Re-audit Triggers

- Có thêm một rule vào `.claude/sources/fe/served-locale.mjs`, hoặc một rule hiện có đổi phạm vi.
- Xuất hiện một spec dựng link locale với địa chỉ cố định và khẳng định header phát ra — lúc đó
  `LOCALE-2` có bằng chứng và bảng `Tầng giữ` phải được xem lại.
- Spec của chain được cập nhật lại cho khớp số phần tử, hoặc bị xoá.
- API và app trở thành cùng origin, hoặc ngược lại — `LOCALE-3` đổi hoàn toàn mức rủi ro.
- Có thêm một chain thứ hai chạm mạng (upload, batch, worker, script).
- Có call site production bắt đầu truyền hàm resolve vào link — seam đã thành tham số.
- Danh sách callee của link terminal hoặc của link locale trong file rule được nới thêm một tên.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
