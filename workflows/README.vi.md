# Workflow

Một workflow là một chuỗi operator ghép sẵn: danh sách **bậc** theo thứ tự, mỗi bậc là danh sách
**nhánh** chạy song song (tối đa ba), kèm **vòng lặp** quay về một bậc trước và **preset** cho Yêu cầu
của từng nhánh. Các file ở đây là tham chiếu, không phải toàn bộ số chuỗi có thể có: chúng là những
hình dạng lặp lại đủ nhiều để đáng ghi xuống, và một nhiệm vụ có bài toán nghiệp vụ khó hơn mọi ví dụ
thì tự ghép chuỗi của mình theo cùng bộ luật, thay vì nhét mình vào ví dụ gần nhất.

Cửa vào dùng chúng như sau:

1. Đọc `when` của mọi ví dụ. Request khớp trọn ví dụ nào thì chạy chuỗi đó; preset điền vào
   `request.json`, người chỉ bị hỏi những field không có mặc định.
2. Khớp một phần, hoặc bài toán nghiệp vụ khó hơn mọi `when` mô tả, thì tự ghép chuỗi thay vì bẻ một
   ví dụ gần đúng cho vừa: nghĩ ra nó từ bảng `## Next` của các operator và `routing.json`, theo
   đúng luật mà `scripts/validate-workflows.mjs` ép lên các file này:
   - mỗi nhánh gọi tên một operator có thật và chỉ preset field mà operator đó khai;
   - mọi field Requirements không có Default thì hoặc được preset, hoặc nằm trong `asks` của nhánh, để
     chuỗi nói trước những field nào cửa vào phải lấy từ phạm vi nhiệm vụ hay hỏi người trước khi nhánh
     đó chạy;
   - mọi Input bắt buộc của một nhánh phải do một bậc trước sinh ra;
   - các nhánh cùng bậc không chung alias ghi (hai operator không được cùng ghi một checkout hay một
     root; `frontend.surface.audit` toả theo entry của matrix vì nó không ghi gì);
   - vòng lặp quay về bậc trước và mang `maxRounds`;
   - chuỗi nào ghi source frontend dưới `mode: apply` thì chạy `frontend.surface.audit` và
     `uat.verify` giữa lần ghi đó và `git.publish` của nó — luật dòng dài bên dưới;
   - chuỗi kết thúc ở `git.publish`, `release.deploy` hoặc `user`.
3. Chuỗi tự ghép mà còn dùng lại được thì thành một file mới ở đây, kèm `when`.

## Mọi ví dụ đều là một dòng dài

Chuỗi ghi một bề mặt không kết thúc khi source biên dịch được. Giữa lần ghi và lần publish có hai
bằng chứng mà không thứ gì khác trong cây cấp được: `frontend.surface.audit` render bề mặt và giữ lại
ảnh chụp, còn `uat.verify` đi hành trình của một người thật xuyên qua nó. `quality.verify` nằm giữa
hai cái đó và trả lời một câu hỏi khác — build, lint, type, coverage — và cổng xanh chưa bao giờ nhận
ra một trang đọc lên thấy sai. Nên mọi ví dụ có apply source frontend đều kết thúc như nhau:

```text
frontend.source.apply → workspace.bind (role fe, runtimeNeed consume) → frontend.surface.audit → quality.verify → uat.verify → git.publish
```

`workspace.bind` lần hai có ở đó vì head đã dịch: bề mặt cần được phục vụ, audit và đi thử là bề mặt
mà lần ghi vừa sinh ra, không phải bề mặt đã bind trước đó. `uat.verify` cần `feature`, `flow` và
`approval` trước khi chạy — luồng cần đi qua và thẩm quyền cho việc ghi của chính nó, lấy từ khai báo
của môi trường và chỉ hỏi một con người khi khai báo đó đánh dấu lớp bị chạm là `person` — nên mọi
chuỗi mang nó đều khai chúng dưới `asks`, và lần chạy thà từ chối chứ không bịa ra thẩm quyền.

`staging-uat` là ví dụ duy nhất chứng minh một bản giao ở nơi khác nơi nó được viết. Nó không ghi gì —
`frontend.source.apply` chạy dưới `mode: dry`, nên luật chuỗi dài không với tới — và nó mang `env` trên
lượt audit và lượt chạy, thứ chọn ra entry trong sổ đăng ký runtime, file tài khoản và bản tham chiếu đã
duyệt của stack ấy. Nó kết thúc ở `user`, vì hai biên nhận trong tay một con người mới là kết quả; đưa
lên một môi trường là việc của `release` và ở lại đó.

`backend-feature` là chuỗi giao hàng duy nhất không có hai bằng chứng ấy, và `when` của nó nói rõ vì
sao: nó không ghi bề mặt nào, `uat.verify` cần đầu vào `frontend-surface-audit` và một route fe đã
bind, ở đó không có cái nào. Một feature backend mà lời hứa chạm tới người qua màn hình thì thuộc về
`full-feature`, nơi hành trình được đi trước khi publish. `release` và `content-unit` không ghi source
frontend và không publish ranh giới nào, nên luật này không với tới chúng.

Mọi nhánh ghi source đều commit trên `session/<sessionId>`; `git.publish` merge nó, và từ chối một
nhánh phiên mà phiên của nó không có biên nhận source-application lẫn ảnh chụp audit
(`SESSION_MISSING`). Nhánh bị chặn vào lại thành bậc mới; vòng lặp tính vào `maxRounds` của chính
operator.

| Workflow | Khi | Các bậc | Song song | Kết thúc |
| --- | --- | --- | --- | --- |
| `frontend-new-surface` | bề mặt chưa tồn tại (`new`) | bind ×2 → business → direction → resolve → apply → bind (consume) → audit → quality → uat → publish | audit theo matrix | `git.publish` |
| `frontend-reconstruct` | dựng lại bề mặt đã có, giữ fact nghiệp vụ | bind ×2 → direction → resolve → apply → bind (consume) → audit → quality → uat → publish | audit theo matrix | `git.publish` |
| `frontend-refine` | sửa bên trong cấu trúc đã duyệt | bind ×2 → direction → resolve → apply → bind (consume) → audit → quality → uat → publish | audit theo matrix | `git.publish` |
| `backend-feature` | một contract backend cho một feature, không có bề mặt | bind → business (model) → architecture → backend apply → quality → business (reconcile) → publish | — | `git.publish` |
| `full-feature` | backend và bề mặt frontend mới cùng lúc | bind ×2 → business → architecture → [backend apply ∥ direction] → [quality ∥ resolve] → apply → bind (consume) → audit → quality → uat → business (reconcile) → publish | hai bậc hai nhánh, audit theo matrix | `git.publish` |
| `frontend-with-uat` | thay đổi frontend mà người yêu cầu đích danh đi thử | bind ×2 → direction → resolve → apply → bind (consume) → audit → quality → uat → publish | audit theo matrix | `git.publish` |
| `staging-uat` | một bản giao đã publish phải được đi thử trên stack khác trước khi release | bind ×2 (consume) → direction → resolve → apply (dry) → audit (env staging) → quality → uat (env staging) | audit theo matrix | `user` |
| `release` | head đã publish phải lên production | bind → quality → release | — | `release.deploy` |
| `content-unit` | một đơn vị giáo trình từ đầu tới cuối | content.generate (có exchange review bên trong) | — | `user` |

Hình dạng file (`schemaVersion` 9): `id` bằng tên file; `when` có `en` và `vi`; `chain` là mảng bậc,
mỗi bậc là mảng
`{ operator, requirements?, asks?: [field], fanout?: "matrix", maxParallel?: 1..3 }`; `loops` là mảng
`{ from, to, when, maxRounds }`; `ends` là `user` hoặc một operator của bậc cuối.
