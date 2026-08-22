---
title: Skill shape · Vietnamese
---

# Cấu trúc chung của skill

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@workspace-language` | `scripts/resolve-workspace-language.mjs` | script | resolve ngôn ngữ chung của Source cho mọi phản hồi tới người dùng |
| `@credential-intake` | `runbooks/secrets/vi.md` | vi | nhận credential operator còn thiếu ngay qua intake ẩn và được mã hóa |
| `@host-os` | `scripts/check-host-os.mjs` | script | chỉ chọn credential/setup entrypoint được host hiện tại hỗ trợ |
| `@session-control` | `scripts/session-control.mjs` | script | enforce selection, approval, continuation, rejection reset và completion transition |


## Bản ghi

Mô-đun này quyết định mọi skill được hỏi gì, dùng approval ra sao, chia việc thế nào và cho người dùng
thấy gì. Vẫn giữ đủ evidence nội bộ để audit boundary và kết quả, nhưng không bắt người dùng vận hành
workflow thay agent.

## Luật

Agent sở hữu phần thi hành. Chỉ ngắt owner khi có một quyết định agent thật sự không có thẩm quyền đưa
ra. Điều tra, phán đoán triển khai trong scope, fallback an toàn, chia agent, kiểm chứng,
sửa thông thường và việc còn nợ đều tiếp tục mà không hỏi.

Phát hiện không phải là được phép, nhưng `OK` trên boundary approval đang hiển thị chính là quyền làm.
Không bao giờ bắt owner lặp lại nó.

Skill không tự gọi skill khác. `OK` chỉ cấp quyền cho boundary chính xác đã hiển thị; capability khác vẫn
là request riêng của owner.

## Tiếp nhận credential

Credential còn thiếu là việc đã phát hiện, không phải chú thích proof để cuối lượt mới báo. Ngay tại
dependency đầu tiên cần credential, phải nêu provider, scope quyền, encrypted owner chuẩn, consumer và
proof không chứa secret, rồi xin owner cung cấp ngay qua `@credential-intake`. Không bao giờ xin value
trong chat. Trên Windows, trình đúng plan không chứa value của `scripts/set-credential.ps1` và chỉ dùng
hidden prompt sau khi owner cho phép execute. Setup riêng của provider còn phải tạo service identity hoặc
token ít quyền nhất, publish đủ projection đã khai, validate mà không in value và định nghĩa rotation.
Chạy `@host-os` trước khi chọn script riêng theo hệ điều hành. Wrapper PowerShell chỉ dành cho Windows;
host POSIX dùng Node hoặc shell entrypoint đã khai, còn host không hỗ trợ dừng trước khi nhận credential.

## Ngôn ngữ runtime

Instruction runtime chỉ đến từ runtime record. Skill đọc `SKILL.md` binding của chính nó, sau đó đọc
`context.md` dẫn xuất của mọi module ghép cặp trong `LOADS`. Nó không bao giờ đọc `en.md` hoặc `vi.md`
làm instruction và không trộn human record vào runtime. `en.md` là bản tham chiếu tiếng Anh đầy đủ,
`vi.md` là bản tham chiếu tiếng Việt đầy đủ, còn `context.md` là binding record gọn được dẫn xuất từ
`en.md`. Runtime record không chứa metadata; `context-manifest.json` giữ source hash và schema version
riêng, ngoài context được agent nạp.

Compiler tạo baseline an toàn, giữ dependencies, Bản ghi và Luật, bảng routing và situation, boundary,
quy trình vận hành, Quy tắc, Ngoại lệ, Đầu ra, Điểm dừng và Proof. Maintainer có thể lược các Ví dụ đã
giải, Anchor, Phạm vi, prose ví dụ business phổ biến và diễn giải lịch sử ở nơi phân biệt đó an toàn.
Source hash trong manifest bị stale hoặc thiếu binding section là không hợp lệ; sau khi curate có chủ ý
phải refresh manifest và chạy context contract check.

Dependency graph bị ràng buộc theo ngôn ngữ: runtime record đọc `context.md`, publication tiếng Anh đọc
`en.md`, còn publication tiếng Việt đọc `vi.md`. Kiểm tra ba graph độc lập; alias giống nhau mô tả cùng
một dependency logic nhưng không dùng chung physical target record.

Sau khi resolve Source và trước phản hồi đầu tiên cho người dùng, chạy `@workspace-language --source
<Source>`. Giá trị `defaultLang` của nó quyết định ngôn ngữ cho mọi phần tường thuật và bằng chứng trong
lượt chạy. Nếu request hiện tại chỉ định rõ một ngôn ngữ khác thì chỉ lượt đó được override. Tiêu đề, nhãn
schema, path, command và identifier trong code giữ nguyên vì dịch chúng sẽ làm hỏng validation.

Nếu config chung bị thiếu hoặc không hợp lệ, không được âm thầm fallback sang tiếng Anh. Dùng ngôn ngữ của
request hiện tại để chỉ đúng lỗi config; default còn thiếu vẫn là việc setup workspace. Tiếng Anh sở hữu
instruction runtime, còn workspace config sở hữu ngôn ngữ mặc định của đầu ra cho người đọc.

## Mười chín năng lực

Mười bảy capability trực tiếp làm việc. Hai capability chỉ **quan sát**: `starci-stale-list` đo trạng thái
máy, còn `starci-diagnose` lần theo một skill khác. Một
bản báo cáo đã tự sửa thứ nó đang đo thì không còn đáng tin: route vừa bị âm thầm làm mới sẽ trông như
thể ngay từ đầu nó đã đúng.

| Skill | Sở hữu |
|---|---|
| `starci-business-analyze` | business feature head có evidence từ FE+BE, LLM context theo module và surface sẵn sàng cho prototype |
| `starci-init` | làm Source sẵn sàng: identity SOPS+age, bootstrap, route workspace và state worktree — bốn root được duyệt độc lập |
| `starci-cloudflare-tunnel-set` | custody Cloudflare credential đã mã hóa và áp dụng một HTTP(S) tunnel/DNS route đã duyệt |
| `starci-deploy` | tiếp nhận stack đã route, setup host, release immutable, reconcile domain đã khai và monitor steady state qua execution state `.infra` bị ignore |
| `starci-setup-mcp` | một MCP read-only toàn Source, các source partition theo route và publication `mcp.<zone>` đã duyệt |
| `starci-setup-sonar` | một Docker SonarQube dùng chung, onboarding project và publication `sonar.<zone>` đã duyệt |
| `starci-stale-list` | mọi stale category, gồm local gate được chạy và frontend hoặc backend assurance wiring, cùng ai dọn từng loại |
| `starci-diagnose` | một lượt lần theo chỉ-đọc: skill sẽ dừng ở đâu, và cái dừng đó có đúng hay không |
| `starci-repair` | source đỏ hoặc assurance chưa đủ trở lại xanh: các repair pass giữ tách nhau và frontend hoặc backend delivery fence được cài trọn sau khi gate pass |
| `starci-debt-repay` | trả debt đã được owner duyệt theo từng scope, ghi tiến độ và chỉ bỏ scope có proof pass |
| `starci-fe-design-layout` | chất vấn, preview, duyệt và implement một page/page flow đã bind source trong cùng invocation |
| `starci-fe-design-block` | đánh giá, preview, duyệt và implement một region trong current complete page ở cùng invocation |
| `starci-fe-ui-align` | chủ động audit và hội tụ UI responsibility tương đương trên các surface hiện hữu, chỉ evolve authority cho gap đã chứng minh |
| `starci-fe-feedback-evolve` | biến feedback owner đã chứng minh thành cải tiến authority bền vững nhỏ nhất và source correction |
| `starci-grammar-refresh-references` | một lượt sửa liên tục cho optional immutable grammar provenance stale; durable authority giữ nguyên byte |
| `starci-fe-minor-fix` | một correction nhỏ giữ nguyên contract trong một folder block, composite hoặc leaf hiện hữu và sạch; machine reject khi scope lớn lên |
| `starci-conversation-record` | conversation provenance snapshot provider-neutral và exact FE/BE artifact link, không lưu raw transcript trong Git |
| `starci-be-plan` | brief backend: file nào, biên giới nào, ca kiểm thử nào |
| `starci-be-approve` | sự chấp thuận, rồi source backend |

Layout và block design dùng candidate identity chỉ sống trong phiên, tái dùng composition existing đã bind source và implement kết quả được duyệt trước khi cùng invocation kết thúc. `OK` chỉ cấp quyền cho exact boundary đang hiển thị. Cache-only boundary có thể freeze design evidence nhưng không cấp quyền source; chỉ boundary gọi tên exact source files mới authorize write.

## Khóa ngữ cảnh

Trước khi làm, resolve Workdir, Source, Project do người dùng khai, role target đã verify, Trust, mục đích,
nơi giữ record, write boundary chính xác, evidence đã đọc và tiền đề còn thiếu. Capability có kho bền thì
giữ đầy đủ lock trong đó.

Không bao giờ in bảng context nội bộ. Nói một câu thân thiện cho người dùng biết agent đang làm ở đâu, project
và role nào đã resolve, hành động hiện tại được chạm boundary nào. Bảng bước bắt buộc bên dưới là execution control cho user, không phải context nội bộ. Chỉ bị chặn khi giá trị context bắt buộc
không thể tìm từ yêu cầu, workspace route hoặc live evidence.

## Các trạng thái tiến trình

Mỗi StarCi skill khi được gọi phải suy ra các bước thực thi có thứ tự từ `Run` hoặc `Process` của chính nó
và in một bảng gọn với đúng bốn cột: `Bước`, `Việc làm`, `Kết quả bắt buộc`, `Trạng thái`. Bảng chỉ chứa
các bước công việc thật, không chứa context values, agent assignments hoặc implementation trivia. Vocabulary
trạng thái đóng là `đang làm`, `chờ OK`, `hoàn tất`, `blocked`; tối đa một row được `đang làm`.

Lời gọi skill ban đầu authorize bước discovery read-only đầu tiên. Sau khi hoàn tất một bước, cập nhật cùng
bảng đó, đánh dấu row kế tiếp `chờ OK`, hiển thị exact action và write boundary của bước kế tiếp, rồi dừng.
Chỉ đi tiếp khi toàn bộ message sau trim khớp `OK` không phân biệt hoa thường (`OK`, `ok`, `Ok`, `oK`). Token
đó chỉ authorize đúng bước kế tiếp đang hiển thị một lần. Feedback hoặc message khác giữ run ở bước hiện tại
và có thể sửa các row còn lại mà không consume approval. Row cuối hoàn tất không cần token bổ sung.

`own` là mọi executable action trong bước hiện tại đã được duyệt: điều tra, edit đảo được, fallback tool an
toàn, chia agent, sinh candidate, phán đoán triển khai, gate, sửa trong scope và proof. Tiếp tục tới khi
`own = 0` của bước hiện tại, rồi dừng ở row kế tiếp thay vì tự đi tiếp.

`need approval` chỉ gồm quyết định sản phẩm không có default dựa trên evidence, destructive loss đáng kể,
publish hay cam kết ra ngoài, thiếu access, hoặc mở rộng sang project, role, repository hay write boundary
chưa được trình. Gộp mọi mục hiện biết dưới `### NEED APPROVALS`, mỗi mục có một recommended/default.

Thiếu credential authority phải được đưa ra ngay khi plan read-only đầu tiên chứng minh nó cần thiết.
Không tiếp tục execute provider rồi đợi tới lúc close mới báo; phần local an toàn vẫn chạy song song trong
khi owner hoàn thành hidden intake.

Khi user trả lời token `ok` exact và không phân biệt hoa thường, chỉ duyệt boundary của bước kế tiếp đang
hiển thị cùng mọi product/source approval được đặt rõ trên chính row đó. Ghi identity hoặc hash, lấy baseline
nếu cần rồi chạy bước ấy ngay. Approval không phủ scope chưa trình hoặc các row sau. Im lặng và message khác
không phải tín hiệu approval.

## Quyết định và thi hành

### Control protocol

`A`, hoặc candidate label đang hiển thị khác, chỉ chọn candidate đó. Token `ok` exact không phân biệt hoa
thường duyệt bước kế tiếp đang hiển thị và mọi exact boundary đặt trên row đó. `continue` hoặc `tiếp tục` chỉ
resume phần own còn nợ trong bước hiện tại đã duyệt, không được đi sang row kế tiếp. Nghĩa này ổn định giữa
mọi StarCi skill.

Mọi owner rejection rõ ràng invalidate current candidate và mọi assumption sinh từ nó. Strong negative feedback không phải yêu cầu patch incremental tiếp: dựng lại baseline bốn lock, đọc lại complete page/flow và classify failure trước khi sửa.

Trước implementation, khóa `Scope`, `Owner`, `Invariant`, `Proof`. Request nói shared phải đo mọi consumer; bounded screenshot annotation giữ local trừ khi owner promote rõ.

**Các lượt design** là session evidence tùy chọn. Lựa chọn direction hỗ trợ một lượt layout và không có
durable hash hay checkpoint owner riêng. Candidate chính xác cùng recommendation dựa trên evidence nằm
trong project cache của invocation hiện tại. Block dùng một displayed source boundary. Layout dùng hai
boundary rõ ràng: `OK #1` freeze page contract trong cache và mở state expansion nhưng không có source
authority; `OK #2` duyệt complete states cùng exact source files và mở implementation. Feedback về page
anatomy quay lại page review; state-only feedback giữ approved page contract.

Mọi frontend design candidate phải là trang HTML functional, self-contained với representative business density
gần production. Trước khi vẽ phải inventory condition viewport, overlay, disclosure, async, data, permission và
interaction; render mọi state reachable, ghi rõ `not-applicable` cho family không liên quan, và nối state bằng
in-page control visible, keyboard-operable. Desktop/mobile, modal, drawer, menu/popover, loading, empty, error,
locked và disabled là proof obligation khi evidence cho thấy reachable. Static render, toy content hay QA-only
state switcher không thể được chọn hoặc publish.

Trước khi ghi, đọc business authority, canon, hợp đồng và source sống rồi nêu `businessImpact`, stable
feature/head, mục tiêu, bằng chứng, boundary chính xác, quyết định và bằng chứng nghiệm thu. Work ảnh hưởng
business cần `in-progress`; work thuần kỹ thuật bind `implemented` với `businessImpact: none` và không tạo
feature. Khi cần quyền owner, chờ `OK` trước lần ghi sản phẩm đầu tiên và giữ lại phương án bị từ chối cùng lý do của owner.

Sau khi được cấp quyền, xác nhận boundary ghi, lấy baseline commit **trước** khi sửa, thi hành revision
đã duyệt và chứng minh tại biên sản phẩm. Work ảnh hưởng business sau đó reconcile final committed source
thành `implemented`. Một đường dẫn ngoài `Touching` được trả về cho chủ của nó,
không được lặng lẽ xuất hiện trong diff.

## Đầu ra cho người dùng

In bảng bước bắt buộc khi gọi skill, sau mỗi bước hoàn tất và khi feedback đổi phần kế hoạch còn lại. Không
in section rỗng, dòng `None`, context nội bộ hay ma trận chia agent. Một lượt kết thúc khi `own = 0` của bước
hiện tại và row kế tiếp đang `chờ OK`, khi chờ một mục `### NEED APPROVALS` thật khác, hoặc khi mọi row hoàn tất.

Khi hoàn tất, nói gọn kết quả, path chính và proof bằng văn xuôi hoặc danh sách ngắn. Không dùng từ hoàn tất khi còn known defect, viewport/state bắt buộc thiếu full-page proof, gate đỏ, source ở sai repository hoặc requested delivery state chưa đạt. Phải nói chính xác `verified locally`, `committed`, `pushed` hoặc `merged`. Khi bị chặn bởi thẩm
quyền owner, `### NEED APPROVALS` giải thích còn thiếu gì, vì sao agent không thể tự sở hữu, default được
đề xuất và scope chính xác mà `OK` cấp phép.

## Bản ghi

Không có report file riêng hay design registry bền vững. Design candidate, selected preview và review manifest
nằm dưới `<Source>/.worktrees/<project>/cache/design/<session-id>` và hết hiệu lực cùng invocation. Frontend
source, test và browser proof là accepted design outcome bền vững. Business và conversation authority giữ store
được route riêng. Repair ghi bằng commit/diff; lượt chỉ đọc không ghi file trừ khi được yêu cầu rõ.

Một boundary được duyệt gọi tên `Approved revision: <identity>` và trích đúng identity đó cùng baseline
commit. Chính cặp đó chứng minh cái gì đã đổi sau khi được cấp quyền, và nó sống sót ở bất cứ nơi nào
công việc ghi lại — nó là một **câu**, không phải một tệp.

Phần tường thuật và bằng chứng cho người dùng viết bằng `defaultLang` đã resolve, trừ khi request hiện tại
chỉ định rõ ngôn ngữ khác. Tiêu đề, nhãn schema, đường dẫn, câu lệnh và tên định danh trong code giữ nguyên,
vì dịch chúng là làm hỏng bộ kiểm.

Bằng chứng cũ không bị viết lại cho khớp định dạng mới. Bản ghi lịch sử là bằng chứng; muốn sửa thì **ghi
thêm**.

## Quy tắc

1. Resolve context lock và `Touching` trước khi ghi; trình chúng bằng câu thân thiện.
2. Tiếp tục mọi action trong bước hiện tại đã duyệt; không được vào row kế tiếp nếu chưa có approval token của row đó.
3. Chỉ hỏi `need approval` thật, với một default đang hiển thị.
4. Chỉ toàn bộ message sau trim bằng `ok` không phân biệt hoa thường mới consume approval bước kế tiếp đang hiển thị và resume bước ấy ngay.
5. Design approval và source implementation xảy ra trong cùng invocation; cached candidate key không bao giờ là durable authority.
6. Task khác dựng lại design evidence từ current source, contract, grammar và business truth.
7. Production baseline lấy sau source-authorizing `OK` và trước production write đầu tiên.
8. Path ngoài boundary đã trình trở lại thành mục `NEED APPROVALS` mới.
9. Việc chia an toàn được thì nhắm mười assignment không chồng lấn; một coordinator giữ gate shared-state.
   Runtime dưới mười slot thì lấp đầy và backfill mọi slot khả dụng.
10. Mọi StarCi skill duy trì bảng bước user-facing gọn; bảng internal context và agent assignment vẫn bị cấm.
11. Resolve `defaultLang` từ workspace config chung của Source trước phản hồi đầu tiên cho người dùng.
12. Credential còn thiếu kích hoạt intake owner ngay và không chứa value; value không bao giờ đi qua chat,
    argument, generated command hoặc log.
13. Đo host OS trước khi chọn setup script; không bao giờ thử extension không tương thích.
14. Candidate label chỉ chọn; chỉ `OK` trên exact-source boundary đã hiển thị rõ mới authorize write; `continue` resume không mở checkpoint mới.
15. Owner rejection reset baseline và assumptions trước edit tiếp theo.
16. Completion cần zero known defect, đủ requested proof và đúng declared delivery state.

## Ngoại lệ

- **Năng lực chỉ đọc.** Nó không biến measurement thành repair; nó báo evidence và owner của repair
  request riêng.
- **Design-only request.** Cache preview hết hiệu lực cùng invocation và task sau dựng lại từ baseline hiện hành.

## Ví dụ đã giải

**Lượt chạy.** "Thiết kế trang kết quả bài luyện coding."

Lượt chạy nói exact cache/source boundary và trình một complete page set dưới `OK #1: PAGE ANATOMY`. Sau cache-only approval đó, nó bung mọi state và trình `OK #2: STATES + SOURCE BOUNDARY`. Chỉ approval thứ hai mở implementation; cùng invocation sau đó hoàn tất code và proof.

## Phạm vi

Mô-đun này quyết định **hình dạng mà mọi skill báo cáo theo**. Nó không quyết định một layout được
chứa gì, class nào là đúng, hay repository nào được đọc — ba chuyện đó thuộc mô-đun brainstorm,
compiler và context.
