---
id: fe-senses-press-affordance-vi
title: vi.md
slug: /fe/senses/press-affordance/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hướng dẫn tiếng Việt về hover, press, focus, touch và control lồng nhau.
---

# vi.md

> Version: `1.02` · Hướng dẫn tiếng Việt · Luật cho AI: [`INDEX.md`](./INDEX.md) · Ví dụ trực quan: [`example.md`](./example.md)

## Affordance là câu trả lời của đúng target

Một link đã có convention cho biết nó mở nơi khác. Một card hoặc row hình chữ nhật thì không. Nếu cả
row mở chi tiết khóa học, người dùng cần biết vùng đó có thể bấm và cú bấm đã được nhận.

Câu hỏi đầu tiên luôn là:

> Người dùng đang trỏ, focus hoặc chạm vào thứ gì, và thứ gì sẽ mở?

Hai câu trả lời phải cùng một owner. Nếu title nói “mở khóa học” nhưng hover làm cả row tối đi đồng
thời một link bên trong cũng underline, giao diện đang hứa nhiều destination cho một gesture.

## Một gesture, một visual answer

Có hai cách phổ biến để pressable surface trả lời hover:

1. **Naming line answers:** title thật sự là tên destination; title underline như link của sản phẩm.
2. **Surface answers:** không có naming line rõ; toàn surface đổi ground/opacity một cách restrained.

Chọn một, không dùng cả hai. Surface dim + title underline không làm affordance rõ hơn; nó khiến người
dùng không biết target là cả vùng hay riêng dòng chữ.

### Khi title nên trả lời

- Row khóa học mở đúng khóa học mang tên trong title.
- Notification mở object được gọi tên trong dòng chính.
- Search result mở tài liệu có title hiển thị.

### Khi surface nên trả lời

- Visual tile không có một text line duy nhất đại diện destination.
- Thumbnail board nơi toàn composition là identity.
- Compact cell mà label chỉ mô tả trạng thái, không đặt tên object mở ra.

Nếu không thể nói dòng nào là tên destination, đừng tùy tiện underline một dòng chỉ vì nó nổi nhất.

## Dùng đúng link mark của sản phẩm

Naming line phải dùng cùng underline colour, thickness và offset với link bình thường. Người dùng học
một convention rồi mang nó sang các surface khác. Một hairline xám riêng cho card tạo ra lời hứa thứ
hai mà không ai biết khác gì link thật.

Affordance không phải nơi invent visual token. Nếu link style hiện tại chưa đủ rõ, sửa owner của link
system; không vá riêng card.

## Press phải trả lời ngay

Hover chỉ nói “có thể bấm”. Pointer down, keyboard activation hoặc touch phải nói “cú bấm đã tới”.
Route chậm mà không có pressed state khiến người dùng bấm lần hai, mở hai request hoặc nghĩ surface
bị hỏng.

Immediate answer có thể là restrained dim/scale/state change theo hệ thống. Nó xuất hiện ngay khi
press được nhận, trước khi destination tải xong. Loading state sau đó có thể tiếp quản, nhưng không
được để một khoảng im lặng giữa gesture và progress.

## Nested control có owner riêng

Một row mở course detail có thể chứa:

- link “Vì sao giá này?” mở explanation;
- button bookmark thay đổi saved state;
- menu mở actions;
- checkbox chọn row.

Khi pointer, focus hoặc activation nằm trên các control đó:

- outer title không underline;
- outer surface không dim như thể nó sẽ navigate;
- click/Enter/Space không bubble thành outer activation;
- focus ring thuộc control đang vận hành.

Không chỉ stop event ở cuối. Visual answer cũng phải dừng, vì affordance sai vẫn lừa người dùng ngay
cả khi navigation cuối cùng đúng.

## Affordance thuộc về handler owner

Cursor, hover, active và focus state không nên nằm trong layout entry hoặc wrapper luôn được render.
Arrangement không biết call site có truyền handler hay không. Nếu handler biến mất nhưng cursor vẫn
pointer, dead region tiếp tục hứa rằng nó mở thứ gì đó.

Owner đúng là control biết:

- có activation hay không;
- outcome là gì;
- disabled/loading state;
- nested control boundary;
- accessible name.

Handler và affordance phải xuất hiện, thay đổi và biến mất cùng nhau.

## Keyboard parity

Pressable region phải:

- vào được tab order nếu nó không dùng native interactive primitive;
- có visible focus ring;
- Enter hoặc Space hoạt động theo đúng role;
- có accessible name là destination, không phải những từ đầu tiên tình cờ trong row;
- không kích outer navigation khi nested control được focus;
- giữ source order hợp lý.

Hover không thay thế focus. Focus cũng không nên làm một destination khác với pointer hover.

## Touch không có hover

Trên touch, người dùng thường không có bước “trỏ thử”. Nếu action chỉ lộ ra khi hover, họ không biết
surface có thể bấm cho tới sau lần chạm đầu tiên.

Touch discovery có thể đến từ:

- chevron hoặc navigation cue có meaning thật;
- layout convention nhất quán của list rows;
- visible destination title có link-like treatment phù hợp;
- button/link native rõ ràng;
- supporting copy nói outcome khi surface lạ.

Đừng thêm icon chỉ để trang trí. Cue phải nói một hành vi có thật. Hit target phải đủ lớn và nested
controls không được chồng gesture area.

## Hover, focus, selected và current khác nhau

- **Hover:** pointer đang ở trên target.
- **Focus:** keyboard đang ở target.
- **Pressed:** gesture đang được nhận.
- **Selected:** item thuộc một selection model.
- **Current:** item đại diện route/state hiện tại.
- **Disabled:** action không khả dụng.

Không dùng selected background làm hover answer nếu row không selectable. Không giữ hover style để
biểu diễn current route. Mỗi state có semantics riêng; có thể chia sẻ token nhưng không được trộn
meaning.

## Drag và press

Nếu card có thể kéo và cũng có thể mở, movement threshold phải phân biệt hai gesture. Di chuyển vượt
threshold hủy press; thả sau drag không navigate. Drag handle riêng thường rõ hơn whole-card drag,
đặc biệt khi card còn nested controls.

Đây là boundary cần test bằng pointer và touch. Một demo chỉ có click không chứng minh được.

## Reduced motion và slow route

Pressed feedback không cần animation lớn. Khi người dùng chọn reduced motion, state change trực tiếp
vẫn có thể cho biết gesture được nhận. Mục tiêu là feedback, không phải motion.

Route chậm cần nối mạch:

1. immediate pressed answer;
2. pending/navigation progress nếu chờ lâu;
3. destination hoặc recoverable error.

## Cách review nhanh

1. Owner của activation là element nào?
2. Outcome/destination là gì?
3. Có dòng nào thật sự đặt tên destination không?
4. Hover dùng naming-line hay surface-answer?
5. Có đúng một visual answer không?
6. Press có feedback ngay không?
7. Nested link/button/checkbox/menu có tắt outer visual và activation không?
8. Affordance có biến mất cùng handler/disabled state không?
9. Keyboard focus và activation có cùng outcome không?
10. Touch user nhận ra action bằng gì nếu không có hover?
11. Selected/current có bị trộn với hover không?
12. Drag có vô tình kích press không?

Nếu câu 1 hoặc 2 không rõ, region chưa sẵn sàng để pressable. Nếu câu 5 có hai answer, bỏ một. Nếu
câu 10 không có câu trả lời, hover demo chưa đủ.
