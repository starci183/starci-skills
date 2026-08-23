---
title: Module layering · Vietnamese
---

# Phân tầng module

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | bộ máy backend đã phát hành mà bản ghi này viện dẫn |


## Bản ghi

Pattern này nhận một shape đã được duyệt: một capability đã tồn tại, một module đã được
quyết định là sẽ đăng ký, một symbol mà file khác đã được phép dùng. Không dòng nào ở đây mở lại
những quyết định đó. Kết quả là **kiến trúc source**: specifier gọi tên file nào, tầng nào giữ kiến
thức nào, được import gì, được export gì, và cạnh giữa hai capability được nối ở đâu.

## Luật

Một capability là một thư mục sở hữu **một** chủ thể. Luật này không nói về những gì nằm bên trong
capability; nó nói về **đường nối giữa các capability**: một import được phép gọi tên gì, một
capability được phép nói gì về chính nó, và một phụ thuộc bắc ngang giữa hai capability được nối ở
đâu.

Cả năm mã đều tồn tại vì mọi cách khác đều sinh ra vòng lặp phụ thuộc. Đó không phải loại vòng lặp ồn
ào mà compiler bắt được, mà là loại **im lặng**: capability với tay vào ruột của chính nó qua cửa
chính, một barrel kéo theo cả đồ thị import mà không ai yêu cầu, hoặc một module gọi thẳng sang module
hàng xóm để rồi hai bên không còn khởi động rời nhau được nữa. Vòng lặp kiểu đó không làm gì đỏ lên
ngay. Nó chỉ khiến mọi câu hỏi về sau khó trả lời hơn, cho tới ngày một unit spec khởi động luôn
database driver mà không ai chỉ ra được import nào đã yêu cầu điều đó.

Câu hỏi chốt một ca: **nếu bê file này sang một repository khác cùng với capability của nó, nó có còn
đọc được không?** Nếu file gọi tên một barrel, với ngang sang hàng xóm, hoặc trỏ về chính mình qua
alias công khai thì câu trả lời là không — và lý do là file đó đang giữ một phụ thuộc mà nó chưa bao
giờ khai báo.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi import specifier và mọi khai báo `@Module` đều
thuộc đúng một mã dưới đây. Không có import nào nhỏ đến mức được miễn: một file re-export hai dòng vẫn
thuộc `LAYERING-5`, đúng như một application root thuộc `LAYERING-4`. Câu "có mỗi một symbol, ngay bên
cạnh thôi mà" là nơi luật này bị bỏ qua nhiều nhất, và import ngay bên cạnh đó đúng là cái đã bước qua
một ranh giới.

Hai trong năm mã có lint rule đứng sau; ba mã còn lại chỉ có người đọc. Bảng **Tầng giữ** bên dưới nói
rõ mã nào thuộc loại nào, thay vì để người đọc tưởng cả năm được giữ như nhau.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã `LAYERING-<n>`. Các số là **cố định**: chúng được trích
dẫn từ những luật anh em và từ các bản ghi task cũ, nên đánh số lại là lặng lẽ làm hỏng một trích dẫn
đã có người viết ra.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `LAYERING-1` | Đang lấy một symbol từ capability khác | Import gọi tên file khai báo symbol — specifier đi qua khỏi capability để chạm tới một thứ mở ra được. Cấm: specifier dừng ở thư mục capability, khiến một symbol kéo theo cả đồ thị import của thư mục đó và không người đọc nào biết file nào đang bị phụ thuộc |
| `LAYERING-2` | Đang lấy một symbol từ chính capability của mình | Bên trong một capability, import của chính capability đó là đường tương đối. Cấm: một file với về capability của chính nó qua alias công khai, làm alias mất nghĩa "thứ này đến từ nơi khác" |
| `LAYERING-3` | Hai capability cần biết nhau | Phụ thuộc giữa hai capability được đăng ký ở composition root của ứng dụng. Cấm: `@Module` của một capability import module của capability hàng xóm, tức nối một quyết định trong file mà chủ thể của nó không phải cả hai |
| `LAYERING-4` | Có thứ biết toàn cảnh — có bao nhiêu capability, cái nào global, cái nào chạy trước | Composition root sở hữu việc có những capability nào, cái nào global, và thứ tự khởi động. Cấm: bất kỳ mảnh kiến thức nào trong số đó nằm bên trong một capability, vì đó chính là thứ làm capability không tự khởi động được |
| `LAYERING-5` | Đang quyết định cái gì của capability là công khai | Bề mặt công khai của một capability là tập file nó có ý định cho người khác import, đọc được ngay ở import list của bên gọi. Cấm: một index re-export cả thư mục, biến bề mặt thành một danh sách không ai đọc và biến mọi luật phía trên thành lời gợi ý |

Năm mã, và dừng ở năm. Một tình huống thật sự không có mã là một thay đổi luật được ghi lại, chứ không
phải một số thứ sáu thêm vào cho tiện.

`LAYERING-1` và `LAYERING-5` là cùng một sự việc nhìn từ hai đầu sợi dây. `LAYERING-1` là nghĩa vụ của
bên gọi; `LAYERING-5` là nghĩa vụ của bên bị gọi, và chính nó mới làm cái kia thực thi được — một
barrel đã tồn tại thì sẽ có người import, nên cách bền duy nhất để giữ `LAYERING-1` là không có gì để
import cả. Hai mã vẫn tách nhau vì chúng hỏng ở hai thời điểm khác nhau và do hai người khác nhau sửa:
một specifier sai là một dòng của một bên gọi, còn một barrel là lời mời gửi tới mọi bên gọi sau này.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói gì.** Nó nói rằng một capability tồn tại và sở hữu một chủ thể, rằng một symbol
   được phép dùng, hoặc rằng một module sẽ được đăng ký. Coi những điều đó là đã chốt.
2. **Đọc xem nó không nói gì, và vì thế không giải quyết gì.** Shape đã duyệt không nói import
   specifier là gì, không nói file nào khai báo symbol, không nói cạnh đó có global hay không, và
   không nói thứ tự khởi động. Những thứ đó hoặc được giải ở đây, hoặc được giải một cách tình cờ.
3. **Giải từ ngoài vào trong.** Chốt root trước capability, chốt capability trước file: ứng dụng biết
   gì (`LAYERING-4`), rồi root nối những cạnh nào (`LAYERING-3`), rồi capability phơi ra cái gì
   (`LAYERING-5`), rồi bên gọi gọi tên thế nào (`LAYERING-1`), rồi capability tự gọi tên mình thế nào
   (`LAYERING-2`).
4. **Hỏi câu hỏi của từng mã, lần lượt.** Dữ kiện này có đúng với mọi ứng dụng dùng capability này
   không? Cạnh này là ngang, xuống, vào trong hay là root? Bề mặt có đọc được từ call site không?
   Specifier mở ra một file hay một thư mục? Đích có nằm cùng capability với file nguồn không?
5. **Khi hai mã cùng khớp thì cả hai cùng áp dụng.** Một dòng có thể sai hai lần: alias tự trỏ về mình
   mà lại còn dừng ở thư mục thì thuộc cả `LAYERING-2` lẫn `LAYERING-1`, và phải giải riêng theo từng
   mã. Các mã không phải những ngăn loại trừ nhau; mỗi import specifier và mỗi lần đăng ký module đều
   quy về đúng một mã cho mỗi câu hỏi được đặt ra, và không cạnh nào nằm ngoài phạm vi.

## `LAYERING-1` — import gọi tên file, không gọi tên thư mục

**Khi nào gặp.** Một file cần một symbol nằm ở capability khác. Specifier viết ra phải đi hết đường tới
file khai báo symbol đó, chứ không dừng lại ở tên capability.

**Source phải thể hiện gì.** Một specifier bắc qua capability mà đoạn cuối là một file: khối import
của bên gọi liệt kê đúng những phụ thuộc thật của file, và mở thẳng ra được từng cái một.

**Cách nhận ra.**

- Specifier kết thúc ngay sau tên capability, không còn đoạn nào phía sau.
- Có một file trong capability đó tồn tại chỉ để `export ... from` những file khác.
- Đọc cả khối import mà không biết được file nào thật sự bị phụ thuộc.
- Tự hỏi: nếu mở đúng đường dẫn vừa viết, tôi mở ra một file hay một thư mục?
- Bẫy category folder: có những thư mục chứa capability chứ bản thân không phải capability
  (`platform/`, `lib/`, `integrations/`, và ở nhiều cây còn có `databases/`). Dưới những thư mục đó,
  tên capability là đoạn **thứ hai**, nên độ sâu để được coi là "đã chạm tới file" sâu hơn một đoạn, và
  một specifier dừng ở `<category>/<capability>` vẫn là barrel dù trông đã có hai đoạn.

**Ranh giới.** Đây không phải `LAYERING-2`: `LAYERING-1` hỏi specifier **dừng ở đâu**, còn `LAYERING-2`
hỏi specifier có **được phép là alias hay không** — một dòng có thể sai cả hai: alias của chính mình,
lại còn dừng ở thư mục. Cũng không phải `LAYERING-5`: `LAYERING-1` là nghĩa vụ của bên gọi, còn
`LAYERING-5` là nghĩa vụ của bên bị gọi, nên bên gọi có thể viết đúng suốt đời trong khi bên bị gọi vẫn
để sẵn một barrel — và cái barrel đó sẽ được import, chỉ là chưa.

**Tình huống nghiệp vụ hay gặp.** Lấy một service dùng chung; lấy một enum của tầng dữ liệu; lấy một
exception class; lấy một hằng số cấu hình; lấy một type dùng ở biên; một `export ... from` bắc cầu sang
capability khác.

## `LAYERING-2` — bên trong capability thì đi đường tương đối

**Khi nào gặp.** File đang nằm trong một capability và cần một file khác cũng của capability đó. Đường
đi phải là tương đối.

**Source phải thể hiện gì.** Mọi thứ nội bộ đi bằng specifier tương đối (`./`), còn alias công khai
chỉ xuất hiện trên những dòng thật sự rời khỏi capability — nên đổi tên capability không đụng tới một
import nội bộ nào của chính nó.

**Cách nhận ra.**

- Alias công khai xuất hiện trên một dòng mà file đích nằm cùng capability với file nguồn.
- Thư mục capability xuất hiện hai lần trên cùng một đường: một lần vì file đang ở đó, một lần trong
  specifier.
- Đổi tên capability thì phải sửa cả những import nội bộ của chính nó.
- Tự hỏi: file đích có nằm trong cùng thư mục capability với file tôi đang viết không? Nếu có, đường
  phải là `./`.
- Vì sao alias tự trỏ về mình lại nguy hiểm: alias tồn tại để báo hiệu "thứ này đến từ nơi khác". Dùng
  nó cho thứ không đến từ nơi khác là cách nhanh nhất để tín hiệu đó mất nghĩa; sau đó không ai còn đọc
  alias như một ranh giới nữa, và ranh giới không đọc được là ranh giới không có.

**Ranh giới.** Đây không phải `LAYERING-1` — xem trên. Cũng không phải `LAYERING-3`: `LAYERING-2` nói
về specifier trong một file bất kỳ, còn `LAYERING-3` nói về cạnh giữa hai `@Module`. Sai `LAYERING-3`
thì luôn đi kèm một specifier bắc ngang, còn sai `LAYERING-2` thì không bắc ngang đi đâu cả — nó chỉ đi
vòng.

**Tình huống nghiệp vụ hay gặp.** Module file nạp provider của chính nó; service gọi service anh em;
util nội bộ; type nội bộ; file định nghĩa module option; spec đứng cạnh file nó kiểm.

## `LAYERING-3` — cạnh bắc ngang được nối ở composition root

**Khi nào gặp.** Hai capability cần biết nhau. Phải có một chỗ nào đó biết cả hai, và chỗ đó là root của
ứng dụng, nơi mà công việc của nó chính là biết ứng dụng gồm những gì.

**Source phải thể hiện gì.** Cả hai capability được đăng ký trong danh sách module của root, và hai
module capability mà không bên nào gọi tên bên kia.

**Cách nhận ra.**

- Trong `imports:` của một capability `@Module` xuất hiện `@Module` của capability khác.
- Quyết định "hai thứ này đi cùng nhau" được ghi ở một file mà chủ thể của nó không phải cả hai.
- Muốn khởi động một capability để dò lỗi thì phải kéo theo cả capability kia.
- Tự hỏi: file tôi đang viết có phải là nơi sở hữu câu hỏi "ứng dụng này gồm những gì" không? Nếu
  không, cạnh này không được nối ở đây.
- Vì sao không nối thẳng: hai capability nối thẳng thì không còn khởi động rời nhau được, và thứ đầu
  tiên người ta muốn làm khi có sự cố là khởi động một mảnh để xem mảnh đó có sống không.

**Ranh giới.** Đây không phải cạnh đi xuống: nếu module bị import là con của chính capability này thì
đó là lồng nhau, và lồng nhau thì được — mã này nói về cạnh **ngang**, không nói về cạnh **xuống**, và
một aggregator gom các module con rồi export lại là hợp lệ. Cũng không phải `LAYERING-4`: `LAYERING-3`
nói cạnh không được nối ở đâu, còn `LAYERING-4` nói cái gì khác cũng chỉ được biết ở root. Bỏ
`LAYERING-4` thì `LAYERING-3` thành một luật hình thức: cạnh đi lên root, còn thứ tự khởi động vẫn nằm
rải rác dưới các capability.

**Tình huống nghiệp vụ hay gặp.** Một capability nghiệp vụ cần client của một tích hợp; một feature cần
service dùng chung; hai capability cùng cần một broker; một capability cần cache; một processor cần
entity manager.

## `LAYERING-4` — chỉ root được biết toàn cảnh

**Khi nào gặp.** Có những dữ kiện về cả ứng dụng: có bao nhiêu capability, cái nào đăng ký global, cái
nào phải nạp trước cái nào, capability này được cấu hình khác đi trong ứng dụng nào. Toàn bộ những dữ
kiện đó thuộc về root.

**Source phải thể hiện gì.** Việc đăng ký và cấu hình theo từng ứng dụng được viết ở từng root, kể
cả khi cùng một capability được hai root đăng ký với hai câu trả lời khác nhau; và kiến thức thứ tự
khởi động nằm trong file mà chủ thể của nó chính là cái toàn cảnh.

**Cách nhận ra.**

- Một capability tự tuyên bố mình `isGlobal` thay cho ứng dụng.
- Có một comment kiểu "phải import trước X" nằm trong một file thuộc capability.
- Cùng một capability cần hai cấu hình khác nhau ở hai ứng dụng, và cấu hình đó đang bị chôn bên trong
  capability.
- Tự hỏi: dữ kiện này có đúng với **mọi** ứng dụng dùng capability này không? Nếu không, nó không phải
  kiến thức của capability.
- Vì sao đây là mã riêng chứ không gộp vào `LAYERING-3`: vì hỏng theo hai cách khác nhau. Sai
  `LAYERING-3` làm hai capability dính nhau. Sai `LAYERING-4` làm **một** capability không tự khởi động
  được, và không cần capability thứ hai nào tham gia thì lỗi đó vẫn xảy ra.

**Ranh giới.** Đây không phải `LAYERING-3` — xem trên. Cũng không phải `LAYERING-5`: `LAYERING-4` nói
ai được biết toàn cảnh, còn `LAYERING-5` nói mỗi capability phơi ra cái gì. Một capability có thể phơi
ra đúng mà vẫn giấu kiến thức thứ tự khởi động trong ruột nó.

**Tình huống nghiệp vụ hay gặp.** Root của app chính và root của một CLI cấu hình cùng một capability
khác nhau; một side-effect import bắt buộc phải chạy trước; danh sách module global; thứ tự nạp env
trước mọi thứ; một root ghi lại nó cố tình không kéo theo cái gì.

## `LAYERING-5` — bề mặt công khai là những file có ý định cho người khác import

**Khi nào gặp.** Đang quyết định cái gì của capability này là công khai. Câu trả lời là: những file mà
ta có ý định để người khác import. Không có index nào re-export cả thư mục; bên gọi tự gọi tên file.

**Source phải thể hiện gì.** Không có `index.ts` nào trong capability, và một alias mapping không có
barrel nào để resolve tới — nên bề mặt chỉ đọc được từ import list của những nơi gọi nó.

**Cách nhận ra.**

- Có một file mà toàn bộ nội dung là `export ... from`.
- Thêm một file vào thư mục làm bề mặt công khai rộng ra mà không ai quyết định điều đó.
- Muốn biết capability này phơi ra cái gì thì phải mở một file danh sách, thay vì đọc call site.
- Tự hỏi: bề mặt của capability này đang được đọc ở import list của những nơi gọi nó, hay đang được
  khai báo trong một file mà không ai mở?
- Vì sao bề mặt nên nằm ở call site: vì như thế một phụ thuộc nhầm hiện ra dưới dạng một dòng import
  trông lạ — thứ mà người review nhìn phát biết. Còn khi bề mặt nằm trong barrel, phụ thuộc nhầm chỉ là
  thêm một cái tên vào một danh sách dài, mà danh sách dài thì không ai đọc.

**Ranh giới.** Đây không phải `LAYERING-1` — xem trên; hai mã đó là hai đầu của cùng một sợi dây. Cũng
không phải `LAYERING-4` — xem trên.

**Tình huống nghiệp vụ hay gặp.** Thêm một service mới vào capability; gom "cho gọn import"; dựng một
public API cho một tầng dùng chung; re-export một type để đỡ phải viết đường dài; một thư mục util có
nhiều hàm nhỏ.

## Tầng giữ

Mỗi mã hiện được giữ ở tầng nào. `unrepresentable` nghĩa là một closed union hoặc branded type làm cho giá
trị sai không viết ra được; `enforced` nghĩa là có một lint rule trong `@canon-be`
bắt được; `documented` nghĩa là không có gì cơ học giữ nó, chỉ có người đọc giữ.

| Mã | Tầng | Cái gì giữ |
|---|---|---|
| `LAYERING-1` | `enforced` | `must-deep-module-import` (export `mustDeepModuleImport`) |
| `LAYERING-2` | `enforced` | `no-self-module-alias` (export `noSelfModuleAlias`) |
| `LAYERING-3` | `documented` | — |
| `LAYERING-4` | `documented` | — |
| `LAYERING-5` | `documented` | — |

**Hai mã enforced, ba mã documented, không mã nào unrepresentable.** Cột `unrepresentable` trống là do
cấu trúc chứ không phải do bỏ sót: một import specifier là một chuỗi nằm ở vị trí mà hệ kiểu resolve
nhưng không ràng buộc, còn mảng `imports` của decorator `@Module` được đánh kiểu là module chứ không
phải là những cạnh được phép. Không viết ra được closed union nào mà phần tử của nó là "những specifier
file này được phép gọi tên", bởi tập được phép phụ thuộc vào chỗ file đang nằm — đúng cái đầu vào mà
một kiểu không có quyền truy cập.

Hai dòng enforced cũng là hai dòng hẹp nhất, và hẹp theo cùng một hướng: chúng đọc một specifier đối
chiếu một tên file, và không thấy gì khác. `must-deep-module-import` chỉ soi ba alias của repository,
nên một specifier tương đối gọi tên thư mục là vô hình với nó. `no-self-module-alias` cần biết file
đang import thuộc capability nào, và nó học điều đó bằng cách tách đường dẫn theo một danh sách cố định
các category folder — nên một category folder mà danh sách không biết sẽ bị đọc thành capability, và
rule trả lời rất tự tin nhưng sai. Một bảng tầng làm tròn "một phần" lên thành "enforced" chính là kiểu
hỏng mà luật này đang nói tới.

`LAYERING-3` ở đây là `documented`, và đó là một chỗ cố tình bỏ trống trong canon chứ không phải sơ
suất. Quyết định xem một module bị import là capability hàng xóm hay là con lồng bên trong thì cần đồ
thị module, mà một rule đọc từng file một thì không thấy được. Repository nào áp dụng luật này nên port
rule đó thành một gate đi khắp cây và được giới hạn bằng path glob — gate glob của chính repository
tham chiếu được ghi ở **Điểm neo** bên dưới. Đó là enforcement thật, nhưng không phải của canon, nên
bảng này không nhận về mình.

Những tầng phải giữ mình không biết cũng suy ra từ chính bảng đó: một capability không được giữ kiến
thức có những ứng dụng nào, capability nào global hay cái gì chạy trước; một capability không được giữ
cạnh sang capability hàng xóm; và capability bị gọi không được giữ một danh sách tự khai bề mặt của
chính nó.

## Điểm neo

Code thật để đối chiếu từng luật. Một luật không chỉ vào đâu được thì chỉ là một đề xuất.

| Mã | Điểm neo | Cần nhìn cái gì |
|---|---|---|
| `LAYERING-1` | `apps/core/src/app.module.ts` | Sáu mươi hai specifier dùng alias và không cái nào dừng ở một capability. Đọc `@modules/ai/ai.module` ngay cạnh `@modules/platform/exceptions/filters/abstract-exception-http.filter`: cùng một luật, và độ sâu tính là "đã chạm file" lệch nhau một đoạn vì `platform` là category folder còn `ai` là capability |
| `LAYERING-1` | `modules/ai/ai-invoke.service.ts` | Mọi specifier bắc qua capability đều kết ở một file — `@modules/platform/env/config`, `@modules/databases/postgresql/primary/enums/model-provider`. Người đọc liệt kê được phụ thuộc thật của service này từ khối import mà không phải mở gì thêm |
| `LAYERING-2` | `modules/ai/ai-invoke.service.ts` | Vẫn khối import đó, nhưng đọc phần KHÔNG có: các service anh em là `./ai-entitlement.service`, `./balancer/use-api.service`, `./utils/openrouter-cache-headers`, và không có `@modules/ai/...` ở bất cứ đâu trong file. Alias chỉ xuất hiện trên những dòng thật sự rời khỏi capability |
| `LAYERING-2` | `modules/ai/ai.module.ts` | Một module nối bốn provider, hai module lồng bên trong và class option của chính nó — bảy specifier, tất cả đều tương đối. Đây là file mà self-alias cám dỗ nhất, vì module file chính là nơi một capability mô tả chính nó |
| `LAYERING-3` | `apps/core/src/app.module.ts` | `AiModule.register({ isGlobal: true })` và `MembershipModule.register({ isGlobal: true })` trong cùng một danh sách. Rồi mở cả hai module capability và xác nhận không bên nào gọi tên bên kia: cạnh đó tồn tại, và nó tồn tại ở đây |
| `LAYERING-3` | `eslint.config.mjs`, các khối config giới hạn vào `modules/**/*.module.ts` và `features/**/*.module.ts` | Gate đi khắp cây mà canon nói nên port, kèm comment burn-down ghi lại mười bảy vi phạm giảm về không và ba cái cuối cùng cần gì. `apps/*/src/**` cố tình nằm ngoài glob, tức là luật tự phát biểu ngay trong cấu hình rằng root là ngoại lệ |
| `LAYERING-3` | `modules/bussiness/bussiness.module.ts` | Cạnh đi xuống mà mã này cho phép: một aggregator import các con của chính nó bằng đường tương đối rồi export lại. Lồng nhau không phải cạnh ngang mà mã này từ chối, và chính file này là lý do phải viết ra sự phân biệt đó |
| `LAYERING-4` | `apps/core/src/app.module.ts` · `apps/cli/src/app.module.ts` | Cùng một capability được hai root đăng ký với hai câu trả lời khác nhau — `PrimaryPostgreSQLModule.register({ withResolvers: true })` đối với `{ withResolvers: false })`. Không câu trả lời nào viết được bên trong capability, vì capability không biết nó đang được khởi động vào ứng dụng nào |
| `LAYERING-4` | `apps/core/src/main.ts` | Câu lệnh đầu tiên trong file là một side-effect import bắt buộc phải đứng trước mọi import khác, kèm comment nói vì sao. Thứ tự khởi động là kiến thức về cái toàn cảnh, và nó được giữ trong file mà chủ thể chính là cái toàn cảnh |
| `LAYERING-4` | `apps/cli/src/app.module.ts`, comment doc của class | Một root ghi lại nó cố tình KHÔNG kéo theo cái gì, và subcommand nào làm mỗi lần thêm vào trở nên cần thiết. Lập luận đó chỉ phát biểu được ở root; bên trong capability không có "ứng dụng nào" để mà nói tới |
| `LAYERING-5` | `src/` | Không có file `index.ts` nào trong toàn bộ cây source. Bề mặt của mọi capability vì thế chỉ đọc được từ import list của những nơi gọi nó, đúng như mã này khẳng định |
| `LAYERING-5` | `tsconfig.json`, khối `paths` | `@modules/*` ánh xạ tới `./src/modules/*` và không gì khác, nên một specifier kiểu barrel không có file nào để resolve tới. Đọc dòng này cùng dòng trên: chính sự vắng mặt mới làm ánh xạ an toàn, chứ không phải ánh xạ |

Mọi mã đều đã có neo. Không dòng nào ghi "chưa neo được".

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| specifier | Chuỗi import chính xác, và nó là một alias của repository, một đường tương đối, hay một package đã công bố |
| importer | Đường dẫn của file đang import, vì đó là thứ quyết định capability nào là "chính mình" |
| capability | Thư mục sở hữu chủ thể — và, dưới một category folder, đoạn nào là tên của nó |
| edge | Vào trong, đi xuống, bắc ngang, hay root: phụ thuộc này bước qua ranh giới capability, đi xuống bên trong một capability, hay là root đang biết cái toàn cảnh |
| registration | Với một `@Module`: nó được đăng ký ở đâu, có global không, và mang cấu hình riêng nào cho từng instance |
| surface | Những file nào của capability bị gọi là có ý định cho người khác import, đọc từ call site thật |

## Quy tắc

1. Import specifier chạm tới một file, không bao giờ dừng ở thư mục capability.
2. Dưới một category folder, capability là đoạn thứ hai, nên "đã chạm file" sâu hơn một đoạn.
3. Bên trong một capability, import của chính capability đó là đường tương đối.
4. Alias công khai chỉ xuất hiện trên những dòng thật sự rời khỏi capability.
5. `@Module` của một capability không import module của capability hàng xóm.
6. Có những capability nào, cái nào global và cái gì chạy trước chỉ được phát biểu ở composition root.
7. Không file nào re-export cả một thư mục.
8. Một capability bê sang repository khác cùng thư mục của nó vẫn resolve được mọi import nó khai báo.
9. Mọi import specifier và mọi lần đăng ký module đều quy về đúng một mã. Không cạnh nào ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là một phần của luật, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp dụng
vào.

- **Cạnh đi xuống được giữ.** `LAYERING-3` nói về cạnh **ngang**. Capability import module con lồng
  bên trong chính nó, và aggregator gom rồi export lại các module bên dưới, đều là cạnh **xuống** —
  bên import đã sở hữu chủ thể rồi. Cấm những cạnh đó thì capability không còn lắp ráp được, mà đó
  không phải mục đích của bất cứ dòng nào ở đây.
- **Composition root được miễn `LAYERING-3` theo định nghĩa.** Biết về hai capability cùng lúc ở đó
  không phải vi phạm; đó chính là chủ thể của root, đúng như `LAYERING-4` nói. Vì vậy application root
  nằm ngoài glob thực thi luật cấm bắc ngang.
- **Entry point của package bên ngoài không phải barrel.** `LAYERING-1` chỉ nói về alias của chính
  repository. Entry point của một package bên thứ ba là bề mặt do họ công bố, và đồ thị phía sau là
  quyết định của họ; gọi tên một file bên trong package của người khác mới là bước qua ranh giới họ đã
  vẽ — tức là làm ngược đúng điều mã này yêu cầu.
- **Category folder không phải capability.** Cả `LAYERING-1` lẫn `LAYERING-2` đều đọc sâu thêm một
  đoạn dưới thư mục chỉ chứa capability. Specifier dừng ở `<category>/<capability>` vẫn là barrel, và
  một file nằm dưới đường đó là "chính mình" với cả dạng dài lẫn dạng ngắn của tên capability.
- **Module file được phép nhắc lại tên thư mục của nó.** `LAYERING-2` nói về alias, không nói về việc
  lặp từ: module file của một capability đương nhiên mô tả capability đó. Nó mô tả bằng đường tương
  đối, và phần lặp lại chính là chủ thể, không phải mùi lỗi.

## Đầu ra

Mỗi file mà shape sinh ra là một khối.

```text
specifier: <the import string, or the module being registered>
importer: <path of the file that declares it>
capability: <the folder that owns the subject>
edge: <inward | downward | sideways | root>
situation: <LAYERING-1 … LAYERING-5>
reason: <the cycle or the un-startable piece the choice refuses>
```

## Ví dụ đã giải

**Shape đã duyệt.** Một service gọi AI nằm trong capability `ai` được phép dùng một enum model-provider
do tầng dữ liệu sở hữu và một service entitlement anh em của chính capability đó, và capability `ai`
được ứng dụng core đăng ký ở dạng global.

Shape nói rằng capability tồn tại, rằng các symbol đó được phép dùng, và rằng lần đăng ký này là
global. Nó **không** nói import specifier là gì, không nói file nào khai báo enum, không nói module
`ai` có được gọi tên module của tầng dữ liệu hay không, và không nói chữ "global" được viết ở đâu — nên
shape không giải quyết những điều đó, và tất cả được giải ở đây.

```text
specifier: @modules/databases/postgresql/primary/enums/model-provider
importer: src/modules/ai/ai-invoke.service.ts
capability: databases/postgresql/primary
edge: inward
situation: LAYERING-1
reason: the specifier ends at the declaring file rather than at the capability folder; this is not LAYERING-5 because the fact that decides it is the caller's own line, not anything the callee publishes, and under a category folder the capability is the second segment so the depth required is one segment deeper
```

```text
specifier: ./ai-entitlement.service
importer: src/modules/ai/ai-invoke.service.ts
capability: ai
edge: downward
situation: LAYERING-2
reason: the target sits in the same capability as the importer, so the public alias would stop meaning "this comes from elsewhere"; this is not LAYERING-1 because the fact that decides it is that importer and target share a capability, and the path crosses to nowhere at all
```

```text
specifier: AiModule.register({ isGlobal: true })
importer: apps/core/src/app.module.ts
capability: ai
edge: root
situation: LAYERING-4
reason: whether this capability is global is a fact about one application and not true of every application using it, so it is written at the root; this is not LAYERING-3 because no second capability takes part — the failure it refuses is one capability that can no longer start alone
```

## Phạm vi

Luật này đúng với mọi back end lắp từ các thư mục capability đứng sau path alias, cùng một composition
root khởi động chúng. Ví dụ đều là TypeScript thường trong một ứng dụng hình dáng NestJS: chúng không
gọi tên sản phẩm nào, repository nào hay module riêng nào. Hai rule id là danh từ riêng duy nhất trong
phần luật, vì một rule id là một danh tính thực thi và một rule đã đổi tên thì không trích dẫn được
trong config. Đường dẫn repository chỉ xuất hiện ở **Điểm neo** và không ở đâu khác — một điểm neo bắt
buộc phải là đường dẫn thật, và chính điều đó làm nó thành điểm neo.
