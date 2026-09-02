# Context cho `platform.operate`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để vận hành một dịch vụ dùng chung. Nó trả lời câu "operator
này được đọc những gì?" trước khi bất cứ thứ gì bị đụng tới. Context không bao giờ nới rộng phạm vi
nhiệm vụ và không bao giờ biến bằng chứng thành thẩm quyền.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Knowledge index | Danh mục platform và khuôn record mà mọi loại dịch vụ phải theo. | Bắt buộc. Nêu record nào được phép bind. |
| Knowledge record | Một loại dịch vụ, phần chứng minh nó đòi hỏi, và ranh giới nó từ chối. | Luật tái dùng bắt buộc. |
| Authority | Phê duyệt, plan hash mà nó phê duyệt, và các lớp effect nó cho phép. | Bắt buộc. Nguồn duy nhất của quyền thay đổi. |
| Capability | Một handle mờ kèm bằng chứng custody cho một credential. | Bắt buộc để dùng. Không bao giờ là giá trị, không bao giờ là bản ghi lâu dài. |
| Inventory | Dịch vụ dùng chung hiện đang là gì: resource, revision, chủ sở hữu, và ai đang giữ cổng nào. | Bằng chứng bắt buộc. Là tập resource duy nhất được phép đụng tới. |
| Workspace source | Checkout đã route và head của nó. | Bằng chứng rằng plan thuộc về source đã đóng băng. |
| Owner audit | Các lần vận hành trước trên cùng dịch vụ. | Bằng chứng và lịch sử hồi quy. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. knowledge index cùng record của đúng loại dịch vụ đang vận hành;
2. một phê duyệt ràng cùng plan hash mà desired state mang;
3. mọi capability mà loại dịch vụ đó cần, mỗi cái là một handle kèm bằng chứng custody;
4. một inventory của dịch vụ dùng chung, có fingerprint, liệt kê mọi resource mà plan gọi tên;
5. tham chiếu workspace source đã route, với head bằng đúng `input.project.sourceHead`.

## Ref

| Alias | Trỏ tới | Bind | Bắt buộc |
| --- | --- | --- | --- |
| `@runtime` | `<Source>/.worktrees/sessions/central-runtime/owner.json` | fingerprint + generation | Bắt buộc: The shared runtime owner: inventory, generation, health. |
| `@ports/<project>` | `<Source>/.workspaces/ports/<project>.json` | fingerprint | Bắt buộc: Port projection the runtime binds to. |
| `@identity` | `<Source>/.workspaces/device-state.json` | fingerprint; the sealed keys under &lt;Source&gt;/.workspaces/local/credentials/*.key.enc are bound by name and never read | Bắt buộc: Credential handles by name; values never appear. |
| `@declaration/<project>/<role>` | `<Source>/.workspaces/projects/<project>/<role>.json` | fingerprint | Tuỳ chọn: Which projects the shared services serve. |
| `@artifacts` | `input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/` | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Bắt buộc: Where the operation receipt is written. |

## Chỉ hạ tầng dùng chung

Operator này phục vụ hạ tầng dùng chung. Nó không deploy product. Ranh giới đó không phải lời khuyên:
một resource chỉ có thể bị thay đổi khi inventory được bind có liệt kê nó dưới đúng loại dịch vụ, và
một đích deploy product thì không bao giờ là resource observability, Sonar hay tunnel. Plan nào với
tới một thứ như vậy là input không hợp lệ, chứ không phải chuyện cân nhắc lúc thực thi.

## Kiểm kê trước khi đổi

Một dịch vụ dùng chung phải được kiểm kê trước khi bị thay đổi. Inventory bị ràng bằng fingerprint,
nên receipt nói được chính xác dịch vụ đang là gì tại thời điểm ra quyết định, và một revision chạy
song song hiện ra thành drift thay vì bị ghi đè lặng lẽ.

`context.inventory.portHolders` ghi tiến trình nào đang giữ cổng nào, kèm bằng chứng. Danh sách đó
tồn tại để một xung đột cổng luôn có tên người giữ đi kèm.

## Credential

Một capability là handle cùng bằng chứng custody của nó. Credential đứng sau được resolve để dùng và
không bao giờ bị log, lặp lại hay lưu lại. Input contract từ chối mọi chuỗi mang vật liệu credential,
còn output contract từ chối cả cái handle, vì receipt là bản ghi lâu dài mà con người đọc.

## Ranh giới

Context chỉ để đọc. Operator ghi phần delta effect đã duyệt lên dịch vụ đã kiểm kê, cùng receipt có
kiểu dưới `input.project.artifactRootRef`. Nó không sửa knowledge, không tự cấp phê duyệt cho mình,
không deploy product, và không giải phóng một cổng bằng cách dừng tiến trình đang giữ cổng đó.

## Tài nguyên

Operator này chạy trọn trên profile `opus` (`claude-opus-5`, runtime `claude`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: ghi source. Nó không bao giờ tìm trên mạng, không ràng với Grammar, và không sinh hình. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
