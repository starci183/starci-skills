---
id: fe-patterns-the-split-audit
title: audit.md
slug: /gates/patterns/the-split/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức phân định, tầng giữ và khả năng neo được của luật The split.
---

# audit.md

> Version: `2.00` · Module: `the-split`

Audit này kiểm hai điều: luật có tách được **một dòng code** về đúng một nửa chỉ từ dữ kiện đã nêu
hay không, và mỗi mã **thực sự** đang được giữ bởi tầng nào.

## Verdict

Chấp nhận. Đường ranh đóng, tổng quát, không phụ thuộc tên sản phẩm hay component nào. Nhưng chỉ hai
trên sáu mã có tầng máy giữ, và audit này không được phép nói khác đi.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| `SPLIT-1` vs `SPLIT-2` | Loại trừ được: một bên là **đi hỏi**, một bên là **quyết định thứ mình không nhìn thấy** |
| `SPLIT-2` vs `SPLIT-3` | Loại trừ được khi đã nêu tình huống bị chốt sai hay bị gửi sai hình dạng |
| `SPLIT-3` vs `SPLIT-4` | Loại trừ được: một bên là tình huống, một bên là chuỗi chưa đọc được |
| `SPLIT-2` vs `SPLIT-5` | Loại trừ được: rò rỉ qua props là `SPLIT-2`, markup trong file connected là `SPLIT-5` |
| `SPLIT-5` vs `SPLIT-6` | Loại trừ được khi đã nêu surface có request hay không |
| `SPLIT-6` vs mọi mã | Loại trừ được bằng đúng một dữ kiện: có request hay không |
| Thiếu dữ kiện | Hỏi **một** câu: "surface này có tự đọc thế giới không?" rồi dừng |

Câu hỏi phân định gốc — *dòng này sai được khi mạng vẫn tốt không?* — giải quyết được mọi cặp trên,
nên tập tiêu chí không cần thêm chiều nào.

## Findings

- **Đường ranh chỉ được giữ ở một phía.** `presentational-purity` nhìn thấy nửa vẽ đi hỏi thế giới,
  vì đó là thứ hiện ra trong lời gọi hàm. Nửa connected chốt sai tình huống thì trông **giống hệt**
  nửa connected chốt đúng, nên không có gì để một syntax tree bắt. Đây là giới hạn thật, không phải
  một chỗ chưa làm.
- **`presentational-purity` gác theo TÊN FILE.** Điều đó đủ khi convention là `component.tsx` ở mọi
  tier, nhưng nó cũng có nghĩa: đẩy request sang một file khác cùng folder rồi import vào nửa vẽ thì
  rule im lặng trong khi luật đã gãy. Cái bị cấm là **phụ thuộc**, không phải cái tên.
- **`connected-block-has-presentational-twin` hẹp hơn luật.** Nó chỉ nhận ra file connected khi
  đường dẫn khớp `src/components/blocks/**/<Tên>/index.tsx`. Trên một cây thật, `component.tsx` xuất
  hiện ở cả bốn tier — block, page, layout, overlay — nên phần lớn nửa vẽ đang được `SPLIT-1` gác,
  còn `SPLIT-5` chỉ được gác ở một tier. `SPLIT-5` vì thế được ghi là `enforced`, nhưng chỉ trong
  phạm vi block.
- **Bằng chứng dương và bằng chứng âm đều có.** Trên cây tham chiếu, không một `component.tsx` nào
  gọi họ hook mà rule liệt kê, và không một file connected nào chứa `className`. Hai kết quả rỗng ấy
  chính là neo của `SPLIT-1` và `SPLIT-2`.
- **`SPLIT-3` đã trôi ở những chỗ không ai gác.** Trên cùng cây tham chiếu, năm file `component.tsx`
  khai báo một cờ boolean vòng đời làm prop nhận vào thay vì một tên trong tập đóng. Không rule nào
  báo, vì một props object có boolean là một chương trình hoàn toàn hợp lệ.
- **`SPLIT-4` bị `SPLIT-1` che mất một nửa.** Lời gọi tra chữ trong nửa vẽ bị bắt, nhưng đó vốn đã là
  `SPLIT-1`. Nửa mà `SPLIT-4` sinh ra để chặn — một key băng qua dưới dạng `string` — thì không phân
  biệt được với bất kỳ chuỗi nào khác.

## Decisions

- Giữ đúng sáu mã: `SPLIT-1` … `SPLIT-6`, nguyên số và nguyên nghĩa của bản luật phẳng.
- Giữ nguyên câu hỏi phân định gốc làm tiêu chí duy nhất chia một dòng về một nửa.
- Giữ nguyên tuyên bố **không có ngoại lệ cho block mỏng** ở `SPLIT-5`, kể cả với sinh đôi chỉ
  forward props.
- Giữ nguyên `SPLIT-6` như một **giới hạn** của luật: không request thì không tách.
- Nói rõ trong `INDEX.md` rằng cờ nằm **dưới** đường ranh là hợp lệ. Bản luật phẳng đã ngụ ý điều này
  ở ví dụ `const isLoading = input.state === "pending"` bên trong nửa vẽ; ở đây nó được viết thành
  ngoại lệ đóng chứ không được quyết định mới.
- Nói rõ rằng **state UI cục bộ không phải request**. Đây là đọc `SPLIT-6` đúng như nó viết, có cây
  thật đứng sau: những folder một-file trên cây tham chiếu hoặc chỉ ghép các surface connected khác,
  hoặc chỉ giữ một `useState`.
- Giữ mọi ví dụ ở dạng TSX thuần, không tên sản phẩm, không tên repository, không tên component riêng
  của một ứng dụng.

## Rủi ro còn mở

Bốn mã dưới đây chỉ ở tầng `documented`. Với mỗi mã: rule sẽ phải **nhìn thấy** cái gì mới giữ được
nó — hoặc vì sao không rule nào giữ nổi.

- **`SPLIT-2` — nửa connected chốt tình huống, không chốt hình thức.** Một rule chặn được phần thô:
  cấm mọi `className`, mọi literal spacing và mọi JSX identifier lạ trong file connected. Nó **không**
  chặn được phần tinh: một prop tên `variant`, `density`, `tone` mang nghĩa hình thức trông y hệt một
  prop nghiệp vụ. Muốn giữ nốt phần đó, rule phải biết prop nào là hình thức — tức là phải có một
  danh sách tên đóng, và lúc đó cái được gác là **danh sách tên**, không phải luật.
- **`SPLIT-3` — tình huống băng qua dưới dạng một cái tên.** Rule sẽ phải nhìn vào **kiểu props được
  export của `component.tsx`** và hỏi: có từ hai boolean độc lập trở lên cùng mô tả một vòng đời
  không? Phần "từ hai boolean trở lên" thì một AST rule đọc được; phần "cùng một vòng đời" thì không,
  vì đó là ngữ nghĩa. Cách gần đúng và giữ được: cấm những tên cờ vòng đời quen thuộc (`isLoading`,
  `hasError`, `isEmpty`, `isError`) xuất hiện làm prop **nhận vào** của một file `component.tsx`, và
  chấp nhận rằng nó bắt theo tên chứ không theo nghĩa. Trên cây tham chiếu, luật đúng này sẽ báo năm
  chỗ ngay lập tức.
- **`SPLIT-4` — chữ được dịch xong trước khi băng qua.** Không có rule nào phân biệt được `"goal.failed"`
  với một câu tiếng người, vì cả hai đều là `string`. Thứ **gần** giữ được: cấm prop có hậu tố `Key`
  mang giá trị là string literal có dấu chấm phân cấp, tại điểm gọi trong `index.tsx`. Nó bắt được
  đúng cái hình dạng phổ biến nhất và bỏ sót mọi biến thể khác — và nó sẽ báo nhầm một `selectedKey`
  nếu không loại trừ theo nghĩa. Phần còn lại chỉ người đọc giữ được.
- **`SPLIT-6` — không có request thì không tách.** Rule sẽ phải nhìn thấy một folder có `component.tsx`
  trong khi `index.tsx` **không** gọi bất cứ thứ gì thuộc họ "đọc thế giới", rồi báo rằng file thứ hai
  là thừa. Về mặt AST điều này làm được — nó chính là mặt ngược của
  `connected-block-has-presentational-twin`. Lý do chưa làm không phải kỹ thuật: một folder đang trên
  đường thêm request sẽ bị báo sai trong đúng khoảng thời gian nó chưa gọi request, và một rule báo
  đúng vào lúc sai là một rule người ta sẽ tắt.
- **Phạm vi của `SPLIT-5` hẹp hơn chữ của nó.** Luật nói "surface có request"; rule chỉ đọc tier
  block. Đây là chỗ audit này **không đồng ý** với hiện trạng nhưng không tự sửa: mở rộng matcher
  sang page, layout và overlay là một thay đổi luật, phải đi qua `changelog.md`, không phải một lần
  chỉnh regex lặng lẽ.
- **Sáu mã, sáu neo, nhưng hai neo là kết quả RỖNG.** `SPLIT-1` và `SPLIT-2` được neo bằng "grep ra
  không có gì". Neo âm là neo thật, nhưng nó chỉ chứng minh **hiện trạng sạch**, không chứng minh
  luật sẽ tiếp tục được giữ khi rule không phủ tới — đúng như trường hợp `SPLIT-3` đã cho thấy.

## Re-audit Triggers

- Có đề xuất thêm hoặc bỏ một mã `SPLIT-<n>`.
- `sources/fe/the-split.mjs` publish thêm rule, hoặc đổi phạm vi matcher của rule đang có.
- Một `component.tsx` xuất hiện lời gọi thuộc họ "đọc thế giới" mà rule không báo.
- Một file connected xuất hiện `className` hoặc một JSX identifier khác ngoài sinh đôi.
- Số file `component.tsx` nhận cờ vòng đời làm prop tăng lên so với lần đo trước.
- Có ai đề nghị một ngoại lệ cho "block mỏng", dưới bất kỳ tên gọi nào.
- Một ví dụ trong `example.md` cần tên riêng của một sản phẩm mới đọc được.
