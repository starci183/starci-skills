---
id: fe-layouts-archetypes-invisible-owner-vi
title: vi.md
slug: /fe/layouts/archetypes/invisible-owner/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống KEEPER-N, nhận diện bằng thứ phải sống sót qua điều hướng chứ không bằng thứ vẽ ra màn hình.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `invisible-owner`

# Người giữ phiên vô hình

Có những layout **không vẽ khung gì cả**. Chúng tồn tại để **một thứ sống sót qua điều hướng** — một
socket, một phiên trên server, một hội thoại đang mở — và để khi thứ đó hỏng thì cái notice **thay
chỗ** mặt trang chứ không dán thêm vào nó.

Câu hỏi mở đầu không phải "trang này trông thế nào", mà là:

> Người dùng đi sang trang khác thì **cái gì không được chết**?

Nếu câu trả lời là "không có gì", đây không phải archetype này.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Kết quả |
|---|---|---|
| `KEEPER-1` | Có thứ phải sống qua ranh giới cụm route | Mount ở gốc locale, qua đúng một shell chuyển đổi |
| `KEEPER-2` | Người giữ có bạn đồng hành nhìn thấy được | Slot optional ngang hàng với mặt trang, không chia đôi nó |
| `KEEPER-3` | Một trục thường trực có thể bị biến thành mặt của trang | Không biến; hai trục ở riêng |
| `KEEPER-4` | Một kết nối hoặc một phiên phải sống lâu hơn route | State nằm trong hook của layout, đi xuống bằng context |
| `KEEPER-5` | Một phần của state **đúng là** phụ thuộc route | Khai reset tường minh, khoá theo đúng thứ làm nó đổi |
| `KEEPER-6` | Người giữ không được tồn tại trên vài route | Một predicate dùng chung cho mọi chủ sở hữu cùng ẩn |
| `KEEPER-7` | Thứ nó giữ không tải được | Notice **thay** mặt trang, hai cái loại trừ nhau |

---

## `KEEPER-1` — độ cao mount chính là phạm vi sống sót

**Tình huống.** Phải quyết mount người giữ ở đâu.

**Ba ứng viên, hai bị bác bằng phán quyết thật:**

| Chỗ mount | Kết quả | Vì sao |
|---|---|---|
| Cây provider | **bị bác** | Provider sở hữu context, không sở hữu bố cục thị giác |
| Chrome của cụm route | **bị bác** | Nó lặp theo cụm route, nên hội thoại sẽ chết khi đi qua ranh giới cụm |
| Gốc locale | **chọn** | Một lần mount trên mọi cụm, qua đúng shell đã có |

**Điểm cần hiểu.** Đây không phải chuyện gọn gàng. Chỗ mount **chính là** lời tuyên bố thứ đó sống
bao lâu. Mount thấp hơn phạm vi cần sống thì nó chết sớm; mount vào cây provider thì nó thành chủ sở
hữu thị giác ở nơi không sở hữu thị giác.

**Người giữ phạm vi một cụm thì mount ở cụm đó.** Socket của một slug playground không có lý do gì
sống lâu hơn slug đó, nên nó mount ở layout của slug.

---

## `KEEPER-2` — bạn đồng hành là hành tinh rời, không phải vùng chia đôi

**Tình huống.** Người giữ có nút nổi, có prompt khi bôi đen, có ngăn kéo.

**Kết quả.** Cả ba là slot **optional ngang hàng** với mặt trang. Không cái nào chia đôi mặt trang,
không cái nào giữ chỗ trong nó, không cái nào xuất hiện trong thứ tự đọc như một cột.

**Phép thử.** Mặt trang có phải nhường chỗ không? Không nhường → hành tinh. Nhường → đó là một vùng,
và lúc đó archetype đã khác.

**Nổi bật không phải tiêu chí.** Một FAB rất nổi vẫn là hành tinh.

---

## `KEEPER-3` — trục thường trực không phải mặt của trang

**Tình huống.** Trang đã có các mặt nội dung: bài đọc, source code, thử thách. Cám dỗ là thêm một mặt
nữa tên "AI".

**Kết quả.** Không. Trợ lý toàn cục và mặt nội dung trang là **hai trục khác nhau**. Biến trục này
thành tab của trục kia thì gãy cả hai: trợ lý mất tính thường trực, còn tập mặt của trang mất tính
đóng.

**Live.** Trigger là FAB nổi cộng drawer; cả hai là slot ngang hàng với `surface`. Trục AI **đọc**
route qua một hàm phân giải, chứ không **chiếm chỗ** của route.

**Kèm theo một phán quyết về sự trung thực.** Luồng global cố tình không neo vào trang nào, nên không
được hứa nó hiểu trang hiện tại. Trục riêng thì phải nói thật về việc nó biết gì.

---

## `KEEPER-4` — cái đứng yên là DỮ LIỆU

**Tình huống.** Chuyển từ màn setup sang màn session, hoặc đi từ bài học này sang bài học khác.

**Kết quả.** Không có pixel nào phải đứng yên. Cái đứng yên là socket, là phiên, là hội thoại — nằm
trong hook của layout và đi xuống bằng context.

**Đây là điểm mà archetype này khác hẳn ba cái kia.** Ở những chỗ khác, "đứng yên" nghĩa là một cột
không vẽ lại. Ở đây `playground-session-frame` là `flex min-h-screen w-full min-w-0 flex-col` và hết
— không có chrome nào để mà đứng yên.

**Khai sai hay gặp.** Ghi `persistence: dung-yen-pixel` cho vùng của người giữ. Đó là đọc nhầm
archetype.

---

## `KEEPER-5` — reset hẹp, và khai tường minh

**Tình huống.** Một phần của state **đúng là** phụ thuộc route.

**Kết quả.** Khai đúng phần đó, khoá theo đúng thứ làm nó đổi.

**Live.** Đúng một thứ tự reset theo điều hướng: ngữ cảnh code, khoá theo đường dẫn neo. Hội thoại,
trạng thái mở, và bộ đếm tangent **cố ý không** reset.

**Vì sao phải hẹp.** "Đổi route thì reset hết" xoá đúng lý do người giữ tồn tại.

---

## `KEEPER-6` — một predicate, hai chủ sở hữu

**Tình huống.** Người giữ không được tồn tại trên vài route: trang đăng nhập, và các route đánh giá
trực tiếp.

**Kết quả.** Danh sách đó là **một hàm dùng chung**, không phải hai danh sách giống nhau.

**Vì sao.** Nếu mỗi bên tự nuôi danh sách, shell sẽ hiện nav trong khi trợ lý ẩn — trên cùng một bài
thi. Lỗi đó chỉ lộ ra với người đang thi thật, tức là chỗ tệ nhất để phát hiện một danh sách đã lệch.

**Ẩn vì hai lý do cùng lúc.** Predicate sống ẩn trên `/authentication` **và** trên bốn dạng route
đánh giá trực tiếp. Trang kết quả cố ý không nằm trong đó, vì tương tác trực tiếp đã kết thúc ở đấy.

---

## `KEEPER-7` — notice thay mặt trang

**Tình huống.** Thứ người giữ đang giữ không tải được.

**Kết quả.** `surface` **hoặc** `notice`, loại trừ nhau. Không phải một banner dán cạnh mặt trang.

**Vì sao.** Nếu thứ phải sống sót đã không có, thì mặt trang đang vẽ một phiên không tồn tại. Giữ nó
lại là mời người dùng thao tác vào hư không.

---

## Luật

1. Chỗ mount khớp phạm vi sống sót — không rộng hơn, không hẹp hơn.
2. Không mount vào cây provider.
3. Không mount vào chrome lặp theo cụm route.
4. Bạn đồng hành là slot optional ngang hàng với mặt trang.
5. Người giữ không vẽ khung, không giữ chỗ, và khai `narrowBehaviour: khong-doi` trừ khi đo được là
   đổi.
6. State sống sót là `dung-yen-du-lieu`, đi xuống bằng context.
7. Mọi reset theo route đều tường minh và khoá theo đúng thứ làm nó đổi.
8. Danh sách route ẩn là một predicate dùng chung.
9. Hỏng thì notice thay mặt trang.
10. Trục thường trực không bao giờ là một mặt của trang.

## Ngoại lệ

- **`KEEPER-2` cho phép bạn đồng hành rất nổi.** Phép thử là mặt trang có phải nhường chỗ không.
- **`KEEPER-5` reset hẹp**, không reset cả cụm.
- **`KEEPER-6` ẩn vì hai lý do cùng lúc**, và cố ý chừa trang kết quả.
- **`KEEPER-1` cho phép người giữ phạm vi một cụm.** Phạm vi mới là luật; gốc locale chỉ là nơi phạm
  vi **toàn cục** đáp xuống.
