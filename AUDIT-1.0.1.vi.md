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
| A3 | bốn operator của vòng FE | 4 gói | chưa | chạy khô `fe.direction.decide` → `fe.presentation.resolve` → `fe.source.apply` → `fe.surface.audit` trên dashboard; mỗi `execute.md` làm theo được, mỗi output qua validator | không |
| A4 | 10 operator còn lại | 10 gói | chưa | mỗi cái chạy khô một lần với input thật; mỗi mã lỗi được chạm ít nhất một lần | không |
| A5 | `ui/presentation/` | 10 topic | mới gap, padding, margin | khuôn rule, cột `Owner`, bảng "Common đã sở hữu" bám vào source `packages/grammar`; không bịa API | không |
| A6 | `ui/composition/` | 8 topic | chưa | mỗi file một tiền tố, cột `Decide` nói direction phải chốt gì, không có bảng verdict | không |
| A7 | `ui/proof/` | 5 topic | chưa | đóng ngày 2026-09-02: `_pending-contrast` đã chuyển về `ui/proof/contrast.md` (+vi) thành COLOR-3 và COLOR-5 theo khuôn rule của proof, đã thêm dòng danh mục, self-test của `fe.surface.audit` bind và trích được topic `contrast` (`384a3ec9`); cột `Observe` của bốn topic còn lại vẫn chờ thầy đọc | đã quyết: đo tương phản đặt ở `ui/proof/contrast.md` |
| A8 | `patterns/fe`, `patterns/be` | 16 topic | chưa | mỗi rule dẫn hai đường dẫn thật; nêu số đếm khi không phổ quát; câu hỏi mở để mở | 7 câu hỏi mở đã ghi |
| A9 | `grammars/starci/` | 5 topic | một phần | khớp `packages/grammar` hiện tại: không còn `Link`, `TextAction`/`Button` nhận `href`; 41 renderer | không |
| A10 | `_pending-*` | 0 file | chưa | đóng ngày 2026-09-02: contrast → `ui/proof/contrast.md` (`384a3ec9`); surface, boundary, icon, media, control-state, field → `grammars/starci/{surface,boundary,icon,media,control-state,field}.md` (+vi), mỗi rule một bảng `Case \| Luật \| Owner của Common \| Core hiện thực`, mọi owner đều đọc từ `packages/grammar/src` (`02f06b02`); mười bốn file đã xoá và mục "Chờ chuyển chỗ" đã bỏ sau khi đếm lại được 118 id (`85f3863d`) | đã quyết như đã ghi; một việc theo sau: `grammars/starci/surface.md` và `boundary.md` giữ số legacy `SURFACE-1..5` và `BOUNDARY-1..5` trong khi `ui/presentation/` công bố dãy `SURFACE-1..6` và `BOUNDARY-1..6` khác; hai file mang ghi chú tiền tố, và một lượt chạy chỉ được bind một dãy cho mỗi tiền tố |
| A11 | `resources/` | 2 sổ đăng ký, 21 vai trò | chưa | mọi ràng buộc vai trò → profile và mọi câu trả lời chính sách (mạng, Grammar, hình) là mặc định đặt ngày 2026-09-02, chưa phải phán quyết của thầy; validator chỉ chứng minh nhất quán nội bộ | profile nào chạy vai trò nào; `sonnet` có đủ cho vai trò cơ học không; `fable` có nên ràng vai trò nào không |

## Nhánh B — những thứ cây này phụ thuộc bên ngoài

| # | Mục | Trạng thái | Vướng | Cần thầy quyết |
| --- | --- | --- | --- | --- |
| B1 | `packages/grammar/src/common/conformance.ts` | cũ | `RULE_FAMILY_COUNTS` vẫn chép catalog 25 họ đã nghỉ; ba họ đang khẳng định phủ những rule không còn tồn tại | sinh lại từ cây mới hay bỏ bản chép |
| B2 | starci-academy-fe | 7 commit local, chưa đẩy | `pre-push` chạy lint và unit suite; lint còn 1 lỗi kiến trúc; suite không kết thúc được | xem B4, B5 |
| B3 | nivo-fe | 4 commit local, chưa đẩy | 2 lỗi lint kiến trúc; unit suite 100% | icon authority sống ở đâu sau migration grammar |
| B4 | `LearnSpine/component.spec.tsx` | không bao giờ xong khi chạy cả suite | file duy nhất trong 497 không báo xong dưới cả hai pool: `forks` làm worker chết, `threads` làm nó treo. Chạy riêng thì xong trong 38ms và chỉ trượt một assertion thường (nhãn nhóm "Your path" không được render, cùng họ với B5). Treo phụ thuộc thứ tự: một spec chạy trước trong cùng worker để lại timer hoặc handle mà import của file này chờ mãi | không; bisect bằng cách chạy nó sau từng thư mục spec đứng trước, rồi đóng chỗ rò ở nguồn |
| B5 | 33 test đỏ ở starci, xác nhận dưới cả hai pool | có sẵn | hợp đồng attribute cũ (`data-variant`, `data-tone`), test nhầm lựa chọn với đích đến, trạng thái active của `SourceFileTree` | Grammar nên publish lại hợp đồng cũ nào |
| B6 | `isPressLabel` trên `Text` | 64 file | một leaf tĩnh mang ngữ nghĩa bấm | giữ, hay dời gạch chân khi hover sang CSS của press target |

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
