# SUPERVISOR — giám sát 3 workflows StarCi (pin 1.0.3)

## 2026-09-17 ~20:20 — báo cáo #1 (mở ca)

### Sự cố chính đã xử lý: `agentos-business-design-20260915-r4`

Khi vào ca, supervisor (pid 2824) đang **restart kernel vô hạn**: cứ ~50s mở một
coordinator terminal, kernel chết ngay, terminal bị đóng vì stale, lặp lại — đã
tới round 62. Kernel không ghi được gì ra terminal nên log supervisor chỉ thấy
`kernel-started-in-coordinator` → `stale-kernel-terminals-closed`.

Chạy tay `workflow-run` để bắt output, lộ ra chuỗi 3 lỗi kernel nối nhau. Cả 3
đều là `.claude`, đã vá trên branch `starci183/claude-supervisor`:

1. `76f5d2df` — **lease-identity-drift** (đã có sẵn trong 1.0.3, chỉ cần lên pin).
   Workflow còn nằm ở pin 1.0.1 `9d04bd39`, bản đó đòi `op.lease.generation ===
   state.engine.generation`; writer reservation giữ qua retry cố ý đi trước
   generation nên boundary từ chối resume vĩnh viễn.
2. `76f5d2df` — **retry boundary chặt hơn settlement nó gọi**.
   `reconcileStoppedNativeRetryLease` đòi `observation.exactWorker === true`,
   nhưng khi process incarnation đã mất, Orca trả `missing` và cờ đó không bao
   giờ true lại được. `settleDispatch` thì đã chấp nhận hình dạng này
   (completed + capability-revoked + settled + tab chỉ còn là residue). Gộp về
   một helper chung `completedWorkerResidue`.
3. `bff5166a` — **sealed packet không tự chứng minh được cho replay của chính nó**.
   `sealCandidate` xử mọi replay bằng `allowedWrites` tính lại từ canonical tree
   tại thời điểm đó; cây đã sạch trở lại nên list rỗng, và seal từ chối chính
   delta nó đã seal. Nay packet bất biến cho phép đúng các path nó ghi.
4. `d5c5bf70` — **sealed candidate mất delta canonical thì bị abandon, không fence mãi**.
   Attempt seal xong rồi worktree bị wipe về bytes đã accept → `canonical-drift`
   + `canonical-delta-missing` mỗi path; không luật nào nhận nên writer fence giữ
   mãi. Cùng verdict với 2 luật bên cạnh, chỉ khác là tới từ packet đã seal.
   Kèm theo: nêu luôn reasons của freeze trong lỗi retry (trước chỉ nói "could
   not be sealed", phải đọc candidate control root mới biết path nào).

Test: `workflow-kernel` 154/154, `engine-*` + `candidate-*` + kernel = 252/252.
`tests/orca-calls.spec.mjs` fail vì worktree này **không có `node_modules`**
(thiếu `ajv`) — lỗi có sẵn, không liên quan. Theo lệnh owner ("chạy partial test
thôi, push main mới chạy full") nên chưa chạy `npm test` đầy đủ.

Pin 1.0.3 mới: `fd458453142b5ee8fb8754cef98a76028b380b4841edadbe7a7697a841f2f4be`
(đã lưu vào `C:/Users/Hi/AppData/Local/Temp/pin-1.0.3.json`).

**Kết quả: retry OK, generation 31, kernel=alive, vòng lặp restart đã dứt.**
`run-rebound` → `run-resumed` → `ledger-loaded valid:true (795 nodes)` →
`preflight ok`.

### Trạng thái 3 workflows

| workflow | phase | kernel | pin | ops |
|---|---|---|---|---|
| `agentos-business-design-20260915-r4` | run, gen 31 | **alive** | `fd458453` (mới) | 0 running / 2 waiting / 10 blocked / 0 done |
| `nivo-be-architecture-refactor-20260916` | run, gen 19 | alive | `edd5d213` | 1 running / 3 waiting / 6 blocked / 2 done |
| `nivo-fe-architecture-refactor-20260916` | **finished=blocked**, gen 18 | dead | `edd5d213` | 0 running / 5 waiting / 13 blocked / 3 done |

### Op đang chạy / bị chặn

**business-design** — `login-intake` ready, `ask-3` chờ resource
`canonical-writer:3eb663d9` (đang bị ask-1/ask-2 giữ). `ask-1`/`ask-2` blocked
`native-stop-reconciliation`, `ask-4` blocked `candidate-quarantine`. 7 op
`*-intake` blocked theo dây chuyền vì phụ thuộc ask-1..ask-4.

**be-refactor** — `instance_chatbot05` đang chạy trên `codex-agent
(gpt-5.6-luna)`. `instance_control07` chờ launch-cooling; `instance_access08`,
`inbound_doors09` chờ codex hết cooling (tới 11:49:19Z) — không runtime nào khác
có role implement. Blocked: `instance_db01`, `instance_knowledge02`,
`instance_accounting03` (`candidate-root-binding`); `instance_sales04`,
`module_runtime06` (`native-stop-reconciliation`, lease held — **đúng lớp lỗi
vừa vá**); `integration10`.

**fe-refactor** — finished với lý do "no runtime accepted an operation".
`shared-1` blocked `protected-proof`: *protected oracle `source:oracle-189` is
inconclusive: base failed without a declared expected failure signature* — tức
oracle đỏ ngay ở base, kernel không phân biệt được candidate sửa hay oracle hỏng.
Nó đang giữ `canonical-writer` mà `fe-public-landing` cần. `draw-1` (`interface.draw`)
không có runtime nào mang role `write`.

### Việc vừa làm

- Vá 4 lỗi kernel, commit trên `starci183/claude-supervisor` (chưa push).
- Build + seal pin 1.0.3 mới `fd458453`.
- `workflow-retry` business-design → thành công, kernel sống lại.

### Việc kế tiếp

1. Theo dõi business-design tiến triển trên gen 31; ask-1/ask-2/ask-4 vẫn giữ
   lease, xem kernel có tự reconcile được trên pin mới không.
2. FE: điều tra `oracle-189` (base đỏ) trong worktree FE, và chuyện `draw-1`
   không có runtime `interface.draw`; sau đó re-admit workflow.
3. BE: đợi `instance_chatbot05` xong rồi `workflow-stop` + `workflow-retry`
   lên pin `fd458453` để gỡ 2 op `native-stop-reconciliation` — không cắt ngang
   khi đang có worker chạy.
