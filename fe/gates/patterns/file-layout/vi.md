---
id: fe-patterns-file-layout-vi
title: vi.md
slug: /gates/patterns/file-layout/vi
sidebar_label: vi.md
sidebar_position: 1
description: Các tình huống LAYOUT-N, nhận diện bằng bản chất của file chứ không bằng ai đang import nó.
---

# vi.md

> Version: `2.00` · Module: `file-layout`

# File layout

Chỗ một file nằm là **một lời khai** về việc nó là cái gì. Thư mục dưới `components/` khai rằng "cái
này vẽ ra thứ gì đó"; dưới `hooks/` khai rằng "cái này đi lấy dữ liệu"; dưới `modules/` khai rằng
"cái này không phải React".

Đặt file sai chỗ không phải là **bừa bộn** — nó là **khai sai**. Và giá phải trả không nằm ở người
viết ra nó, mà ở người thứ hai: người đáng lẽ đã tái sử dụng được nó, nhưng không tìm thấy.

Câu hỏi duy nhất quyết định mọi thứ dưới đây:

> **File này LÀ cái gì, không phụ thuộc vào việc hiện giờ ai đang gọi nó?**

Câu "chỉ mỗi màn này dùng thôi" không trả lời câu hỏi đó. Nó mô tả **call graph của hôm nay**, không
mô tả bản chất — và nó chính là câu đã biến thư mục của một màn hình thành một codebase thứ hai.

**Đây là luật bắt buộc.** Không có file nào nhỏ đến mức được miễn. Câu "có mỗi một hàm helper thôi
mà" là chỗ luật này bị bỏ qua nhiều nhất.

## Bảng tra nhanh

| Mã | Tình huống nghiệp vụ | Đích đến |
|---|---|---|
| `FILE-1` | Một thư mục một component, tên thư mục = tên thứ nó export | Đổi tên một trong hai cho khớp |
| `FILE-2` | Thư mục màn hình chỉ giữ hai nửa của chính nó | Thứ thứ ba đi về tier của nó |
| `FILE-3` | Thứ không phải component code không nằm trong cây component | `hooks/`, `modules/utils/`, `modules/types/`, `resources/` |
| `FILE-4` | Một family export ra từng thành viên, không gói thành một object runtime | Export thẳng từng thành viên |
| `FILE-5` | Package dùng chung dừng lại **ngay dưới** block | Tier biết feature về app, tier không biết feature về package |
| `FILE-6` | File trong `app/` chỉ nói URL nào render page nào | Screen về `components/pages/<Name>/` |

---

## `FILE-1` — một thư mục, một component, tên khớp thứ nó export

**Tình huống.** Người đọc biết tên component thì phải suy ra được đường dẫn, và ngược lại. Grep một
cái tên phải ra **một** chỗ, không phải ba chỗ hoặc không chỗ nào.

**Dấu hiệu nhận biết**

- Tên thư mục là PascalCase, nhưng `index.tsx` bên trong không export cái tên đó.
- Trong một thư mục có hai component không họ hàng, một cái "tiện tay để đây".
- Ai đó phải mở file lên mới biết trong thư mục có gì.

**Tự hỏi.** Người biết cái tên này có tự đoán ra đường dẫn không? Người đứng ở đường dẫn này có tự
đoán ra cái tên không?

**Ranh giới**

- ↔ `FILE-2`: `FILE-1` nói về **quan hệ tên ↔ export**, áp cho mọi tier. `FILE-2` **đếm file**
  trong thư mục màn hình. Một thư mục page có `index.tsx` khớp tên nhưng thêm file thứ ba thì
  `FILE-1` xanh, `FILE-2` đỏ.
- ↔ `FILE-4`: `FILE-1` hỏi *tên đã export có thuộc họ không*; `FILE-4` hỏi *nó được export ra
  bằng hình dạng gì*. Một `export const Card = { Root, Header }` trong thư mục `Card/` **thoả**
  `FILE-1` và **vi phạm** `FILE-4`.

**Biến thể được phép.** Một component và các biến thể có kiểu riêng của nó **được** ở chung thư mục,
vì tất cả cùng mang tên họ: `Card`, `CardRoot`, `CardHeader`. Cái không được là **hành khách đi nhờ**:
một component không cùng họ, không cùng tên, ngồi cạnh vì tiện.

**Tình huống nghiệp vụ hay gặp.** Đổi tên component nhưng quên đổi tên thư mục · tách một variant ra
rồi để lại tên cũ · thư mục `Card/` export `Panel` vì "trước nó tên Card" · một helper component nhỏ
được thả vào thư mục của component lớn.

---

## `FILE-2` — thư mục màn hình giữ đúng hai nửa

**Tình huống.** Một `page`, một `layout` hoặc một `overlay` là **một màn hình**, và một màn hình có
đúng hai nửa: `index.tsx` là **phần đấu dây** (request, tình huống, chữ nghĩa), `component.tsx` là
**hình dạng**. Cộng thêm bài test sinh đôi của mỗi nửa. Hết.

**Dấu hiệu nhận biết**

- Trong thư mục page xuất hiện một file `.tsx` có tên riêng.
- Xuất hiện `constants/`, `utils/`, `types/` hoặc một file `shapes.ts` chép tay.
- Ai đó vừa nói câu: "chỉ mỗi page này dùng thôi".

**Tự hỏi.** Thứ vừa xuất hiện này có tên **ngoài** màn hình đầu tiên cần đến nó không? Nếu có — nó
không thuộc về đây.

**Ranh giới**

- ↔ `FILE-3`: `FILE-3` cấm bốn thư mục helper ở **mọi chỗ** dưới `components/`, kể cả cạnh một
  block mà `FILE-2` không hề ngó tới. Một `utils/` trong thư mục page vi phạm **cả hai**, và đó
  không phải tính hai lần — đó là hai lời khai khác nhau tình cờ gặp nhau.
- ↔ `FILE-1`: xem trên.

**Việc này luôn bắt đầu vô hại.** "Chỉ page này dùng thôi." Nó kết thúc bằng một thư mục màn hình
chứa bốn component, một thư mục constants, một thư mục utils và ba cái resting shape chép tay — lúc
đó màn hình đã là một codebase thứ hai với từ vựng riêng mà không ai khác dùng lại được.

**Tình huống nghiệp vụ hay gặp.** Row của một bảng chỉ màn này có · badge trạng thái "chỉ dùng ở
đây" · hàm format tiền tệ nằm cạnh page · type của response chép tay · mảng cấu hình cột · một
sub-section được tách ra cho `component.tsx` đỡ dài.

---

## `FILE-3` — thứ không phải component code không nằm trong cây component

**Tình huống.** `constants/`, `utils/`, `types/` và `hooks/` **không phải** thư mục component. Mỗi
thứ đã có một nhà thật, và cái nhà đó mới là điểm chính.

**Dấu hiệu nhận biết**

- Có một thư mục tên đúng bằng một trong bốn từ đó, nằm đâu đó dưới `components/`.
- Có một hàm thuần không nhận props, không render gì, nằm trong cây component.
- Người thứ hai vừa viết lại đúng hàm đó ở chỗ khác.

**Tự hỏi.** Thứ này có render ra gì không? Nếu không, nó đang làm gì trong cây của những thứ render?

**Vì sao là cái nhà chứ không phải sự gọn gàng.** Để cạnh component, helper **vô hình** với mọi người
đáng lẽ đã dùng lại nó. Nên người thứ hai viết lại nó. Rồi hai bản **trôi khỏi nhau** — và không có
gì báo động, vì cả hai đều "đúng" trong phạm vi của mình.

**Ranh giới**

- ↔ `FILE-2`: xem trên.
- Đích đến là một phần của mã, không phải gợi ý: fetch → `hooks/`; hàm thuần → `modules/utils/`;
  shape dùng chung → `modules/types/`; copy hoặc config map → `resources/`.

**Thư mục chưa tồn tại không phải lý do.** Đích đến được tạo **khi dùng lần đầu**, không phải được
giữ rỗng sẵn. "Chưa có `resources/`" không phải cớ để bỏ file lại trong cây component.

**Tình huống nghiệp vụ hay gặp.** Hàm format ngày · map mã trạng thái sang nhãn · type của một
response · hằng số số lượng mỗi trang · một `useX` chỉ để gọi API · bảng cấu hình cột.

---

## `FILE-4` — family export ra từng thành viên

**Tình huống.** `export const Card = { Root, Header }` gói cả họ thành **một đơn vị lúc build**. Call
site chỉ import cái header cũng kéo cả họ vào, và không mảnh nào rơi ra được khỏi bundle.

**Dấu hiệu nhận biết**

- Một `export const` viết hoa, giá trị là object literal, các key đều viết hoa.
- Call site viết `Card.Header`.
- Bundle to lên mà không ai giải thích được vì sao.

**Tự hỏi.** Bundler có phân biệt được các thành viên của họ này không? Nếu chỉ một call site dùng một
thành viên, những thành viên còn lại có bị rơi ra không?

**Ranh giới**

- ↔ `FILE-1`: xem trên. Một namespace object **vẫn khớp tên thư mục**, nên `FILE-1` không bắt được
  nó. Hai mã nhìn hai thứ khác nhau trên cùng một dòng code.

**Call site có dấu chấm là một tiện nghi, và bundler là bên trả tiền cho tiện nghi đó.**

**Tình huống nghiệp vụ hay gặp.** `Card.Root` / `Card.Header` · `Table.Row` / `Table.Cell` ·
`Form.Field` / `Form.Error` · gom icon thành một object · gom variant thành một object.

---

## `FILE-5` — package dùng chung dừng lại ngay dưới block

**Tình huống.** Trong một workspace nhiều app, đường ranh giới đi qua **đúng một chỗ**: giữa block và
mọi thứ dưới nó.

**Dấu hiệu nhận biết**

- `packages/*/src/` có `blocks/`, `overlays/`, `layouts/` hoặc `pages/`.
- `apps/*/src/` có `contracts/`, `leaves/`, `composites/`, `branches/` hoặc `shells/`.
- Header của package tự nói "block thuộc về app", còn cây thư mục thì nói ngược lại.

**Tự hỏi.** App thứ hai có muốn thứ này mà **không** muốn cái feature nó được viết ra để phục vụ
không? `Badge` — có. `FleetRow` — không.

**Vì sao đây là một mã chứ không phải một sở thích đóng gói.** Leaf, composite, branch và bảng
contract mô tả **HÌNH DẠNG**, và một hình dạng thì giống nhau ở mọi app — đó là lý do một bản là đủ,
và cũng là lý do một bản là **bắt buộc**. Block là một **câu nói nghiệp vụ**: nó biết course, invoice
hay fleet resource là gì. Đặt một block vào package dùng chung thì package học được một feature nó
không có việc gì phải biết, và app tiếp theo thừa kế một mớ từ vựng nó sẽ không bao giờ dùng.

**Ranh giới**

- Kích thước, độ đẹp, độ "tái sử dụng được về mặt kỹ thuật" **không** phải tiêu chí. Tiêu chí duy nhất
  là: **tier này có biết một feature không?**

**Hậu quả kép, không phải một.** Block nằm sai chỗ hỏng theo hai hướng cùng lúc: app không cần domain
đó vẫn ship nó, **và** người viết sau đọc cây thư mục rồi kết luận hợp lý rằng đường ranh nằm ở chỗ
khác — nên đặt luôn một page vào đó.

**Tình huống nghiệp vụ hay gặp.** Row nghiệp vụ "để dùng chung cho tiện" · một overlay đăng nhập
trong package · một `Badge` chép sang app thứ hai · một `Tree` contract chỉ có ở một app.

---

## `FILE-6` — route chỉ mount, và `app/` chỉ chứa route

**Tình huống.** File dưới `app/` nói **URL nào render page nào**. Không fetch, không sắp đặt, không
contract key. Và ngược lại: `app/` không chứa thứ gì khác ngoài slot của framework.

**Dấu hiệu nhận biết**

- Route file gọi hook, đọc session, dựng cây layout.
- Trong `app/` có một file tên riêng kiểu `fleet-page.tsx`.
- Không tìm thấy screen ở `components/pages/` dù màn đó rõ ràng đang chạy.

**Tự hỏi.** Nếu route file này đang vẽ, thì cái page mà nó **đáng lẽ** phải mount đang ở đâu? Nếu câu
trả lời là "chưa có" — nó chưa được tạo, và phần vẽ đang nằm ở chỗ duy nhất không ai tìm.

**Ranh giới**

- ↔ `FILE-2`: `FILE-6` không nhìn được vào **bên trong** `page.tsx`. Một `page.tsx` tự vẽ vẫn qua
  cửa. Việc tách hai nửa là chuyện của `FILE-2`.

**Cây route giữ gì.** Các slot của chính framework — `page`, `layout`, `template`, `loading`, `error`,
`not-found`, `default`, `route` và anh em của chúng — cộng thêm `providers` và `globals.css`, hai thứ
được root layout mount và không có chỗ nào khác để đi. `app/api/**` là server code, `_folder` là
cửa thoát của chính framework, và file `.test.` được miễn vì test không ship trong bundle nào và
không route nào render nó. **Mọi file khác ở đó là một component nằm trong thư mục không ai grep.**

**Câu thứ hai từng chỉ là văn xuôi, và giá của việc đó có hồ sơ.** Một page owner được viết vào
`app/<segment>/fleet-page.tsx` và đi qua build, lint, typecheck, bốn ảnh chụp niêm phong và một lần
phê duyệt, tới sát mép một lần ghi vào production với **mọi cổng đều xanh** — vì mọi cổng đều đang
đọc rule, còn cái này thì chỉ là văn xuôi.

**Tình huống nghiệp vụ hay gặp.** Route tự gọi `useSession` · route dựng shell rồi mới mount page ·
một component đặt tạm trong `app/` "cho gần route" · một file `helpers.ts` trong segment.

---

## Luật

1. Chỗ của một file suy ra từ **nó là gì**, không suy ra từ **ai đang gọi nó**.
2. Tên thư mục và tên export dự đoán được nhau theo cả hai chiều.
3. Thư mục màn hình giữ hai nửa và bài test sinh đôi của chúng, không giữ gì khác.
4. Thứ không phải component code không nằm trong cây component, dù nó lồng bên trong cái gì.
5. Family export ra từng thành viên; một object runtime không phải một family.
6. Tier biết feature thuộc về app; tier không biết feature thuộc về package dùng chung.
7. `app/` chỉ chứa slot của framework.
8. Thư mục đích chưa tồn tại thì **tạo**, không đi vòng.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều đóng và nêu rõ
mã nó áp dụng vào.

- **Test sinh đôi.** `FILE-2` cho phép `component.test.tsx` và `index.test.tsx` trong thư mục màn
  hình — chúng là bản sinh đôi của hai nửa, không phải thứ thứ ba.
- **Test của route.** `FILE-6` miễn mọi file `.test.` dưới `app/`. Test không ship trong bundle nào
  và không route nào render nó, nên nó không thể trở thành cái "page thứ hai" mà mã này sinh ra để
  chặn. Tên của nó **cố ý không** bị bắt phải khớp `page` hay `layout`: test của một route tách theo
  **mối quan tâm** — màn này render gì, ai được vào, ranh giới nằm ở đâu — và ép tất cả vào một
  `page.test.tsx` chỉ đổi lấy một file dài hơn.
- **Server code và cửa thoát của framework.** `FILE-6` miễn `app/api/**` và mọi `_folder`. Không
  cái nào là một màn hình.
- **Hai thứ không phải slot nhưng được nhận.** `providers` và `globals.css` ở dưới `app/` vì root
  layout mount chúng và chúng không có chỗ nào khác để đi.
- **Biến thể cùng họ.** `FILE-1` cho phép nhiều export trong một thư mục **khi mọi tên đều thuộc họ
  của thư mục**. Một component và các biến thể của nó là một component; một hành khách đi nhờ thì
  không.
- **Cây candidate.** Một candidate dưới `.artifacts/**/candidate/` được phép soi theo bất kỳ hình dạng
  workspace nào, và `FILE-5` đọc cái nào nó tìm thấy.
- **Thứ tự áp dụng.** `export-matches-folder` là rule đáng bật ở mức `warn` trước trong một cây có
  sẵn: nó nổ ở mọi thư mục có quy ước ra đời trước rule, và **con số đó là một cuộc di cư, không phải
  một đống lỗi**. Mức nghiêm khắc thật do config của repository tiêu thụ quyết định.
