---
id: fe-layouts-cot-dich-den-dung-canh-than-trang-vi
title: vi.md
slug: /fe/layouts/cot-dich-den-dung-canh-than-trang/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống SPINE-N, nhận diện bằng quyền truy cập và số mode chứ không bằng việc trang có sidebar hay không.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `cot-dich-den-dung-canh-than-trang`

# Cột đích đến đứng cạnh thân trang

Khi **một** quyền truy cập mở ra **nhiều** mode, danh sách những nơi có thể đi tới đứng thành một cột
**cạnh** thân trang. Đổi mode thì thân trang vẽ lại, cột đứng nguyên.

Câu hỏi mở đầu không phải "trang này có sidebar không", mà là:

> Mua một lần rồi thì có bao nhiêu nơi để đi, và người học có đổi qua lại giữa chúng không?

Một khoá học mở ra mười một mode learn chia ba nhóm. Một dự án cá nhân mở ra chuỗi milestone và task.
Đó là lý do cột tồn tại: không phải để trang trí mép trái, mà để người học đổi mode mà khung không
nháy.

Cột là **đồ đạc**, không phải nội dung. Nó nằm dưới băng, lấy đúng chiều cao băng chừa lại, và tự
cuộn trong chính nó — để một người đang ở giữa bài dài vẫn thấy mình đang ở đâu trong khoá.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `SPINE-1` | Cột phải còn đọc được khi thân trang cuộn | Ghim theo token của băng, chặn chiều cao, tự cuộn |
| `SPINE-2` | Dưới breakpoint thì không tới được mode nào nữa | Cột biến mất, thanh đáy dính ngón cái thay chỗ |
| `SPINE-3` | Route là một bài đánh giá đang diễn ra | Bỏ hẳn cột, và dùng chung predicate với người khác |
| `SPINE-4` | Cột có thể vắng mặt | Cột là contract riêng, nhắm bằng `data-node` |
| `SPINE-5` | Cột có chiều rộng | Chiều rộng thuộc frame sở hữu cột này, không lan sang frame khác |
| `SPINE-6` | Một route trong họ không mang nội dung riêng | Có thể redirect — nếu nó là **cửa vào**, không phải để làm route xanh |
| `SPINE-7` | Frame tuyên bố có cột nhưng không có slot cho cột | Không phải cột |

---

## `SPINE-1` — cột tự cuộn dưới băng

**Tình huống.** Danh sách mode dài hơn màn hình, mà thân trang còn dài hơn nữa.

**Kết quả.** Cột ghim ở `top-rail`, chặn cao bằng `max-h-rail`, và `overflow-y-auto` **trên chính
nó**.

**Hai token đi cùng nhau.** Đổi chỗ ghim mà không đổi chiều cao thì cột hoặc bị cắt trên đầu, hoặc
dài quá đáy và mục cuối không bao giờ với tới trong khi cột đang dính. Đây là ghi chú viết sẵn trong
`globals.css`, không phải suy đoán.

**Ranh giới.** Cột ngắn không bao giờ tràn thì khai `ownsScroll: false` cho thật, đừng mượn khuôn.

---

## `SPINE-2` — cột biến thành thanh đáy

**Tình huống.** Màn hình hẹp, không đủ chỗ cho cả cột lẫn thân.

**Kết quả.** Cột `hidden … md:flex` biến mất hẳn, và một thanh `sticky bottom-0 … md:hidden` xuất
hiện ở mép dưới, nơi ngón cái đã ở sẵn.

**Điều phải nói rõ.** Thanh đáy đó **là NAV của các đích ngang hàng**, không phải action bar. Hai thứ
này cùng một hình dáng: một cái chứa giá và nút mua, cái này chứa các nơi để đi. Không người đọc nào
phải đoán xem mình đang nhìn cái nào — và đó chính là việc mà một khoá hợp đồng riêng sinh ra để làm.

**Sai hay gặp.** Dùng route link làm tab mobile. Đã bị bác: tab mobile của legacy đổi giữa nội dung,
bài học và dàn ý **mà không đổi route**, nên nó là state cục bộ, không phải điều hướng.

---

## `SPINE-3` — bài đánh giá lấy cả màn hình

**Tình huống.** Người học đang thi, đang phỏng vấn thử, đang trong một phiên playground, đang review
flashcard. Đây là những route mà cả viewport thuộc về bài làm.

**Kết quả.** Bỏ hẳn cột.

**Ràng buộc quan trọng nhất của mã này.** Danh sách route đó **phải là một predicate dùng chung**.
Repo sống dùng đúng một hàm cho cả shell learn lẫn trợ lý AI, và lý do ghi ngay trong docstring của
nó: nếu mỗi bên tự nuôi danh sách route thì shell sẽ hiện nav trong khi AI ẩn, trên cùng một bài thi.

Đây là mã hiếm hoi mà **một dòng code là cả một luật**: hai chủ sở hữu khác nhau phải đồng ý về cùng
một sự thật, nên chỉ được có một chỗ nói ra sự thật đó.

---

## `SPINE-4` — cột được nhắm bằng danh tính

**Tình huống.** Cột là optional — có route có, có route không.

**Kết quả.** Bọc cột thành contract riêng và nhắm bằng `data-node`, không bằng `*:first-child`.

**Vì sao đây là luật chứ không phải sở thích.** Cột optional mà nhắm bằng vị trí thì khi cột vắng
mặt, con đầu tiên chính là **thân trang**, và thân trang ăn nguyên `w-72`. Cột không mất; thân trang
bị bóp.

Neo từ chối còn nói thêm một lý do độc lập: React Aria chèn sibling ẩn quanh ListBox, nên vị trí con
không phải là danh tính component. Hai lý do khác nhau, cùng một kết luận.

**Còn ba chỗ đang dùng positional trong repo sống** — xem [`audit.md`](./audit.md).

---

## `SPINE-5` — chiều rộng thuộc chủ sở hữu của chính vùng đó

**Tình huống.** Hai frame khác nhau đều có một cột trông giống nhau.

**Kết quả.** Mỗi frame giữ con số của mình. `main-then-rail` cho rail `w-80`; `content-reader-frame`
giữ hai rail `w-72`. Đó là hai chủ sở hữu, không phải một sự thiếu nhất quán.

**Neo là một lần sửa sai thật.** Founder yêu cầu nới rail của trang chi tiết khoá học từ `w-72` lên
`w-80`. Trong một patch trung gian, cái sibling `content-reader-frame` của **trang học** cũng bị nới
theo. Live proof phát hiện sai chủ sở hữu, và bản sửa là hoàn nguyên sibling về `w-72`, chỉ nới đúng
`main-then-rail`.

**Tự hỏi.** Founder vừa nói về vùng nào? Sửa đúng vùng đó, và kiểm xem bản sửa có bò sang trang khác
không.

---

## `SPINE-6` — route mang nội dung, và route làm cửa vào

**Đây là chỗ founder tự lật, nên phải đọc cả hai phán quyết.**

Phán quyết A bác việc tạo stub/redirect cho các route `/learn` còn thiếu, vì "stub làm route 'xanh'
nhưng sai product behavior và vi phạm parity".

Phán quyết B bác chính mặc định đang chạy và chọn `/learn` làm cửa vào `/learn/content`, vì "sửa
learn để follow legacy".

**Hai câu đó không mâu thuẫn.** Đọc riêng một câu thì ra luật sai.

**Tiêu chí phân loại:**

| Route này… | Thì | Phép thử |
|---|---|---|
| **Mang nội dung** — là một mode mà người đọc cần dừng lại và đọc | phải có page owner thật. Redirect ở đây là nói dối để route xanh | Bỏ route này đi thì có nội dung nào không còn tồn tại ở đâu khác không? |
| **Là cửa vào** — một địa chỉ tồn tại để link cũ, index trống hoặc thói quen legacy còn tới được | được redirect, và đích đến là quyết định sản phẩm | Đẩy người đọc đi tiếp ngay thì có gì trở nên không tới được không? |

**Không bên nào là mặc định.** A cấm dùng redirect để giả vờ có owner; B chốt rằng `/learn` là cửa
vào, và cửa đó mở sang đâu thì theo legacy chứ không theo cái tiện tay.

**Live: ba redirect, cả ba đều là cửa vào.** Trang gốc locale sang `/dashboard`, `learn` sang
`learn/content`, `learn/flashcards` sang `flashcards/review`. Không vi phạm.

**Cú lật có giá phải trả, và giá đó phải nằm trong kế hoạch.** Khi một route thôi mang nội dung, page
owner của nó và mọi nhánh từng kiểm tra nó trở thành code chết. Xem [`audit.md`](./audit.md).

---

## `SPINE-7` — tuyên bố có cột mà không có slot cho cột

**Tình huống.** Frame khai children là một run lặp cộng một body, rồi trông chờ run đó thành cột.

**Vì sao không thành.** `ContractContent` flatMap các slot `repeats` thành con **trực tiếp**, không
bọc. Nên trên md, `flex-row` xếp N link cạnh nhau **ngang hàng với body**, và `*:first-child:w-72`
chỉ nới **một** link, không phải một cột.

**Đối chứng ngay trong repo.** `learn-shell-frame` tránh đúng cái bẫy này bằng cách bọc cột thành
`learn-spine-column` và nhắm bằng `data-node`.

**Kết quả.** Muốn có cột thì thêm slot cho cột. Không thêm thì bỏ câu tuyên bố trong `why` đi — một
`why` hứa điều cấu trúc không đỡ nổi còn tệ hơn không có `why`.

---

## Luật

1. Cột là anh em của routed main, không bao giờ bọc nó.
2. Frame không mở `main`; route file mở.
3. Cột tự sở hữu scroll, chỗ ghim và trần chiều cao của nó.
4. Token ghim và token trần đi cùng nhau.
5. Cột optional thì nhắm bằng danh tính, không bằng vị trí.
6. Chiều rộng cột thuộc frame này; sửa ở đây không lan sang frame khác.
7. Hẹp lại thì cột được thay bằng một NAV các đích đến, không phải action bar.
8. Route mang nội dung có owner thật; cửa vào được redirect.
9. Frame tuyên bố có cột thì phải có slot cho cột.

## Ngoại lệ

- **`SPINE-3` bỏ hẳn cột**, và predicate phải dùng chung với mọi chủ sở hữu khác ẩn theo cùng danh
  sách route.
- **`SPINE-1` không áp cho cột ngắn.** Khai `ownsScroll: false` cho trung thực.
- **`SPINE-5` cho phép hai frame giữ hai con số khác nhau cho cùng một vai trò thị giác.** Hợp nhất
  chúng mà không có phán quyết chính là cách một bản sửa bò sang trang không ai hỏi tới.
- **Phán quyết B của `SPINE-6` chỉ nói về `/learn`.** Nó chốt cửa đó mở sang đâu; nó không cấp phép
  redirect mọi route ngại làm.
