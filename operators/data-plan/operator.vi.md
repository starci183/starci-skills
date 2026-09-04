# data.plan

## Việc

Gọi tên mọi seed mà nhiệm vụ cần, một lần — mỗi luồng mà kế hoạch UAT nêu và mỗi họ dữ liệu mà goal
nêu là một đơn vị — mỗi đơn vị với goal, namespace riêng, các kho đích, khối lượng đại diện và
rollback của nó, để những seeder mù theo sau mỗi cái đặt một đơn vị và không hai cái nào từng dùng
chung một dòng dữ liệu.

## Xong khi

Xong khi `seed-plan` gọi tên một đơn vị cho mỗi luồng hay họ dữ liệu mà goal, kế hoạch UAT hay bản đồ
bề mặt nêu, mỗi đơn vị với namespace riêng và ít nhất một đích mang cách quy nguồn, khối lượng và
rollback của nó, và file `units` mang một đơn vị cho mỗi dòng Units với cùng id và goal.

## Đơn vị của một seeder mù là một tập dòng quy được nguồn

Một seeder bắt đầu với ngữ cảnh trống giữ trọn được một seed: những dòng nào phải đứng sẵn trước khi
một luồng bắt đầu hay một bề mặt được chấm, chúng thuộc về ai, có bao nhiêu và thứ gì gỡ chúng đi.
Nó không giữ nổi các seed của cả một nhiệm vụ, và một nhiệm vụ giao cho một seeder biến thành lần
chạy lấp đầy mọi kho dưới một namespace, để rollback của luồng này thành thất bại của luồng kia.
Operator này là nơi duy nhất nhiệm vụ được đọc để tìm dữ liệu của nó cùng một lúc. Mỗi luồng mà kế
hoạch UAT nêu thành một đơn vị mang namespace mà dòng của luồng đã khai, và mỗi họ dữ liệu goal nêu
mà không luồng nào bao — catalogue mà trang danh sách phải hiện ở mật độ thật, những dòng một phép
kiểm phải thấy đứng sẵn — thành một đơn vị riêng. Trong từ vựng `units`, một đơn vị seed là kind
`table`: một tập dòng được đặt cùng nhau và gỡ cùng nhau, khoá theo luồng hay họ nó phục vụ. Danh
sách được ghi hai lần có chủ ý — bảng Units cho người đọc và dữ liệu `units` cho orchestrator toả
ra — và hai bản là một danh sách: validator từ chối một dòng không có entry, một entry không có dòng
và một goal khác nhau giữa hai bên.

## Một namespace thuộc về đúng một đơn vị

Luật cô lập mà chủ runtime công bố dưới
[Hai phiên, một sản phẩm](../runtime-serve/operator.vi.md#hai-phiên-một-sản-phẩm) nói điều gì làm
một dòng quy được nguồn, và operator này không nhắc lại; nó quyết, cho từng đích, đơn vị lấy cách
quy nguồn nào trong hai cách của luật — tài khoản đã cấp của đơn vị nơi kho có cột chủ sở hữu, tiền
tố của đơn vị nơi một định danh mang được nó — và ghi một kho không có cả hai là `limitation` của
đích ấy, không bao giờ là một cột cần thêm. Một namespace thuộc về đúng một đơn vị của kế hoạch, và
validator từ chối hai dòng dùng chung một namespace, vì hai seeder trên một namespace dùng chung một
lần dọn. Một luồng mà thư mục đã mang seed giữ nguyên namespace nó có, và một namespace mà thư mục
đã giữ là thứ không đơn vị mới nào được nhận.

## Khối lượng là mật độ mà audit chấm theo

Mỗi dòng đích nêu khối lượng đại diện của nó: số dòng mà bề mặt phải mang, không phải một dòng đủ
để luồng qua. Audit đo các tiêu chí phụ thuộc dữ liệu ở đúng khối lượng ấy và trả về seeder khi thấy
ít hơn, nên một khối lượng khai thấp ở đây là một audit qua trên trang trống. Ô rollback nói thứ gì
gỡ đúng những dòng ấy và không gì khác — những dòng tài khoản sở hữu, những dòng mà định danh mang
tiền tố — để tập rollback của seeder được đối chiếu với kế hoạch trước khi một dòng được đặt.

## Seed không ai đặt được thì không phải đơn vị

Một luồng hay một họ mà bước 2 hay 3 tìm thấy và không kho nào ở head đã đóng băng chứa được — không
entity, bảng hay collection nào mà các dòng của nó rơi vào — là `SEED_UNDEFINED`. Mã dừng là của
chính operator này và định tuyến về chính nó: cùng bản kế hoạch chạy lại với kho được nêu trong goal,
hoặc với một bản đồ bề mặt mà contract dữ liệu nêu nó. Nó không bao giờ là lỗi của bên gọi và không
bao giờ thành `INVALID_INPUT`, vì goal được phép nêu một họ bằng lời của người, và chính operator này
là bên biến lời thành kho. Một đích mà kế hoạch định nêu nhưng checkout không khai là
`EVIDENCE_MISSING`: một khẳng định về các kho không có file nào đứng sau.

## Ranh giới

Context chỉ đọc. Operator chỉ ghi `response/` của nhánh mình: bản kế hoạch, danh sách đơn vị và
`response.json`. Nó không soạn thư mục seed, không đặt dòng nào, không gỡ dòng nào, không cấp tài
khoản, không chạm tới kho và không đổi schema; việc đặt thuộc về seeder nhận một đơn vị. Nó gọi tài
khoản chỉ bằng alias và không có trường nào có thể chứa một credential.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/be` | checkout backend được route ở head đã đóng băng: các entity, bảng và collection mà các kho khai, đọc để gọi tên đích của từng đơn vị và để biết một đích có cột chủ sở hữu hay định danh gắn tiền tố được không; không bao giờ ghi | có |
| `@worktrees/_templates` | template seed mà cây cung cấp: hình dạng một thư mục seed, các bản ghi, kỳ vọng và tập rollback của nó, để mọi đơn vị được lên kế hoạch là đơn vị một seeder soạn được | có |
| `@worktrees/uat/<flow>` | các thư mục luồng đã tồn tại dưới tính năng: luồng đã có seed giữ nguyên namespace, và namespace một thư mục đã giữ là thứ không đơn vị mới nào được nhận | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `uat-plan` | `uat.plan`; các luồng nhiệm vụ đi thử, mỗi luồng với namespace seed mà đơn vị của nó nhận, khi nhiệm vụ lên kế hoạch một lần đi thử | không |
| `surface-map` | `interface.plan`; các trang mà contract dữ liệu nói từng trang đọc gì, để một họ goal nêu có kho của nó, khi nhiệm vụ đã dựng một bề mặt | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `goal` | text | — | Goal của nhiệm vụ bằng lời của người; mỗi họ dữ liệu nó nêu mà không luồng nào bao thành một đơn vị |
| `feature` | id | — | Khoá tính năng định địa chỉ các thư mục luồng và làm tiêu đề bản kế hoạch |
| `env` | id | dev | Môi trường mà các kho và thư mục luồng của các đơn vị được lên kế hoạch cho |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại | `resume` | `request/request.json`, bản kế hoạch bị chặn khi chạy lại | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Đọc goal: mọi họ dữ liệu nó nêu, những dòng một bề mặt hay một phép kiểm phải thấy đứng sẵn | `goal` | goal mà request mang | — | — |
| 3 | Đọc kế hoạch UAT khi được ràng: mỗi luồng một đơn vị, với namespace mà dòng của luồng khai | — | đầu vào `uat-plan` | — | — |
| 4 | Đọc bản đồ bề mặt khi được ràng: các kho mà contract dữ liệu của từng trang đọc, để một họ có đích của nó | — | đầu vào `surface-map` | — | — |
| 5 | Đọc các kho ở head đã đóng băng: mọi entity, bảng và collection, và với từng cái, nó có cột chủ sở hữu hay định danh gắn tiền tố được không | `env` | @workspaces/be, @tools/git | — | — |
| 6 | Đọc các thư mục luồng đã tồn tại dưới tính năng: luồng đã có seed giữ nguyên namespace, và không đơn vị mới nào nhận namespace đã bị giữ | `feature` | @worktrees/uat/<flow>, @worktrees/_templates cho hình dạng một thư mục seed | — | — |
| 7 | Gọi tên một đơn vị cho mỗi luồng và mỗi họ chưa được bao, với dòng goal và namespace riêng, tách biệt với mọi đơn vị khác | — | các họ, các luồng, các thư mục có sẵn | — | `SEED_UNDEFINED` |
| 8 | Khai các đích của từng đơn vị: kho, cách quy nguồn, khối lượng đại diện và thứ gỡ đúng các dòng của nó | — | các đơn vị, các kho | — | `EVIDENCE_MISSING` |
| 9 | Ghi danh sách đơn vị: một entry cho mỗi dòng Units với cùng id và goal, và các đơn vị mà mỗi cái phụ thuộc | — | bản kế hoạch | `units` | — |
| 10 | Phát bản kế hoạch và biên nhận | — | mọi thứ ở trên | `seed-plan`, `response/response.json` | — |

Bước 7 là bước duy nhất dừng vì chính bản kế hoạch: một luồng hay một họ mà bước 2 và 3 tìm thấy
nhưng không kho nào chứa được là `SEED_UNDEFINED`, với reason nêu nó trong một đoạn, và không phát
gì cả. Chạy lại bắt đầu lại từ bước 1 và đọc lại goal, kế hoạch và các kho; một lần vào lại mà kế
hoạch gọi tên cùng những đơn vị như nhánh nó chạy lại là `NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `seed-plan` | `response/response.md` | md | có |
| `units` | `response/data/units.json` | data | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `SEED_UNDEFINED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| mọi đơn vị đã có namespace và các đích: mỗi đơn vị được seeder đặt trên nhánh riêng, mang id đơn vị của nó | `data.seed` |
| một họ dữ liệu goal nêu là thứ người có thể không muốn seed, nên người nói nó có thuộc nhiệm vụ hay không | `user` |
