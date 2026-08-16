---
id: be-lints-module-layering-vi
title: vi.md
slug: /be/lints/module-layering/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hai quy tắc giữ luật phân tầng mô-đun — bắt gì, nhìn bằng gì, và cửa nào còn mở.
---

# vi.md

> Version: `2.00` · Mô-đun: `module-layering`

# Hai quy tắc giữ luật phân tầng mô-đun

Luật nói về **đường nối giữa các năng lực**: một lần import được phép gọi tên cái gì, và một năng lực
được phép nói gì về chính nó. Tài liệu này không nhắc lại luật. Nó ghi lại **phần cưỡng chế**: máy
nhìn thấy gì trong một chuỗi specifier, nhìn bằng cơ chế nào, và — phần thường không ai viết ra —
cách viết nào đi lọt qua máy mà không bị chạm tới.

Tên quy tắc chính là **danh tính** của nó. Không có mã số riêng cho quy tắc, vì tên đó mới là chuỗi
in ra trong log build, trong dòng tắt cảnh báo và trong mọi cuộc trao đổi về lỗi.

Hai quy tắc này đều là **xử lý chuỗi trên một tệp**. Đó vừa là sức mạnh vừa là giới hạn: chúng rẻ và
chính xác nên được để ở mức `error` mà không cần ngân sách báo nhầm, và đồng thời mọi thứ cần tới tệp
thứ hai đều nằm ngoài tầm với. Luật có năm mã; hai mã có máy giữ, ba mã không.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `must-deep-module-import` | `LAYERING-1` | Specifier có alias nhưng không còn đoạn nào sau tên năng lực: `@modules/<tên>`, `@features/<tên>`, `@tests/<tên>`, chỉ mỗi tiền tố, và `@modules/<thư mục nhóm>/<tên>` với ba tên nhóm có trong danh sách |
| `no-self-module-alias` | `LAYERING-2` | Specifier trỏ về **chính năng lực của tệp đang import**, đi qua alias công khai của năng lực đó; "chính nó" được suy ra từ đường dẫn tệp |

`LAYERING-3`, `LAYERING-4` và `LAYERING-5` **không có quy tắc nào giữ**. `LAYERING-3` bị bỏ ra một
cách cố ý và nguồn nói rõ điều đó: muốn biết một mô-đun được import là năng lực anh em hay là con
lồng bên trong thì phải có đồ thị mô-đun, mà quy tắc đọc từng tệp một thì không thấy. `LAYERING-5`
là chỗ dễ tưởng là đã được giữ nhất — xem mục riêng ở dưới. Cả ba được ghi trong `audit.md`.

---

## `must-deep-module-import`

**Bắt gì.** Một thông điệp duy nhất, `barrel`: một specifier gọi tên **một năng lực và không tệp
nào**. `@modules/ai` thay vì `@modules/ai/ai-invoke.service`. Barrel là tệp tái xuất cả một thư mục,
nên import nó là kéo toàn bộ đồ thị import của thư mục về chỉ để lấy một ký hiệu — đó là cách một
bài kiểm thử đơn vị vô tình khởi động một driver cơ sở dữ liệu, và là cách hai năng lực chẳng tham
chiếu gì tới nhau lại thành vòng lặp qua một năng lực thứ ba.

Quy tắc bắt cả ba vị trí specifier tĩnh: `ImportDeclaration`, `ExportNamedDeclaration` có `source`,
và `ExportAllDeclaration`. Tái xuất cũng là import, và một `export * from` một barrel là cách nhanh
nhất để biến năng lực của mình thành barrel tiếp theo.

**Giữ mã nào.** `LAYERING-1`.

**Cách phát hiện.** Đọc `node.source.value`, thoát nếu không phải chuỗi. Tìm mục đầu tiên trong mảng
`ALIASES` ba phần tử mà specifier `startsWith` tiền tố của nó: `@modules/`, `@features/`, `@tests/`.
Cắt tiền tố ra; phần còn lại rỗng thì báo ngay. Ngược lại tách phần còn lại theo `/` và so
`parts.length` với `barrelDepth` bằng `1` — hoặc bằng `2` khi alias là `metaAware` (chỉ `@modules/`)
**và** `parts[0]` nằm trong `Set` ba tên `META_ROOTS`: `platform`, `lib`, `integrations`.
`parts.length <= barrelDepth` thì báo. Quy tắc **không đọc tên tệp** ở bất kỳ đâu.

Cái bẫy nằm ở `META_ROOTS`. Có những năng lực nấp sau một thư mục nhóm, nên ở đó tên năng lực là
**đoạn thứ hai**, còn ở mọi chỗ khác là đoạn thứ nhất. Nhầm chỗ đó thì `@modules/platform/exceptions`
đọc thành "năng lực kèm tệp" trong khi nó là một barrel.

**Vì sao luật này đáng có máy giữ.** Vì cái sai không hiện ra ở chỗ nó được viết. `import { X } from
"@modules/ai"` đọc lên gọn gàng hơn bản đúng, ngắn hơn, và trong review nó là dòng không ai dừng
lại. Giá phải trả xuất hiện ở chỗ khác và muộn hơn nhiều: một spec chạy chậm gấp mười vì thư mục kia
kéo theo một kết nối, một vòng lặp import chỉ lộ ra khi đổi thứ tự khởi tạo, và một danh sách import
không còn trả lời được câu hỏi duy nhất người đọc cần ở nó — **tệp nào**. Không ai đếm được bằng mắt;
một quy tắc thì đếm được, ở mọi commit.

**Cửa còn mở.**

- `@modules/ai/index` — quy tắc đếm **số đoạn**, không phân biệt tệp với thư mục. Hai đoạn thắng
  `barrelDepth` bằng `1`, nên gọi thẳng tên tệp barrel là đường đi lọt sạch sẽ nhất qua chính quy tắc
  sinh ra để cấm barrel.
- `@modules/ai/services` khi `services/` có `index.ts` — cùng khe hở, và là dạng hay gặp hơn nhiều.
  Luật nói *gọi tên tệp khai báo*; quy tắc cưỡng chế *có ít nhất một đoạn sau tên năng lực*.
- `@modules/ai/` — dấu gạch chéo cuối tách ra `["ai", ""]`, đủ hai đoạn. Đoạn rỗng không bao giờ được
  kiểm.
- `@modules//ai` và `@modules/./ai` — cùng một phép đếm, đoạn thừa là `""` hoặc `"."`.
- `await import("@modules/ai")`, `require("@modules/ai")`, `import X = require("@modules/ai")` —
  `ImportExpression`, `CallExpression` và `TSImportEqualsDeclaration`, không nút nào được thăm.
- `import { X } from "../../ai"` — mọi phép kiểm bắt đầu bằng `startsWith` một tiền tố alias. Đường
  dẫn tương đối không có tiền tố nào, nên một barrel liên năng lực gọi bằng đường tương đối là vô
  hình.
- `@shared/utils`, `@app/...`, `src/modules/ai` — `ALIASES` là ba chuỗi viết tay. Thêm một alias thứ
  tư vào cấu hình biên dịch là có ngay một cây không được cưỡng chế, im lặng, không tín hiệu nào.
- `@modules/adapters/mailer` — `META_ROOTS` cũng là ba tên viết tay. Thư mục nhóm thứ tư làm mọi
  barrel dưới nó đọc thành "năng lực kèm tệp".
- `@features/platform/billing` — nhận biết thư mục nhóm chỉ thuộc về `@modules/`. Dưới hai alias kia,
  một thư mục nhóm bị coi là năng lực.

---

## `no-self-module-alias`

**Bắt gì.** Một thông điệp duy nhất, `self`: một tệp nằm trong năng lực `ai` mà với tay lấy
`@modules/ai/...`. Đó là năng lực nói chuyện với chính nó qua cửa trước của mình. Nó là nam châm hút
vòng lặp, và nó là một lời nói dối về ranh giới: alias tồn tại để nói "cái này đến từ nơi khác", nên
dùng alias cho thứ không đến từ nơi khác chính là cách làm cho tín hiệu đó hết còn nghĩa gì.

**Giữ mã nào.** `LAYERING-2`.

**Cách phát hiện.** Đọc `context.filename || context.getFilename()` một lần lúc `create`, đổi `\`
thành `/`. Duyệt cùng mảng `ALIASES` theo thứ tự khai báo, lấy `lastIndexOf` của từng `root` —
`/src/modules/`, `/src/features/`, `/src/tests/` — và **root đầu tiên tìm thấy thì thắng**. Tách phần
đuôi đường dẫn theo `/` để suy ra khoá tự thân: bình thường là `[parts[0]]`; khi alias là `metaAware`,
`parts[0]` là một thư mục nhóm và còn ít nhất hai đoạn thì là `["<nhóm>/<tên>", "<tên>"]` — vì năng
lực đó gọi được bằng cả đường dài lẫn đường ngắn, nên cả hai đều là chính nó. Không root nào khớp thì
trả về **bộ thăm rỗng**. Còn lại thăm cùng ba loại nút, đòi specifier `startsWith` đúng tiền tố alias
đó, và báo khi phần còn lại `=== key` hoặc `startsWith(key + "/")` với bất kỳ khoá nào.

**Vì sao luật này đáng có máy giữ.** Vì đây là lỗi sinh ra từ một thao tác vô hại: người ta gõ tên
ký hiệu, trình soạn thảo tự thêm import, và nó chọn đường alias vì đó là đường nó biết. Không ai
quyết định gì cả, và trong diff dòng đó trông y hệt một import liên năng lực hợp lệ — đúng cái nhìn
mà mắt người không phân biệt được, còn máy thì phân biệt được ngay bằng đường dẫn của chính tệp đang
đọc. Cái giá là thứ chỉ lộ ra rất muộn: khi cần tách năng lực đó sang kho khác, những dòng tự trỏ về
mình là những dòng biến một phép cắt cơ học thành một buổi gỡ rối.

**Cửa còn mở.**

- `@modules//ai/x` và `@modules/./ai/x` — phần còn lại là `"/ai/x"` và `"./ai/x"`, không khớp `key`
  cũng không khớp `key + "/"`. Cùng một cách viết đi lọt cả hai quy tắc.
- `await import("@modules/ai/x")` ngay trong `ai` — không phải `ImportDeclaration`, không nút nào
  được thăm.
- `import { X } from "../../billing/billing.service"` từ trong `modules/ai/` — mặt trái của cùng một
  khe hở: với **vào** một năng lực khác bằng đường tương đối là một lần vượt ranh giới không có alias
  nào để báo. Cặp quy tắc im lặng trước đúng cái cách viết giấu đường nối kỹ nhất.
- Cây năng lực đặt ở `apps/api/modules/`, `src/module/`, hay bất kỳ đường dẫn nào không chứa đúng cặp
  đoạn `/src/modules/` — không tìm thấy root, trả bộ thăm rỗng, tệp **không phải là kiểm một nửa mà
  là không kiểm**. Hình dạng thư mục là thứ rẻ nhất trong một kho mã để đổi, mà ở đây nó chịu lực.
- Một tệp viết thẳng ở `src/modules/platform/config.ts` — khoá tự thân thành
  `["platform/config.ts", "config.ts"]`, tức tên tệp nằm ở chỗ đáng lẽ là tên năng lực. Không
  specifier nào mang đuôi `.ts`, nên quy tắc tắt hẳn với tệp đó trong khi trông vẫn như đang bật.
- **Cửa mở ngược.** Khoá ngắn dưới thư mục nhóm không mang tên nhóm. Từ trong
  `modules/platform/exceptions/`, một import tới `@modules/exceptions/...` **thật sự khác** vẫn bị
  báo là tự trỏ. Quy tắc bắn vào mã đúng, và thói quen nó dạy người đọc là cuộn qua nó.
- Tự trỏ đi vòng qua một tệp thứ ba tái xuất hộ — hai dòng import đều đúng khi đọc riêng, và không
  quy tắc một-tệp nào thấy được vòng đó.
- `// eslint-disable-next-line` — không quy tắc nào ở đây là không tắt được.

---

## `LAYERING-5` trông như đã được giữ, và không phải vậy

Đây là chỗ dễ đọc nhầm nhất của mô-đun này, nên nó có mục riêng.

`must-deep-module-import` giữ **nửa bên gọi**: không ai được *import* một barrel qua alias. Không gì
giữ **nửa bên khai báo**: viết một `index.ts` tái xuất cả thư mục thì không bị báo, và một khi tệp đó
tồn tại thì mọi đường tương đối và mọi đường không-alias tới nó đều hợp lệ.

Nói cách khác: quy tắc làm cho barrel **bất tiện để với tới**, chứ không làm cho barrel **không thể
viết ra**. Ai đọc bảng ở trên rồi kết luận "đã cấm được barrel" là đã đọc sai một mức.

## Luật

1. Danh tính của một quy tắc là **tên đã công bố** của nó. Không đặt mã số cho quy tắc; một quy tắc
   hai tên là một quy tắc không thể truy nguyên.
2. Chỉ ghi lại quy tắc **có thật trong nguồn**. Một quy tắc đáng có mà chưa có thì thuộc về
   `audit.md`, không thuộc về bảng ở trên.
3. Mỗi quy tắc giữ đúng một mã luật; không mã nào bị hai quy tắc cùng giữ.
4. `must-deep-module-import` quyết định bằng **số đoạn**, không bao giờ bằng thứ mà đoạn cuối trỏ
   tới. Mọi câu nói về "tệp" trong thông điệp của nó là câu của **luật**, không phải điều nó đo được.
5. `no-self-module-alias` suy ra năng lực từ **đường dẫn**, nên nó chỉ đúng đúng bằng mức mà bố cục
   thư mục còn giống lúc nó được viết ra.
6. Không root nào khớp thì trả **bộ thăm rỗng** — tệp bị chặn không phải là tệp kiểm một nửa.
7. Mọi cửa còn mở là khe hở của **quy tắc**, không bao giờ là quyền được viết như vậy của **luật**.
   Mã đi lọt vẫn là mã sai.
8. Nói "cổng xanh" và nói "quy tắc đã nhìn" là hai câu khác nhau; chỉ một trong hai là bằng chứng.

## Ngoại lệ

Ngoại lệ ở đây là những miễn trừ **đã nằm sẵn trong nguồn**, không phải chỗ để lách.

- **Thư mục nhóm.** `platform`, `lib`, `integrations` được coi là chỗ chứa năng lực chứ không phải
  một năng lực. Nhờ đó `@modules/platform/exceptions` bị nhận đúng là barrel, và một tệp trong đó
  được coi là tự trỏ theo cả tên dài lẫn tên ngắn. Đây là ngoại lệ đắt nhất của mô-đun: nó là danh
  sách đóng, và mọi cửa mở của nó đều bắt nguồn từ chỗ danh sách đó thiếu hoặc thừa một cái tên.
- **Tệp ngoài mọi cây năng lực.** Composition root và những tệp không thuộc năng lực nào được
  `no-self-module-alias` bỏ qua hoàn toàn. Đây là đúng chứ không phải lỏng: một tệp không thuộc năng
  lực nào thì không thể import chính năng lực của nó.
- **`export { X }` không có nguồn.** Chỉ tái xuất **có `source`** mới được kiểm; một `export { X }`
  cục bộ không phải là một lần import.
- **`LAYERING-3` không có quy tắc, một cách cố ý.** Nguồn nói thẳng: phân biệt năng lực anh em với
  con lồng bên trong cần đồ thị mô-đun. Kho nào muốn cưỡng chế thì phải viết nó thành một cổng duyệt
  cây, không phải một quy tắc đọc từng tệp rồi đoán.
- **Mức đề nghị là `error`, nhưng chỉ khi đo trước.** Nguồn ghi rõ cả hai được đo ở mức nợ bằng không
  trong kho tham chiếu, và một kho áp dụng vào cây có sẵn sẽ **không** ở mức đó, vì barrel là mặc
  định của phần lớn mã nguồn. Đo trước, hạ xuống `warn` kèm con số, rồi mới đốt dần.
