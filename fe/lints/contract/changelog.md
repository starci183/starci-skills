---
id: fe-lints-contract-changelog
title: changelog.md
slug: /fe/lints/contract/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun thực thi hợp đồng nút.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `contract`

## Version Policy

Mô-đun này ghi lại **phần thực thi**, không ghi lại luật. Vì thế nó đổi phiên bản theo nhịp của mã
nguồn luật máy giữ, không theo nhịp của `patterns/contract.md`.

Tăng `0.01` và cập nhật **cả năm** tài liệu khi:

- thêm, bỏ, hoặc **đổi tên** một luật trong `rules` — danh tính của một luật là **tên công bố** của
  nó, nên đổi tên là một thay đổi phiên bản kể cả khi hành vi giữ nguyên;
- đổi cách phát hiện của một luật đang có (kiểu node, phép thử đường dẫn, biểu thức chính quy, tập
  tên);
- một cửa lách được **đóng lại**, hoặc một cửa lách mới được **phát hiện và ghi tên**.

Đổi số chính (`x.00`) dành cho việc chuyển nhóm hoặc đổi hình dạng mô-đun.

Một điều **không** làm mô-đun này đổi phiên bản: mức nghiêm khắc mà một kho tiêu thụ bật lên. Bản
`recommended` ở đây là **ý kiến của gói luật**; `eslint.config.mjs` của từng kho mới là bên quyết định
thứ thật sự được bật. Một kho đang gánh nợ hạ một luật xuống `warn` trong lúc trừ dần số lỗi, rồi kéo
lại `error` khi về không — điều không bao giờ đổi là: một luật ở mức `error` là **một bản dựng hỏng**,
không phải một cảnh báo để phân loại.

## 2.00 — 2026-08-16

Mô-đun được **lập mới** để ghi lại phần thực thi của luật hợp đồng nút. Trước phiên bản này, luật có
tài liệu (`patterns/contract.md`) còn phần máy giữ luật thì không có tài liệu nào — người đọc chỉ
biết một luật "đã được giữ" và không có chỗ nào nói **giữ tới đâu**.

**Gói phát hành.** Mười luật dưới đây ship trong `@starci/eslint-canon-fe`, dưới tiền tố `starci-fe/`.

**Mười luật được ghi lại.**

| Luật | Mã luật |
|---|---|
| `no-literal-structural-class` | `CONTRACT-1` |
| `no-class-composition-outside-contract` | `CONTRACT-2` |
| `only-the-frame-wears-a-node` | `CONTRACT-4` |
| `contract-why-is-a-reason` | `CONTRACT-6` |
| `no-structural-host-outside-contract-frame` | `CONTRACT-7` |
| `no-hand-written-contract-attrs` | `CONTRACT-8` |
| `no-duplicate-entry-shape` | `CONTRACT-9` |
| `no-unknown-contract-key` | *không mã nào* |
| `no-interaction-class-in-entry` | `CONTRACT-12` |
| `no-dead-contract-key` | `CONTRACT-13` |

Đếm được **đúng mười** luật trong `rules`, khớp với con số dự kiến khi mở việc.

**Những gì phiên bản này chốt.**

- **Danh tính một luật là TÊN công bố của nó.** Không mã số nào được bịa ra. Tên là chuỗi hiện trong
  log build, trong comment tắt luật và trong mọi cuộc trao đổi về lần hỏng đó; một định danh thứ hai
  sẽ tạo ra một luật hai tên và không cách nào biết thông điệp tới từ tên nào. Tiêu đề mỗi mục là tên
  luật, chép nguyên văn.
- **Tên luật không bị viết lại**, kể cả khi nó chứa một chữ thuộc về sản phẩm. Cấm nêu tên sản phẩm
  áp cho **văn xuôi và ví dụ**, không bao giờ áp cho một định danh đang ship.
- **Ánh xạ chín trên mười.** `no-unknown-contract-key` **không giữ mã nào**: nguồn xếp nó dưới
  `CONTRACT-9` nhưng phép kiểm nó làm là phép thuộc tập, còn luật thật sự giữ `CONTRACT-9` là
  `no-duplicate-entry-shape`. Ghi thành finding thay vì bịa một ánh xạ cho gọn bảng.
- **Nói rõ ba mã không có luật giữ, và vì sao.** `CONTRACT-3` và `CONTRACT-11` do union đóng và bản
  ghi khe kiểm bằng trình biên dịch giữ — thêm luật ở đó là canh một cánh cửa đã khoá. `CONTRACT-10`
  là một **miễn trừ** chứ không phải một luật. `CONTRACT-5` thì **không ai giữ**, và điều đó được
  chép ra thay vì bỏ qua.
- **Bảng "Cửa còn mở" là bắt buộc, và là lý do mô-đun này tồn tại.** Ghi tên **31 hàng cửa mở**, mỗi
  luật ít nhất một, không hàng nào ghi "không có". Cửa nặng nhất: cả mười luật **tắt** cho tệp ngoài
  `/src/`; toán tử ba ngôi lọt **cả hai** luật class; luật cấp bảng **không cắt biến thể** trong khi
  luật cấp nơi gọi thì có; và bốn trên năm dạng gọi tên khoá **không được kiểm** trong khi vẫn được
  đếm là tham chiếu sống.
- **Ghi lại chỗ hành vi thật khác với tên luật.** `contract-why-is-a-reason` trên thực tế là **một
  sàn độ dài** — thông điệp `restates` của nó gần như không bắn được. `only-the-frame-wears-a-node`
  cấm **một cái tên hàm**, không cấm hành vi.
- **Ghi lại chỗ hai luật cùng nhà mâu thuẫn nhau**: về `MemberExpression`, về việc cắt biến thể, về
  cách chốt phạm vi trong tệp bảng, và về việc gọi tên một khoá trông ra sao.
- **Không tài liệu hoá luật chưa tồn tại.** Một luật đáng lẽ nên có mà chưa có thì nằm ở
  `audit.md` phần "Rủi ro còn mở", không nằm ở đây như thể nó đang chạy. Luật cao nhất của canon: một
  luật không chỉ tay vào được là một **đề xuất**, không phải một luật.
- **Năm tài liệu, không có `prompt.md`.** Ánh xạ yêu cầu và bảng phân định ranh giới nằm chung với
  ví dụ mà chúng phân định.
