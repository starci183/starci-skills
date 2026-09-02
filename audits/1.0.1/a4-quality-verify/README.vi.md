# A4 chạy khô 3 — `quality.verify` trên backend: chưa đủ tiền đề

Ngày 2026-09-02. Đích định chạy: checkout backend starci-academy ở `0b540dd2`, loại delivery
`backend`, các cổng `format`, `lint`, `typecheck`, `build`, `unit-coverage`, `integration`, `e2e`
(không yêu cầu), `sonar` (`new-code`), dùng chính lệnh của kho (`npm run lint:check`,
`npm run typecheck`, `npm run build`, `npm run test:ci`, `npm run test:int`, `npm run sonar:check`).

## Vì sao không có artifact

`input.schema.json` đòi ít nhất một mục trong `context.predecessors` (`minItems: 1`), và mỗi
predecessor phải là receipt thật có fingerprint và head source. `quality.verify` xác minh một
*delivery*; nó từ chối chạy khi không có receipt của bên đã tạo ra delivery đó. Chưa receipt nào như
vậy tồn tại: hai lần chạy khô `business.decide` và `fe.presentation.resolve` đều kết thúc `blocked`,
còn `backend.implement`, `fe.source.apply` và `content.generate` chưa chạy. Tự tay viết một receipt
predecessor để mở khoá các cổng là bịa thẩm quyền, nên không ghi gì.

Đây là operator hành xử đúng thiết kế. Hợp đồng nói cái gì đã được xây và vì sao "đến nơi đã được
quyết"; một lần chạy cổng không có delivery phía sau sẽ đo một checkout chứ không đo một delivery, và
receipt sẽ mang một `deliveryId` không ai sở hữu.

## Đã kiểm gì thay vào đó, chỉ đọc

| Mục | Quan sát |
| --- | --- |
| Lệnh cổng mà kế hoạch sẽ ghim | cả tám đều có trong `package.json` (`lint:check` chạy eslint với `--max-warnings=0`; `test:ci` sinh coverage lcov và json-summary; `test:int` mang `--passWithNoTests`, thứ hợp đồng cấm với cổng unit và cần được xem lại với `integration`) |
| Cấu hình cổng | có `eslint.config.mjs`, `tsconfig.json`, `tsconfig.build.json`, `jest.config.ts`, `nest-cli.json`, `sonar-project.properties`, `tsconfig.sonar.json`; không có cấu hình prettier, nên cổng `format` không có lệnh để ghim ở đây |
| Working tree | 75 đường dẫn bẩn tại head đã đóng băng, nên bất kỳ lần chạy nào hôm nay cũng đo working tree chứ không đo `0b540dd2` |
| Phạm vi Sonar | có `sonar-project.properties`; quality gate chỉ đo code mới, điều hợp đồng đã gọi tên (`SONAR_NEW_CODE_ONLY`) |

## Điều gì mở khoá lần chạy

Một receipt `backend.implement` trên một head đã commit. Ứng viên tự nhiên đầu tiên là phần Pro
subscription, khi ba thư mục chưa track của nó được commit và `business.decide` publish head lời hứa
từ commit đó.

## Việc còn mở cho cây

`test:int` dùng `--passWithNoTests`. Hợp đồng cấm cờ này với cổng unit ("một lần chạy không có test
không phải là pass") và không nói gì rõ về `integration`. Hoặc cổng integration theo cùng luật, hoặc
hợp đồng nói vì sao một lần chạy integration không có test được phép pass.
