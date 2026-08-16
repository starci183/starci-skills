---
id: fe-layouts-archetypes-subject-and-evidence-vi
title: vi.md
slug: /fe/layouts/archetypes/subject-and-evidence/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống IDENT-N, nhận diện bằng việc trang nói VỀ AI chứ không bằng việc nó có sidebar trái.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `subject-and-evidence`

# Khung danh tính bao quanh bằng chứng

Khi một trang nói **về một chủ thể**, và thân trang đổi qua lại giữa các mặt bằng chứng **về chính
chủ thể đó**, thì chủ thể giữ một cột đứng yên và bằng chứng giữ vùng chính.

Câu hỏi mở đầu:

> Trang này nói về ai, và người đọc có bao giờ được phép quên điều đó không?

Nếu người đọc lướt từ overview sang projects sang cv mà không còn thấy mình đang xem hồ sơ của ai,
trang đã hỏng — dù mọi khối trong đó đều đúng.

**Cột bên ở đây KHÔNG phải điều hướng.** Nó là **người**. Đây là điểm phân biệt duy nhất với
[cột đích đến](../destination-column/INDEX.md): cột kia chứa nơi để đi, cột này chứa
một danh tính.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `IDENT-1` | Một chủ thể, nhiều mặt bằng chứng | Cột danh tính đứng yên cạnh vùng bằng chứng co giãn |
| `IDENT-2` | Hai bên không còn ngồi cạnh nhau được | Cột **nhảy lên trên**, đo bằng container query của chính vùng |
| `IDENT-3` | Một dữ kiện có thể đặt ở hai chỗ | Nó thuộc đúng một vùng |
| `IDENT-4` | Mỗi mặt bằng chứng có địa chỉ riêng | Tab ở đây **là route thật**, và nó push |
| `IDENT-5` | Không hiển thị được chủ thể | Mỗi trạng thái một nhánh, và khai rõ giữ lại bao nhiêu chrome |
| `IDENT-6` | Cần measure, inset, container rồi mới chia đôi | Bốn lớp bọc, mỗi lớp đúng một quyết định |

---

## `IDENT-1` — cột danh tính cạnh vùng bằng chứng

**Tình huống.** Hồ sơ công khai: hero danh tính đứng yên trong khi vùng chính đổi giữa tổng quan, dự
án, thử thách, kỹ năng, CV, hoạt động.

**Kết quả.** Cột giữ một bề rộng đọc ổn định; vùng chính co giãn.

**Vì sao không phải hai cột card.** `why` trong registry nói thẳng: danh tính giữ bề rộng đọc ổn định
**cạnh** bằng chứng co giãn, để ngữ cảnh không bao giờ mất và cũng không bị bóp vào một cột card thứ
hai.

---

## `IDENT-2` — hẹp lại thì cột nhảy lên trên

**Tình huống.** Không đủ chỗ cho cả cột lẫn vùng bằng chứng.

**Kết quả.** Cột **không biến mất** và **không thu thành dải icon**. Nó nhảy lên trên vùng chính.

**Đo bằng gì.** Bằng container query của **chính vùng đó**, không bằng viewport.

**Vì sao khác biệt này quan trọng.** Câu hỏi thật là "vùng này có đủ chỗ không", không phải "màn hình
rộng bao nhiêu". Cùng một trang đặt trong một shell hẹp hơn phải gập giống hệt như chính nó trong một
cửa sổ hẹp. Đo bằng viewport là trả lời một câu hỏi khác rồi hy vọng hai câu trùng nhau.

---

## `IDENT-3` — mỗi dữ kiện thuộc đúng một vùng

**Tình huống.** Một dữ kiện có thể đặt ở cột, ở danh sách, hoặc ở panel — và cả ba đều "hợp lý".

**Kết quả.** Chọn một, và chỉ một. Danh sách giữ **danh tính**; panel giữ **mô tả**.

**Neo là một chuỗi ba phán quyết liên tiếp trên cùng một màn hình:** không render brief trong danh
sách giữa mà phải có details ở bên phải; panel phải gọi API detail chứ không mượn snippet của
autocomplete; và click thì fetch/render detail, còn mở route là việc của CTA.

Ba phán quyết, một luật: **một vùng không mượn việc của vùng khác.**

**Ngoại lệ đã đóng.** Cùng một GIÁ TRỊ được phép xuất hiện ở hai vùng khi hai vùng trả lời hai câu
hỏi khác nhau — một con số trong nhãn tab và cũng con số đó trong tiêu đề là một dữ kiện phục vụ hai
mục đích. Cái bị cấm là vùng này gánh việc của vùng kia.

---

## `IDENT-4` — ở đây tab LÀ route

**Tình huống.** Mỗi mặt bằng chứng có một địa chỉ riêng, chia sẻ được, mở tab mới được.

**Kết quả.** Tab strip chạy hết ngang và gọi `router.push`.

**Đây là ngoại lệ duy nhất của luật "tab đổi panel, route đổi trang".** Nó không phải mâu thuẫn: ở
đây mỗi mặt **thật sự là một trang**, nên điều khiển đổi mặt thật sự là điều hướng.

**Không kéo theo.** Tab vẫn không viết lại breadcrumb. Breadcrumb giữ tổ tiên route; tab điều hướng
trong tập mặt.

---

## `IDENT-5` — trạng thái thay cả màn, và mỗi trạng thái khai giữ bao nhiêu chrome

**Tình huống.** Không lấy được chủ thể, hoặc chủ thể tồn tại nhưng bị khoá.

**Đây là archetype duy nhất tự sở hữu trạng thái toàn màn hình.** Các archetype khác đổi nội dung
trong khung; cái này thay cả khung.

| Trạng thái | Nhánh | Chrome còn lại | Đọc ra sao |
|---|---|---|---|
| `ready` | có | tab strip + cột + vùng chính | khung bình thường |
| `locked` | có | cột, bỏ tab strip | chủ thể có thật và nhận diện được, nhưng các mặt không được mở |
| `not-found` | có | không còn gì, một notice ở giữa | không có chủ thể nên không có gì để nhận diện |
| `failed` | có | không còn gì, một notice ở giữa | chủ thể có thể có thật, ta không lấy được |
| `loading` | **THIẾU trong nguồn sống** | rơi xuống cây `ready` | vẽ tab và cột lên dữ liệu chưa tới |

**Vì sao `locked` giữ cột mà bỏ tab strip.** Giữ cột vì người đó có thật. Bỏ tab strip vì một control
trỏ vào nội dung không mở được là một control nói dối.

**Vì sao `loading` thiếu nhánh là lỗi chứ không phải "xuống cấp mềm".** Nhánh vắng mặt không làm nó
biến mất — nó vẽ cây của trạng thái khác với dữ liệu chưa có. Nửa connected vẫn tính ra `loading`
thật, nên trạng thái đó xảy ra thật.

---

## `IDENT-6` — bốn lớp bọc, mỗi lớp một quyết định

**Tình huống.** Chỉ để đặt đúng một cặp cột/vùng chính mà cần tới bốn lớp.

| Lớp | Quyết định duy nhất của nó |
|---|---|
| measure | Chặn bề rộng đọc |
| inset | Đệm **bên trong** cái chặn đó |
| container | Lập container query cho vùng |
| split | Xếp cột và vùng chính |

**Không được gộp.** Gộp inset vào measure là đẩy padding ra ngoài cái chặn, và container query sau đó
quan sát nhầm bề rộng. Bốn lớp trông thừa cho tới lúc gộp thử.

**Và không nhắm bằng vị trí.** Đã có neo từ chối: vendor chèn sibling ẩn, nên con thứ mấy không phải
danh tính component.

---

## Luật

1. Cột giữ chủ thể, không bao giờ là cột điều hướng.
2. Mỗi dữ kiện thuộc đúng một vùng.
3. Hẹp lại thì cột nhảy lên trên, không biến mất.
4. Gập được đo bằng container query của chính vùng.
5. Mọi thành viên của union trạng thái đều có nhánh riêng.
6. Mỗi trạng thái khai rõ giữ lại chrome nào.
7. Tab strip chạy hết ngang vì nó đổi vùng nội dung.
8. Tab là route thật thì push, và breadcrumb vẫn giữ tổ tiên route.
9. Bốn lớp bọc, mỗi lớp đúng một quyết định.

## Ngoại lệ

- **`IDENT-4` là chỗ duy nhất tab chính là điều hướng.**
- **`IDENT-5` `locked` giữ cột, bỏ tab strip.**
- **`IDENT-6` không được làm phẳng.**
- **`IDENT-3` cho phép cùng một giá trị ở hai vùng** khi hai vùng trả lời hai câu hỏi khác nhau; cấm
  vùng này gánh việc của vùng kia.
