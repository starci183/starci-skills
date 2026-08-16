---
id: be-patterns-e2e-flow-audit
title: audit.md
slug: /be/patterns/e2e-flow/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, mức neo và khả năng cưỡng chế của luật e2e flow.
---

# audit.md

> Version: `2.00` · Module: `e2e-flow`

Audit này kiểm ba thứ: mỗi mã có **phân định được** khỏi mã kề không, mỗi mã có **neo được vào code
thật** không, và bảng **tầng giữ** có nói đúng sự thật không — kể cả khi sự thật là "không có gì giữ
cả".

## Verdict

Chấp nhận. Mười hai mã được giữ nguyên số và nguyên nghĩa từ luật phẳng. Năm mã có rule cưỡng chế,
bảy mã chỉ có người đọc, và mười hai mã đều neo được vào code thật đang chạy trong repository. Con số
5/12 là **con số đã đo**, không phải một mục tiêu chưa hoàn thành.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `E2E-1` vs `E2E-2` | Loại trừ được: `E2E-1` nói file **là** cái gì, `E2E-2` nói bên trong chia thế nào |
| `E2E-2` vs `E2E-7` | Loại trừ được: chia nhiều bước là `E2E-2`, nhánh **bên trong một bước** là `E2E-7` |
| `E2E-3` vs `E2E-5` | Loại trừ được khi đã nêu hệ quả sống ở store hay ở transport |
| `E2E-3` vs `E2E-6` | Loại trừ được: chờ **có** là `E2E-3`, quan sát **không có** là `E2E-6` |
| `E2E-4` vs `E2E-5` | Loại trừ được khi đã nêu hệ quả có row, có message, hay có cả hai |
| `E2E-5` vs `E2E-6` | Loại trừ được khi đã nêu có actor đứng ngoài hay chưa |
| `E2E-8` vs `E2E-12` | Loại trừ được: ghi đè một token là `E2E-8` hợp lệ, sao chép cả thế giới thì không |
| `E2E-9` vs `E2E-8` | Loại trừ được: thế giới cung cấp **hàm tạo** actor, không giữ sẵn actor dùng chung |
| `E2E-11` vs `E2E-12` | Loại trừ được: `E2E-11` là **cửa vào**, `E2E-12` là **thay gì ở đầu kia** |
| `E2E-10` vs mọi mã | Loại trừ được: nó nói về **output của test**, không về nội dung assertion |
| Thiếu dữ kiện | Hỏi **một** câu theo bảng phân định trong `example.md`, rồi dừng |

## Findings

- **Không mã nào bị đổi số.** Mười hai mã của luật phẳng được mang nguyên sang, kể cả những mã không
  có rule nào giữ. Đây là điều kiện để các trích dẫn cũ còn đọc được.
- **Bảng tầng giữ nói ra một sự thật khó chịu và cố ý giữ nó khó chịu.** Bảy trên mười hai mã chỉ có
  người đọc giữ. Luật phẳng đã tuyên bố con số 5 là "con số trung thực, không phải một khoảng
  trống", và module này giữ nguyên tuyên bố đó thay vì làm mềm nó đi.
- **Không mã nào ở tầng `unrepresentable`, và không mã nào có thể ở đó.** Tầng này đóng một tập
  **giá trị** bằng union hoặc branded type. Mọi mã ở đây là tuyên bố về **hình dạng một file test** —
  có bước nào, khẳng định gì, ai hành động — và hình dạng file không phải một giá trị kiểu giữ được.
- **`E2E-10` được giữ bằng máy, nhưng không phải bởi module này.** `no-console` và
  `starci-be/no-framework-logger` ở luật observability phủ mọi call site. Theo định nghĩa của bảng
  tầng giữ — "một rule trong `sources/be/e2e-flow.mjs`" — nó phải ghi là `documented`. Ghi
  `enforced` sẽ là nói dối về **ai** đang giữ, và người đọc bảng cần biết đúng chỗ để sửa khi rule
  đổi.
- **`e2e-asserts-persisted-state` chỉ chứng minh một nửa `E2E-4`.** Rule bật cờ khi thấy bất kỳ
  identifier nào khớp `entityManager | dataSource | EntityManager | DataSource | getRepository |
  queryRunner`, rồi báo lỗi ở `Program:exit` nếu không thấy cái nào. Một file khẳng định toàn envelope
  và có đúng một `entityManager.query("SELECT 1")` ở bước dọn dẹp sẽ **qua** rule mà vẫn sai `E2E-4`.
  Ví dụ đó đã được viết ra ở `example.md` để không ai tưởng rule là đủ.
- **`e2e-uses-production-transport` báo mọi `.execute()` và `.process()`, bất kể receiver.** Đây là
  một false positive đã biết: một `queryRunner.execute(...)` hoặc một helper tên `pipeline.process(...)`
  trong file spec sẽ bị báo. Rule cố ý chọn thô ở chỗ này vì hai tên method đó gần như luôn là bus
  hoặc worker trong lane flow. Cách xử lý là **đổi tên helper của test**, không phải tắt rule — nhưng
  chi phí đó thuộc về tác giả test, và nó cần được ghi ra thay vì để họ tự đoán.
- **`no-sleep-in-flow` coi `wait` là tên của một sleeper.** Một helper poll nhưng được đặt tên `wait`
  sẽ bị từ chối. Đây là hệ quả chấp nhận được của việc chọn theo tên: tập `SLEEPERS` là
  `sleep | delay | wait | pause | setTimeout`, và lane này có sẵn `until` nên không cần tên `wait`.
- **Trong code thật, hai file hạ tầng còn trích dẫn tiền tố cũ `FLOW-`.**
  `src/tests/helpers/flow-wait.ts` dẫn "FLOW-3, FLOW-5 và FLOW-6";
  `src/tests/helpers/flow-world.ts` dẫn "FLOW-8" và "FLOW-9". **Số hoàn toàn khớp** với `E2E-3`,
  `E2E-5`, `E2E-6`, `E2E-8`, `E2E-9` — chỉ tiền tố trôi. Đây là bằng chứng sống cho luật "mã là cố
  định": số sống sót qua một lần đổi tên, và nhờ thế trích dẫn cũ vẫn đọc được. Sửa tiền tố là việc
  của một task ở repository đó, không phải một thay đổi luật ở đây.
- **Mọi mã đều neo được.** Không mã nào phải ghi `chưa neo được`. Neo mạnh nhất nằm ở
  `src/tests/helpers/flow-wait.ts` và `src/tests/helpers/flow-world.ts`: hai file này tồn tại **chính
  vì** luật, và comment đầu file của chúng nói ra cùng một lý do mà `E2E-3` và `E2E-8` nói.

## Decisions

- Giữ đúng mười hai mã: `E2E-1` … `E2E-12`. Không thêm, không bớt, không đổi số.
- Giữ nguyên mọi quyết định của luật phẳng, kể cả những chỗ audit này thấy thô — bất đồng đi vào
  "Rủi ro còn mở", không đi vào một lần sửa im lặng.
- Ghi `E2E-10` là `documented` theo đúng định nghĩa của bảng, và nói rõ ở cùng dòng rằng nó đang
  được luật observability giữ.
- Ghi `E2E-4`, `E2E-11`, `E2E-12` là `enforced` **một nửa**, và nêu rõ nửa nào không được giữ.
- Không đề xuất rule mới cho bảy mã `documented`. Từng mã được nói rõ ở dưới **cần thấy gì** thì rule
  mới giữ được, để lần sau có người muốn "hoàn thiện nốt" thì họ đọc được vì sao đã không.
- Giữ mọi ví dụ ở dạng TypeScript thường, không tên sản phẩm, không tên repository, không tên module
  riêng.

## Rủi ro còn mở

Bảy mã chỉ có `documented`. Với mỗi mã: một rule sẽ phải **thấy** được gì, hoặc vì sao không rule nào
thấy được.

- **`E2E-1` — không rule nào làm được.** Rule phải so tên file với **một câu nghiệp vụ**.
  `course-purchase.e2e-spec.ts` và `enrollment-resolver.e2e-spec.ts` là **cùng một shape** với
  parser, và là hai thứ đối lập với người đọc. Một heuristic kiểu "tên file phải có động từ" sẽ
  từ chối tên đúng và chấp nhận tên sai ngay ở ví dụ đầu tiên.
- **`E2E-2` — rule sẽ hại nhiều hơn lợi.** Rule phải thấy được rằng **câu nghiệp vụ có nhiều bước**,
  rồi mới đòi nhiều `it`. Đếm `it` thì false positive **đầu tiên** đã là một flow một bước hợp lệ, và
  một rule mà false positive đầu tiên là trường hợp đúng thì dạy tác giả rằng rule sai.
- **`E2E-5` — rule sẽ phải hiểu assertion nói về cái gì.** Cấm `expect(x.length).toBe(n)` trong file
  spec là khả thi về cú pháp, nhưng nó bắt nhầm mọi khẳng định hợp lệ về số lượng **row** hay số lần
  gọi seam — chính là thứ `E2E-3` khuyến khích. Ranh giới nằm ở việc mảng đó là **message stream** hay
  không, và điều đó nằm ở kiểu, không ở cú pháp. Một rule dùng type information có thể làm được, với
  chi phí là lane này phải chạy typed linting.
- **`E2E-6` — sự vắng mặt không có shape để bắt.** Rule phải thấy rằng file **thiếu** một bước phủ
  định. Nó có thể yêu cầu mỗi file có ít nhất một lời gọi tới một helper tên `expectNoMessage` /
  `expectNoChange`, nhưng như thế là cưỡng chế **tên helper** chứ không phải cưỡng chế lời hứa, và nó
  sẽ được thoả mãn bằng một lời gọi vô nghĩa trong vòng một tuần.
- **`E2E-8` — sai tầng, không sai ý.** Đây là sự thật về **cây fixture của một repository**: có bao
  nhiêu chỗ dựng thế giới. Một rule ESLint chỉ nhìn thấy **một file**. Thứ giữ được mã này là một
  **gate** đếm số hàm boot trong cây test và so với danh sách được phép — nó tồn tại được, nhưng nó
  là gate, không phải rule, và nó chưa được viết.
- **`E2E-9` — rule chỉ chạm được vào vỏ.** Cấm literal số trong `where` của một truy vấn tạo actor là
  khả thi, nhưng magic ordinal có thể là một hằng số có tên, một biến môi trường, hay một row seed
  tìm bằng email. Thứ cần thấy là **actor này có do flow tạo ra không**, và đó là câu hỏi về vòng đời
  dữ liệu, không phải về cú pháp.
- **`E2E-10` — có rule, chỉ không ở đây.** `no-console` và `starci-be/no-framework-logger` đã phủ mọi
  call site. Rủi ro còn mở là **tổ chức**, không phải kỹ thuật: nếu ai đó nới hai rule đó ở lane test
  cho "dễ debug", mã này mất chỗ dựa mà bảng tầng giữ của module này **không** báo động, vì nó không
  sở hữu rule đó.

Ngoài bảy mã trên, hai rủi ro nữa:

- **Nửa không được giữ của ba mã `enforced` dễ bị đọc thành đã giữ đủ.** `E2E-4`, `E2E-11` và
  `E2E-12` đều có một nửa cú pháp và một nửa ý nghĩa. Bảng ghi rõ chữ "(half)", và `example.md` viết
  hẳn một file **qua rule mà vẫn sai luật** cho `E2E-4`. Nếu vẫn có người đọc nhầm, chỗ sửa là làm
  chữ "half" hiển thị hơn, không phải viết thêm rule.
- **Tiền tố `FLOW-` trong code thật.** Cho tới khi hai file hạ tầng được cập nhật, một người tìm
  `E2E-3` bằng grep sẽ không thấy comment đang giải thích chính `E2E-3`. Đây là drift trích dẫn, và
  nó được ghi ở đây thay vì được sửa lén ở luật.

## Re-audit Triggers

- Có đề xuất thêm, bớt, hoặc đổi số một mã `E2E-<n>`.
- `sources/be/e2e-flow.mjs` thêm hoặc bỏ một rule — bảng **Tầng giữ** phải đổi theo trong cùng một lần.
- Một mã `documented` được đề nghị nâng lên `enforced`; audit phải kiểm rule đó fire trên **cú pháp**
  chứ không trên phán đoán.
- Một anchor trỏ vào file không còn tồn tại, hoặc file đó không còn chứa thứ cột "what to look for"
  nói là có.
- Luật observability đổi mức của `no-console` hoặc `starci-be/no-framework-logger` — `E2E-10` mất chỗ
  dựa.
- Một false positive của `e2e-uses-production-transport` hoặc `no-sleep-in-flow` bị xử lý bằng cách
  **tắt rule** thay vì đổi tên trong test.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm hoặc một module nội bộ mới đọc được.
