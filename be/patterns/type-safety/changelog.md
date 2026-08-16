---
id: be-patterns-type-safety-changelog
title: changelog.md
slug: /be/patterns/type-safety/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật type-safety.
---

# changelog.md

> Current version: `2.00` · Module: `type-safety`

## Version Policy

Mỗi thay đổi luật được chấp nhận làm tăng phiên bản module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Thêm, bớt hoặc đánh số lại một mã `TYPE-<n>` **luôn** là thay đổi lớn, không bao giờ là một increment.
Số hiệu được trích dẫn từ luật khác, từ comment trong config lint và từ các task record cũ; đổi một
số là bẻ gãy một trích dẫn đã có người viết ra.

## 2.00 — 2026-08-16

Đổi số chính vì cấu trúc của module đổi: từ **một file luật phẳng** thành **module năm record**.
Nội dung luật **không** đổi — bản này là cùng một luật được diễn đạt đầy đủ hơn, không phải một luật
mới.

- **Tách năm record.** `be/canon/patterns/type-safety.md` → `be/patterns/type-safety/` với
  `INDEX.md` (luật, tiếng Anh, máy đọc trước), `vi.md` (tình huống nghiệp vụ từng mã), `example.md`
  (case và ngoại lệ), `audit.md` (phản biện) và `changelog.md` (record này). File luật phẳng vẫn ở
  nguyên chỗ cũ và không bị sửa.

- **Giữ nguyên sáu mã.** `TYPE-1`…`TYPE-6` mang đúng số và đúng nghĩa của bản phẳng: không `any`;
  không double cast qua `unknown`; tham số destructure mang kiểu có tên; enum thường; union phân
  biệt thay cho túi boolean; lối thoát hợp lệ khai tại làn. Không mã nào được thêm, bớt hay đánh số
  lại.

- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ tầng thật sự đang giữ nó: `unrepresentable`, `enforced`
  hay `documented`. Bốn mã ghi `enforced` và **gọi tên** rule giữ chúng; hai mã ghi `documented`.
  Cột `unrepresentable` rỗng, và bảng nói rõ vì sao điều đó mang thông tin chứ không phải thiếu
  sót: `TYPE-5` chính là mã **đòi** tầng ấy, và không tầng nào giữ được chính nó.

  Lý do bảng này tồn tại: một luật để người đọc tin rằng có lint canh trong khi không có gì canh thì
  tệ hơn không có luật, vì nó bán sự yên tâm mà không có gì đứng sau.

- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật kèm điều cần tìm ở đó. Mười ba neo, phủ cả sáu
  mã; không mã nào phải ghi `chưa neo được`. Đây là chỗ duy nhất trong module xuất hiện đường dẫn
  repository — một neo bắt buộc phải là đường dẫn thật, và đó chính là thứ làm nó thành neo.

- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới
  với các mã kề, và danh sách tình huống nghiệp vụ hay gặp — thay cho sáu đoạn văn liền mạch của bản
  phẳng.

- **Viết lại `example.md` cho đủ case.** Bản phẳng có bốn ví dụ; bản này có nhiều case cho mỗi mã,
  mỗi case đặt ĐÚNG cạnh SAI, kèm mục "ngoại lệ và nhầm lẫn", bảng ánh xạ yêu cầu sang mã, bảng phân
  định ranh giới và danh sách sai lầm lặp lại. Thêm những case mà bản phẳng chỉ nhắc tới mà không
  cho xem: kiểu có tên **index vào được**, enum được truyền **như một giá trị**, và kịch bản hai bản
  sao inline trôi ra xa nhau khi field thứ ba xuất hiện.

- **Rút mọi ví dụ về TypeScript thường, dáng NestJS.** Bản phẳng nhắc tới một module riêng của một
  hệ thống cụ thể; bản này khái quát hoá phần đó. Một luật ở shelf này phải đúng với bất kỳ back end
  nào — ví dụ cần tên riêng của một sản phẩm mới đọc được là ví dụ đứng sai chỗ.

- **Ghi ba khoảng cách giữa luật và mức thực thi thật.** `audit.md` ghi lại: `no-double-cast` được
  canon xuất bản nhưng chưa được bật ở repository; `no-inline-param-type` và `no-const-enum` đang
  chạy bằng bản sao cục bộ chứ không phải bản canon; và số hiệu section trong comment của config
  không khớp số hiệu mã trong luật. Cả ba đều được ghi lại chứ **không** được sửa ở đây — sửa cổng
  của một repository thuộc về một task có đo nợ.

- **Giữ nguyên một bất đồng thay vì sửa im lặng.** Bản phẳng nói lối thoát của `TYPE-6` "được viết
  vào config"; file rule làm ngược lại, đặt lối thoát **trong rule**, và nêu lý do. `INDEX.md` phát
  biểu mã ở dạng trung lập ("khai một lần, tại làn nó áp dụng") và bất đồng nằm nguyên trong
  `audit.md` dưới "Rủi ro còn mở".

- **Không có `prompt.md`.** Ánh xạ từ yêu cầu bằng lời sang mã và bảng phân định ranh giới nằm cùng
  chỗ với những ví dụ mà chúng phân định, trong `example.md`. Module có đúng năm record.

## Trước 2.00

Luật tồn tại dưới dạng một file phẳng, `be/canon/patterns/type-safety.md`: một phần định nghĩa, sáu
rule đánh số `TYPE-1`…`TYPE-6`, một bảng cấm và bốn ví dụ. Bản phẳng không có bảng tầng, không có
bảng neo, và không phân biệt giữa "luật này có lint canh" với "luật này chỉ có người đọc canh". Toàn
bộ nội dung của nó được mang sang bản `2.00`; những gì bản `2.00` thêm vào đều là diễn đạt hoặc bằng
chứng, không phải luật mới.
