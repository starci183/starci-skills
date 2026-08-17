---
title: Landmark · Vietnamese
---

# Landmark

Đầu vào là một shape đã có người duyệt: một màn hình, một layout, một vùng chrome bao quanh trang được
route, một key trong registry. Việc vùng đó tồn tại và việc người đọc được phép nhảy thẳng vào nó là
quyết định đã chốt, ở đây không mở lại. Cái module này sinh ra là kiến trúc source — file nào mở
element landmark, file nào vĩnh viễn không được mở, file ấy được mang gì, và nó phải khai báo gì để
element còn sống được tới document cuối cùng.

## Luật

Landmark là nhóm nhỏ các element mà người đọc có thể nhảy qua lại giữa chúng mà không cần đọc những gì
nằm bên trong — `main`, `nav`, `aside`, `header`, `footer`. Một node mở element nào là một sự thật về
DOCUMENT, nên nó được khai báo ngay chỗ class và tập con của node đã được khai báo, không bao giờ ở call
site và không bao giờ viết tay.

**Đây là luật bắt buộc, không phải lời khuyên.** Registry làm cho sai lầm này im lặng thay vì đỏ lên:
một entry tên `dashboard-main` ghi lại ý định chính xác đến từng chữ rồi vẫn render ra một `div`, vì cái
branch vẽ node của registry vốn vẽ div. Một ứng dụng đã ship đúng như vậy — mọi vùng được đặt tên đúng,
không một landmark nào trong document, và không cổng nào có gì để nói. Câu mà module này sinh ra để giữ,
vì thế, là: **một cái tên trong key không phải một element trong document.**

## Mã tình huống

Mọi tình huống module này cai quản đều mang một mã, `LANDMARK-<n>`. Mã gọi tên TÌNH HUỐNG; hàng tương
ứng nói source phải trông thế nào khi tình huống ấy được giải, và nó từ chối cái gì.

| Mã | Tình huống | Source phải trông thế nào |
|---|---|---|
| `LANDMARK-1` | Cần thêm một loại landmark mới cho màn hình | Mỗi element landmark một branch, giống hệt branch node thường trừ đúng element nó mở. Không bao giờ có một branch tự quyết element lúc chạy theo lời người gọi |
| `LANDMARK-2` | Muốn nhét class vào branch landmark cho tiện | Branch landmark chỉ cấp element và không gì khác; key cấp class, tập con được nhận và lý do. Không bao giờ có class, style prop hay một registry thứ hai sống trên branch |
| `LANDMARK-3` | Có đề xuất một branch duy nhất nhận `as="main"` | Element do entry định đoạt, nên không thể chọn theo từng call site. Không bao giờ có `as` / `element` / `tag` trên branch vẽ node thường |
| `LANDMARK-4` | Layout dựng chrome quanh trang được route | Chính layout dựng chrome quanh phần children được route là nơi đánh dấu children đó là landmark của trang. Không đòi hỏi điều đó ở layout gốc hay layout trung chuyển |
| `LANDMARK-5` | Một key tên `*-main` nằm sâu trong trang | Landmark thuộc về người sở hữu cả một màn hình — file route, hoặc bề mặt trang — và vật mang quyết định là bên nào trong hai. Không bao giờ có landmark do một tầng chỉ vẽ MỘT PHẦN màn hình mở ra |

Các con số là cố định và được tham chiếu chéo. `LANDMARK-2` và `LANDMARK-3` trông như một luật nói hai
lần, nhưng không phải: một cái nói branch được MANG gì, cái kia nói ai được CHỌN. Một branch sở hữu class
vẫn cố định element đúng; một branch nhận `as` vẫn không sở hữu class nào. Chúng hỏng riêng, nên chúng
được viện dẫn riêng.

## Đọc một shape đã duyệt

1. Đọc cái shape nói ra: rằng một vùng tồn tại, cái gì thuộc về bên trong nó, và người đọc có được nhảy
   thẳng vào đó không. Đó là quyết định đã duyệt, và nó đứng nguyên.
2. Ghi lại cái shape không nói, và vì thế không giải: file nào mở element, element đến từ một branch
   landmark được import hay từ `host` mà entry khai báo, và cái tên của key có sức nặng gì không. Một key
   có tên kết thúc bằng tên element vẫn chỉ là một cái tên; chỉ `host` đã khai báo mới là một lời hứa.
3. Giải từ ngoài vào trong. Layout gốc, rồi layout dựng chrome quanh children được route, rồi bề mặt
   trang, rồi các tầng bên dưới. Một khi `main` đã mở, mọi thứ nằm dưới nó là cột đọc, không phải
   landmark.
4. Hỏi lần lượt câu hỏi của từng mã. Chỗ này có cần một branch chưa tồn tại không (`LANDMARK-1`)? Branch
   có đang mọc thêm thứ mà key đã sở hữu không (`LANDMARK-2`)? Element có đang biến thành prop không
   (`LANDMARK-3`)? File này có vừa dựng chrome vừa nhận `children` từ router không (`LANDMARK-4`)? File
   này sở hữu cả màn hình, hay chỉ một phần của nó (`LANDMARK-5`)?
5. Khi hai mã cùng khớp, viện dẫn cả hai. Gộp hai branch thành một cái nhận prop vi phạm `LANDMARK-1` và
   `LANDMARK-3` vì hai lý do khác nhau, còn một branch vừa tồn tại đúng một cái cho mỗi element vừa mang
   class thì là `LANDMARK-1` đạt và `LANDMARK-2` hỏng. Chúng hỏng riêng, nên chúng được ghi riêng; đừng
   gộp lại thành cái nào dễ sửa hơn.

## `LANDMARK-1` — mỗi element một branch

**Tình huống.** Màn hình mới cần một `nav` hoặc một `aside` thật, không phải một `div` trông giống `nav`.
Câu hỏi đặt ra là thêm một branch nữa, hay dạy branch sẵn có nhận thêm một tham số.

**Nó sinh ra gì trong source.** Mỗi element landmark một file branch, giống branch node thường ở mọi dòng
trừ đúng element nó mở. File của chính branch đó là nơi duy nhất element ấy được viết ra bằng tay. Thêm
một element landmark vẫn là một thay đổi một-file.

**Dấu hiệu nhận biết.** Có người vừa nói thêm một branch nữa thì lặp code quá. Đề xuất thay thế luôn là
một cờ, một map, hoặc một prop chọn tag. Branch mới sẽ giống branch thường ở mọi dòng trừ đúng một dòng.

**Ranh giới.** Đây không phải `LANDMARK-3`: `LANDMARK-1` nói có BAO NHIÊU branch, `LANDMARK-3` nói ai
được CHỌN element. Gộp hai branch lại thành một cái nhận prop là phá cả hai, vì hai lý do khác nhau. Nó
cũng không phải `LANDMARK-2`: branch mới phải giống branch thường kể cả ở chỗ không sở hữu class — vừa
mọc thêm một class là tình huống đã rơi sang `LANDMARK-2`.

**Tình huống nghiệp vụ hay gặp.** Thêm rail điều hướng bên trái · thêm panel phụ trợ cạnh nội dung · tách
footer thành vùng đọc riêng · dựng thanh công cụ trên cùng của một khu vực.

## `LANDMARK-2` — branch không sở hữu class nào

**Tình huống.** Branch landmark vừa ra đời, và ngay lập tức có người muốn cho nó nhận `className`,
`padding`, hoặc "chỉ một cái `min-w-0` thôi".

**Nó sinh ra gì trong source.** Một branch mà props chỉ mang element và không gì khác. Class, tập con
được nhận và lý do đều ở lại trên key trong registry, đúng chỗ chúng đã được khai báo từ trước.

**Dấu hiệu nhận biết.** Branch bắt đầu mang prop mà key không có tiếng nói. Có hai chỗ trả lời được câu
"tại sao nút này thụt vào" — key, và branch. Không ai còn nói được sự khác nhau giữa branch landmark và
registry.

**Ranh giới.** Đây không phải `LANDMARK-1`: `LANDMARK-1` cho phép branch TỒN TẠI, `LANDMARK-2` giới hạn
nó được MANG gì. Và nó không phải `LANDMARK-3`: một class trên branch làm mất LÝ DO, còn một prop chọn
element làm mất Ý NGHĨA của document. Cái thứ nhất làm layout khó truy, cái thứ hai làm màn hình không
nhảy vào được.

**Tình huống nghiệp vụ hay gặp.** "Cho tôi truyền class vào cho nhanh" · vá lệch spacing ngay tại call
site · thêm biến thể `compact` cho landmark · để branch tự quyết `max-width` của trang.

## `LANDMARK-3` — element không phải một prop

**Tình huống.** Có đề xuất một branch duy nhất, nhận `as="main"` hoặc `element="nav"`. Nghe rất gọn: một
branch, mọi element.

**Nó sinh ra gì trong source.** Một props interface đóng trên branch node — đúng key và phần nội dung —
nên `as` / `element` / `tag` là thuộc tính thừa và không qua được typecheck. Element được đọc từ union
`host` đóng của entry, còn file branch ghi lại rằng `as` đã được cân nhắc và bị từ chối.

**Dấu hiệu nhận biết.** Ý nghĩa của document đứng cùng dòng với các quyết định về giao diện. Việc một
trang có landmark hay không phụ thuộc vào việc call site có nhớ truyền prop hay không. Không có chỗ nào
ghi LÝ DO trang này mở element ấy.

**Ranh giới.** Với `LANDMARK-1`, xem trên. Với `LANDMARK-5`: `LANDMARK-3` nói call site KHÔNG ĐƯỢC CHỌN
element, còn `LANDMARK-5` nói call site nào ĐƯỢC PHÉP MANG landmark. Một prop hợp lệ đặt ở đúng file vẫn
sai theo `LANDMARK-3`.

**Tình huống nghiệp vụ hay gặp.** Gộp branch cho "đỡ trùng" · design system nhận `as` theo thói quen ·
generic `polymorphic component` · một branch dựng cả `section` lẫn `main` tuỳ hoàn cảnh.

## `LANDMARK-4` — layout dựng chrome là người đánh dấu

**Tình huống.** Một layout vẽ điều hướng, rồi vẽ phần trang được route bên cạnh. Chính nó là file BIẾT
điều hướng kết thúc ở đâu và trang bắt đầu ở đâu — nên chính nó phải nói ra điều đó.

**Nó sinh ra gì trong source.** Một `layout.tsx` của route vừa dựng chrome vừa render `children` thì phải
với tới một landmark: nó giao `children` được route cho frame mang key landmark của trang, còn điều hướng
được vẽ như một sibling. Các layout route anh em lặp lại đúng hình dạng đó.

**Dấu hiệu nhận biết.** File này vừa dựng chrome, vừa nhận `children` từ router. Đọc file này thấy được
ranh giới giữa phần lặp lại ở mọi trang và phần người đọc đến để xem. Bỏ đánh dấu đi thì bàn phím và
trình đọc màn hình phải đi lại toàn bộ navbar sau mỗi lần đổi route.

**Ranh giới.** Đây không phải `LANDMARK-5`: `LANDMARK-4` bắt một file PHẢI đánh dấu, `LANDMARK-5` cấm
những file khác đánh dấu. Hai vế của cùng một ý, trên hai tập file khác nhau. Hai loại layout không bị
hỏi tới, và không phải vì được ưu ái: layout GỐC vẽ khung tài liệu và gắn provider, layout TRUNG CHUYỂN
giao chrome cho một layout khác. Bắt hai loại này đánh dấu là tự tay đặt landmark thứ hai vào document.

**Tình huống nghiệp vụ hay gặp.** Layout của một nhóm route có navbar riêng · shell có rail bên trái ·
khu vực học tập có thanh tiến độ trên cùng · khu vực quản trị có breadcrumb.

## `LANDMARK-5` — một `main` cho mỗi document

**Tình huống.** Một key tên `dashboard-main`, `profile-main`, `explore-main`. Cái tên nói "main", và
người đọc key tin nó là landmark. Nó không phải. Đó là CỘT ĐỌC nằm cạnh rail, bên trong một trang mà
landmark đã được mở ở một tầng trên.

**Nó sinh ra gì trong source.** Landmark ở lại với người sở hữu cả một màn hình — file route, hoặc bề mặt
trang — và vật mang quyết định là bên nào trong hai. Các key đặt tên cho cột đọc không khai `host` nào
cả; chỉ entry khai `host: "main"` mới là một lời hứa.

**Dấu hiệu nhận biết.** Trên cùng một màn hình có nhiều hơn một chỗ tự nhận là "main". Key nằm trong một
block, một composite hay một leaf — tức là một PHẦN của màn hình. Bỏ node này đi thì màn hình vẫn còn
trang; nó chỉ mất một cột.

**Ranh giới.** Với `LANDMARK-4`, xem trên. Hai vật mang, hai tập file khác nhau — và gộp chúng lại từng
là một lỗi thật. Branch landmark là thứ có người import về để bọc một màn hình: nó ở lại file route, vì
một trang với tay lấy nó chính là cái bẫy luật này được viết ra để chặn. Còn một entry KHAI BÁO HOST thì
không phải thế: không ai import landmark nào cả, registry nói key này mở element gì và frame làm theo.
Entry ấy do người vẽ node ngoài cùng của màn hình render, mà luật bố cục file nói rất rõ file route KHÔNG
PHẢI người đó: route gắn một trang vào một URL và tự nó không vẽ gì. Giữ cả hai về mỗi file route, hai
luật quay ra từ chối lẫn nhau: mọi trang chuyển ra khỏi cây route để tuân luật bố cục đều bị báo là đặt
sai landmark, và cách duy nhất thoả mãn cả hai là để người sở hữu trang nằm lại trong cây route — đúng
cái khuyết tật mà luật bố cục sinh ra để ngăn. Một luật chỉ có thể tuân thủ bằng cách phá một luật khác
là một phát hiện về chính luật đó.

**Tình huống nghiệp vụ hay gặp.** Cột nội dung cạnh rail hồ sơ · cột kết quả cạnh filter · vùng nội dung
của một tab · panel chi tiết cạnh danh sách · khung hội thoại cạnh hộp thư.

## Tầng giữ

Mã nào thực sự được tầng nào giữ, chứ không phải tầng mà người đọc muốn tin là đang giữ nó.

| Mã | Tầng | Cái gì giữ nó |
|---|---|---|
| `LANDMARK-1` | `documented` | Không có gì cơ học. Tập `LANDMARK_BRANCHES` của lint ghi lại NHỮNG TÊN nào là branch landmark; nó không bao giờ hỏi có đủ một branch cho mỗi element không, cũng không từ chối một branch thứ hai |
| `LANDMARK-2` | `documented` | Không có gì cơ học. Không rule nào đọc props của chính branch để tìm class |
| `LANDMARK-3` | `unrepresentable` | Props interface của branch node là đóng — đúng key và phần nội dung. Thuộc tính `as` là thuộc tính thừa và không qua được typecheck; element đến từ union `host` đóng của entry |
| `LANDMARK-4` | `enforced` | `routed-page-is-a-main-landmark` — một `layout.tsx` của route vừa dựng chrome vừa render `children` thì phải với tới một landmark |
| `LANDMARK-5` | `enforced` | `main-landmark-belongs-to-a-route-file` — một landmark được vẽ ngoài những file sở hữu cả màn hình sẽ bị báo |

Hai mã chỉ được người đọc giữ, và đó là hình dạng thật thà của module này chứ không phải một lỗ hổng cần
che. Cả hai đều nói về HÌNH DẠNG của branch, mà một rule đọc hình dạng từ thư mục thì sẽ bắn cả vào branch
node thường. Cái lint nhìn thấy được — FILE nào đã mở landmark — đúng là cái hai rule kia đang nhìn.

## Điểm neo

Mỗi hàng nêu một đường dẫn và cái cần tìm trong đó. Đường dẫn tính từ gốc ứng dụng front-end, trừ lint,
vốn nằm trong chính cây tin cậy này.

| Mã | Ở đâu | Tìm gì |
|---|---|---|
| `LANDMARK-1` | `.claude/@starci/eslint-canon-fe` | `LANDMARK_BRANCHES` — tập tên branch mở landmark, mỗi element một entry. **Chưa neo được trong ứng dụng:** ứng dụng hiện mang element trên entry, nên không còn branch landmark nào để trỏ tới |
| `LANDMARK-2` | `components/branches/Tree/index.tsx` | Props của branch node: một key và phần nội dung, không có class. Class của nó đến từ tra cứu entry. Branch landmark lẽ ra thừa hưởng hình dạng này hiện chưa tồn tại |
| `LANDMARK-3` | `components/branches/Tree/index.tsx` | Props interface, và khối comment ghi lại rằng `as` đã được cân nhắc và bị từ chối; element được đọc từ `host` của entry |
| `LANDMARK-4` | `app/[lang]/dashboard/layout.tsx` | Một layout vẽ điều hướng như một sibling và giao `children` được route cho frame mang key `routed-page-main`. Các layout route anh em lặp lại hình dạng đó |
| `LANDMARK-5` | `components/contracts/index.ts` | `routed-page-main` khai `host: "main"`; các key đặt tên cho cột đọc không khai host nào cả, đúng cái bẫy mà mã này sinh ra để chặn |

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| file | Đường dẫn và tầng: file route, bề mặt trang, hay một tầng dưới cả hai |
| composer | File này có dựng chrome của màn hình và giao chrome đó cho children được route không |
| carrier | Element được đòi bằng cách nào: một branch landmark được import, hay `host` do entry khai báo |
| key | Tên của key, và nó gọi tên cả một màn hình hay một cột đọc bên trong màn hình |
| document | Route hoàn chỉnh rốt cuộc chứa những element landmark nào, và mỗi loại bao nhiêu cái |

## Quy tắc

1. Một `main` cho mỗi document.
2. Một cái tên trong key không phải một element trong document.
3. Element được khai báo ngay cạnh class và tập con, không bao giờ ở call site.
4. Branch landmark chỉ cấp element và không gì khác.
5. Landmark viết tay không mang key, nên không có gì ghi lại class, con và lý do tồn tại của nó.
6. Thêm một element landmark là một thay đổi một-file, và chính điều đó chặn cách làm sai rẻ tiền hơn
   thắng cuộc.
7. Một key có tên kết thúc bằng tên element vẫn chỉ là một cái tên; chỉ `host` đã khai báo mới là một lời
   hứa.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ mã nó áp
dụng vào.

- **File cài đặt của chính branch landmark.** `LANDMARK-1` cho phép đúng một file viết element ra bằng
  tay, y như branch node thường là nơi duy nhất một `div` được viết ra.
- **Layout gốc.** `LANDMARK-4` không với tới. Nó vẽ khung tài liệu và gắn provider; một landmark ở đó sẽ
  là cái thứ hai.
- **Layout trung chuyển.** `LANDMARK-4` không với tới một layout giao chrome cho layout khác. Bắt nó đánh
  dấu là đặt vào document một landmark thứ hai mà `LANDMARK-5` từ chối.
- **Bề mặt trang theo `LANDMARK-5`.** Hai vật mang bị giữ ở hai tập file khác nhau. BRANCH landmark ở lại
  file route, vì một trang với tay lấy nó chính là cái bẫy. Còn một entry khai báo host thì do người
  render node ngoài cùng của màn hình render, mà luật bố cục file nói rất rõ đó không phải file route —
  nên bề mặt trang được phép mang cái đó.
- **Trường hợp xuyên file không được giữ.** Một rule đọc từng file không thể thấy rằng một layout và một
  trang bên dưới nó cùng mở landmark. Phần đó vẫn là một câu hỏi review, và nói thẳng ra như vậy rẻ hơn
  là dựng một cổng ngụ ý một bảo đảm mà nó không có.

## Đầu ra

```text
file: <path>
tier: <route file | page surface | tier below>
composer: <draws chrome and routed children | draws part of a screen>
carrier: <landmark branch | entry host | none>
element: <main | nav | aside | header | footer>
situation: <LANDMARK-1 | LANDMARK-2 | LANDMARK-3 | LANDMARK-4 | LANDMARK-5>
reason: <what makes this file the owner of a whole screen, or what makes it not>
```

## Ví dụ đã giải

Shape đã duyệt: một khu vực dashboard mà layout của nó vẽ một rail điều hướng bên trái và, ngay cạnh, là
trang được route; bản thân trang đó bày một cột đọc nội dung nằm cạnh một panel filter.

```text
file: src/app/[lang]/dashboard/layout.tsx
tier: route file
composer: draws chrome and routed children
carrier: entry host
element: main
situation: LANDMARK-4
reason: this file both composes the navigation rail and receives children from the router, so it is the file that knows where navigation ends and the page begins; it hands children to the frame keyed routed-page-main, whose entry declares host: "main"
```

```text
file: src/components/blocks/DashboardContentColumn/index.tsx
tier: tier below
composer: draws part of a screen
carrier: none
element: main
situation: LANDMARK-5
reason: the key is named dashboard-main but the file draws a reading column beside the filter panel — delete it and the screen still has a page, it has only lost a column; it declares no host, and a name in a key is not an element in a document
```

Dòng `reason` của khối thứ nhất nêu đúng sự thật loại trừ `LANDMARK-5`: file này sở hữu cả một màn hình,
không phải một phần của màn hình. Dòng `reason` của khối thứ hai nêu sự thật loại trừ `LANDMARK-4`: file
này không bao giờ nhận `children` được route, nên nó không phải người dựng chrome.

Cái shape đã duyệt không nói, và vì thế không giải: nó không nói element đến từ một branch landmark được
import hay từ `host` do entry khai báo, mà chính vật mang mới quyết định những file nào được phép giữ nó.
Nó không nói có đủ một branch landmark cho mỗi element hay không, nên `LANDMARK-1` ở đây chưa được động
tới. Nó không nói branch được mang gì, nên `LANDMARK-2` cũng chưa được động tới. Và nó không thể nói được
rằng layout và một trang bên dưới nó CÙNG mở landmark hay không — một rule đọc từng file không thấy điều
đó, và phần ấy vẫn là một câu hỏi review.

## Phạm vi

Luật này đúng với mọi đoạn code cùng loại trong stack này: bất kỳ front end nào vẽ node của mình từ một
registry. Nó không nêu tên sản phẩm, thư viện component hay repository nào, và nó không nêu tên một tính
năng đơn lẻ nào. Tên component và tên key ở trên chỉ là minh hoạ — thay bằng tên mà ứng dụng cụ thể đang
dùng.
