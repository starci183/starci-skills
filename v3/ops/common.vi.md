# Giao thức op chain có giới hạn scope

Bản tiếng Anh cùng tài liệu tiếng Anh của op được chọn là thẩm quyền runtime. Đọc đầy đủ cả hai. Bản `.vi.md` là bản đối chiếu cho người đọc. Chỉ đọc tài liệu chuyên môn đúng phạm vi; file op cũ phục vụ đối chiếu tương thích, không khôi phục chain, session, request/response hoặc vòng duyệt cũ.

## Chọn việc và thẩm quyền

Một task có một mục đích; mỗi prompt có thể yêu cầu một hoặc nhiều piece. Agent ánh xạ kết quả yêu cầu vào scope `.work` thật và tự assign op catalogue phù hợp cho từng piece; user không cần gọi hay duyệt riêng tên op. Mỗi lần gọi op làm tập đích và mục tiêu hữu hạn. Có thể dùng nhiều lần gọi để hoàn thành cùng prompt, nhưng xong một op không tự thêm successor ngoài yêu cầu. Catalogue là hợp đồng hướng dẫn, không phải engine thực thi hay quyền thao tác.

Chốt và nói gọn ánh xạ piece → op trong phạm vi prompt trước khi làm, không tạo request/response files. Chọn theo ý định, scope node, mục tiêu/giới hạn ghi của contract và dependency eligibility; không đoán hành động chỉ từ kind. Giữ lựa chọn rõ của user. Yêu cầu kiểm tra chỉ cho đọc, không tự implement; thiếu quyết định quan trọng hoặc effect mới thì hỏi. Làm tập được yêu cầu theo graph, dừng khi thiếu prerequisite ngoài scope thay vì thêm việc; để nguyên piece unfinished/suspended không liên quan.

Coordinator tự chọn và tiến chain trong scope, không hỏi từng tên op: tối đa ba lớp tuần tự, mỗi lớp tối đa ba invocation, tổng tối đa chín invocation mỗi prompt. Consumer chỉ chạy sau khi prerequisite được chọn đã kiểm chứng done. Op độc lập đủ điều kiện có thể chạy song song với tối đa ba worker thực thi tổng cộng; coordinator đang làm op cũng tính slot. Tuân tool và hướng dẫn delegation ưu tiên cao hơn. Worker không spawn đệ quy/gọi successor; coordinator quản lý admission và tiến lớp. Retry tính vào hạn mức invocation/lớp hiện tại. Không reset bằng batch/task/subchain, gộp nhiều op khác nhau thành op giả hay chạy quá lớp ba. Báo phần còn lại cho prompt sau. Tool steps trong một op hữu hạn không phải op mới. Đây là hướng dẫn agent, không phải background scheduler đã được cài.

Yêu cầu hiện tại và node nghiệp vụ đã được chấp nhận xác định ý định; source, runtime và evidence quan sát được xác định sự thật thực tế. Phân biệt đề xuất, ví dụ, chưa biết và mâu thuẫn. Không tự suy yêu cầu từ hành vi cũ, bịa actor/route/repository/rule/kết quả test, hoặc dùng ảnh chứng minh persistence. Có thể đề xuất file mới trong phạm vi được giao, nhưng phải ghi là dự kiến, không giả vờ file đã tồn tại.

Khi bắt đầu, nói ngắn trong hội thoại: mục tiêu cụ thể, ID node được chọn, giới hạn ghi source/resource và điều kiện xong. Tái sử dụng sự đồng ý đã có cho đúng phạm vi. Chỉ hỏi khi thiếu quyết định nghiệp vụ quan trọng, có mâu thuẫn chưa giải quyết, tác động bên ngoài mới hoặc mở rộng quyền sở hữu. Không bắt tạo request/response/session hay xin duyệt lại chỉ vì bắt đầu op. Quyền làm task không tự mở rộng sang deploy, tạo account, trả phí, push, xóa hoặc force.

Đọc hướng dẫn repository áp dụng, root `.work` hiện tại và danh tính repository chính xác trước khi ghi. Giữ thay đổi không liên quan của người dùng. Xem dependencies/piece hợp lệ; chỉ chọn piece chưa xong/suspended được yêu cầu và đủ điều kiện, không chọn mù ô chưa tick đầu. Thiếu prerequisite thì chặn piece, không tự gọi op bổ sung. Chạy song song khi tập piece được chọn và đường dẫn ghi/tài nguyên/session/dữ liệu mutable tách biệt. Ba flow UAT độc lập có thể ba agent khi được phép và có tool, không bắt mọi task ba agent. Dependency chung chỉ đọc; agent sở hữu node giao, không toàn cây cha.

## Graph dependency và quyền sửa scope

Graph thật nằm ở `.work`, không nằm trong danh sách next-step của op. Cây thư mục là containment/completion; `dependsOn:[nodeId]` khai prerequisite cần effective `done`. `na` không phải account/chat module/prerequisite đã hoàn thành. `refs:[nodeOrResourceId]` gắn input ngữ nghĩa/freshness nhưng không đòi completion hay tạo thứ tự chạy. Resource `files` gắn artifact nguồn local thật. Dependency viết trong prose hoặc tên op không tự thành cạnh graph.

Ví dụ một scope duyệt có art direction → UI design → frontend → UAT; scope khác module phụ thuộc account/chat; scope khác business → architecture → implementation → UAT. Đây là quan hệ dữ liệu ví dụ, không chain chung phải nhét vào mọi task. Ghi ID ổn định prerequisite vào `dependsOn` consumer; source/requirement/resource ID vào `refs` khi thay đổi ảnh hưởng consumer. Piece không liên quan vẫn độc lập.

Chỉ op goal/scope/planning/retirement được chọn rõ mới sửa graph đúng scope đó. Op khác đọc graph riêng và kế thừa của node rồi chỉ làm việc được chọn. Không âm thầm thêm/bỏ dependency/ref/required/acceptance scope để chạy hoặc pass. Prerequisite khai thiếu/chưa done thì báo ID và dừng piece. Graph thiếu/sai thì đề xuất scope update được chọn riêng; không tự dispatch prerequisite hoặc sửa graph để tiện implementation/UAT. Producer artifact nguồn được sửa resource/files sở hữu trong graph hiện có, không tự gắn consumer mới.

## Hợp đồng đường dẫn và trường dữ liệu

Các đường dẫn sau là mẫu, không phải đường dẫn đã tìm thấy. Resolve `<business>`, `<piece>`, slug resource và ID repository từ workspace thật. Không ghi nguyên placeholder hoặc đoán bằng tên gần giống. `N` là thư mục node đang làm; `E` là `N/evidence/<unique-evidence-id>`; `R` là `.work/_resources/<category>/<slug>`. Resolve symlink và giới hạn ghi trong root được giao.

Metadata dùng cú pháp JSON, là một tập con tương thích YAML, trong `workspace.yaml`, `resource.yaml`, `manifest.yaml` và front matter JSON của `node.md`. Bản này chưa parse YAML tổng quát. Tra schema thực tế trong `v3/schemas/` để dùng đúng core field. Nội dung nghiệp vụ chi tiết nằm ở body Markdown hoặc `extensions` có namespace; không tự thêm trường core.

| Nơi ghi | Trường hoặc nội dung | Ai ghi / bất biến |
| --- | --- | --- |
| `.work/workspace.yaml` | `schema: work/workspace@1`, `id` ổn định, extension workspace nếu cần | Chỉ khởi tạo workspace mới; không thay danh tính đang tồn tại. |
| Front matter `N/node.md` | `schema: work/node@1`, `id`, `kind`, `required`, `dependsOn`, `refs`, `assertions`; lá có `state` | Field scope/graph thuộc thay đổi scope/planning được chọn; consumer đọc nguyên trạng. Refs chứa ID resolve được, không chép tài liệu. |
| Body `N/node.md` | Mục tiêu, scope/ngoài scope, nguồn thẩm quyền, điều kiện xong và bảng chuyên môn của op | Spec hiện tại, không phải transcript. Đổi tên vẫn giữ ID; cây thư mục xác định con. |
| Metadata node lá | `blocker`, `naReason`, `completion` | Theo shape của schema; cha không lưu state/completion. Lưu `todo`, `doing`, `blocked`, `done`, `na`; độ mới và trạng thái cha được suy ra. |
| `extensions.work3` | Dữ liệu có cấu trúc chuyên môn được op mô tả; ghi version/domain khi có consumer | Không tạo sổ tiến độ thứ hai. Core giữ extension nhưng không tự chứng nhận ý nghĩa. |
| `R/resource.yaml` | `schema: work/resource@1`, `id`, `kind`, `owner`, `revision`, `details`; `files:[{path}]` tùy chọn | Một nguồn chung. File path local chuẩn hóa, tương đối với thư mục resource; core hash bytes thật. Không viết field sha256 trong files. Chỉ sửa nguồn thuộc quyền; observation runtime ở evidence. |
| `E/manifest.yaml` | `schema: work/evidence@1`, `id`, `nodeId`, `inputDigest`, `outcome`, `assertions:[{id,outcome,observation}]`, `assets:[{path,sha256}]`; `provenance`, `codeRefs`, `extensions` khi áp dụng | Ghi đúng `pass`, `fail`, `not-run`, `inconclusive`. Assertion bắt buộc cần quan sát thật. Asset nằm trong E, hash từ bytes cuối. |
| `E/*` | Ảnh chụp thật, output đã che bí mật, kết quả test, measurement và file op chỉ định | Bằng chứng bền; không chép mọi input/output hội thoại. Không ghi đè bundle đã chốt. Giữ bằng chứng fail cần giải thích lỗi hiện tại. |
| `.work/_local/` | Cache, scratch, handle checkout/session riêng máy | Ignore; không là bản duy nhất của evidence hoặc custody. Bí mật từ scratch không được đưa vào tài liệu track. |
| Source repository | Write ceiling thật đã quan sát hoặc đề xuất của op | Code ở source; `.work` tham chiếu repo/revision, không chép code vào cây tiến độ. |

Các nhánh `business`, `architecture`, `implementation`, `uat`, `release`, `operations` là vai trò gợi ý, không ép độ sâu hay bắt đủ stage. Thêm domain bằng node/resource kind cùng hợp đồng rõ ràng; giữ ID và trường core. Kind lạ được giữ nhưng không tự coi đạt profile đã biết.

Asset art direction/design đã chấp nhận là input nguồn: lưu ở thư mục resource design được chọn, khai `files:[{"path":"assets/direction.png"}]` với tên file thật. Node UI design/frontend consumer ref resource đó rõ. Screenshot output vẫn ở evidence bundle; đổi ảnh chụp đơn thuần không đổi design authority và không tự có nghĩa redesign. Muốn dùng ảnh quan sát làm nguồn design mới phải có quyết định scope/design rõ và source resource binding, không lén coi evidence là ý định.

Validator đọc bytes resource files đã khai và suy `suspended` bắc cầu cho node xong bị ảnh hưởng; completion/commit/evidence cũ giữ nguyên. Resource không ref không suspend việc không liên quan. `suspended` là trạng thái suy ra, không state lưu; diagnostic `STALE_*` có thể giải thích proof không còn áp dụng. Không relabel completion cũ done/xóa lịch sử/tự rerun consumer. Báo impact rồi chỉ chạy op đủ điều kiện được chọn riêng tiếp theo. Source/runtime ngoài chưa binding vẫn cần inspect thật và cập nhật revision resource; đây không là watcher nền file/deployment.

## Evidence, hoàn thành và commit

Trước khi chạy, lấy `inputDigest` hiện tại bằng validator chỉ đọc. Hoàn tất sửa spec trước khi thu proof; đổi body, yêu cầu, dependency hoặc resource revision là đổi đầu vào cần chứng minh. Không bịa digest. Plan xong không làm implementation done. Op kiểm tra có thể trả báo cáo đầy đủ, nhưng node verification không được done khi assertion bắt buộc fail.

Body Markdown và `extensions` node là đầu vào spec. Consumer không sửa scope/graph được chọn kể cả trước verification. Sau đóng digest, observation/finding/mapping commit/assertion chưa test/cleanup ghi ở `E/result.md` và file evidence, không body ngữ nghĩa. Sau proof chỉ sửa `state`, `blocker`, `completion` (hoặc timestamp vận hành cho phép). Đổi expected là cập nhật spec được chọn riêng cần proof mới, không là ghi chú output. Op planning/spec chốt body/graph scope đã chọn rồi review trên digest cuối.

Op tạo source/resource có hai thời điểm: inspect expected đã được phép trước effect; sau đó chốt facts source/resource thật trong scope và tính digest verification cuối trước kiểm postcondition. Cập nhật metadata identity/version/resource canonical đã chọn trước proof cuối; không đổi rule expected theo fact. Nếu resource cần con trỏ evidence, dùng ID ổn định phân bổ trước, chốt trước digest, chưa claim pass tới khi có proof; ưu tiên completion node chọn evidence hiện tại. Không nhúng hash nội dung evidence của chính resource hoặc đổi pointer ngữ nghĩa sau khi đóng proof. Source/resource/spec liên quan đổi trong lúc check thì rerun proof ảnh hưởng trên input thật mới, không chỉ thay digest để xóa stale.

Completion ghi `completion.inputDigest`, `completion.evidence` bằng evidence ID, và profile implementation/release có `completion.codeRefs:[{repository,commit}]` với resource ID repo và SHA Git đầy đủ thật. Mỗi bundle evidence chọn cũng có `codeRefs` tương ứng; repo IDs nằm trong node `refs`. Release có thể dùng commit nguồn thật đã inspect, không cần commit source mới chỉ để deploy. Validate sau khi gắn proof. Hash/ref chỉ chứng minh dữ liệu khớp, không chứng minh AI thật sự quan sát. Vẫn cần artifact tool thật và trực tiếp đọc/xem. Không tuyên bố loại bỏ hoàn toàn hallucination.

Task artifact/content local thuần không có repo hoặc acceptance source-code dùng lá `operations`, không giả đạt profile `implementation`. Ghi artifact/proof thật và không có commit product. Không miễn profile implementation cho giao code thật. Refresh revision resource repo/environment theo source/build quan sát thật trước validate: core không tự theo dõi Git HEAD hay deployment live.

Mỗi piece đổi code có commit local đúng scope khi task cho phép commit. Stage đúng file, đọc staged diff, chạy check áp dụng, ghi SHA thật; không `git add .`, amend, force hoặc đưa thay đổi ngoài scope vào. Một piece có thể nhiều commit/repo; ghi đủ, không bịa một SHA chung. Chưa có quyền commit thì báo source chưa commit và không tạo completion code giả. Piece không đổi code có thể dùng commit tồn tại đã kiểm tra và proof mới, không cần empty commit. Commit tài liệu/evidence thuộc repo `.work`, không phải commit product tưởng tượng.

Tách commit gốc, integration/cherry-pick, test và artifact deploy bất biến. `completion.codeRefs` gắn code giao; mapping ở `E/lineage.json` hoặc `E/result.md`, tham chiếu qua `extensions.work3.lineage` cấp evidence khi cần. Kiểm Git diff/ancestry và test affected paths; chỉ ancestry không chứng minh hành vi không bị commit sau đổi. Commit không chứa SHA chính nó: commit code trước, metadata `.work` bằng commit tài liệu/evidence sau nếu cùng repo.

Git lưu lịch sử thay đổi. `.work` giữ spec hiện tại và evidence cần thiết, không giữ lịch sử request/response trùng lặp. Xóa task hay Git worktree tạm không được mất bản duy nhất của ảnh/proof/account refs. Artifact store bên ngoài cần object bền có thật và integrity ref; URI chưa đọc lại được là chưa kiểm chứng, không thay asset local đã pass.

## Giao thức browser và UAT

Kiểm tra capability browser có thật trước khi chọn driver. Dùng browser skill đã cài và công cụ skill cho phép, hoặc Playwright/Chromium cài thật khi được phép. Khi dùng phải đọc đầy đủ skill. Không giả định binary, session, bridge hay screenshot tool luôn sẵn. Thiếu browser thì thiếu proof browser; mockup sinh bằng AI, fixture tĩnh hay API script không thay UAT qua browser.

Gắn revision environment, origin mong đợi, target vật lý khi cần, phiên bản FE/BE serve, generation cấu hình, actor resource hoặc anonymous, namespace fixture. Provenance UAT chính xác là `{environment, actor, servedVersions, tool, capturedAt, servedVersionEvidence}`, thay actor bằng `anonymous:true` khi anonymous. Environment resolve resource kind `environment`, actor kind `identity`; từng `servedVersions` là `{repository,commit,artifact}` với repo kind `repository`, SHA đầy đủ thật và identity image/build bất biến đã quan sát. `servedVersionEvidence` là ID assertion pass mô tả check version runtime thật. Mọi resource environment/actor/repo nằm trong `refs` consumer; resource input khác như fixture/design cũng ref rõ vì link trong `details` không tự là dependency core bắc cầu. Quan sát thêm ở `E/runtime.json` / evidence extensions, không thêm core field lạ. HEAD checkout không chứng minh browser chạy build đó. Health/version và page/network phải quan sát thật; redirect tới 404/sign-in không phải login product thành công.

Một run thật có thể chứng minh nhiều lá không cần chép ảnh. Giữ bundle một nơi, ví dụ `evidence/<id>/` của flow. Giữ `nodeId,inputDigest` chính; consumer thêm dùng `bindings:[{nodeId,inputDigest}]` trong manifest. Mỗi consumer ref evidence ID rõ và có đủ assertion/digest hiện tại riêng. Consumer chưa khai không được reuse; bundle fail/hỏng ảnh ảnh hưởng mọi consumer. Lá UI vẫn cần ảnh thật, UX vẫn cần ít nhất một assertion pass có `kind:"behavior"`. Binding/hash không chứng minh observation là sự thật.

Tách ba kết luận: giao diện (xem ảnh thật tại viewport/theme đã ghi), tương tác (control/action/feedback quan sát được), persistence/quyền (read-back, reload/resume và negative cases áp dụng). Journey UI phải bấm control thật. Tìm locator từ DOM/accessibility hiện tại; không bịa selector hoặc giấu bước fail. API/DB được bổ sung kiểm persistence nhưng không thay hành động UI mà đang tuyên bố đã thực hiện.

Tách context/session browser giữa actor/flow song song và tách namespace dữ liệu mutable. Tab khác nhau không đủ cách ly cookies hoặc dữ liệu. Account chung có thể chỉ đọc nếu an toàn; không tự tạo account phụ. Lấy credential qua custody được phép tại lúc dùng. Lưu alias/provider subject/role/member refs, không plaintext credential/token/cookie/raw storage state hay trace chứa bí mật. Xem và che evidence trước khi track; ghi cách che và hash bytes đã che.

## Kết thúc hữu hạn và blocker

Tái sử dụng resource còn khớp, inspect trước khi sửa trạng thái chưa chắc. Dừng khi lỗi giống hệt lặp lại mà không có chẩn đoán hay hướng khác được phép. Tác động bên ngoài chưa rõ kết quả phải read-only reconcile trước khi retry. Không giảm expected, skip test fail, đổi `required`/`na` để làm xanh cha.

Blocker phải nêu thông tin thiếu thật, node bị ảnh hưởng, quan sát gần nhất và quyết định/hành động cần từ owner. Chỉ tiếp tục piece độc lập đã chọn nếu an toàn và còn hạn mức. Lỗi không cấp quyền repair/deploy/chain ngoài scope. Worker trả kết quả, node/file, commit, phần đã/chưa test, evidence và gap cho coordinator rồi dừng, không gọi op khác. Coordinator có thể tiến lớp đã chọn đủ điều kiện; kết thúc prompt khi đạt kết quả, thiếu quyết định bắt buộc hoặc hết ba lớp. Op chưa chọn chỉ là đề xuất cho prompt sau.
