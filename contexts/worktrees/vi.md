# Worktree

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `contexts/worktrees/schema.json` | file | kiểm tra cache theo project và business root bền vững |

## Record

Module này quyết định state của một lượt chạy nằm ở đâu. Product truth phải tồn tại lâu được version trong business worktree của project. Candidate thiết kế, authored preview, review manifest và composition được chọn chỉ là cache trong phiên. Kết quả sản phẩm chỉ trở thành bền vững khi chính skill invocation đó ghi và chứng minh frontend source.

## Law

State được đặt theo thứ cần sống lâu. Business truth có evidence nằm trên branch riêng. Design và review có thể dựng lại nằm dưới project cache và không trở thành product authority thứ hai. Skill thiết kế đã xin owner chọn candidate phải triển khai lựa chọn đó trong cùng invocation; task khác không được tiếp tục từ design cache.

Project segment là bắt buộc. `.claude` là trust tree, không phải runtime storage. Target repository chỉ nhận product source sau khi exact write boundary được duyệt; bookkeeping của lượt chạy không đi vào đó.

## Situation codes

| Code | Situation | Nơi lưu |
|---|---|---|
| `WORKTREE-1` | Product truth có evidence phải sống lâu và review được | `<Source>/.worktrees/<project>/businesses`, linked worktree khóa trên `codex/businesses/<project>` |
| `WORKTREE-2` | Draft, candidate, preview, review manifest hoặc selected design đang chờ execute cùng phiên | `<Source>/.worktrees/<project>/cache`, ignored |
| `WORKTREE-3` | Path thiếu project segment hoặc nằm dưới `.claude` | từ chối |
| `WORKTREE-4` | Business worktree bền vững là foreign, unlocked, dirty hoặc sai branch | từ chối |
| `WORKTREE-5` | Các agent song song sẽ sửa cùng file hoặc cùng source boundary | isolate hoặc chạy tuần tự |
| `WORKTREE-6` | Linked worktree stale hoặc prunable | prune có chủ đích qua Git |
| `WORKTREE-7` | Frontend design được review trước implementation | giữ session pack đầy đủ trong cache và execute candidate đã chọn trước khi invocation kết thúc |
| `WORKTREE-8` | Product truth phải phục vụ FE, BE và design | stable `featureId` heads trong `businesses` |

## Reading a run

1. Gọi tên từng output và việc task khác có phải đọc nó không. Business truth là durable; design-review material là rebuildable và session-local.
2. Bắt buộc `.worktrees/<project>/` trước mọi state path.
3. Chỉ kiểm tra Git ownership cho business worktree bền vững.
4. Isolate collision file thật, không isolate chỉ vì có nhiều agent.
5. Giữ candidate dưới `cache/design/<session-id>/`. Pack có thể chứa artifact, `preview.html`, preview index, screenshot và `review-manifest.json`.
6. Sau owner approval, chỉ giữ selected pack đủ lâu để implement và prove source trong cùng invocation. Source history, test và browser proof là record bền vững.
7. Không tạo layout head, block head, immutable design revision hoặc design-registry branch.

## `WORKTREE-1` — business truth bền vững

Business feature decision không thể tái tạo chỉ từ code nên vẫn được version dưới `businesses`. Situation này không cho phép design registry hay accepted-preview store.

## `WORKTREE-2` — session state có thể dựng lại

Candidate, render output, screenshot, index và selected design metadata có thể dựng lại từ business authority, grammar, contract và source. Chúng luôn là ignored cache dù tạo ra tốn công.

## `WORKTREE-3` — state path không hợp lệ

State thiếu project segment có thể trộn project. State dưới `.claude` làm bẩn trust tree. Cả hai bị từ chối.

## `WORKTREE-4` — durable worktree foreign hoặc invalid

Chỉ business authority cần linked durable worktree. Nó phải thuộc Source này, locked, clean và ở đúng project branch.

## `WORKTREE-5` — parallel writes

Parallel reader và writer có path rời nhau không cần isolation thêm. Agent sửa cùng source file hoặc authority file chạy tuần tự hoặc ở target worktree riêng.

## `WORKTREE-6` — linked worktree stale

Prune qua Git sau khi chứng minh exact target. Không xóa tay thư mục linked worktree.

## `WORKTREE-7` — design và execute cùng phiên

Design candidate không có durable head. Review pack bind task hiện tại, routed source baseline, business head, grammar/profile receipt, contract evidence, candidate key, UI-condition inventory, transition và viewport proof. Approval cho phép selected candidate và exact source boundary một lần. Cùng invocation đó implement, test và visual proof. Nếu execution không thể tiếp tục, task sau dựng lại từ current authority thay vì coi cache là accepted truth.

## `WORKTREE-8` — product truth

Business feature head vẫn durable vì FE, BE và design phải dùng chung actor, flow, rule, state và outcome. Design choice không đi vào registry đó.

## Inputs

| Input | Evidence required |
|---|---|
| project | project do owner khai báo |
| source | Source repository sở hữu trust và local state |
| business root | project business worktree thuộc Git, locked và clean |
| cache root | project cache path được ignore |
| design session | một invocation identity và routed source baseline |
| target source | exact frontend write boundary đã duyệt |

## Rules

1. Business truth là durable; design-review material là cache.
2. Design approval và source execution xảy ra trong cùng skill invocation.
3. Không task nào dùng design cache của task khác làm authority.
4. Project segment là bắt buộc.
5. `.claude` không lưu runtime state.
6. Business worktree bền vững phải thuộc Source, locked và clean.
7. Isolation theo collision ghi thật.
8. Linked worktree stale được prune qua Git.
9. Frontend source cùng executable proof là accepted design outcome bền vững.
10. Không tạo design registry, layout head, block head hoặc immutable preview revision.

## Exceptions

- Cache pack có thể còn sau completion để debug local, nhưng vẫn ignored và không có authority.
- Conversation provenance và business authority có thể dùng durable store riêng được route rõ; chúng không phải design registry.
- Request design-only cấm implementation có thể render candidate, nhưng kết quả hết hiệu lực cùng invocation và không được gọi là accepted authority.

## Output

```text
output: <business authority | design session | source implementation>
durability: <durable | rebuildable | product source>
path: <business worktree | project cache | routed frontend>
session: <same invocation identity khi có design>
reason: <fact quyết định placement>
```
