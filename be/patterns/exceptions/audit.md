---
id: be-patterns-exceptions-audit
title: audit.md
slug: /be/patterns/exceptions/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo vào source thật của luật Exceptions.
---

# audit.md

> Version: `2.00` · Module: `exceptions`

Bản audit này kiểm tra ba việc: luật có phân định được sáu tình huống bằng **dữ kiện đã nêu** hay không,
mỗi mã **thật sự** được giữ ở tầng nào, và mỗi mã có gắn được với source thật hay không.

## Verdict

Chấp nhận. Sáu mã giữ nguyên số và nguyên nghĩa từ bản luật phẳng; bốn mã có rule giữ, hai mã chỉ do
người đọc kiểm tra, và cả sáu đều gắn được với source.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `EXCEPTION-1` vs `EXCEPTION-3` | Loại trừ được khi đã đọc **file khai báo**; đọc chỗ throw thì không loại trừ được, và đó chính là lý do hai mã tồn tại tách nhau |
| `EXCEPTION-1` vs `EXCEPTION-6` | Loại trừ được bằng **đường dẫn** của file, không bằng nội dung dòng throw |
| `EXCEPTION-2` vs `EXCEPTION-5` | Loại trừ được khi tách câu hỏi hình dạng khỏi câu hỏi nội dung; `{}` thoả mã trước và có thể vẫn trốn mã sau |
| `EXCEPTION-3` vs `EXCEPTION-4` | Hai mã độc lập: sai base và sai thư mục là hai lỗi khác nhau, và ca lịch sử là một class **đúng thư mục, sai base** |
| `EXCEPTION-4` vs nhiều ứng dụng | Loại trừ được khi hỏi "câu 'ứng dụng này throw được gì' đã có đúng một chỗ trả lời chưa" |
| `EXCEPTION-5` vs `exception-identity` | Loại trừ được: mã này nói về payload, module bên cạnh nói về tên và code |
| Thiếu dữ kiện | Mặc định đọc file khai báo trước khi kết luận; chỉ hỏi một câu khi không mở được file đó |

## Findings

- **Cặp `EXCEPTION-1` + `EXCEPTION-3` là phát hiện quan trọng nhất của luật này**, và nó không đến từ
  suy luận: một class extends base framework đã sống trong cây code, được throw từ bốn call site,
  trong khi gate vẫn xanh. Rule ở chỗ throw không thể thấy nó, vì chỗ throw mang đúng tên nhà.
- **`throw-abstract-exception` là heuristic và tự nói ra điều đó.** Một rule đọc từng file một không
  xác minh được class đang throw có extends gì, nên nó khớp theo `Error` và một danh sách tên
  framework. Thứ làm heuristic đó **đúng** là `exception-extends-abstract`: nó bảo đảm mọi class
  `*Exception` trong cây đều là của nhà. Bỏ một trong hai là mất tính đúng của cả hai.
- **`EXCEPTION-2` gần chạm `unrepresentable` mà chưa tới.** Hiện tại 323 khai báo trong cây errors đều
  gõ kiểu cho tham số constructor và không khai báo giá trị mặc định, nên `new X()`, `new X("id")` và
  `new X(a, b)` đều là lỗi biên dịch tại mọi call site. Nhưng đó là tính chất **kiếm được ở từng khai
  báo**, không phải bảo đảm của base class: constructor của `AbstractException` là constructor vị trí,
  nên một subclass sao chép hình dạng đó vẫn compile và chỉ có rule bắt được. Tầng giữ vì thế là
  `enforced`, không phải `unrepresentable`.
- **`EXCEPTION-4` từng bị viết bằng một đường dẫn literal**, và đó là layout của một repository bị viết
  vào luật. Đo trước khi sửa: đường dẫn hẹp báo 83 finding ở một back end thứ hai, và những chỗ vi
  phạm nhiều nhất là file **đã nằm trong** một thư mục `exceptions/errors/` — chỉ không phải thư mục
  đó. Một rule bắn vào code đúng tệ hơn không có rule, vì người viết tiếp theo học được thói quen cuộn
  qua nó.
- **Carve-out cho lane test từng được cấp trong prose mà thiếu trong rule.** Đó là kiểu bất đồng tệ
  nhất: canon nói lane được throw, artifact nói không, và một repository nhận rule về thừa hưởng 69
  finding mà chính canon của nó đã tha.
- **Ngoại lệ health probe đến từ chính lý do của luật, không từ sự tiện.** Framework exception bị từ
  chối vì "mang status mà không mang danh tính"; probe là endpoint duy nhất mà câu đó đảo chiều, vì
  orchestrator đọc status và không đọc gì khác. Ngoại lệ hẹp có chủ đích: chỉ health controller.
- **Người đọc metadata hẹp hơn prose gợi ý.** Filter HTTP gửi `statusCode`, `code`, `message` và
  **không** gửi metadata. Nên "client cần trường này" hôm nay là một lập luận sai về mặt cơ chế; người
  đọc metadata là dòng log và caller in-process. Luật không yếu đi, nhưng lý do biện minh cho từng
  trường phải nêu đúng người đọc.

## Decisions

- Giữ đúng sáu mã: `EXCEPTION-1` … `EXCEPTION-6`, nguyên số và nguyên nghĩa của bản luật phẳng. Mã
  được trích dẫn từ file luật khác và từ task record cũ; đánh số lại là làm gãy một trích dẫn người
  khác đã viết.
- Tách bảng **tầng giữ** khỏi bảng **mã tình huống**: một mã là một tình huống, còn ai giữ nó là một
  sự thật khác, và trộn hai thứ là cách một luật `documented` được đọc thành đã enforce.
- Ghi tên rule cụ thể cho từng mã `enforced`. Không mã nào được dán nhãn `enforced` nếu chưa mở được
  rule và gọi được tên nó.
- Giữ `EXCEPTION-5` và `EXCEPTION-6` ở `documented`, có nêu chính xác thứ một rule sẽ phải nhìn thấy.
- Neo cả sáu mã vào source thật. Không mã nào ghi `chưa neo được`.
- Đưa mọi ví dụ về TypeScript thường, không tên sản phẩm, không tên module riêng, không tên
  repository. Bảng `Anchor` là chỗ duy nhất trích đường dẫn.

## Rủi ro còn mở

- **`EXCEPTION-5` chỉ ở `documented`, và có thể sẽ ở đó mãi.** Một rule muốn giữ nó phải nhìn thấy
  *object literal này có mang những dữ kiện mà người đọc thất bại sẽ cần hay không* — nhưng
  `{ message: "not found" }` và `{ orderId }` là **cùng một hình dạng AST**. Cái phân biệt chúng là
  ngữ nghĩa của tên trường, và tên trường thì tác giả tự đặt.

  Có một phần nhỏ **giữ được**, và nên được đề xuất riêng: cấm một danh sách đóng các tên trường mang
  nghĩa "một câu đã render" — `message`, `detail`, `reason`, `description` — khi chúng là trường duy
  nhất của object. Rule đó bắt được ca thường gặp nhất (câu văn làm payload duy nhất) mà không phải
  đoán ý định. Nó **không** bắt được ca ngược lại: một object đủ hình dạng nhưng thiếu đúng cái id mà
  ba giờ sáng người ta cần. Phần đó không rule nào giữ được, vì "cái người đọc sẽ cần" nằm ở người
  đọc, không nằm trong file.

- **`EXCEPTION-6` chỉ ở `documented`, và nửa dễ thì đã giữ rồi.** Nửa "product code không được mượn
  lối ra này" đã mechanical: `isTestLane` trong rule cộng với glob trong config. Nửa còn lại — *một
  spec không được đặt tên thất bại của chính nó bằng từ vựng của sản phẩm* — thì một rule sẽ phải nhìn
  thấy rằng class `FixtureNotSeededException` mô tả một sự cố của môi trường test chứ không của nghiệp
  vụ. Nó không phân biệt được điều đó bằng hình dạng.

  Xấp xỉ khả thi: cấm một class trong thư mục errors chỉ được throw từ file trong lane test. Đó là
  phân tích liên file, ngoài tầm một rule đọc từng file — muốn có thì phải là một gate riêng chạy trên
  cả cây, và đó là một đề xuất, không phải trạng thái hiện tại.

- **Ranh giới của `EXCEPTION-6` được viết hai lần và có thể lệch.** `isTestLane` trong rule và glob
  trong config của repository là hai bản của cùng một sự thật. Hôm nay chúng khớp. Không có gì kiểm
  rằng ngày mai chúng còn khớp, và bản lệch sẽ im lặng: một lane mới thêm vào config mà rule không
  biết sẽ tắt rule ở đó, còn chiều ngược lại thì rule tha một lane mà config vẫn bật.

- **Tôi không đồng ý với một chỗ trong luật gốc, và giữ nguyên nó.** `EXCEPTION-5` nói metadata mang
  thứ "client quyết định hiển thị" cần, nhưng filter HTTP hiện tại **không gửi metadata ra client**.
  Đây là một khác biệt giữa luật và source: hoặc filter thiếu một trường, hoặc câu trong luật nêu sai
  người đọc. Cả hai hướng sửa đều là quyết định sản phẩm, không phải quyết định của bản re-express
  này, nên luật giữ nguyên và sự thật về filter được ghi ở `Anchor`, ở `vi.md` và ở đây.

- **`EXCEPTION-3` cấm extends framework, chưa nói rõ về extends một exception khác của nhà.** Luật gốc
  chỉ nêu ranh giới với base framework. Rule cũng vậy: nó chỉ cho qua khi superclass đúng bằng
  `AbstractException`, nên trên thực tế cây thừa kế sâu **bị chặn**, nhưng luật viết ra thì không nói.
  Rule đang nghiêm hơn prose. Đây là một đề xuất làm rõ, không phải một lần sửa lặng lẽ.

- **Danh sách tên framework trong rule là một danh sách đóng.** Một exception mới của framework, hoặc
  một base của thư viện thứ ba, sẽ đi qua `EXCEPTION-1` cho tới khi có người thêm tên vào. Thứ bịt lỗ
  này không phải danh sách, mà là `EXCEPTION-3` — và đó là một lý do nữa để không tách rời hai mã.

## Re-audit Triggers

- Có đề xuất thêm hoặc bỏ một mã `EXCEPTION-<n>`.
- Có một class `*Exception` mới extends thứ gì khác `AbstractException`.
- Có `throw new Error` xuất hiện trong product code, hoặc một lane test mới được thêm vào glob.
- `isTestLane` trong rule và glob trong config của một repository lệch nhau.
- Filter HTTP đổi những trường nó gửi ra — `EXCEPTION-5` phải nêu lại người đọc.
- Một exception được khai báo ngoài thư mục exceptions, hoặc một ứng dụng mới ra đời mà chưa có thư
  mục của mình.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
