---
id: fe-lints-served-locale-changelog
title: changelog.md
slug: /gates/lints/served-locale/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của mô-đun tài liệu hoá hai rule ngôn ngữ được phục vụ.
---

# changelog.md

> Phiên bản hiện tại: `2.00` · Mô-đun: `served-locale`

## Quy ước phiên bản

Một thay đổi được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Đổi số
chính (`x.00`) dành cho thay đổi cấu trúc mô-đun hoặc nhóm mà nó nằm trên.

Ba loại thay đổi bắt buộc phải tăng phiên bản:

1. Bộ rule trong nguồn thêm, bớt hoặc đổi tên một rule.
2. Một cơ chế phát hiện đổi — nút cú pháp khác, cổng miễn trừ khác, tập tên khác.
3. Một **cửa còn mở** mới được tìm ra, hoặc một cửa đang mở được đóng lại.

Loại thứ ba là loại hay bị bỏ qua nhất. Một cửa mở mới tìm ra không làm rule đổi một dòng nào, nhưng
nó đổi thứ mà một build xanh có quyền chứng minh — và đó mới là thứ mô-đun này tài liệu hoá.

## 2.00 — 2026-08-16

Lập mô-đun. Đây là mô-đun đầu tiên của nhóm này ghi lại **phần thực thi** thay vì phần luật: nhóm
`principles/` và `patterns/` nói cái gì đúng, còn nhóm này nói máy nhìn thấy được bao nhiêu phần
trong đó, và — phần không ai chịu viết ra — bao nhiêu phần thì không.

**Phạm vi.** Hai rule, do gói `@starci/eslint-canon-fe` xuất bản, giữ luật ngôn ngữ được phục vụ:

- `api-client-attaches-the-locale` — giữ `LOCALE-1`.
- `locale-header-belongs-to-the-link` — giữ `LOCALE-5`.

Luật có năm mã. Hai mã có rule; ba mã — `LOCALE-2`, `LOCALE-3`, `LOCALE-4` — **không có rule nào**,
vì cả ba nói về giá trị mà một mắt xích tính ra, còn hai rule chỉ nhìn thấy tên gọi. Ba mã đó nằm ở
phần rủi ro của `audit.md`, không nằm ở phần rule: một rule không chỉ tay vào được là một đề xuất.

**Danh tính là tên đã xuất bản.** Mỗi mục trong tài liệu lấy đúng tên rule làm tiêu đề, không gán
thêm mã số. Tên đó là thứ in ra trong log build, viết trong chú thích tắt rule, và nói ra trong mọi
cuộc trao đổi về lần đỏ đó; đặt thêm một định danh thứ hai là tạo ra một rule hai tên mà không ai
truy được thông báo đến từ đâu.

**Những chỗ còn lọt: mười bốn dòng, không dòng nào ghi "không có".** Sáu dòng thuộc rule chuỗi, tám dòng
thuộc rule header. `audit.md` xếp mười ba rủi ro và với mỗi rủi ro nói rõ rule phải nhìn thêm cái gì
mới đóng được, hoặc vì sao đóng đắt hơn để mở.

**Rủi ro được ghi nhận lớn nhất.** Xanh cả hai rule vẫn tương thích với việc không lời gọi nào khai
báo ngôn ngữ: rule thứ nhất kiểm một cái tên đã được gọi, rule thứ hai cấm một chuỗi ký tự ở nơi
khác, và không rule nào đòi mắt xích ngôn ngữ **có** viết header. Một rule thứ ba đảo chiều sẽ bịt
được, và rule đó chưa tồn tại.

**Hai lệch nhỏ trong nguồn được ghi thành phát hiện, không tự sửa.** Cổng miễn trừ của rule header
chỉ khớp đuôi TypeScript trong khi cổng nhận diện tệp kiểm thử ngay bên cạnh có thêm chữ `j`; và
rule header không dùng cổng nhận diện tệp kiểm thử đó, nên một câu khẳng định trong spec cũng bị báo.

**Ví dụ viết bằng mã thật.** `example.md` phân ba loại tách bạch: mã bị báo đúng, mã **lọt lưới**, và
mã bị **báo sai**. Mã lọt lưới luôn được dán nhãn là thứ rule bỏ sót, chứ không phải thứ luật cho
phép — đọc nhầm chỗ đó là biến một lỗ hổng thành một giấy phép.

**Không có `prompt.md`.** Mô-đun đúng năm tài liệu.
