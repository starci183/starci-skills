---
id: be-patterns-module-layering-changelog
title: changelog.md
slug: /be/patterns/module-layering/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật module layering.
---

# changelog.md

> Current version: `2.00` · Module: `module-layering`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Thêm, bớt hoặc đánh số lại một mã `LAYERING-<n>` là **thay đổi lớn**, không phải một bước tăng. Số mã
đang được trích dẫn từ luật anh em và từ task record cũ; đổi số là bẻ gãy một trích dẫn ai đó đã
viết ra rồi.

## 2.00 — 2026-08-16

Đổi số chính vì hình dạng của module đổi, không phải vì luật đổi.

- **Từ một file luật phẳng thành module năm record.** `be/canon/patterns/module-layering.md` được
  diễn đạt lại thành `be/patterns/module-layering/` với `INDEX.md`, `vi.md`, `example.md`,
  `audit.md`, `changelog.md`. File luật cũ **không bị xoá và không bị sửa**: đây là một lần diễn đạt
  lại cho đầy đủ hơn, không phải một luật mới.
- **Giữ nguyên năm mã.** `LAYERING-1` … `LAYERING-5` giữ nguyên số và nguyên nghĩa. Không mã nào bị
  gộp, tách, đánh số lại hay thêm vào. Mọi quyết định của luật phẳng được giữ: barrel bị từ chối,
  alias tự trỏ về mình bị từ chối, cạnh ngang nối ở composition root, cạnh **xuống** (lồng nhau và
  aggregator) được giữ, root độc quyền kiến thức toàn cảnh, bề mặt công khai là tập file chứ không
  phải một index.
- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ nó đang được giữ ở tầng nào: `unrepresentable`, `enforced`
  hay `documented`. Kết quả đo được là **hai `enforced`, ba `documented`, không có
  `unrepresentable`** — `LAYERING-1` giữ bởi `must-deep-module-import`, `LAYERING-2` giữ bởi
  `no-self-module-alias`, còn `LAYERING-3`, `LAYERING-4`, `LAYERING-5` chỉ có người đọc. Cột
  `unrepresentable` trống vì lý do cấu trúc: import specifier là một chuỗi ở vị trí mà type system
  phân giải chứ không ràng buộc, nên không union đóng nào viết ra được.
- **Thêm bảng `Anchor`.** Mỗi mã trỏ vào code thật có thể mở ra để đối chiếu, kèm câu "cần nhìn cái
  gì ở đó". Cả năm mã đều neo được; không mã nào ghi `chưa neo được`. Đường dẫn repository chỉ xuất
  hiện trong bảng này — vì một anchor bắt buộc phải là đường thật, đó chính là thứ làm nó thành
  anchor.
- **Nói thẳng vị thế của `LAYERING-3`.** Cây tham chiếu **có** giữ mã này bằng máy, nhưng bằng một
  rule viết tay trong repository, glob theo `src/modules/**/*.module.ts` và
  `src/features/**/*.module.ts`, với `apps/*/src/**` cố tình để ngoài. Bảng `Tầng giữ` vẫn ghi
  `documented`, vì tầng `enforced` được định nghĩa theo rule của canon và canon chưa publish rule
  này. Khoản nợ "port rule cạnh-ngang lên canon" được ghi vào `audit.md`.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới với
  mã kề, và danh sách tình huống nghiệp vụ hay gặp. Bẫy **category folder** — thư mục *chứa*
  capability chứ không *là* capability — được viết thành một mục riêng, vì đó là chỗ cả hai rule
  cùng đếm lệch một đoạn.
- **Viết `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt ĐÚNG cạnh SAI, kèm mục "ngoại lệ
  và nhầm lẫn". Thêm phần ánh xạ yêu cầu bằng lời sang một đường đi, bảng phân định ranh giới, và
  danh sách sai lầm lặp lại. Mọi ví dụ rút về TypeScript/NestJS tổng quát với capability đặt tên
  trung tính; không tên sản phẩm, không tên repository, không tên module riêng.
- **Ghi lại các lỗ enforcement đo được, thay vì làm tròn lên.** `audit.md` nêu tên đường dẫn cụ thể
  chứng minh: danh sách category folder của rule là danh sách cứng và thiếu ít nhất hai mục
  (`databases/`, và `lib/native/` là category lồng category), nên barrel dưới hai đường đó lọt qua cả
  `LAYERING-1` lẫn `LAYERING-2`; và barrel viết bằng đường tương đối thì hoàn toàn vô hình với rule.
- **Ghi lại một bất đồng thay vì sửa im lặng.** `LAYERING-1` và `LAYERING-5` là một sự thật nhìn từ
  hai đầu dây và có thể bị lập luận là nên gộp. Không gộp, không đánh số lại; lý do giữ tách nằm ở
  `INDEX.md`, và bất đồng nằm ở `audit.md`.
- **Không có `prompt.md`.** Module đúng năm record.

## Các phiên bản trước

Trước `2.00`, luật sống trong một file phẳng duy nhất tại `be/canon/patterns/module-layering.md`, với
mục `Definition`, `Rules`, `Forbidden` và `Examples`. File đó dựng đủ năm mã, phép thử "bê sang
repository khác còn đọc được không", bảng cấm kèm lý do từ chối, và ba cặp ví dụ ĐÚNG/SAI. Nó không
tuyên bố mã nào đang được giữ bằng máy và mã nào chỉ có người đọc — đó chính là khoảng trống mà `2.00`
lấp bằng hai bảng `Tầng giữ` và `Anchor`.
