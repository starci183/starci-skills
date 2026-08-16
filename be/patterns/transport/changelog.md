---
id: be-patterns-transport-changelog
title: changelog.md
slug: /be/patterns/transport/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Transport.
---

# changelog.md

> Current version: `2.00` · Module: `transport`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Mã tình huống **không bao giờ được đánh số lại**. Mã được trích dẫn từ các file luật khác và từ task
record đã đóng; đổi số một mã là làm hỏng trong im lặng một trích dẫn đã có người viết ra. Mã bị bỏ
thì ghi là bị bỏ, và số của nó không được dùng lại.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: shelf và hình dạng module.

- **Chuyển shelf.** `be/canon/patterns/transport.md` (một file phẳng) → `be/patterns/transport/`
  (module năm record). `id` và `slug` đổi theo: `be-patterns-transport-<record>` và
  `/be/patterns/transport`.
- **Giữ nguyên ba mã.** `TRANSPORT-1`, `TRANSPORT-2`, `TRANSPORT-3` giữ nguyên số và nguyên nghĩa
  của bản phẳng. Không thêm mã, không bỏ mã, không đánh số lại. Module vào với ba mã và ra với ba mã.
- **Giữ nguyên mọi quyết định của bản phẳng.** Danh sách bốn ca vẫn **đóng**; bằng chứng vẫn phải đọc
  **từ file chứ không từ sổ đăng ký**; ngoại lệ probe vẫn đứng ngoài bốn ca; `TRANSPORT-3` vẫn chỉ
  ràng `src/modules/**` và vẫn miễn cho ứng dụng riêng dưới `apps/*`; cửa REST có lý do vẫn **không**
  phải hạng hai. Cái thay đổi là **cách trình bày và mức chứng minh**, không phải nội dung luật.
- **Thêm bảng `Tầng giữ`.** Mỗi mã nói rõ nó đang được giữ ở tầng nào: `unrepresentable` khi giá trị
  sai không viết được, `enforced` khi có một rule **gọi tên được** trong `sources/be/transport.mjs`
  bắt nó, `documented` khi không có gì cơ học giữ và chỉ người đọc giữ. Kết quả: `TRANSPORT-2`
  (`rest-door-needs-a-reason`) và `TRANSPORT-3` (`door-lives-in-features`) là `enforced`;
  `TRANSPORT-1` là `documented`. Dòng `documented` ấy được viết ra đúng như hiện trạng — khoảng trống
  ấy chính là **mục đích** của bảng, không phải một thất bại của nó. Kèm theo là lý do vì sao khoảng
  trống ấy không lấp được: vi phạm của `TRANSPORT-1` là một sự **vắng mặt**, và parser chỉ thấy được
  token đang tồn tại.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào một path thật và nói rõ phải nhìn cái gì ở đó. Luật không
  chỉ được vào code thật là đề xuất, không phải luật. Cả ba mã đều neo được; không mã nào phải ghi
  `chưa neo được`. Neo của `TRANSPORT-3` là một **sự vắng mặt đang giữ**: quét cây năng lực không ra
  một `@Controller` nào.
- **Tách ngoại lệ thành một tập đóng.** Liveness probe (`TRANSPORT-2`), ứng dụng riêng dưới `apps/*`
  (`TRANSPORT-3`), "cửa REST có lý do không phải hạng hai" (`TRANSPORT-1`), và chính sách nợ khi mới
  bật rule. Ba thứ đầu vốn nằm rải trong phần văn xuôi của bản phẳng và trong comment của file lint;
  nay chúng là một phần của luật, ở chỗ người đọc luật nhìn thấy.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, câu tự hỏi, ranh
  giới với các mã kề, và danh sách tình huống hay gặp. Bảng bốn ca của `TRANSPORT-2` được giữ nguyên
  ba cột của bản phẳng.
- **Viết `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt ĐÚNG cạnh SAI, kèm mục ngoại lệ
  và mục "trông giống nhưng không phải mã này". Thêm bảng ánh xạ yêu cầu sang một cửa, bảng phân định
  ranh giới, và danh sách sai lầm lặp lại nhiều nhất.
- **Rút mọi ví dụ về TypeScript trung tính.** Chỗ bản phẳng nêu tên một module riêng, ví dụ được viết
  lại bằng hình dáng mà backend nào cũng có: đơn hàng, hoá đơn, gói thuê bao, ảnh đại diện, cổng thanh
  toán. Path repository chỉ còn xuất hiện trong bảng Anchor, nơi chúng là bằng chứng chứ không phải
  minh hoạ.
- **Ghi bất đồng thay vì sửa lén.** Ba thứ được ghi vào `audit.md` mục "Rủi ro còn mở" thay vì được
  âm thầm sửa trong luật: nhánh đọc route của rule không hiểu dạng `@Controller({ path })` nên hai
  trong bốn nhánh nhận diện theo route hiện không bao giờ khớp; luồng redirect của trình duyệt trong
  một cuộc bắt tay OAuth không nằm trong bốn ca mà đang lọt qua nhánh byte nhờ một `@Res()` dùng cho
  việc khác; và hai rule tuy được canon công bố ở mức `error` nhưng chưa được nối vào cấu hình lint
  có hiệu lực của repository tham chiếu. Cả ba đều là finding chờ giải quyết, không phải quyền tự
  chọn cách nào tiện hơn.
- **Năm record, không có `prompt.md`.** Ánh xạ yêu cầu nay nằm cùng chỗ với ví dụ mà nó phân định.

## Các phiên bản trước

`1.xx` là file phẳng `be/canon/patterns/transport.md`: định nghĩa cửa, ba rule, bảng bốn ca của
`TRANSPORT-2`, và mục "luật này không nói gì". Toàn bộ quyết định của bản phẳng được giữ lại trong
`2.00`.
