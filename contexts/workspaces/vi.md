---
title: Workspaces · Vietnamese
---

# Không gian làm việc

Đầu vào là một yêu cầu khởi động viết bằng lời thường — "start starci-academy fe be" — và đầu ra là,
với **mỗi vai trò** mà yêu cầu đó gọi tên, một route đã giải và một phán quyết: đọc từ checkout này,
hay dừng lại và trả về bước setup. Mô-đun này quyết định **sự thật được đọc từ đâu**. Sai ở đây thì
không tầng nào bên dưới còn đúng, và cái sai đó không tự lên tiếng: agent vẫn đọc một repository thật,
chỉ không phải repository mà yêu cầu muốn nói.

## Luật

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
| `WORKSPACE-6` | Route mang đường dẫn máy, khoá hoặc thông tin đăng nhập | route ở lại trong máy; không bao giờ chép vào cây quy tắc |

## Đọc một lệnh khởi động

1. **Hiểu yêu cầu đúng nghĩa chữ.** `start <project> <roles...>` gọi tên chính xác những vai trò cần
   tải. Không thêm một vai trò vì repository trông như có nó, và không bỏ một vai trò vì session trước
   không dùng.
2. **Giải một tệp cho mỗi vai trò**: `.workspace/<project>/<role>/config.json`. Mọi tệp được gọi tên
   đều phải tồn tại — `WORKSPACE-1`.
3. **Xác minh trước khi đọc.** Với từng route, thư mục checkout phải tồn tại và phải còn chứa đúng
   bằng chứng mà route khai: đường dẫn hợp đồng với vai trò frontend, các manifest nó gọi tên. Hỏng ở
   bước này là `WORKSPACE-5` và nó **dừng** cả lượt chạy.
4. **Đọc chính checkout, không đọc bản sao.** Cấu hình chỉ để định tuyến — `WORKSPACE-3`.
5. **Không bao giờ nới route ra.** Route thiếu hoặc cũ thì trả về setup — `WORKSPACE-2`,
   `WORKSPACE-5` — và setup chỉ làm mới cấu hình; nó không clone, không link, không copy, không sửa
   repository đích.

## `WORKSPACE-1` — lệnh khởi động gọi tên project và vai trò

**Tình huống.** Yêu cầu nêu một danh tính và một hoặc nhiều vai trò, mỗi vai trò có tệp route riêng.
Hai vai trò là hai route, không phải một route đọc theo hai cách.

**Dấu hiệu nhận biết**

- Yêu cầu gọi tên một project.
- Mỗi vai trò là một từ đủ để dựng nên đường dẫn route.
- Trong yêu cầu không có gì mô tả một thư mục.

**Tự hỏi.** Mọi vai trò được gọi tên có biến thành một đường dẫn tồn tại thật mà không cần đoán không?

**Ranh giới**

- `WORKSPACE-2`: nếu một tệp được gọi tên mà không có, mã này không đạt tới. Giải route là **được hết
  hoặc dừng**, không có giải một phần.

**Nó hỏng bằng đường nào.** Một vai trò bị suy ra từ checkout nằm cạnh đang có trên đĩa, thế là agent
tải một repository không ai yêu cầu rồi báo cáo về nó như thể được yêu cầu.

## `WORKSPACE-2` — tệp route được gọi tên nhưng không tồn tại

**Tình huống.** Yêu cầu gọi tên một vai trò mà máy này không có tệp route cho nó.

**Dấu hiệu nhận biết**

- Đường dẫn dựng từ project và vai trò không tồn tại.
- Một vai trò khác của cùng project vẫn giải được bình thường.

**Tự hỏi.** Thứ đang thiếu là cái route, hay là repository mà route trỏ tới?

**Ranh giới**

- `WORKSPACE-5`: một route có thật nhưng không còn mô tả đúng checkout là **cũ**, không phải **thiếu**,
  và đó là phán quyết khác với cách sửa khác.

**Nó hỏng bằng đường nào.** Vai trò thiếu bị âm thầm thay bằng vai trò gần nhất giải được, và mọi phát
biểu sau đó là về vai trò sai.

## `WORKSPACE-3` — checkout là nơi đọc và ghi

**Tình huống.** Route đã giải, và công việc từ đây diễn ra trong repository thật tại
`repository.diskPath`.

**Dấu hiệu nhận biết**

- Route mang một đường dẫn đĩa, một git root, một nhánh và một head.
- Bản thân cấu hình không chứa tệp nguồn nào của riêng nó.

**Tự hỏi.** Mình có đang sắp đọc một **bản sao** của repository thay vì chính repository không?

**Ranh giới**

- `WORKSPACE-4`: đọc hợp đồng là một hành vi hẹp hơn, kèm đòi hỏi riêng về xuất xứ.

**Nó hỏng bằng đường nào.** Một bản mirror, mount, link hay cache được đọc thay cho checkout, nên câu
trả lời mô tả một khoảnh khắc đã đóng băng trong khi repository đã đi tiếp.

## `WORKSPACE-4` — một vai trò cần hợp đồng miền của nó

**Tình huống.** Vai trò frontend phải biết những thành phần và slot nào **có thật** trước khi trả lời
bất cứ điều gì về bố cục, và đường dẫn hợp đồng là thẩm quyền duy nhất cho chuyện đó.

**Dấu hiệu nhận biết**

- Route gọi tên một đường dẫn hợp đồng.
- Route cũng ghi lại đường dẫn ấy được chọn thế nào — khai báo, hay dò ra.

**Tự hỏi.** Mình có biết đường dẫn hợp đồng này do người khai báo hay do máy dò ra không?

**Ranh giới**

- `WORKSPACE-5`: một đường dẫn hợp đồng không còn tồn tại là route cũ, không phải câu hỏi về hợp đồng.

**Nó hỏng bằng đường nào.** Hợp đồng bị đoán theo quy ước thư mục thay vì đọc, nên những thành phần đã
đổi tên hoặc đã bỏ vẫn được đem ra đề xuất.

## `WORKSPACE-5` — route đã cũ

**Tình huống.** Tệp route vẫn hợp lệ và đầy đủ, nhưng máy không còn khớp với nó: checkout đã chuyển
chỗ, tệp hợp đồng đã đổi tên, head đã ghi thuộc một nhánh đã bị viết lại.

**Dấu hiệu nhận biết**

- Mọi trường đều có mặt và đúng dạng.
- Có ít nhất một đường dẫn hoặc head không sống sót qua một lần kiểm với đĩa hoặc với git.

**Tự hỏi.** Mình đã **xác minh** route, hay chỉ **đọc cú pháp** của nó?

**Ranh giới**

- `WORKSPACE-2`: thiếu là không có tệp; cũ là có tệp nhưng tệp đó nói sai.

**Nó hỏng bằng đường nào.** Không có lỗi nào được nêu. Lượt chạy tiếp tục trên bất cứ thứ gì còn nằm ở
đường dẫn cũ, và cho ra một khối việc trông như đã hoàn tất nhưng không áp vào đâu cả.

## `WORKSPACE-6` — route mang những sự thật riêng của một máy

**Tình huống.** Route giữ đường dẫn đĩa và siêu dữ liệu git công khai. Nó là cấu hình cục bộ, không
phải kiến thức dùng chung.

**Dấu hiệu nhận biết**

- Các giá trị khác nhau giữa máy này và máy khác.
- Cây quy tắc sẽ **sai** trên máy người khác nếu nó chứa những giá trị đó.

**Tự hỏi.** Đưa giá trị này vào commit thì cây quy tắc có trở thành sai với người khác không?

**Ranh giới**

- `WORKSPACE-3`: đọc checkout thì được; công bố checkout nằm ở đâu thì không.

**Nó hỏng bằng đường nào.** Một đường dẫn hoặc một token bị chép vào trong một luật, và luật đó âm
thầm chỉ còn đúng trên một máy. Khoá bí mật, biến môi trường và token thì không bao giờ là context của
workspace ngay từ đầu.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| yêu cầu | Danh sách project và vai trò đúng nghĩa chữ |
| route | `.workspace/<project>/<role>/config.json`, hợp `workspace.schema.json` |
| checkout | Thư mục tại `repository.diskPath`, có thật trên đĩa |
| hợp đồng | Tệp tại `context.contract`, và `context.contractSource` cho xuất xứ của nó |
| độ mới | Head và nhánh đã ghi còn mô tả đúng checkout đó |

## Quy tắc

1. Giải route là **được hết hoặc dừng**. Một yêu cầu giải được một phần không phải là yêu cầu đã giải.
2. Danh tính đến từ `project` và `role`. Tên thư mục không phải danh tính.
3. Xác minh trước khi đọc. Đọc được cú pháp của route không phải là đã xác minh nó.
4. Route **mô tả**, không bao giờ **nhân bản**. Cấu hình không giữ bản sao nào của repository đích.
5. Setup chỉ làm mới route. Nó không clone, không link, không copy, không sửa repository đích.
6. Giá trị trong route ở lại trong máy. Chúng không bao giờ được commit vào cây quy tắc, và khoá bí mật
   thì ngay từ đầu đã không phải giá trị của route.
7. Mỗi lệnh khởi động ra đúng một phán quyết cho mỗi vai trò: đọc, hoặc dừng.

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
route: .workspace/<project>/<role>/config.json
repository: <diskPath>
verified: <đã kiểm gì với đĩa hoặc với git>
situation: <WORKSPACE-1 | WORKSPACE-2 | WORKSPACE-3 | WORKSPACE-4 | WORKSPACE-5 | WORKSPACE-6>
verdict: <read | stop>
reason: <sự thật đã quyết định điều đó>
```

## Ví dụ đã giải

**Yêu cầu.** "start starci-academy fe be"

Yêu cầu gọi tên một project và hai vai trò, nên nó giải đúng hai tệp route và không gì khác. Nó không
gọi tên đường dẫn nào, nhánh nào, hợp đồng nào, nên không thứ nào trong số đó được giả định.

```text
project: starci-academy
role: fe
route: .workspace/starci-academy/fe/config.json
repository: <disk>\starci-academy-fe
verified: checkout tồn tại; context.contract có thật tại src/components/contracts/index.ts
situation: WORKSPACE-3
verdict: read
reason: route giải được và lời khai về hợp đồng của nó sống sót qua một lần kiểm với đĩa, nên việc đọc nhắm vào chính checkout chứ không vào bản sao nào
```

```text
project: starci-academy
role: be
route: .workspace/starci-academy/be/config.json
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
