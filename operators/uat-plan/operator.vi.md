# uat.plan

## Việc

Liệt kê các hành trình người dùng mà goal của nhiệm vụ gọi tên, mỗi hành trình một luồng với route
vào, ngân sách bước, alias tài khoản riêng và namespace seed riêng, để những walker mù theo sau mỗi
cái đi một luồng và không hai cái nào từng dùng chung một dòng dữ liệu.

## Xong khi

Xong khi `uat-plan` gọi tên một luồng cho mỗi hành trình mà goal nêu, mỗi luồng với route vào, ngân
sách bước, alias tài khoản riêng, namespace seed riêng và tier của nó, và file `units` mang một đơn
vị luồng cho mỗi dòng Flows với cùng id và tier.

## Đơn vị của một walker mù là một luồng

Một walker bắt đầu với ngữ cảnh trống giữ trọn được một hành trình: nó vào ở đâu, bấm những control
nào theo thứ tự, đăng nhập là ai và phải thấy gì đã được seed. Nó không giữ nổi các hành trình của
cả một nhiệm vụ, và một nhiệm vụ giao cho một walker biến thành lần chạy seed mọi thứ, đăng nhập là
mọi người và không chứng minh được gì về ai. Operator này là nơi duy nhất goal được đọc để tìm các
hành trình của nó: mỗi hành trình goal gọi tên — một vai làm một việc kết thúc ở một trạng thái quan
sát được — thành một dòng Flows và một entry `units` với hành trình làm dòng goal, và hai bản là một
danh sách. Bảng Flows mang thứ một walker cần trước khi soạn bất cứ gì: route hành trình đi vào,
ngân sách tính bằng bước, alias tài khoản và namespace seed của nó.

## Mỗi luồng sở hữu các dòng của mình

Hai walker dùng chung một tài khoản là dùng chung một lần đăng nhập, rồi mỗi bên chứng minh phiên của
bên kia; hai walker dùng chung một namespace seed là dùng chung một lần dọn, và rollback của lần chạy
này thành thất bại của lần chạy kia. Vì thế bản kế hoạch cho mỗi luồng một alias tài khoản riêng và
một namespace riêng, tách biệt với mọi luồng khác của kế hoạch, và validator từ chối một kế hoạch có
hai dòng mang cùng alias hay cùng namespace. Một thư mục luồng đã tồn tại giữ nguyên tên, các alias và
namespace nó đang có, vì một bản ghi không ai đoán được vị trí là bản ghi không ai đọc; kế hoạch dùng
lại nó và không bao giờ đổi tên.

## Hành trình không có lối vào thì không phải luồng

Một hành trình goal gọi tên mà không bắt đầu ở đâu trong bản đồ bề mặt hay một luồng có sẵn là
`FLOW_UNDEFINED`. Mã dừng là của chính operator này và định tuyến về chính nó: cùng bản kế hoạch chạy
lại với một bản đồ bề mặt nêu lối vào, hoặc với route vào được nêu trong goal. Nó không bao giờ là lỗi
của bên gọi và không bao giờ thành `INVALID_INPUT`, vì goal được phép nêu một hành trình bằng lời của
người, và chính operator này là bên biến lời thành route vào.

## Hành trình được đi thử, còn mọi thứ khác là chưa kiểm

Goal gọi tên các hành trình; các dòng "xong khi" của nhiệm vụ gọi tên hành trình nào trong số đó lượt
chạy này phải chứng minh. Những luồng ấy là `journey` và walker được toả nhánh lên chúng. Một luồng
mà kế hoạch gọi tên vì tính năng có nó, nhưng không dòng "xong khi" nào với tới, là `secondary`: nó
mang đúng một câu nói vì sao, và được ghi xuống là chưa kiểm ở làn đi thử dưới
`@worktrees/unchecked` thay vì được đi — để một lượt chạy chứng minh ba trên bảy hành trình nói rõ bốn
hành trình nào nó đã không đi, thay vì để người đọc tự cho rằng nó đã chứng minh mọi thứ. Một luồng
mà tính năng đang mang một mục chưa kiểm còn mở ở làn đi thử thì được kế hoạch này lấy trở lại vào
hành trình, và lượt đi chạy sẽ kiểm nó, hoặc được gia hạn bằng một dòng secondary với lý do của chính kế hoạch này;
một kế hoạch bỏ nó khỏi danh sách là hoãn nó thêm lần nữa mà không ai đồng ý, và bị từ chối.

## Luồng attempt cụ thể

Các row của operator này được gate bởi hợp đồng attempt expected/actual dùng chung trong `scripts/attempt-gate.mjs`.

| Trạng thái quan sát | Hành động | Kiểm actual | Nhánh kế tiếp |
| --- | --- | --- | --- |
| flow và case sheet còn khớp journey, route, env | tái dùng stable id, alias, namespace | validate table và machine JSON theo goal/route | phát plan và sheet tái dùng |
| thiếu | tạo một flow mỗi journey và case trước thực thi | mỗi case có actor, precondition, input, UI action, assertion, expected, verification, JSON, SQL tùy chọn, cleanup | phát plan, sheet, units |
| stale hoặc sai | update case/alias/fixture ref bị ảnh hưởng; giữ history | chạy lại check route, actor, assertion, namespace, fixture | repair attempt; handoff owner route chưa rõ |
| fixture tạo asserted outcome | từ chối fixture | nêu precondition/assertion xung đột | handoff `data.plan` |

## Ranh giới

Context chỉ đọc. Operator chỉ ghi `response/` của nhánh mình: bản kế hoạch, danh sách đơn vị và
`response.json`. Nó không soạn tài liệu luồng, không seed gì, không cấp tài khoản, không đăng nhập ở
đâu, không mở trình duyệt và không đi thử gì; việc đi thử thuộc về operator nhận một luồng. Nó gọi
credential chỉ bằng alias và không có trường nào có thể chứa một credential.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@worktrees/_templates` | template luồng UAT mà cây cung cấp: hình dạng một thư mục luồng, các case, các alias chúng đóng vai và seed của nó, để mọi luồng được lên kế hoạch là luồng một walker soạn được | có |
| `@worktrees/uat/<flow>` | các thư mục luồng đã tồn tại dưới tính năng: luồng đã tồn tại giữ nguyên tên, các alias tài khoản và namespace seed của nó | không |
| `@worktrees/unchecked/<product>` | phần chưa kiểm mà tính năng này đang mang trong làn đi thử: mọi luồng một nhiệm vụ trước đã hoãn, để kế hoạch này kiểm nó hay gia hạn nó thay vì lại lặng lẽ hoãn thêm lần nữa | không |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `surface-map` | `interface.plan`; các trang và modal mà các hành trình đi qua, với route chúng đi vào, khi nhiệm vụ đã dựng một bề mặt | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `goal` | text | — | Goal của nhiệm vụ bằng lời của người; mỗi hành trình nó gọi tên thành một luồng |
| `feature` | id | — | Khoá tính năng định địa chỉ các thư mục luồng và làm tiêu đề bản kế hoạch |
| `env` | id | dev | Môi trường mà các thư mục luồng, tài khoản và seed của các luồng được lên kế hoạch cho |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại | `resume` | `request/request.json`, bản kế hoạch bị chặn khi chạy lại | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Đọc goal: mọi hành trình người dùng nó gọi tên, mỗi cái thành một câu với vai đi hành trình ấy | `goal` | goal mà request mang | — | — |
| 3 | Đọc bản đồ bề mặt khi được ràng: route vào của mỗi hành trình và các trang, modal nó đi qua | — | đầu vào `surface-map` | — | — |
| 4 | Kiểm flow folder và machine case sheet hiện có, phân loại flow/case ổn định reusable, missing hoặc invalid, giữ name, alias, namespace và history | `feature`, `env` | @worktrees/uat/<flow>, @worktrees/_templates cho hình dạng một thư mục luồng | — | — |
| 5 | Tái dùng, update hoặc tạo một flow mỗi journey và ghi case trước thực thi: actor, precondition, input, ordered UI action, assertion, expected, verification, JSON fixture, SQL tùy chọn, cleanup | — | các hành trình, bản đồ, các luồng có sẵn | — | `FLOW_UNDEFINED` |
| 6 | Cho mỗi luồng alias tài khoản riêng và namespace seed riêng, tách biệt với mọi luồng khác của kế hoạch | `env` | các luồng, @worktrees/uat/<flow> cho các alias đã được cấp | — | — |
| 7 | Xếp tier cho từng luồng theo các dòng "xong khi" của nhiệm vụ: `journey` nơi một dòng đi qua nó, `secondary` kèm một câu lý do nơi không dòng nào đi qua, và mọi mục chưa kiểm còn mở của tính năng này được lấy lại hay gia hạn | — | các dòng "xong khi" của nhiệm vụ, các luồng, @worktrees/unchecked/<product> | — | — |
| 8 | Ghi danh sách đơn vị: một đơn vị luồng cho mỗi dòng Flows với cùng id và tier, hành trình làm goal và lý do hoãn của nó khi nó có một lý do | — | bản kế hoạch | `units` | — |
| 9 | Phát human plan, machine case sheet, units khớp và receipt chỉ sau khi mọi case và fixture ref validate | — | mọi thứ ở trên | `uat-plan`, `uat-case-sheet`, `response/data/cases.json`, `units`, `response/response.json` | — |

Bước 5 là bước duy nhất dừng vì chính bản kế hoạch: một hành trình bước 2 tìm thấy mà không bản đồ
hay thư mục nào cho lối vào là `FLOW_UNDEFINED`, với reason nêu nó trong một đoạn, và không phát gì
cả. Chạy lại bắt đầu lại từ bước 1 và đọc lại goal và bản đồ; một lần vào lại mà kế hoạch gọi tên
cùng những luồng như nhánh nó chạy lại là `NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `uat-plan` | `response/response.md` | md | có |
| `uat-case-sheet` | `response/data/cases.json` | data | có |
| `units` | `response/data/units.json` | data | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `FLOW_UNDEFINED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| mọi luồng đã có lối vào, alias tài khoản và namespace: mỗi luồng được đi thử trên nhánh riêng, mang id đơn vị của nó | `uat.verify` |
| một hành trình goal gọi tên là thứ người có thể không muốn đi thử, nên người nói nó có thuộc nhiệm vụ hay không | `user` |
