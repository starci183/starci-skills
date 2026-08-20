---
title: Precedents · Vietnamese
---

# Tiền lệ

## LOADS

None.


## Bản ghi

Mô-đun này nhận một yêu cầu nghiệp vụ cùng những phương án layout đã được chấp nhận **của chính source
này**, rồi trả về, với mỗi phương án sắp sinh ra, một tiền lệ mà nó trích dẫn — hoặc một lời khai
rằng nó **cố ý rời khỏi** mọi tiền lệ. Tiền lệ là một quyết định đã được chấp nhận trước đó, được giữ
lại kèm lý do. Nó được **trích dẫn, noi theo và lật lại** — không bao giờ được tuân phục. Luật thì
**ràng buộc**; tiền lệ thì **thuyết phục**. Lẫn hai thứ đó là biến mọi trang mới thành bản sao của
trang gần nhất.

## Luật

Một tiền lệ ghi lại một quyết định **và những gì nó đã thắng**. Chỉ giữ phương án được chọn thì corpus
dạy được "copy cái gì"; chỉ những phương án bị loại mới dạy được "tránh cái gì", và tránh chính là chỗ
layout thôi làm rác.

Tiền lệ thuộc phạm vi **một source**. Mỗi frontend có contract riêng, thành phần riêng, lịch sử riêng,
nên tiền lệ của sản phẩm khác không phải bằng chứng ở đây — nó là quyết định của người lạ đang khoác
thẩm quyền của cây này.

## Mã tình huống

| Mã | Tình huống | Nó phát ra gì |
|---|---|---|
| `PRECEDENT-0` | Không tiền lệ nào phủ được yêu cầu này | sinh từ luật và trục; ghi rõ không tiền lệ nào áp dụng |
| `PRECEDENT-1` | Một tiền lệ khớp về lý do nghiệp vụ | trích dẫn nó; dùng lại bộ trục và các entry nó trích |
| `PRECEDENT-2` | Một tiền lệ khớp một phần; đúng một trục phải khác | trích dẫn, rồi gọi tên trục đổi và vì sao |
| `PRECEDENT-3` | Tiền lệ trích một key contract đã bị đổi tên | di trú lời trích, hoặc đánh dấu tiền lệ đã cũ |
| `PRECEDENT-4` | Phương án cố ý rời khỏi mọi tiền lệ | ghi việc rời đi ấy làm lý do của chính nó |
| `PRECEDENT-5` | Tiền lệ **sai**, không chỉ là cũ | lật nó, bằng chữ, và ghi cái gì thay thế |

## Đọc corpus tiền lệ

1. **Khớp theo lý do nghiệp vụ, không theo hình.** Hai yêu cầu cho ra cùng bộ region vì hai lý do khác
   nhau thì không phải cùng một vụ. Lý do mới là thứ tiền lệ được đánh chỉ mục theo.
2. **Kiểm lời trích trước khi tin.** Một tiền lệ gọi tên key contract chỉ dùng được nếu key đó còn tồn
   tại dưới đúng cái tên ấy — `PRECEDENT-3`.
3. **Đọc phần bị loại.** Những phương án bị loại trong tiền lệ gần nhất là đường nhanh nhất để không đề
   xuất lại một hình mà source này đã từ chối.
4. **Chỉ rời precedent khi evidence xứng đáng.** Không chế tạo một phương án rời precedent. Chỉ đưa ra
   khi nó giải quyết vấn đề quan trọng mà precedent gần nhất không giải quyết được — `PRECEDENT-4`.
5. **Không để tiền lệ bịt miệng luật.** Một tiền lệ phạm luật layout không phải tiền lệ để noi theo; nó
   là một khuyết tật cần ghi lại — `PRECEDENT-5`.

## `PRECEDENT-0` — không có gì phủ được yêu cầu này

**Khi nào gặp.** Corpus không có phương án nào đã chấp nhận mà lý do nghiệp vụ khớp với yêu cầu này.

**Cách nhận ra**

- Không tiền lệ nào chung kết quả hay chung chủ thể với yêu cầu.
- Cái gần nhất chỉ giống ở **số lượng region**.

**Tự hỏi.** Mình sắp trích một tiền lệ vì nó **khớp**, hay vì nó là thứ **gần nhất đang có**?

**Ranh giới**

- `PRECEDENT-2`: khớp một phần thì vẫn chung lý do. Chung mỗi cái hình thì không phải khớp gì cả.

**Nó hỏng bằng đường nào.** Tiền lệ gần nhất bị trích vì không có cái nào khá hơn, và bộ trục của nó
được thừa hưởng bởi một trang chưa từng được chọn cho nó.

## `PRECEDENT-1` — một tiền lệ khớp về lý do nghiệp vụ

**Khi nào gặp.** Một phương án đã chấp nhận từng trả lời đúng lý do này cho đúng source này, và không có
gì trong yêu cầu phản lại nó.

**Cách nhận ra**

- Lý do đã ghi đọc được như câu trả lời cho yêu cầu này.
- Mọi key contract nó trích đều còn tồn tại.
- Không giá trị trục nào trong yêu cầu xung đột với tiền lệ.

**Tự hỏi.** Mình có nói được lý do chung đó trong một câu **mà không nhắc tới layout** không?

**Ranh giới**

- `PRECEDENT-4`: trích dẫn không bắt buộc. Một phương án được phép rời đi, nhưng khi đó nó nợ lý do
  riêng của nó.

**Nó hỏng bằng đường nào.** Tiền lệ bị noi theo tới cả những chi tiết yêu cầu không hề đòi, và trang mới
thừa hưởng những quyết định không ai đưa ra cho nó.

## `PRECEDENT-2` — khớp một phần, đúng một trục khác

**Khi nào gặp.** Lý do khớp, nhưng yêu cầu ép một giá trị khác lên **một** trục — cái rail thành một
route, evidence chuyển xuống dưới subject.

**Cách nhận ra**

- Đúng một giá trị trục được yêu cầu nói ra và khác với tiền lệ.
- Mọi trục còn lại giữ nguyên được.

**Tự hỏi.** Trục nào đã đổi, và yêu cầu **nói ra** nó hay mình đang **giả định**?

**Ranh giới**

- `PRECEDENT-1`: nếu không trục nào đổi thì mã này không đạt tới.
- `PRECEDENT-0`: nếu hơn một trục đổi thì tiền lệ đó không còn là vụ đang xử nữa.

**Nó hỏng bằng đường nào.** Trục đã đổi được áp vào mà không được gọi tên, nên người đọc không thấy phần
nào của tiền lệ được giữ và phần nào bị đè.

## `PRECEDENT-3` — lời trích đã cũ

**Khi nào gặp.** Tiền lệ vẫn đúng nhưng gọi tên một key contract đã bị generic hoá hoặc đổi tên.

**Cách nhận ra**

- Một key được trích không còn xuất hiện trong contract hiện tại.
- Có một key tên rộng hơn đang phủ đúng lý do đó.

**Tự hỏi.** Key đó bị **đổi tên** hay bị **bỏ**? Hai chuyện đó sửa khác nhau.

**Ranh giới**

- `PRECEDENT-5`: cũ là chuyện của **lời trích**. Một tiền lệ sai ngay từ ngày được chấp nhận là chuyện
  khác.

**Nó hỏng bằng đường nào.** Tiền lệ bị trích y như đã viết, nên phương án sinh ra gọi tên một thành phần
không còn tồn tại — đúng cái bịa mà corpus lẽ ra phải ngăn.

## `PRECEDENT-4` — cố ý rời đi

**Khi nào gặp.** Phương án không noi theo tiền lệ gần nhất, và đó chính là mục đích của nó: nó tồn tại để
cả lô có một cấu trúc thật sự khác.

**Cách nhận ra**

- Bộ trục của nó khác tiền lệ gần nhất ở ít nhất một trục.
- Lý do của nó được nói bằng chính nó, không phải như một lời sửa lưng tiền lệ.

**Tự hỏi.** Phương án này có đáng đọc **nếu tiền lệ kia không tồn tại** không?

**Ranh giới**

- `PRECEDENT-5`: rời đi không phải lật. Lật là nói tiền lệ **sai**; rời đi là nói yêu cầu này **đáng có
  thứ khác**.

**Nó hỏng bằng đường nào.** Mọi phương án đều trích tiền lệ gần nhất, cả lô hội tụ, và thầy được xem một
cái hình ba lần.

## `PRECEDENT-5` — tiền lệ sai

**Khi nào gặp.** Tiền lệ phạm một luật layout, hoặc lý do của nó hoá ra không đúng về sản phẩm.

**Cách nhận ra**

- Noi theo nó sẽ sinh ra một phương án mà luật từ chối.
- Lý do đã ghi bị chính cách người ta dùng bề mặt ấy phản lại.

**Tự hỏi.** Tiền lệ này chỉ **cũ**, hay **chưa từng đúng**?

**Ranh giới**

- `PRECEDENT-3`: lời trích cũ thì **sửa**. Tiền lệ sai thì **lật và giữ lại**, để bản ghi cho thấy sự
  đảo chiều.

**Nó hỏng bằng đường nào.** Tiền lệ sai bị âm thầm bỏ qua thay vì bị lật, nên lượt sau nó lại được trích
và đúng khuyết tật ấy quay lại.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc | Đọc từ đâu |
|---|---|---|
| yêu cầu | Yêu cầu nghiệp vụ, đúng nguyên văn | người chủ |
| corpus | Phương án đã chấp nhận của **chính project này** — xem hình dạng bản ghi bên dưới | cạnh repository của chính project |
| contract | Chỉ **key**, `why`, `host` và **tên** children — không bao giờ là mảng class | `context.contract` của vai trò đã giải |
| trục | Bộ trục khác biệt đóng, liệt kê bên dưới | mô-đun này |
| luật | Các luật layout, vốn cao hơn mọi tiền lệ | cây này |

**"Project này" là project mà route workspace đã khai** — `project` và `role` trong
`.workspace/<project>/<role>/config.json`, không bao giờ là tên thư mục, không bao giờ là thứ session
trước dùng. Contract được đọc **sống** từ checkout mà route đó giải ra, vì mỗi frontend có contract
riêng. Hai hệ quả đi theo, và cả hai là lý do cột này tồn tại:

- **Route cũ làm nhiễm độc mọi đầu vào ở đây.** Nếu checkout đã chuyển chỗ hoặc đường dẫn hợp đồng đã đổi
  tên, mọi lời trích bị đối chiếu với một contract không phải của sản phẩm, và các phán quyết đều sai một
  cách tự tin. Route phải được xác minh **trước** khi đọc bất cứ thứ gì ở đây; route chưa xác minh thì
  **dừng** lượt chạy chứ không cho ra phán quyết tiền lệ.
- **Corpus thuộc phạm vi project đó, không thuộc cây này.** Tiền lệ nằm cạnh repository mà nó được chấp
  nhận cho. Tiền lệ của sản phẩm khác là quyết định của người lạ đang khoác thẩm quyền của cây này — tên
  và lý do của nó thuộc về một contract khác.

Một bản ghi tiền lệ có sáu trường, và trường thứ tư là thứ khiến corpus đáng giữ:

```text
prompt: <yêu cầu nghiệp vụ đã sinh ra nó>
axes: <bộ giá trị trục của phương án được chọn>
chosen: <hash + JSON>
rejected: <2-3 phương án còn lại, mỗi cái một câu vì sao thua>
cited-entries: <những key contract mà mỗi region đã trích>
contract-at: <trạng thái contract lúc nó được chấp nhận>
```

**Contract được tra chứ không đọc, và mảng class thì không bao giờ được trích ra.** Cắt vậy không phải
để tiết kiệm. Một tầng **không thấy** class thì không thể mang class đi tiếp, nên một tiền lệ không bao
giờ dạy được cho phương án sau một cái class — luật đứng vững vì giá trị đó không tới nơi, không vì một
lời nhắc. Đo trên một registry: 192KB nằm trên đĩa, 69KB là mức được phép, và một truy vấn trả lời trong
dưới 2KB. Khớp nhau cũng khớp ở `why` vì đúng lý
do đó: hai entry có thể trùng từng class mà trả lời hai lý do khác nhau, và **lý do** mới là thứ tiền lệ
được đánh chỉ mục theo.

**Trục** là bộ đóng mà một phương án được phép khác nhau ở đó. Tiền lệ ghi lại giá trị của nó;
`axis-delta` gọi tên những giá trị mà phương án mới đổi:

| Trục | Giá trị |
|---|---|
| ai sở hữu điều hướng | navbar sở hữu / một rail sở hữu / không có chrome |
| evidence so với subject | nằm cạnh subject / nằm dưới subject |
| region phụ | một route riêng / một panel trong trang / một overlay |
| chrome | dính / cuộn theo nội dung |

Hai phương án trùng **toàn bộ** bộ trục là **một** phương án, tiền lệ của chúng nói gì cũng vậy.

## Quy tắc

1. Tiền lệ thuộc phạm vi một source. Không bao giờ mang qua sản phẩm khác.
2. Tiền lệ ghi cả những phương án bị loại, mỗi cái một câu vì sao thua.
3. Tiền lệ được đánh chỉ mục theo **lý do nghiệp vụ**. Hình không phải chỉ mục.
4. Mọi lời trích được kiểm với contract hiện tại trước khi dùng.
5. Ít nhất một phương án trong lô **không** noi theo tiền lệ gần nhất.
6. Luật cao hơn tiền lệ. Tiền lệ phạm luật thì bị lật, không bao giờ được noi theo.
7. Lật thì phải ghi ra. Tiền lệ bị **thay thế**, không bị **xoá**.
8. Tiền lệ không phải một phương án. Nó là **bằng chứng** cho một phương án.

## Ngoại lệ

- **Vụ đầu tiên.** Với corpus rỗng, `PRECEDENT-0` là toàn bộ câu trả lời và không nợ cái rời đi nào: mọi
  phương án đều đã là rời đi.
- **Bề mặt chỉ có một lần.** Một bề mặt mà sản phẩm chỉ có đúng một lần được ghi làm tiền lệ và **đánh
  dấu không tổng quát**, để đọc được như lịch sử mà không mời người ta tái sử dụng.
- **Tiền lệ của một route không còn tồn tại.** Giữ lại, đánh dấu đã nghỉ. Phần bị loại của nó vẫn dạy
  được ngay khi phần được chấp nhận đã hết áp dụng.

## Đầu ra

Mỗi phương án trong lô một khối:

```text
candidate: <id trong lô này>
situation: <PRECEDENT-0 | PRECEDENT-1 | PRECEDENT-2 | PRECEDENT-3 | PRECEDENT-4 | PRECEDENT-5>
cites: <id tiền lệ, hoặc none>
shared-reason: <lý do nghiệp vụ mà cả hai cùng trả lời, hoặc vì sao không cái nào áp dụng>
axis-delta: <những giá trị trục khác với tiền lệ được trích>
citation-check: <các key đã kiểm với contract hiện tại>
reason: <vì sao phương án này đáng để thầy đọc>
```

## Ví dụ đã giải

**Yêu cầu.** "Trang kết quả bài luyện coding: điểm tổng, thời gian, số test pass, và danh sách tiêu chí
kèm điểm."

Corpus có một phương án đã chấp nhận cho trang kết quả flashcard: lý do *"một kết quả đã lưu đọc thành
những số liệu so sánh được, rồi tới các hàng chẩn đoán"*, trích `flashcard-result-stat` và
`flashcard-result-fact-row`.

```text
candidate: A
situation: PRECEDENT-1
cites: course-flashcard-result-page/2026-08-12
shared-reason: một kết quả đã lưu đọc thành những số liệu so sánh được, rồi tới các hàng so một cái tên với một giá trị đã lưu
axis-delta: none
citation-check: flashcard-result-stat và flashcard-result-fact-row còn tồn tại; cả hai mang tiền tố nghiệp vụ và mỗi cái chỉ 1 call site
reason: yêu cầu đặt cho người đọc đúng câu hỏi đó, nên câu trả lời đã chấp nhận áp dụng được nguyên vẹn, chỉ khác tên entry
```

```text
candidate: B
situation: PRECEDENT-2
cites: course-flashcard-result-page/2026-08-12
shared-reason: vẫn lý do đó, nhưng yêu cầu này nói tới các tiêu chí mà người đọc so với nhau chứ không so với một mốc
axis-delta: evidence chuyển từ nằm dưới các số liệu sang nằm cạnh
citation-check: cùng bộ key, cùng kết quả
reason: so các tiêu chí với nhau thì cách đọc song song có giá, mà tiền lệ đã chấp nhận chưa từng phải mời cách đọc đó
```

```text
candidate: C
situation: PRECEDENT-4
cites: none
shared-reason: không có — các số liệu ở đây được đối xử như một câu duy nhất về lượt làm, chứ không phải bốn phép đo riêng
axis-delta: bỏ hẳn thẻ số liệu; phần tóm tắt còn một dòng, các tiêu chí gánh cả trang
citation-check: trích title-with-baseline-fact, còn tồn tại, dùng ở 3 file trong đó có một branch dùng chung, nên chỉ tái sử dụng và không sửa
reason: nếu điểm tổng chỉ có nghĩa như bối cảnh cho các tiêu chí thì bốn thẻ đang tiêu tốn đầu trang cho dữ kiện ít dùng nhất
```

Phương án C chính là cái rời đi mà cả lô nợ. Không có nó thì A và B là một tiền lệ đọc hai lần.

## Phạm vi

Mô-đun này quyết định **những quyết định đã chấp nhận được trích dẫn thế nào** khi sinh phương án. Nó
không quyết định một layout được phép chứa gì — đó là việc của các luật layout — và nó **không lưu
corpus**: tiền lệ thuộc về source mà nó được chấp nhận cho, nằm cạnh repository đó, không nằm trong cây
dùng chung này.
