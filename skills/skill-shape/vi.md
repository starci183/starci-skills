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

## Mười lăm năng lực

Mười ba capability trực tiếp làm việc. Hai capability chỉ **quan sát**: `starci-stale-list` đo trạng thái
máy, còn `starci-diagnose` lần theo một skill khác. Một
bản báo cáo đã tự sửa thứ nó đang đo thì không còn đáng tin: route vừa bị âm thầm làm mới sẽ trông như
thể ngay từ đầu nó đã đúng.

| Skill | Sở hữu |
|---|---|
| `starci-init` | làm Source sẵn sàng: identity SOPS+age, bootstrap, route workspace và state worktree — bốn root được duyệt độc lập |
| `starci-cloudflare-tunnel-set` | custody Cloudflare credential đã mã hóa và áp dụng một HTTP(S) tunnel/DNS route đã duyệt |
| `starci-deploy` | tiếp nhận stack đã route, setup host, release immutable, reconcile domain đã khai và monitor steady state qua execution state `.infra` bị ignore |
| `starci-setup-mcp` | một MCP read-only toàn Source, các source partition theo route và publication `mcp.<zone>` đã duyệt |
| `starci-setup-sonar` | một Docker SonarQube dùng chung, onboarding project và publication `sonar.<zone>` đã duyệt |
| `starci-stale-list` | mọi stale category, gồm local gate được chạy và frontend hoặc backend assurance wiring, cùng ai dọn từng loại |
| `starci-diagnose` | một lượt lần theo chỉ-đọc: skill sẽ dừng ở đâu, và cái dừng đó có đúng hay không |
| `starci-repair` | source đỏ hoặc assurance chưa đủ trở lại xanh: các repair pass giữ tách nhau và frontend hoặc backend delivery fence được cài trọn sau khi gate pass |
| `starci-fe-design-layout` | chọn một direction recommendation bằng evidence, rồi trình 3–4 layout đã nhúng direction dưới một approval hash |
| `starci-fe-design-block` | 3–4 giải phẫu mỗi region dưới direction nằm trong layout của nó, buộc theo hash |
| `starci-fe-design-execute` | source frontend, chỉ sau khi mọi hash đạt tới được đã được chấp nhận |
| `starci-fe-minor-fix` | một correction nhỏ giữ nguyên contract trong một folder block, composite hoặc leaf hiện hữu và sạch; machine reject khi scope lớn lên |
| `starci-conversation-record` | conversation provenance snapshot provider-neutral và exact FE/BE artifact link, không lưu raw transcript trong Git |
| `starci-be-plan` | brief backend: file nào, biên giới nào, ca kiểm thử nào |
| `starci-be-approve` | sự chấp thuận, rồi source backend |

Layout resolve hoặc tạo stable `layoutId`. Execute vẫn từ chối ghi khi còn region dưới accepted head chưa
có current accepted block. `OK` chỉ cấp quyền cho
boundary đã hiển thị; không skill nào tự cho rằng capability khác đã được yêu cầu.

## Khóa ngữ cảnh

Trước khi làm, resolve Workdir, Source, Project do người dùng khai, role target đã verify, Trust, mục đích,
nơi giữ record, write boundary chính xác, evidence đã đọc và tiền đề còn thiếu. Capability có kho bền thì
giữ đầy đủ lock trong đó.

Không bao giờ in bảng context. Nói một câu thân thiện cho người dùng biết agent đang làm ở đâu, project
và role nào đã resolve, hành động hiện tại được chạm boundary nào. Chỉ bị chặn khi giá trị context bắt buộc
không thể tìm từ yêu cầu, workspace route hoặc live evidence.

## Các trạng thái tiến trình

`own` là mọi hành động có thể thi hành trong scope đã khai: điều tra, edit đảo được, fallback tool an toàn,
chia agent, sinh candidate, phán đoán triển khai, baseline sau approval, gate, sửa trong scope, proof và
proof trong skill hiện tại. Tiếp tục tới khi `own = 0`.

`need approval` chỉ gồm quyết định sản phẩm không có default dựa trên evidence, destructive loss đáng kể,
publish hay cam kết ra ngoài, thiếu access, hoặc mở rộng sang project, role, repository hay write boundary
chưa được trình. Gộp mọi mục hiện biết dưới `### NEED APPROVALS`, mỗi mục có một recommended/default.

Thiếu credential authority phải được đưa ra ngay khi plan read-only đầu tiên chứng minh nó cần thiết.
Không tiếp tục execute provider rồi đợi tới lúc close mới báo; phần local an toàn vẫn chạy song song trong
khi owner hoàn thành hidden intake.

Khi user trả lời `OK`, duyệt mọi default và boundary chính xác đang hiển thị. Ghi identity hoặc hash, lấy
baseline nếu cần rồi tiếp tục ngay. `OK` không phủ scope chưa trình. Im lặng và mọi từ khác `OK` đều không
phải tín hiệu approval.

## Quyết định và thi hành

**Các lượt design** chính là mặt để rà soát. Lựa chọn direction hỗ trợ một lượt layout và không có
approval hash hay checkpoint owner riêng. Candidate chính xác cùng recommendation dựa trên evidence nằm
trong `directionReview`, còn object được đề xuất nằm trong mọi candidate layout. Owner xem hai quyết định
cùng lúc; một `OK` chấp nhận layout hash mặc định và vì vậy chấp nhận direction được nhúng. Mỗi lượt giữ
đúng prompt, candidate, feedback và phán quyết của owner. Phản hồi về direction hoặc structure mở lượt
mới; nó không bao giờ sửa lượt đã được chấp nhận.

Trước khi ghi, đọc canon, hợp đồng và source sống rồi nêu mục tiêu, bằng chứng, boundary chính xác,
quyết định và bằng chứng nghiệm thu. Khi cần quyền owner, chờ `OK` trước lần ghi sản phẩm đầu tiên và giữ
lại phương án bị từ chối cùng lý do của owner.

Sau khi được cấp quyền, xác nhận boundary ghi, lấy baseline commit **trước** khi sửa, thi hành revision
đã duyệt và chứng minh tại biên sản phẩm. Một đường dẫn ngoài `Touching` được trả về cho chủ của nó,
không được lặng lẽ xuất hiện trong diff.

## Đầu ra cho người dùng

Không in bảng trạng thái, section rỗng, dòng `None`, context nội bộ hay ma trận chia agent. Trước batch
đáng kể kế tiếp, nói thân thiện: `Trước khi làm tiếp, em còn nợ: ...`, rồi trả trong cùng lượt. Một lượt
chỉ kết thúc khi `own = 0`, hoặc đang chờ một mục `### NEED APPROVALS` thật.

Khi hoàn tất, nói gọn kết quả, path chính và proof bằng văn xuôi hoặc danh sách ngắn. Khi bị chặn bởi thẩm
quyền owner, `### NEED APPROVALS` giải thích còn thiếu gì, vì sao agent không thể tự sở hữu, default được
đề xuất và scope chính xác mà `OK` cấp phép.

## Bản ghi

Không có report file riêng. Design authority bền nằm dưới
`<Source>/.worktrees/<project>/registries`: stable layout/block IDs trỏ tới accepted hashes, immutable
objects giữ candidate bodies, và `reviews/` tùy chọn giữ prompt, feedback, verdict. Progress dựng lại được
nằm dưới `cache/drafts`; repair ở commit/diff; lượt chỉ đọc không ghi file trừ khi được yêu cầu rõ.

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
2. Mọi hành động `own` tiếp tục không hỏi; không được kết thúc khi `own > 0`.
3. Chỉ hỏi `need approval` thật, với một default đang hiển thị.
4. Chỉ `OK` consume approval đang hiển thị và resume ngay.
5. Một stable layout/block ID có một accepted head; thay head thì append history, không sửa hashed object.
6. Execute chỉ chạy khi mọi hash reachable đã accepted.
7. Baseline lấy sau `OK` và trước production write đầu tiên.
8. Path ngoài boundary đã trình trở lại thành mục `NEED APPROVALS` mới.
9. Việc chia an toàn được thì nhắm mười assignment không chồng lấn; một coordinator giữ gate shared-state.
   Runtime dưới mười slot thì lấp đầy và backfill mọi slot khả dụng.
10. Đầu ra cho người dùng không có bảng trạng thái.
11. Resolve `defaultLang` từ workspace config chung của Source trước phản hồi đầu tiên cho người dùng.
12. Credential còn thiếu kích hoạt intake owner ngay và không chứa value; value không bao giờ đi qua chat,
    argument, generated command hoặc log.
13. Đo host OS trước khi chọn setup script; không bao giờ thử extension không tương thích.

## Ngoại lệ

- **Năng lực chỉ đọc.** Nó không biến measurement thành repair; nó báo evidence và owner của repair
  request riêng.
- **Design identity được tiếp tục.** Layout resolve head của `layoutId` hiện có. Review history có thể
  tiếp tục, nhưng caller không cần review id để tìm current accepted state.

## Ví dụ đã giải

**Lượt chạy.** "Thiết kế trang kết quả bài luyện coding."

Lượt chạy nói: `Em đang thiết kế example-app trên route frontend đã verify; hành động này chỉ ghi design
review và registry heads.` Nó trình 3–4 layout có direction cùng một default dưới `NEED APPROVALS`. Sau `OK`, nó bind hash
và làm hết mọi mục `own` của Layout mà không hỏi lại. Block vẫn là capability request riêng.

## Phạm vi

Mô-đun này quyết định **hình dạng mà mọi skill báo cáo theo**. Nó không quyết định một layout được
chứa gì, class nào là đúng, hay repository nào được đọc — ba chuyện đó thuộc mô-đun brainstorm,
compiler và context.
