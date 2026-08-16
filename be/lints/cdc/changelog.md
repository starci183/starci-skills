---
id: be-lints-cdc-changelog
title: changelog.md
slug: /be/lints/cdc/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của hồ sơ thi hành quy tắc lint CDC.
---

# changelog.md

> Current version: `2.00` · Mô-đun: `cdc`

## Version Policy

Một thay đổi được chấp nhận về **những gì tài liệu này ghi** thì tăng cả mô-đun thêm `0.01` và cập nhật
**năm** tài liệu cùng lúc. Nguồn công bố thêm hoặc bớt một quy tắc, đổi tên một quy tắc, đổi mức nghiêm
khắc, hoặc đóng một cửa còn mở — mỗi việc đó đều là một thay đổi như vậy.

Đổi số chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc thay đổi nhóm mà nó nằm trên.

**Danh tính của một quy tắc là tên nó công bố**, và tên đó không bao giờ được viết lại trong bất kỳ tài
liệu nào ở đây — kể cả khi nó chứa một từ gắn với sản phẩm. Đó là chuỗi in ra trong nhật ký dựng và
viết trong chú thích tắt quy tắc; một cái tên thứ hai nghĩa là một quy tắc hai tên và không cách nào
biết thông báo đến từ tên nào. Đổi tên một quy tắc trong nguồn là thay đổi phá vỡ tương thích và phải
được ghi ở đây kèm tên cũ.

## 2.00 — 2026-08-16

Mô-đun được **tạo mới** để ghi lại **việc thi hành**, không phải để chép lại luật. Luật CDC đã có chỗ
của nó; thứ chưa ai viết ra là **máy nhìn thấy được đến đâu, và hết thấy từ chỗ nào**.

- **Ghi đúng một quy tắc có thật.** Quy tắc ship trong gói `@starci/eslint-canon-be`, dưới không gian
  tên `starci-be`:

  | Quy tắc | Mã luật | Mức ship |
  |---|---|---|
  | `projection-listener-contract` | `CDC-1`, `CDC-2`, `CDC-3` | `error` |

  Nguồn công bố **một** quy tắc, đúng bằng con số mà hồ sơ này dự đoán, và quy tắc đó ánh xạ được vào ba
  mã luật có thật. Không phải bịa ánh xạ nào.

- **Ghi rõ một quy tắc gánh ba mã.** Ba `messageId` gánh ba phần khác nhau của luật: `base` và
  `lifecycle` giữ `CDC-1`, hai tên `groupId`/`topics` giữ `CDC-2`, hai tên `deriveTargets`/`recomputeTarget`
  giữ `CDC-3`. Điều này được ghi ở cả `INDEX.md`, `vi.md` và `audit.md`, vì một dòng nhật ký dựng chỉ in
  tên quy tắc — muốn ngược về đúng điều luật thì phải đọc thông báo.

- **Lấy tên công bố làm danh tính.** Không đặt thêm mã số cho quy tắc; tiêu đề mục trong cả ba tài liệu
  nội dung là tên quy tắc, chép nguyên văn.

- **Ghi bốn mã chưa có ai giữ.** `CDC-4`, `CDC-5`, `CDC-6` và `CDC-7` không có quy tắc nào, và quy tắc
  ở đây không nhận vơ chúng. `CDC-5` và `CDC-6` hiện được giữ bằng **kiến trúc** — khối xử lý và khối
  `catch` nằm trong lớp cơ sở — nên chúng phụ thuộc hoàn toàn vào việc phép kiểm `base` còn nói được.
  `CDC-4` và `CDC-7` là phán đoán về hành vi và về một lần chạy kiểm thử; cả hai được ghi trong
  `audit.md` như đề xuất, không phải như quy tắc.

- **Thêm bảng Cửa còn mở làm phần bắt buộc.** `INDEX.md` mang hai bảng: **Closed** (mười cách viết
  trông như lách được mà không lách được, kèm lý do) và **Open** (mười bốn cách viết quy tắc thật sự
  không bắt). Không có dòng nào ghi "không có".

  Ba cửa đắt nhất, tóm lại ở đây vì chúng đổi cách đọc cả mô-đun:

  1. **Quy tắc giữ cái tên, không giữ giá trị.** `groupId` sinh theo tiến trình và `topics` rỗng đều
     khai đủ tên và đi qua sạch — đúng hai hỏng hóc mà `CDC-2` sinh ra để cấm.
  2. **Thân hàm không bao giờ được thăm.** `recomputeTarget` cộng lượng chênh lệch (`CDC-4`) và
     `deriveTargets` phát lệnh nghiệp vụ (`CDC-3`) đều im lặng.
  3. **Cổng tên tệp là sự tồn tại của quy tắc.** Bỏ chữ `projection` khỏi tên tệp, đổi sang `.tsx` hay
     `.mts`, hoặc khai bộ lắng nghe trong một tệp gom, và quy tắc không còn tồn tại ở đó. Không ai đổi
     tên tệp để né lint; người ta đổi vì thấy gọn hơn.

- **Ghi một điểm mạnh mà các mô-đun anh em không có.** Hàm ánh xạ tên nhận **bất kỳ** nút thành viên nào
  có `key`, nên trường của lớp, trường mũi tên, getter, khoá dạng chuỗi và khai báo trừu tượng đều bị
  nhìn thấy như nhau. `onModuleInit = async () => {}` **không** trốn được — trong khi ở các mô-đun chỉ
  quét phương thức, đó chính là lỗ hổng phổ biến nhất.

- **Ghi bốn nguồn báo cáo sai thành một hạng mục riêng.** Lớp phụ đứng nhờ trong tệp bộ lắng nghe, tham
  số thuộc tính của hàm dựng, lớp cơ sở trung gian, và đổi tên khi nhập — ba trong bốn là cách viết hợp
  lệ và thông dụng. Hạng mục này ngang hàng với cửa còn mở vì trên một quy tắc ba-phép-kiểm dùng chung
  một cổng, một báo cáo sai mua một chú thích tắt quy tắc, và chú thích đó tắt **cả ba**.

- **Ghi mức ship thật, kèm khoảng trống bằng chứng.** Quy tắc ship ở `error`, và nguồn **không** kèm
  ghi chú đo nào — khác với các mô-đun anh em trên kệ này. Điều đó được ghi là nhận định trong
  `audit.md` chứ không được suy ra thành một con số.

- **`example.md` mang code lách qua được, dán nhãn rõ.** Bảy cặp **SAI**/**ĐÚNG** rồi tới mục **Cửa
  lách và nhầm lẫn** với mười hai khối. Code trong mục đó là code **vi phạm luật mà quy tắc không thấy**
  — không phải code được phép viết.

- **Không có `prompt.md`.** Mô-đun đúng năm tài liệu: `INDEX.md`, `vi.md`, `example.md`, `audit.md`,
  `changelog.md`.
