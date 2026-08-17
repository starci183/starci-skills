---
title: Event-delivery · Vietnamese
---

# Giao phát sự kiện

Đầu vào của pattern này là một shape đã duyệt: một quyết định đã chốt, phát biểu thành một sự thật mà
đâu đó có code phải phản ứng. Câu hỏi thiết kế — sự thật này có đáng không, ai quan tâm tới nó, nó
nghĩa là gì — đã đóng lại trước khi pattern này được đọc. Đầu ra là kiến trúc source: file nào dựng
envelope, file nào khai transport, file nào bỏ bản sao của chính mình và giành digest, file test nào
chứng minh, và các câu lệnh bên trong những file đó phải đứng theo thứ tự nào.

## Luật

Event delivery là việc mang **một sự thật đã được quyết xong** từ một instance đến mọi instance khác
cần phản ứng tại chỗ. Envelope cho biết ai phát và đây là lần giao nào; payload cho biết sự thật là
gì. Broker chỉ là đường vận chuyển; ranh giới fan-out thực sự vẫn nằm ở event emitter trong process,
nơi sự thật biến thành hậu quả cục bộ.

Câu hỏi phân định mọi trường hợp không phải "đi bằng transport nào" mà là chuyện gì xảy ra ở lần đến
thứ hai: **cùng một envelope quay lại đúng nơi phát ra, hoặc đến hai lần, thì hậu quả có xảy ra hai
lần không?** Một event xuyên instance chỉ an toàn khi cả hai câu trả lời đều là không. Chỉ một câu
"có" thôi cũng không phải là event chậm hay log hơi ồn — đó là hậu quả chạy hai lần, mà hậu quả chạy
hai lần nghĩa là một lần trừ tiền thứ hai, một notification thứ hai, một dòng ghi thứ hai.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi event rời khỏi process đều thuộc đúng một mã
dưới đây, và event cố ý không rời khỏi process cũng vậy. Không có event nào nhỏ đến mức được miễn:
heartbeat vẫn phải khai transport vì đúng lý do như một sự thật thanh toán, bởi bản khai chính là thứ
người đọc kiểm tra, và một sự thật không có bản khai là sự thật không ai chứng minh được là sai.

Chỉ hai trong sáu mã là có một rule đứng sau, và cả hai đều sống ở đúng một ranh giới file. Bảng Tầng
giữ bên dưới nói rõ mã nào là mã nào, vì một bộ luật ngụ ý rằng nó được canh đều tay trong khi thực
tế không phải vậy sẽ dạy người đọc tin vào một cái gate chưa từng nhìn tới.

## Mã tình huống

Mọi tình huống module này chi phối đều mang một mã, `DELIVERY-<n>`. Các con số là CỐ ĐỊNH: chúng được
trích dẫn từ các luật anh em và từ các bản ghi task cũ, nên đánh số lại là lặng lẽ làm hỏng một trích
dẫn ai đó đã đặt ra rồi.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `DELIVERY-1` | Envelope rời process, người nhận cần biết ai phát và đây có phải bản sao không | Envelope transport mang danh tính người phát và digest nội dung đi kèm payload. Nó không bao giờ suy ra người phát từ subject, từ connection hay từ thứ tự nhận, và không bao giờ publish một payload không có khoá chống trùng ổn định |
| `DELIVERY-2` | Một event cần tới ai: chỉ process này, hay mọi process đang giữ kết nối | Mọi event khai `useLocal` và `useNats` trong config event chung. Transport không bao giờ được suy ra ở nơi gọi, và không bao giờ để thiếu một cờ cho người đọc phải đoán |
| `DELIVERY-3` | Envelope quay về đúng instance đã phát ra nó | Bridge so danh tính người phát trong envelope đã parse với id của chính instance này và bỏ bản trùng **trước** khi emit local. Nó không so subject với id instance, không lọc self-origin sau khi emit, và không bỏ qua kiểm tra vì "người phát sẽ không nhận lại message của mình" |
| `DELIVERY-4` | Broker giao lại cùng một envelope lần thứ hai | Digest được đọc và ghi trước khi emit local. Digest không bao giờ được ghi sau emit, việc chống trùng không bao giờ nằm trong listener, và "thực tế thì nhiều nhất một lần" không bao giờ được coi là bảo đảm |
| `DELIVERY-5` | Cần chứng minh realtime là đúng | Một consumer test khẳng định **ai** nhận được **sự thật nào**, và người không liên quan **không** nhận được gì. Nó không khẳng định số listener, số message, hay số socket đang kết nối |
| `DELIVERY-6` | Cần chứng minh fan-out xuyên instance | Hành vi xuyên instance được chứng minh bằng hai instance thật trên broker thật, phát đúng một lần. Broker không bị mock, emitter local không bị gọi thẳng, và fan-out không bao giờ được chứng minh từ một instance duy nhất |

Sáu mã, và dừng ở sáu. Một tình huống thật sự không có mã là một thay đổi luật được ghi lại, không
phải con số thứ bảy thêm vào cho tiện.

## Đọc một shape đã duyệt

1. Đọc xem shape nói gì: sự thật đã quyết xong, và payload diễn đạt nó mà không còn nhánh nào phải rẽ.
2. Đọc xem shape **không** nói gì, và chấp nhận rằng ở đó nó không giải quyết gì cả. Một shape đã
   duyệt không nói cặp cờ transport, không nói danh tính người phát lấy từ đâu, không nói digest được
   giành ở điểm nào so với emit, cũng không nói bằng chứng chạy trên bao nhiêu instance. Đó là đầu ra
   của pattern này, không phải của shape.
3. Giải quyết từ ngoài vào trong: transport trước envelope, envelope trước thứ tự trong bridge, thứ
   tự trong bridge trước bằng chứng. Việc event khai gì trong config mới quyết định có envelope hay
   không; không có envelope thì bridge chẳng có gì để so hay để giành.
4. Hỏi lần lượt câu hỏi của từng mã. `DELIVERY-1`: nếu đúng envelope này đến hai lần từ hai đường
   khác nhau, tôi lấy gì để nhận ra chúng là một? `DELIVERY-2`: ai phải phản ứng với sự thật này —
   chỉ process đã quyết ra nó, hay mọi process đang giữ một kết nối tới người dùng? `DELIVERY-3`:
   danh tính người phát trong đoạn code này đến từ envelope, hay đến từ tên event? `DELIVERY-4`: giữa
   lúc đọc digest và lúc ghi digest, có lời gọi nào tạo ra hậu quả nghiệp vụ không? `DELIVERY-5`: nếu
   ngày mai hạ tầng thêm một subscriber nữa mà nghiệp vụ không đổi, assertion này có đỏ không?
   `DELIVERY-6`: nếu tôi xoá guard self-origin đi, test này có đỏ không?
5. Khi hai mã cùng khớp, chúng không tranh nhau — chúng là hai file. `DELIVERY-1` sinh ra digest còn
   `DELIVERY-4` quyết giành nó ở đâu; `DELIVERY-2` quyết event có đi hay không còn `DELIVERY-1` quyết
   khi đi thì mang theo gì; `DELIVERY-5` nói assert cái gì còn `DELIVERY-6` nói chạy trên bao nhiêu
   instance. Hãy phát một khối đầu ra cho mỗi mã, mỗi khối nêu rõ sự thật loại trừ mã liền kề. Chỉ
   khi hai mã cùng đặt đúng một câu lệnh vào đúng một file thì mã ở ngoài hơn mới thắng.

## `DELIVERY-1` — envelope phải tự khai người phát và bản sao

**Tình huống.** Một sự thật đã quyết xong sắp rời khỏi process. Đến đầu bên kia, người nhận phải trả
lời được hai câu mà payload không trả lời được: *ai phát ra cái này?* và *tôi đã xử lý đúng nội dung
này chưa?* Hai câu đó là việc của envelope.

**Nó sinh ra gì trong source.** Một envelope factory dựng message với `id` lấy từ instance service và
`digest` băm từ payload, không bao giờ từ subject; kèm một kiểu envelope khai đúng nghĩa vụ đó, nơi
việc `digest` là tuỳ chọn nhìn thấy được ngay trong interface.

**Dấu hiệu nhận biết.** Có code muốn suy ra người phát từ **subject**, từ connection, hoặc từ thứ tự
nhận. Payload không có trường nào ổn định để làm khoá chống trùng. Có người nói "broker đảm bảo đúng
một lần" mà không chỉ ra được cấu hình nào nói thế.

**Ranh giới.** Không phải `DELIVERY-3`: mã này là **có** danh tính người phát trong envelope, còn
`DELIVERY-3` là **dùng** danh tính đó đúng lúc — không có cái thứ nhất thì cái thứ hai không thể
đúng. Không phải `DELIVERY-4`: mã này sinh ra digest, còn `DELIVERY-4` quyết định giành digest ở đâu
trong dòng chảy.

**Tình huống nghiệp vụ hay gặp.** Tin nhắn mới trong một cuộc hội thoại · trạng thái job nền đổi ·
tiến độ một bài nộp · snapshot sức khoẻ của một nhà cung cấp bên ngoài · thông báo cho một người nhận
· heartbeat giữ kết nối, trường hợp duy nhất được bỏ digest.

## `DELIVERY-2` — transport là một phần của hợp đồng event

**Tình huống.** Cùng một sự thật nhưng hai nhu cầu khác nhau: có sự thật chỉ cần code trong **chính
process này** phản ứng; có sự thật cần tới các socket đang cắm vào **pod khác**. Quyết định đó thuộc
về định nghĩa của event, không thuộc về nơi gọi.

**Nó sinh ra gì trong source.** Một config event chung, trong đó mọi entry đều khai cả `useLocal` lẫn
`useNats`, vài entry kèm comment nêu rõ vì sao một cờ vẫn còn `false`; và một emitter đọc đúng hai cờ
đó để chọn nhánh, nên config là hợp đồng chứ không phải gợi ý.

**Dấu hiệu nhận biết.** Nơi gọi truyền option transport để "lần này thì gửi qua broker". Một entry
trong config thiếu một trong hai cờ và người đọc phải đoán. Một event realtime chỉ chạy đúng khi hệ
thống có đúng một instance, và không chỗ nào ghi lại điều đó.

**Ranh giới.** Không phải `DELIVERY-1`: mã này quyết **có đi hay không**, còn `DELIVERY-1` quyết **đi
thì mang theo gì**. Không phải `DELIVERY-6`: khai `useNats: true` là một lời hứa, còn `DELIVERY-6` là
chỗ lời hứa đó bị bắt phải chứng minh.

**Tình huống nghiệp vụ hay gặp.** Chat nhiều pod, cả hai cờ · trạng thái job cho worker, chỉ broker ·
heartbeat nội bộ, chỉ local · reaction và comment còn đang single-instance, local kèm ghi chú điều
kiện lật cờ · snapshot health mà mỗi pod tự phát lại cho client của mình.

## `DELIVERY-3` — bỏ envelope của chính mình trước khi emit

**Tình huống.** Pod A phát một event vừa local vừa qua broker. Broker giao lại cho **mọi** subscriber,
kể cả A. Nếu A không nhận ra envelope đó là của mình, A emit local lần thứ hai và hậu quả xảy ra hai
lần trên đúng cái pod đã tạo ra nó.

**Nó sinh ra gì trong source.** Một guard trong bridge, đặt trên nhánh ping, so `parsed.id` của
envelope đã parse với id instance rồi return khi trùng — nằm trước lời gọi emit, và mang theo comment
ghi lại con bug mà phép so với subject đã gây ra. Rule kiểm tra rằng phép so có tồn tại *và* đứng
trước emit; thứ tự chính là toàn bộ nội dung của mã này.

**Dấu hiệu nhận biết.** Bug chỉ xuất hiện ở người dùng đang cắm vào **chính pod vừa ghi dữ liệu**. Có
so sánh giữa `subject` và id instance — phép so này **không bao giờ** khớp, nên nó im lặng và trông
như đang hoạt động. Guard tồn tại nhưng nằm **sau** lời gọi emit.

**Ranh giới.** Không phải `DELIVERY-4`: mã này chặn **bản sao vọng về của chính mình**, còn
`DELIVERY-4` chặn **bản sao do broker giao lại**; bỏ một trong hai là hở một đường riêng biệt. Không
phải `DELIVERY-2`: nếu event chỉ local thì không có envelope nào để bỏ, nên mã này chỉ nói về nhánh
có broker.

**Tình huống nghiệp vụ hay gặp.** Tin nhắn hiện hai lần với người vừa gửi · thông báo đẩy nhân đôi
cho người cắm vào pod ghi · progress bar nhảy hai nấc trên đúng pod chạy worker.

## `DELIVERY-4` — giành digest trước khi emit

**Tình huống.** Broker giao lại. Mạng chớp, consumer nối lại, cùng một envelope đến lần thứ hai. Nếu
digest chỉ được ghi **sau** khi emit, hai bản sao chạy song song đều đọc thấy "chưa có" và **cả hai**
đều đi qua ranh giới nghiệp vụ.

**Nó sinh ra gì trong source.** Một cặp get/set digest trong bridge: đọc digest, ghi digest, rồi mới
emit — ba câu lệnh mà thứ tự chính là bất biến, và cũng là thứ tự mà message thứ hai của rule nhắm
vào.

**Dấu hiệu nhận biết.** Thứ tự trong code là emit rồi mới `set` digest. Việc chống trùng nằm trong
listener chứ không nằm ở bridge. Có câu "thực tế nó không giao lại đâu" thay cho một cấu hình chứng
minh điều đó.

**Ranh giới.** Không phải `DELIVERY-3`: xem trên. Không phải `DELIVERY-1`: nếu envelope không có
digest thì mã này không có gì để giành — lỗi khi đó nằm ở `DELIVERY-1`, và sửa ở đây là sửa nhầm chỗ.

**Tình huống nghiệp vụ hay gặp.** Consumer nối lại sau khi mất kết nối · nhiều consumer trong cùng
một queue group · redeliver do ack trễ · event phát lại khi worker khởi động lại giữa chừng.

## `DELIVERY-5` — khẳng định người nhận và nội dung, không đếm listener

**Tình huống.** Đang cần chứng minh một chuyện realtime là **đúng**. Đúng ở đây là: **đúng người**
nhận được **đúng sự thật**, và người không liên quan **không** nhận được gì. Số listener không nói
được điều nào trong ba điều đó.

**Nó sinh ra gì trong source.** Một consumer e2e test mà assertion gọi tên đúng dòng người nhận và
đúng loại payload, và tiêu đề của chính test khẳng định mệnh đề phủ định: sự thật đó không rò sang
socket khác. Không có assertion nào ở bất kỳ đâu đếm listener.

**Dấu hiệu nhận biết.** Assertion là một con số: bao nhiêu listener, bao nhiêu message, bao nhiêu
socket. Test đỏ lên khi thêm một pod hoặc thêm một subscriber, dù nghiệp vụ không đổi. Test xanh
trong khi sự thật được giao cho **nhầm người**, vì con số vẫn đúng.

**Ranh giới.** Không phải `DELIVERY-6`: mã này nói **assert cái gì**, còn `DELIVERY-6` nói **chạy
trên bao nhiêu instance**. Một test có thể đúng mã này mà vẫn sai mã kia.

**Tình huống nghiệp vụ hay gặp.** Notification chỉ tới đúng người nhận · tin nhắn chỉ tới đúng phòng
· tiến độ chỉ tới đúng người nộp bài · một người không có quyền thì không nhận được gì.

## `DELIVERY-6` — chứng minh bằng hai instance thật

**Tình huống.** Hợp đồng cần chứng minh là: phát **một** lần ở A thì B nhận **đúng một** lần, và A
**không** tự vọng lại. Không có mệnh đề nào trong câu đó tồn tại bên trong một process duy nhất.

**Nó sinh ra gì trong source.** Một e2e test xuyên instance cùng helper dựng thế giới cho nó, boot
hai instance độc lập trên cùng một broker thật, trong đó helper đếm message ở broker để chuyện "đúng
một lần giao" ở nơi phát được chứng minh sau khi tiếng vọng đã tới, chứ không phải trước khi nó kịp
tới.

**Dấu hiệu nhận biết.** Test gọi thẳng event emitter local rồi kết luận về fan-out. Broker bị mock,
nên self-echo không bao giờ xảy ra và guard chưa từng bị thử. Chỉ có một app được boot, và "instance
thứ hai" là một biến.

**Ranh giới.** Không phải `DELIVERY-5`: xem trên. Ngoại lệ đã đóng là hai instance được phép boot một
module graph thu gọn và thay hạ tầng **không phải chủ đề** — retry, log, cache digest — miễn là
publisher, envelope factory, bridge và broker vẫn là bản production.

**Tình huống nghiệp vụ hay gặp.** Chat xuyên pod · thông báo tới người đang cắm vào pod khác · trạng
thái job do worker ở pod khác cập nhật · snapshot health phát lại trên mọi pod.

## Tầng giữ

Tầng nào thực sự giữ từng mã. `unrepresentable` nghĩa là một union đóng hoặc branded type khiến giá
trị sai không viết ra được; `enforced` nghĩa là có một lint rule trong `sources/be/event-delivery.mjs`
bắt được; `documented` nghĩa là không có gì cơ học giữ nó, chỉ có người đọc giữ.

| Mã | Tầng | Cái gì giữ nó |
|---|---|---|
| `DELIVERY-1` | `documented` | — |
| `DELIVERY-2` | `documented` | — |
| `DELIVERY-3` | `enforced` | `nats-bridge-delivery-contract` (export `natsBridgeDeliveryContract`), message `origin` |
| `DELIVERY-4` | `enforced` | `nats-bridge-delivery-contract` (export `natsBridgeDeliveryContract`), message `digest` |
| `DELIVERY-5` | `documented` | — |
| `DELIVERY-6` | `documented` | — |

**Hai mã enforced, bốn mã documented, không mã nào unrepresentable.** Module này publish đúng một
rule; rule đó giữ hai mã vì nó báo hai message riêng biệt, `origin` và `digest`, và mỗi message hỏng
độc lập với message kia. Hai mã cho một rule là con số trung thực ở đây — một rule không tự động là
một mã, và giả vờ ngược lại sẽ nói thiếu đi những gì cái gate thật sự bắt được.

Khoảng trống chính là điểm cần thấy của bảng này chứ không phải khiếm khuyết của nó. Bốn trong số các
mã này là thuộc tính của một quyết định nằm ở nơi khác chứ không nằm ở file mà một rule có thể nhắm
tới: `DELIVERY-1` là thuộc tính của thứ mà factory nhét vào envelope, `DELIVERY-2` là thuộc tính của
một object config không có kiểu nào ép được hình dạng của nó, còn `DELIVERY-5` và `DELIVERY-6` là
thuộc tính của việc test chọn khẳng định điều gì và boot bao nhiêu process. Mọi dòng `documented` đều
được gọi tên lại trong bản ghi audit của module ở phần rủi ro còn mở, kèm theo điều mà một rule sẽ
phải nhìn thấy để giữ được nó — hoặc lý do vì sao không rule nào giữ nổi.

Các dòng enforced được bật ở mức `error`. Cả hai chỉ bắn trên đúng một đường dẫn file, đó là một giới
hạn thật của cái gate và được ghi lại đúng như vậy trong bản ghi audit chứ không giấu sau chữ
`enforced`.

Những tầng phải mù tịt về mối bận tâm này là hai tầng nằm hai bên bridge: code quyết định thì publish
một sự thật và không biết gì về transport, còn listener thì phản ứng với một lần emit local và không
biết gì về danh tính người phát, digest hay chuyện giao lại. Chống trùng nằm trong listener chính là
hình dạng mà pattern này từ chối.

## Điểm neo

Code thật để đối chiếu từng luật. Một luật không chỉ tay vào đâu được thì chỉ là một đề xuất.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `DELIVERY-1` | `src/modules/platform/event/nats/nats-message-factory.service.ts` → `createMessage` · `src/modules/platform/event/nats/types.ts` → `NatsMessage` | Envelope được dựng với `id` lấy từ instance service và `digest` băm từ payload, không bao giờ từ subject. Interface là nơi khai nghĩa vụ của envelope, và là nơi nhìn thấy `digest` đang là tuỳ chọn |
| `DELIVERY-2` | `src/modules/platform/event/config.ts` → `configMap` · `src/modules/platform/event/event-emitter.service.ts` → `emit` | Mọi entry đều khai cả hai cờ, và vài entry kèm comment nêu vì sao một cờ vẫn còn `false`. Emitter đọc đúng hai cờ đó để chọn nhánh, nên config là hợp đồng chứ không phải gợi ý |
| `DELIVERY-3` | `src/modules/platform/event/nats/nats-bridge.service.ts` → guard nằm trên nhánh ping · `sources/be/event-delivery.mjs` → `originIndex > emitIndex` | Guard so `parsed.id` với id instance, và mang comment ghi lại con bug mà phép so với subject đã gây ra. Rule kiểm tra phép so có tồn tại *và* đứng trước emit — thứ tự chính là toàn bộ nội dung của mã |
| `DELIVERY-4` | `src/modules/platform/event/nats/nats-bridge.service.ts` → cặp get/set digest · `sources/be/event-delivery.mjs` → `digestIndex > emitIndex` | Đọc digest, ghi digest, rồi mới emit — ba câu lệnh mà thứ tự là bất biến. Message thứ hai của rule nhắm đúng vào thứ tự đó |
| `DELIVERY-5` | `src/tests/e2e/notification-delivery.e2e-spec.ts` | Assertion gọi tên đúng dòng người nhận và đúng loại payload, và tiêu đề của chính test khẳng định mệnh đề phủ định: sự thật không rò sang socket khác. Không assertion nào ở đâu đếm listener |
| `DELIVERY-6` | `src/tests/e2e/cross-instance-event-routing.e2e-spec.ts` · `src/tests/helpers/nats-cross-instance-world.ts` | Hai instance boot độc lập dùng chung một broker thật; helper đếm message ở broker để "đúng một lần giao" ở nơi phát được chứng minh sau khi tiếng vọng đã tới, chứ không phải trước khi nó kịp tới |

Mọi mã đều đã có neo. Không mã nào ghi "chưa neo được".

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| fact | Quyết định đã chốt, phát biểu thành payload không còn nhánh nào phải rẽ |
| reach | Những instance nào phải phản ứng: chỉ process này, hay mọi process đang giữ kết nối |
| transport | Cặp `useLocal` và `useNats` mà event khai |
| identity | Danh tính người phát trong envelope đến từ đâu |
| idempotency | Digest, và điểm mà nó được giành |
| consequence | Hậu quả cục bộ mà lần emit gây ra, và một bản sao thứ hai của nó tốn cái gì |
| proof | Số instance thật mà hành vi đã được quan sát trên đó |

## Quy tắc

1. Envelope mang danh tính người phát và digest; subject không mang cả hai.
2. Transport được khai theo event, trong một config, không chọn ở nơi gọi.
3. Bỏ envelope của chính mình trước khi emit local, không bao giờ sau đó.
4. Giành digest trước khi emit local, không bao giờ sau đó.
5. Một sự thật gây ra nhiều nhất một hậu quả trên mỗi instance.
6. Tính đúng đắn phát biểu bằng người nhận và nội dung; topology không phải một phần của nó.
7. Fan-out xuyên instance chỉ được coi là đã chứng minh khi có nhiều hơn một instance thật.
8. Mọi event được publish đều thuộc đúng một mã. Không event nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp dụng
vào.

- **Heartbeat không digest.** `DELIVERY-1` cho phép dựng envelope bỏ digest khi message không mang sự
  thật nghiệp vụ nào và chỉ tồn tại để giữ đồng hồ idle của consumer. Nó vẫn được định danh bằng id
  người phát, và vẫn bị bỏ qua trước mọi xử lý nghiệp vụ.
- **Event chỉ trong process.** `DELIVERY-2` được thoả bằng `useNats: false` khi code phản ứng chạy
  cùng process với code quyết định. Mã này từ chối cờ vắng mặt, không từ chối cờ bằng `false`.
- **Realtime single-instance có chủ ý.** `DELIVERY-2` chấp nhận một event mà fan-out của nó tạm thời
  chỉ local, với điều kiện config ghi rõ khi nào thì lật cờ. Một khoảng im lặng không ngày tháng không
  phải là bản ghi đó.
- **Phát lại trên mọi instance.** `DELIVERY-3` bỏ envelope của chính người phát, không bỏ lần emit
  local của chính người phát. Event vừa `useLocal` vừa `useNats` sẽ emit local một lần lúc publish và
  một lần trên **mỗi** instance *khác* — đúng một hậu quả mỗi instance, đó chính là luật chứ không
  phải vi phạm luật.
- **Phạm vi cache digest.** `DELIVERY-4` được thoả bằng một claim cục bộ trong process. Một claim
  dùng chung sẽ triệt tiêu delivery trên mọi instance trừ instance đầu tiên, tức là ngược hẳn với
  fan-out.
- **Đếm message ở transport.** `DELIVERY-5` cho phép đếm envelope quan sát được ở transport khi con
  số đó là điểm đồng bộ chứ không phải assertion — nó xác lập rằng tiếng vọng đã tới, để một assertion
  sau đó về người nhận mới có ý nghĩa.
- **Module graph thu gọn.** `DELIVERY-6` cho phép hai instance boot một module graph rút gọn và thay
  hạ tầng không phải chủ đề, miễn là publisher, envelope factory, bridge và broker vẫn là bản
  production.

## Đầu ra

Một khối cho mỗi file mà shape sinh ra.

```text
event: <event name>
fact: <the decision already taken>
transport: <useLocal | useNats | both>
situation: <DELIVERY-1 … DELIVERY-6>
identity: <where producer id comes from>
idempotency: <digest, and where it is claimed relative to emit>
proof: <the test that observes this on the required number of instances>
reason: <the business fact that excludes the adjacent code>
```

## Ví dụ đã giải

Shape đã duyệt: *một sự thật notification được quyết trên một instance và phải tới đúng người nhận
của nó, bất kể socket của người đó đang cắm ở đâu.*

Câu đó nói ra fact và reach. Nó **không** nói cặp cờ transport, không nói danh tính người phát lấy từ
đâu, không nói digest được giành ở điểm nào so với emit, cũng không nói bằng chứng chạy trên bao
nhiêu instance — nên nó không giải quyết điều nào trong số đó, và mỗi điều bên dưới do một mã chốt
lại chứ không phải do shape.

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-2
identity: n/a at this file
idempotency: n/a at this file
proof: the config entry declares both flags and the emitter branches on exactly them
reason: the recipient's socket may be on another pod, so the reach is not this process only — that
  fact excludes the local-only shape DELIVERY-2 would otherwise permit
```

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-1
identity: id taken from the instance service in the envelope factory
idempotency: digest hashed from the payload, produced here, claimed elsewhere
proof: the envelope type declares id and digest; digest optional is visible in the interface
reason: this file only builds the envelope and never emits, so ordering against emit is not its
  concern — that excludes DELIVERY-4
```

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-3
identity: parsed.id compared with this instance's id in the bridge guard
idempotency: n/a at this statement
proof: the guard sits above the emit call, and the rule reports origin when it does not
reason: this drops the producer's own echo, not a broker redelivery — that excludes DELIVERY-4
```

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-4
identity: n/a at this statement
idempotency: digest read then recorded, both before the local emit, in a process-local claim
proof: the rule reports digest when the set does not precede the emit
reason: the envelope already carries a digest, so the fault surface here is ordering and not
  envelope content — that excludes DELIVERY-1
```

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-5
identity: n/a at this file
idempotency: n/a at this file
proof: a consumer test asserting the recipient row and the payload type, and that an uninvolved
  socket received nothing
reason: the assertion names an actor and a content, not a number — that excludes the listener count
  and stays inside DELIVERY-5 rather than DELIVERY-6
```

```text
event: notification.created
fact: a notification row exists for one recipient
transport: both
situation: DELIVERY-6
identity: production envelope factory on both instances
idempotency: production bridge on both instances
proof: two independently booted instances on a real broker, published once, with broker messages
  counted only as a synchronisation point
reason: the claim under proof is that A does not echo to itself and B receives exactly once, which
  no single process can contain — that excludes DELIVERY-5
```

## Phạm vi

Quy tắc này đúng với bất kỳ back end nào phát tán một sự thật đã quyết ra nhiều hơn một instance đang
chạy. Nó không gọi tên sản phẩm nào, repository nào, module riêng nào, tính năng đơn lẻ nào. Ví dụ
đều là TypeScript bình thường trong một ứng dụng dạng NestJS. Broker chỉ được gọi tên ở chỗ mà ngữ
nghĩa riêng của transport là chủ đề; mọi chỗ khác, luật đúng với bất kỳ broker nào có thể giao lại.
Id của rule là danh từ riêng duy nhất, vì nó là danh tính thực thi và một rule bị đổi tên thì không
trích dẫn được trong config.
