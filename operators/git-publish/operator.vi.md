# git.publish

## Việc

Publish một ranh giới Git đã được duyệt từ đúng commit mà quality đã kiểm định, theo ngữ nghĩa
non-force và chỉ fast-forward, và dừng bằng một lỗi có kiểu thay vì với tay sang một đường tắt.

## Xong khi

Xong khi `git-publication` ghi nhận rằng đúng commit mà biên nhận quality đã đo đã tới ref được
route trên remote bằng một lần push non-force tạo mới hoặc fast-forward ref ấy với mọi hook đã qua,
nhánh phiên đã được merge và không bao giờ rebase, nhiều nhất một tag có chú thích trỏ vào head mà
chính lần publish này đã push, và worktree, nhánh cùng thư mục phiên đã được gỡ.

## Nó không quyết gì về bản thân thay đổi

Việc thay đổi có đúng hay không đã được quyết bởi các cổng sinh ra biên bản `quality-verification`,
còn việc nó có được publish hay không đã được quyết bởi phê duyệt. Operator này chỉ thực hiện thao
tác ghi, hoặc báo chính xác vì sao nó đã không ghi. Biên bản nó để lại chứng minh rằng đúng commit
này đã tới đúng ref này dưới đúng những hook này; nó không mang phán quyết, không mang điểm, và
không mang khẳng định nào rằng có thứ gì đã pass.

## Route được đọc, không bao giờ được tự tìm lại

Operator này không tự phân giải một project ra thành một checkout. `workspace.bind` làm việc đó, và
biên bản của nó tới đây đã ràng sẵn. Một lần publish tự phân giải đường dẫn của mình có thể publish
từ một checkout không ai kiểm, đúng cái hỏng mà sự tách bạch này sinh ra để chặn. Một biên bản route
có trạng thái khác `bound`, hoặc gọi tên một project khác, là `ROUTE_UNVERIFIED`.

## Phê duyệt luôn là một con người

Publish đẩy công việc ra khỏi phiên và vào một nơi người khác pull về, nên `approval` không có mặc
định: một hành động hướng ra ngoài luôn là thứ có người nói đồng ý. Bằng chứng hoàn thành ghi lại
những cổng mà ranh giới đã qua; nó là bằng chứng công việc đã xong chứ không bao giờ là bằng chứng nó
được phép publish. Đúng một phê duyệt phải gọi tên ranh giới này. Một phê duyệt cấp cho ranh giới khác
là một phê duyệt thật của người khác, và đó chính là cách thay đổi chưa duyệt đi ké theo thay đổi đã
duyệt; đó là `APPROVAL_MISSING`.

## Commit được publish là commit đã kiểm định

Đầu vào `quality-verification` đã đo đúng một commit. Chính commit đó, và không commit nào khác, là
thứ lần publish này đẩy đi: một head nhỉnh hơn commit đã kiểm định một nhịp mang theo một thay đổi
không cổng nào từng thấy. Biên bản ghi commit đã kiểm định cạnh head đã publish để sau này so được
hai thứ mà không phải chạy lại gì.

## Không force là chuyện cấu trúc, không phải lời khuyên

Force push, viết lại lịch sử, `reset --hard`, `clean`, `stash`, xóa nhánh và bỏ qua hook không phải
là những field có mặc định; chúng vắng mặt khỏi từ vựng của operator này, nên không request nào, ở
bất kỳ tổ hợp và biện minh nào, xin được một cái. Lý do là mỗi thứ trong số đó cám dỗ nhất đúng vào
lúc một lần publish vừa hỏng: một push bị từ chối, một hook đỏ và một file bẩn bất ngờ đều có một câu
trả lời một lệnh rất hiển nhiên, và nó phá công việc hoặc bằng chứng của người khác. `reset --hard`
phá công việc chưa commit mà không biên bản nào ghi, `clean` phá file chưa track chưa ai xem, còn
`stash` giấu một ranh giới bẩn thay vì giải quyết nó. Làm cho lời xin không diễn đạt được là gỡ quyết
định ra khỏi đúng khoảnh khắc nó sẽ bị quyết sai. Chế độ publish luôn là chỉ fast-forward, và mọi lần
publish đều ghi rằng nó đã không bị force.

## Nhánh phiên được merge, không bao giờ bị rebase

Người sản xuất đã không viết trên nhánh mà người ta đang checkout. Nó viết trên nhánh phiên
`session/<sessionId>` của checkout đã route, trong một git worktree dựng từ head đã đóng băng, và
commit tập ghi của mình đúng một lần. Operator này merge nhánh phiên ấy vào nhánh đích trước khi
push. Khi nhánh đích chưa dịch chuyển kể từ base của phiên, merge là fast-forward và không có gì mới
sinh ra. Khi nhánh đích đã dịch chuyển, một merge commit chỉ được phép dưới hai điều kiện đồng thời:
mọi hunk mà merge xung đột đều được giải bằng bộ luật dưới đây, và những cổng mà bản kiểm định đã nêu
được chạy lại trên kết quả merge và đều pass. Operator không bao giờ rebase, không bao giờ force, và
không bao giờ chạy với hook bị tắt.

## Xung đột giải được bằng luật, hoặc nó dừng

Một nhánh phiên được cắt từ một head và đẩy lên một head đã dịch chuyển, nên xung đột mà operator này
gặp thường không phải bất đồng về hành vi: một baseline lint hay format đã định dạng lại đúng những
dòng mà một bản sửa ba dòng chạm vào, và cả hai bên đều đúng. Giao chuyện đó cho một con người tốn cả
một nhiệm vụ và chẳng dạy được gì. Vì thế đúng bộ bốn luật đóng mà chủ runtime dùng để giải một lần
merge tích hợp — nêu một lần dưới mục *Xung đột do người tích hợp giải, không đẩy lên cho người* của
`runtime.serve`, và dùng chung như một module chứ không chép lại (`scripts/merge-resolution.mjs`) —
cũng giải lần merge này, dưới đúng hai điều kiện ấy: mọi hunk đã giải đều được ghi trên biên bản, gọi
tên file, dải dòng của hunk trong kết quả merge và luật nào đã áp, và những cổng mà
`quality-verification` đã nêu được chạy lại trên head đã merge trước khi push.

Một lần merge chỉ được giải theo cách này khi **mọi** hunk xung đột đều rơi vào một luật. Một hunk
không rơi vào luật nào là `NON_FAST_FORWARD`, nó terminate, và một con người giải quyết — operator
không bao giờ giải phần còn lại rồi push phần dư, vì một lời giải nửa vời publish một lần merge không
ai quyết. Luật lấy phía của phiên đi vào chỉ được lấy bên trong một file mà tập ghi của chính phiên ấy
sở hữu, và đó là lý do đầu vào `changes` là thứ nói những file ấy là file nào. Và giải không phải là
tin: một cổng đỏ trên head đã merge dừng lần publish đúng như một cổng đỏ dừng lần serve.

## Nhánh phiên không có biên nhận thì không publish được

Một nhánh phiên chỉ là phần đuôi của một phiên, nên phiên sinh ra nó phải còn trên đĩa lúc operator
này merge: thư mục phiên tồn tại, và trong đó một nhánh `interface.generate`, `interface.fix`,
`backend.generate` hay `library.update` ở trạng thái `done` với head của nhánh nằm trong `commits`
của nó. Biên nhận
đó là thứ duy nhất nói được path nào đã khai, giá trị nào được cho phép, và cổng nào đã cho chúng
qua; một nhánh phiên không có biên nhận ấy mang những commit không ai viết request cho, và merge nó
là publish thứ chưa từng đi vào runtime. Khi chuỗi mà phiên chạy có bước `interface.audit`
hay `uat.verify`, response của nhánh đó cùng các artifact `screenshot` cũng phải tồn tại, vì một bề
mặt không ai nhìn và một hành trình không ai đi chính là những thay đổi mà cổng này sinh ra để chặn.
Thiếu bất kỳ cái nào cũng là `SESSION_MISSING`, nó
kết thúc, và cách xử lý là chạy các operator còn nợ biên nhận — không bao giờ là viết biên nhận bây
giờ, sau khi việc đã xong, từ những gì diff tình cờ chứa.

## Hook chặn là một kết quả

Hook luôn được thi hành, và `pre-push` là cổng cuối trước remote. Một hook hỏng sinh ra `HOOK_BLOCKED`
gọi tên hook đó, và phần delta gỡ được nó là một ranh giới đã sửa cùng một head mới. Nó không bao giờ
là lý do để chạy lại push với hook bị tắt, để dời thay đổi sang một nhánh có hook nhẹ hơn, hay để
commit chính cấu hình hook ra khỏi đường. Một lần publish mang theo kết quả hook hỏng, hoặc thiếu hẳn
kết quả `pre-push`, đều bị từ chối.

## Push bị từ chối là một kết quả

Khi remote mang những commit mà ref cục bộ không có, push không phải fast-forward. Operator trả về
`NON_FAST_FORWARD` gọi tên remote head nó quan sát được. Nó không rebase lên đó, không amend một
commit cho push áp được, không squash phần phân kỳ đi, không force, không lease-force. Hòa giải lịch
sử phân kỳ là đổi thứ người khác đã pull về, nên nó thuộc về người sở hữu nhánh, và người đó không
phải operator này.

## Luồng attempt cụ thể

Các row của operator này được gate bởi hợp đồng attempt expected/actual dùng chung trong `scripts/attempt-gate.mjs`.

| Trạng thái quan sát | Hành động | Kiểm actual | Nhánh kế tiếp |
| --- | --- | --- | --- |
| target ref ở observed base và session head fast-forward | non-force fast-forward | đọc remote head, hook, integrated tree | phát publication; host lifecycle đóng session |
| target ref thiếu và approval cho create | tạo exact ref một lần từ verified commit | fetch và đọc ref đã tạo | ghi creation |
| hook/receipt/boundary/ancestry sai | không publish | ghi mọi check fail và current remote | conflict theo closed rule có thể sửa/regate; lỗi khác handoff owner |
| remote đổi hoặc effect không chắc | không force/reset/clean/stash/rebase/bypass/retry mù | giữ rejected push và remote observation | attempt mới chỉ sau fingerprint đổi |

## Ranh giới là chính xác

Ranh giới là toàn bộ những gì lần publish này sở hữu, và Đầu vào `changes` nêu các path nằm trong đó.
Bất cứ thứ gì bẩn ở ngoài nó là công việc ranh giới này không sở hữu, và một lần publish mang nó theo
là publish thay đổi chưa duyệt của người khác; đó là `DIRTY_OUTSIDE_BOUNDARY`. Dưới chính sách cấm
nhánh worktree, head được publish nằm trên nhánh mutation đã route, và một head trên nhánh khác là
`BRANCH_POLICY_VIOLATION`. Một lần publish không đẩy được gì lên không phải là publish: head đã publish
đi trước upstream của nó và ref thực sự đã dịch chuyển.

## Tag là thứ được hỏi, hoặc không có

`tag` mặc định null, nên một lần publish chỉ mang tag tiếp nối khi có người nêu tên nó, và tag ấy là
annotated và trỏ vào một head mà chính lần publish này đã đẩy. Một tag trên head mà lần chạy này
không đẩy là một cái nhãn mà commit của người khác đang phải mang.

## Cleanup theo sau publish qua host lifecycle

Sau khi push thành công, operator này ghi rõ worktree, branch và folder của phiên vẫn được giữ.
Host session lifecycle quyết định lúc đóng chúng sau khi receipt và attempt đã được nhận; publication
không xóa bằng chứng phiên.


Server đã phục vụ phần việc của phiên không phải của operator này để dừng: chủ runtime giữ lease và
pid, và nhả chúng là việc của chính nó, đi tới qua bảng Kế tiếp khi lần publish đã xong.
## Ranh giới ghi

Context chỉ đọc, trừ merge và push. Operator chỉ ghi vào `response/` của nhánh mình, nhánh đích của
checkout đã route, và cú push tới `@remote/git/<project>/<role>`: head đã duyệt trên ref đã route, và
tối đa một tag tiếp nối annotated trỏ vào một head mà chính lần publish này đã đẩy. Nó không force
push, không lease-force push, không viết lại lịch sử đã publish; không chạy reset, clean hay stash;
không xóa branch, worktree hay session folder; không bỏ qua, bỏ sót hay tắt một Git hook; không
amend, rebase hay squash một commit để một push bị từ chối đi lọt; không publish một head ngoài ranh
giới đã duyệt; và không publish khi chưa có route đã kiểm và một phê duyệt ràng vào đúng ranh giới này.

## Context

| Alias | Bind | Bắt buộc |
| --- | --- | --- |
| `@workspaces/local/routes/<project>/<role>` | checkout, nhánh phiên và nhánh đích của nó, đọc tại head đã đóng băng | có |
| `@workspaces/<project>/<role>/husky` | `pre-commit` và `pre-push`, luôn chạy | có |
| `@remote/git/<project>/<role>` | đích publish và remote head quan sát được lúc gọi | có |

## Đầu vào

| Kind | Từ đâu | Bắt buộc |
| --- | --- | --- |
| `workspace-route-binding` | `workspace.bind`; một lần publish không bao giờ tự phân giải checkout của mình | có |
| `changes` | `interface.generate`, `interface.fix`, `backend.generate` hoặc `library.update`, đúng tập file mà lần publish này mang | có |
| `quality-verification` | `quality.verify`, biên bản có commit đã đo chính là commit lần publish này đẩy | có |
| `business-reconciliation` | `business.reconcile`, bản đối chiếu head lời hứa với source đã giao cho phép lần publish này; vắng khi nhiệm vụ không hứa gì để đối chiếu | không |

## Yêu cầu

| Field | Kiểu | Mặc định | Hỏi |
| --- | --- | --- | --- |
| `boundary` | id | — | Đúng một ranh giới được publish, đúng như phê duyệt gọi tên nó |
| `approval` | id | — | Bản ghi phê duyệt phủ lên ranh giới này; hoàn thành không phải phê duyệt |
| `tag` | `{name, message}` | null | Một tag tiếp nối annotated trên head mà lần publish này đẩy, hoặc không có |
| `resume` | token | null | Token của nhánh bị chặn khi vào lại sau một mã dừng |

## Các bước

| # | Bước | Tham số | Đọc | Ghi | Dừng với |
| --- | --- | --- | --- | --- | --- |
| 1 | Kiểm cổng vào và resume | `resume` | `request/request.json`, @workspaces/local/routes/<project>/<role> tại head đã đóng băng, @remote/git/<project>/<role> như quan sát được | — | `INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS` |
| 2 | Ràng route | — | Đầu vào `workspace-route-binding`: checkout đã kiểm, head và chính sách đã route của nó, cùng @workspaces/local/routes/<project>/<role> | — | `ROUTE_UNVERIFIED` |
| 3 | Ràng phê duyệt vào đúng ranh giới này | `boundary`, `approval` | phần requirements của `request/request.json`, Đầu vào `changes` là tập file, Đầu vào `quality-verification` là commit đã đo | — | `APPROVAL_MISSING` |
| 4 | Kiểm cây: bẩn ngoài ranh giới, chính sách nhánh | — | @workspaces/local/routes/<project>/<role>, các path bẩn, mọi nhánh, chính sách đã route | — | `DIRTY_OUTSIDE_BOUNDARY`, `BRANCH_POLICY_VIOLATION` |
| 5 | Chạy hook | — | @workspaces/<project>/<role>/husky: các hook đã cài, trong đó có `pre-push` | @tools/shell | `HOOK_BLOCKED` |
| 6 | Kiểm session receipt, target ref và ancestry; tái dùng receipt hợp lệ, chỉ resolve hunk được phép, và từ chối boundary evidence thiếu/sai trước merge | — | thư mục phiên: `state.json`, nhánh `interface.generate`, `interface.fix`, `backend.generate` hay `library.update` có `commits` mang head phiên, và các nhánh `interface.audit` cùng `uat.verify` với artifact `screenshot` của chúng khi chuỗi có các bước đó; đầu vào `changes` cho những file mà tập ghi của phiên sở hữu; @workspaces/local/routes/<project>/<role> cho head đích, base phiên và head phiên | @workspaces/local/routes/<project>/<role>, nhánh đích của checkout đó, @tools/git | `SESSION_MISSING`, `NON_FAST_FORWARD` |
| 7 | Chạy lại những cổng mà bản kiểm định đã nêu trên head đã merge khi lần merge có giải một hunk | — | đầu vào `quality-verification` cho những cổng nó đã chạy, @workspaces/local/routes/<project>/<role> tại head đã merge, @tools/shell | @tools/shell | `NON_FAST_FORWARD` |
| 8 | Tạo approved ref còn thiếu hoặc non-force fast-forward ref đã quan sát, rồi fetch và đọc lại exact remote head; không retry mù remote đã đổi | — | @workspaces/local/routes/<project>/<role> cho head đã duyệt, @remote/git/<project>/<role> tại remote head quan sát được, @tools/ci | @remote/git/<project>/<role>, @tools/git | `NON_FAST_FORWARD` |
| 9 | Push tag tiếp nối | `tag` | @workspaces/local/routes/<project>/<role> cho head mà lần publish này đã đẩy | @remote/git/<project>/<role>, @tools/git | — |
| 10 | Ghi publication receipt và emit; ghi worktree, branch và folder là được giữ cho host session lifecycle | — | mọi thứ ở trên | `response/response.md`, `response/response.json` | — |

Tạo một remote ref và fast-forward một remote ref là hai hành động khác nhau với hai người duyệt khác
nhau, nên head đã publish ghi lại nó đã làm cái nào. Một lần resume bắt đầu lại từ cổng vào, chỉ dùng
lại quan sát có fingerprint không đổi, và tiêu thụ đúng phần delta; một lần resume không thêm head,
phê duyệt, hook hay thay đổi remote nào là `NO_PROGRESS`, và một remote đã quan sát lại phải tới dưới
dạng một remote head mới vì cùng một quan sát không thể cho một kết quả khác.

## Đầu ra

| Kind | File | Kiểu | Bắt buộc |
| --- | --- | --- | --- |
| `git-publication` | `response/response.md` | md | có |

## Kết quả tốt nhất

Khi `done`, in **Kết quả tốt nhất** là branch đã publish và link commit được ghi trong `response/response.md`. Push bị từ chối, xung đột non-fast-forward hoặc dừng do authority phải hiện remote state không đổi và đúng owner tiếp theo thay vì link publication.

## Dừng

| Code | Xử lý |
| --- | --- |
| `INVALID_INPUT` | terminate |
| `SOURCE_DRIFT` | terminate |
| `NO_PROGRESS` | terminate |
| `ROUTE_UNVERIFIED` | terminate |
| `SESSION_MISSING` | terminate |
| `APPROVAL_MISSING` | terminate |
| `BRANCH_POLICY_VIOLATION` | terminate |
| `DIRTY_OUTSIDE_BOUNDARY` | terminate |
| `HOOK_BLOCKED` | terminate |
| `NON_FAST_FORWARD` | terminate |

## Kế tiếp

| Khi | Operator |
| --- | --- |
| ranh giới đã publish và head phải tới được một môi trường | `release.deploy` |
| phiên đã được dọn và chủ runtime phải nhả lease của phiên nó đã phục vụ và dừng thứ nó đã khởi động | `runtime.serve` |
