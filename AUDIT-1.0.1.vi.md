# Audit hướng tới StarCi Skills 1.0.1

Trạng thái: bản nháp để thầy định hình. `package.json` giữ `1.0.0` cho tới khi mọi dòng bên dưới
đóng; 1.0.1 là kết quả của đợt audit này, không phải điểm xuất phát.

Nền được audit: `main` tại `37b756b`, chính là cây này. Toàn bộ runtime v7.6 nằm trên nhánh `v7`
tại `83b28e2`, và đó là nơi duy nhất được dẫn tới một file chỉ có ở v7.

## "Hoàn chỉnh" nghĩa là gì

Mọi operator chạy được từ đầu tới cuối trên một artifact thật và output của nó qua validator. Mọi
file knowledge mà runtime bind đều đã được thầy đọc qua bản `.vi.md`. Mọi quyết định về quyền sở hữu
còn treo đều có đúng một câu trả lời được ghi lại. Không finding nào bên dưới còn mở mà không có chủ.

## Nhánh A — cây skills

| # | Vùng | File | Thầy đã đọc | Kiểm gì | Cần thầy quyết |
| --- | --- | --- | --- | --- | --- |
| A1 | bảng cửa vào trong `SKILL.md` | 1 | chưa | mỗi dạng yêu cầu trong 14 dòng đi đúng operator đầu tiên | không |
| A2 | `routing.json` | 76 route | chưa | đích của từng route đúng nghĩa, nhất là bốn nghĩa của `frontend`, và `contract` → người, `source` → `workspace.bind` | không |
| A3 | bốn operator của vòng FE | 4 gói | chưa | chạy khô `fe.direction.decide` → `fe.presentation.resolve` → `fe.source.apply` → `fe.surface.audit` trên dashboard; mỗi `execute.md` làm theo được, mỗi output qua validator. Ngày 2026-09-02: đã chạy `fe.presentation.resolve` trên `dashboard/ContinueLearning` từ fingerprint thật; cả hai artifact qua validator; kết quả `blocked · RULE_MISSING` vì `gap.md` không có case cho dấu dẫn đầu cạnh khối chữ, cũng không có case cho cột chữ kết thúc bằng hành động của nó, và bằng chứng được phép chỉ có một trường hợp mỗi loại nên không viết case nào ([hồ sơ](audits/1.0.1/a3-presentation-resolve/README.vi.md)). Ba operator còn lại chờ một block resolve được và một checkout FE ổn định | không; hai case gap còn thiếu chờ block được phép thứ hai |
| A4 | 10 operator còn lại | 10 gói | chưa | mỗi cái chạy khô một lần với input thật; mỗi mã lỗi được chạm ít nhất một lần. Ngày 2026-09-02: đã chạy `business.decide` trên `pro-subscription` với head backend `0b540dd2` và head nghiệp vụ thật `eccaeaad`; kết quả `blocked · EVIDENCE_MISSING` vì mọi enforcement của Pro đều chưa track ở head đó ([hồ sơ](audits/1.0.1/a4-business-decide/README.vi.md)). Hai lỗi của cây mà nó phơi ra đã sửa: hợp đồng giờ gọi head tại `features/<featureId>` đúng như root thật (`3aaada85`), và `workspace.bind` suy ra `route.authorityRoots.businesses` nên root không còn gõ tay (`6aa4d3b8`). Đã chạy `workspace.bind` trên `starci-academy/be` từ khai báo portable và bản hydrate thật; route phân giải được, checkout có 54 đường dẫn bẩn ngoài write root, kết quả `blocked · CHECKOUT_DIRTY` ([hồ sơ](audits/1.0.1/a4-workspace-bind/README.vi.md)); mã lỗi đó trước đây không thể chạm tới vì validator input chặn trước, đã sửa ở `47d21798`. `quality.verify` chưa chạy được: nó đòi một receipt của bên sản xuất (`predecessors` minItems 1) mà chưa có cái nào, và đó là hành xử đúng; đã ghi lại cùng danh sách cổng nó sẽ ghim ([hồ sơ](audits/1.0.1/a4-quality-verify/README.vi.md)). Còn tám operator | không |
| A5 | `ui/presentation/` | 10 topic | mới gap, padding, margin | khuôn rule, cột `Owner`, bảng "Common đã sở hữu" bám vào source `packages/grammar`; không bịa API | không |
| A6 | `ui/composition/` | 8 topic | chưa | mỗi file một tiền tố, cột `Decide` nói direction phải chốt gì, không có bảng verdict | không |
| A7 | `ui/proof/` | 5 topic | chưa | đóng ngày 2026-09-02: `_pending-contrast` đã chuyển về `ui/proof/contrast.md` (+vi) thành COLOR-3 và COLOR-5 theo khuôn rule của proof, đã thêm dòng danh mục, self-test của `fe.surface.audit` bind và trích được topic `contrast` (`384a3ec9`); cột `Observe` của bốn topic còn lại vẫn chờ thầy đọc | đã quyết: đo tương phản đặt ở `ui/proof/contrast.md` |
| A8 | `patterns/fe`, `patterns/be` | 16 topic | chưa | mỗi rule dẫn hai đường dẫn thật; nêu số đếm khi không phổ quát; câu hỏi mở để mở | 7 câu hỏi mở đã ghi |
| A9 | `grammars/starci/` | 5 topic | một phần | khớp `packages/grammar` hiện tại: không còn `Link`, `TextAction`/`Button` nhận `href`; 41 renderer | không |
| A10 | `_pending-*` | 0 file | chưa | đóng ngày 2026-09-02: contrast → `ui/proof/contrast.md` (`384a3ec9`); surface, boundary, icon, media, control-state, field → `grammars/starci/{surface,boundary,icon,media,control-state,field}.md` (+vi), mỗi rule một bảng `Case \| Luật \| Owner của Common \| Core hiện thực`, mọi owner đều đọc từ `packages/grammar/src` (`02f06b02`); mười bốn file đã xoá và mục "Chờ chuyển chỗ" đã bỏ sau khi đếm lại được 118 id (`85f3863d`) | đã quyết như đã ghi; va chạm tiền tố đã đóng: dãy legacy giờ là `CORE-SURFACE-1..5` và `CORE-BOUNDARY-1..5`, có ghi nguồn gốc, số không đổi (`d78457a9`) |
| A11 | `resources/` | 2 file profile, 14 operator | chưa | đã quyết ngày 2026-09-02: mỗi operator ràng đúng một profile và chạy trọn trên đó, khai ngay trong `operator.json` của nó dưới `resources` và nói lại trong `context.md` (`assignments.json` và `roles` đã nghỉ; validator từ chối ràng buộc thiếu hay bị chia, và dòng ma trận lệch). sol-fresh: business, architecture, fe.direction; sonnet: workspace.bind, fe.presentation.resolve, quality.verify, git.publish; opus: backend.implement, fe.source.apply, release.deploy, platform.operate; sol-reviewer: fe.surface.audit, uat.verify; luna: content.generate (schema ghim; giờ được tra cứu mạng có giới hạn cho brief của chính nó). Các câu trả lời chính sách giữ nguyên | `fable` có nên ràng operator nào không |
| A12 | trích dẫn trong knowledge | 116 file | chưa | mọi `PREFIX-n` hay `PREFIX-a..b` mà một file knowledge trích đều phải trỏ tới một heading `##` đã publish; `scripts/validate-knowledge-citations.mjs` chạy trong `npm test`. Lần chạy đầu tìm ra 51 lỗi trong `grammars/starci` (`RENDER-TRUTH-*`, `ACCESSIBILITY-*`, `TONE-4..5`, `PADDING-7/8` ở `###`), đã sửa hết (`d78457a9`); cây publish 254 rule dưới 44 tiền tố | không |

## Nhánh B — những thứ cây này phụ thuộc bên ngoài

| # | Mục | Trạng thái | Vướng | Cần thầy quyết |
| --- | --- | --- | --- | --- |
| B1 | `packages/grammar/src/common/conformance.ts` | đóng ngày 2026-09-02 | bản chép tay `RULE_FAMILY_COUNTS` được thay bằng `packages/grammar/scripts/generate-rule-catalog.mjs` → `src/common/rule-catalog.generated.ts`, đọc từ heading của knowledge (tiền tố lấy từ heading, id liệt kê chứ không khai triển vì các họ spacing bắt đầu từ `-0`); ảnh chụp 29 họ, 150 rule; `grammar:verify` xanh lại sau khi bỏ import `Link` đã cũ | đã quyết: sinh lại, không bao giờ chép |
| B2 | starci-academy-fe | đã đẩy ngày 2026-09-02, head remote `956d680` | pre-push tự chạy lint và unit suite: `Test Files 497 passed (497)`, `Tests 3006 passed, 35 skipped`; `eslint` 0 lỗi; `tsc --noEmit` sạch; bốn stash không đụng | đóng nhờ B4 và B5 |
| B3 | nivo-fe | đã đẩy ngày 2026-09-02, head remote `c9eb551` | đóng: hai lỗi `no-vendor-icon-outside-icon-leaf` chính là icon leaf bị migration grammar đổi tên ra khỏi `leaves/Icon/index.tsx`; nó đã về lại leaf, 13 consumer import qua leaf, và 7 lỗi lint có sẵn của `@nivo/app` mà hook pre-push phơi ra cũng đã sửa (trong đó hai directive `"use client"` bị kẹt dưới import). Lint 0, typecheck sạch, 405 unit test xanh | đã quyết: icon authority sống trong icon leaf của Grammar |
| B4 | `LearnSpine/component.spec.tsx` | đóng ngày 2026-09-02 | giả thuyết phụ thuộc thứ tự là sai: file treo cả khi chạy một mình, ở đúng test render lại rail khi thu gọn. React Aria đặt khoá `ListBox.Section` và `ListBox.Item` chung một không gian tên, còn `Sidebar` đưa thẳng id nhóm của bên gọi vào section, nên một nhóm có id trùng với id item của chính nó (`home`) va nhau: mọi section sau bị bỏ (lỗi "Your path") và render lại tập hợp va chạm không bao giờ ổn định. `Sidebar` giờ gắn tiền tố cho khoá section (`sidebar-section:<id>`), có test hồi quy; cả hai pool chạy xong | không |
| B5 | 35 test đỏ ở starci (dự kiến 33) | đóng ngày 2026-09-02 | test được đưa về hợp đồng hiện tại (`role="button"` cho hành động có callback, class `button--primary`/`button--md`, `data-appearance`); bảy cái là lỗi component thật và được sửa trong component: target bấm rỗng ở `ActivityRow`/`SuggestedUserRow` khi resting, `CourseMindMap` để resting nhãn nó đã có, `LearnSpine` khoá hàng bằng `isDisabled` khiến cổng không chạm tới được, `SourceFileTree` không đặt `isActive` lên control của hàng, `Article` gộp sáu cấp heading làm một, nút đóng `CoursePriceOverlay` không có tên trợ năng (thêm khoá copy ở cả hai locale) | đã quyết: không publish lại attribute cũ nào |
| B6 | `isPressLabel` trên `Text` | đóng ngày 2026-09-02 | chỉ có 3 chỗ gọi, không phải 64; prop, attribute `data-press-label` và các mục class của nó đã bỏ khỏi `Text`; `PressableSurface` công bố `pressableLabelClassName`, đặt lên lớp bọc vốn đã giữ dòng danh tính, kích hoạt theo `.group:hover` / `.group:focus-visible` của chính control; `TextAction` vốn đã gạch chân trên press target | đã quyết: press target sở hữu gạch chân |
| B7 | script trong `package.json` backend trỏ vào `.claude` | đóng ngày 2026-09-02 (`8f645ee1`) | `workspace:bootstrap`, `sync:device`, `checkpoint:data:*`, `sync:data` và `gate:canon` gọi `.claude/scripts/workspace-portable.mjs`, `device-state.mjs` và `*.spec.mjs`, còn khai báo route gọi `readiness/initialization/workspaces/*.schema.json` trong `$schema`; đợt cutover đã làm rơi tất cả. Đã khôi phục từ v7 với import validator nối lại; `check --source ..` xác thực cả 10 route. Còn mở ngoài cây: `scripts/measure-canon-rules.mjs` import `.claude/sources/be/*.mjs` mà cả v7 lẫn v8 đều không có, và `sync:device` gọi `npm --prefix .claude run setup:python` mà không phiên bản nào định nghĩa | xoá hay trỏ lại hai tham chiếu chết ở backend |

## Thứ tự đề xuất cho các buổi làm chung

1. A3 với dashboard làm fixture. Đây là vòng lặp mà bản phát hành sinh ra để phục vụ, và nó chạm
   luôn A1, A2, A5.
2. Bảy topic chưa đọc của A5, qua bản `.vi.md`: font, tone, measure, text-flow, overflow, surface,
   boundary.
3. A2 từng route một, rồi A1.
4. A6, A7, A10 gộp chung, vì chuyển `_pending-contrast` đóng cả A7 lẫn một phần A10.
5. A4, mỗi buổi hai operator, chỉ dùng input thật.
6. A8 sau cùng; nó là tài liệu tham chiếu, không phải cổng chặn lúc chạy.

Nhánh B chạy song song ở chỗ không cần thầy quyết: B4 là lỗi, B1 là việc cơ học sau khi A10 chốt
danh sách họ.

## Luật cho chính đợt audit

- Một dòng đóng bằng bằng chứng, không đóng bằng việc đã đọc: receipt chạy khô, validator xanh,
  đường dẫn source, hoặc quyết định đã ghi.
- Finding được sửa ở chủ nhỏ nhất của nó. Rule sai thì sửa trong knowledge; route sai thì sửa
  `routing.json`; hợp đồng operator sai thì sửa đúng gói đó.
- Không gì trong `.vi.md` trở thành authority lúc chạy. Thầy sửa ở đó; bản tiếng Anh được cập nhật
  theo và là thứ validator với operator đọc.
- Dòng nào đòi phải bịa API, mã rule, hay đích đến thì để mở và nói rõ như vậy.
