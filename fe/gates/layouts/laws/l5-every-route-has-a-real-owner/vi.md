---
id: fe-layouts-laws-l5-every-route-has-a-real-owner-vi
title: vi.md
slug: /gates/layouts/laws/l5-every-route-has-a-real-owner/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng mã L5-N nhận diện bằng nghiệp vụ, và vì sao canon không được chọn sẵn một bên khi thầy đã phán hai lần ngược nhau về cùng một route.
---

# vi.md

> Phiên bản: `1.00` · Mô-đun: `l5-every-route-has-a-real-owner` · Luật: [`INDEX.md`](./INDEX.md)

# Mỗi route một chủ thật

Một địa chỉ mở ra được thì chưa nói lên điều gì. Nó chỉ nói rằng có một file trả về thứ gì đó, và
thứ đó có thể là trang thật, có thể là bản nháp cho đủ chỗ, cũng có thể là trang của route bên cạnh
bị mượn sang. Cả ba đều biên dịch được, đều render được, đều xanh trong CI. Luật này tồn tại vì
chuyện xanh và chuyện có chủ là hai chuyện khác nhau, mà chỉ chuyện thứ hai mới đọc được ra sản phẩm.

Thầy đã bác mười một lần quanh đúng ý đó, trên hai hồ sơ. Điều đáng chú ý là trong mười một lần ấy
có hai lần ngược chiều nhau về cùng một địa chỉ `/learn`: vòng trước thầy bắt `/learn` phải có trang
Hôm nay thật, vòng sau thầy bảo sửa lại theo legacy để `/learn` chỉ đưa người đọc sang
`/learn/content`. Nếu canon chép lấy một trong hai làm mặc định thì nó đang tự bác nửa kho phán quyết
của chính mình. Nên luật này không trả về đích. Nó trả về một cách phân loại, và câu hỏi *cửa nào mở
sang đâu* được đẩy ngược lên thầy.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | File route phát ra gì |
|---|---|---|
| `L5-1` | Route là một mode người đọc phải dừng lại và đọc | giải params rồi mount **đúng một** page owner có tên |
| `L5-2` | Route là cửa vào, đích tính được từ chính params | `redirect()` trần, **không** page owner nào |
| `L5-3` | Route là cửa vào, nhưng phải hỏi runtime mới biết đi đâu | một page owner **thật**, tự hỏi, tự chuyển, và khai luôn nó vẽ gì trong lúc chờ |
| `L5-4` | Route có đó, chủ chỉ là nháp hoặc là trang đi mượn | **không ship gì** — route vào `owed` |
| `L5-5` | Một cửa vào có hai đích đều bảo vệ được | **không giá trị nào** — trả lại câu hỏi kèm phán quyết |
| `L5-6` | Một phán quyết vừa lấy nội dung ra khỏi route đang có | danh sách chết: owner, nhánh, hằng số và contract nào hết đường sống |

## `L5-1` — route mang nội dung thì có chủ

Hỏi đúng một câu để nhận ra nó: *xoá hẳn route này đi thì có nội dung nào không còn tồn tại ở đâu
nữa không?* Nếu gọi được tên nội dung đó thì route mang nội dung, và nó cần một thư mục riêng dưới
`src/components/pages/`.

File route làm hai việc và dừng lại: giải tham số đường dẫn, rồi mount owner. Nó không vẽ, không
fetch. Bốn mươi tám file trong repo sống đang đúng như thế, không file nào lệch.

Ranh giới dễ trượt nhất không phải giữa `L5-1` và cửa vào, mà giữa `L5-1` và một trang trông rất
giống đứng ngay bên cạnh. Bản kế hoạch cũ từng định lấy `CourseDetailPage` làm landing cho
`/learn/content` vì hai bên đều là trang khoá học. Thầy bác: giải phẫu của trang mua khoá không phải
giải phẫu của bảng điều khiển học. Giống nhau ở chỗ nhìn không cứu được chuyện khác nhau ở chỗ nghĩa.

## `L5-2` — cửa vào không cần chủ

Ba route đang chuyển hướng trong repo sống và cả ba đều thuộc mã này. Gốc `[lang]` đưa thẳng sang
`/dashboard`, `/learn` đưa sang `/learn/content`, `/learn/flashcards` đưa sang `flashcards/review`.

Cái chung của cả ba là đích nằm sẵn trong tham số đường dẫn. `learn/page.tsx` chỉ cần `lang` và
`displayId`, hai thứ nó đã cầm trong tay, để ghép ra địa chỉ tiếp theo. Không có gì để chờ, không có
gì hỏng được, nên cũng không có trạng thái nào cho ai sở hữu. Một page owner ở đây là một lớp rỗng
đặt vào giữa.

Chuyển hướng ở mã này hợp lệ không phải vì nó tiện, mà vì bỏ route đi thì không ai mất gì. Đó là
toàn bộ lý do, và khi lý do đó không đúng nữa thì mã cũng đổi.

## `L5-3` — cửa vào buộc phải là một trang

Đây là ngoại lệ duy nhất được phán cho câu "cửa vào thì không có chủ", và nó có thật trong repo.
`/profile` không thể biết đưa người đọc đi đâu cho tới khi hỏi xong danh tính người đang xem.
`ProfileRedirectPage` chạy `useQueryMeSwr`, có username thì `replace` sang `/profile/<username>`,
còn `me.data === null` thì `replace` sang `/authentication`.

Hai kết cục, một lần chờ, và một cách hỏng khi truy vấn không trả lời. Chừng đó là việc của một
trang chứ không phải của một lời gọi `redirect`. Bằng chứng nằm ngay trong file: nó vẫn render
`_ProfileRedirectPage` trong lúc chờ, và cái nửa thuần đó trả về `null` kèm một câu ghi rõ rằng
không vẽ màn hình quá độ nào là chủ ý.

Phân định `L5-2` với `L5-3` không nằm ở chỗ route quan trọng đến đâu. Nó nằm ở chỗ đích đến từ đâu
ra. Params thì không có chủ, runtime thì có chủ.

## `L5-4` — nháp không phải là chủ

Bản kế hoạch nhánh `/learn` từng đề nghị dựng stub hoặc redirect cho những route còn thiếu để danh
sách nhìn cho liền. Thầy bác thẳng, và lý do thầy đưa ra chính là câu định nghĩa mã này: stub làm
route xanh trong khi hành vi sản phẩm sai.

Ba dạng nháp đã bị bác riêng, và chúng khác nhau đủ để đáng nhớ từng cái. Dựng UI theo hình gần
giống bị bác vì parity đòi đúng anatomy chứ không đòi route tồn tại. Mượn trang của route hàng xóm
bị bác vì hai trang mang nghĩa khác nhau. Chuyển hướng route module thẳng sang trình đọc bị bác vì
trang module legacy có header, có băng học tiếp và có danh sách bài của riêng nó.

Còn một lần bác nữa đáng chép lại, vì nó bắt đúng cái phản xạ hay gặp nhất. Có người báo A2 đến A6
xong rồi vì route đã có và typecheck đã sạch. Thầy bác, và ghi rằng agent phản hồi xác nhận vẫn còn
gap. Xanh không phải bằng chứng.

Việc phải làm khi rơi vào mã này là ghi route vào `owed` với tên owner còn nợ. Ghi ra thì món nợ
được đếm, còn lặng lẽ cắm một redirect thì món nợ biến mất khỏi sổ mà vẫn còn nguyên trong sản phẩm.

## `L5-5` — hai đích, và luật không chọn hộ

Mã này phát ra một câu hỏi chứ không phát ra giá trị, và đó là chủ ý.

Vòng trước, thầy nói trang Hôm nay nằm ở route `/learn` mặc định. Kế hoạch làm theo, dựng
`CourseLearnTodayPage` đầy đủ. Vòng sau, thầy nói sửa learn để follow legacy, và bản ghi phán quyết
lần hai ghi lý do là hành vi legacy có tính ràng buộc cùng với chỉ đạo tường minh của người dùng.

Hai lần ấy không mâu thuẫn nhau ở tầng luật. Chúng mâu thuẫn ở tầng sản phẩm, và tầng sản phẩm là
tầng thầy sở hữu. Cái luật này giữ được là: `/learn` không mang nội dung nào mà `/learn/content`
không mang, nên nó *được phép* là cửa vào. Còn cửa đó mở sang Hôm nay hay sang Nội dung thì phải có
người phán, không có người phán thì kế hoạch dừng ở đây.

Cách trả lời sai duy nhất là chọn theo lần gần nhất. Lần gần nhất là một dữ kiện về thời gian, không
phải một lý do về sản phẩm.

## `L5-6` — cú lật để lại xác, và kế hoạch phải khiêng

Khi thầy lật, nội dung rời khỏi một route, và mọi thứ từng phục vụ route đó lập tức hết đường sống.
Cú lật `/learn` để lại bốn thứ đo được: `CourseLearnTodayPage` với đủ ba file và tám hook SWR mà
không route nào mount, biến `isToday` trong `LearnShellLayout` so pathname với đúng cái địa chỉ giờ
đã chuyển hướng, bộ `TODAY_TABS` mà chỉ `isToday` mở được, và khoá contract
`course-learn-today-page` chỉ còn chính trang mồ côi kia gọi tới.

Bốn dòng đó không tự chết. Chúng vẫn biên dịch, vẫn có test chạy xanh, nên không gate nào kêu.
Nghĩa vụ của mã này là bắt kế hoạch liệt kê chúng ra trước khi cú lật được nhận, rồi hoặc dọn, hoặc
ghi vào `owed`. Bỏ lửng chính là cách repo sống đang mang đống code chết hiện tại.

## Ngoại lệ

Ngoại lệ ở đây hẹp và đều có tên, không cái nào là cửa mở.

`L5-3` là ngoại lệ của câu "cửa vào không có chủ", và nó chỉ mở khi đích phải hỏi runtime mới biết.
Một owner `L5-3` vẽ ra `null` vẫn là owner thật, vì `L5-4` nhắm vào route giả vờ có bề mặt chứ không
nhắm vào trang cố ý không vẽ màn hình quá độ.

Phán quyết vòng hai chỉ nói về `/learn`. Nó chốt cửa đó mở sang đâu, nó không cấp phép chuyển hướng
bất kỳ route nào ngại làm. Đọc rộng ra là dựng lại đúng cái stub mà vòng một đã bác.

Giữ một địa chỉ cũ sống được thì hợp lệ, nhưng giữ nó sống *thay cho* bề mặt nó từng mở là đổi
nghĩa. `/qa` từng được giữ ở dạng redirect và bị lật; hôm nay route đó mount `CourseQaPage` thật.

## Vì sao luật bị bác mười một lần

Đọc lại hai hồ sơ, ba cách hiểu sai lặp đi lặp lại.

- **Hiểu "route đã chạy" thành "route đã xong".** Đây là cách hiểu sai đắt nhất, vì nó không để lại
  dấu vết nào cho gate. Bản đúng là owner phải gọi được tên và mount được, chứ không phải trang phải
  hiện ra.
- **Hiểu chuyển hướng thành một cách giữ parity.** Sai, vì địa chỉ cũ và bề mặt cũ là hai thứ. `/qa`
  bị bác đúng ở chỗ đó.
- **Hiểu phán quyết mới nhất thành mặc định mới.** Sai, vì hai phán quyết về `/learn` đều còn hiệu
  lực và chúng nói về sản phẩm, không nói về luật. Ai lấy lần gần nhất làm quy tắc thì lần sau thầy
  lật tiếp sẽ lại phải viết lại canon.
