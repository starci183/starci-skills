---
title: Precedents · Vietnamese
---

# Tiền lệ

## LOADS

None.


## Bản ghi

Mô-đun này nhận một region đã được chấp nhận cùng những giải phẫu khối đã được chấp nhận **của chính source
này**, rồi trả về, với mỗi phương án khối sắp sinh ra, một tiền lệ mà nó trích dẫn — hoặc một lời khai
rằng nó **cố ý rời khỏi** mọi tiền lệ. Tiền lệ là một quyết định đã được chấp nhận trước đó, giữ lại kèm
lý do. Nó được **trích dẫn, noi theo và lật lại** — không bao giờ được tuân phục. Luật **ràng buộc**;
tiền lệ **thuyết phục**.

Tiền lệ của khối mang thêm ba thứ mà tiền lệ layout không có: khối nghỉ ở mấy lần lặp, nó vẽ những trạng
thái nào, và ai sở hữu dữ liệu của nó. Ba thứ đó là chỗ một khối sai nhiều nhất, nên cũng là chỗ tiền lệ
được đánh chỉ mục theo.

## Luật

Một tiền lệ ghi lại một quyết định **và những gì nó đã thắng**. Chỉ giữ giải phẫu được chọn thì dạy được
"copy cái gì"; chỉ phần bị loại mới dạy được "tránh cái gì".

Tiền lệ thuộc phạm vi **một source**. Mỗi frontend có entry riêng, leaf riêng, dữ liệu riêng, nên tiền lệ
của sản phẩm khác là quyết định của người lạ đang khoác thẩm quyền của cây này.

## Mã tình huống

| Mã | Tình huống | Nó phát ra gì |
|---|---|---|
| `PRECEDENT-0` | Không giải phẫu nào phủ được region này | sinh từ luật; ghi rõ không tiền lệ nào áp dụng |
| `PRECEDENT-1` | Tiền lệ khớp cả lý do nghiệp vụ và bộ trạng thái | trích dẫn; dùng lại các phần, số lần lặp và entry nó trích |
| `PRECEDENT-2` | Lý do khớp; bộ trạng thái hoặc số lần lặp khác | trích dẫn, rồi gọi tên cái đã đổi và vì sao |
| `PRECEDENT-3` | Tiền lệ trích một entry, leaf hoặc composite đã đổi tên | di trú lời trích, hoặc đánh dấu tiền lệ đã cũ |
| `PRECEDENT-4` | Phương án cố ý rời khỏi mọi tiền lệ | ghi việc rời đi làm lý do của chính nó |
| `PRECEDENT-5` | Tiền lệ **sai**, không chỉ là cũ | lật nó bằng chữ, và ghi cái gì thay thế |

## Đọc corpus tiền lệ

1. **Khớp theo lý do nghiệp vụ và bộ trạng thái cùng lúc.** Hai khối vẽ ra cùng các phần nhưng liệt kê
   trạng thái khác nhau thì không phải cùng một vụ — một khối **có thể rỗng** là quyết định khác với một
   khối không thể rỗng.
2. **Kiểm mọi lời trích.** Tiền lệ gọi tên một key contract, một leaf hay một composite chỉ dùng được nếu
   cái tên ấy còn tồn tại — `PRECEDENT-3`.
3. **Đọc phần bị loại**, để không đề xuất lại một giải phẫu mà source này đã từ chối.
4. **Bảo đảm có một cái rời đi.** Ít nhất một phương án trong lô không được noi theo tiền lệ gần nhất —
   `PRECEDENT-4`.
5. **Không để tiền lệ bịt miệng luật.** Tiền lệ có giải phẫu bỏ qua một trạng thái mà luật đòi là khuyết
   tật cần ghi, không phải hình để copy — `PRECEDENT-5`.

## `PRECEDENT-0` — không có gì phủ được region này

**Khi nào gặp.** Không giải phẫu nào đã chấp nhận trả lời được lý do nghiệp vụ của region này.

**Cách nhận ra**

- Không tiền lệ nào chung kết quả hay chung chủ thể với region.
- Cái gần nhất chỉ giống ở **số lượng phần**.

**Tự hỏi.** Mình trích vì nó **khớp**, hay vì nó **gần nhất đang có**?

**Ranh giới**

- `PRECEDENT-2`: khớp một phần thì vẫn chung lý do. Chung mỗi số lượng phần thì không phải khớp.

**Nó hỏng bằng đường nào.** Giải phẫu gần nhất bị thừa hưởng nguyên khối, kể cả số lần lặp mà không ai
chọn cho region này.

## `PRECEDENT-1` — khớp cả lý do và bộ trạng thái

**Khi nào gặp.** Một giải phẫu đã chấp nhận từng trả lời đúng lý do này cho đúng source này, với đúng bộ
trạng thái đó.

**Cách nhận ra**

- Lý do đã ghi đọc được như câu trả lời cho region này.
- Bộ trạng thái giống nhau: đúng những điều kiện đó có thể xảy ra.
- Mọi entry, leaf, composite được trích đều còn tồn tại.

**Tự hỏi.** Mình nói được lý do chung trong một câu **mà không gọi tên thành phần** không?

**Ranh giới**

- `PRECEDENT-2`: nếu trạng thái hoặc số lần nghỉ khác thì mã này không đạt tới.

**Nó hỏng bằng đường nào.** Giải phẫu bị copy tới cả chi tiết region không đòi, và nó thừa hưởng những
quyết định không ai đưa ra cho nó.

## `PRECEDENT-2` — bộ trạng thái hoặc số lần lặp khác

**Khi nào gặp.** Lý do khớp, nhưng region này **có thể rỗng** trong khi tiền lệ thì không, **có thể thất
bại** trong khi tiền lệ thì không, hoặc nghỉ ở một số lần lặp khác.

**Cách nhận ra**

- Có một trạng thái tồn tại ở đây mà tiền lệ chưa từng vẽ, hoặc ngược lại.
- Số lần nghỉ do region nói ra và nó khác.

**Tự hỏi.** Region **nói ra** trạng thái này, hay mình đang giả định vì dữ liệu **có thể** thiếu?

**Ranh giới**

- `PRECEDENT-1`: trạng thái và số lần giống hệt.
- `PRECEDENT-0`: nếu chính lý do đã khác thì tiền lệ không phải vụ đang xử.

**Nó hỏng bằng đường nào.** Một trạng thái mới được thêm âm thầm, nên người rà soát không thấy phần nào
của tiền lệ được giữ và phần nào bị đè.

## `PRECEDENT-3` — lời trích đã cũ

**Khi nào gặp.** Tiền lệ vẫn đúng nhưng gọi tên một entry, leaf hoặc composite đã bị generic hoá hoặc đổi
tên.

**Cách nhận ra**

- Một cái tên được trích không còn trong contract hay trong cây component.
- Có một cái tên rộng hơn đang phủ đúng lý do đó.

**Tự hỏi.** Nó bị **đổi tên** hay bị **bỏ**? Hai chuyện sửa khác nhau.

**Ranh giới**

- `PRECEDENT-5`: cũ là chuyện của lời trích, không phải quyết định sai.

**Nó hỏng bằng đường nào.** Lời trích bị copy y nguyên, nên phương án gọi tên một thành phần không còn
tồn tại — đúng cái bịa mà corpus tồn tại để ngăn.

## `PRECEDENT-4` — cố ý rời đi

**Khi nào gặp.** Phương án không noi theo tiền lệ gần nhất, nên cả lô có một giải phẫu thật sự khác: khác
các phần, khác người sở hữu dữ liệu, hoặc khác trạng thái đang gánh trọng lượng.

**Cách nhận ra**

- Các phần của nó, hoặc quyền sở hữu dữ liệu, khác tiền lệ gần nhất.
- Lý do của nó được nói bằng chính nó.

**Tự hỏi.** Phương án này có đáng đọc **nếu tiền lệ kia không tồn tại** không?

**Ranh giới**

- `PRECEDENT-5`: rời đi là nói region này đáng có thứ khác; lật là nói tiền lệ **sai**.

**Nó hỏng bằng đường nào.** Mọi phương án đều trích tiền lệ gần nhất, và thầy được xem một giải phẫu ba
lần.

## `PRECEDENT-5` — tiền lệ sai

**Khi nào gặp.** Tiền lệ phạm một luật khối — một trạng thái nó chưa từng liệt kê, một field nó bịa ra,
một khung nó không sở hữu — hoặc lý do của nó hoá ra không đúng về sản phẩm.

**Cách nhận ra**

- Noi theo nó sẽ sinh ra phương án mà luật từ chối.
- Lý do đã ghi bị chính cách khối được dùng phản lại.

**Tự hỏi.** Nó chỉ **cũ**, hay **chưa từng đúng**?

**Ranh giới**

- `PRECEDENT-3`: lời trích cũ thì sửa; tiền lệ sai thì lật và giữ lại, để bản ghi cho thấy sự đảo chiều.

**Nó hỏng bằng đường nào.** Nó bị âm thầm bỏ qua thay vì bị lật, nên lượt sau lại trích và đúng khuyết
tật ấy quay lại.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc | Đọc từ đâu |
|---|---|---|
| region | Region đã chấp nhận và lý do nghiệp vụ của nó | người chủ |
| corpus | Giải phẫu đã chấp nhận của **chính project này** — xem hình dạng bản ghi bên dưới | cạnh repository của chính project |
| contract | **key**, `why`, `host`, **tên** children, `repeats` và `optional` — không bao giờ là mảng class | `context.contract` của vai trò đã giải |
| từ vựng | Tên leaf mà contract đang gọi (47), tên composite (26), và những block đang có (10) | `repository.diskPath` của vai trò đã giải |
| trục | Bộ trục giải phẫu đóng, liệt kê bên dưới | mô-đun này |
| luật | Các luật khối, vốn cao hơn mọi tiền lệ | cây này |

**"Project này" là project mà route workspace đã khai** — `project` và `role` trong
`.workspace/<project>/<role>/config.json`, không bao giờ là tên thư mục, không bao giờ là thứ session
trước dùng. Mọi thứ ở cột thứ ba được đọc **sống** từ checkout mà route đó giải ra, vì mỗi frontend có
contract riêng, thành phần riêng, lịch sử riêng. Hai hệ quả đi theo, và cả hai là lý do cột này tồn tại:

- **Route cũ làm nhiễm độc mọi đầu vào ở đây.** Nếu checkout đã chuyển chỗ hoặc đường dẫn hợp đồng đã đổi
  tên, corpus bị đối chiếu với một contract không phải của sản phẩm, và mọi phán quyết về lời trích đều
  sai một cách tự tin. Route phải được xác minh **trước** khi đọc bất cứ thứ nào ở đây; route chưa xác
  minh thì **dừng** lượt chạy chứ không cho ra phán quyết tiền lệ.
- **Corpus thuộc phạm vi project đó, không thuộc cây này.** Tiền lệ nằm cạnh repository mà nó được chấp
  nhận cho. Tiền lệ của sản phẩm khác đọc vào project này là quyết định của người lạ đang khoác thẩm
  quyền của cây này — số đếm, cái tên và lý do đều thuộc về một contract khác.

Một bản ghi tiền lệ có bảy trường, và trường thứ năm là thứ khiến corpus đáng giữ:

```text
region: <region đã chấp nhận và lý do của nó>
axes: <bộ giá trị trục của giải phẫu được chọn>
states: <mọi điều kiện nó vẽ>
chosen: <hash + JSON>
rejected: <2-3 giải phẫu còn lại, mỗi cái một câu vì sao thua>
cited-names: <entry key, leaf và composite nó đã trích>
contract-at: <trạng thái contract lúc nó được chấp nhận>
```

**Contract được đọc mà bỏ mảng class**, nhưng `repeats` và `optional` thì **có** đọc ở đây: tiền lệ khối
được đánh chỉ mục theo bộ trạng thái, và `optional` là lời khai duy nhất của registry về sự hiện diện.
Nhưng nó **không** khai *vắng mặt kiểu nào* — đang tải, thất bại và rỗng đều rơi vào cùng một
`optional`, nên việc tách ba thứ đó phải đọc từ source của page và block, không bao giờ được suy từ
registry.

Khác tầng layout, tầng này đọc **từ vựng leaf và composite**: khối là tầng được phép trích chúng, và một
tiền lệ có lời trích không kiểm được với từ vựng đó là tiền lệ đang dạy một cái tên bịa ra.

**Trục** là bộ đóng mà một giải phẫu được phép khác nhau ở đó:

| Trục | Giá trị |
|---|---|
| ai sở hữu dữ liệu | khối tự fetch / cha truyền vào |
| lặp | một thực thể / lặp với số lần nghỉ |
| trọng lượng | trạng thái có dữ liệu gánh khối / một trạng thái vắng mặt gánh nó |
| cấu tạo | một phần / nhãn kèm giá trị / nhãn kèm hình và chú thích |

Hai giải phẫu trùng **toàn bộ** bộ trục là **một** giải phẫu, tiền lệ của chúng nói gì cũng vậy.

## Quy tắc

1. Tiền lệ thuộc phạm vi một source, không bao giờ mang qua sản phẩm khác.
2. Tiền lệ ghi cả những giải phẫu bị loại, mỗi cái một câu vì sao thua.
3. Tiền lệ được đánh chỉ mục theo lý do nghiệp vụ **và** bộ trạng thái. Chỉ các phần thì không phải chỉ mục.
4. Mọi lời trích được kiểm với contract và cây component hiện tại trước khi dùng.
5. Ít nhất một phương án trong lô **không** noi theo tiền lệ gần nhất.
6. Luật cao hơn tiền lệ. Tiền lệ phạm luật thì bị lật, không bao giờ được noi theo.
7. Lật thì phải ghi ra. Tiền lệ bị **thay thế**, không bị **xoá**.
8. Tiền lệ không phải một phương án. Nó là **bằng chứng** cho một phương án.

## Ngoại lệ

- **Vụ đầu tiên.** Với corpus rỗng, `PRECEDENT-0` là toàn bộ câu trả lời và không nợ cái rời đi nào.
- **Khối chỉ có một lần.** Khối mà sản phẩm chỉ có đúng một lần thì ghi lại và **đánh dấu không tổng
  quát**, để đọc như lịch sử mà không mời tái sử dụng.
- **Tiền lệ của một region không còn tồn tại.** Giữ lại, đánh dấu đã nghỉ; phần bị loại của nó vẫn dạy được.

## Đầu ra

Mỗi phương án trong lô một khối:

```text
candidate: <id trong lô này>
situation: <PRECEDENT-0 | PRECEDENT-1 | PRECEDENT-2 | PRECEDENT-3 | PRECEDENT-4 | PRECEDENT-5>
cites: <id tiền lệ, hoặc none>
shared-reason: <lý do nghiệp vụ mà cả hai cùng trả lời, hoặc vì sao không cái nào áp dụng>
state-delta: <trạng thái hoặc số lần nghỉ khác với tiền lệ được trích>
citation-check: <entry, leaf, composite đã kiểm với source>
reason: <vì sao phương án này đáng để thầy đọc>
```

## Ví dụ đã giải

**Region.** "Danh sách tiêu chí trên trang kết quả bài luyện coding: mỗi tiêu chí kèm điểm."

Corpus có một giải phẫu đã chấp nhận từ trang kết quả flashcard: lý do *"một cái tên đọc so với một giá
trị đã lưu, lặp thành các hàng"*, trích `flashcard-result-fact-row`, nghỉ ở 4 lần, chỉ vẽ khi có dữ liệu.

```text
candidate: A
situation: PRECEDENT-1
cites: flashcard-result-grade-rows/2026-08-12
shared-reason: một cái tên đọc so với một giá trị đã lưu, lặp thành các hàng trên cùng một baseline
state-delta: none
citation-check: flashcard-result-fact-row còn tồn tại; nó đã được trích hai lần trong cùng một entry trang, cho điểm và cho topic yếu
reason: region này bắt người đọc làm đúng phép so đó, nên giải phẫu đã chấp nhận áp dụng được, chỉ generic hoá tên entry
```

```text
candidate: B
situation: PRECEDENT-2
cites: flashcard-result-grade-rows/2026-08-12
shared-reason: vẫn phép so đó
state-delta: region này có thể rỗng — một lượt luyện có thể không chấm tiêu chí nào — mà tiền lệ chưa từng vẽ trạng thái rỗng
citation-check: cùng entry; trạng thái rỗng trích composite empty-notice, còn tồn tại
reason: danh sách tiêu chí rỗng là một kết cục thật ở đây, và một region không nói được điều đó sẽ bị đọc thành một trạng thái đang tải mãi không xong
```

```text
candidate: C
situation: PRECEDENT-4
cites: none
shared-reason: không có — các tiêu chí được đối xử như một hình gộp kèm chú thích, chứ không phải một chuỗi hàng
state-delta: bỏ hẳn lặp; một phần gánh toàn bộ phép so
citation-check: trích profile-breakdown, còn tồn tại, dùng ở một file
reason: nếu các tiêu chí được đọc như một hình chứ không đọc từng cái, thì một hàng cho mỗi tiêu chí đang tiêu chiều cao của region cho một cách đọc không ai dùng
```

Phương án C là cái rời đi mà cả lô nợ. Không có nó thì A và B là một giải phẫu đọc hai lần.

## Phạm vi

Mô-đun này quyết định **những giải phẫu đã chấp nhận được trích dẫn thế nào** khi sinh phương án khối. Nó
không quyết định một khối được phép chứa gì — đó là việc của các luật khối — và nó **không lưu corpus**:
tiền lệ nằm cạnh source mà nó được chấp nhận cho, không nằm trong cây dùng chung này.
