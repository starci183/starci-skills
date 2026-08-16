---
id: fe-senses-call-to-action-vi
title: vi.md
slug: /fe/senses/call-to-action/vi
sidebar_label: vi.md
sidebar_position: 2
description: Giải thích tiếng Việt cho StarCi Academy action tree.
---

# vi.md

> Version: `1.03` · Canon: [`INDEX.md`](./INDEX.md) · Business tests: [`prompt.md`](./prompt.md) · UI: [`example.md`](./example.md)

Trang này giải thích cách đi từ job của surface tới đúng component, variant, size và state.

## Canon at a Glance

| Vai trò business | Product output | Câu hỏi phân biệt |
|---|---|---|
| Kết quả được khuyên làm ngay | `primary` | Nếu chỉ làm một việc, sản phẩm khuyên việc nào? |
| Đường hữu ích nhưng dưới recommendation | `secondary` | Có ích nhưng không phải lời khuyên chính? |
| Alternative thay cho main route | `outline` | Người dùng chọn con đường này thay vì đường chính? |
| Optional, ít nhấn | `tertiary` | Bỏ action này có chặn job không? |
| Back/navigation/furniture | `ghost` hoặc `TextLink` | Action chỉ rời/chuyển/điều khiển chrome? |
| Destructive | `ConfirmButton` | Có cần hai press và label kết quả phá hủy? |
| Không có recommendation | quiet path onward | Surface chỉ đọc/thông báo/read-only? |

Size là trục khác: embedded/persistent dùng `sm`; standalone dùng `md`.

## Output Explanations

### Một primary là một recommendation

Primary không phải “nút quan trọng”. Nó là lời khuyên duy nhất trong state hiện tại. Pricing rail đã
cho người học thấy course, giá và bằng chứng thì “Đăng ký ngay” có thể là primary. “Thêm vào giỏ”,
“Học thử”, “Vì sao giá này?” có vai trò khác nên không cạnh tranh cùng weight.

### Secondary và outline không giống nhau

Secondary là path dưới recommendation: xem thêm, retry ở empty state, add to cart khi checkout là
main. Outline là route thay thế main: đăng nhập Google/GitHub thay cho form hoặc một quiz mode peer.

Nếu hai lựa chọn thật sự ngang nhau, đừng chọn một primary giả. Giữ chúng ở choice/outline model cho
tới khi người dùng hoặc product evidence tạo selection.

### Tertiary, ghost và TextLink

Tertiary vẫn là action trong content nhưng optional. Ghost thuộc furniture/back/low-chrome control.
TextLink là destination đọc tự nhiên trong prose hoặc path onward của surface không có CTA.

### Size theo placement

Pricing rail dùng `primary md` vì action đứng thành một decision line. Mobile enrol bar dùng
`primary sm` vì price/action nằm trong persistent compact row. Cùng outcome, khác owner geometry.

### Pending và failure

`Button` có `isPending`: giữ label thật để width không nhảy, khóa duplicate press và vẽ progress.
Retry chỉ lên primary khi nó là one viable restoration của core flow; permission failure phải bỏ
retry và giữ đường quay lại.

### Destructive

StarCi không có danger variant. `ConfirmButton` press lần đầu đổi sang confirm label/outline, tự hết
armed window và chỉ act ở press thứ hai. “Xác nhận” không đủ; label phải nói object/outcome.

## Exceptions

- Selected choice có thể dùng primary/outline nhưng không được tính như surface CTA.
- Empty state dùng `EmptyNotice` secondary-sm action theo component contract.
- Read-only/informational surface không cần primary, nhưng phải có path onward khi người dùng có thể
  rời surface.
- Persistent mobile action cần named owner; không tự sticky một Button.
- Retry không thể thành primary nếu business reason khiến retry chắc chắn thất bại.
- Thiếu destination, permission, recommendation hoặc placement → `INSUFFICIENT CONTEXT`.

## Review Checklist

- [ ] Surface job viết được bằng một câu?
- [ ] Current state và reachable outcomes đã rõ?
- [ ] Có đúng zero hoặc one recommendation?
- [ ] Equal alternative có bị biến thành subordinate/primary giả không?
- [ ] Variant đến từ role và size đến từ placement?
- [ ] Label nói outcome/destination thay vì mechanism?
- [ ] Pending khóa double press nhưng giữ lời hứa?
- [ ] Destructive dùng `ConfirmButton`, không `danger`?
- [ ] No-primary surface vẫn có path onward?
- [ ] Nếu hai trees còn hợp lệ, đã safe-stop chưa?

