---
title: CDC · Vietnamese
---

# CDC

Đầu vào của pattern này là một shape đã được duyệt: một read model ai đó đã đồng ý hiển thị, một projection mà con số của nó đang được một màn hình phụ thuộc vào, một bảng nguồn mà thay đổi của nó phải chạy tới màn hình đó. Pattern này không mở lại quyết định ấy. Đầu ra của nó là kiến trúc source — code nằm ở file nào, tầng nào sở hữu kết nối và tầng nào phải hoàn toàn không biết tới nó, class kế thừa cái gì, khai báo cái gì, xuất ra cái gì, và một câu query được phép nói gì.

## Luật

CDC biến một dòng đã commit trong database thành một read projection được tính lại. Listener không phát lại business command, không cộng thêm một delta thứ hai; nó dịch một thay đổi dữ liệu thành danh tính của projection, rồi dựng lại projection đó từ nguồn sự thật.

Câu hỏi quyết định là:

> Xử lý đúng một dòng thay đổi đó hai lần thì projection có ra cùng một kết quả không?

Nếu không — đoạn code đang viết không phải CDC projection, dù nó tên là gì, dù nó subscribe topic nào.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi file có tên kết thúc bằng `projection.listener.ts` đều mang một tình huống CDC, và mọi tình huống dưới đây đều có mã. Không có projection nào nhỏ đến mức được miễn: một listener theo dõi một bảng và ghi một bộ đếm phải trả lời `CDC-4` vì đúng lý do mà một listener gom bốn topic thành hai tổng hợp phải trả lời `CDC-3`. "Nó chỉ nhận đúng một event thôi" không phải một ngoại lệ — đó là một dự đoán về việc giao tin mà broker chẳng có nghĩa vụ nào phải giữ.

Lý do luật xoay quanh replay chứ không xoay quanh "chạy đúng ở lần giao đầu tiên" là vì broker chỉ hứa at-least-once, không hơn. Giao trùng không phải sự cố cần xử lý, nó là hợp đồng. Code chỉ đúng khi mỗi message tới đúng một lần là code đang âm thầm giả định một bảo đảm chưa ai từng cấp cho nó.

`CDC-4` LÀ GỐC, SÁU MÃ CÒN LẠI LÀ ĐIỀU KIỆN CỦA NÓ. Recompute idempotent là thứ khiến `CDC-6` sống được — nuốt một message chỉ sửa chữa được vì lần thay đổi kế tiếp của cùng dòng đó dựng lại đúng target ấy từ đầu. Nó cũng là thứ khiến `CDC-2` trả nổi giá: một group cố định có thể tiếp tục từ offset đã commit chính bởi vì xử lý lại quanh ranh giới không thay đổi gì cả. Phá `CDC-4` thì sáu mã kia hết an toàn, chứ không chỉ là hơi lộn xộn.

Đánh số không mang ý nghĩa gì ngoài danh tính. `CDC-1` không nặng hơn `CDC-7`, và các mã không tạo thành một thang bậc.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `CDC-<n>`. Mã đặt tên cho TÌNH HUỐNG; cột thứ ba nói tình huống đó buộc source phải trông như thế nào. Các con số là cố định và được trích dẫn từ những file luật khác cũng như từ hồ sơ công việc — một mã không bao giờ bị đánh số lại, và không bao giờ bị khai tử bằng cách đem số của nó dùng cho việc khác.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `CDC-1` | Một projection mới cần nghe Kafka | Mọi `*projection.listener.ts` cụ thể đều kế thừa `AbstractProjectionListener`; kết nối, subscribe, parse envelope và cô lập lỗi nằm trong base đó. Cấm: một projection listener có `onModuleInit` riêng, consumer riêng, parse riêng hoặc chính sách lỗi riêng |
| `CDC-2` | Projection cần biết mình là ai và nghe những bảng nào | Một `groupId` khai báo rõ, là danh tính bền vững của consumer projection này, và một mảng `topics` là tập nguồn đầy đủ có thể làm projection sai. Cấm: group sinh tự động, ngẫu nhiên hoặc gắn với instance; tập topic ngầm hiểu hoặc thừa kế |
| `CDC-3` | Một dòng đổi → phải tính lại cái gì | `deriveTargets` đọc dòng vừa đổi và trả về danh tính projection; `recomputeTarget` uỷ quyền cho projection service. Cấm: business command, side effect hoặc chính sách SQL nằm trong listener |
| `CDC-4` | Tính lại con số của projection | Recompute dựng lại projection bằng một UPSERT từ những dòng có thẩm quyền. Cấm: cập nhật projection bằng cách cộng delta mà event mang theo |
| `CDC-5` | Một dòng nguồn bị xoá | Payload không có ảnh `after` thì bỏ qua; việc sửa chữa khi xoá phải đến từ một nguồn khác còn được giữ lại hoặc một deletion stream dựng riêng. Cấm: coi tombstone là một entity rỗng rồi ghi cái rỗng đó xuống |
| `CDC-6` | Một message hỏng giữa dòng | Lỗi parse hoặc lỗi recompute được log kèm topic và consumer group, và bị cô lập đúng trong một message đó. Cấm: ném lỗi ra khỏi handler và làm nghẽn vòng lặp consumer |
| `CDC-7` | Chứng minh đường CDC chạy thật | Một E2E vận hành đẩy qua broker thật rồi chờ projection trong database. Cấm: gọi thẳng `deriveTargets`, `recomputeTarget` hay một method của listener rồi gọi đó là test CDC |

## Đọc một shape đã duyệt

1. Đọc những gì shape có nói. Nó nói một read model, con số hoặc dòng dữ liệu nó hiển thị, và nguồn dữ liệu mà con số đó được tính ra từ đấy. Chừng đó đủ để đặt tên projection, kể ra các nguồn của nó và danh tính nó được lưu theo.
2. Đọc những gì shape không nói, và do đó không giải quyết. Một shape đã duyệt không nói consumer group id, không nói prefix topic, không nói recompute là UPSERT hay increment, không nói chuyện gì xảy ra khi xoá, cũng không nói đã có test qua broker hay chưa. Đó là những quyết định kiến trúc mà pattern này hạ cánh; shape không cấp mà cũng không cấm chúng.
3. Giải quyết từ ngoài vào trong. Quyết định file và base class trước khi quyết định các thành viên của nó, quyết định thành viên trước thân hàm, quyết định thân hàm trước câu SQL mà một service body gọi tới. `CDC-1` được trả lời trước `CDC-2`, và `CDC-2` trước `CDC-3` với `CDC-4`, bởi vì một listener tự sở hữu consumer của nó thì chẳng có chỗ ổn định nào để đặt group id.
4. Hỏi lần lượt câu hỏi của từng mã. `CDC-1`: nếu ngày mai đổi cách parse envelope, tôi sửa một chỗ hay mười bảy chỗ? `CDC-2`: restart tiến trình này 100 lần thì vẫn là một consumer group, hay thành 100 group mỗi group replay lại toàn bộ lịch sử? `CDC-3`: replay 10.000 message cũ, có hiệu ứng nào ngoài projection xảy ra không? `CDC-4`: giao trùng thì con số có nhân đôi không, và mất một message thì con số có tự lành ở lần thay đổi kế tiếp không? Hai câu trả lời phải là không và có. `CDC-5`: cái danh tính tôi đang ghi theo lấy ở đâu ra, khi dòng nguồn không còn tồn tại? `CDC-6`: một dòng dữ liệu bẩn có làm toàn bộ projection ngừng cập nhật không? `CDC-7`: nếu tôi khai sai `groupId` hoặc quên một topic, bài test này có đỏ không?
5. Khi hai mã cùng khớp, đó là hai kiểu hỏng khác nhau và phải sửa riêng. Kế thừa đúng base nhưng sinh `groupId` lúc khởi động thì `CDC-1` đạt còn `CDC-2` gãy. Uỷ quyền đúng cho service nhưng thân service lại `increment` thì `CDC-3` đạt còn `CDC-4` gãy. Ghi số 0 cho một dòng đã xoá thì phá cả `CDC-5` lẫn `CDC-4` cùng lúc, vì số 0 ấy suy ra từ event chứ không từ nguồn. Trả về mảng rỗng vì một cột đổi không liên quan là `CDC-3`; trả về rỗng vì không có ảnh `after` là `CDC-5`. Cả hai đều đúng và không cái nào thay thế được cái kia.

## `CDC-1` — vòng đời Kafka thuộc về base dùng chung

**Tình huống.** Bạn thêm một projection mới. Nó cần kết nối, cần subscribe, cần parse envelope Debezium, cần biết làm gì khi một message hỏng. Bốn thứ đó không phải việc của projection này — đã có nơi phụ trách.

**Nó sinh ra gì trong source.** Đúng một class cụ thể trong file `*projection.listener.ts`, kế thừa `AbstractProjectionListener`, không khai báo vòng đời riêng nào và không tự inject client Kafka nào. Kết nối, subscribe, parse và cô lập lỗi ở lại trong base.

**Dấu hiệu nhận biết.** Trong file listener xuất hiện `onModuleInit`, `consumer.run`, `subscribe`, hoặc `JSON.parse` một message. Listener tự inject một client Kafka thay vì nhận qua constructor của base. Trong file có một `try/catch` quyết định "message hỏng thì làm gì".

**Ranh giới.** Không phải `CDC-2`: `CDC-1` nói AI SỞ HỮU việc kết nối; `CDC-2` nói KHAI BÁO CÁI GÌ để kết nối đó có danh tính — kế thừa đúng base mà `groupId` sinh ngẫu nhiên thì `CDC-1` đạt, `CDC-2` gãy. Không phải `CDC-6`: cô lập lỗi là HÀNH VI của base, nên một listener tự viết `try/catch` cho từng message đã vi phạm `CDC-1` trước khi kịp bàn tới `CDC-6`.

**Tình huống nghiệp vụ hay gặp.** Thêm projection thống kê khoá học; thêm projection điểm người dùng; tách một projection cũ thành hai; một projection cần thêm topic thứ ba.

## `CDC-2` — danh tính consumer và tập nguồn phải khai báo rõ

**Tình huống.** `groupId` là danh tính bền vững của consumer projection này; `topics` là tập nguồn đầy đủ có thể làm projection sai. Cả hai đều được viết ra, không được suy ra lúc chạy.

**Nó sinh ra gì trong source.** Một `groupId` là chuỗi hằng đọc lên biết ngay projection nào, và một mảng `topics` ghép từ prefix topic lấy theo môi trường cộng với tên bảng liệt kê tường minh. Prefix được phép lấy từ cấu hình; danh sách bảng thì không.

**Dấu hiệu nhận biết.** `groupId` là một chuỗi hằng, đọc lên là biết projection nào. `topics` liệt kê từng bảng nguồn một. Không có `randomUUID()`, không có `Date.now()`, không có tên instance trong `groupId`.

**Ranh giới.** Không phải `CDC-1`: xem trên. Không phải `CDC-4`: group ngẫu nhiên CỘNG VỚI recompute idempotent thì không sai số liệu, chỉ tốn tài nguyên khủng khiếp; group ngẫu nhiên CỘNG VỚI cộng delta thì sai số liệu ngay lần restart đầu. Hai mã hỏng theo hai kiểu khác nhau và phải được sửa riêng.

**Tình huống nghiệp vụ hay gặp.** Deploy nhiều replica cùng đọc một projection; thêm một bảng nguồn mới mà quên khai báo topic; đổi tên bảng nguồn; chạy cùng listener ở staging và prod với prefix topic khác nhau.

## `CDC-3` — listener định tuyến, service tính lại

**Tình huống.** `deriveTargets` đọc dòng vừa đổi và trả về DANH TÍNH của những projection bị ảnh hưởng. `recomputeTarget` giao việc tính lại cho projection service. Listener sở hữu ĐỊNH TUYẾN, không sở hữu CHÍNH SÁCH SQL.

**Nó sinh ra gì trong source.** Một `deriveTargets` chỉ đọc, phân nhánh theo topic, và trả về id hoặc mảng rỗng; một `recomputeTarget` chứa đúng một lời gọi tới projection service và không làm gì khác; câu SQL nằm trong service chứ không nằm trong listener.

**Dấu hiệu nhận biết.** Không có `save`, `insert`, `emit`, `sendMail`, `publish` nào trong listener. Lời gọi recompute mang theo một danh tính, không mang theo payload. `deriveTargets` phân nhánh theo topic và trả về id hoặc `null`/`[]`.

**Ranh giới.** Không phải `CDC-4`: `CDC-3` nói AI GỌI; `CDC-4` nói HÀM ĐƯỢC GỌI TÍNH TOÁN THẾ NÀO — uỷ quyền đúng cho service nhưng service lại `increment` thì `CDC-3` đạt, `CDC-4` gãy. Không phải `CDC-5`: trả về mảng rỗng vì không phân giải được cha là ĐÚNG `CDC-3`, không phải né tránh.

**Tình huống nghiệp vụ hay gặp.** Một bài nộp đổi trạng thái phải tính lại tiến độ khoá học; một dòng ledger điểm phải tính lại tổng điểm; một review mới phải tính lại điểm trung bình; một dòng ghi danh phải tính lại cả tiến độ lẫn quyền truy cập.

## `CDC-4` — tính lại từ nguồn, không cộng delta

**Tình huống.** Projection được dựng lại bằng một UPSERT từ các dòng nguồn có thẩm quyền. Nó không bao giờ được cập nhật bằng cách cộng con số mà event mang theo.

**Nó sinh ra gì trong source.** Một hàm recompute nhận id và không nhận amount; câu SQL tổng hợp trên bảng nguồn — `SUM(...)` / `COUNT(...)` — và kết bằng `ON CONFLICT ... DO UPDATE`; một hàm chạy lại ba lần liên tiếp cho ra ba kết quả giống nhau.

**Dấu hiệu nhận biết.** Chữ ký recompute không có tham số `amount`, `delta` hay `points`. Lệnh ghi là một UPSERT khoá theo danh tính projection. Giá trị ghi xuống là giá trị được select ra, không phải giá trị được cộng dồn.

**Ranh giới.** Không phải `CDC-3`: xem trên. Không phải `CDC-6`: nuốt một message hỏng chỉ AN TOÀN vì `CDC-4` đúng — nếu recompute không idempotent thì mỗi lần nuốt là một sai số vĩnh viễn, và `CDC-6` biến từ cơ chế tự lành thành cơ chế mất dữ liệu im lặng.

**Tình huống nghiệp vụ hay gặp.** Tổng điểm người dùng; số học viên của một khoá; điểm trung bình review; số bài đã hoàn thành; streak; bảng xếp hạng theo nhóm; số lượt tương tác của một nội dung.

## `CDC-5` — tombstone không dựng ra trạng thái hiện tại

**Tình huống.** Một payload Debezium không có ảnh `after` thì không có dòng hiện tại nào để ánh xạ. Base bỏ qua nó. Projection nào thật sự cần sửa chữa khi xoá thì phải lấy danh tính từ một nguồn còn được giữ lại, hoặc từ một deletion stream dựng riêng.

**Nó sinh ra gì trong source.** Một `unwrapRow` trong base trả về `null` khi không có ảnh hiện tại dùng được, và một handler thoát sớm ngay tại cái `null` đó — không listener cụ thể nào viết lại phần bóc tách ấy. Ở nơi việc xoá thật sự quan trọng thì có thêm một nguồn còn giữ lại hoặc một deletion stream trong tập `topics`.

**Dấu hiệu nhận biết.** Code đọc `payload.after` mà không kiểm `null`. Có chỗ ép kiểu một tombstone thành entity rỗng rồi ghi cái rỗng đó xuống. Có comment kiểu "xoá rồi thì coi như 0".

**Ranh giới.** Không phải `CDC-3`: mảng rỗng vì "cột này đổi nhưng không liên quan" là `CDC-3`; mảng rỗng vì "không có ảnh `after`" là `CDC-5`. Cả hai đều đúng, nhưng chúng là hai lý do khác nhau và hỏng theo hai cách khác nhau. Không phải `CDC-4`: ghi số 0 cho một dòng đã xoá vẫn là ghi SUY RA TỪ EVENT, không phải từ nguồn — nó hỏng cả hai mã cùng lúc.

**Tình huống nghiệp vụ hay gặp.** Huỷ ghi danh; gỡ một nội dung khỏi khoá học; xoá một review; gỡ ghim một dự án; rời khỏi một nhóm.

## `CDC-6` — một message hỏng không giết consumer

**Tình huống.** Lỗi parse hoặc lỗi recompute được log kèm TOPIC và CONSUMER GROUP, chỉ ảnh hưởng đúng message đó. Consumer không dừng.

**Nó sinh ra gì trong source.** Một `catch` bọc quanh việc xử lý MỘT message — không bọc quanh cả vòng lặp — nằm trong `handleMessage` của base, dựng một CDC exception có kiểu, log nó kèm `groupId` và `topic`, và không ném lại.

**Dấu hiệu nhận biết.** Log có đủ `groupId` và `topic`; thiếu một trong hai thì không lần ra được. Không `throw` ngược ra ngoài handler. Phạm vi của `catch` rộng đúng một message.

**Ranh giới.** Không phải `CDC-1`: hành vi này NẰM TRONG BASE, nên một listener tự viết cơ chế cô lập lỗi đang vi phạm `CDC-1`. Không phải `CDC-4`: nuốt lỗi chỉ hợp lệ khi recompute idempotent — xem trên.

**Tình huống nghiệp vụ hay gặp.** Connector đổi cấu hình SMT giữa chừng; một cột đổi kiểu; một dòng có JSON không hợp lệ; database tạm thời từ chối kết nối khi recompute.

## `CDC-7` — chứng minh bằng broker thật

**Tình huống.** Một E2E vận hành đẩy qua Kafka thật rồi chờ projection trong database. Việc gọi thẳng `deriveTargets`, `recomputeTarget` hay một method của listener chỉ chứng minh code ánh xạ, chứ không chứng minh CDC.

**Nó sinh ra gì trong source.** Một file spec E2E mà bước ARRANGE ghi dòng nguồn trực tiếp và không gọi projection service, bước ACT chỉ chạm vào broker, và bước ASSERT poll bảng projection cho tới khi đúng, có timeout.

**Dấu hiệu nhận biết.** Một helper publish rồi tới một vòng chờ poll trên bảng projection. Không có lời gọi projection service nào ở bước arrange. Chờ có giới hạn thay vì ngủ một khoảng cố định.

**Ranh giới.** Không phải `CDC-3`: unit test cho `deriveTargets` là HỢP LỆ và hữu ích — nó chỉ không được tính là bằng chứng CDC. Không phải `CDC-2`: đây là bài test duy nhất phát hiện được lỗi `CDC-2`, vì một `groupId` sai hoặc một topic thiếu chỉ lộ ra khi có broker thật ở giữa.

**Tình huống nghiệp vụ hay gặp.** Thêm projection mới; đổi tập topic của một projection cũ; nâng cấp connector; đổi prefix topic giữa các môi trường; gộp hai projection thành một.

## Tầng giữ

Mối quan tâm này do base projection dùng chung ở tầng platform nắm giữ, không phải do bất kỳ module tính năng nào. Kết nối, subscribe, parse envelope, bỏ qua tombstone và cô lập lỗi thuộc về `AbstractProjectionListener`; chính sách SQL thuộc về projection service; listener cụ thể chỉ giữ phần định tuyến, còn các module nghiệp vụ của tính năng phải hoàn toàn không biết rằng có một broker tồn tại.

Bảng dưới nói tầng nào thật sự giữ từng mã ở thời điểm này. `unrepresentable` nghĩa là giá trị sai không thể viết ra được; `enforced` nghĩa là có một lint rule báo lỗi; `documented` nghĩa là chỉ có người đọc giữ nó.

| Mã | Tầng | Được giữ bởi | Không được giữ |
|---|---|---|---|
| `CDC-1` | `enforced` | `starci-be/projection-listener-contract`, thông điệp `base` (superclass không phải `AbstractProjectionListener`) và `lifecycle` (một listener cụ thể khai báo `onModuleInit`) | Một listener inject consumer rồi chạy nó từ constructor hoặc từ một method tên khác `onModuleInit` |
| `CDC-2` | `documented` | — | Thông điệp `member` của `projection-listener-contract` chỉ báo THIẾU `groupId` hay `topics`; nó không bao giờ đọc giá trị của chúng, nên `groupId = randomUUID()` và một danh sách topic dựng từ wildcard đều lọt |
| `CDC-3` | `documented` | — | Cũng thông điệp `member` đó báo thiếu `deriveTargets` hay `recomputeTarget`; nó không nhìn vào thân của cái nào cả, nên một lệnh ghi repository trong `deriveTargets` vẫn lọt |
| `CDC-4` | `documented` | — | Không gì đọc câu SQL hay lời gọi service; với một linter thì `increment(...)` và `recompute(...)` là hai định danh hợp lệ như nhau |
| `CDC-5` | `documented` | — | Chỗ bỏ qua nằm trong base dùng chung, nên chừng nào còn dùng base thì không rule nào cần bắn; một listener tự viết lại phần bóc tách sẽ bị `CDC-1` bắt, không phải bị một rule về tombstone bắt |
| `CDC-6` | `documented` | — | Giống `CDC-5`: cô lập lỗi là thuộc tính của `handleMessage` trong base, không phải của bất kỳ listener cụ thể nào mà một rule có thể soi |
| `CDC-7` | `documented` | — | Không rule nào nối một listener với bài test chạy nó; một projection không có E2E vận hành trông không khác gì một projection có E2E nằm ở file khác |

Sáu trên bảy dòng ghi `documented`, và đó là cách đọc trung thực chứ không phải một lỗ hổng cần che đi. Hai trong sáu (`CDC-5`, `CDC-6`) mang nhãn `documented` vì một lý do chính đáng: hành vi đã được gom vào base class, nên phát biểu cưỡng chế được về chúng chính là `CDC-1`. Bốn mã còn lại là phần việc chưa ai giữ. Đặc biệt lưu ý rằng cái check duy nhất được `enforced` mỏng hơn tên gọi của nó: thông điệp `member` chỉ báo SỰ CÓ MẶT, nên một `groupId` bị đổi thành một giá trị ngẫu nhiên vẫn lọt qua.

## Điểm neo

Một luật không chỉ tay được vào code thật thì chỉ là một đề xuất. Mỗi mã đều nêu tên đoạn source có thể đọc ngay hôm nay và đúng thứ cần đọc để tìm.

| Mã | Điểm neo | Cần tìm gì |
|---|---|---|
| `CDC-1` | `src/modules/platform/projection/abstract-projection.listener.ts` | Đúng một `onModuleInit` gọi `ensureTopics`, `createConsumer`, `subscribe` và `run`; rồi kiểm rằng cả 17 file khớp `src/modules/**/*projection.listener.ts` đều không khai báo vòng đời riêng nào |
| `CDC-2` | `src/modules/bussiness/projections/user-xp/user-xp-projection.listener.ts` | `groupId = "user-xp-projection"` là một chuỗi hằng, và `topics` dựng từ `envConfig().kafka.cdcTopicPrefix` cộng với tên bảng tường minh — prefix gắn theo môi trường, tập bảng thì không |
| `CDC-2` | `src/tests/helpers/projection-cdc-world.ts` | `PROGRESS_GROUP` / `USER_XP_GROUP` lặp lại đúng group id của production dưới dạng hằng; một group mà test gọi tên được từ ngoài tiến trình là một group sống sót qua restart |
| `CDC-3` | `src/modules/bussiness/projections/progress/progress-projection.listener.ts` | `deriveTarget` phân nhánh theo `topic.endsWith(...)` và trả về `{ userId, courseId }` hoặc `null`; `recomputeTarget` chứa đúng một lời gọi tới projection service và không gì khác |
| `CDC-4` | `src/modules/bussiness/projections/user-xp/user-xp-projection.service.ts` | `recompute` nhận một user id và không nhận amount; câu SQL select `SUM(x.amount)` từ ledger và kết bằng `ON CONFLICT (user_id) DO UPDATE SET value = EXCLUDED.value` |
| `CDC-5` | `src/modules/platform/projection/abstract-projection.listener.ts` | `unwrapRow` trả về `null` khi `after` có mặt nhưng rỗng, và `handleMessage` thoát sớm khi `row === null` cũng như khi thiếu `message.value` |
| `CDC-6` | `src/modules/platform/projection/abstract-projection.listener.ts` | Cái `catch` trong `handleMessage` dựng một CDC exception có kiểu, log nó kèm `groupId` và `topic`, và không ném lại |
| `CDC-7` | `src/tests/e2e/projection-cdc-routing.e2e-spec.ts` | `world.publishChange(...)` rồi tới `until(...)` poll bảng projection — bước arrange ghi dòng nguồn, bước act chỉ chạm vào broker |

Mọi mã đều đã có điểm neo. Không mã nào còn chưa neo được ở phiên bản này.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| bảng nguồn | Mọi bảng mà thay đổi của nó có thể làm projection sai, nêu tên đủ |
| danh tính target | Khoá mà projection được lưu theo, và cách một dòng phân giải ra khoá đó |
| câu recompute | Câu query có thẩm quyền dựng lại một target từ các dòng nguồn |
| việc giao tin | Consumer group id, và projection đã được chứng minh qua broker hay chưa |
| việc xoá | Cái gì sửa chữa projection khi một dòng nguồn biến mất |

## Quy tắc

1. Xử lý cùng một dòng thay đổi hai lần phải ra cùng một projection.
2. Base class sở hữu kết nối, subscribe, parse và cô lập lỗi.
3. `groupId` là một hằng số, không phải giá trị tính ra lúc khởi động.
4. Danh sách topic là tập nguồn làm mất hiệu lực đầy đủ; một nguồn không được liệt kê nghĩa là projection cũ, chứ không phải projection chậm.
5. `deriveTargets` chỉ trả về danh tính và không gây side effect nghiệp vụ.
6. Projection được ghi bằng UPSERT từ dòng nguồn, không bao giờ bằng cách áp delta của event.
7. Payload không có ảnh hiện tại thì không sinh ra lệnh ghi nào.
8. Một message lỗi ảnh hưởng đúng một message.
9. Một tuyên bố về CDC phải được chứng minh qua broker, hoặc nó không phải tuyên bố về CDC.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp dụng vào.

- **Boot best-effort (`CDC-1`).** Subscribe thất bại lúc khởi động thì log rồi nuốt, không làm sập tiến trình — broker chết không được kéo API chết theo. Đây là ngoại lệ về TÍNH SẴN SÀNG, không phải về quyền sở hữu: chỗ nuốt nằm trong base, listener cụ thể vẫn không được có vòng đời riêng.
- **Đọc trong `deriveTargets` (`CDC-3`).** Phân giải cha — bài nộp → milestone, nội dung → khoá học — là thao tác đọc và được phép, vì ánh xạ một dòng sang danh tính đôi khi cần đi qua đồ thị quan hệ. Ghi trong `deriveTargets` thì không bao giờ được phép; phép thử là replay có lặp lại hiệu ứng không.
- **Trả về mảng rỗng (`CDC-3`, `CDC-5`).** `[]` là câu trả lời đúng cho một cột đổi không liên quan, một cha không phân giải được, hoặc một lệnh xoá. Bỏ qua là quyết định code có quyền đưa ra; bịa ra một target để tránh trả về rỗng thì không.
- **Projection thật sự cần xử lý xoá (`CDC-5`).** Tiêu thụ một nguồn còn giữ lại danh tính, hoặc một deletion stream dựng riêng. Đọc key của tombstone rồi coi sự vắng mặt là số 0 bị từ chối kể cả khi số 0 đó tình cờ đúng ở thời điểm hiện tại.
- **Unit test cho mapping (`CDC-7`).** Gọi thẳng `deriveTargets` là một bài test hợp lệ cho code ánh xạ. Nó chỉ bị từ chối khi được dùng làm BẰNG CHỨNG CDC — một E2E vận hành qua broker vẫn còn nợ, bất kể đã có bao nhiêu unit test ánh xạ.

## Đầu ra

Mỗi file mà shape đã duyệt sinh ra thì một khối.

```text
projection: <projection name>
sources: <tables that can invalidate it>
groupId: <stable consumer group>
target: <identity a row resolves to>
recompute: <authoritative query, upsert key>
situation: <CDC-1 | CDC-2 | CDC-3 | CDC-4 | CDC-5 | CDC-6 | CDC-7>
reason: <the replay fact that decides it>
```

## Ví dụ đã giải

Shape đã duyệt: một màn hình hồ sơ hiển thị tổng điểm của học viên, và bảng ledger điểm là nguồn sự thật cho tổng đó.

```text
projection: user points total
sources: points ledger table
groupId: user-xp-projection
target: one row per user id
recompute: delegated to the projection service; listener holds routing only
situation: CDC-3
reason: the listener maps a ledger row to a user id and calls one service method; replaying 10,000 ledger rows produces no effect outside the projection, which is what excludes CDC-4 — nothing in this file computes a value
```

```text
projection: user points total
sources: points ledger table
groupId: user-xp-projection
target: one row per user id
recompute: SUM over the ledger for that user id, UPSERT on the user id key
situation: CDC-4
reason: recompute takes a user id and no amount, so a duplicated delivery cannot double the total and a lost delivery heals on the next ledger change; that is the fact excluding CDC-3, because this file computes rather than routes
```

```text
projection: user points total
sources: points ledger table
groupId: user-xp-projection
target: one row per user id
recompute: proved end to end, not called directly
situation: CDC-7
reason: the arrange step writes ledger rows and the act step touches only the broker, so a wrong groupId or a missing topic turns this red; that is what excludes CDC-2 as sufficient evidence — CDC-2 is a declaration, this is the only place it is measured
```

Shape đã duyệt nói rằng một màn hình hiển thị một tổng và tổng ấy lấy từ đâu. Nó không nói consumer group id, không nói prefix topic, không nói recompute là upsert hay increment, không nói chuyện gì xảy ra khi một dòng ledger bị xoá, cũng không nói đã có E2E vận hành hay chưa — và do đó nó không giải quyết cái nào trong năm thứ đó. Năm thứ ấy được chốt ở đây, theo mã, và riêng trường hợp xoá vẫn còn để ngỏ cho tới khi nêu được tên một nguồn còn giữ lại hoặc một deletion stream.

## Phạm vi

Quy tắc này đúng cho mọi service trong stack này có chiếu những dòng đã commit vào read model. Nó không nêu tên một tính năng cụ thể nào: mọi ví dụ đều là TypeScript thông thường trong một class dáng NestJS, và không cần tới tên sản phẩm, thương hiệu hay module riêng nào để hiểu được. Bảng `## Điểm neo` là ngoại lệ duy nhất, và cố ý như vậy: nó trích dẫn đường dẫn source thật trong repository mà trust tree này quản, bởi vì một luật không ai đối chiếu được với code đang chạy thì chỉ là một đề xuất.

MỘT ĐỊNH DANH ĐÃ SHIP KHÔNG PHẢI LÀ TÊN SẢN PHẨM THEO NGHĨA NÀY. Một rule được trích dẫn bằng đúng tên đã công bố của nó, kể cả prefix plugin, vì đó chính là chuỗi ký tự mà build log in ra và comment disable mang theo. Một trích dẫn không dán được vào ô tìm kiếm thì không phải trích dẫn. Điều mà lệnh cấm bên trên cấm là VĂN XUÔI và VÍ DỤ cần tới một sản phẩm mới hiểu được — chứ không bao giờ cấm một định danh mà ai đó sẽ đọc thấy trong một lỗi và phải đi tra.
