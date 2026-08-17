---
title: Vendor-boundary · Vietnamese
---

# Ranh giới vendor

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | bộ máy frontend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Gate này nhận code đã viết xong — một file, một mảnh diff. Kết quả là một **phán quyết**: file có nằm
trong phạm vi hay không, luật máy nào đã nổ, nó báo cái gì và trên node nào, ánh xạ sang mã luật nào,
và lối thoát đang mở nào có thể che đúng lỗi đó. Module này không chọn thiết kế. Nó từ chối, và nó
phải chỉ ra được đúng import, đúng đường dẫn, đúng thẻ hay đúng literal class mà nó từ chối.

## Luật

Quyền sở hữu vendor được giữ bằng đường dẫn, bằng import, bằng JSX anatomy và bằng literal class bắt
buộc phải viết ra. Cổng này phơi bày các luật nghiêm ngặt được cài trong
`@canon-fe`. Nó cố ý không đo thiết kế bằng regex: contract vẫn là nguồn hình
dạng, còn lint chỉ chặn những đường source có thể chứng minh là sai.

Hai chiều phải cùng tồn tại. Import vendor sai owner bị báo, và mechanics branch không sở hữu vendor
cũng bị báo. `components/shells` không còn là exemption — chính sự tồn tại của đường dẫn đó là lỗi.

Luật nêu **không mã nào**. Vì thế cả mười luật máy đã xuất bản đều có luật máy và không có mã: danh
tính ở đây là tên luật đã xuất bản, và không có định danh dạng số cho bất kỳ luật nào trong module
này. Bản thân luật sản phẩm được viết bằng văn xuôi trong `../../patterns/vendor-boundary/INDEX.md`;
mọi câu trong đó mà không luật máy nào bên dưới gọi tên đều là không được canh.

## Luật máy đã xuất bản

| Luật máy | Mã | Nó báo cái gì |
|---|---|---|
| `vendor-boundary` | không có | `rejects` — import HeroUI nằm ngoài leaf, ngoài named mechanics branch và ngoài named SurfaceCard branch; mọi file `components/shells` cũ; một mechanics branch rỗng |
| `modal-branch-owns-scroll-body` | không có | `requires` — `ModalBranch/index.tsx` phải render `Modal.Body className="p-0"` |
| `field-input-uses-secondary-variant` | không có | `requires` — HeroUI Input của Field nhà phải dùng secondary variant |
| `field-label-is-text-only` | không có | `rejects` — Icon nhà nằm trong label của Field |
| `no-surface-branch-in-overlay` | không có | `rejects` — import SurfaceCard có tên nằm trong overlay |
| `text-link-uses-hero-link` | không có | `requires` HeroUI Link, và `rejects` hành vi link tự chế bằng button/hover |
| `account-control-owns-dropdown` | không có | `rejects` — đứt chuỗi sở hữu DropdownBranch → AccountMenu → ShellNav |
| `auth-overlay-owns-single-content-host` | không có | `requires` ContractContent, và `rejects` host/inset bị trùng |
| `checkbox-keeps-compound-anatomy` | không có | `rejects` — đứt lồng nhau Content → Control → Indicator |
| `no-internal-starci-href` | không có | `rejects` — component được canh tự ôm href nội bộ |

Không mã nào bị bỏ trống luật máy, đơn giản vì cổng này không xuất bản mã nào cả. Điều đó cắt cả chiều
ngược lại: không phán quyết nào của module này truy được về một điều khoản đánh số của luật sản phẩm,
và ai muốn đọc luật thì phải đọc văn xuôi, không phải đọc danh sách luật máy.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, rồi ghi lại.** Mọi luật máy ở đây đều khóa theo một đường
   dẫn owner, một file có tên hoặc một họ component có tên. Ngoài phạm vi không có nghĩa là file đã
   qua — nghĩa là luật đó không tồn tại với file đó.
2. **Kiểm tra exemption.** Trong code không có cái nào. `components/shells` từng là exemption duy nhất
   cổng này mang, và nó đã bị lật ngược: đường dẫn đó bây giờ chính là lỗi. Đừng tự tay cấp một cái
   mới.
3. **Đọc đúng những node mà luật máy thật sự đọc** — đường dẫn file, source của import và các
   specifier, tên thẻ JSX cùng thứ tự lồng nhau, và literal class đúng như đã viết.
4. **Xuất một block cho mỗi phát hiện**, gọi tên node.
5. **Viết dòng `hatch`** mỗi khi một lối thoát đang mở bên dưới có thể che đúng lỗi đó.
6. **Đừng báo cái không luật máy nào canh.** Cổng này không đo thiết kế, hình dạng hay bố cục bằng
   regex; phán quyết nào nói khác là hiểu sai module.

## `vendor-boundary` — none

**Nó báo cái gì.** `rejects`, trong ba tình huống tách biệt: import HeroUI nằm ngoài leaf, ngoài named
mechanics branch và ngoài named SurfaceCard branch; bất kỳ file nào nằm dưới đường dẫn cũ
`components/shells`; và một mechanics branch rỗng vendor.

**Nó phát hiện bằng gì.** Bằng đường dẫn và bằng import. Owner được quyết từ đường dẫn file — leaf,
named mechanics branch, named SurfaceCard branch — còn vendor được quyết từ import source
`@heroui/react`. Nhánh kiểm tra tier cũ không cần import nào cả: có `components/shells` trong đường
dẫn là đã đủ thành phát hiện. Nhánh branch rỗng là chiều ngược lại, một named mechanics branch mà bên
trong không có import vendor nào.

**Điểm mù.** Nó đọc đường dẫn của một file và các import source của file đó. Một vendor được
re-export qua module cục bộ rồi import lại từ đó thì không còn là import `@heroui/react` trong file
sai. Đổi tên thư mục owner là đổi owner mà không đổi một dòng hành vi nào. Còn một leaf được phép
import HeroUI dùng nó tốt hay dở thì hoàn toàn không bị xét — predicate node chính xác nằm trong
`@canon-fe` và cổng này không xuất bản nó.

**Ranh giới.** Luật máy này quyết ai được import vendor. Owner đó sau đó phải render cái gì là việc
của các luật anatomy và literal bên dưới.

## `modal-branch-owns-scroll-body` — none

**Nó báo cái gì.** `requires` — `ModalBranch/index.tsx` không render `Modal.Body className="p-0"`.

**Nó phát hiện bằng gì.** Bằng file có tên, cộng JSX anatomy, cộng một literal class. Phạm vi là đúng
một file `ModalBranch/index.tsx`; bên trong nó thẻ `Modal.Body` phải mang literal `p-0`.

**Điểm mù.** Class phải được viết ra theo đúng nghĩa đen. Một `p-0` ghép lúc chạy — qua
helper, qua biến, qua điều kiện, qua spread props — không phải literal mà luật tìm, còn một `p-0` viết
đúng chữ nhưng nằm trên phần tử khác vẫn thỏa mãn một phép kiểm tra dạng văn bản mà chẳng sở hữu gì.
Một modal branch thứ hai mang tên khác nằm ngoài file có tên duy nhất này.

**Ranh giới.** Luật máy này chỉ sở hữu scroll body. Inset thuộc về contract, còn content host duy nhất
là `auth-overlay-owns-single-content-host`.

## `field-input-uses-secondary-variant` — none

**Nó báo cái gì.** `requires` — HeroUI Input của Field nhà không nằm trên secondary variant.

**Nó phát hiện bằng gì.** Bằng component Field được canh, cộng variant viết trên HeroUI Input.

**Điểm mù.** Chỉ Field nhà mới được canh. Một Input đặt ngoài nó, hoặc một variant truyền vào
dưới dạng giá trị thay vì viết trên phần tử, không phải thứ luật đọc.

**Ranh giới.** Luật máy này xét variant của input. Cái label bên cạnh là `field-label-is-text-only`.

## `field-label-is-text-only` — none

**Nó báo cái gì.** `rejects` — Icon nhà xuất hiện trong label của Field.

**Nó phát hiện bằng gì.** Bằng JSX anatomy: thẻ Icon lồng bên trong label của Field.

**Điểm mù.** Nó canh Icon nhà. Một SVG thô, một emoji, một icon của vendor hay một icon bọc
trong component khác đều không phải thẻ đó, và một thẻ có namespace không phải identifier mà phép kiểm
tra anatomy đọc.

**Ranh giới.** Chỉ nội dung của label. Cái input bên cạnh là `field-input-uses-secondary-variant`.

## `no-surface-branch-in-overlay` — none

**Nó báo cái gì.** `rejects` — một import SurfaceCard có tên nằm trong overlay.

**Nó phát hiện bằng gì.** Bằng đường dẫn cộng import: file là overlay, và nó import một named
SurfaceCard branch.

**Điểm mù.** Import phải đúng là cái có tên đó. Một SurfaceCard vào được overlay qua
re-export, qua alias hay qua component bọc thì không để lại import nào luật nhận ra, còn một surface
dựng lại bằng tay ngay trong overlay thì ngay từ đầu chẳng phải import SurfaceCard nào.

**Ranh giới.** Luật máy này giữ surface ở ngoài overlay. Bản thân overlay được import vendor nào là
việc của `vendor-boundary`.

## `text-link-uses-hero-link` — none

**Nó báo cái gì.** `requires` HeroUI Link, và `rejects` hành vi button hay hover tự chế đứng thay chỗ
nó.

**Nó phát hiện bằng gì.** Bằng import và JSX: HeroUI Link phải là phần tử được dùng, còn các bản thay
thế tự chế — button mang hành vi link, hành vi hover viết tay — bị từ chối.

**Điểm mù.** Nó nhận ra đúng những hình dạng nó gọi tên. Một bản thay thế viết theo cách
khác, hoặc giấu cách đó một component, không phải node nó đọc; và nó không xét Link được style thế nào
một khi đã đúng phần tử.

**Ranh giới.** Chỉ hành vi link. Link trỏ đi đâu là `no-internal-starci-href`.

## `account-control-owns-dropdown` — none

**Nó báo cái gì.** `rejects` — chuỗi sở hữu DropdownBranch → AccountMenu → ShellNav bị đứt.

**Nó phát hiện bằng gì.** Bằng các component có tên và thứ tự lồng nhau của chúng: mechanics của
dropdown sống trong DropdownBranch, được AccountMenu tiêu thụ, được gắn vào ShellNav, và phép kiểm tra
ép đúng chuỗi đó.

**Điểm mù.** Nó đọc chuỗi theo tên. Một lớp bọc trung gian, một lần đổi tên bất kỳ mắt xích
nào, hay một dropdown ráp từ mảnh vendor dưới một component khác đều để chuỗi tên nguyên vẹn trong khi
quyền sở hữu mà chuỗi đó đại diện đã mất.

**Ranh giới.** Luật máy này sở hữu chuỗi của account control. Còn DropdownBranch có được import HeroUI
hay không là `vendor-boundary`.

## `auth-overlay-owns-single-content-host` — none

**Nó báo cái gì.** `requires` ContractContent, và `rejects` mọi host hay inset bị trùng.

**Nó phát hiện bằng gì.** Bằng JSX anatomy trong auth overlay: `ContractContent` phải có mặt, và số
host cùng số inset phải đúng bằng một.

**Điểm mù.** Một bản trùng không viết trong file này — một host thứ hai đến từ component con
— không nằm trong cây mà luật đếm, và một thẻ host có namespace hay bị đổi alias không phải identifier
mà nó đếm.

**Ranh giới.** Host và inset. Scroll body của modal là `modal-branch-owns-scroll-body`.

## `checkbox-keeps-compound-anatomy` — none

**Nó báo cái gì.** `rejects` — lồng nhau Content → Control → Indicator bị đứt.

**Nó phát hiện bằng gì.** Bằng JSX anatomy: ba phần phải lồng theo đúng thứ tự đó.

**Điểm mù.** Anatomy diễn đạt qua một lớp bọc — một trong ba phần do component khác render,
hoặc sinh ra không qua JSX — không phải cách lồng nhau mà luật đọc được, và phép kiểm tra không nói gì
về việc compound làm gì một khi ba thẻ đã đúng thứ tự.

**Ranh giới.** Chỉ lồng nhau. Vendor dựng nên checkbox là `vendor-boundary`.

## `no-internal-starci-href` — none

**Nó báo cái gì.** `rejects` — một component được canh tự ôm href nội bộ.

**Nó phát hiện bằng gì.** Bằng component được canh, cộng href viết trên nó.

**Điểm mù.** Chỉ các component được canh mới bị theo dõi. Một href ghép lúc chạy, hoặc một
href đặt trong component ngoài tập được canh, đều nằm ngoài phép kiểm tra; và luật xét quyền sở hữu
href chứ không xét đích đến có đúng hay không.

**Ranh giới.** Quyền sở hữu href trong các component được canh. Còn phần tử đó có phải HeroUI Link hay
không là `text-link-uses-hero-link`.

## Cách phát hiện

| Phần | Cơ chế |
|---|---|
| sở hữu theo đường dẫn | Owner được quyết từ đường dẫn file — leaf, named mechanics branch, named SurfaceCard branch — trước khi đọc bất kỳ node nào |
| tier đã xóa | `components/shells` không phải exemption; sự tồn tại của đường dẫn tự nó là phát hiện, không cần import nào |
| danh tính vendor | Vendor là import source `@heroui/react`; thứ gì vào file bằng đường khác thì không phải source đó |
| cả hai chiều | Import vendor sai owner thì nổ, và một named mechanics branch không sở hữu vendor cũng nổ |
| JSX anatomy | Các thẻ có tên và thứ tự lồng nhau — `Modal.Body`, `ContractContent`, Content → Control → Indicator, DropdownBranch → AccountMenu → ShellNav |
| literal class bắt buộc | `p-0` trên `Modal.Body`, khớp đúng như đã viết |
| phần cài đặt | Các predicate node chính xác nằm trong `@canon-fe` và cổng này không nhắc lại |
| twin test | `node --test @canon-fe` |

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này lọt, nhưng không.

| Viết theo cách này | Vì sao vẫn nổ |
|---|---|
| Một file `components/shells` không import vendor nào cả | Phép kiểm tra tier cũ không cần import; đường dẫn chính là phát hiện |
| Một named mechanics branch cố ý giữ sạch vendor | Mechanics branch rỗng bị báo với tư cách riêng, không được cho qua như thể vô hại |
| Một product block đã nối dữ liệu import `Dropdown` từ `@heroui/react` | Block không phải leaf, không phải named mechanics branch, không phải named SurfaceCard branch, nên import đó không có owner |
| Nhận luật ở mức `warn` thay vì `error` | Mọi luật đều được khuyến nghị ở `error`; nhận ở mức cảnh báo là không hợp lệ |
| Một comment suppress đặt trên import sai | Không suppression nào hợp lệ trong cổng này |
| `Modal.Body` trong `ModalBranch/index.tsx` không có `className` nào | Literal là bắt buộc, nên vắng mặt chính là lỗi |

**Đang mở** — chỗ mù đã xuất xưởng. Phán quyết không được nhận là đã xét những chỗ này.

| Phạm vi | Cái gì lọt |
|---|---|
| `vendor-boundary` | **Vendor được re-export qua module cục bộ.** File sai không còn import `@heroui/react`, nên không import nào bị nhìn thấy |
| `vendor-boundary` | **Đổi tên thư mục owner.** Sở hữu quyết theo đường dẫn, nên đổi tên là đổi owner mà không đổi hành vi |
| `modal-branch-owns-scroll-body` | **Một `p-0` ghép lúc chạy**, và **một modal branch thứ hai mang tên khác** — luật giữ đúng một file có tên và đúng một literal viết ra |
| `field-input-uses-secondary-variant`, `field-label-is-text-only`, `no-internal-starci-href` | **Mọi thứ ngoài component được canh.** Field nhà, Icon nhà và tập được canh đều gọi theo tên; một bản thay thế mang tên khác không bị theo dõi |
| `no-surface-branch-in-overlay` | **SurfaceCard vào qua alias, qua re-export hay qua lớp bọc**, và **một surface dựng lại bằng tay ngay trong overlay** |
| `text-link-uses-hero-link` | **Một link tự chế viết theo cách khác**, hoặc giấu cách đó một component |
| `account-control-owns-dropdown`, `checkbox-keeps-compound-anatomy`, `auth-overlay-owns-single-content-host` | **Anatomy diễn đạt qua lớp bọc**, **thẻ có namespace**, và **đổi tên bất kỳ mắt xích có tên nào** — cả ba đều chỉ đọc tên và cách lồng nhau trong một file |
| tất cả | **Chính thiết kế.** Cổng này cố ý không đo thiết kế bằng regex; contract vẫn là nguồn hình dạng và không gì ở đây xét nó |
| tất cả | **Mọi câu của luật sản phẩm mà không luật máy nào ở trên gọi tên.** Mười luật máy xuất xưởng; luật văn xuôi dài hơn thế, và một lần chạy xanh không nói gì về phần còn lại |

Dòng cuối là bản tổng kết trung thực: cổng này chặn những đường source có thể chứng minh là sai, mà
bằng chứng ở đây là một đường dẫn, một import source, một tên thẻ hay một class viết ra — mỗi thứ đều
bị một lần đổi tên bình thường hoặc một lớp gián tiếp hóa giải.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| filename | Đường dẫn đúng như luật thấy, và nó rơi vào tier owner nào |
| quyết định phạm vi | Đường dẫn, file có tên hay component được canh nào đã khớp, hoặc không cái nào khớp |
| import sources | Chuỗi source của từng import, và nó có phải `@heroui/react` không |
| import specifiers | Các specifier có tên, cho phép kiểm tra SurfaceCard và vendor |
| JSX tag names | Các thẻ có tên mà luật anatomy đọc, cùng thứ tự lồng nhau |
| class literals | Thuộc tính class đúng như đã viết, cho `Modal.Body className="p-0"` |
| severity | Mức severity mà repository thật sự đã nhận cho từng luật |

## Quy tắc

1. Danh tính của một luật máy là tên đã xuất bản của nó. Không có định danh dạng số cho luật nào trong
   module này.
2. Sở hữu được giữ bằng đường dẫn, import, JSX anatomy và literal class bắt buộc — không gì khác.
3. Cả hai chiều đều bị ép: import vendor sai owner, và mechanics branch không sở hữu vendor.
4. `components/shells` không phải exemption. Sự tồn tại của đường dẫn đó là lỗi.
5. Ngoài phạm vi nghĩa là luật không tồn tại với file đó, không phải file đã qua.
6. Thiết kế không được đo bằng regex. Contract vẫn là nguồn hình dạng.
7. Mọi luật đều được khuyến nghị ở mức `error`.
8. Không nhận ở mức cảnh báo và không suppression nào là hợp lệ.
9. Twin test `node --test @canon-fe` là bằng chứng các luật vẫn hành xử đúng
   như đã xuất bản.

## Ngoại lệ

Trong code không có cái nào. Exemption duy nhất cổng này từng mang — `components/shells` — đã bị lật
ngược chứ không được giữ: đường dẫn đó không giải phóng gì cả và bây giờ tự nó là một phát hiện.

Không luật nào khai báo allowlist hay opt-out theo file, không luật nào được nhận ở mức `warn`, và
không suppression nào hợp lệ. Repository nào cần một cái là đang đổi luật, và việc đó thuộc về lịch sử
của module — không thuộc về một comment đặt trên import.

## Đầu ra

Mỗi phát hiện một block:

```text
file: <path as the rule sees it, forward slashes>
rule: <published rule name>
scope: <in | out — the path, named file or governed component that decided it>
report: <rejects | requires> at <node>
code: none — this gate publishes no numeric codes
hatch: <the open hatch that would have hidden this, or none>
```

Một file sạch xuất một block cho mỗi luật đã vào phạm vi, với `report: none`. Một file không luật nào
quét tới thì xuất `scope: out` và `report: none` — chưa bị xét, không phải đã sạch.

## Ví dụ đã giải

**Đầu vào.** Hai file mà module này từ chối:

```tsx
// invalid: connected product block imports vendor mechanics
// src/components/blocks/auth/AccountMenu/component.tsx
import { Dropdown } from "@heroui/react"
```

```tsx
// invalid: deleted structural tier
// src/components/shells/Anything/index.tsx
export const Anything = () => null
```

```text
file: src/components/blocks/auth/AccountMenu/component.tsx
rule: vendor-boundary
scope: in — path resolves to a product block, not a leaf, a named mechanics branch or a named SurfaceCard branch
report: rejects at ImportDeclaration "@heroui/react" { Dropdown }
code: none — this gate publishes no numeric codes
hatch: none
```

```text
file: src/components/shells/Anything/index.tsx
rule: vendor-boundary
scope: in — components/shells
report: rejects at file path
code: none — this gate publishes no numeric codes
hatch: none
```

Sau khi sửa, mechanics của dropdown về đúng owner có tên và tier đã xóa biến mất:

```tsx
// valid: named mechanics owner
// src/components/branches/DrawerBranch/index.tsx
import { Drawer } from "@heroui/react"
```

```tsx
// valid: contract owns inset; branch owns scroll body
<Modal.Body className="p-0">
  <ContractContent contract={contract} render={render} />
</Modal.Body>
```

Nhưng một lối thoát đang mở sống sót qua lần sửa đó. Re-export vendor một lần là block import lại được
nó mà không gì bị báo:

```tsx
// src/components/blocks/auth/AccountMenu/component.tsx
import { Dropdown } from "@/lib/ui"
```

```text
file: src/components/blocks/auth/AccountMenu/component.tsx
rule: vendor-boundary
scope: in — path resolves to a product block
report: none
code: none — this gate publishes no numeric codes
hatch: a vendor re-exported through a local module is not an "@heroui/react" import, so the block is invisible rather than compliant
```

## Phạm vi

Module này ghi phần thực thi, không ghi luật. Luật sản phẩm mà nó phục vụ là văn xuôi trong
`../../patterns/vendor-boundary/INDEX.md` và thuộc sở hữu ở đó; hình dạng của một surface thuộc về
contract, không thuộc về phép kiểm tra nào ở đây. Tên luật, import source, literal đường dẫn và
literal class đều xuất hiện trong build output nên được chép lại nguyên văn; mọi thứ viết quanh chúng
chỉ là markup thường và import thường.
