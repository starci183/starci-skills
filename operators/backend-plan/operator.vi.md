# backend.plan

## Việc

Gom các thao tác của một contract đã đóng băng thành module, một lần — module là những thao tác dùng
chung một writer và một ranh giới kho — và cho mỗi module goal, các kho, các loại proof, các tham
chiếu migration và chỗ đứng của nó trong thứ tự, để những generator mù theo sau mỗi cái điền một
module và không thao tác nào được điền hai lần.

## Xong khi

Xong khi `backend-plan` gọi tên mọi thao tác của contract đã đóng băng trong đúng một module, mỗi
module với goal, các kho, các loại proof và các tham chiếu migration của nó, xếp một module sau những
module nó phụ thuộc, và file `units` mang một đơn vị module cho mỗi dòng Modules với cùng id và goal.

## Đơn vị của một generator mù là một module

Một generator bắt đầu với ngữ cảnh trống giữ trọn được một module: các thao tác nó điền, writer chúng
dùng chung, các kho chúng chạm, những proof cho thấy chúng chạy và những migration chúng mang. Nó
không giữ nổi một contract nhiều writer, và một contract giao cho một generator biến thành nhánh
điền nửa chừng mọi thao tác và không chứng minh được thao tác nào. Operator này là nơi duy nhất cả
contract được nhìn cùng một lúc. Nó đọc quyết định đã đóng băng — mọi dòng của bảng Operations và
mọi object của `stack-model.json` nằm cạnh — rồi phân hoạch các thao tác ấy thành module: những
thao tác dùng chung một writer và một ranh giới kho là một module, và mỗi thao tác thuộc về đúng
một. Trong từ vựng `units`, một module là kind `module`. Danh sách được ghi hai lần có chủ ý — bảng
Modules cho người đọc và dữ liệu `units` cho orchestrator toả ra — và hai bản là một danh sách:
validator từ chối một dòng không có entry, một entry không có dòng, một goal khác nhau giữa hai bên
và một thao tác mà hai dòng cùng nhận.

## Module phân hoạch contract và không bao giờ nới nó

Contract đến trong trạng thái đã đóng băng, và operator này không thêm gì vào: không thao tác,
writer, kho hay migration nào mà quyết định không mang xuất hiện trong một module, vì một module
gọi tên thao tác contract không có là một lần nới được làm trước cả lần ghi đầu tiên, và gate của
chính generator đằng nào cũng từ chối lần nới ấy. Validator đọc `stack-model.json` cạnh quyết định
được ràng và từ chối một kế hoạch để một thao tác của contract không thuộc module nào, hay gọi tên
một thao tác contract không mang. Các kho của mỗi module là hợp của các kho của các thao tác trong
nó, các tham chiếu migration là hợp của các tham chiếu ấy, để một generator biết module của nó chạm
gì từ bảng này hoặc không từ đâu cả.

## Loại proof và thứ tự chỉ đến từ kế hoạch

Mỗi module nêu các loại proof mà generator phải chạy cho nó, trong từ vựng kind `proof` công bố;
validator đọc file ấy và từ chối một loại nó không liệt kê, nên kế hoạch không bịa được một proof
không ai ghi nhận được. Một module đọc kho mà module khác ghi, hay mang migration mà module khác sở
hữu, chạy sau module ấy: phụ thuộc được ghi một lần, trong bảng Order và trong `dependsOn`, và
validator từ chối khi hai bên lệch nhau, để orchestrator xếp thứ tự toả ra từ kế hoạch và một
generator không bao giờ chờ một module mà kế hoạch không nêu.

## Thao tác không có module thì chưa được lên kế hoạch

Một thao tác contract mang mà bước 5 không đặt vào module nào được — writer của nó không rơi vào thư
mục nào mà source vạch ranh giới, hay nó dùng chung writer với một module và ranh giới kho với module
khác — là `MODULE_UNDEFINED`. Mã dừng là của chính operator này và định tuyến về chính nó: cùng bản
kế hoạch chạy lại với ranh giới được nêu trong phần handoff của quyết định, hoặc với writer được chủ
contract sửa lại. Nó không bao giờ là lỗi của bên gọi và không bao giờ thành `INVALID_INPUT`, vì một
quyết định được phép nêu writer bằng lời của chủ nó, và chính operator này là bên biến writer thành
module. Một thư mục mà kế hoạch định nêu nhưng checkout không mang ở head đã đóng băng là
`EVIDENCE_MISSING`: một khẳng định về source không có file nào đứng sau.

## Ranh giới

Context chỉ đọc. Operator chỉ ghi `response/` của nhánh mình: bản kế hoạch, danh sách đơn vị và
`response.json`. Nó không điền thao tác nào, không ghi source, không chạy proof, không sửa contract
và không quyết luật nghiệp vụ nào; việc điền thuộc về generator nhận một module, và contract thuộc
về chủ của nó.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/be` | checkout backend được route ở head đã đóng băng: các thư mục mà từng writer của contract rơi vào và các kho những thư mục ấy đã chạm, đọc để ranh giới module được vạch ở nơi source đã vạch, không bao giờ thay contract; không bao giờ ghi | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `architecture-decision` | `architecture.decide`; contract đã đóng băng mà bảng Operations và `stack-model.json` cạnh nó là tập đầy đủ để các module phân hoạch | có |
| `business-promise-authority` | `business.decide`; lời hứa mà các chiều của nó được các thao tác trích dẫn, đọc để goal của một module được nêu bằng lời của lời hứa, khi tính năng có một lời hứa | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `featureId` | id | — | Tính năng mà contract của nó được các module phân hoạch; nó làm tiêu đề bản kế hoạch |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm gate và chạy lại | `resume` | `request/request.json`, bản kế hoạch bị chặn khi chạy lại | — | `INVALID_INPUT`, `NO_PROGRESS` |
| 2 | Đọc contract đã đóng băng: mọi thao tác của bảng Operations và của `stack-model.json` cạnh nó, với writer, các kho, các tham chiếu migration và các chiều | `featureId` | đầu vào `architecture-decision` | — | — |
| 3 | Đọc lời hứa khi được ràng: các chiều mà từng thao tác trích dẫn, để goal của một module được nêu bằng lời của lời hứa | — | đầu vào `business-promise-authority` | — | — |
| 4 | Đọc source ở head đã đóng băng: thư mục mà từng writer rơi vào và các kho nó đã chạm, làm bằng chứng về nơi source vạch ranh giới | — | @workspaces/be, @tools/git | — | `EVIDENCE_MISSING` |
| 5 | Gom các thao tác thành module: những thao tác dùng chung một writer và một ranh giới kho là một module, và mỗi thao tác thuộc về đúng một | — | các thao tác, source | — | `MODULE_UNDEFINED` |
| 6 | Cho mỗi module dòng goal, các kho, các loại proof và các tham chiếu migration, lấy từ các thao tác nó mang | — | các module, contract | — | — |
| 7 | Xếp thứ tự các module: module đọc kho mà module khác ghi, hay mang migration mà module khác sở hữu, chạy sau module ấy | — | các module, contract | — | — |
| 8 | Ghi danh sách đơn vị: một entry cho mỗi dòng Modules với cùng id và goal, và các module mà mỗi cái phụ thuộc | — | bản kế hoạch | `units` | — |
| 9 | Phát bản kế hoạch và biên nhận | — | mọi thứ ở trên | `backend-plan`, `response/response.json` | — |

Bước 5 là bước duy nhất dừng vì chính bản kế hoạch: một thao tác bước 2 đã đọc mà không module nào
nhận được là `MODULE_UNDEFINED`, với reason nêu nó trong một đoạn, và không phát gì cả. Chạy lại bắt
đầu lại từ bước 1 và đọc lại contract và source; một lần vào lại mà kế hoạch gọi tên cùng những
module như nhánh nó chạy lại là `NO_PROGRESS`.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `backend-plan` | `response/response.md` | md | có |
| `units` | `response/data/units.json` | data | có |

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `NO_PROGRESS` | terminate |
| `EVIDENCE_MISSING` | terminate |
| `MODULE_UNDEFINED` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| mọi thao tác đã có module: mỗi module được generator điền trên nhánh riêng dưới scope full, mang id đơn vị của nó | `backend.generate` |
| một thao tác contract mang là thứ người có thể không muốn điền trong nhiệm vụ này, nên người nói nó có thuộc nhiệm vụ hay không | `user` |
