# Nâng cấp SDS thành bản đồ code và đường đi của luồng

## Định nghĩa đã thống nhất

SDS của sản phẩm là bản đồ code đích. Người đọc phải lần theo được một nghiệp vụ từ màn hình hoặc sự kiện đầu vào, qua các file, class, function, module, service và dữ liệu, đến kết quả cuối cùng quay về app hoặc bên nhận.

- SRS xác định nghiệp vụ, quy tắc, các luồng và kết quả cần đạt.
- SDS xác định code được tổ chức, gọi nhau và thay đổi trạng thái như thế nào để thực hiện đúng SRS.
- Code hiện thực hóa bản đồ SDS. Test và quan sát hành vi thực tế chứng minh từng luồng và kết quả đã được thực hiện đúng.

SDS được phép thiết kế file/hàm chưa tồn tại và phải đánh dấu rõ dự kiến tạo. Source hiện có được dùng để kiểm tra sự phù hợp với thiết kế; không tự thay thế yêu cầu nghiệp vụ hoặc hợp thức hóa hành vi lệch SRS.

Định nghĩa này thay thế hướng dẫn cũ loại source mapping khỏi SDS. Repo, đường dẫn file, symbol, signature, caller/callee, điểm kiểm tra quyền, transaction và vị trí kiểm chứng thuộc nội dung SDS cần thiết kế.

## Cấu trúc folder và file

Một dự án chỉ có một `.starciwork` tại gốc source đã chọn. Bên trong là `features/<feature>/`; từng feature mới sở hữu `business/`, `architecture/`, `ui/`, `implementation/` và `uat/` khi có nội dung. Tên dự án nằm trong metadata, không thêm một folder tên dự án. Ví dụ chatbot dùng `.starciwork/features/chatbot/business/` và `.starciwork/features/chatbot/architecture/`. Quy tắc/dữ liệu/journey dùng chung có một feature chịu trách nhiệm sở hữu, các feature khác tham chiếu bằng ID; không nhân bản cùng đặc tả.

Lấy flow làm trục chính. Các phần code-map, contracts, data và quality định nghĩa những thành phần mà flow tham chiếu.

```text
.starciwork/features/<feature>/architecture/
├── index.yaml
├── overview/
│   └── index.yaml
└── sds/
    ├── index.yaml
    ├── flows/
    │   ├── index.yaml
    │   └── <flow>/
    │       └── index.yaml
    ├── code-map/
    │   ├── index.yaml
    │   ├── frontend/
    │   │   ├── index.yaml
    │   │   └── <code-unit>/
    │   │       └── index.yaml
    │   ├── backend/
    │   │   ├── index.yaml
    │   │   └── <code-unit>/
    │   │       └── index.yaml
    │   └── shared/
    │       ├── index.yaml
    │       └── <code-unit>/
    │           └── index.yaml
    ├── contracts/
    │   ├── index.yaml
    │   └── <api-or-event>/
    │       └── index.yaml
    ├── data/
    │   ├── index.yaml
    │   └── <data-model>/
    │       └── index.yaml
    ├── quality/
    │   ├── index.yaml
    │   ├── security/
    │   │   ├── index.yaml
    │   │   └── <concern>/index.yaml
    │   ├── performance/
    │   │   ├── index.yaml
    │   │   └── <concern>/index.yaml
    │   └── reliability/
    │       ├── index.yaml
    │       └── <concern>/index.yaml
    ├── deployment/
    │   ├── index.yaml
    │   └── <topology>/
    │       └── index.yaml
    ├── decisions/
    │   ├── index.yaml
    │   └── <decision>/
    │       └── index.yaml
    └── verification/
        ├── index.yaml
        └── <scenario>/
            └── index.yaml
```

Đây là cây filesystem đích của lần nâng cấp. Các tên trong dấu `<...>` là placeholder. Chỉ tạo các mục có nội dung thiết kế thực sự liên quan; schema mới cần hỗ trợ cây này.

- Mỗi mục có một folder riêng và một file `index.yaml` chứa đầy đủ nội dung của mục đó.
- Mỗi folder trung gian có `index.yaml` tổng hợp phạm vi, metadata và phụ thuộc; không sao chép toàn bộ nội dung các mục con.
- Main, alternative, exception, recovery và postconditions của một flow nằm trong cùng `flows/<flow>/index.yaml`.
- Mỗi định nghĩa code-unit, contract, data model hoặc cơ chế dùng chung có một nơi sở hữu chính. Flow dùng ID/symbol refs để nối bản đồ.
- Có thể thêm cấp folder khi phạm vi lớn; mỗi cấp vẫn có `index.yaml`. ID ổn định độc lập với đường dẫn tổ chức.

## Overview

`architecture/overview/index.yaml` ghi mục tiêu thiết kế, phạm vi, actors và hệ thống ngoài, ràng buộc, FR/NFR chi phối, chiến lược giải pháp, topology đang chọn và cách đọc bản đồ SDS.

Sơ đồ tổng thể phải nối được app/kênh vào, backend, công việc nền, dữ liệu, hệ thống ngoài và đường trả kết quả. Các node và đường nối trên sơ đồ tham chiếu các định nghĩa trong SDS.

## Flows: đường đi xuyên suốt qua code

Mỗi `flows/<flow>/index.yaml` cần có:

| Thành phần | Nội dung |
| --- | --- |
| ID, tên, mục tiêu | Luồng thiết kế giải quyết kết quả nào. |
| Business refs | FR, BR, NFR, SRS flow/branch, customer journey và acceptance criteria liên quan. |
| Entry point | Màn hình/thao tác người dùng, API, webhook, event, lịch chạy hoặc công việc nền bắt đầu luồng; chỉ rõ code tiếp nhận. |
| Preconditions, inputs | Trạng thái, quyền và dữ liệu phải có trước khi chạy. |
| Participants | Code-unit, module/service, data model và hệ thống ngoài tham gia. |
| Main sequence | Các bước xử lý theo thứ tự, với đường gọi cụ thể qua code. |
| Alternative sequences | Điều kiện rẽ, bước rẽ, các bước/code được chạy, điểm quay lại hoặc kết thúc. |
| Exception sequences | Lỗi tại từng ranh giới, nhánh code xử lý, trạng thái còn lại và phản hồi quan sát được. |
| Recovery | Ai xử lý tiếp, đọc trạng thái nào, retry bằng định danh nào, điều kiện nào cho phép tiếp tục. |
| Postconditions | Dữ liệu và tác động bên ngoài sau thành công, thất bại, hủy hoặc kết quả chưa xác định. |
| App/result mapping | API response, event/subscription và component hiển thị trạng thái; đường cập nhật khi chậm hoặc mất kết nối. |
| Topology refs | Cách thực hiện trong topology được chọn; các khác biệt kỹ thuật nếu hỗ trợ nhiều topology. |
| Verification refs | Các test/scenario chứng minh bước, nhánh, NFR và kết quả của luồng. |

Mỗi bước xử lý phải đủ chi tiết để trả lời:

1. Code-unit và file/class/function/method nào thực hiện?
2. Caller là ai; input/output và điều kiện kiểm tra là gì?
3. Bước này gọi tiếp code nào hoặc contract nào? Đồng bộ, bất đồng bộ hay qua process/service khác?
4. Đọc/ghi dữ liệu nào, qua repository nào; transaction bắt đầu, commit hoặc rollback ở đâu?
5. Quyền được kiểm tra tại đâu, dựa trên principal và phạm vi tài nguyên nào?
6. Nếu có cạnh tranh hoặc trạng thái đổi, code dùng phiên bản, khóa hay cơ chế nào để quyết định?
7. Khi timeout, lỗi hoặc mất phản hồi, điều gì đã xảy ra và điều gì chưa biết?
8. Có được retry không; cơ chế nào chống tác động lặp hoặc kết quả cũ ghi đè kết quả mới?
9. Kết quả được chuyển tới bước sau, app hoặc bên nhận bằng cách nào?
10. Kiểm chứng nào quan sát được hành vi này?

Mức chi tiết tập trung vào các lời gọi và cơ chế quyết định hành vi. Một dòng tên service không đủ nếu còn phải đoán cách kiểm tra quyền, ghi trạng thái hoặc xử lý lỗi.

## Code map

`code-map/<frontend|backend|shared>/<code-unit>/index.yaml` định nghĩa một đơn vị code có trách nhiệm rõ:

- ID, tên, trách nhiệm, giới hạn trách nhiệm và owner.
- Repo, đường dẫn file, class/function/method và signature/input/output.
- Trạng thái tồn tại: đã có hoặc dự kiến tạo; thay đổi dự kiến ghi riêng với quan sát source hiện tại.
- Các symbol quan trọng, caller/callee, dependencies và interfaces cung cấp/sử dụng.
- Code kiểm tra validation, authorization, state/version, transaction và error mapping.
- Contracts, data, flows, quality mechanisms và tests liên quan.

Frontend phải chỉ được component/page, event handler, API client, state/subscription và cách hiển thị kết quả. Backend phải chỉ được entry point, guard, handler/service, repository, worker, adapter và đường gọi giữa chúng khi áp dụng.

## Contracts và data

### Contracts

`contracts/<api-or-event>/index.yaml` chứa:

- ID, owner, caller/producer và receiver/consumer với code/symbol refs.
- Route, operation hoặc topic; giao tiếp in-process, sync hoặc async theo topology.
- Request/response/event schema, validation, errors và cách ánh xạ lỗi về caller/app.
- Authentication/authorization, phạm vi tài nguyên và nơi kiểm tra bằng code.
- Correlation, idempotency, thứ tự, timeout, retry, hủy và tra cứu kết quả chưa rõ.
- Versioning, compatibility và cách xử lý producer/consumer lệch phiên bản.

### Data

`data/<data-model>/index.yaml` chứa:

- Liên kết dữ liệu nghiệp vụ của SRS với entity/table/collection và model code.
- Fields, types, quan hệ, constraints, indexes và migration dự kiến.
- Nguồn dữ liệu chính hoặc dữ liệu có thể dựng lại; code sở hữu quyền ghi và các bên được đọc.
- Repository/query/write paths; transaction, consistency và concurrency control.
- Tenant/installation isolation, classification, lifecycle, retention/deletion theo chính sách SRS.
- Cách backup/restore/rebuild khi liên quan, điều kiện xác minh và cho phép hoạt động tiếp.

## Quality: cơ chế NFR phải có vị trí thực thi

Mỗi `quality/<category>/<concern>/index.yaml` liên kết NFR với cơ chế cụ thể, file/hàm thực thi, các flow chịu ảnh hưởng, điều kiện kiểm tra, kết quả mong đợi và giới hạn còn lại.

- Security: kiểm tra quyền theo actor/action/resource; cô lập dữ liệu; xác minh webhook; quyền truy xuất tri thức; quyền tool; xử lý output/attachment; credentials; log và subscription.
- Performance: đường xử lý quan trọng, thời gian từng chặng, queue wait, giới hạn context/token, cache và điều kiện vô hiệu hóa, tải/concurrency, timeout và ngân sách tài nguyên.
- Reliability: công việc bền vững, idempotency, ordering, state/version checks, xử lý concurrency, retry, reconciliation, phục hồi và việc tiếp tục an toàn.

NFR chưa có mục tiêu định lượng phải giữ trạng thái cần quyết định. Ghi rõ điều kiện đo, không tự đưa SLA hoặc ngân sách vào thiết kế như yêu cầu đã chốt.

Đo thời gian tiếp nhận, thời gian có câu trả lời và thời gian giao tin riêng. Đo phân vị toàn luồng và từng chặng; không cộng các p95 thành phần để suy ra p95 toàn luồng. Tối ưu phải nêu lợi ích, chi phí, ảnh hưởng chất lượng và phép kiểm chứng.

## Deployment: monolith và microservices

`deployment/<topology>/index.yaml` ánh xạ code-unit vào ứng dụng/process/service, worker, data store và các kết nối thực tế dự kiến.

| Điểm cần làm rõ | Monolith chia module | Microservices |
| --- | --- | --- |
| Đường gọi | Interface/function giữa các module, code caller/callee | API/event, producer/consumer, service identity và code hai đầu |
| Dữ liệu | Module sở hữu quyền ghi, transaction trong phạm vi phù hợp | Service sở hữu dữ liệu, transaction cục bộ và phối hợp qua contract |
| Công việc nền | Worker của ứng dụng, cơ chế lưu/nhận việc | Producer, broker/transport, consumer và receipt/outbox/inbox khi chọn dùng |
| Lỗi | Process, DB, công việc nền và hệ thống ngoài | Thêm mất mạng, partial failure, response loss và phiên bản service không đồng bộ |
| Quan sát | Request/job/flow correlation xuyên module | Trace/correlation xuyên process và service |
| Triển khai | Cấu hình, worker, scaling, rollout/rollback | Bổ sung thứ tự rollout, compatibility và service unavailable |

Không mặc định cả hai topology đều được hỗ trợ. Phương án đã chọn phải rõ; phương án khác có thể nằm trong decisions. Nếu hỗ trợ nhiều topology, giữ cùng kết quả SRS và ghi rõ các khác biệt về đường gọi, transaction, timeout, retry và recovery trong flow.

## Decisions và verification

### Decisions

`decisions/<decision>/index.yaml` chứa vấn đề, drivers/ràng buộc, phương án đã cân nhắc, lựa chọn, lý do, đánh đổi, trạng thái, người quyết định, điều kiện xem xét lại và refs đến code/flow/data/contract bị ảnh hưởng.

So sánh phương án theo đúng bài toán và dữ liệu đo khi có. Pattern phải đi kèm cơ chế và nơi thực thi. Phương án khác về thiết kế nằm ở decisions; nhánh thay thế khi chạy nằm trong flow.

### Verification

`verification/<scenario>/index.yaml` xác định cách chứng minh bản đồ code:

- FR/SRS acceptance, SDS flow/branch, code-unit và NFR cần kiểm chứng.
- Repo, test file/test case hoặc kịch bản chạy; phân biệt đã có và dự kiến tạo.
- Fixtures, actor/quyền, điều kiện trước và các dependency cần thiết.
- Hành động, fault injection hoặc lịch chạy đồng thời khi phù hợp.
- Expected result trên data, external effect, response và app; các thay đổi không được phép xảy ra.
- Phép đo chất lượng/latency và ngưỡng đã chốt, nếu áp dụng.

Kế hoạch kiểm chứng trong SDS không tự chứng minh test đã chạy. Kết quả thực thi phải liên kết tới source revision/build và bằng chứng thực tế phù hợp. Code được xây theo SDS; kiểm chứng đối chiếu lại đường đi và kết quả.

## Ví dụ chatbot

Các tên bên dưới minh họa cách tách mục. Khi triển khai SDS thật, mỗi code-unit phải được gắn repo/path/symbol đã xác minh hoặc được đánh dấu dự kiến tạo.

```text
flows/customer-message-to-reply/index.yaml
flows/operator-open-conversation/index.yaml
flows/operator-send-message/index.yaml
flows/human-takeover/index.yaml
flows/return-to-bot/index.yaml
flows/delivery-reconciliation/index.yaml
flows/app-reconnect/index.yaml

code-map/frontend/conversation-page/index.yaml
code-map/frontend/message-composer/index.yaml
code-map/frontend/conversation-subscription/index.yaml
code-map/backend/channel-webhook-handler/index.yaml
code-map/backend/conversation-service/index.yaml
code-map/backend/conversation-repository/index.yaml
code-map/backend/reply-worker/index.yaml
code-map/backend/knowledge-reader/index.yaml
code-map/backend/llm-adapter/index.yaml
code-map/backend/delivery-service/index.yaml
code-map/backend/channel-sender/index.yaml

contracts/receive-channel-message/index.yaml
contracts/request-human-takeover/index.yaml
contracts/conversation-updated/index.yaml
data/conversation/index.yaml
data/message/index.yaml
data/delivery-attempt/index.yaml

quality/security/tenant-isolation/index.yaml
quality/performance/reply-latency/index.yaml
quality/reliability/duplicate-delivery/index.yaml
verification/customer-receives-reply/index.yaml
verification/takeover-during-generation/index.yaml
verification/provider-timeout-after-send/index.yaml
```

Danh sách ví dụ lược các index tổng hợp. Phạm vi chatbot đầy đủ còn cần thiết lập/kích hoạt, thu hồi quyền/khôi phục, liên kết kênh và chuyển yêu cầu Sales/Accounting khi nằm trong SRS được chọn.

### Đường đi của human takeover

```text
SRS: yêu cầu tiếp quản hội thoại
→ Frontend: component → event handler → API client
→ Backend: route/resolver → guard → handler → service
→ Persistence: repository → transaction cập nhật controlVersion
→ Worker: hàm nhận kết quả LLM kiểm tra controlVersion
  ├── Phiên bản/quyền còn hợp lệ → xét tiếp công việc được phép
  └── Phiên bản đã cũ → loại đề xuất và kết thúc công việc
→ Realtime: publisher → subscription → frontend hiển thị trạng thái
→ Verification: takeover-during-generation
```

Tên `controlVersion` là minh họa cơ chế phiên bản, chưa khẳng định field hiện có. Trong SDS thật phải ghi đúng field, hàm cập nhật, hàm kiểm tra và nhánh lỗi.

Flow phải giải thích cạnh tranh giữa tiếp quản và bắt đầu gửi. Hai thao tác cần được phân thứ tự tại cơ chế quyết định có thẩm quyền. Lượt đã có khả năng bắt đầu gửi giữ trạng thái đang diễn ra/chưa xác định để đối soát; không hứa hủy được tác động đã xảy ra ở provider.

### Các phép thử thiết kế chatbot

| Tình huống | Nội dung phải tìm được trong SDS |
| --- | --- |
| Webhook trùng hoặc cùng ID khác nội dung | Code xác minh, phạm vi khóa duy nhất, cách trả kết quả cũ hoặc báo xung đột. |
| Tin nhắn mới đến khi LLM đang chạy | Cơ chế version/ordering và chính sách xử lý lượt; nơi loại hoặc tính lại đề xuất cũ. |
| Worker trùng hoặc worker cũ tiếp tục chạy | Quyền sở hữu công việc, phiên bản và điều kiện nhận kết quả/cho phép tác động. |
| Nhân viên tiếp quản khi bot đang sinh/gửi | Mốc chuyển quyền, mốc bắt đầu gửi, cơ chế phân thứ tự và trạng thái công việc đang dở. |
| Provider gửi rồi mất phản hồi | Receipt/attempt identity, trạng thái chưa xác định, lookup/reconciliation và điều kiện retry. |
| Callback trùng/sai thứ tự/giả | Code kiểm tra nguồn, liên kết attempt và quy tắc chuyển trạng thái. |
| App timeout sau commit hoặc reconnect | Định danh thao tác cũ, query kết quả, snapshot/cursor/version và xử lý thiếu khoảng sự kiện. |
| Quyền/consent bị thu hồi | Code chặn thao tác và phân phối dữ liệu mới; kiểm tra hiệu lực cache, subscription và proposal. |
| Retrieval/LLM lỗi hoặc hết ngân sách | Deadline, budget, trạng thái lỗi, fallback/handoff theo chính sách và cách hiển thị. |
| Khôi phục backup cũ | Khoảng trống quan sát, công việc cần giữ lại, đối soát tác động ngoài và điều kiện cho phép chạy tiếp. |

Đây là các tình huống kiểm tra thiết kế, không mặc định đã được triển khai hoặc kiểm thử trong Nivo.

## Ma trận truy vết và mức hoàn thiện

```text
Journey / FR / nhánh SRS
→ Màn hình hoặc sự kiện đầu vào
→ API / event contract
→ File / symbol / code-unit tại từng bước
→ Chủ sở hữu dữ liệu và điểm commit
→ Nhánh lỗi / phục hồi
→ Response / event / trạng thái hiển thị
→ Test / scenario / phép đo chứng minh kết quả
```

Đánh giá độ đầy đủ bằng coverage của phạm vi SRS và các ranh giới thực thi. Rà input/quyền, cạnh tranh, trùng/lệch thứ tự, timeout, partial failure, hủy, tài nguyên cạn và phục hồi ở nơi liên quan. Ghi lý do không áp dụng khi cần; tình huống mới phát hiện đi vào vòng sửa SRS/SDS và kiểm chứng tương ứng.

## Phạm vi nâng cấp skills

Khi thực hiện nâng cấp, cập nhật đồng bộ:

- Hướng dẫn và operator Architecture đang yêu cầu source-independent hoặc cấm repo/file/symbol/code mapping trong SDS, gồm `docs/architecture-sds.md` và `ops/architecture.decide/`.
- Schema/contract SDS, gồm `specifications/sds.schema.yaml`, cùng validator hỗ trợ cây và các loại nội dung mới. Định nghĩa version/migration rõ ràng thay vì gắn payload mới vào schema cũ không tương thích.
- Work layout, refs và coverage để nối cấu trúc FR/NFR/journeys mới trong `srs.md` với flows/code-map/contracts/data/quality/verification.
- Ranh giới với Implementation: SDS sở hữu bản đồ thiết kế và kế hoạch kiểm chứng; Implementation hiện thực code và cung cấp kết quả chạy, không tạo bản đồ đích thứ hai mâu thuẫn.
- Examples, fixtures và tests kiểm tra ID/path/symbol refs, planned/existing status, caller/callee, branch coverage và topology consistency.

Di chuyển nội dung hữu ích và bảo toàn ID, nguồn gốc quyết định, bằng chứng lịch sử. Nội dung thay đổi phải được rà soát lại; không tự mang trạng thái hoàn thành cũ sang bản đồ mới.

## Tiêu chí hoàn thành

- Tìm được từng flow dưới folder riêng, với main/alternative/exception/recovery trong một `index.yaml`.
- Từ một thao tác app hoặc sự kiện đầu vào, lần được đến code, dữ liệu, tác động ngoài và kết quả trả về.
- Mỗi bước có file/symbol cụ thể hoặc thiết kế file/symbol dự kiến tạo, cùng input/output và trách nhiệm rõ.
- Các điểm kiểm tra quyền, commit, concurrency, timeout, retry và đối soát có cơ chế và nơi thực thi cụ thể.
- Contracts/data/code-map có owner duy nhất và refs nhất quán; không còn đường gọi hoặc nhánh quan trọng phải đoán.
- Topology đích ánh xạ được code vào process/service; khác biệt mono/micro được ghi khi áp dụng.
- NFR gắn với code và phép kiểm chứng; phương án tối ưu có đánh đổi và điều kiện đánh giá.
- Verification nối được từng kết quả quan trọng với test/scenario; kế hoạch và kết quả thực thi được phân biệt rõ.
- Hướng dẫn, schema, validator và ví dụ của skills thống nhất với định nghĩa SDS là bản đồ code.
