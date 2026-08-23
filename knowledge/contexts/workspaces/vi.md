---
title: Workspaces · Vietnamese
---

# Không gian làm việc

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@config-schema` | `knowledge/contexts/workspaces/config.schema.json` | file | kiểm tra default chung của Source cho mọi project và role |
| `@schema` | `knowledge/contexts/workspaces/schema.json` | file | kiểm tra hình dạng JSON của bản ghi |


## Bản ghi

Mô-đun này nhận một yêu cầu khởi động viết bằng lời thường — "start example-app fe be" — rồi trả về,
với **mỗi vai trò** mà yêu cầu đó gọi tên, một route đã giải và một phán quyết: đọc từ checkout này,
hay dừng lại và trả về bước setup. Mô-đun này quyết định **sự thật được đọc từ đâu**. Sai ở đây thì
không tầng nào bên dưới còn đúng, và cái sai đó không tự lên tiếng: agent vẫn đọc một repository thật,
chỉ không phải repository mà yêu cầu muốn nói.

## Luật

Default chung của Source được resolve trước từ `.workspaces/config.json` đã track, hợp lệ theo `@config-schema`.
`defaultLang` đặt ngôn ngữ phản hồi cho mọi project và role, trừ khi request hiện tại chỉ định rõ ngôn
ngữ khác. Giá trị này được đọc một lần, không copy vào từng route của role.

`.workspaces/projects/<project>/<role>.json` và `.workspaces/ports/*.json` đã track là declaration portable,
không credential. Setup hydrate chúng thành `.workspaces/local/routes` bị ignore; chỉ generated route đó chứa
absolute path, observed head và machine fact khác. Portable declaration định danh GitHub repository, expected
branch cùng context path tương đối trong repository; nó không tuyên bố checkout đang tồn tại.

Route được giải ra từ **một tệp đã khai báo**, không bao giờ bằng suy diễn. `project` và `role` là toàn
bộ danh tính tra cứu; tên một checkout nằm cạnh, một thư mục đang mở, hay thứ mà session trước dùng
đều không phải bằng chứng.

Route là một phát biểu về **một máy cụ thể**, nên nó phải được **xác minh trước khi đọc**. Một đường
dẫn đã ghi mà giờ không còn chứa thứ nó nói là một route cũ, và route cũ **tệ hơn route thiếu**: thiếu
thì buộc phải hỏi, cũ thì mời người ta trả lời sai một cách rất tự tin.

## Mã tình huống

| Mã | Tình huống | Phán quyết |
|---|---|---|
| `WORKSPACE-1` | Lệnh start gọi tên một project và các vai trò | giải một tệp route cho mỗi vai trò |
| `WORKSPACE-2` | Một tệp route được gọi tên nhưng không tồn tại | dừng; trả về bước setup workspace |
| `WORKSPACE-3` | Route giải được; checkout là nơi đọc và ghi | đọc thẳng `repository.diskPath` |
| `WORKSPACE-4` | Một vai trò cần hợp đồng miền của nó | đọc `context.contract`, kèm `contractSource` là xuất xứ |
| `WORKSPACE-5` | Route ghi một đường dẫn hoặc head không còn đúng | dừng; route đã cũ, không phải xấp xỉ |
| `WORKSPACE-6` | Generated route mang local path hoặc observed machine fact | `.workspaces/local` ở lại trong máy; chỉ portable declaration không credential mới được commit |
| `WORKSPACE-7` | Config workspace chung của Source resolve được | áp dụng `defaultLang` cho mọi phản hồi tới người dùng |
| `WORKSPACE-8` | Role frontend khai báo product-family grammar | verify đúng grammar và profile; không suy ra từ identity |

## Đọc một lệnh khởi động

1. **Resolve default chung.** Đọc `.workspaces/config.json`, validate theo `@config-schema`, rồi giữ
   `defaultLang` cho mọi phản hồi tới người dùng — `WORKSPACE-7`.
2. **Hiểu yêu cầu đúng nghĩa chữ.** `start <project> <roles...>` gọi tên chính xác những vai trò cần
   tải. Không thêm một vai trò vì repository trông như có nó, và không bỏ một vai trò vì session trước
   không dùng.
3. **Giải một tệp cho mỗi vai trò**: `.workspaces/local/routes/<project>/<role>/config.json`, được generate từ
   tracked declaration tương ứng. Mọi tệp được gọi tên đều phải tồn tại — `WORKSPACE-1`.
4. **Xác minh trước khi đọc.** Với từng route, thư mục checkout phải tồn tại và phải còn chứa đúng
   bằng chứng mà route khai: đường dẫn hợp đồng với vai trò frontend, các manifest nó gọi tên. Hỏng ở
   bước này là `WORKSPACE-5` và nó **dừng** cả lượt chạy.
5. **Đọc chính checkout, không đọc bản sao.** Cấu hình chỉ để định tuyến — `WORKSPACE-3`.
6. **Không bao giờ nới route ra.** Route thiếu hoặc cũ thì trả về setup — `WORKSPACE-2`,
   `WORKSPACE-5` — và setup chỉ làm mới cấu hình; nó không clone, không link, không copy, không sửa
   repository đích.
7. **Resolve grammar rõ ràng.** Khi `context.grammar` khác null, verify
   `knowledge/grammars/<grammar>/grammar.json` và profile đã khai báo trước design — `WORKSPACE-8`.

## `WORKSPACE-1` — lệnh khởi động gọi tên project và vai trò

**Khi nào gặp.** Yêu cầu nêu một danh tính và một hoặc nhiều vai trò, mỗi vai trò có tệp route riêng.
Hai vai trò là hai route, không phải một route đọc theo hai cách.

**Cách nhận ra**

- Yêu cầu gọi tên một project.
- Mỗi vai trò là một từ đủ để dựng nên đường dẫn route.
- Trong yêu cầu không có gì mô tả một thư mục.

**Tự hỏi.** Mọi vai trò được gọi tên có biến thành một đường dẫn tồn tại thật mà không cần đoán không?

**Một project gọi tên một họ checkout, không nhất thiết là một sản phẩm.** Bộ công cụ cũng được một
project như mọi thứ khác — cùng hình dạng, cùng cách xác minh, không đặc quyền nào. Mọi tên project phải
**phân biệt được với mọi tên khác trên máy này**: một tên là tiền tố hay chuỗi con của tên khác thì một
dòng tổng, một cảnh báo và một glob đều có thể mang nghĩa hai project, và không gì phía sau lấy lại được
ý đã định.

**Ranh giới**

- `WORKSPACE-2`: nếu một tệp được gọi tên mà không có, mã này không đạt tới. Giải route là **được hết
  hoặc dừng**, không có giải một phần.

**Nó hỏng bằng đường nào.** Một vai trò bị suy ra từ checkout nằm cạnh đang có trên đĩa, thế là agent
tải một repository không ai yêu cầu rồi báo cáo về nó như thể được yêu cầu.

## `WORKSPACE-2` — tệp route được gọi tên nhưng không tồn tại

**Khi nào gặp.** Yêu cầu gọi tên một vai trò mà máy này không có tệp route cho nó.

**Cách nhận ra**

- Đường dẫn dựng từ project và vai trò không tồn tại.
- Một vai trò khác của cùng project vẫn giải được bình thường.

**Tự hỏi.** Thứ đang thiếu là route, hay là repository mà route trỏ tới?

**Ranh giới**

- `WORKSPACE-5`: một route có thật nhưng không còn mô tả đúng checkout là **cũ**, không phải **thiếu**,
  và đó là phán quyết khác với cách sửa khác.

**Nó hỏng bằng đường nào.** Vai trò thiếu bị âm thầm thay bằng vai trò gần nhất giải được, và mọi phát
biểu sau đó là về vai trò sai.

## `WORKSPACE-3` — checkout là nơi đọc và ghi

**Khi nào gặp.** Route đã giải, và công việc từ đây diễn ra trong repository thật tại
`repository.diskPath`.

**Cách nhận ra**

- Route mang một đường dẫn đĩa, một git root, một nhánh và một head.
- Bản thân cấu hình không chứa tệp nguồn nào của riêng nó.

**Tự hỏi.** Mình có đang sắp đọc một **bản sao** của repository thay vì chính repository không?

**Ranh giới**

- `WORKSPACE-4`: đọc hợp đồng là một hành vi hẹp hơn, kèm đòi hỏi riêng về xuất xứ.

**Nó hỏng bằng đường nào.** Một bản mirror, mount, link hay cache được đọc thay cho checkout, nên câu
trả lời mô tả một khoảnh khắc đã đóng băng trong khi repository đã đi tiếp.

## `WORKSPACE-4` — một vai trò cần hợp đồng miền của nó

**Khi nào gặp.** Vai trò frontend phải biết những thành phần và slot nào **có thật** trước khi trả lời
bất cứ điều gì về bố cục, và đường dẫn hợp đồng là thẩm quyền duy nhất cho chuyện đó.

**Cách nhận ra**

- Route gọi tên một đường dẫn hợp đồng.
- Route cũng ghi lại đường dẫn ấy được chọn thế nào — khai báo, hay dò ra.

**Tự hỏi.** Mình có biết đường dẫn hợp đồng này do người khai báo hay do máy dò ra không?

**Ranh giới**

- `WORKSPACE-5`: một đường dẫn hợp đồng không còn tồn tại là route cũ, không phải câu hỏi về hợp đồng.

**Nó hỏng bằng đường nào.** Hợp đồng bị đoán theo quy ước thư mục thay vì đọc, nên những thành phần đã
đổi tên hoặc đã bỏ vẫn được đem ra đề xuất.

**Một vai trò frontend có thể thật sự không có registry nào.** Một trang landing hay marketing có thể
cài máy lint mà chưa bao giờ theo vốn từ contract. `contract: null` vẫn báo là một phát hiện theo mặc
định — phần lớn vì chưa ai tìm, và một monorepo giấu registry khỏi quy ước one-app. `contractSource:
"discovered:none"` là cách phân biệt một lần tìm đã xong mà không thấy gì, với một lần chưa từng chạy:
nó gọi tên sự vắng mặt là đã xác minh, không phải bị bỏ qua.

## `WORKSPACE-5` — route đã cũ

**Khi nào gặp.** Tệp route vẫn hợp lệ và đầy đủ, và một giá trị trong nó không còn mô tả đúng máy: một
đường dẫn đã ghi không có trên đĩa, hoặc checkout không còn tới được head đã ghi, hoặc nó đang ở một
nhánh khác.

**Cách nhận ra**

- Mọi trường đều có mặt và đúng dạng.
- Một đường dẫn đã ghi không giải được, một head đã ghi không tới được từ checkout, hoặc nhánh đã khác.

**Tự hỏi.** Mình đã **xác minh** route, hay chỉ **đọc cú pháp** của nó?

**Ranh giới**

- `WORKSPACE-2`: thiếu là không có tệp; cũ là có tệp nhưng tệp đó nói sai.

**Nó hỏng bằng đường nào.** Không có lỗi nào được nêu. Lượt chạy tiếp tục trên bất cứ thứ gì còn nằm ở
đường dẫn cũ, và cho ra một khối việc trông như đã hoàn tất nhưng không áp vào đâu cả.

## `WORKSPACE-6` — route mang những sự thật riêng của một máy

**Khi nào gặp.** Generated route giữ đường dẫn đĩa, observed head và siêu dữ liệu git công khai. Nó là cấu hình
cục bộ. Repository identity không credential, expected branch và relative path nằm trong portable declaration
riêng có thể chia sẻ.

**Cách nhận ra**

- Các giá trị khác nhau giữa máy này và máy khác.
- Cây quy tắc sẽ **sai** trên máy người khác nếu nó chứa những giá trị đó.

**Tự hỏi.** Đưa giá trị này vào commit thì cây quy tắc có trở thành sai với người khác không?

**Ranh giới**

- `WORKSPACE-3`: đọc checkout thì được; không công bố checkout nằm ở đâu hay observed head của nó.

**Nó hỏng bằng đường nào.** Một đường dẫn hoặc một token bị chép vào trong một luật, và luật đó âm
thầm chỉ còn đúng trên một máy. Khoá bí mật, biến môi trường và token thì không bao giờ là context của
workspace ngay từ đầu.

## `WORKSPACE-7` — default chung áp dụng cho mọi phản hồi

**Khi nào gặp.** `.workspaces/config.json` hợp lệ và `defaultLang` của nó áp dụng cho mọi project và role
trong Source này.

**Cách nhận ra**

- Config nằm trực tiếp dưới `.workspaces`, ngoài mọi thư mục project.
- Giá trị là language tag kiểu BCP 47 như `vi` hoặc `en-US`.

**Tự hỏi.** Lượt chạy đã resolve default chung trước khi sinh văn xuôi cho người dùng chưa?

**Ranh giới**

- Chỉ dẫn ngôn ngữ rõ ràng trong request hiện tại override default cho đúng lượt đó; nó không viết lại
  config.

**Nó hỏng bằng đường nào.** Mỗi skill tự chọn ngôn ngữ báo cáo, nên một lượt trả lời tiếng Việt còn lượt
sau âm thầm quay về tiếng Anh dù cả hai dùng cùng Source.

## `WORKSPACE-8` — frontend grammar được route rõ ràng

**Khi nào gặp.** Một role frontend dùng product-family grammar và một owner profile theo project.

**Cách nhận ra**

- `context.grammar` và `context.grammarProfile` đều khác null.
- Grammar authority package và profile tồn tại trong trust tree.

**Tự hỏi.** Route đã nêu identity này, hay tên project/repository chỉ trông giống nó?

**Ranh giới**

- Role không dùng product-family grammar ghi cả hai giá trị là `null`; một null một khác null là stale.

**Nó hỏng bằng đường nào.** Design skill thấy chữ “StarCi” trong tên checkout rồi tự load product
behavior route chưa chọn, hoặc load mọi grammar rồi để model đoán.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| yêu cầu | Danh sách project và vai trò đúng nghĩa chữ |
| config workspace | `.workspaces/config.json` đã track, hợp `@config-schema` nằm cạnh bản ghi này |
| portable declaration | `.workspaces/projects/<project>/<role>.json` đã track, không credential và chỉ dùng repository-relative path |
| route | `.workspaces/local/routes/<project>/<role>/config.json`, hợp `@schema` nằm cạnh bản ghi này |
| checkout | Thư mục tại `repository.diskPath`, có thật trên đĩa |
| hợp đồng | Tệp tại `context.contract`, và `context.contractSource` cho xuất xứ của nó |
| grammar | Đúng package `context.grammar` và `context.grammarProfile`, hoặc cả hai ghi rõ `null` |
| độ mới | Head và nhánh đã ghi còn mô tả đúng checkout đó |

## Quy tắc

1. Giải route là **được hết hoặc dừng**. Một yêu cầu giải được một phần không phải là yêu cầu đã giải.
2. Danh tính đến từ `project` và `role`. Tên thư mục không phải danh tính.
3. Xác minh trước khi đọc. Đọc được cú pháp của route không phải là đã xác minh nó.
4. Route **mô tả**, không bao giờ **nhân bản**. Cấu hình không giữ bản sao nào của repository đích.
5. Setup chỉ làm mới route. Nó không clone, không link, không copy, không sửa repository đích.
6. Generated route ở dưới `.workspaces/local` và không bao giờ được commit. Chỉ portable declaration hợp schema
   mới được track; nó không chứa absolute path, observed head, timestamp hay credential material.
7. Mỗi lệnh khởi động ra đúng một phán quyết cho mỗi vai trò: đọc, hoặc dừng.
8. `defaultLang` được resolve một lần từ `.workspaces/config.json` và áp dụng xuyên mọi project, role.
9. Grammar và profile là một cặp khai báo rõ; tên identity không được chọn thay.

## Ngoại lệ

- **Vai trò legacy.** Legacy là một route, không phải một bộ luật thứ hai. Nó được đọc để hiểu bằng
  chứng về tương đương và di trú, và không bao giờ đè lên hợp đồng đang hoạt động.
- **Hợp đồng do dò ra.** `contractSource` được phép ghi là dò ra thay vì khai báo. Đường dẫn vẫn là
  thẩm quyền cho lượt chạy, nhưng việc nó do dò ra là thứ người rà soát phải được biết khi đường dẫn
  ấy hoá ra sai.
- **Vai trò không có hợp đồng.** Một vai trò backend có thể không mang đường dẫn hợp đồng. Khi đó
  `WORKSPACE-4` không đạt tới, và sự vắng mặt đó không phải là route cũ.

## Đầu ra

Mỗi vai trò một khối, theo đúng thứ tự yêu cầu gọi tên:

```text
project: <project>
role: <role>
route: .workspaces/local/routes/<project>/<role>/config.json
repository: <diskPath>
verified: <đã kiểm gì với đĩa hoặc với git>
sense: <grammar/profile, hoặc none>
situation: <WORKSPACE-1 | WORKSPACE-2 | WORKSPACE-3 | WORKSPACE-4 | WORKSPACE-5 | WORKSPACE-6 | WORKSPACE-7 | WORKSPACE-8>
verdict: <read | stop>
reason: <sự thật đã quyết định điều đó>
```

## Ví dụ đã giải

**Yêu cầu.** "start example-app fe be"

Yêu cầu gọi tên một project và hai vai trò, nên nó giải đúng hai tệp route và không gì khác. Nó không
gọi tên đường dẫn nào, nhánh nào, hợp đồng nào, nên không thứ nào trong số đó được giả định.

```text
project: example-app
role: fe
route: .workspaces/local/routes/example-app/fe/config.json
repository: <disk>\example-app-fe
verified: checkout tồn tại; context.contract có thật tại src/components/contracts/index.ts
situation: WORKSPACE-3
verdict: read
reason: route giải được và lời khai về hợp đồng của nó sống sót qua một lần kiểm với đĩa, nên việc đọc nhắm vào chính checkout chứ không vào bản sao nào
```

```text
project: example-app
role: be
route: .workspaces/local/routes/example-app/be/config.json
repository: <chưa giải>
verified: tệp route không tồn tại
situation: WORKSPACE-2
verdict: stop
reason: yêu cầu gọi tên một vai trò không có route trên máy này, và suy ra nó từ thư mục đang mở sẽ là trả lời về một repository không ai yêu cầu
```

Vai trò `fe` được đọc; vai trò `be` dừng và trả về bước setup workspace. Một vai trò cùng project giải
được không cấp phép cho việc đoán vai trò chưa giải được.

## Phạm vi

Mô-đun này quyết định **nguồn được đọc từ đâu**. Nó không quyết định nguồn ấy **nghĩa là gì**, luật nào
áp vào nó, hay **state đang làm dở được ghi ở đâu** — câu hỏi cuối thuộc mô-đun worktree.
