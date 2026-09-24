# Thử nghiệm: review giao cho tay chân (Devin/Qwen) — 2026-09-25

- Loại: **thử nghiệm routing**, không phải kết luận từ số đo. Owner quyết định trước, đo sau.
- Sửa đổi: `benchmark/findings/2026-09-25.md` (quyết định routing-by-evidence, commit f17e62112)
- Hợp đồng: contract change `routing-review-hands` trong `modules/kernel/contract-changes.yaml` (reach new-legs)
- Mốc so sánh: `benchmark/snapshots/2026-09-25-72h.json` (trước thay đổi)
- Theo dõi: snapshot 48h sau khi land, xem mục "Đo lại"

## Quyết định của owner

Nguyên văn (2026-09-25): "chia bớt cho devin qwen cái này, codex/claude chỉ là quyết định thôi (tức là đưa ra
chiến lược), review thì phải cho tay chân làm là ok nhất! cứ thử mảng cho devin/qwen, ghi benchmark sai sửa sau".

Nội dung:

1. **Claude (Opus 5.5) và Codex (GPT-6 Sol) chỉ làm chiến lược.** Họ giữ request.analyze, scope.define,
   business.decide, architecture.decide, goal/business/architecture revise, brand.decide, decision.prepare,
   provision.ask, implementation.plan (quyết định cắt việc), workspace.manage, task.execute, knowledge.repair và
   các lệnh model riêng của kernel. interface.draw và interface.asset vẫn chỉ Codex (công cụ vẽ ảnh).
2. **Review giao cho tay chân (Devin, Qwen).** Thứ tự mới `review` gồm mọi kind verify (review.verify,
   handover.review, security.verify, goal.validate, uat.assisted.verify, interface.audit, e2e.verify,
   integration.verify, perf.verify, uat.verify) và work.author. work.author đổi role từ `plan` sang `write`
   (nó viết bản ghi Work); phần cắt việc vẫn là implementation.plan, ở lại với Claude/Codex.
3. **Chéo họ (cross-family).** Người review khác họ với người làm: Qwen review việc Devin làm, Devin review việc
   Qwen làm. Khi không biết ai làm (ví dụ handover.review đọc cả workflow), Devin đứng trước ở medium/hard; ở easy
   và insane Qwen đứng trước vì Devin không có model ở hai mức đó.
4. **Claude và Codex chỉ là dự phòng (overflow)** trong thứ tự review. Họ chỉ nhận khi cả Devin và Qwen đều không
   dùng được (circuit mở, quota chết, đầy slot), hoặc khi luật chéo họ loại người còn lại. Tỉ trọng balanced và
   `--prefer` không đẩy họ lên trước (`runtimes.yaml allocation.overflowByOrder.review`).
5. Tỉ trọng giữ nguyên: **devin 35 / qwen 35 / claude 20 / codex 10**, cùng luật first-under-share của f17e62112.

Hai điểm cần owner biết:

- **interface.audit cũng chuyển sang tay chân.** Kind này cần công cụ `browser-dom`. Devin có công cụ đó, Qwen
  thì không (card qwen không khai báo), nên điều kiện "giữ chuỗi cũ nếu cả hai đều thiếu" không xảy ra. Hệ quả:
  - UI do Qwen làm: Devin audit.
  - UI do Devin làm: luật chéo họ loại Devin, Qwen và Claude thiếu công cụ, nên **Codex audit** (dự phòng).
  - Không rõ ai làm: Devin audit.

  Số mốc của interface.audit rất thấp ở cả hai: Devin 11% pass, 83% fail (18 job); Codex 6% pass, 67% blocked
  (18 job).
- **Luật chéo họ thắng thứ tự thô.** Nếu Devin làm mà Qwen không dùng được, review sang Claude/Codex (dự phòng)
  chứ không để Devin tự review. Devin chỉ tự review việc của mình khi mọi họ khác đều không dùng được, và route
  ghi rõ `crossFamily.applied: false`.

## Giả thuyết

- **H1.** Devin/Qwen review đủ tốt: tỉ lệ pass của review theo pool không thấp hơn mốc Claude/Codex quá 10 điểm.
- **H2.** Review của tay chân không cho lọt lỗi nhiều hơn: tỉ lệ false-pass (review pass nhưng gate sau hoặc owner
  bác) không cao hơn mốc.
- **H3.** Chéo họ bắt được lỗi mà tự review bỏ qua: review khác họ fail nhiều hơn review cùng họ trên cùng kind.
- **H4.** Claude/Codex rảnh cho chiến lược: tỉ trọng think/decide của Claude và Codex tăng. Thời gian chờ của
  các kind decide giảm.
- **H5.** Thời gian không xấu đi: median review của Devin/Qwen không dài hơn mốc quá 2 lần. Mốc: Devin 15–23m và
  Qwen 30m trên việc verify, so với Claude 4–8m và Codex 8–13m.

## Mốc trước thay đổi (72h đến 2026-09-25)

| Kind | Pool | Jobs | Pass | Fail | Blocked | Median |
|---|---|---:|---:|---:|---:|---:|
| review.verify | codex | 15 | 27% | 53% | 20% | 8m |
| review.verify | claude | 4 | 50% | 25% | 25% | 5m |
| handover.review | claude | 7 | 43% | 0% | 57% | 4m |
| work.author | claude | 37 | 73% | 19% | 8% | 8m |
| work.author | codex | 20 | 45% | 30% | 25% | 11m |
| work.author | qwen | 2 | 100% | 0% | 0% | 12m |
| interface.audit | devin | 18 | 11% | 83% | 6% | 15m |
| interface.audit | codex | 18 | 6% | 28% | 67% | 13m |
| integration.verify | devin | 4 | 50% | 50% | 0% | 23m |
| integration.verify | qwen | 3 | 33% | 67% | 0% | 30m |

Số job review trong mốc rất ít (review.verify 19, handover.review 7). Đừng kết luận từ một hai điểm phần trăm.
work.author là rủi ro lớn nhất: Claude đạt 73% trên 37 job, trong khi tay chân gần như chưa có dữ liệu.

## Đo gì

1. **Tỉ lệ pass review theo pool.** Với mỗi kind trong thứ tự review, tính pass/fail/blocked theo pool (devin,
   qwen, và claude/codex khi dự phòng), lấy từ `model-scorecard` trong snapshot.
2. **Tỉ lệ false-pass.** Một review pass bị tính là false-pass khi sau đó cùng node hoặc cùng workflow bị bác bởi:
   - một gate sau: interface.audit, e2e/integration verify, push-gate hoặc scoped-lint fail trên cùng records;
   - owner: handover.review nhận `feedback`, hoặc owner mở lại việc.

   Snapshot chưa tự tính số này. Lấy từ ledger chỉ đọc: một job verify `succeeded`, rồi một job sau của cùng
   workflow đọc chung records mà `failed` hoặc có handover feedback. Ghi số đếm và job id vào findings của lần
   đo lại.
3. **Chéo họ.** Đếm các route có `routeCrossFamily.applied` true/false, và pass/fail của từng nhóm.
4. **Dự phòng.** Đếm các review chạy trên claude/codex (routeOrder `review`, model claude-agent/codex-agent) và lý
   do (routeRejected của devin/qwen).
5. **Thời gian.** Median từ dispatch đến settle của review theo pool, so với bảng mốc.
6. **Tỉ trọng.** Phần dispatch của từng pool trong cửa sổ, so với 35/35/20/10.

## Đo lại

Sau khoảng 48h kể từ khi land, chạy từ thư mục runtime live:

```sh
node scripts/agent/benchmark-snapshot.mjs --since-hours 48
```

Sau đó viết findings mới, dẫn chiếu file này. Nếu H1 hoặc H2 sai, đặc biệt ở work.author và interface.audit, đề
xuất với owner đưa kind đó về thứ tự chiến lược (Claude, Codex) trong một lane riêng. Owner đã nói rõ: "sai sửa
sau".
