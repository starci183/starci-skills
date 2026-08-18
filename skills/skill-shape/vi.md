---
title: Skill shape · Vietnamese
---

# Cấu trúc chung của skill

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@workspace-language` | `scripts/resolve-workspace-language.mjs` | script | resolve ngôn ngữ chung của Source cho mọi phản hồi tới người dùng |


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

## Ngôn ngữ runtime

Instruction runtime chỉ dùng tiếng Anh. Skill đọc `SKILL.md` binding của chính nó, sau đó đọc bản `en.md`
của mọi module ghép cặp trong `LOADS`. Nó không bao giờ đọc `vi.md`, không dịch instruction từ đó và không
trộn hai bản ghi. `vi.md` chỉ dành cho người đọc; đưa nó vào runtime sẽ làm một luật có hai cách diễn đạt và
khiến contract được thực thi phụ thuộc vào lựa chọn ngôn ngữ.

Sau khi resolve Source và trước phản hồi đầu tiên cho người dùng, chạy `@workspace-language --source
<Source>`. Giá trị `defaultLang` của nó quyết định ngôn ngữ cho mọi phần tường thuật và bằng chứng trong
lượt chạy. Nếu request hiện tại chỉ định rõ một ngôn ngữ khác thì chỉ lượt đó được override. Tiêu đề, nhãn
schema, path, command và identifier trong code giữ nguyên vì dịch chúng sẽ làm hỏng validation.

Nếu config chung bị thiếu hoặc không hợp lệ, không được âm thầm fallback sang tiếng Anh. Dùng ngôn ngữ của
request hiện tại để chỉ đúng lỗi config; default còn thiếu vẫn là việc setup workspace. Tiếng Anh sở hữu
instruction runtime, còn workspace config sở hữu ngôn ngữ mặc định của đầu ra cho người đọc.

## Mười hai năng lực

Mười capability trực tiếp làm việc. Hai capability chỉ **quan sát**: `starci-stale-list` đo trạng thái
máy, còn `starci-diagnose` lần theo một skill khác. Một
bản báo cáo đã tự sửa thứ nó đang đo thì không còn đáng tin: route vừa bị âm thầm làm mới sẽ trông như
thể ngay từ đầu nó đã đúng.

| Skill | Sở hữu |
|---|---|
| `starci-init` | làm Source sẵn sàng: identity SOPS+age, bootstrap, route workspace và state worktree — bốn root được duyệt độc lập |
| `starci-cloudflare-tunnel-set` | custody Cloudflare credential đã mã hóa và áp dụng một HTTP(S) tunnel/DNS route đã duyệt |
| `starci-setup-mcp` | một MCP read-only toàn Source, các source partition theo route và publication `mcp.<zone>` đã duyệt |
| `starci-setup-sonar` | một Docker SonarQube dùng chung, onboarding project và publication `sonar.<zone>` đã duyệt |
| `starci-stale-list` | mọi stale category, gồm local gate được chạy và frontend hoặc backend assurance wiring, cùng ai dọn từng loại |
| `starci-diagnose` | một lượt lần theo chỉ-đọc: skill sẽ dừng ở đâu, và cái dừng đó có đúng hay không |
| `starci-repair` | source đỏ hoặc assurance chưa đủ trở lại xanh: các repair pass giữ tách nhau và frontend hoặc backend delivery fence được cài trọn sau khi gate pass |
| `starci-fe-design-layout` | 3–4 lựa chọn direction không có hash riêng, rồi 3–4 phương án layout mỗi bề mặt, buộc theo hash |
| `starci-fe-design-block` | 3–4 giải phẫu mỗi region dưới direction nằm trong layout của nó, buộc theo hash |
| `starci-fe-design-execute` | source frontend, chỉ sau khi mọi hash đạt tới được đã được chấp nhận |
| `starci-be-plan` | brief backend: file nào, biên giới nào, ca kiểm thử nào |
| `starci-be-approve` | sự chấp thuận, rồi source backend |

Layout mở session. Execute vẫn từ chối ghi khi còn hash reachable chưa accepted. `OK` chỉ cấp quyền cho
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

Khi user trả lời `OK`, duyệt mọi default và boundary chính xác đang hiển thị. Ghi identity hoặc hash, lấy
baseline nếu cần rồi tiếp tục ngay. `OK` không phủ scope chưa trình. Im lặng và mọi từ khác `OK` đều không
phải tín hiệu approval.

## Quyết định và thi hành

**Các lượt design** chính là mặt để rà soát. Lựa chọn direction hỗ trợ một lượt layout và không có
approval hash riêng; candidate chính xác, lựa chọn hoặc phản hồi của nó nằm trong `directionReview` của
lượt layout, còn object được chọn nằm trong candidate layout. Mỗi lượt được ghi giữ đúng prompt, các phương án, phản hồi và phán
quyết của người chủ, và sự chấp nhận **buộc theo hash**. Phản hồi mở một lượt mới; nó không bao giờ sửa
một lượt đã được chấp nhận.

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

Không có report file riêng. Evidence bền nằm trong kho vốn sở hữu công việc: design run ở session dưới
`<Source>/.worktrees/<project>/sessions/`, bind theo hash; repair ở commit và diff; lượt chỉ đọc không ghi
file trừ khi được yêu cầu rõ.

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
5. Một session có một record append-only; hash accepted không sửa tại chỗ.
6. Execute chỉ chạy khi mọi hash reachable đã accepted.
7. Baseline lấy sau `OK` và trước production write đầu tiên.
8. Path ngoài boundary đã trình trở lại thành mục `NEED APPROVALS` mới.
9. Việc chia an toàn được thì nhắm mười assignment không chồng lấn; một coordinator giữ gate shared-state.
   Runtime dưới mười slot thì lấp đầy và backfill mọi slot khả dụng.
10. Đầu ra cho người dùng không có bảng trạng thái.
11. Resolve `defaultLang` từ workspace config chung của Source trước phản hồi đầu tiên cho người dùng.

## Ngoại lệ

- **Năng lực chỉ đọc.** Nó không biến measurement thành repair; nó báo evidence và owner của repair
  request riêng.
- **Session được tiếp tục.** Layout được phép **tiếp** thay vì **mở**. Session id và mọi hash đã chấp
  nhận sống sót qua lần tiếp đó, không đổi.

## Ví dụ đã giải

**Lượt chạy.** "Thiết kế trang kết quả bài luyện coding."

Lượt chạy nói: `Em đang thiết kế example-app trên route frontend đã verify; hành động này chỉ ghi design
session.` Nó trình 3–4 layout có direction cùng một default dưới `NEED APPROVALS`. Sau `OK`, nó bind hash
và làm hết mọi mục `own` của Layout mà không hỏi lại. Block vẫn là capability request riêng.

## Phạm vi

Mô-đun này quyết định **hình dạng mà mọi skill báo cáo theo**. Nó không quyết định một layout được
chứa gì, class nào là đúng, hay repository nào được đọc — ba chuyện đó thuộc mô-đun brainstorm,
compiler và context.
