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
| 1 | Kiểm lần gọi và các tham số của nó | `product`, `runId` | lần gọi | — | `INVALID_INPUT` |
| 2 | Đọc khai báo route, phép chiếu port và head của từng checkout đã route của sản phẩm | `product` | @workspaces/projects, @workspaces/ports, @workspaces/<project>/<role>, @tools/git | — | `PRODUCT_UNROUTED` |
| 3 | Đọc các mục đang mở của sổ chưa kiểm của sản phẩm, mỗi mục kèm lane, unit và lý do | `product` | @worktrees/unchecked/<product> | — | — |
| 4 | Đọc các finding đang mở của mọi họ mà sản phẩm này soạn theo | — | @knowledge/findings | — | — |
| 5 | Đọc lượt đi thử gần nhất của mỗi flow và lượt chạy API gần nhất của mỗi flow e2e, và mỗi lượt hỏng ở đâu | — | @worktrees/uat/<flow>, @worktrees/e2e/<flow> | — | — |
| 6 | Đọc các model tính năng sản phẩm này công bố và ghi chú của người dùng mà lần gọi nêu tên | `notes` | @worktrees/businesses | — | — |
| 7 | Phác một nhiệm vụ cho mỗi mạch đang mở: khối goal, route, môi trường, evidence ref và gợi ý tier của nó | `product`, `env`, `language`, `limit` | mọi thứ đã đọc ở trên | `banked-mission` | `BANK_EMPTY` |
| 8 | Từ chối mọi bản phác không gọi tên được evidence ref nào, nêu rõ mạch nó sinh ra từ đó | — | các bản phác | — | `BANK_UNGROUNDED` |
| 9 | Xếp hàng đợi theo thứ mỗi nhiệm vụ chờ, rồi theo mức ưu tiên | — | các bản phác | `bank-queue` | — |
| 10 | Ghi lại lần chạy: mọi đầu vào kèm head đã đọc, mọi đầu ra đã ghi, profile và hai mốc thời gian | `runId` | mọi thứ ở trên | `helper-run` | — |

Bước 7 là bước duy nhất đọc mục tiêu của người dùng cho sản phẩm, và nó đọc từ những gì sản phẩm để lại chứ không từ một người: một mạch là một mục chưa kiểm đang mở, một finding chưa được trả lời, một case hỏng, hoặc một lời hứa mà model mang và chưa có bàn giao nào chạm tới. Lần đọc không tìm được mạch nào là `BANK_EMPTY`, và không ghi gì cả — một kho rỗng là một sự thật về sản phẩm, không phải một cái kho.

## Đầu ra

| Kind | Tệp | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `bank-queue` | `@worktrees/banked/<product>/queue.json` | data | có |
| `banked-mission` | `@worktrees/banked/<product>/<missionId>/mission.json` | data | có |
| `helper-run` | `@worktrees/helpers/<id>/runs/<runId>/run.json` | data | có |

## Dừng

| Mã | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `PRODUCT_UNROUTED` | terminate |
| `BANK_EMPTY` | terminate |
| `BANK_UNGROUNDED` | terminate |
