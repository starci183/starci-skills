# HANDOFF — StarCi Skills 2.1.4 → 2.2

Bàn giao ngày 2026-09-05, viết cho người chuẩn bị 2.2. Mọi sha dưới đây là sha đã push lên origin.

## Trạng thái lúc bàn giao

| Kho | main | Ghi chú |
| --- | --- | --- |
| `starci183/starci-skills` (`.claude`) | `355d1b73` | 2.1.4 + toàn bộ bằng chứng hôm nay; tag `v2.1.4`; npm `@starci/skills@2.1.4` là `latest` |
| `nivo-fe` | `e2f4968f` | Grammar 0.4.9; fix tầm với điện thoại ở Setup (UX-9); bump 0.4.12 đang publish bởi session `20260905-170300` |
| `nivo-backend` | `793eaad8` | control centre và operations trả lời workspace sở hữu chưa có instance; spec e2e recovery; lint toàn repo = 0 |
| `starci-academy-fe/packages/grammar` | `67680f8` | `@starci/grammar` 0.4.12: một claim thật mỗi node (frameless SurfaceCard, HorizontalScrollRegion), thang FONT của Heading lấy từ sheet của họ |

Runtime đang phục vụ: nivo/fe 3067 (head tích hợp 0.4.12 `a9758e09`), nivo/be 3068 (`9693eee1`, chứa `793eaad8`), Keycloak realm `nivo` 8147.

## Bằng chứng

- Note trong `tests/evidence/`: `20260905-nivo-setup-uat-on-2.1.2.md` (khối test tiếng Việt cho chủ ở cuối), `20260905-nivo-recovery-e2e-on-2.1.2.md`, `20260905-nivo-recovery-operations-fix-on-2.1.3.md`, `20260905-nivo-reachability-fix.md`, `20260905-nivo-backend-lint-baseline.md`, `20260905-nivo-be-publish-merge-on-moved-main.md`, `20260905-grammar-0.4.11-owner-publish-on-2.1.0.md`, `20260905-grammar-0.4.12-heading-sizes.md`.
- UAT (repo backend, track): `.worktrees/uat/agentos-modules/{module-setup,setup-reach,control-centre-unprovisioned}/` — `flow.md`, `accounts.dev.json` (không plaintext), `seed/`, `runs/<runId>/result.json`, `latest.json`, `history.md`, một ảnh mỗi case.
- E2E: `.worktrees/e2e/workspace-recovery/runs/20260905-082130-793eaad/` — 6/6 case hành trình recovery như một client của 3068.
- Chưa kiểm: `.worktrees/unchecked/nivo/agentos-module-setup.jsonl` (15 dòng: 11 màn phụ + 4 state), `agentos-workspace-recovery.jsonl` (lane e2e; mục "recovering → healthy với instance thay thế" còn mở vì dev không có target).
- Findings: `knowledge/findings/starci.jsonl`, `core.jsonl`.
- Kho mission của Astra: `.worktrees/banked/nivo-agentos` (17 mission, hình cũ `index.json + ORDER.md + workflows/<ID>/workflow.json`; nội dung validate được, chỉ cần đổi hình sang `queue.json + <id>/mission.json + mission.md`).

Tài khoản UAT: `uat-nivo-setup-042915` (Setup), `uat-workspace-recovery-owner-131026` và `…-stranger-131026` (recovery); mật khẩu chung `uat-shared` niêm phong ở `.stacks/dev/secrets/uat.enc`, chỉ giải theo tên, không bao giờ in.

## Lineage 2.1.x hôm nay (chi tiết ở INDEX.md › Lineage)

- 2.1.0: ngôn ngữ hiển thị trong `resources/settings.example.json` (override `settings.json` không track); một câu hỏi mỗi prompt mới rồi chạy mượt; publish tự động; profile chia theo việc (opus/sol-fresh sản xuất, fable/astra đọc và phán); `service.operate`, `api.verify`, nhà e2e `@worktrees/e2e`; `business-registry.mjs`; bốn nợ 2.0.4.
- 2.1.1: sổ chưa kiểm `@worktrees/unchecked` (tier `journey|secondary`, `UNCHECKED_UNLAWFUL`, `UNCHECKED_OPEN`, dòng scope trong khối goal). `@worktrees/debts` là khái niệm cũ (gate debt do chủ duyệt của `quality.verify`), giữ nguyên.
- 2.1.2: bảy lỗi runtime từ session reachability (sweep walk, host stop, `brief.proven`, taste kế thừa, TASTE-12 n/a, `uat.verify → quality.verify` cho route thứ hai).
- 2.1.3: tầng `helpers/` cạnh `operators/` (`validate-helper`, alias `helperWritable`, run record), helper đầu tiên `generate-banks`, kho `@worktrees/banked`, một lần duyệt kho = goal-confirm cho mọi mission trong kho.
- 2.1.4: bản phát hành trình bày consume bằng hai audit trước/sau; một nhánh cấp đủ alias; che mật khẩu trong DOM record; `scope` đếm mọi plan; `git.publish` giải conflict theo bốn luật dùng chung `scripts/merge-resolution.mjs`; route `bank` chạy kho; hot-fix audit về đúng nhà.

## Việc mở cho 2.2, theo thứ tự nên làm

1. **Chain nối tiếp sau `git.publish`.** Mission mở lại sau publish (consume 0.4.11 trong session `20260905-130417`) chỉ nằm trên đĩa, không vào ledger. Cần luật: sau publish vẫn được `replanned` dưới cùng goal, hoặc mission mới tự nhận branch cũ qua `bankRef`/`resume`.
2. **Bằng chứng sống cho ba luật mới của 2.1.4.** Consume dạng audit (session `20260905-170300` là ứng viên đầu tiên), `git.publish` tự giải conflict theo bốn luật, và một session mở từ kho `bank`. Bước đầu: chạy `/helper generate-banks nivo` trên 2.1.4 để kho của Astra về đúng hình, duyệt kho một lần, chạy mission đầu.
3. **Walk có hành động `reload` và `sign-out`.** Hai case `wrong-password-refused` (đã có che mật khẩu) và `reload-keeps-session` của flow `setup-reach` chưa chạy lại.
4. **Sổ chưa kiểm được tiêu thụ thật.** 15 mục Setup đang mở; mission kế chạm màn nào phải trả (tier `journey`) hoặc gia hạn có lý do; chặn thử `release.deploy` production một lần để chứng minh `UNCHECKED_OPEN`.
5. **Nhỏ nhưng nên đóng:** TASTE-12 cho refine có delta app-owned (điều kiện có lẽ là change level, không phải delta); `business.decide` dùng `scripts/business-registry.mjs`; `scheduled_tasks.lock` của Claude Code đang bị track (`git rm --cached` + ignore); `library.update` consume-by-audit cần một self-test với session thật.
6. **Recovery đi nốt bước cuối.** Cần môi trường có instance thay thế (hoặc Core giả lập có target) để chứng minh app chạy lại sau `recovered`; mục này đang mở trong sổ chưa kiểm lane e2e.

## Luật vận hành đã chốt (không đổi ở 2.2)

- Không bao giờ in, log hay lưu giá trị credential; sealed ref chỉ giải nơi tiêu thụ; `scripts/sweep-secrets.mjs` quét mọi thứ agent ghi.
- Không git phá hoại (reset --hard, force, stash, xóa nhánh của người khác), không `--no-verify`; publish qua hook của repo (nivo-backend cần `PINNED_AGENTOS_CHART_PATH=D:\Repositories\nivo-charts\charts\agentos` dạng backslash và `.gitmounts/data` trong checkout).
- Mỗi prompt mới hỏi đúng một câu (khối goal, kèm dòng scope); sau đó chỉ route `user`, `budget-choice` hay goal sửa mới dừng.
- Chỉ màn hành trình mới được kiểm; phần còn lại vào sổ chưa kiểm, không im lặng. Skeleton/loading/empty/error của màn hành trình không được hoãn.
- Hot-fix runtime trong worktree chung: chỉ `git add` đường dẫn của mình, kiểm `$?` của self-test trước khi commit, probe ledger của session đang chạy bằng `scripts/validate-session.mjs` trước khi ff runtime sống.
