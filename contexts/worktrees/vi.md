# Worktree và session

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@schema` | `contexts/worktrees/schema.json` | file | kiểm tra Git worktree bền vững và session root dùng xong bỏ |

## Record

Module này tách authority bền vững có branch khỏi state dùng trong một invocation. Business truth và quality debt đã chấp nhận sống trên remote branch. Design candidate, preview, browser profile, generated index và run manifest hết hiệu lực cùng session.

## Law

`.worktrees` chỉ chứa local mount của durable Git branch. Mount có thể dựng lại nhưng nội dung branch là authority tái sử dụng được. `.sessions/<project>/<session-id>` chứa invocation artifact đã ignore mà session khác không dùng làm authority. Generated machine state không thuộc một session nằm dưới `.workspaces/local`, không nằm trong `.worktrees`.

## Situation codes

| Code | Situation | Nơi lưu |
|---|---|---|
| `WORKTREE-1` | Product truth có evidence phải sống lâu | `.worktrees/<project>/businesses` trên `codex/businesses/<project>` |
| `WORKTREE-2` | Draft, preview, browser profile hoặc review pack phục vụ một invocation | `.sessions/<project>/<session-id>`, ignored |
| `WORKTREE-3` | State thiếu project/session segment hoặc đi vào `.claude` | từ chối |
| `WORKTREE-4` | Durable linked worktree là foreign, dirty, thiếu lock bắt buộc hoặc sai branch | từ chối |
| `WORKTREE-5` | Parallel writer overlap một target | isolate hoặc chạy tuần tự |
| `WORKTREE-6` | Linked worktree mount stale hoặc prunable | prune có chủ đích qua Git |
| `WORKTREE-7` | Frontend design được review trước implementation | giữ pack trong session hiện tại và execute trước khi invocation kết thúc |
| `WORKTREE-8` | Product truth phục vụ FE, BE và design | stable feature head trong `businesses` |
| `WORKTREE-9` | Quality debt đã chấp nhận phải sống lâu và được repay | `.worktrees/<project>/debts` trên `quality-debts/<project>` |

## Reading a run

1. Phân loại từng output thành durable authority, generated machine state hoặc disposable session state.
2. Bắt buộc `.worktrees/<project>/{businesses,debts}` cho durable linked worktree.
3. Bắt buộc `.sessions/<project>/<session-id>` cho invocation artifact.
4. Chỉ verify Git ownership, branch, cleanliness và lock cho durable linked worktree.
5. Giữ design material dưới `.sessions/<project>/<session-id>/design`.
6. Không resume product hay design authority từ file của session khác.
7. Prune stale linked mount qua Git; không xóa tay linked worktree directory.

## `WORKTREE-1` — business truth bền vững

Business decision không thể tái tạo chỉ từ code nên remote branch vẫn durable và review được. Local linked mount có thể dựng lại.

## `WORKTREE-2` — session state dùng xong bỏ

Candidate, screenshot, browser profile, render output và selected-design metadata có thể dựng lại từ durable authority cùng source. Chúng vẫn là ignored session artifact dù tạo ra tốn công.

## `WORKTREE-3` — state path không hợp lệ

Session state thiếu project và session identity có thể trộn lượt chạy. State dưới `.claude` làm bẩn trust tree. Cả hai bị từ chối.

## `WORKTREE-4` — durable worktree foreign hoặc invalid

Business và debt branch phải thuộc Source này và mount trên đúng branch đã khai. Lock bắt buộc cùng clean state phải giữ trước authority write.

## `WORKTREE-5` — parallel writes

Parallel reader và writer rời nhau không cần isolation thêm. Writer overlap chạy tuần tự hoặc trong target worktree riêng.

## `WORKTREE-6` — linked worktree stale

Prune qua Git sau khi chứng minh exact target. Bỏ local mount không xóa durable remote branch.

## `WORKTREE-7` — design và execute cùng session

Design candidate không có durable head. Approval cho phép selected candidate cùng exact source boundary một lần; chính invocation đó implement và prove.

## `WORKTREE-8` — product truth

Business feature head vẫn durable vì mọi role phải dùng chung actor, flow, rule, state và outcome.

## `WORKTREE-9` — debt đã chấp nhận

Debt record vẫn durable vì delivery và repayment dùng chung baseline, expiry cùng exit criteria đã duyệt. Local mount có thể dựng lại; remote branch mới là record.

## Inputs

| Input | Evidence required |
|---|---|
| project | project được khai rõ |
| source | Source sở hữu trust và local state |
| businesses | linked worktree đúng owner |
| debts | linked worktree đúng owner |
| session | một invocation identity cùng ignored root |
| target source | source boundary đã duyệt khi có implementation |

## Rules

1. Business truth và accepted debt là durable branch-backed authority.
2. Session artifact dùng xong bỏ và không bao giờ là authority giữa các session.
3. `.worktrees` không chứa cache hay session directory.
4. `.sessions` không chứa durable authority.
5. `.claude` không lưu runtime state.
6. Isolation theo collision ghi thật.
7. Frontend source cùng executable proof là accepted design outcome bền vững.

## Exceptions

- Session đã hoàn tất có thể còn để debug local nhưng vẫn ignored và không có authority.
- Conversation provenance có thể dùng durable branch đã khai; derivative đã decrypt/search vẫn là session hoặc generated local state.

## Output

```text
output: <business authority | debt authority | session artifact | source implementation>
durability: <durable branch | generated local | session | product source>
path: <business worktree | debt worktree | session root | routed frontend>
reason: <fact quyết định placement>
```
