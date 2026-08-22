---
title: Blocks · Vietnamese
---

# Blocks

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `brainstorms/blocks/schema.json` | file | kiểm tra hình dạng JSON của bản ghi |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | kiểm tra và băm artifact ứng viên |


## Bản ghi

Mô-đun này nhận một Layout-generated region trong complete current page. Direction bắt buộc nằm trong block
workflow. Default `audit` in một audited/corrected UI direction cùng pass/exact findings. Chỉ owner explicit
`brainstorm` trước direction approval mới trả 3–4 targeted UI direction trong cùng parent geometry. Parent page
và Layout journey direction được giữ nguyên.

## Luật

Một giải phẫu in UI direction, gọi tên các phần, khối nghỉ ở mấy lần lặp, **mọi trạng thái** nó vẽ, và ai sở hữu dữ liệu
của nó. Nó **không bao giờ** gọi tên một class.

**Một trạng thái mà region có thể vào mà giải phẫu không vẽ là một khuyết tật, không phải chi tiết để
sau.** Trạng thái được liệt kê **trước** khi thiết kế bất cứ thứ gì, vì một giải phẫu dựng cho trường hợp
có dữ liệu thì lúc trường hợp rỗng xuất hiện là phải **thiết kế lại**, không phải nối thêm.

## Đầu vào

Bảy, không hơn.

| # | Đầu vào | Thiếu nó thì |
|---|---|---|
| 1 | Current source region và lý do nghiệp vụ của nó | không có chủ thể, chỉ có một cái hình |
| 2 | Baseline bốn lock đã validate cùng current parent digest | giải phẫu bị dựng dưới partial hoặc wrong parent |
| 3 | StarCi MASTER cùng page override deviations-only | mỗi block âm thầm chọn taste riêng |
| 4 | Contract: **key**, `why`, `host`, **tên** children, `repeats`, `optional` — không lấy mảng class | phần bị bịa ra thay vì được tra |
| 5 | Từ vựng: tên leaf mà contract gọi, tên composite, những block đang có | một phần trích một thành phần không tồn tại |
| 6 | Dữ liệu của region **thật sự hỏng thế nào**, đọc từ source của page và block | `optional` bị hiểu lầm là đủ bộ trạng thái |
| 7 | Trong brainstorm mode, requested anatomy axis | alternative drift ngoài yêu cầu owner |

**Đầu vào số 6 tồn tại vì contract không trả lời được nó.** `optional: true` khai **sự hiện diện** và
không gì hơn: đang tải, thất bại và rỗng đều rơi vào cùng một cờ đó. Tách chúng ra thì phải đọc từ source
của page và block, không bao giờ được suy từ cached review state.

Không đọc ở tầng này: mảng class, lựa chọn theme chưa duyệt, chữ theo locale, lint.

## Đọc một region đã chấp nhận

1. **Đòi hash layout đã chấp nhận và giải direction của nó.** Layout đang đề xuất không phải điểm bắt đầu, và direction đã buộc trong nó không được chép thành hash thứ hai ở đây.
2. **Liệt kê condition và trạng thái trước.** Viewport, overlay, disclosure, async, data, permission và interaction
   phải có trước anatomy. Có dữ liệu, rỗng, đang tải, thất bại, một phần, bị chặn quyền — region
   này **thật sự** vào được những cái nào? Đọc từ source; không suy từ `optional`.
3. **Tra các phần theo `why`**, không theo hình, và kiểm mọi tên leaf và composite với từ vựng.
4. **Chọn các trục** mà những giải phẫu sẽ khác nhau ở đó. Trùng bộ trục là **một** giải phẫu.
5. **Quyết ai sở hữu dữ liệu** — khối tự fetch và cha truyền vào là hai sản phẩm khác nhau, không phải
   hai cách viết của một thứ.
6. **Từ chối thay vì bịa.** Region rỗng có phải một kết cục thật hay không là quyết định của người chủ,
   không phải một giá trị mặc định.

## Trục giải phẫu

| Trục | Giá trị |
|---|---|
| ai sở hữu dữ liệu | khối tự fetch / cha truyền vào |
| lặp | một thực thể / lặp với số lần nghỉ |
| trọng lượng | trạng thái có dữ liệu gánh khối / một trạng thái vắng mặt gánh nó |
| cấu tạo | một phần / nhãn kèm giá trị / nhãn kèm hình và chú thích |

`repeats` mà không có `restingCount` thì bị từ chối: một khối lặp không có số lần nghỉ thì không có hình
nào để rà soát.

## Phán quyết mỗi phần

Mỗi phần ra đúng một trong ba, đối chiếu với contract và từ vựng:

| Phán quyết | Khi nào | Bằng chứng phải nợ |
|---|---|---|
| `reuse <key>` | `why` của một cái tên đã trả lời đúng lý do của phần này | không |
| `generalize <key> -> <key>` | nó trả lời được nhưng dưới một cái tên buộc vào nghiệp vụ | số call site của tên cũ, **và câu `why` viết lại** |
| `new <key>` | không cái tên nào trả lời lý do này | câu `why` mà tên mới sẽ mang |

Một lời trích không kiểm được với từ vựng là **một cái tên bịa ra**, phán quyết của nó ghi gì cũng vậy.

## Luật cho giải phẫu

Mười bốn luật mà **mọi** giải phẫu phải thoả. Giải phẫu phạm một luật không phải là phương án yếu hơn — nó
**không phải một giải phẫu**.

| Mã | Luật | Nó từ chối |
|---|---|---|
| `BLOCK-1` | Một khối vẽ **nhiều nhất một** bề mặt đòi nền trang. Một ranh giới bên trong nó chỉ hợp lệ khi tập bên trong là **một membership riêng, gọi tên được** và tự khai là lồng: một đường viền, không đổ bóng, có owner ngoài được gọi tên. | một thẻ vẽ trong một thẻ |
| `BLOCK-2` | Field phụ trong một hàng là **chữ**. Chip chỉ dành cho một **trạng thái thật** của đối tượng: một dữ kiện tự nó đổi, mang hệ quả, và tông màu của nó có nghĩa. | lấy chrome làm nhấn mạnh — một viên thuốc bọc quanh một con số |
| `BLOCK-3` | Khối sở hữu inset, cuộn, các mức giới hạn đã đo và **trạng thái trình bày của chính nó**. Caller đưa **vị trí và dữ liệu**, không gì khác. | caller chen vào để style hay định kích thước khối |
| `BLOCK-4` | Rỗng là **một trạng thái của khối**, không phải sự vắng mặt của khối. Không có kết quả nào là một **câu trả lời** sản phẩm đưa ra, trong chính vỏ của khối, dưới chính tên của nó. | bỏ khối đi khi dữ liệu rỗng |
| `BLOCK-5` | Khối chỉ vẽ những dữ kiện mà **có producer phục vụ**. Không có field thì không có field — không hằng số, không placeholder, không một con số nghe hợp lý. | một field bịa ra, tệ hơn field thiếu vì nó **không** vắng mặt một cách nhìn thấy được |
| `BLOCK-6` | Hai chỗ hiện cùng một thứ thì chia nhau **một owner thật**: hàng hiển thị chung thì gộp, **host tương tác khác nhau thì để riêng**. | gộp chỉ vì trông giống nhau, hoặc trích đúng một nửa luật |
| `BLOCK-7` | Trong khối lặp, **các cột thẳng nhau qua mọi hàng**, và nội dung mở ra nằm thẳng với đúng cái trigger đã mở nó. | căn chỉnh quyết theo từng hàng |
| `BLOCK-8` | **Gọi tên nhóm trước**, chọn khoảng cách sau. Khoảng cách không thay thế được cấu trúc. | một bố cục được tinh chỉnh bằng cách nắn khoảng cách cho tới lúc trông ổn |
| `BLOCK-9` | Tên của một bề mặt danh sách thuộc **branch danh sách**. Ẩn tên chỉ hợp lệ khi một owner bao ngoài **đã** render đúng cái tên đã phân giải đó. | vẽ tiêu đề ngoài danh sách rồi giấu cái tên bên trong nó |
| `BLOCK-10` | **Liệt kê mọi trạng thái trước khi vẽ** bất cứ cái nào. Trạng thái là tình huống chọn **một cây khác**; thứ gì vẽ cùng một cây với chữ khác nhau thì là **prop**. | thiết kế trường hợp có dữ liệu rồi phát hiện phần còn lại sau |
| `BLOCK-11` | **Mỗi hành động sở hữu cờ pending của riêng nó**, và một khối là **một đơn vị ngã ngũ**. | một cờ loading dùng chung cho nhiều hành động — spinner nhảy sai nút |
| `BLOCK-12` | Thất bại có **owner nhìn thấy được trong mọi bố cục**. Thất bại là một **câu trả lời đã ngã ngũ**, không phải một lần chờ. | vẽ lỗi thành một spinner không bao giờ dứt |
| `BLOCK-13` | Khối nhận **dữ liệu đóng**. Nó không nhận nội dung tuỳ ý và không bao giờ để caller quyết cái gì hiện bên trong nó. | nội dung tuỳ ý, thứ biến khối thành một branch |
| `BLOCK-14` | **Phương án tính theo từng khối.** Một bề mặt có `N` khối được đánh giá từng region; alternative nằm trong region sở hữu nó. | biến nhiều quyết định block thành tổ hợp cấp-trang |

## Quy tắc

1. Giải phẫu không mang class, không mang token, không mang màu.
2. Bộ condition/state được liệt kê trước khi thiết kế, và giải phẫu vẽ **đủ** bộ đó. Modal, drawer,
   popover/menu, loading, empty, error, locked và disabled được đưa vào khi reachable; family không liên quan phải
   ghi rõ `not-applicable` cùng evidence.
3. Business-content matrix gọi đúng entity, field đại diện, count, status, action, consequence và density cho mỗi
   state. Một title cộng vài generic row không phải representative content.
3. `repeats` phải mang `restingCount`.
4. Mọi phần trích một cái tên có thật, hoặc khai một tên mới kèm `why`.
5. Không hai giải phẫu nào trong một lô trùng cả bộ trục.
6. Direction bắt buộc. `audit` trả đúng một audited/corrected UI direction cùng verdict. Owner explicit
   `brainstorm` trước direction approval trả 3–4 UI direction chỉ đổi requested axis; chỉ đổi trang trí là trùng.
7. Quyết định sản phẩm còn thiếu thì trả về cho người chủ.
8. JSON là dạng chuẩn hoá, và **hash của nó** là thứ lời chấp thuận gắn vào.
9. Feedback mở một lượt mới; giải phẫu đã chấp nhận không bao giờ bị sửa tại chỗ.

## Từ chối

Từ chối là một đầu ra. Dùng nó khi:

- yêu cầu không nói region rỗng có phải một kết cục thật hay không;
- không xác định được ai sở hữu dữ liệu, từ region cũng như từ source;
- số lần nghỉ không được nói ra và region không cho cơ sở nào để chọn;
- một phần cần một thành phần không tồn tại — khi đó nó là **đổi contract hoặc đổi component**, không
  phải một lựa chọn giải phẫu.

```text
refusal: returned-to-owner
missing: <quyết định chưa ai đưa ra>
blocked: <những phần không giải được nếu thiếu nó>
```

## Đầu ra

Đầu ra **chính là** JSON, và thẩm quyền của nó là `@schema` nằm cạnh bản ghi này.
`envelope` giữ những thứ đổi theo lượt — gồm `parentAt`, digest chỉ sống trong phiên của current source page.
Anatomy hash chỉ là cache key và chỉ phủ **một giải phẫu**.

```json
{
  "schema": 2,
  "envelope": {
    "round": 1,
    "project": "example-app",
    "region": "criteria",
    "parentAt": "f5534ef5e7fbe30c385108fb95702a64ac66d905414e0f7105873d67822be54c",
    "mode": "audit"
  },
  "anatomies": [
    {
      "id": "a",
      "axes": {"dataOwner": "parent", "repetition": "repeats", "weight": "populated", "composition": "label-value"},
      "citesPrecedent": "none",
      "states": ["populated", "empty", "pending"],
      "uiDirection": {
        "summary": "Giữ criteria dễ so sánh trong complete parent không đổi",
        "hierarchy": ["Criterion label đứng trước stored value"],
        "responsive": ["Các row giữ reading order khi parent thu hẹp"],
        "emphasis": ["Compared value vẫn là dominant fact"]
      },
      "restingCount": 4,
      "parts": [
        {
          "name": "criterion-row",
          "cites": {"kind": "entry", "verdict": "generalize", "from": "flashcard-result-fact-row", "to": "fact-row", "callSites": 1, "why": "if you need a row comparing a name with one stored value on a shared baseline"},
          "whyMatch": "a name read against one stored value, repeated as rows on a shared baseline"
        }
      ],
      "reason": "vì sao giải phẫu này đáng để người chủ đọc"
    }
  ],
  "audit": {"verdict": "pass", "findings": []}
}
```

Validate trước khi ghi và trước khi hash:

```bash
node @validate-artifact --schema @schema --data <batch.json> --hash
```

Ngoài hình dạng, validator còn từ chối class token ở bất cứ đâu trong lô, hai giải phẫu trùng bộ trục, một
giải phẫu `repeats` mà thiếu `restingCount`, và một lô không có giải phẫu nào trích `none`.

## Ví dụ đã giải

**Region.** "Danh sách tiêu chí trên trang kết quả bài luyện coding: mỗi tiêu chí kèm điểm."

Trạng thái được đọc từ source trước: danh sách **có dữ liệu** khi lượt luyện có chấm tiêu chí, **rỗng** khi
không chấm cái nào, và **đang tải** trong lúc kết quả về. Ba trạng thái, nên mọi giải phẫu đều vẽ ba.

Giải phẫu `a` dùng lại hình đã được chấp nhận với entry được generic hoá — một call site, nên đổi tên là
một lần sửa. Giải phẫu `b` giữ cùng cái hình nhưng cho **trạng thái rỗng** gánh region, vì một lượt luyện
không chấm được gì là một kết cục thật, và một danh sách im lặng bị đọc thành một lượt tải không bao giờ
xong. Giải phẫu `c` là cái **rời đi**: bỏ hẳn lặp, các tiêu chí thành một hình gộp kèm chú thích, trích
`profile-breakdown`.

Vì `c` trích `none`, cả lô có cái rời đi của nó. Không có nó thì `a` và `b` chỉ khác nhau một trục, và
người chủ được xem một giải phẫu hai lần.

## Phạm vi

Tầng này quyết định một khối gồm những gì và nó nợ những trạng thái nào. Nó không quyết định region nằm ở
đâu — đó là layout — và không quyết định một class, đó là việc của luật. Mười bốn luật mà một giải phẫu
phải thoả được phát biểu ở trên dưới dạng mã `BLOCK-n`, nên giải phẫu được đối chiếu với **một mã trích
dẫn được**, không phải với trí nhớ của người đọc về cây legacy.
