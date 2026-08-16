---
id: fe-principles-ratio-changelog
title: changelog.md
slug: /fe/principles/ratio/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Tỷ lệ.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `ratio`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun ra đời ở số `2.00` chứ không phải `1.00`: nó sinh ra **trực tiếp trên nhóm `principles/`**,
theo đúng hình dạng năm-tài liệu mà nhóm này đã chốt, nên nó bắt nhịp với số phiên bản của nhóm thay
vì bắt đầu một dòng lịch sử riêng.

- **Nhận lấy một câu hỏi chưa có chủ.** Mô-đun trả lời: *hình dạng nào một khung nội dung đa phương tiện cam kết giữ, và
  chuyện gì xảy ra khi tệp thật không cùng hình dạng đó*. Trước đây câu hỏi này bị xử lý rải rác ở
  từng chỗ dựng giao diện, nên mỗi chỗ trả lời một kiểu và không chỗ nào sai theo cách có thể chỉ ra
  được.
- **Đứng trên nhóm `principles/`.** Cùng nhóm với các nguyên tắc dựng hình bắt buộc: đây là luật
  hình học của khung, không phải chuyện cảm nhận thị giác và cũng không phải chuyện ngoại lệ hay
  tính đồng nhất ở cấp quản trị.
- **Đặt mã tình huống.** Sáu mã `RATIO-<index>`: `RATIO-0` (nguồn đã tự khai kích thước), `RATIO-1`
  (vuông), `RATIO-2` (16:9), `RATIO-3` (4:3), `RATIO-4` (tỉ lệ do sản phẩm khai), `RATIO-5` (hình
  dạng của nguồn chính là nội dung).
- **Vì sao đánh số như vậy.** `0` dành cho tình huống **không phát ra class CSS nào**, đúng quy ước của
  nhóm: chỗ đã được giữ ở nơi khác, nên khung không khai gì. `1`, `2`, `3` là ba tỉ lệ **có tên sẵn**
  trong vốn từ giao diện, xếp theo thứ tự từ hẹp nhất về mục đích tới rộng nhất: vuông chỉ phục vụ
  việc khớp hàng xóm, 16:9 phục vụ nội dung động, 4:3 phục vụ ảnh chụp nói chung. `4` là chỗ sản phẩm
  **tự đặt tên** cho một tỉ lệ khi ba cái tên có sẵn không đủ — nên nó phải đứng sau tất cả những cái
  đã có tên, để việc chọn nó luôn là một quyết định phải giải thích. `5` đứng cuối vì nó là mã duy
  nhất **rút lại quyền cắt**; đọc từ trên xuống, thang này là thang giảm dần quyền sở hữu hình dạng
  của bố cục, và ở bậc cuối cùng quyền đó chuyển hẳn về nguồn.
- **Phân phối lại luật lệch tỉ lệ.** Ba nhánh — cắt, thêm dải trống, từ chối — không nằm chung một mã.
  **Cắt** thuộc về `RATIO-1`…`RATIO-4`, vì quyền cắt do việc bố cục sở hữu hình dạng cấp cho.
  **Thêm dải trống** và **từ chối** là nội dung của `RATIO-5`. Gộp cả ba vào một mã sẽ làm mỗi trường hợp rơi vào
  hai mã cùng lúc, và một tập mã không loại trừ thì không kiểm được ai sai. Lý do đầy đủ nằm ở
  `audit.md`, mục *Rủi ro còn mở*.
- **Đầu ra là một cặp.** Mỗi mã phát ra **một khung và một cách khớp**. Khai hình dạng mà không khai cách
  lấp là mới quyết định được một nửa những gì người đọc nhìn thấy — và nửa còn thiếu chính là nửa gây
  ra ảnh méo, thứ không bao giờ bị đọc là lỗi tỉ lệ.
- **Siết `RATIO-0` thành khẳng định có bằng chứng.** Mã này chỉ hợp lệ khi khung **không thể** nhảy.
  Bỏ trống tỉ lệ vì chưa nghĩ ra nên chọn gì không phải `RATIO-0`; nó là sự vắng mặt của quyết định,
  và mã tồn tại đúng để sự vắng mặt đó bị gọi tên và sửa được.
- **Viết `vi.md` theo từng mã.** Mỗi mã có tình huống nghiệp vụ, dấu hiệu nhận biết, một câu tự hỏi
  phân định, ranh giới với từng mã kề, và danh sách tình huống hay gặp.
- **Viết `example.md` cho đủ trường hợp.** Mỗi mã nhiều trường hợp, kèm mục ngoại lệ và mục "trông giống nhưng
  không phải mã này", cùng bốn ví dụ **mã lồng mã** để nói rõ rằng mã áp cho **một khung**, không áp
  cho cả cây.
- **Giữ mọi ví dụ ở `className` thuần.** Không thư viện thành phần, không khoá đăng ký, không tên sản
  phẩm. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của một sản phẩm
  mới đọc được là ví dụ đứng sai chỗ.

### Cố ý để lại cho mô-đun hàng xóm

- **Khoảng cách giữa khung và những gì đứng cạnh nó** thuộc về mô-đun quản trị khoảng cách giữa các phần tử giữa các phần tử cùng cấp.
  Mô-đun này không nói một dải ảnh thu nhỏ cách nhau bao nhiêu.
- **Bo góc, đổ bóng, viền và nền** là ngôn ngữ bề mặt. Mô-đun này chỉ đụng tới `overflow-hidden` và
  màu nền ở đúng chỗ chúng là **hệ quả bắt buộc** của một cú cắt hoặc một cú thêm dải trống, không phải ở
  tư cách trang trí.
- **Số cột, bề rộng khung, điểm ngắt** thuộc về luật lưới. Mô-đun này chỉ khẳng định rằng đổi cột và
  đổi bề rộng **không** đổi mã.
- **Văn bản thay thế, nhãn, thứ tự đọc** thuộc về luật tiếp cận. Mô-đun này để nguyên `alt` trong ví
  dụ mà không đặt luật cho nó.
- **Chất lượng ảnh, định dạng, kích thước tải, lazy-đang tải** là chuyện phân phối tài nguyên. Mô-đun
  này chỉ quan tâm tới một sự thật duy nhất về chúng: chỗ đã được giữ trước khi byte đầu tiên về hay
  chưa.
