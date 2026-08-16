---
id: fe-layouts-archetypes-invisible-owner-audit
title: audit.md
slug: /gates/layouts/archetypes/invisible-owner/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định của luật người giữ phiên, và các chỗ nó chưa chứng minh được.
---

# audit.md

> Phiên bản: `1.00` · Mô-đun: `invisible-owner`

Phản biện này kiểm xem luật có chọn được đúng một mã từ **thứ phải sống sót và phạm vi sống sót của
nó**, và chỉ từ đó.

## Kết luận

Chấp nhận. Đây là mô-đun có nền phán quyết chắc nhất của shelf: `KEEPER-1` và `KEEPER-3` đều có neo
từ chối trực tiếp, không phải suy ra từ code.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Người giữ so với ba archetype còn lại | Loại trừ được bằng một câu hỏi: có vùng nào phải vẽ không |
| `KEEPER-1` chỗ mount | Loại trừ được: ba ứng viên, hai bị bác bằng phán quyết, và phạm vi sống sót chọn cái còn lại |
| `KEEPER-2` hành tinh so với vùng | Loại trừ được bằng phép thử "mặt trang có phải nhường chỗ không", không bằng độ nổi bật |
| `KEEPER-3` | Loại trừ được khi đã nêu trục nào thường trực và tập mặt nào là đóng |
| `KEEPER-4` | Loại trừ được khi đã nêu cái đứng yên là pixel hay là dữ liệu |
| `KEEPER-5` | Loại trừ được khi đã liệt kê từng state và nêu state nào phụ thuộc route |
| `KEEPER-6` | Loại trừ được: có bao nhiêu chủ sở hữu ẩn theo cùng danh sách |
| `KEEPER-7` | Loại trừ được: thứ phải sống sót còn hay không |

## Nhận định

- **`KEEPER-1` là luật mạnh nhất của cả shelf**, vì nó nói một điều phản trực giác được ba lần phán
  quyết đỡ: chỗ mount không phải chuyện gọn gàng mà là **lời tuyên bố về tuổi thọ**.
- **`KEEPER-4` là lý do archetype này phải tồn tại riêng.** Không có nó, "đứng yên" trong cả shelf sẽ
  chỉ có nghĩa là pixel, và một layout không vẽ gì sẽ bị coi là layout thừa.
- **`KEEPER-6` là chỗ mô-đun này chạm vào mô-đun cột đích đến.** Cùng một hàm, hai chủ sở hữu. Luật
  viết ở cả hai bên là cố ý, vì vi phạm chỉ xảy ra khi **một** bên tự nuôi danh sách riêng.
- **Bốn hành vi hẹp của enum trong gate schema chỉ có một cái áp cho archetype này**, là `khong-doi`.
  Đây là chỗ dễ bịa nhất: một layout không có breakpoint nào rất dễ bị khai một hành vi hẹp "cho đủ".

## Chỗ chưa chứng minh được

| Chỗ | Trạng thái |
|---|---|
| Nội thất `StarCiAiDrawer` | Chưa mở. L6 và L8 chỉ đo được tại điểm mount mà người giữ sở hữu |
| Bề rộng của drawer | Chưa đo. Chỉ `GlobalSearchOverlay` có giá trị đo được là `cover` |
| `GlobalAiChatLayout` gộp cả pure và connected vào một file | `index.tsx:1-88`. 4/6 layout sống tách đôi `component.tsx` + `index.tsx`; cái này không. Chưa đo được gate nào ép tách |
| Thiếu marker `shape: "layout"` | `index.tsx:87` khai `{ world: "connected", domain: "ai" }`. 3/6 layout thiếu marker này |
| Hai thư mục shell rỗng | `shells\SandpackShell\` và `shells\ScrollShell\` có 0 file. Không đo được chúng là dự định hay là rác |

## Quyết định

- Giữ bảy mã.
- `KEEPER-1` giữ nguyên bảng ba ứng viên kèm cả hai phán quyết bác, thay vì rút gọn thành "mount ở
  gốc locale". Rút gọn là mất đúng phần dạy được.
- `KEEPER-4` viết thành một mã riêng chứ không thành ghi chú, vì nó là điều kiện để phân biệt archetype
  này với một layout thừa.
- `KEEPER-6` viết ở cả hai mô-đun, và cả hai chỉ về cùng một file predicate.
- Không viết luật cho nội thất drawer khi chưa mở nó.

## Rủi ro còn mở

- **`KEEPER-1` có thể bị đọc thành "cứ mount ở gốc locale cho chắc".** Đó là mount rộng hơn phạm vi,
  và nó biến mọi người giữ thành người giữ toàn cục. Phạm vi mới là luật.
- **Chỉ có hai thành viên**, và hai thành viên rất khác nhau: một cái toàn cục, một cái phạm vi slug.
  Cái chung giữa chúng — không vẽ khung, giữ dữ liệu — có thể là trừu tượng đúng, hoặc chỉ là điểm
  giao của đúng hai instance.
- **Không chạy app.** Mọi khẳng định về việc state sống sót qua điều hướng đọc từ nguồn, không từ một
  lần đi thật giữa hai cụm route.

## Điều kiện phản biện lại

- Có người giữ thứ ba với phạm vi khác hai cái hiện có.
- Founder phán quyết về bề rộng drawer.
- Nội thất `StarCiAiDrawer` được mở và đo.
- Hai thư mục shell rỗng được lấp hoặc bị xoá.
- Có một lần đi thật giữa hai cụm route chứng minh hoặc bác bỏ việc hội thoại sống sót.
