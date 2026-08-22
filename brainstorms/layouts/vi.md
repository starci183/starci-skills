---
title: Layouts · Vietnamese
---

# Layouts

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@contract-search` | `scripts/contract-search.mjs` | script | tìm contract entry theo nhu cầu đã nêu |
| `@schema` | `brainstorms/layouts/schema.json` | file | kiểm tra hình dạng JSON của bản ghi |
| `@validate-artifact` | `scripts/validate-artifact.mjs` | script | kiểm tra và băm artifact ứng viên |


## Bản ghi

Mô-đun này nhận ảnh chụp một page hoặc mô tả page flow. Trước khi compose, nó xác định mọi page cùng closed
visible intent của page đó. Sau đó nó resolve hai evidence track độc lập: customer journey cùng routed business
truth từ trên xuống, và component, contract, current/legacy composition cùng source capability từ dưới lên.
Các merge binding rõ ràng giữa hai track tạo thành complete pages. Default `generate` trả một result;
chỉ explicit `brainstorm` mới trả 3–4 targeted alternative sau khi owner đã xem baseline.

## Luật

Phương án schema 7 gọi tên scope `page`/`flow`, stage, MASTER system id, page override chỉ chứa deviation, mọi
page đã compose, ownership node lồng theo thứ tự và owned region. `synthesis.pageIntents` ghi page phải render
gì trước cả hai track; customer journey và component capability được author độc lập; mỗi page-level intersection
có binding rows nối từng render intent với journey, business và contract-backed regions. Mỗi region vẫn hash
minimum child geometry và representative anatomy. Mỗi node là `existing`, `proposed` hoặc `new`; `existing`
trích real source cùng SHA-256 và không được drift giữa các choice. Schema cũ là compatibility input. Candidate
không bao giờ gọi tên class; MASTER khóa macro taste một lần.

Stage `pages` mang `pageContract`, một representative populated state cho mỗi page, full future state inventory
và full-viewport coverage ở mọi reference viewport. Nó không có `renderContract` hay `executionPrompt`, vì vậy
approval chỉ tác động cache. `OK #1` bind canonical page-contract hash.

Stage `states` mang đúng approved page contract đó, `mode: expand-states` và `approvedPageAt`. Nó bung mọi state
và transition, rồi thêm `renderContract` đã hash để khóa exact source files cùng complete page, region, state và
transition obligation. State phải được phân loại tại đúng owner: page state chỉ tồn tại khi region arrangement,
hierarchy hoặc active page-level composition thay đổi; loading, refusal, answered hay interaction condition chỉ
đổi một subtree vẫn là block state dù full-page capture có hiển thị nó. `renders` chọn tối đa năm complete-page
render target trên toàn flow; mỗi target bind page state nếu có cùng các seeded block state nhìn thấy trong capture,
và phủ mọi reference viewport cho target đó. Việc chọn ưu tiên các condition family và transition family rủi ro
khác nhau; nó không loại bỏ implementation hay test obligation chưa được render. Mỗi region khóa owner,
component, contract, anatomy, data mapping và visual obligation. Page-contract drift phải quay lại page approval,
không được giấu trong state change.

Mọi complete render region còn mang `grammarScopes`. Mỗi scope gọi tên một child target đóng, các fact quan sát
được của child đó và đúng quyết định slot/outcome/component được tính lại từ routed grammar profile. Region block
được compose các owner này nhưng không được thay list, accordion, form hay body surface đã resolve bằng generic wrapper.

Mỗi stateful region còn phải khóa exact source ownership chain theo SPLIT-6: `ComponentBase` vẽ, optional
connected `Component` đọc world, `PageBase`, `LayoutBase` hoặc `OverlayBase` compose, connected entry tương ứng
là `Page`, `Layout` hoặc `Overlay`, và parent dùng connected child hay drawing child. Chuyển block condition vào
`PageProps`, `LayoutProps` hoặc `OverlayProps` không phải ownership transfer. Block condition bắt buộc có child
drawing owner riêng; outer Base compose child đó và không proxy state hay data. Overlay hoặc layout chỉ cần thêm
Block chain khi nó compose một subtree stateful độc lập; terminal surface không tạo tầng giả. Mọi file thật trong
chain phải là exact member của `renderContract.sourceBoundary`.

Transition gọi tên cả page và state ở mỗi endpoint, nên cùng một shape phủ in-page change lẫn cross-page flow
như Tổng quan → Ứng dụng. Mọi region data obligation khai preview content là `representative-fixture` và runtime
truth là `source-owned`; tên và value đại diện chỉ prove density, không bao giờ được hardcode thành runtime data.

Chỉ states-stage candidate mới xuất một `executionPrompt` machine-readable chuẩn. Nó lặp candidate id,
render-contract id và exact source boundary; đặt implementation thành `exact-render-contract`, cấm
reinterpretation và bắt buộc `same-state-same-viewport-parity`. `OK #2` bind candidate, complete states cùng
exact source boundary. Executor nhận prompt này, không nhận một design brief mới để tự diễn giải.
`instructions` có thứ tự cố định: `read-exact-render-contract`,
`implement-every-page-region-state-viewport-transition-obligation`, `touch-only-source-boundary`,
`do-not-reinterpret-preview`, `stop-if-obligation-is-unrepresentable`, rồi
`prove-preview-source-same-state-same-viewport-with-zero-mismatches`.

Mọi region đều trích một thứ **có thật**: một entry trong contract, hoặc một lời khai tường minh rằng cần
một entry mới và vì sao. Region không trích gì cả là một thành phần bịa ra đang khoác cấu trúc JSON.

## Đầu vào

Bảy, không hơn. Mỗi cái có mặt vì thiếu nó là hỏng một chuyện cụ thể.

| # | Đầu vào | Thiếu nó thì |
|---|---|---|
| 1 | Yêu cầu nghiệp vụ, đúng nguyên văn | không có ý định nào, chỉ có một cái hình |
| 2 | StarCi MASTER cùng page override deviations-only nếu có | mỗi candidate âm thầm chọn taste riêng |
| 3 | Contract: **key** của entry, `why`, `host`, và **tên** children | không tra được cái đã có → bịa entry |
| 4 | Danh sách branch: mỗi branch được chứa gì | region có hình mà không có người ghép |
| 5 | Bảng route: mọi trang route và mọi layout giữ dai | không tách được cái mount một lần với cái đổi theo route |
| 6 | Chỉ trong brainstorm mode, requested diversity axis | alternative drift qua phần không liên quan của reviewed baseline |
| 7 | Current source và legacy baseline của project | mọi yêu cầu bị trả lời như thể nó là yêu cầu đầu tiên |

**Đầu vào số 3 được tra chứ không đọc, và mảng class thì không bao giờ được trích ra.** Mỗi region một
truy vấn qua `@contract-search`, và thứ nó trả về là `key`, `why`, `host`. Cắt vậy không phải
để tiết kiệm. Một tầng **không thấy** class thì không thể ghi class vào đầu ra của nó, nên "JSON không có
class" đứng vững vì **giá trị đó không bao giờ tới nơi**, chứ không vì một lời nhắc phải tuân theo. Đo
trên một contract vocabulary 299 entry: 192KB nằm trên đĩa, 69KB là mức được phép, và một truy vấn trả lời trong
dưới 2KB.

Không đọc ở tầng này: mảng class, lựa chọn theme chưa được chọn, cài đặt của leaf và composite, dữ liệu và query, chữ theo
locale, lint. Tất cả thuộc những tầng đến sau.

## Đọc một yêu cầu

1. **Ghi scope ledger trước khi đặt identity.** Tách product surfaces được yêu cầu rõ, modes do cùng một
   surface sở hữu, và ví dụ minh họa. Chỉ nhóm đầu được thành `layoutId`. Yêu cầu gọi tên một trang thì có
   một surface; product flow thật có nhiều; “ví dụ A → B” chỉ minh họa năng lực framework cho tới khi owner
   đưa nó vào product scope rõ ràng.
2. **Tra trước khi thiết kế.** Với mỗi region, tra contract theo `why`, và đọc `why` đúng bản chất của
   nó: **không phải một lời mô tả nghiệp vụ, mà là lời khai khi nào bạn cần tới entry này.** Hai entry
   cùng class mà khác nhu cầu là hai entry khác nhau; hai entry khác class mà trả lời cùng một nhu cầu
   là **một** entry đã bị viết hai lần.
3. **Chọn những trục mà các phương án sẽ khác nhau ở đó**, lấy từ đầu vào số 5. Hai phương án trùng mọi
   giá trị trục là **một** phương án.
4. **Gán người ghép cho từng region** từ danh sách branch. Region có entry mà không có branch là **chưa
   giải xong**, không phải đã xong.
5. **Đặt từng region vào bảng route**: nó mount một lần rồi giữ, đổi theo route, hay mở ra như overlay?
6. **Từ chối thay vì bịa.** Quyết định mà yêu cầu không nói ra và cây không suy ra được thì trả về cho
   người chủ.

## Trục khác biệt

Bộ đóng mà một phương án khác nhau ở đó. Mỗi giá trị là một sự thật **cấu trúc**, nói được trong một câu.

| Trục | Giá trị |
|---|---|
| ai sở hữu điều hướng | navbar sở hữu / một rail sở hữu / không có chrome |
| evidence so với subject | nằm cạnh subject / nằm dưới subject |
| region phụ | một route riêng / một panel trong trang / một overlay |
| chrome | dính / cuộn theo nội dung |

Phương án phải **khai** bộ giá trị trục của nó. Hai phương án trùng cả bộ là trùng lặp và một cái bị loại
— máy thấy được chuyện đó, nên không người đọc nào phải tự thấy.

## Phán quyết mỗi region

Mỗi region ra đúng một trong ba, và cái thứ ba là ngoại lệ:

| Phán quyết | Khi nào | Bằng chứng phải nợ |
|---|---|---|
| `reuse <key>` | `why` của một entry đã trả lời đúng lý do của region này | không |
| `generalize <key> -> <key>` | entry trả lời được nhưng tên nó đang buộc vào một nghiệp vụ khác | số call site của key cũ, **và câu `why` viết lại** |
| `new <key>` | không entry nào trả lời lý do này | câu `why` mà entry mới sẽ mang |

`generalize` mà không có **số call site đo được** thì bị từ chối. Đổi tên là rẻ khi chỉ một file trích
key, và là chuyện cả sản phẩm khi một branch dùng chung trích nó — mà contract không phân biệt được hai
trường hợp đó.

Tên đã generic hoá vẫn phải **cố định children**. Nới `flashcard-result-fact-row` thành `fact-row` thì
vẫn giữ một nhãn và một giá trị trên cùng baseline; nới tiếp thành `row` là gọi tên chẳng ràng buộc gì
nữa.

**Đổi tên mà không viết lại `why` thì tệ hơn không đổi.** `why` chính là thứ một lượt tra khớp vào, nên
một cái tên đã nới rộng mà vẫn mang lý do hẹp cũ là **hứa một sự tổng quát mà chỉ mục không giao** —
người sau tra theo lý do, không thấy gì, rồi bịa ra entry thứ ba. Viết lý do mới thành **cái nhu cầu nó
trả lời** — "nếu cần một hàng so một cái tên với một giá trị đã lưu trên cùng baseline" — chứ không phải
thành cái nghiệp vụ nó xuất phát từ đó.

## Luật cho phương án

Mười bốn luật mà **mọi** phương án phải thoả. Phương án phạm một luật không phải là phương án yếu hơn — nó
**không phải phương án**, và đem nó vào 3–4 là tiêu sự chú ý của thầy vào thứ đã bị từ chối từ trước.

| Mã | Luật | Nó từ chối |
|---|---|---|
| `LAYOUT-1` | Một owner mount **một lần** ở gốc locale **chỉ khi** nó giữ state mà địa chỉ không tính lại được — một cuộc hội thoại đang mở, một socket đang sống, một session đã khởi. Mọi owner khác mount trong từng layout của nhóm route cần nó, và lặp lại ở đó không phải vi phạm. | mount một lần vì owner *nghe* có vẻ toàn cục, hoặc vì nó luôn hiển thị |
| `LAYOUT-2` | Trợ lý toàn cục và các mặt của vùng nội dung là **hai trục chạy song song**. Owner trợ lý nhận trang đã route như một **component** và đặt nó **bên cạnh** mình, không bọc lấy nó. | gộp hai trục thành một control có hai giá trị |
| `LAYOUT-3` | Thẻ tab của một trang là **hàng thứ hai của navbar** phía trên nó: dính khi navbar dính, không lấy khoảng trống của navbar, và ở mọi vị trí cuộn người đọc thấy **đúng một** đường phân cách dưới cả khối. | một dải tab nổi ở đầu body |
| `LAYOUT-4` | Control dẫn tới **một page owner khác** thì push path; control đổi **panel nào của cùng owner** đang hiện thì không. Khi lựa chọn panel phải sống sót qua reload và qua một link dán, owner đọc nó từ query. | route hoá một lần đổi panel, hoặc giấu một trang thật trong một tab |
| `LAYOUT-5` | Route **có nội dung** có **một** page owner thật, được mount bởi file route và không bởi gì khác. Route là **cửa** thì forward, và forward chỉ hợp lệ vì không có gì trở nên không tới được. | route có nội dung mà không có owner, hoặc có hai |
| `LAYOUT-6` | Biên vendor của overlay **đã là** bề mặt. Contract nội dung của nó dùng thẳng tiêu đề, hàng, control và khoảng cách; phần thân cơ chế giữ nguyên không inset. | mount một surface card **bên trong** biên overlay |
| `LAYOUT-7` | Modal **gọi tên một chiều rộng** từ thang đóng và ghi lý do về nội dung. Cơ chế drawer và dropdown khai **vị trí**, không khai chiều rộng. | bịa một prop width hay một class cục bộ để cơ chế trông giống modal |
| `LAYOUT-8` | Một field do **đúng một** region khai — region mà chính `why` của nó đặt câu hỏi mà field đó trả lời. | hai region cùng khai một field ngoài hai điều kiện đóng |
| `LAYOUT-9` | Region được ghim nghỉ **dưới chrome của trang nó đang đứng trên**, đo từ frame của chính trang đó, và khai **mức trần chiều cao trong cùng một quyết định** với offset. | offset bê từ trang khác sang, hoặc offset không có trần |
| `LAYOUT-10` | Chiều rộng của một region do **contract ghép cái hàng** mà region đó nằm trong viết ra, nhắm vào **danh tính** của con chứ không vào vị trí của nó, lấy từ union class đóng, và mọi số đo cố định đi kèm việc **từ chối co lại**. | region tự quyết chiều rộng của mình, hoặc chiều rộng nhắm theo số thứ tự anh em |
| `LAYOUT-11` | Luật này trả về một **phân loại** — chạy hết chiều ngang, hay control gọn — **không bao giờ** trả về một chiều rộng. Cả hai phán quyết của người chủ trên cùng một control đều còn giá trị. | chọn một trong hai phán quyết làm mặc định |
| `LAYOUT-12` | Mỗi region phải nhận diện được và functionally complete trong từng page candidate: purpose, representative content, production-like density, reading order, reachable states và current contract ownership đều visible. Layout được implement sau chính review này; không có block-head completion phase ở task sau. | hộp trắng, toy summary hoặc page cần task khác mới implement được |
| `LAYOUT-13` | Chỉ product surface được yêu cầu rõ mới được thành layout identity hoặc flow node. Ví dụ dùng để giải thích năng lực vẫn chỉ là evidence cho tới khi owner đưa nó vào scope rõ ràng. | biến “ví dụ create order” thành product page |
| `LAYOUT-14` | Các mode dùng chung một route và một page owner là state của page đó. Layout candidate contract và làm mọi mode có evidence executable trước implementation, còn visual review chỉ lấy tối đa năm state đại diện trên toàn flow. | sinh sign-in, sign-up và recovery thành layout riêng, đẩy state sang task khác hoặc render một screenshot matrix không giới hạn |

## Quy tắc

1. Phương án không mang class. Candidate schema 5 dùng chung `starci-master`; page override chỉ list deviation.
2. Mọi region trích một entry key, hoặc khai một entry mới kèm `why` của nó.
3. Mọi region gọi tên branch ghép nó.
4. Phương án khai bộ giá trị trục, và không hai phương án nào trong một lô trùng cả bộ.
5. `generate` trả đúng một complete implementable result. Explicit `brainstorm` trả 3–4 targeted alternative chỉ đổi requested axis và giữ reviewed baseline ở phần còn lại.
6. Quyết định sản phẩm còn thiếu thì trả về cho người chủ. Không bao giờ đoán để lô cho đủ.
7. JSON của phương án là dạng chuẩn hoá — thứ tự khoá cố định, không timestamp, không id theo lượt — vì
   **hash của nó** là thứ lời chấp thuận gắn vào.
8. Feedback thay cache round. Candidate không sống như durable authority sau invocation.
9. Mỗi candidate page có đúng một pre-track page intent record, và mỗi render intent được bind đúng một lần.
10. Journey và contract-first track hoàn tất độc lập; anatomy chỉ được sinh từ merge bindings của chúng.
11. Mọi merged region có contract-first capability, và mọi journey step, business obligation cùng page region đều xuất hiện trong binding matrix.
12. Mọi render region ở states stage phải qua layout-grammar gate; thiếu scope, decision stale hoặc component owner sai không phải candidate có thể duyệt.

## Preview

HTML phải là product prototype nguyên trang, responsive và functional, có content đại diện đủ thật, không phải rectangle
placeholder rỗng. Ảnh chụp phải tái dựng toàn bộ viewport nhìn thấy; flow phải render mọi page/step được nêu rõ.
Nested layout `existing` luôn nhìn thấy và bám đúng source; chỉ ownership `proposed`/`new` mới được thay đổi.
Navigation, tab, disclosure, drawer, modal, menu/popover, form, primary/retry action và responsive collapse phải
chạy transition in-memory có tính tất định ở mọi nơi page có evidence là reachable. Prototype không mutation
backend, nhưng QA state selector không bao giờ thay product control. Trước khi vẽ phải inventory các condition
viewport, overlay, disclosure, async, data, permission và interaction; mỗi value reachable map tới authored HTML,
còn family không liên quan phải ghi rõ `not-applicable` cùng evidence.

Content trong region render thành authored product HTML từ render contract đã hash. Tên, value và action đại diện giúp
hình dung purpose, density cùng reading order; review/schema/debug label nằm ngoài product canvas.
Region login có thể hiện ví dụ mang dáng credential, còn sign-up và recovery vẫn là block states của vòng sau.
Flow chỉ xuất hiện khi được đưa rõ vào product scope và render thành page set hoàn chỉnh. Ưu tiên
hình từ source hiện hành hoặc legacy; khi không có asset tái dùng được thì inline
SVG bỏ đi được có thể làm hình minh họa, nhưng không bao giờ được đưa thành source hay JSON. Blank-box page và
mockup bóng bẩy không có annotation đều là preview không hợp lệ.

Representative không có nghĩa là viết tắt. Phải dựng content matrix cho từng page/state từ business truth rồi
render đúng entity type, value có nghĩa, count, status, metadata, action, consequence và production-like density
cần để hiểu surface. Lorem, generic card, toy row count, filler lặp và title-only shell đều là lỗi. Chỉ content
ngoài scope đã khai mới được làm nhẹ về thị giác; owned business content không được rút gọn chỉ để author preview
nhanh hơn.

## Từ chối

Từ chối là một **đầu ra**, không phải một thất bại. Dùng nó khi:

- yêu cầu nói ra kết quả nhưng không nói ai sở hữu hình học của một region;
- hai region cùng đòi một field mà yêu cầu không nói bên nào sở hữu;
- một region cần một entry mà `why` của entry đó phản lại yêu cầu;
- một class cần dùng không có trong tập đóng của contract — khi đó nó là **đổi contract**, không phải một
  lựa chọn layout.

```text
refusal: returned-to-owner
missing: <quyết định chưa ai đưa ra>
blocked: <những region không giải được nếu thiếu nó>
```

## Đầu ra

Đầu ra **chính là** JSON, và thẩm quyền của nó là `@schema` nằm cạnh bản ghi này —
không phải cái trích đoạn dưới đây. `envelope` giữ những thứ đổi theo lượt; hash chỉ phủ **một phương
án**, nên cùng một quyết định chạy lại ở lượt sau vẫn ra đúng hash đó.

Work mới dùng schema 7. `envelope.scope` khai screenshot `page` hoặc described `flow`; `stage: pages` bắt buộc
`synthesis` cùng `pageContract` và cấm source authority. Sau `OK #1`, `stage: states` giữ approved page hash,
bung complete state inventory và thêm `renderContract` cùng canonical `executionPrompt`. Example cũ chỉ là
compatibility documentation.

```json
{
  "schema": 1,
  "envelope": {
    "round": 1,
    "project": "example-app",
    "surface": "course-catalogue",
    "prompt": "yêu cầu, đúng nguyên văn",
    "contractAt": "trạng thái contract lúc giải"
  },
  "candidates": [
    {
      "id": "a",
      "direction": {"id": "quiet-precision", "vocabularyAt": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "axes": {"contrast": "balanced", "density": "compact", "shape": "soft", "depth": "flat", "motion": "still"}, "citesPrecedent": "none", "personality": ["calm", "precise", "restrained"], "roles": {"ground": {"verdict": "reuse", "token": "--background"}, "surface": {"verdict": "reuse", "token": "--card"}, "content": {"verdict": "reuse", "token": "--foreground"}, "mutedContent": {"verdict": "reuse", "token": "--muted-foreground"}, "accent": {"verdict": "reuse", "token": "--primary"}, "separator": {"verdict": "reuse", "token": "--border"}, "display": {"verdict": "reuse", "token": "--font-sans"}, "body": {"verdict": "reuse", "token": "--font-sans"}, "label": {"verdict": "reuse", "token": "--font-sans"}, "radius": {"verdict": "reuse", "token": "--radius"}, "elevation": {"verdict": "none", "why": "flat surfaces carry no elevation"}, "duration": {"verdict": "none", "why": "this direction stays still"}, "easing": {"verdict": "none", "why": "this direction stays still"}}, "rejects": ["decorative gradients", "floating surfaces"], "reason": "quiet hierarchy keeps comparison faster than decoration"},
      "axes": {"navigation": "navbar", "evidence": "beside", "secondary": "panel", "chrome": "sticky"},
      "citesPrecedent": "none",
      "regions": [
        {
          "name": "results",
          "entry": {"verdict": "reuse", "key": "course-catalogue-card"},
          "assembler": "SurfaceListCard",
          "mount": "per-route",
          "whyMatch": "a course is read as one offer with its own entry action"
        }
      ],
      "reason": "vì sao phương án này đáng để người chủ đọc"
    }
  ],
  "refusal": {"missing": "quyết định chưa ai đưa ra", "blocked": ["results"]}
}
```

Mọi object trong schema đều đặt `additionalProperties: false`, nên một `className` không phải là phát
hiện để tranh luận — nó **không hợp lệ**. Validate trước khi ghi và trước khi hash:

```bash
node @validate-artifact --schema @schema --data <batch.json> --vocabulary <visual-vocabulary.json> --hash
```

Validator còn ép ba luật cấp-lô mà schema không nói được: không class token ở bất cứ đâu trong lô, không
hai phương án trùng bộ trục, và phải có ít nhất một phương án trích `none`.

## Ví dụ đã giải

**Yêu cầu.** "Catalogue khoá học: bộ lọc và kết quả, trên một trang."

Yêu cầu nói ra một bề mặt và hai region. Nó **không** nói bộ lọc có được giữ khi đi vào một khoá rồi
quay ra hay không, nên chuyện đó không được giả định.

```json
{
  "schema": 1,
  "envelope": {
    "round": 1,
    "project": "example-app",
    "surface": "course-catalogue",
    "prompt": "A course catalogue: filters and the results, on one page.",
    "contractAt": "5eb4ac6a2463"
  },
  "candidates": [
    {
      "id": "a",
      "direction": {"id": "quiet-precision", "vocabularyAt": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "axes": {"contrast": "balanced", "density": "compact", "shape": "soft", "depth": "flat", "motion": "still"}, "citesPrecedent": "none", "personality": ["calm", "precise", "restrained"], "roles": {"ground": {"verdict": "reuse", "token": "--background"}, "surface": {"verdict": "reuse", "token": "--card"}, "content": {"verdict": "reuse", "token": "--foreground"}, "mutedContent": {"verdict": "reuse", "token": "--muted-foreground"}, "accent": {"verdict": "reuse", "token": "--primary"}, "separator": {"verdict": "reuse", "token": "--border"}, "display": {"verdict": "reuse", "token": "--font-sans"}, "body": {"verdict": "reuse", "token": "--font-sans"}, "label": {"verdict": "reuse", "token": "--font-sans"}, "radius": {"verdict": "reuse", "token": "--radius"}, "elevation": {"verdict": "none", "why": "flat surfaces carry no elevation"}, "duration": {"verdict": "none", "why": "this direction stays still"}, "easing": {"verdict": "none", "why": "this direction stays still"}}, "rejects": ["decorative gradients", "floating surfaces"], "reason": "quiet hierarchy keeps comparison faster than decoration"},
      "axes": {"navigation": "navbar", "evidence": "beside", "secondary": "panel", "chrome": "sticky"},
      "citesPrecedent": "none",
      "regions": [
        {
          "name": "filters",
          "entry": {"verdict": "new", "key": "catalogue-filter-rail", "why": "a filter set names what the result region is currently showing"},
          "assembler": "SurfacePanel",
          "mount": "per-route",
          "whyMatch": "a filter set names what the result region is currently showing"
        },
        {
          "name": "results",
          "entry": {"verdict": "reuse", "key": "course-catalogue-card"},
          "assembler": "SurfaceListCard",
          "mount": "per-route",
          "whyMatch": "a course is read as one offer with its own entry action"
        }
      ],
      "reason": "filters beside results keeps the current narrowing visible while reading, which is what a catalogue is scanned for"
    },
    {
      "id": "b",
      "direction": {"id": "quiet-precision", "vocabularyAt": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "axes": {"contrast": "balanced", "density": "compact", "shape": "soft", "depth": "flat", "motion": "still"}, "citesPrecedent": "none", "personality": ["calm", "precise", "restrained"], "roles": {"ground": {"verdict": "reuse", "token": "--background"}, "surface": {"verdict": "reuse", "token": "--card"}, "content": {"verdict": "reuse", "token": "--foreground"}, "mutedContent": {"verdict": "reuse", "token": "--muted-foreground"}, "accent": {"verdict": "reuse", "token": "--primary"}, "separator": {"verdict": "reuse", "token": "--border"}, "display": {"verdict": "reuse", "token": "--font-sans"}, "body": {"verdict": "reuse", "token": "--font-sans"}, "label": {"verdict": "reuse", "token": "--font-sans"}, "radius": {"verdict": "reuse", "token": "--radius"}, "elevation": {"verdict": "none", "why": "flat surfaces carry no elevation"}, "duration": {"verdict": "none", "why": "this direction stays still"}, "easing": {"verdict": "none", "why": "this direction stays still"}}, "rejects": ["decorative gradients", "floating surfaces"], "reason": "quiet hierarchy keeps comparison faster than decoration"},
      "axes": {"navigation": "rail", "evidence": "below", "secondary": "route", "chrome": "scrolls"},
      "citesPrecedent": "none",
      "regions": [
        {
          "name": "scopes",
          "entry": {"verdict": "generalize", "from": "flashcard-mode-tabs", "to": "mode-tabs", "callSites": 2, "why": "if you need to switch between a small closed set of scopes rather than filter by them"},
          "assembler": "SurfaceCard",
          "mount": "mounts-once",
          "whyMatch": "a small closed set of scopes is switched between, not filtered by"
        }
      ],
      "reason": "if the real narrowing is a handful of scopes rather than many filters, a tab strip costs a fraction of the page a rail takes"
    }
  ],
  "refusal": {
    "missing": "whether a chosen filter set survives navigating into a course and back",
    "blocked": ["filters"]
  }
}
```

Đúng lô này validate được, và hai phương án của nó hash ra `f5534ef5…` với `75056f73…`. Chạy lại nó ở
lượt 7 với prompt viết lại hoàn toàn thì **vẫn đúng hai hash đó**, vì envelope nằm ngoài hash. Không có
tính chất ấy thì lời chấp thuận đang gắn vào một con số tự nó đổi.

Lời từ chối giao **kèm** các phương án. Cả hai vẫn đọc được; chỉ giá trị `mount` là chưa giải, và nói ra
điều đó có ích hơn là chọn một giá trị rồi sai một cách tự tin.

## Phạm vi

Tầng này quyết định một bề mặt gồm những gì và ai ghép chúng. Nó không quyết định giải phẫu của một khối
— đó là tầng sau — và không quyết định một class, đó là việc của luật. Mười bốn luật mà một phương án phải
thoả được phát biểu ở trên dưới dạng mã `LAYOUT-n`, nên phương án được đối chiếu với **một mã trích dẫn
được**, không phải với trí nhớ của người đọc về cây legacy.
