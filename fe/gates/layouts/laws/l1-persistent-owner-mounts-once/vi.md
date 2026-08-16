---
id: fe-layouts-laws-l1-persistent-owner-mounts-once-vi
title: vi.md
slug: /gates/layouts/laws/l1-persistent-owner-mounts-once/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã L1-N nhận diện bằng câu hỏi địa chỉ có tính lại được trạng thái hay không, và vì sao bản luật cũ cấm nhầm sáu chỗ mount đúng.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `l1-persistent-owner-mounts-once` · Luật: [`INDEX.md`](./INDEX.md)

# Cái gì địa chỉ không tính lại được thì mount một lần

Có hai loại chủ sở hữu trong cây layout, và mắt không phân biệt được chúng. Cả hai đều xuất hiện ở
mọi trang, cả hai đều nằm trên cùng, cả hai đều trông rất toàn cục. Khác nhau nằm ở chỗ khi bạn
tháo nó ra rồi lắp lại ở cụm route kế tiếp thì bạn mất gì.

`ShellNav` không mất gì. Route nào đang sáng thì nó đọc từ `usePathname()`, tab nào đang chọn thì nó
đọc từ `useSearchParams()`. Lắp lại ở cụm khác, nó tính ra đúng hai câu trả lời cũ, không lệch một
chữ. `GlobalAiChatLayout` thì mất sạch: hội thoại đang mở, đoạn code người đọc vừa bôi đen và số lần
rẽ nhánh đều nằm trong `useState`, và không có địa chỉ nào dựng lại được ba thứ đó.

Vậy nên câu hỏi của luật này không phải "cái này có toàn cục không". Xuất hiện khắp nơi là tính chất
của bảng route. Sống sót qua điều hướng là tính chất của trạng thái, và chỉ cái thứ hai mới quyết
định độ cao mount.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Mount ở đâu |
|---|---|---|
| `L1-1` | Trạng thái phải sống qua một lần chuyển cụm route | đúng một lần ở locale root, qua shell duy nhất đổi `children` thành component |
| `L1-2` | Chính chủ đó phải vô hình ở vài route | **vẫn đúng một mount đó**, chỉ bỏ phần nhìn thấy và giữ provider |
| `L1-3` | Chrome mà địa chỉ tính lại được toàn bộ | ở từng route-group layout cần nó, sáu bản của một navbar là đáp án đúng |
| `L1-4` | Một họ route không được mang chrome đó | **không ở đâu cả** trong layout của họ đó, và có test giữ ranh giới |
| `L1-5` | Phạm vi sống sót chỉ trong một cụm | ở layout của chính cụm đó, không phải ở root |
| `L1-6` | Chủ không vẽ gì cả | cây provider, và chủ có phần nhìn thấy thì không bao giờ vào đó |
| `L1-7` | Chủ tính lại được nhưng lại đang giữ state sống của overlay | **chưa phát gì**, báo nợ; chưa ai đo chuyện chuyển cụm làm gì với nó |

## `L1-1` — một mount ở locale root

Tình huống: có một thứ mà người đọc đang dở dang, và họ đi sang chỗ khác trong sản phẩm mà vẫn coi
là mình chưa xong. Hội thoại với trợ lý là ví dụ sống. Người đọc hỏi một câu ở trang khoá học, mở
giỏ hàng xem giá, quay lại, và câu trả lời phải còn ở đó.

Cách kiểm: gọi tên từng mẩu state, rồi chỉ ra cái hook nào đọc nó ra từ URL. Chỉ được không ra thì
nó là `L1-1`. `useState(false)` không đọc ra từ đâu cả, và một socket handle cũng vậy.

Chỗ dễ nhầm là làm ngược lại. Người ta thấy một thứ hiện ở mọi trang rồi kết luận nó phải mount một
lần. Hiện ở mọi trang chỉ nói rằng mọi cụm đều khai nó trong layout của mình, chứ không nói gì về
việc mount lại có làm hỏng cái gì không.

## `L1-2` — giấu chứ không tháo

Trên route đăng nhập và trên các route đang chấm bài trực tiếp, trợ lý không được hiện. Nhưng nó
**vẫn mount**. Code trả về đúng cái provider bọc quanh routed surface và bỏ hẳn cây `Tree` vẽ nút,
vẽ drawer, vẽ ô chọn. Hội thoại nằm trong context nên nó đi qua bài thi mà không đứt.

Đây là mã hay bị đọc gộp với `L1-4` nhất, và đọc gộp thì hỏng theo hai hướng ngược nhau. Tháo chủ ra
để giấu thì người đọc thi xong quay lại thấy hội thoại trống. Giấu chrome bằng cách vẫn mount nó thì
trang đăng nhập có navbar nằm trên form.

Danh sách route bị giấu phải là **một hàm dùng chung**. Chủ khai nó, chủ khung cũng khai nó, và hai
bên phải đọc cùng một chỗ. Nếu mỗi bên tự nuôi một danh sách thì đến lúc lệch, người phát hiện đầu
tiên là người đang ngồi thi và thấy navbar còn nguyên trong khi trợ lý biến mất.

## `L1-3` — lặp theo cụm là đúng, không phải là mùi

Sáu layout mount `ShellNav`: dashboard, courses, cart, league, practice, profile. Cả sáu đều đúng.

Lý do đơn giản đến mức dễ bỏ qua: cái navbar đó không giữ câu trả lời nào cả, nó tính câu trả lời từ
địa chỉ mỗi lần vẽ. Cụm nào cần một lối ra khỏi trang thì cụm đó khai nó, và số sáu là số cụm muốn có
điều hướng chứ không phải số lần ai đó copy nhầm.

Bản kế hoạch không cần biện hộ cho việc lặp. Cái cần biện hộ là mount một lần, vì mount một lần là
lời khẳng định rằng nếu lặp thì sẽ mất một thứ có tên.

## `L1-4` — vắng mặt, và ghi lại chuyện vắng mặt

Họ route `authentication` không mount `ShellNav`. Không phải vì quên, mà vì trang đăng nhập không có
gì để người đọc rời đi cho đúng lúc đó.

Chuyện này được giữ bằng một test đọc thẳng file layout: locale root không được chứa chữ `ShellNav`,
còn `dashboard` và `league` thì bắt buộc phải import và render nó. Một sự vắng mặt không ai viết
xuống thì không phân biệt được với một chỗ bị bỏ sót, nên `L1-4` luôn đi kèm cái giữ của nó.

## `L1-5` — sống sót trong một cụm thôi

Playground mở một socket và khởi một session trên máy chủ cho đúng một `slug`. Người đọc đi từ màn
hình cài đặt sang màn hình chạy thật, và kết nối đó phải còn. Nhưng họ rời khỏi `slug` thì không còn
lý do gì để giữ nữa.

Nên chủ đó mount ở `playground\[slug]\layout.tsx`, không ở root. Locale root là đáp án cho phạm vi
xuyên cụm, chứ không phải mặc định cho mọi thứ có chữ "persistent" trong tên.

## `L1-6` — chủ không vẽ gì thì nằm trong provider

Chủ chỉ mang context, không mang bố cục, thì chỗ của nó là cây provider. Chiều ngược lại đã bị bác
hai lần trong cùng một hồ sơ: đưa phần nhìn thấy của chatbot vào `AppProviders` bị từ chối vì chủ ở
đó chứa context chứ không chứa bố cục.

Đây là ranh giới dễ vượt khi người viết đang vội. Provider thì cũng bọc cả cây, cũng sống qua mọi
điều hướng, nhìn có vẻ là chỗ hoàn hảo. Nhưng đặt bố cục vào đó là đặt một thứ nhìn thấy được ở nơi
không ai đi tìm nó khi đọc layout.

## `L1-7` — chủ lặp mà lại giữ state sống

`ShellNav` giữ bốn `useState` cho bốn overlay, và nó mount cả ba overlay ngay cạnh mình. Bình luận
ngay trên chỗ mount drawer nói rõ lý do: điều khiển mở nó nằm trong chrome, nên panel phải sống lâu
hơn route bên dưới, và một drawer cho mỗi trang là một focus trap cho mỗi trang.

Lập luận đó đúng trong phạm vi một cụm. Điều chưa ai đo là chuyện gì xảy ra khi người đọc mở drawer
rồi đi từ `courses` sang `dashboard`. Chrome mount lại, `isCartOpen` về `false`, và drawer đóng.
Không có test nào nói đó là hành vi mong muốn, cũng không có phán quyết nào nói ngược lại.

Nên `L1-7` không phát ra đáp án. Nó báo nợ, và luật không nói như thể chuyện này đã xong.

## Vì sao bản luật cũ sai

Bản `1.00` phát biểu rằng chủ có phần nhìn thấy ở tầm toàn cục thì không mount vào chrome lặp theo
cụm route. Đọc thẳng câu đó thì sáu chỗ mount `ShellNav` đều vi phạm, trong khi cả sáu đều đúng và
còn có một test đang bảo vệ đúng cách bố trí ấy.

Lỗi nằm ở chỗ bản cũ chép lại *kết luận* của một phán quyết mà bỏ mất *lý do* của nó. Dòng từ chối
gốc không nói "chrome lặp thì xấu". Nó nói chrome lặp sẽ **làm rơi trạng thái hội thoại** khi đi
xuyên cụm. Bỏ vế sau đi thì cái còn lại là một lệnh cấm về hình thức, và lệnh cấm về hình thức thì
bắt nhầm.

Có hai cách hiểu sai lặp đi lặp lại quanh luật này:

- **Lấy độ phủ làm bằng chứng.** Thứ gì hiện ở mọi trang thì phải mount một lần. Sai, vì độ phủ là
  chuyện của bảng route.
- **Lấy tính nhìn thấy làm bằng chứng.** Chủ vô hình thì mount ở root, chủ nhìn thấy thì mount theo
  cụm. Sai theo cả hai chiều: `GlobalAiChatLayout` vẽ nút, vẽ drawer, vẫn mount một lần; còn một chủ
  vô hình chỉ đọc địa chỉ thì lặp bao nhiêu lần cũng không mất gì.
