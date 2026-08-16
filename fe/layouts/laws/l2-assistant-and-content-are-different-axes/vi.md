---
id: fe-layouts-laws-l2-assistant-and-content-are-different-axes-vi
title: vi.md
slug: /fe/layouts/laws/l2-assistant-and-content-are-different-axes/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã L2-N nhận diện bằng nghiệp vụ, và vì sao một trang được phép gọi trợ lý nhưng không được phép giữ nó.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `l2-assistant-and-content-are-different-axes` · Luật: [`INDEX.md`](./INDEX.md)

# Trợ lý toàn cục và mặt nội dung là hai trục

Người học mở một bài, đọc nó, gạt sang xem mã nguồn, rồi bấm sang bài kế tiếp. Trong suốt quãng đó
có một cuộc hội thoại đang mở mà họ muốn giữ nguyên, và nó không thuộc về bài nào cả. Đó là hai thứ
khác nhau đang sống cùng lúc trên một màn hình: một bên là các mặt của trang, do trang sở hữu và
thay đổi theo trang, một bên là trợ lý, do đúng một chủ ở gốc locale giữ và không thay theo trang.

Chỗ dễ trượt không phải là ai đó vẽ một khung chat vào giữa bài học. Chỗ dễ trượt là khi trợ lý bị
kéo xuống thành một tab nằm cạnh các mặt kia, hoặc ngược lại, khi một mặt của trang tự mọc ra một
trợ lý riêng cho loại câu hỏi của nó. Thầy đã bác cả hai chiều ấy trong cùng một hồ sơ, và đó là lý
do luật này được viết thành một ranh giới có hai mặt chứ không thành một lời khuyên.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Plan khai gì |
|---|---|---|
| `L2-1` | Cần một trợ lý nói được xuyên trang | một chủ ở gốc locale, trang được route đứng **cạnh** nó |
| `L2-2` | Liệt kê các mặt nội dung của một trang | trợ lý **không nằm trong danh sách** ấy |
| `L2-3` | Trang cần trợ lý nói về đúng thứ trang đang mở | trang **mượn**: nạp ngữ cảnh cho câu hỏi kế, và được mở drawer |
| `L2-4` | Trang giữ cái đang làm ngữ cảnh cho câu hỏi kế | mặt nào nạp thì mặt ấy dọn; điều hướng chỉ dọn đúng ô đó |
| `L2-5` | Trang muốn luồng riêng, transcript riêng hay trạng thái mở riêng | **từ chối**, ghi vào `owed` |
| `L2-6` | Route không được hiện trợ lý | vẫn **phát context**, chỉ bỏ phần vẽ ra |

## `L2-1` — hai trục, một chủ ở gốc

Tình huống: sản phẩm cần một trợ lý nói được ở mọi trang, và câu hỏi đầu tiên không phải là vẽ nó ở
đâu mà là ai đang giữ nó. Câu trả lời là đúng một chủ đặt ở gốc locale, nhận trang được route như
một component rồi đặt trang ấy **bên cạnh** mình.

Chỗ này quan trọng ở chữ bên cạnh. Nếu trang là con của trợ lý thì mỗi lần đổi trang là một lần dựng
lại cây bên dưới trợ lý, và cuộc hội thoại nằm trong cây ấy. Contract của khung nói ra điều đó bằng
lời của chính nó, rằng mặt được route và cái chủ trợ lý duy nhất là anh em, nên điều hướng thay được
bài học mà không thay được cuộc hội thoại. Trong repo sống, `RouteShell` là chỗ duy nhất biến
`children` của framework thành một component để trợ lý nhận vào, và nó chỉ làm mỗi việc đó.

Số lần mount và độ cao mount không do mã này phán, chúng thuộc
[`l1-persistent-owner-mounts-once`](../l1-persistent-owner-mounts-once/INDEX.md). Mã `L2-1` nhận kết
quả ấy như dữ kiện rồi nói tiếp về việc trục nào sở hữu cái gì.

## `L2-2` — trợ lý không phải một mặt của trang

Tình huống: plan liệt kê các mặt mà vùng nội dung của một trang có, kiểu bài đọc, mã nguồn, bài tập.
Câu hỏi cần trả lời là mỗi mặt ấy thay cái gì khi người đọc bấm vào. Một mặt thật thay phần thân của
trang bằng một cách đọc khác của cùng bài học. Trợ lý không thay gì cả, nó chỉ mở ra bên trên và cuộc
hội thoại vẫn là cuộc hội thoại cũ, nên đặt nó vào hàng ấy là gán cho nó một vai mà nó không đóng.

Lần bác thật nằm ở dòng `:710` của hồ sơ chatbot, và điều đáng chú ý là bản sửa không chỉ xoá. Cái
mặt AI rời khỏi hàng và một mặt `source` thật vào thay chỗ, còn trợ lý ở lại dưới dạng nút nổi và
drawer. Hôm nay `ContentFaceId` khai đúng ba giá trị `reading`, `source` và `challenge`, và hàm
dispatch bên dưới cũng chỉ gọi ba nhánh ấy.

Một mặt đang bị disable vẫn là một mặt. Để nó lại vì nó có sẵn rồi là cách phổ biến nhất để luật này
bị đi vòng, vì không ai phải viết thêm dòng nào để nó tiếp tục sai.

## `L2-3` — trang mượn trợ lý

Tình huống: người đọc đang mở mặt mã nguồn, bôi đen một đoạn và muốn hỏi. Trang biết đoạn nào đang
được chọn, còn trợ lý biết cuộc hội thoại đang ở đâu, nên việc phải làm là trang đưa cái nó biết cho
chủ trợ lý rồi để chủ ấy làm phần còn lại.

`CourseLearnContentPage` là chỗ duy nhất trong repo sống làm việc này. Nó gọi `useGlobalAiChat()` ở
dòng `95` để lấy chủ, giữ `selectedFace` của riêng nó ở dòng `101`, và khi người đọc chọn mã thì nó
gọi `setCodeContext` rồi `open`. Nó không đọc `isOpen` vào state nào của nó, không gọi `close`, và
không giữ một dòng transcript nào.

Ranh giới giữa mượn và giữ đo được bằng danh sách tên hàm chứ không bằng cảm giác về phạm vi. Gọi
`open`, `setCodeContext`, `clearCodeContext` và `startTangent` là mượn. Đưa `isOpen` vào state của
trang, hoặc sinh thêm một session id, là giữ, và đó đã là `L2-5`.

## `L2-4` — nạp thì phải dọn

Tình huống: một mặt của trang đang làm ngữ cảnh cho câu hỏi kế tiếp, rồi người đọc rời mặt ấy. Ngữ
cảnh còn treo lại sẽ trỏ vào một thứ không còn trên màn hình, và người đọc hỏi tiếp thì trợ lý trả
lời về đoạn mã họ đã rời khỏi.

Repo sống dọn ở hai nơi và cả hai đều chỉ dọn đúng một ô. Chủ ở gốc chạy một `useEffect` xoá
`codeContext` mỗi khi `anchor.path` đổi, tức là khi địa chỉ đổi, và nó không đụng đến cuộc hội thoại
cũng không đóng drawer. Trang thì xoá khi `selectedFace` rời khỏi `source`, xoá khi sandbox được
reset, và xoá khi vùng chọn bị bỏ.

Khi lập plan, khai ra **mọi** người viết vào ô ngữ cảnh chứ không riêng người của trang. Hai bên
cùng dọn một ô là chuyện đang chạy thật và nó không sai, nhưng một plan chỉ kể một bên thì chưa mô
tả được cái người đọc sẽ thấy.

## `L2-5` — một cuộc hội thoại, không có cái thứ hai

Tình huống: có một loại câu hỏi hẹp hơn, ví dụ hỏi về mã nguồn thay vì hỏi về bài học, và cách làm
nghe hợp lý nhất là cho nó một luồng riêng. Thầy đã bác đúng cách nghĩ đó ở dòng `:417`, với lý do
rằng thứ được yêu cầu là StarCi AI giải thích mã, không phải một hệ thống trợ lý thứ hai.

Cách xử lý là dùng lại đúng cuộc hội thoại đang mở và đưa ngữ cảnh mã vào cho nó, chứ không dựng
thêm chủ. Nếu yêu cầu thật sự cần một cuộc hội thoại tách bạch, ví dụ vì người dùng phải quay lại
đọc riêng lịch sử của một phiên theo phạm vi, thì đó là một quyết định sản phẩm và nó đi vào `owed`
kèm câu hỏi, chứ không được tự phán trong lúc dựng trang.

## `L2-6` — không vẽ gì vẫn phải phát context

Tình huống: có những route mà trợ lý không được hiện, gồm màn đăng nhập và mọi route đang chấm bài
trực tiếp. Cách hiểu sai là coi những route đó như chỗ trợ lý không tồn tại.

Chủ ở gốc xử lý chúng bằng một nhánh sớm: khi chưa có token hoặc khi `isContentAiRouteHidden` trả về
đúng, nó trả về `Provider` bọc `<Surface />` rồi dừng ở đó. Không có `Tree`, không có contract
`global-ai-layout`, không nút nổi, không selection ask, không drawer. Nhưng context vẫn chảy, nên một
trang gọi `useGlobalAiChat()` ở đó vẫn đọc được. Nếu nhánh ấy trả về `<Surface />` trần thì hook sẽ
ném lỗi kiến trúc, vì chính nó được viết để ném khi đọc ngoài chủ.

Chuyện giữ mount hay bỏ mount thuộc `L1-2`. Cái `L2-6` giữ là phần khác: hợp đồng giữa hai trục vẫn
còn hiệu lực trên những route mà một trong hai trục không vẽ gì, và có một test ghim đúng câu đó.

## Luật

Trợ lý toàn cục và các mặt nội dung của một trang là hai trục sống song song chứ không phải hai giá
trị của cùng một điều khiển. Trục trợ lý do đúng một chủ ở gốc locale giữ, chủ ấy nhận trang được
route như một component và đặt nó cạnh mình, nên điều hướng thay được bài học mà không thay cuộc hội
thoại. Trục nội dung là các mặt do chính trang sở hữu, và không mặt nào trong số đó được là trợ lý.

Một trang được phép triệu hồi trợ lý và được phép nạp ngữ cảnh cho câu hỏi kế tiếp. Nó không được
giữ trạng thái mở đóng, không được mở luồng hội thoại thứ hai, và không được biến trợ lý thành một
tab. Chủ ở gốc vẫn phát context trên cả những route nó không vẽ gì, vì đó là tình huống đã được phân
loại chứ không phải chỗ trống.

## Ngoại lệ

- **Một mặt nạp ngữ cảnh cho trợ lý.** `L2-3`. Mặt `source` viết vùng chọn mã vào chủ rồi mở drawer,
  và đó là hình dạng đúng chứ không phải chỗ được châm chước.
- **Trang xoá một ô của chủ.** `L2-4`. `CourseLearnContentPage` gọi `clearCodeContext`, tức là nó
  viết vào trục trợ lý. Hợp lệ, vì ô ấy là ngữ cảnh cho câu hỏi kế tiếp chứ không phải một phần nào
  của cuộc hội thoại.
- **Route không có trợ lý nhìn thấy được.** `L2-6`. Mount ở lại, provider ở lại, phần vẽ ra thì đi.
  Danh sách route ấy thuộc về một predicate dùng chung và thuộc `L1`, không chép lại ở đây.
- **Trợ lý được grounding tới đâu không phán ở đây.** `L2-1`. Luồng global cố ý không neo vào trang
  nào, và dòng bác `:120` nói rõ ngữ cảnh theo mặt chỉ đến từ một phiên có phạm vi được chọn riêng.
  Đó là chuyện backend đọc gì, còn mô-đun này chỉ nói hai trục đứng ở đâu.

## Vì sao chỉ hai lần bác mà vẫn thành luật

Hai dòng là ít so với các luật khác cùng kệ, nhưng hai dòng ấy không lặp lại nhau, chúng đối nhau.
Dòng `:710` chặn chiều kéo trợ lý xuống thành một mặt của trang. Dòng `:417` chặn chiều để một mặt
của trang mọc ra trợ lý riêng. Một luật có neo ở cả hai chiều thì không còn là sở thích của một lần
review nữa.

Có ba cách trượt lặp lại khi đọc lại hồ sơ và mã sống:

- **Đọc `L2-2` thành chuyện thẩm mỹ.** Lời bác không nói cái tab AI trông xấu, nó nói cái tab ấy sai
  trục, và bản sửa thay nó bằng một mặt thật khác loại. Ai đọc thành chuyện thẩm mỹ sẽ giữ lại cái
  tab và chỉ đổi icon.
- **Tưởng mượn và giữ là cùng một chuyện ở hai mức độ.** Không phải. Chúng khác nhau ở danh sách tên
  hàm mà trang gọi, và danh sách ấy đọc được bằng mắt trong đúng một file.
- **Coi nhánh không vẽ là chỗ trợ lý không tồn tại.** Đó là nhánh nguy hiểm nhất, vì nó chạy đúng cho
  tới khi có trang đầu tiên gọi hook ở đó, và lúc ấy lỗi hiện ra dưới dạng ném ngoại lệ chứ không
  dưới dạng một chỗ hiển thị sai.
