---
title: Module-layering · Vietnamese
---

# Phân tầng mô-đun

Đầu vào là mã đã viết xong — một tệp, một mảnh diff. Đầu ra là một **phán quyết**: tệp có nằm trong
phạm vi hay không, quy tắc đã xuất bản nào nổ, nổ trên specifier nào, ứng với mã luật nào, và cửa nào
còn mở đủ để giấu đúng cái lỗi ấy. Mô-đun này không chọn bố cục nào cả. Nó từ chối một bố cục, và nó
phải chỉ được ra đúng specifier mà nó từ chối.

## Luật

Luật nói về **đường nối giữa các năng lực**: một lần import được phép gọi tên cái gì, và một năng lực
được phép nói gì về chính nó. Một lần import gọi tên tệp khai báo ký hiệu, không bao giờ gọi tên một
thư mục tái xuất hộ; và bên trong một năng lực, import đi bằng đường tương đối chứ không vòng qua
alias công khai của chính năng lực đó.

Luật có **năm** mã. **Hai mã có quy tắc giữ.** Nguồn xuất đúng hai quy tắc trong `rules` và đúng hai
trong `recommended`, hai danh sách khớp nhau, và cả hai đều đòi mức `error`. Ba mã còn lại không có
gì giữ.

Một trong ba mã đó bị bỏ ra **một cách cố ý và nguồn nói thẳng điều đó**: muốn biết một mô-đun được
import là năng lực anh em hay là con lồng bên trong thì phải có đồ thị mô-đun, mà quy tắc đọc từng tệp
một thì không thấy. Đó là hình dạng thật thà của ranh giới này — cả hai quy tắc đều là xử lý chuỗi
thuần trên một specifier, vừa là lý do chúng được để ở mức `error` mà không cần ngân sách báo nhầm,
vừa là lý do mọi thứ cần tới tệp thứ hai đều nằm ngoài tầm với.

## Luật máy đã xuất bản

| Quy tắc | Mã | Nó báo cái gì |
|---|---|---|
| `must-deep-module-import` | `LAYERING-1` | `barrel` trên một specifier có alias mà không còn đoạn nào sau tên năng lực — `@modules/<tên>`, `@features/<tên>`, `@tests/<tên>`, chỉ mỗi tiền tố, và `@modules/<thư mục nhóm>/<tên>` với thư mục nhóm là một trong ba tên có trong danh sách |
| `no-self-module-alias` | `LAYERING-2` | `self` trên một specifier với về **chính** năng lực của tệp đang import, đi qua alias công khai của năng lực đó; "chính nó" được suy ra từ đường dẫn tệp |

`LAYERING-3` (một mô-đun năng lực import mô-đun của năng lực anh em thay vì nối dây ở composition
root), `LAYERING-4` (composition root là nơi duy nhất biết toàn cục) và `LAYERING-5` (bề mặt công
khai của một năng lực là những tệp nó có ý cho người khác import) **không có quy tắc nào giữ**. Chúng
là chưa được cưỡng chế chứ không phải đã được bao phủ, và một lần chạy xanh không nói gì về cả ba.

`LAYERING-5` đáng được ghi chú gắt nhất, vì nó trông như đã được giữ mà thật ra không.
`must-deep-module-import` giữ **nửa bên gọi**: không ai được *import* một barrel qua alias. Không gì
giữ **nửa bên khai báo**: viết một `index.ts` tái xuất cả thư mục thì không bị báo, và một khi tệp đó
tồn tại thì mọi đường tương đối và mọi đường không-alias tới nó đều hợp lệ. Quy tắc làm cho barrel
bất tiện để với tới, chứ không làm cho barrel không thể viết ra. Ai đọc bảng trên rồi kết luận "đã
cấm được barrel" là đã đọc sai một mức.

## Đọc một diff

1. **Quyết định phạm vi trước mọi thứ khác, và ghi lại.** Với `no-self-module-alias`, một tệp mà
   đường dẫn không chứa `/src/modules/`, `/src/features/` hay `/src/tests/` sẽ nhận **bộ thăm rỗng** —
   ngoài phạm vi không có nghĩa là tệp đã qua, mà có nghĩa quy tắc không tồn tại với tệp đó.
   `must-deep-module-import` không bao giờ đọc `context.filename` nên nó có phạm vi ở khắp nơi.
2. **Kiểm các miễn trừ.** Một `export { X }` cục bộ không có `source` thì bị bỏ qua. Một specifier
   không phải `string` — template literal, nguồn tính toán ra — cũng bị bỏ qua. Một tệp ở composition
   root, ngoài mọi cây năng lực, được `no-self-module-alias` thả hoàn toàn.
3. **Đọc các nút.** Với cả hai quy tắc chỉ có ba vị trí specifier tĩnh: `ImportDeclaration`,
   `ExportNamedDeclaration` có `source`, và `ExportAllDeclaration`. Mọi dạng động đều nằm ngoài tầm
   với ngay từ cấu tạo, nên hãy đọc dạng nút trước khi đọc chuỗi.
4. **Xuất một khối cho mỗi phát hiện.** Một specifier có thể mang hai phát hiện: một barrel tự trỏ bị
   cả hai quy tắc báo, độc lập với nhau.
5. **Viết dòng cửa mở mỗi khi có một cửa mở đủ sức giấu đúng cái lỗi ấy.** Một phán quyết `silent` là
   một kết quả thật và phải được báo cáo. "Cổng xanh" và "quy tắc đã nhìn" là hai câu khác nhau, và
   chỉ một trong hai là bằng chứng.
6. **Đừng báo cái mà không quy tắc nào canh.** Ba trong năm mã không có máy giữ; một phán quyết nói
   khác đi là nói sai về mô-đun này.

## `must-deep-module-import` — LAYERING-1

**Nó báo cái gì.** `barrel` — một specifier gọi tên **một năng lực và không tệp nào**. `@modules/ai`
thay vì `@modules/ai/ai-invoke.service`. Mỗi specifier phạm luật là một lần báo.

**Nó phát hiện bằng gì.** Thăm `ImportDeclaration`, cùng với `ExportNamedDeclaration` và
`ExportAllDeclaration` khi `node.source` tồn tại. Đọc `node.source.value` và thoát trừ khi `typeof`
là `string`. Tìm mục đầu tiên trong mảng `ALIASES` ba phần tử mà specifier `startsWith` tiền tố của
nó: `@modules/`, `@features/`, `@tests/`. Cắt tiền tố ra, báo ngay khi phần còn lại rỗng, ngược lại
tách phần còn lại theo `/` và so `parts.length` với `barrelDepth` bằng `1` — hoặc bằng `2` khi alias
là `metaAware` (chỉ `@modules/`) **và** `parts[0]` nằm trong `Set` ba tên `META_ROOTS`: `platform`,
`lib`, `integrations`. `parts.length <= barrelDepth` thì báo. Nó không bao giờ đọc `context.filename`.

**Nó không thấy gì.** Nó đếm **số đoạn**, không bao giờ đếm cái mà đoạn cuối trỏ tới. `@modules/ai/index`
là hai đoạn nên đi lọt — gọi thẳng tên tệp barrel là đường đi lọt sạch sẽ nhất qua chính quy tắc sinh
ra để cấm barrel. `@modules/ai/services` khi `services/` có `index.ts` cũng là khe hở đó và là dạng
hay gặp hơn nhiều: với một quy tắc không bao giờ phân giải gì, một thư mục barrel lồng bên trong không
phân biệt nổi với một tệp. `@modules/ai/` tách ra `["ai", ""]` — hai đoạn, và đoạn rỗng không bao giờ
được kiểm. `@modules//ai` và `@modules/./ai` là cùng một phép đếm. Một specifier tương đối không có
tiền tố alias nào, nên một barrel liên năng lực gọi bằng đường tương đối là vô hình. `ALIASES` và
`META_ROOTS` mỗi thứ là ba tên viết tay: thêm một alias thứ tư hay một thư mục nhóm thứ tư là có ngay
một cây không được cưỡng chế, im lặng, không tín hiệu nào. Và nhận biết thư mục nhóm chỉ thuộc về
`@modules/`, nên dưới `@features/` và `@tests/` một thư mục nhóm bị coi là năng lực và mọi barrel dưới
nó đi lọt.

**Ranh giới.** Quy tắc này phán về hình dạng của một specifier. Chuyện specifier đó có trỏ ngược về
chính năng lực của tệp đang import hay không là `LAYERING-2`. Chuyện barrel có được phép *viết ra*
hay không thì không gì giữ.

## `no-self-module-alias` — LAYERING-2

**Nó báo cái gì.** `self` — một tệp nằm trong năng lực `ai` mà với tay lấy `@modules/ai/...`. Đó là
năng lực nói chuyện với chính mình qua cửa trước của mình. Mỗi specifier phạm luật là một lần báo.

**Nó phát hiện bằng gì.** Đọc `context.filename || context.getFilename()` một lần lúc `create` và đổi
`\` thành `/`. Duyệt cùng mảng `ALIASES` theo thứ tự khai báo, lấy `lastIndexOf` của từng `root` —
`/src/modules/`, `/src/features/`, `/src/tests/` — và root đầu tiên tìm thấy thì thắng. Tách phần đuôi
đường dẫn theo `/` để suy ra khoá tự thân: bình thường là `[parts[0]]`, hoặc `["<nhóm>/<tên>", "<tên>"]`
khi alias là `metaAware`, `parts[0]` là một thư mục nhóm và còn ít nhất hai đoạn. Không root nào khớp
thì trả về **bộ thăm rỗng**. Còn lại thì thăm cùng ba loại nút, đòi specifier `startsWith` đúng tiền
tố alias đó, và báo khi phần còn lại `=== key` hoặc `startsWith(key + "/")` với bất kỳ khoá nào.

**Nó không thấy gì.** `@modules//ai/x` và `@modules/./ai/x` để lại phần còn lại là `"/ai/x"` và
`"./ai/x"`, không khớp `key` cũng không khớp `key + "/"`. Với **vào** một năng lực khác bằng đường
tương đối — `../../billing/billing.service` từ trong `modules/ai/` — là một lần vượt ranh giới không
có alias nào để báo, mà quy tắc chỉ soi những specifier có tiền tố alias. Một cây năng lực đặt ở
`apps/api/modules/`, `module/`, hay bất kỳ đường dẫn nào không chứa đúng cặp đoạn `/src/modules/`
thì không tìm thấy root và không được kiểm chút nào; hình dạng thư mục là thứ rẻ nhất trong một kho mã
để đổi, mà ở đây nó chịu lực. Một tệp viết thẳng ở `modules/platform/config.ts` cho ra khoá tự
thân `["platform/config.ts", "config.ts"]` — tên tệp nằm ở chỗ đáng lẽ là tên năng lực — và vì không
specifier nào mang đuôi `.ts`, quy tắc tắt hẳn với tệp đó trong khi trông vẫn như đang bật. Khoá ngắn
dưới thư mục nhóm không mang tên nhóm, nên từ trong `modules/platform/exceptions/` một import tới
`@modules/exceptions/...` thật sự khác vẫn bị báo là tự trỏ: quy tắc bắn vào mã đúng, và thói quen nó
dạy người đọc là cuộn qua nó. Còn một lần tự trỏ đi vòng qua tệp thứ ba tái xuất hộ thì là hai dòng
import đều đúng khi đọc riêng, và không quy tắc một-tệp nào thấy được vòng đó.

**Ranh giới.** Quy tắc này suy ra năng lực từ **đường dẫn**, nên nó chỉ đúng đúng bằng mức mà bố cục
thư mục còn giống lúc nó được viết ra. Chuyện specifier có gọi tên một barrel hay không là `LAYERING-1`.

## Cách phát hiện

| Bộ phận | Cơ chế |
|---|---|
| tập nút | Cả hai quy tắc chỉ thấy `ImportDeclaration`, `ExportNamedDeclaration` có `source`, và `ExportAllDeclaration`. `ExportNamedDeclaration` được canh bằng `if (node.source)` |
| đọc specifier | `node.source.value`, và chỉ khi `typeof` là `string` |
| cổng đường dẫn | `must-deep-module-import` không có cổng nào — nó không bao giờ đọc `context.filename`. `no-self-module-alias` đọc một lần lúc `create`, đổi `\` thành `/`, rồi lấy `lastIndexOf` của `/src/modules/`, `/src/features/`, `/src/tests/`; root đầu tiên tìm thấy thì thắng |
| bảng alias | `ALIASES`, ba mục `{ prefix, root, metaAware }` viết cứng, duyệt theo thứ tự khai báo: `@modules/`, `@features/`, `@tests/`. Chỉ `@modules/` là `metaAware` |
| thư mục nhóm | `META_ROOTS`, một `Set` đóng ba phần tử: `platform`, `lib`, `integrations` |
| phép đếm độ sâu | Phần còn lại rỗng thì báo ngay; ngược lại tách theo `/` rồi so `parts.length` với `barrelDepth` bằng `1`, hoặc bằng `2` dưới một alias `metaAware` có `parts[0]` là thư mục nhóm |
| phép khớp tự thân | Phần còn lại `=== key` hoặc `startsWith(key + "/")`, nên một năng lực chỉ tình cờ có tên bắt đầu giống năng lực khác thì không bị quét nhầm |
| ngoài phạm vi | `no-self-module-alias` trả về một bộ thăm rỗng. Quy tắc không tồn tại với tệp đó, chứ không phải cho tệp đó qua |

Cả hai đều là một-tệp và chỉ-chuỗi. Không quy tắc nào phân giải một import, chạm vào hệ tệp, đọc một
kiểu, hay biết được đoạn cuối của một specifier là tệp, là thư mục, hay chẳng là gì cả.

## Lối thoát hợp lệ

**Đã đóng** — người đọc có thể tưởng những cách viết này đi lọt, và chúng không lọt.

| Viết như thế này | Vì sao vẫn nổ |
|---|---|
| `import type { Ctx } from "@modules/ai"` | Import chỉ-kiểu vẫn là một `ImportDeclaration`; `importKind` không bao giờ được hỏi tới, nên làn kiểu không phải cửa hông |
| `export * from "@modules/ai"` và `export { X } from "@modules/ai"` | Cả hai dạng tái xuất đều được thăm, và dạng thứ hai được canh bằng `if (node.source)` nên một `export { X }` cục bộ không nguồn bị bỏ qua chứ không làm vỡ |
| `import "@modules/telemetry"` chỉ để lấy tác dụng phụ | Specifier đọc từ `node.source`, không đọc từ danh sách ràng buộc. Một import không có specifier nào bị báo y hệt một import có mười cái |
| `import { X } from "@modules/"` | Phần còn lại rỗng bị báo trước khi tách, nên cách viết suy biến này không phải một lần lọt tình cờ |
| `import { X } from "@modules/platform"` | Một thư mục nhóm đứng một mình là một đoạn so với `barrelDepth` bằng `2`, nên gọi tên thư mục nhóm là barrel chứ không phải năng lực |
| `import { X } from "@modules/ai-billing/x"` từ trong `modules/ai/` | Phép kiểm tự thân là `rest === key \|\| rest.startsWith(key + "/")`. Dấu gạch chéo cuối làm ranh giới thành thật, nên một năng lực chỉ có tên bắt đầu giống năng lực khác thì không bị quét nhầm |
| Đường dẫn Windows trong `no-self-module-alias` | `\` được đổi thành `/` trước mọi `lastIndexOf`, nên một đường dẫn dấu chéo ngược suy ra cùng một năng lực như mọi đường dẫn khác |
| Một tệp ở composition root, ngoài mọi cây năng lực | `selfAliases` trả `null` và quy tắc trả `{}`. Đây là đúng chứ không phải lỏng: một tệp không thuộc năng lực nào thì không thể import chính năng lực của nó |
| `import { AiService } from "@modules/ai"` từ trong `modules/ai/` | Cả hai quy tắc báo cùng một dòng — một vì gọi tên barrel, một vì alias tự trỏ. Chúng là hai phép kiểm độc lập tình cờ đồng ý với nhau ở đây |

**Còn mở** — mù đã xuất xưởng. Một phán quyết không được phép nói rằng những chỗ này đã được phán.

| Phạm vi | Cái gì đi lọt |
|---|---|
| `must-deep-module-import` | `import { X } from "@modules/ai/index"` — quy tắc đếm **số đoạn**, không đếm tệp. Hai đoạn thắng `barrelDepth` bằng `1`, nên gọi thẳng tên tệp barrel là đường đi lọt sạch sẽ nhất qua chính quy tắc sinh ra để cấm barrel |
| `must-deep-module-import` | `import { X } from "@modules/ai/services"` khi `services/` có `index.ts` — cùng khe hở đếm đoạn, và là dạng hay gặp hơn. Với một quy tắc không bao giờ phân giải gì, một thư mục barrel lồng bên trong không phân biệt nổi với một tệp; luật nói *gọi tên tệp khai báo*, quy tắc cưỡng chế *có ít nhất một đoạn sau tên năng lực* |
| `must-deep-module-import` | `import { X } from "@modules/ai/"` — dấu gạch chéo cuối tách ra `["ai", ""]`, đủ hai đoạn. Đoạn rỗng không bao giờ được kiểm, còn bộ phân giải thì gộp nó lại thành thư mục |
| cả hai | `import { X } from "@modules//ai"` và `from "@modules/./ai"` — đoạn thừa là `""` hoặc `"."`, cả hai đều được đếm. Đúng mẹo đó cũng đánh bại `no-self-module-alias`, nơi `"/ai/x"` và `"./ai/x"` không khớp `key` cũng không khớp `key + "/"` |
| cả hai | `const { X } = await import("@modules/ai")` — một `ImportExpression` không phải `ImportDeclaration`. Không quy tắc nào có bộ thăm cho nó |
| cả hai | `const { X } = require("@modules/ai")`, và `import X = require("@modules/ai")` — một `CallExpression` và một `TSImportEqualsDeclaration`. Không cái nào được thăm, và cái thứ hai lại đúng là cái một tệp cấu hình hay dùng nhất |
| `must-deep-module-import` | `import { X } from "../../ai"` — mọi phép kiểm bắt đầu bằng `startsWith` một tiền tố alias. Đường dẫn tương đối không có tiền tố nào, nên một barrel liên năng lực gọi bằng đường tương đối là vô hình |
| cả hai | `import { X } from "../../billing/billing.service"` từ trong `modules/ai/` — mặt trái của cùng một khe hở: với **vào** một năng lực khác bằng đường tương đối là một lần vượt ranh giới không có alias nào để báo. `no-self-module-alias` chỉ soi những specifier có tiền tố alias, nên cặp quy tắc im lặng trước đúng cái cách viết giấu đường nối kỹ nhất |
| cả hai | `import { X } from "@shared/utils"`, `"@app/..."`, `"src/modules/ai"` — `ALIASES` là ba tiền tố viết tay. Thêm một alias thứ tư vào cấu hình biên dịch là có ngay một cây không được cưỡng chế, im lặng, không tín hiệu nào |
| `must-deep-module-import` | `import { X } from "@modules/adapters/mailer"` — `META_ROOTS` cũng là ba tên viết tay. Thư mục nhóm thứ tư làm các năng lực dưới nó đọc thành "năng lực kèm tệp", nên mọi barrel dưới nó đi lọt |
| cả hai | `import { X } from "@features/platform/billing"` — nhận biết thư mục nhóm chỉ thuộc về `@modules/`. Dưới hai alias kia, một thư mục nhóm bị coi là năng lực, nên barrel của nó đi lọt và, trong `no-self-module-alias`, anh em của nó bị đọc nhầm thành chính nó |
| `no-self-module-alias` | Một cây năng lực đặt ở `apps/api/modules/`, `module/`, hay bất kỳ đường dẫn nào không chứa đúng cặp đoạn `/src/modules/` — không tìm thấy root, trả `{}`, và tệp không phải là kiểm một nửa mà là không kiểm. Hình dạng thư mục là thứ rẻ nhất trong một kho mã để đổi, mà ở đây nó chịu lực |
| `no-self-module-alias` | Một tệp viết thẳng ở `modules/platform/config.ts` — khoá tự thân thành `["platform/config.ts", "config.ts"]`, tức tên tệp nằm ở chỗ đáng lẽ là tên năng lực. Không specifier nào mang đuôi `.ts`, nên quy tắc tắt hẳn với tệp đó trong khi trông vẫn như đang bật |
| `no-self-module-alias` | Một năng lực cấp cao thật sự trùng tên với một năng lực nằm dưới thư mục nhóm — khoá ngắn không mang tên nhóm. Từ trong `modules/platform/exceptions/`, một import tới `@modules/exceptions/...` thật sự khác vẫn bị báo là tự trỏ. Một cửa mở ngược: quy tắc bắn vào mã đúng, và thói quen nó dạy người đọc là cuộn qua nó |
| cả hai | Một lần tự trỏ đi vòng qua tệp thứ ba tái xuất hộ — cả hai quy tắc đọc một specifier trong một tệp. Một năng lực với về chính mình qua tệp tái xuất của hàng xóm là hai dòng import trông đều đúng, và không quy tắc một-tệp nào thấy được vòng đó |
| cả hai | `// eslint-disable-next-line` trên đầu một trong hai quy tắc — không quy tắc nào ở đây là không tắt được. Mọi cửa mở phía trên cũng đều với tới được bằng một dòng, bởi một người đang vội |
| không quy tắc nào | **Mọi thứ mà `LAYERING-3`, `LAYERING-4` và `LAYERING-5` cấm** — một mô-đun năng lực import mô-đun của anh em thay vì nối dây ở composition root, một composition root không còn là nơi duy nhất biết toàn cục, và một `index.ts` viết ra để tái xuất cả một thư mục |

Mọi cửa còn mở ở trên là khe hở của **quy tắc**, không bao giờ là quyền được viết như vậy của **luật**.
Mã đi lọt vẫn là mã sai.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| `node.source.value` | Specifier ở dạng `string`. Template literal hay nguồn tính toán ra thì bị bỏ qua, và phán quyết phải nói ra điều đó chứ không gọi nó là sạch |
| `context.filename` | Chỉ `no-self-module-alias`. Đường dẫn đã đổi `\` thành `/`, và `lastIndexOf` đã tìm thấy root nào trong ba root — hoặc là không root nào |
| `ALIASES` | Mục nào trong ba mục `{ prefix, root, metaAware }` đã khớp, theo thứ tự khai báo, hoặc `none matched` |
| `META_ROOTS` | `parts[0]` có nằm trong `Set` đóng ba phần tử hay không, vì đó là thứ quyết định `barrelDepth` và các khoá tự thân |

Ngoài ra không đọc gì khác. Cả hai quy tắc đều khai `schema: []` nên không nhận tuỳ chọn nào; không có
cấu hình nào để một kho mã thêm một alias, thêm một thư mục nhóm, hay dời một root.

## Quy tắc

1. Danh tính của một quy tắc là **tên đã công bố** của nó. Không có mã số riêng cho quy tắc; cái tên đó
   mới là chuỗi build in ra, là chuỗi dòng tắt cảnh báo mang theo, và là chuỗi mọi cuộc trao đổi về
   một lỗi dùng tới.
2. Mỗi quy tắc giữ đúng một mã luật, và không mã nào bị hai quy tắc cùng giữ.
3. Cả hai quy tắc đều là `meta.type: "problem"` và đều ở mức `error` trong `recommended`.
4. Cả hai chỉ thấy ba vị trí specifier tĩnh: `ImportDeclaration`, `ExportNamedDeclaration` có `source`,
   `ExportAllDeclaration`. Mọi dạng động nằm ngoài tầm với ngay từ cấu tạo.
5. `must-deep-module-import` quyết định bằng **số đoạn**, không bao giờ bằng thứ mà đoạn cuối trỏ tới.
   Mọi câu nói về "tệp" trong thông điệp của nó là câu của **luật**, không phải điều nó đo được.
6. `no-self-module-alias` suy ra năng lực từ **đường dẫn**, nên nó chỉ đúng đúng bằng mức mà bố cục
   thư mục còn giống lúc nó được viết ra.
7. Không root nào khớp thì trả **bộ thăm rỗng**, nên một tệp ngoài cây không bị kiểm một nửa.
8. Mọi cửa còn mở là khe hở của **quy tắc**, không bao giờ là quyền được viết như vậy của **luật**. Mã
   đi lọt vẫn là mã sai.

## Ngoại lệ

Ngoại lệ ở đây là những miễn trừ **đã nằm sẵn trong nguồn**, không phải chỗ để lách.

- **Thư mục nhóm.** `platform`, `lib`, `integrations` được coi là chỗ chứa năng lực chứ không phải một
  năng lực. Điều này thả `@modules/platform/exceptions` khỏi việc bị đọc thành "năng lực kèm tệp" — nó
  đúng là một barrel — và thả một tệp nằm trong thư mục đó thành hai khoá tự thân, tên dài và tên
  ngắn. Đây là ngoại lệ đắt nhất của mô-đun: danh sách là đóng, và mọi cửa mở nó sở hữu đều bắt nguồn
  từ chỗ danh sách đó thiếu hoặc thừa một cái tên.
- **Tệp ngoài mọi cây năng lực.** Composition root và mọi tệp không thuộc năng lực nào được
  `no-self-module-alias` thả hoàn toàn. Đây là đúng chứ không phải lỏng: một tệp không thuộc năng lực
  nào thì không thể import chính năng lực của nó.
- **`export { X }` không có nguồn.** Chỉ tái xuất **có `source`** mới được kiểm; một `export { X }` cục
  bộ không phải là một lần import và được thả khỏi cả hai quy tắc.
- **`LAYERING-3` không có quy tắc, một cách cố ý.** Nguồn nói thẳng: phân biệt năng lực anh em với con
  lồng bên trong cần đồ thị mô-đun. Kho nào muốn cưỡng chế thì phải viết nó thành một cổng duyệt cây,
  không phải một quy tắc đọc từng tệp rồi đoán.
- **Mức đề nghị là `error`, nhưng chỉ khi đo trước.** Nguồn ghi rõ cả hai được đo ở mức nợ bằng không
  trong kho tham chiếu. Một kho áp dụng chúng vào cây có sẵn sẽ không ở mức đó, vì barrel là mặc định
  của phần lớn mã nguồn. Đo trước, hạ xuống `warn` kèm con số, rồi mới đốt dần.

Ngoài những điều trên, không quy tắc nào khai một tuỳ chọn, một danh sách trắng hay một lối tắt theo
tệp. Lối ra duy nhất còn lại là dòng tắt cảnh báo, và mô-đun này không cấp lối ra đó; dòng đó đã được
ghi ở trên như một cửa còn mở, không phải như một ngoại lệ.

## Đầu ra

Một khối cho mỗi phát hiện:

```text
rule:      <must-deep-module-import | no-self-module-alias>
code:      <LAYERING-1 | LAYERING-2>
file:      <path as the rule normalized it, or "not read" for LAYERING-1>
alias:     <@modules/ | @features/ | @tests/ | none matched>
self keys: <derived capability keys, or "none: file is outside every root">
segments:  <parts.length vs barrelDepth, for LAYERING-1>
message:   <barrel | self>
verdict:   <fires | silent: hatch <name from the Open table>>
```

Một tệp sạch xuất đúng một khối với `message: none` và `verdict: silent: no hatch — every static
specifier was read and none matched`. Một tệp ngoài phạm vi của `no-self-module-alias` xuất
`self keys: none: file is outside every root` cùng `verdict: silent: no visitor installed`, và đó
không phải là một lần qua.

## Ví dụ đã giải

**Đầu vào.** `modules/ai/ai-invoke.service.ts`:

```ts
import { Injectable } from "@nestjs/common"
import { AiService } from "@modules/ai"
import { BillingService } from "@modules/billing"

export * from "@modules/platform"

@Injectable()
export class AiInvokeService {
  constructor(
    private readonly ai: AiService,
    private readonly billing: BillingService,
  ) {}
}
```

Tệp nằm dưới `/src/modules/`, nên `no-self-module-alias` tìm thấy root và suy ra khoá tự thân `["ai"]`.
`must-deep-module-import` có phạm vi ở khắp nơi và không bao giờ đọc đường dẫn.

```text
rule:      must-deep-module-import
code:      LAYERING-1
file:      not read
alias:     @modules/
self keys: n/a
segments:  1 vs barrelDepth 1
message:   barrel
verdict:   fires
```

```text
rule:      no-self-module-alias
code:      LAYERING-2
file:      src/modules/ai/ai-invoke.service.ts
alias:     @modules/
self keys: ["ai"]
segments:  n/a
message:   self
verdict:   fires
```

Hai khối đó là cùng một dòng, `@modules/ai`. Chúng là hai phép kiểm độc lập tình cờ đồng ý với nhau.

```text
rule:      must-deep-module-import
code:      LAYERING-1
file:      not read
alias:     @modules/
self keys: n/a
segments:  1 vs barrelDepth 1
message:   barrel
verdict:   fires
```

Đó là `@modules/billing`. Còn `export * from "@modules/platform"` được thăm như một
`ExportAllDeclaration`, và `platform` là một thư mục nhóm đứng một mình:

```text
rule:      must-deep-module-import
code:      LAYERING-1
file:      not read
alias:     @modules/
self keys: n/a
segments:  1 vs barrelDepth 2
message:   barrel
verdict:   fires
```

`@nestjs/common` không khớp tiền tố alias nào nên không bao giờ bị soi tới.

**Đã sửa.** Alias tự trỏ đổi thành đường tương đối, mỗi import liên năng lực gọi tên tệp khai báo, và
dòng tái xuất gọi tên một tệp nằm dưới thư mục nhóm:

```ts
import { Injectable } from "@nestjs/common"
import { AiService } from "./ai.service"
import { BillingService } from "@modules/billing/billing.service"

export * from "@modules/platform/exceptions/domain.exception"

@Injectable()
export class AiInvokeService {
  constructor(
    private readonly ai: AiService,
    private readonly billing: BillingService,
  ) {}
}
```

Có một cửa mở sống sót qua lần sửa này. Thêm một dòng nữa là đường nối biến mất mà không phát hiện nào
nổ:

```ts
import { BillingRepository } from "../billing/billing.repository"
```

```text
rule:      no-self-module-alias
code:      LAYERING-2
file:      src/modules/ai/ai-invoke.service.ts
alias:     none matched
self keys: ["ai"]
segments:  n/a
message:   none
verdict:   silent: hatch reaching into another capability relatively — no alias prefix, so neither rule inspects the specifier and the boundary crossing is invisible
```

Sự im lặng đó không phải là tuân thủ. Cũng dòng import ấy viết thành `@modules/billing/billing.repository`
thì vượt đúng cái ranh giới đó và đọc lên y hệt với mắt người; chỉ có cách đánh vần là khác.

## Phạm vi

Mô-đun này ghi lại phần cưỡng chế của hai quy tắc thuộc một luật back-end, không ghi lại luật. Nó không
phán chuyện một barrel có được phép *viết ra* hay không — nửa bên khai báo của `LAYERING-5` không có
máy giữ — cũng không phán chuyện một năng lực đáng lẽ phải được nối dây ở composition root thay vì
import thẳng, tức `LAYERING-3` và `LAYERING-4`, hai mã không gì giữ và thuộc về một cổng duyệt cây mà
mô-đun này không chứa. Nó không gọi tên sản phẩm, công ty hay kho mã nào. Tên quy tắc, định danh thông
điệp, tiền tố alias và tên thư mục mà các quy tắc so khớp là **những định danh có xuất xưởng** và được
chép lại nguyên văn; miễn trừ đó không phủ thêm gì khác.
