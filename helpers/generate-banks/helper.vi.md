# generate-banks

## Việc

Đọc những gì một sản phẩm đã để lại — route của nó, phần coverage không ai lấy, finding không ai trả lời, các lượt đi thử và lượt chạy API đã hỏng, model tính năng và ghi chú của chính người dùng — rồi phác một kho nhiệm vụ mà harness nhận được lần lượt, mỗi nhiệm vụ mang sẵn khối goal một phiên cần và ít nhất một quan sát nó sinh ra từ đó.

## Xong khi

Xong khi `bank-queue` xếp thứ tự một mục cho mỗi nhiệm vụ lần đọc tìm ra, mọi mục đều có một `banked-mission` mang khối goal, route, môi trường và ít nhất một evidence ref của nó, và `helper-run` gọi tên mọi đầu vào đã đọc kèm head đã đọc tại đó.

## Helper không phải operator

Một operator làm một việc trên một đơn vị bên trong chuỗi của phiên, dưới một goal người đã xác nhận. Cái này chạy trước tất cả những thứ đó: nó không mở phiên, không ghi source sản phẩm, không chạm runtime, không publish và không hỏi gì. Toàn bộ thẩm quyền của nó là đọc, và toàn bộ đầu ra là một đề nghị — một kho mà người duyệt một lần, sau đó harness mở hết nhiệm vụ này tới nhiệm vụ khác mà không ai phải soạn prompt. Không có gì ở đây quyết định rằng một nhiệm vụ là đúng; sự phê duyệt của người mới quyết định, và kế hoạch của từng nhiệm vụ được vẽ khi nhiệm vụ mở ra, trên các head đọc lúc đó chứ không phải head đọc ở đây.

## Một nhiệm vụ không bằng chứng chỉ là một ý nghĩ

Mọi nhiệm vụ được phác ở đây đều gọi tên ít nhất một quan sát mà nó sinh ra từ đó: một mục của sổ chưa kiểm, một finding, một lượt đi thử hay một lượt chạy API, một đường dẫn source trong route đang bind, hoặc một tham chiếu tới thứ người dùng đã viết. Bản phác nào không gọi tên được một cái sẽ bị từ chối bằng `BANK_UNGROUNDED` chứ không được nhập kho kèm một lý do nghe có vẻ hợp lý, vì một kho toàn nhiệm vụ nghe hợp lý còn tệ hơn kho rỗng: người duyệt nó một lần và harness chạy hết.

## Lần đọc mang gì đi tiếp, và không mang gì

Sổ chưa kiểm nói một nhiệm vụ trước đã cố ý không chứng minh cái gì, với lý do nào. Một nhiệm vụ phác từ một mục đang mở mang theo tier của mục đó như một gợi ý, để người đọc phân biệt được nhiệm vụ khép một khoảng trống của hành trình với nhiệm vụ khép một lần hoãn. Nó vẫn chỉ là gợi ý: tier thật thuộc về kế hoạch của nhiệm vụ, thứ đọc nó trên một hành trình "xong khi" chưa tồn tại tại thời điểm nhập kho.

## Ranh giới

Mọi thứ bảng Đọc gọi tên đều chỉ đọc. Chỉ hai nơi bảng Ghi gọi tên là được ghi, đúng hai nơi mà `alias/alias.json` đánh dấu cho tầng hỗ trợ ghi. Không checkout nào, không runtime owner nào, không registry, không thư mục phiên và không sổ nào của các operator bị chạm tới, và ở đây không có trường nào có thể chứa một credential.

## Luồng run cụ thể

Invocation tái dùng host session binding StarCi đã lập và ghi nó trong `helper-run`; helper không mở
operator session. Trước khi đọc evidence, run ghi product, routes, các lớp evidence và limit làm
expected coverage. Mọi kết quả kết thúc đều có run record, kể cả `BANK_EMPTY`, optional source sai
và lần chạy lại không có thay đổi.

| Trạng thái bank/evidence đã quan sát | Hành động | Kiểm actual |
| --- | --- | --- |
| Mission hiện có vẫn cùng evidence, goal và dependency | tái dùng stable mission id và content | queue phát ra trỏ cùng bytes mission và giữ status |
| Evidence mới thuộc mission hiện có | cập nhật draft bằng cách nối evidence refs và tính lại dependency | một mission nêu mọi observation đóng góp; không có mission trùng cùng owner outcome |
| Thread có căn cứ chưa có mission | tạo một draft với route và evidence refs đã xác định | check schema, route, dependency và grounding pass |
| Optional source thiếu, stale, không đọc được hoặc sai | ghi trạng thái source và tiếp tục bằng source hợp lệ | outcome là incomplete và không tuyên bố lớp evidence đó đã được kiểm |
| Queue có approval hoặc status `running`/`done` | giữ bytes approval và mọi status không phải draft; không đổi thành banked | summary trước/sau chứng minh authority và progress được giữ |
| Không còn thread có căn cứ | không đổi queue hay mission nhưng vẫn ghi run record với outcome empty | record liệt kê điều đã đọc và lý do không phát mission |

Retry dùng run id mới và không overwrite run cũ. Draft sai chỉ được thay sau khi ghi evidence đã đổi;
đổi composition queue làm approval mất hiệu lực qua `scripts/bank.mjs`, còn no-change reuse giữ nó.

## Đọc

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/projects` | khai báo route của sản phẩm: nó có những role nào và mỗi role là gì, để nhiệm vụ được phác gọi tên những route có thật | có |
| `@workspaces/ports` | phép chiếu port của sản phẩm, để một nhiệm vụ cần runtime phục vụ gọi tên đúng slot nó sẽ chạy | không |
| `@workspaces/<project>/<role>` | các checkout đã route của sản phẩm, chỉ đọc và tại head quan sát được: thứ mà một evidence ref dạng `source:` trỏ tới, và thứ phân biệt một lời hứa đã bàn giao với một lời hứa còn nợ | không |
| `@worktrees/unchecked/<product>` | phần coverage các nhiệm vụ trước cố ý không lấy, kèm lane, unit và lý do: nguồn đầu tiên của một nhiệm vụ chưa ai chạy | không |
| `@knowledge/findings` | các finding mà audit và lượt đi thử đã ghi và chưa ai trả lời, theo từng họ | không |
| `@worktrees/uat/<flow>` | những lượt đi thử sản phẩm này đã chạy và chúng hỏng ở đâu | không |
| `@worktrees/e2e/<flow>` | những lượt chạy API sản phẩm này đã chạy và chúng hỏng ở case nào | không |
| `@worktrees/businesses` | model tính năng và những lời hứa chúng công bố, để nhiệm vụ được phác nói về một lời hứa chứ không phải về một tệp | không |
| `@worktrees/banked/<product>` | queue, mission, approval bytes và status hiện có dùng cho reuse, update và duplicate check | không |

## Ghi

| Alias | Cái gì |
| --- | --- |
| `@worktrees/banked/<product>` | hàng đợi của kho sản phẩm và một thư mục cho mỗi nhiệm vụ được phác, mỗi thư mục có bản người đọc bên cạnh bản harness đọc |
| `@worktrees/helpers/<id>` | bản ghi lần chạy này: đã đọc gì tại head nào, đã ghi gì, và giữa hai mốc thời gian nào |

## Yêu cầu

| Trường | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `product` | id | — | Sản phẩm mà sổ, bằng chứng và route của nó được đọc và kho của nó được phác |
| `env` | id | dev | Môi trường mà các nhiệm vụ được phác gọi tên khai báo của nó |
| `language` | tag | settings | Ngôn ngữ viết khối goal và tài liệu nhiệm vụ; là ngôn ngữ hiển thị trừ khi lần gọi nêu ngôn ngữ khác |
| `limit` | count | 12 | Số nhiệm vụ tối đa một kho mang; lần đọc tìm ra nhiều hơn thì nhập những cái có căn cứ nhất và nói rõ đã bỏ lại gì |
| `notes` | ref | null | Tham chiếu tới thứ người dùng đã viết mà kho này phải trả lời; nó thành một evidence ref dạng `note:` |
| `runId` | token | — | Mã lần chạy của lần gọi này, thứ mà bản ghi lần chạy và mọi nhiệm vụ nó phác đều gọi tên |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Validate invocation và bind helper run vào host session Codex hoặc Claude hiện có; không tạo StarCi user session | `product`, `runId` | invocation và host binding | — | `INVALID_INPUT` |
| 2 | Đọc route, port, checkout head rồi inspect queue, mission, approval bytes và status hiện có trước khi chọn reuse, update hay create | `product` | @workspaces/projects, @workspaces/ports, @workspaces/<project>/<role>, @worktrees/banked/<product>, @tools/git | — | `PRODUCT_UNROUTED` |
| 3 | Đọc và phân loại từng unchecked-ledger source là valid, missing, invalid hay stale, giữ evidence của phân loại | `product` | @worktrees/unchecked/<product> | — | — |
| 4 | Đọc và phân loại open finding của mọi family mà product dùng | — | @knowledge/findings | — | — |
| 5 | Đọc và phân loại UAT walk cùng API run cuối của từng e2e flow, kể cả attempt incomplete và failed | — | @worktrees/uat/<flow>, @worktrees/e2e/<flow> | — | — |
| 6 | Đọc và phân loại feature model cùng person note được tham chiếu; optional source vắng làm run incomplete thay vì âm thầm empty | `notes` | @worktrees/businesses | — | — |
| 7 | Resolve duplicate open thread với bank hiện có; reuse mission không đổi, update đúng draft field đổi, hoặc create một mission cho thread mới | `product`, `env`, `language`, `limit` | source đã phân loại và bank-before snapshot | `banked-mission` | `BANK_EMPTY` |
| 8 | Từ chối draft không có evidence và ghi từng merge bằng kept mission, merged mission ids và supporting refs | — | draft và deduplication map | — | `BANK_UNGROUNDED` |
| 9 | Xếp queue nhưng giữ nguyên approval bytes và mọi status running hoặc done; không mở lại terminal mission khi refresh | — | bank-before và draft đã nhận | `bank-queue` | — |
| 10 | Record mọi run, kể cả empty và incomplete, gồm source coverage, before/after hash và entries, deduplication, output, profile, host binding và thời điểm | `runId` | mọi thứ ở trên | `helper-run` | — |

Bước 7 chỉ đọc goal của người dùng qua product evidence được tham chiếu. Run không tìm thấy open
thread thì không ghi queue hay mission nhưng vẫn ghi helper-run `outcome: empty`. Run có source
missing, invalid hay stale ghi `outcome: incomplete` và không overwrite bank hợp lệ.

## Đầu ra

| Kind | Tệp | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `bank-queue` | `@worktrees/banked/<product>/queue.json` | data | có |
| `banked-mission` | `@worktrees/banked/<product>/<missionId>/mission.json` | data | có |
| `helper-run` | `@worktrees/helpers/<id>/runs/<runId>/run.json` | data | có |

## Kết quả tốt nhất

Sau mọi helper run kết thúc, in **Kết quả tốt nhất** là thay đổi queue có thể review: link `bank-queue` đã bảo toàn cùng các record `banked-mission` bị tác động cho `drafted`, `updated` hoặc `reused`; với `empty` hay `incomplete`, link record `helper-run` và hiện lý do source coverage. Cách trình bày này không tạo giả operator receipt, không coi đề nghị là đã duyệt, và luôn giữ hiện approval bytes cùng status running hoặc done sẵn có.

## Dừng

| Mã | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `PRODUCT_UNROUTED` | terminate |
| `BANK_EMPTY` | terminate |
| `BANK_UNGROUNDED` | terminate |
