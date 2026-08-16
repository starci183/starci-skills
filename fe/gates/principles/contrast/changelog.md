---
id: fe-principles-contrast-changelog
title: changelog.md
slug: /gates/principles/contrast/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật Độ tương phản.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `contrast`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

## 2.00 — 2026-08-16

Mô-đun được tạo mới, mở thẳng ở `2.00` để đứng cùng phiên bản với các mô-đun khác trên cùng nhóm: nó
sinh ra đã mang hình dạng năm tài liệu, đã có mã tình huống, và không có lịch sử nào trước đó để kể.

- **Câu hỏi mà mô-đun này nhận về.** *Một cặp đang nằm cạnh nhau phải đạt tối thiểu bao nhiêu, theo
  vai trò của nửa trên?* Trước khi có mô-đun này, câu hỏi đó không có chủ: luật màu chọn biến thiết kế cho
  từng nút DOM theo **ý nghĩa**, và nó không bao giờ nhìn hai nút DOM cùng lúc. Một dòng chữ phụ màu mờ là
  đúng; một khung lồng màu mờ là đúng; **cặp** mà hai quyết định đúng đó tạo ra thì không ai đo và
  không ai chịu trách nhiệm. Mô-đun này lấy chỗ trống đó làm phạm vi của mình.
- **Nhóm.** Đứng ở `principles/`, cùng chỗ với các nguyên tắc dựng hình bắt buộc, chứ không ở
  `senses/`. Lý do: kết quả của nó là một **ngưỡng đo được**, không phải một cảm nhận. Ai cũng đo ra
  cùng một con số cho cùng một cặp, và một luật như vậy thuộc về nơi các luật có thể bị kiểm.
- **Đơn vị được quản là CẶP, không phải nút DOM.** Đây là quyết định nền của mô-đun. Nó kéo theo: một
  nút DOM có cả nền lẫn chữ sinh ra **hai** mã; một thẻ thường sinh ra bốn; và câu "thành phần này đạt
  chuẩn rồi" không còn là một câu có nghĩa.
- **Nền phải là nền đã KHAI BÁO.** Nền là tổ tiên gần nhất có khai báo màu nền. Không ai khai báo
  thì cặp chưa tồn tại. Điều khoản này biến "chưa đo" từ một phán đoán chủ quan thành một sự thật đọc
  được bằng cách lần theo chuỗi cha.
- **Cách đánh số.** `CONTRAST-1`, `CONTRAST-2`, `CONTRAST-3` là ba nghĩa vụ tỉ lệ, xếp theo phần màn
  hình mà chúng chi phối: chữ thường, chữ lớn, rồi mọi thứ không phải chữ. `CONTRAST-4` và
  `CONTRAST-5` đứng sau vì chúng là nghĩa vụ mà một tỉ lệ nội dung thường không diễn đạt được — một
  cái chỉ tồn tại trong lúc bàn phím đi qua, một cái **không phải tỉ lệ nào cả**. `CONTRAST-6` và
  `CONTRAST-7` đứng cuối vì chúng là hai tình huống trong đó cặp **không đo được như đang viết**: một
  vì nửa dưới chỉ biết lúc chạy, một vì chuẩn tạm treo nghĩa vụ. `CONTRAST-0` mang số `0` theo đúng
  quy ước của nhóm: mã không phát ra gì.
- **Chỉ số là thứ tự nghĩa vụ, không phải thang.** Không có `CONTRAST-2.5`, và `CONTRAST-7` không
  "nặng" hơn `CONTRAST-3`. Mô-đun này không có thang class CSS dạng số, nên các con số hoàn toàn là **tên
  gọi**.
- **Hai mã không phát ra tỉ lệ nào vẫn là mã.** `CONTRAST-0` miễn theo **bản chất** của vật;
  `CONTRAST-7` miễn theo **trạng thái** và hết hiệu lực ngay khi thành phần điều khiển sống lại. Nếu không đặt tên
  cho hai tình huống này, mọi tranh luận về một đường kẻ hay một nút mờ đều kết thúc bằng "cái đó
  không tính", mà không có gì để đối chiếu.
- **Thêm hai mã so với tập gợi ý ban đầu.** Tập gợi ý có sáu mã `CONTRAST-0` … `CONTRAST-5`; cả sáu
  được giữ nguyên số. Thêm `CONTRAST-6` để tập mã **tổng** được với chữ đặt trên nền chỉ biết lúc
  chạy, và thêm `CONTRAST-7` để miễn trừ theo trạng thái không bị nhét vào miễn trừ theo bản chất. Lý
  do đầy đủ của cả hai nằm ở mục "Rủi ro còn mở" trong `audit.md`.
- **Hai mã cùng khớp thì lấy mã chặt hơn.** Đây là chỗ mô-đun này đi ngược mặc định của một mô-đun
  chọn bậc: ở đây hướng an toàn đi **lên**, vì hạ nhầm một nghĩa vụ tạo ra một màn hình không đọc
  được, còn nâng nhầm chỉ tạo ra một màn hình đậm hơn cần thiết.
- **Sàn là AA.** Mọi đòi hỏi cao hơn là một thay đổi luật ghi ở đây, không phải một cách đọc chặt hơn
  của cùng luật.
- **Mọi ví dụ là `className` thuần.** Không thư viện thành phần, không hệ thống thiết kế riêng, không
  khoá đăng ký. Một luật ở nhóm này phải đúng với bất kỳ giao diện nào; ví dụ cần tên riêng của một
  sản phẩm mới đọc được là ví dụ đứng sai chỗ.

### Cố ý để lại cho các mô-đun lân cận

- **Biến thiết kế nào mang nghĩa gì** thuộc về luật màu. Mô-đun này không chọn `text-muted-foreground` thay
  cho `text-foreground`; nó chỉ nói cặp mà lựa chọn ấy tạo ra phải đạt bao nhiêu, và từ chối cặp
  không đạt.
- **Giá trị thật của biến thiết kế ở từng chủ đề** thuộc về chủ đề. Mô-đun này nêu ngưỡng và nêu rằng cả hai
  chủ đề phải đạt; nó không đặt giá trị nào.
- **Cỡ và độ đậm của chữ** thuộc về luật kiểu chữ. Mô-đun này chỉ đọc kết quả đã tính ra px để chia
  `CONTRAST-1` với `CONTRAST-2`, và nói rõ rằng phóng to chữ để đổi lấy tỉ lệ dễ hơn là một quyết
  định kiểu chữ, không phải một lối thoát của độ tương phản.
- **Khoảng cách và ranh giới bằng khoảng trống** thuộc về luật khoảng cách. Mô-đun này chỉ mượn kết quả của
  nó ở một chỗ: một đường phân cách chỉ nhắc lại ranh giới mà khoảng cách đã nói là `CONTRAST-0`.
- **Thứ bậc của bề mặt lồng nhau** thuộc về luật bề mặt. Mô-đun này chỉ đòi rằng mỗi lần đổi nền là
  một cặp mới phải đo.
- **Thứ tự thẻ tab và ngữ nghĩa của trạng thái tiêu điểm** thuộc về luật tương tác. Mô-đun này chỉ quản phần
  **nhìn thấy được** của chỉ báo tiêu điểm.
