---
id: fe-patterns-naming-changelog
title: changelog.md
slug: /fe/patterns/naming/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Naming.
---

# changelog.md

> Current version: `2.00` · Module: `naming`

## Version Policy

Một thay đổi luật được chấp nhận thì tăng cả module thêm `0.01` và cập nhật **năm** record. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc module hoặc shelf mà nó nằm trên.

Ba mã `NAMING-1`, `NAMING-2`, `NAMING-3` được trích dẫn từ các file luật khác và từ các bản ghi task
đã đóng. Một số hiệu, khi đã phát ra, **không bao giờ** được đánh lại số hay dùng lại cho nghĩa khác:
đổi một mã là làm gãy một trích dẫn ai đó đã viết và không còn ở đây để sửa. Việc **không** phát thêm
mã cũng nằm trong cùng chính sách này — một số hiệu mới là một lời hứa mới.

## 2.00 — 2026-08-16

Đổi số chính vì hai thứ đổi cùng lúc: shelf và hình dạng module.

- **Chuyển từ một file luật phẳng sang module năm record.** `fe/canon/patterns/naming.md` →
  `fe/patterns/naming/`. File phẳng cũ **không bị xoá và không bị sửa**; nó vẫn là nguồn nội dung mà
  bản này diễn đạt lại đầy đủ hơn. Không luật mới nào được phát minh ở đây.
- **Giữ nguyên ba mã.** `NAMING-1`, `NAMING-2`, `NAMING-3`, nguyên số, nguyên nghĩa, nguyên cả ngoại
  lệ "khai báo lồng không phải mức module" và nguyên cả lập luận hai phần của phép kiểm đường dẫn.
  Module có ba mã và kết thúc với ba mã.
- **Không phát mã thứ tư.** Bảng Forbidden của bản phẳng có một dòng — *một cái tên nói **nơi** nó
  được dùng* — mà chính bản phẳng đã giao cho **từng layer** trả lời. Dòng đó được giữ nguyên nghĩa và
  được nói rõ là chỗ module này dừng lại, thay vì được gán một số hiệu ở đây rồi bị trích dẫn ở đây
  trong khi câu trả lời nằm nơi khác.
- **Thêm bảng `Tầng giữ`.** Mỗi mã ghi rõ thứ **thật sự** giữ nó: `unrepresentable`, `enforced` kèm
  **tên rule**, hay `documented`. Cả ba mã đều `enforced` và đều gọi được tên rule
  (`starci-fe/prefer-arrow-export`, `starci-fe/handler-on-prefix`,
  `starci-fe/no-second-language-in-path`); không mã nào ở `documented`. Nhưng không mã nào được giữ
  **trọn**, và phần không với tới được ghi ngay trong bảng chứ không làm tròn lên.
- **Thêm bảng `Anchor`.** Sáu anchor cho ba mã, mỗi anchor kèm thứ cần tìm ở đó: `sources/fe/naming.mjs`
  và twin test của nó. Cả ba mã đều neo được, không mã nào phải ghi `chưa neo được`. Anchor mạnh nhất
  là chính file rule — nó tuân thủ `NAMING-1` mà nó phát ra, nên tính chất ấy **đọc thấy** chứ không
  phải được khẳng định.
- **Không chép hai anchor sản phẩm của bản phẳng.** Bản phẳng trỏ vào hai file trong một repository
  frontend cụ thể. Shelf này không gọi tên repository nào, và một đường dẫn repository này không mở
  được thì người đọc không kiểm được. Mất mát này được ghi ở [`audit.md`](./audit.md) chứ không được
  thay bằng một đường dẫn không ai xác minh nổi.
- **Viết lại `vi.md` theo từng mã.** Mỗi mã có tình huống, dấu hiệu nhận biết, câu tự hỏi, ranh giới
  với mã kề, và danh sách tình huống nghiệp vụ hay gặp. Lý do hoisting, lý do `on` sống sót qua ranh
  giới, và lý do phép kiểm đường dẫn phải có hai phần đều được giữ nguyên vẹn.
- **Viết lại `example.md` cho đủ case.** Mỗi mã nhiều case, mỗi case đặt SAI và ĐÚNG cạnh nhau, kèm
  mục ngoại lệ và nhầm lẫn. Thêm phần ánh xạ yêu cầu, bảng phân định ranh giới và danh sách sai lầm
  lặp lại. Ba cặp ví dụ của bản phẳng — một dáng khai báo, bẫy đổi tên ở ranh giới, và handler không
  phải handler — được giữ lại nguyên lập luận.
- **Không có `prompt.md`.** Ánh xạ yêu cầu nằm cùng chỗ với ví dụ mà nó phân định. Module có đúng năm
  record.
- **Rút mọi ví dụ về TSX thường.** Bản phẳng neo vào tên của hai component riêng. Ở đây, chỗ nào luật
  chạm tới một component riêng thì gọi **vai trò** của nó — *leaf giữ state*, *slot nhận handler* — vì
  một luật ở shelf này phải đúng với bất kỳ front end nào.
- **Ghi lại bốn chênh lệch giữa luật và rule, không sửa cái nào.** `const X = function () {}` và
  `export default () => {}` đi qua `NAMING-1`; `handleX` trong object literal và trong tham số
  destructure đi qua `NAMING-2`; rule chỉ **cấm** `handle` chứ không **đòi** `on`; và `ROMANISED` là
  một danh sách hai mươi đoạn nên một đoạn ngoài danh sách đi qua `NAMING-3`. Cả bốn nằm ở "Rủi ro còn
  mở" — bất đồng không bao giờ đi vào một lần sửa lặng lẽ.

## Các phiên bản trước

Bản phẳng `fe/canon/patterns/naming.md` dựng định nghĩa "nửa cơ học của việc đặt tên", ba mã, lập luận
hoisting, lập luận `on` sống sót qua ranh giới, lập luận đường dẫn là địa chỉ chứ không phải nội dung,
bảng Forbidden sáu dòng và ba cặp ví dụ. Toàn bộ nội dung đó được giữ lại trong module này; phần thêm
vào là tầng giữ, anchor, phân định theo từng mã và audit.
