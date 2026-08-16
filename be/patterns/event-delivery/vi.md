---
id: be-patterns-event-delivery-vi
title: vi.md
slug: /be/patterns/event-delivery/vi
sidebar_label: vi.md
sidebar_position: 1
description: Từng tình huống DELIVERY-N, nhận diện bằng hậu quả nghiệp vụ chứ không bằng transport.
---

# vi.md

> Version: `2.00` · Module: `event-delivery`

# Event delivery

Event delivery là việc mang **một sự thật đã được quyết xong** từ một instance đến mọi instance khác
cần phản ứng tại chỗ. Envelope cho biết **ai phát** và **đây là lần giao nào**; payload cho biết **sự
thật là gì**. Broker chỉ là đường vận chuyển. Ranh giới thực sự nằm ở chỗ event emitter trong process
biến sự thật đó thành **hậu quả**.

Câu hỏi phân định duy nhất không phải "đi bằng transport nào" mà là:

> Cùng một envelope quay lại đúng nơi phát ra, hoặc đến hai lần, thì hậu quả có xảy ra hai lần không?

Một event xuyên instance chỉ an toàn khi **cả hai** câu trả lời đều là không. Chỉ một câu trả lời
"có" cũng không phải là log hơi ồn — đó là hậu quả chạy hai lần: một notification thứ hai, một lần
trừ tiền thứ hai, hoặc một dòng ghi thứ hai.

**Đây là luật bắt buộc.** Mọi event rời khỏi process đều thuộc đúng một mã dưới đây, và event cố ý
**không** rời khỏi process cũng vậy. Không có event nào nhỏ đến mức được miễn: heartbeat vẫn phải
khai transport vì cùng lý do như event thanh toán. Bản khai là thứ người đọc kiểm tra; một sự thật
không có bản khai là sự thật không ai chứng minh được là sai.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Đòi hỏi cốt lõi |
|---|---|---|
| `DELIVERY-1` | Envelope rời process, cần biết ai phát và có phải bản sao không | `id` người phát + `digest` nội dung |
| `DELIVERY-2` | Một event cần tới ai: chỉ process này, hay mọi process đang giữ kết nối | Khai `useLocal` và `useNats` trong config chung |
| `DELIVERY-3` | Envelope quay về đúng pod đã phát ra nó | So `parsed.id` với id instance, **trước** khi emit |
| `DELIVERY-4` | Broker giao lại lần hai vì mạng chớp | Đọc và ghi digest **trước** khi emit |
| `DELIVERY-5` | Chứng minh realtime đúng | Khẳng định **ai nhận được gì**, không đếm listener |
| `DELIVERY-6` | Chứng minh fan-out xuyên instance | Hai instance thật trên broker thật |

---

## `DELIVERY-1` — envelope phải tự khai người phát và bản sao

**Tình huống.** Một sự thật đã quyết xong sắp rời khỏi process. Đến đầu bên kia, người nhận phải trả
lời được hai câu mà payload **không** trả lời được: *ai phát ra cái này?* và *tôi đã xử lý đúng nội
dung này chưa?* Hai câu đó là việc của envelope.

**Dấu hiệu nhận biết**

- Có code muốn suy ra người phát từ **subject**, từ connection, hoặc từ thứ tự nhận.
- Payload không có trường nào ổn định để làm khoá chống trùng.
- Có người nói "broker đảm bảo đúng một lần" mà không chỉ ra được cấu hình nào nói thế.

**Tự hỏi.** Nếu đúng envelope này đến hai lần từ hai đường khác nhau, tôi lấy gì để nhận ra chúng là
một?

**Ranh giới**

- ↔ `DELIVERY-3`: `DELIVERY-1` là **có** danh tính người phát trong envelope; `DELIVERY-3` là **dùng**
  danh tính đó đúng lúc. Không có cái thứ nhất thì cái thứ hai không thể đúng.
- ↔ `DELIVERY-4`: `DELIVERY-1` sinh ra digest; `DELIVERY-4` quyết định giành digest ở đâu trong dòng
  chảy.

**Tình huống nghiệp vụ hay gặp.** Tin nhắn mới trong một cuộc hội thoại · trạng thái job nền đổi ·
tiến độ một bài nộp · snapshot sức khoẻ của một nhà cung cấp bên ngoài · thông báo cho một người
nhận · heartbeat giữ kết nối (trường hợp duy nhất được bỏ digest).

---

## `DELIVERY-2` — transport là một phần của hợp đồng event

**Tình huống.** Cùng một sự thật, hai nhu cầu khác nhau: có sự thật chỉ cần code trong **chính
process này** phản ứng; có sự thật cần tới các socket đang cắm vào **pod khác**. Quyết định đó thuộc
về định nghĩa của event, không thuộc về nơi gọi.

**Dấu hiệu nhận biết**

- Nơi gọi truyền option transport để "lần này thì gửi qua broker".
- Một entry trong config thiếu một trong hai cờ và người đọc phải đoán.
- Một event realtime chỉ chạy đúng khi hệ thống có đúng một instance, và không chỗ nào ghi lại điều
  đó.

**Tự hỏi.** Ai phải phản ứng với sự thật này — chỉ process đã quyết ra nó, hay mọi process đang giữ
một kết nối tới người dùng?

**Ranh giới**

- ↔ `DELIVERY-1`: `DELIVERY-2` quyết **có đi hay không**; `DELIVERY-1` quyết **đi thì mang theo gì**.
- ↔ `DELIVERY-6`: khai `useNats: true` là một lời hứa; `DELIVERY-6` là chỗ lời hứa đó bị bắt phải
  chứng minh.

**Tình huống nghiệp vụ hay gặp.** Chat nhiều pod (cả hai cờ) · trạng thái job cho worker (chỉ broker)
· heartbeat nội bộ (chỉ local) · reaction và comment còn đang single-instance (local, kèm ghi chú
điều kiện lật cờ) · snapshot health mà mỗi pod tự phát lại cho client của mình.

---

## `DELIVERY-3` — bỏ envelope của chính mình trước khi emit

**Tình huống.** Pod A phát một event vừa local vừa qua broker. Broker giao lại cho **mọi** subscriber,
kể cả A. Nếu A không nhận ra envelope đó là của mình, A emit local lần thứ hai và hậu quả xảy ra hai
lần trên đúng cái pod đã tạo ra nó.

**Dấu hiệu nhận biết**

- Bug chỉ xuất hiện ở người dùng đang cắm vào **chính pod vừa ghi dữ liệu**.
- Có so sánh giữa `subject` và id instance — so sánh này **không bao giờ** khớp, nên nó im lặng và
  trông như đang hoạt động.
- Guard tồn tại nhưng nằm **sau** lời gọi emit.

**Tự hỏi.** Danh tính người phát trong đoạn code này đến từ envelope, hay đến từ tên event?

**Ranh giới**

- ↔ `DELIVERY-4`: `DELIVERY-3` chặn **bản sao vọng về của chính mình**; `DELIVERY-4` chặn **bản sao
  do broker giao lại**. Bỏ một trong hai là hở một đường riêng biệt.
- ↔ `DELIVERY-2`: nếu event chỉ local thì không có envelope nào để bỏ. Mã này chỉ nói về nhánh có
  broker.

**Tình huống nghiệp vụ hay gặp.** Tin nhắn hiện hai lần với người vừa gửi · thông báo đẩy nhân đôi
cho người cắm vào pod ghi · progress bar nhảy hai nấc trên đúng pod chạy worker.

---

## `DELIVERY-4` — giành digest trước khi emit

**Tình huống.** Broker giao lại. Mạng chớp, consumer nối lại, cùng một envelope đến lần thứ hai. Nếu
digest chỉ được ghi **sau** khi emit, hai bản sao chạy song song đều đọc thấy "chưa có" và **cả hai**
đều đi qua ranh giới nghiệp vụ.

**Dấu hiệu nhận biết**

- Thứ tự trong code là: emit rồi mới `set` digest.
- Việc chống trùng nằm trong listener chứ không nằm ở bridge.
- Có câu "thực tế nó không giao lại đâu" thay cho một cấu hình chứng minh điều đó.

**Tự hỏi.** Giữa lúc đọc digest và lúc ghi digest, có lời gọi nào tạo ra hậu quả nghiệp vụ không?

**Ranh giới**

- ↔ `DELIVERY-3`: xem trên.
- ↔ `DELIVERY-1`: nếu envelope không có digest thì mã này không có gì để giành — lỗi khi đó nằm ở
  `DELIVERY-1`, và sửa ở đây là sửa nhầm chỗ.

**Tình huống nghiệp vụ hay gặp.** Consumer nối lại sau khi mất kết nối · nhiều consumer trong cùng
một queue group · redeliver do ack trễ · event phát lại khi worker khởi động lại giữa chừng.

---

## `DELIVERY-5` — khẳng định người nhận và nội dung, không đếm listener

**Tình huống.** Đang cần chứng minh một chuyện realtime là **đúng**. Đúng ở đây là: **đúng người**
nhận được **đúng sự thật**, và người không liên quan **không** nhận được gì. Số listener không nói
được điều nào trong ba điều đó.

**Dấu hiệu nhận biết**

- Assertion là một con số: bao nhiêu listener, bao nhiêu message, bao nhiêu socket.
- Test đỏ lên khi thêm một pod hoặc thêm một subscriber, dù nghiệp vụ không đổi.
- Test xanh trong khi sự thật được giao cho **nhầm người** — vì con số vẫn đúng.

**Tự hỏi.** Nếu ngày mai hạ tầng thêm một subscriber nữa mà nghiệp vụ không đổi, assertion này có đỏ
không? Nếu có, nó đang đo hạ tầng.

**Ranh giới**

- ↔ `DELIVERY-6`: `DELIVERY-5` nói **assert cái gì**; `DELIVERY-6` nói **chạy trên bao nhiêu
  instance**. Một test có thể đúng mã này mà vẫn sai mã kia.
- **Ngoại lệ đã đóng**: đếm số envelope quan sát được ở transport là hợp lệ khi con số đó dùng để
  **đồng bộ** — chờ cho tiếng vọng chắc chắn đã tới — chứ không phải để làm assertion cuối.

**Tình huống nghiệp vụ hay gặp.** Notification chỉ tới đúng người nhận · tin nhắn chỉ tới đúng phòng
· tiến độ chỉ tới đúng người nộp bài · một người không có quyền thì không nhận được gì.

---

## `DELIVERY-6` — chứng minh bằng hai instance thật

**Tình huống.** Hợp đồng cần chứng minh là: phát **một** lần ở A thì B nhận **đúng một** lần, và A
**không** tự vọng lại. Không có mệnh đề nào trong câu đó tồn tại bên trong một process duy nhất.

**Dấu hiệu nhận biết**

- Test gọi thẳng event emitter local rồi kết luận về fan-out.
- Broker bị mock, nên self-echo không bao giờ xảy ra và guard chưa từng bị thử.
- Chỉ có một app được boot, và "instance thứ hai" là một biến.

**Tự hỏi.** Nếu tôi xoá guard self-origin đi, test này có đỏ không? Nếu không đỏ, nó chưa chứng minh
được gì về mã `DELIVERY-3`.

**Ranh giới**

- ↔ `DELIVERY-5`: xem trên.
- **Ngoại lệ đã đóng**: hai instance được phép boot một module graph thu gọn và thay hạ tầng **không
  phải chủ đề** (retry, log, cache digest), miễn là publisher, factory envelope, bridge và broker vẫn
  là bản production.

**Tình huống nghiệp vụ hay gặp.** Chat xuyên pod · thông báo tới người đang cắm vào pod khác · trạng
thái job do worker ở pod khác cập nhật · snapshot health phát lại trên mọi pod.

---

## Luật

1. Envelope mang danh tính người phát và digest; subject **không** mang cả hai.
2. Transport được khai theo **event**, trong một config, không chọn ở nơi gọi.
3. Bỏ envelope của chính mình **trước** khi emit local.
4. Giành digest **trước** khi emit local.
5. Một sự thật gây ra **nhiều nhất một** hậu quả trên mỗi instance.
6. Tính đúng đắn phát biểu bằng **người nhận và nội dung**, không bằng topology.
7. Fan-out xuyên instance chỉ được coi là đã chứng minh khi có nhiều hơn một instance thật.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Heartbeat không digest.** `DELIVERY-1` cho phép bỏ digest khi message không mang sự thật nghiệp
  vụ nào và chỉ tồn tại để giữ đồng hồ idle của consumer. Nó vẫn mang id người phát, và vẫn bị bỏ
  qua trước mọi xử lý nghiệp vụ.
- **Event chỉ trong process.** `DELIVERY-2` được thoả bằng `useNats: false` khi code phản ứng chạy
  cùng process với code quyết định. Mã này từ chối **cờ vắng mặt**, không từ chối cờ bằng `false`.
- **Realtime single-instance có chủ ý.** `DELIVERY-2` chấp nhận một event tạm thời chỉ local, với
  điều kiện config ghi rõ khi nào thì lật cờ. Một khoảng im lặng không phải là bản ghi đó.
- **Phát lại trên mọi instance.** `DELIVERY-3` bỏ envelope của chính mình, **không** bỏ lần emit
  local lúc publish. Event vừa local vừa broker sẽ emit một lần ở nơi phát và một lần trên **mỗi**
  instance khác — đúng một hậu quả mỗi instance, đó chính là luật.
- **Phạm vi cache digest.** `DELIVERY-4` được thoả bằng một claim **cục bộ trong process**. Một
  claim dùng chung toàn cụm sẽ triệt tiêu delivery trên mọi instance trừ instance đầu tiên, tức là
  ngược hẳn với fan-out.
- **Đếm message ở transport.** `DELIVERY-5` cho phép đếm envelope quan sát ở transport khi con số đó
  là **điểm đồng bộ**, không phải assertion.
- **Module graph thu gọn.** `DELIVERY-6` cho phép hai instance boot graph rút gọn, miễn là đường đi
  của sự thật vẫn là đường production.
