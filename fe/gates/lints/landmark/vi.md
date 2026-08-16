---
id: fe-lints-landmark-vi
title: vi.md
slug: /gates/lints/landmark/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hai rule của luật landmark — bắt gì, giữ mã nào, phát hiện bằng cách nào, và cửa nào còn mở.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `landmark`

# Landmark

Landmark là nhóm nhỏ các phần tử mà người đọc có thể **nhảy giữa chúng** mà không cần đọc bên trong.
Một hộp trung tính và một landmark bày ra y hệt nhau, và chỉ một trong hai là lý do tồn tại của
"skip to main content".

Kho đăng ký làm cho sai sót này **im lặng**. Một khoá tên `<vùng>-main` ghi lại đúng ý định và vẽ ra
một hộp trung tính, vì nhánh vẽ node của kho đăng ký vẽ hộp trung tính. Không có gì đỏ lên: **tên
trong khoá không phải phần tử trong tài liệu.**

Tài liệu này không nói về luật. Nó nói về **thứ máy giữ được** của luật đó — và, quan trọng hơn,
**thứ máy không giữ được**.

## Bảng tra nhanh

| Rule | Mã luật | Bắt gì |
|---|---|---|
| `routed-page-is-a-main-landmark` | `LANDMARK-4` | Layout của route vừa vẽ children vừa tự dựng chrome, mà cả file không có landmark nào |
| `main-landmark-belongs-to-a-route-file` | `LANDMARK-5` | Landmark được vẽ ở một file không sở hữu **cả màn hình** |

Ba mã `LANDMARK-1`, `LANDMARK-2`, `LANDMARK-3` **không có rule nào**. Đây là một finding, ghi ở
`audit.md`, không phải chỗ để bịa ra một ánh xạ cho đẹp bảng.

---

## `routed-page-is-a-main-landmark`

**Bắt gì?** Một layout của route đã **tự dựng chrome** — tức là nó tự vẽ khung điều hướng quanh trang
được route tới — nhưng không hề đánh dấu trang đó là landmark. Người dùng bàn phím và trình đọc màn
hình không có chỗ nào để nhảy tới; họ phải đi hết thanh điều hướng mỗi lần đổi trang.

**Giữ mã nào?** `LANDMARK-4`.

**Phát hiện thế nào?**

1. **Cổng theo tên file.** Chỉ chạy khi đường dẫn (đã đổi `\` thành `/`) khớp
   `/\/app\/(?:.*\/)?layout\.tsx$/`. Ngoài đó rule không tồn tại.
2. **Ba biến bool độc lập**, gom trên **toàn bộ file**:
   - *vẽ children*: một `JSXExpressionContainer` mà biểu thức là `Identifier` tên `children`,
     **hoặc** bất kỳ `Identifier` tên `children` nào có cha không phải `Property`.
   - *tự dựng chrome*: có `JSXOpeningElement` mang đúng tên nhánh khung trung tính, ở dạng
     `JSXIdentifier` trần.
   - *có landmark*: có bất kỳ phần tử landmark nào, theo một trong hai hình dạng ở dưới.
3. **Báo lỗi ở `Program:exit`** khi *vẽ children* và *tự dựng chrome* đều đúng còn *có landmark* sai.

**Hai hình dạng của một landmark.**

- **Hình dạng một — nhánh có tên.** Phần tử JSX mang đúng tên nhánh landmark, so khớp với một tập
  **một phần tử**.
- **Hình dạng hai — khung mà entry khai `host: "main"`.** Một phần tử bất kỳ khác mang thuộc tính
  `contract` với giá trị là **string literal**, và bảng entry tìm được bằng cách đi ngược lên từ file
  đang lint khai `host: "main"` cho khoá đó. Bảng được đọc **bằng văn bản**, không parse.

**Vì sao nên để máy giữ luật này?** Vì đây đúng là loại sai sót mà **không có gì đỏ lên**. Trang
render đẹp, khoá đặt tên chuẩn, test xanh, TypeScript im lặng. Cái mất đi chỉ hiện ra khi có người
thật dùng bàn phím thật — và lúc đó nó đã đi qua mọi lần review. Một luật mà mắt người review không
nhìn thấy được hậu quả là luật cần máy.

**Những chỗ còn lọt.**

- **Đổi tên prop là rule biến mất.** `function Layout({ children: content })` — chữ `children` bây
  giờ là **key của một `Property`**, đúng nhánh bị bỏ qua; và không còn định danh nào tên `children`
  trong file. Một lần đổi tên, rule ngừng tồn tại cho file đó.
- **Đặt bí danh cho nhánh khung.** `import { Tree as Frame }` rồi dùng `<Frame>`, hoặc gọi qua
  `<X.Tree>` — cả hai đều không phải cái tên trần mà rule so khớp. Layout dựng chrome đầy đủ vẫn được
  đo là **không dựng chrome**, nên không bao giờ bị hỏi landmark.
- **Chuyển chrome vào một component vỏ.** Layout chỉ viết `<Shell>{children}</Shell>`; nó không gọi
  tên khung nào, còn `Shell` không phải layout của route và cũng **không được phép** giữ landmark vì
  rule thứ hai cấm. Hai rule cùng im, tài liệu ra đời có chrome mà không có landmark.
- **Landmark bọc nhầm thứ.** Ba biến bool không hề được so với nhau về cấu trúc. Vẽ landmark quanh
  thanh điều hướng rồi ném `children` cho một leaf trơn là **thoả rule hoàn toàn**.
- **`contract={"khoa"}` thay vì `contract="khoa"`.** Giá trị thành `JSXExpressionContainer`, không
  còn là `Literal`. Hình dạng hai mù. Chỉ cần hai dấu ngoặc nhọn.
- **Khoá đi qua biến hoặc hàm.** `<Tree contract={keyFor(state)} />` — cũng nhánh đó, cũng im lặng.
  Đây không phải giả định: chọn giữa các entry anh em qua một hàm trả về khoá là cách viết bình
  thường.
- **Thư mục router không tên `app`, hoặc đuôi file khác.** Cổng ghi cứng cả đoạn đường dẫn lẫn `.tsx`.
  Đổi quy ước router thì rule **biến mất** chứ không phải báo sai.
- **Bất kỳ thư mục nào tên `app`.** Cổng chỉ đòi đoạn đó xuất hiện đâu đó. Một `layout.tsx` nằm dưới
  một thư mục `app` không liên quan vẫn bị coi là layout của route.
- **JSX chết vẫn tính.** Một landmark nằm trong nhánh không bao giờ render vẫn nằm trong AST, và vẫn
  làm *có landmark* thành đúng.

---

## `main-landmark-belongs-to-a-route-file`

**Bắt gì?** Một landmark được vẽ ở tầng **dưới** người sở hữu cả màn hình. Landmark thứ hai không phải
landmark mạnh hơn, nó là landmark **mơ hồ**: khi có ba cái, "nhảy tới nội dung chính" không còn nghĩa gì.

Đây chính là cái bẫy mà luật được viết ra để chặn: các khoá tên `<vùng>-main` là **cột đọc** bên trong
một trang, và vẽ chúng bằng nhánh landmark là đòi landmark ba lần trên một màn hình.

**Giữ mã nào?** `LANDMARK-5`.

**Phát hiện thế nào?**

1. **Miễn trừ theo đường dẫn.** File nào có đoạn thư mục của chính nhánh landmark trong đường dẫn thì
   rule trả về rỗng ngay.
2. **Hai vị từ theo tên file.**
   - *file route*: `/\/app\/(?:.*\/)?(?:layout|page)\.tsx$/`
   - *bề mặt trang*: `/\/components\/pages\/[A-Z][A-Za-z0-9]*\/(?:index|component)\.tsx$/`
3. **Trên mỗi `JSXOpeningElement`:**
   - Nếu là **nhánh landmark có tên** → báo lỗi khi **không phải file route**. Bề mặt trang **không**
     được miễn ở nhánh này.
   - Ngược lại, nếu là **khung mà entry khai `host: "main"`** → báo lỗi khi **không phải file route
     và cũng không phải bề mặt trang**.

**Hai tập file khác nhau cho hai hình dạng, và gộp chúng lại từng là một lỗi thật.** Nhánh landmark là
thứ có người **import về để bọc** một màn hình, nên nó ở lại file route; một trang với tay lấy nó
chính là cái bẫy. Còn khung mà **entry** khai host thì khác hẳn — không ai import landmark cả, kho
đăng ký nói khoá này mở phần tử nào và khung tuân theo. Entry đó do người vẽ node ngoài cùng của màn
hình render, và luật bố cục nói rõ file route **không phải** người đó.

Giữ cả hai hình dạng ở mỗi file route thì hai luật **từ chối lẫn nhau**: mọi trang bị chuyển ra khỏi
cây route để thoả luật bố cục đều bị báo là đặt sai landmark, và cách duy nhất thoả cả hai là để chủ
sở hữu trang nằm lại trong cây route — đúng cái khuyết tật luật bố cục sinh ra để chặn. **Một rule chỉ
thoả được bằng cách vi phạm rule khác là một finding về rule, không phải về code.**

**Vì sao nên để máy giữ luật này?** Vì hậu quả của nó **không nhìn thấy được trên màn hình**. Hai
landmark trông y hệt một landmark. Chỉ có công nghệ trợ năng đọc ra sự mơ hồ, và không ai review bằng
công nghệ trợ năng. Thêm nữa, tầng dưới là nơi sai sót **thật sự xảy ra**: người viết một block thấy
khoá tên `-main` và với tay lấy nhánh landmark cho hợp tên.

**Những chỗ còn lọt.**

- **Phần tử landmark viết tay bằng chữ thường.** Không hình dạng nào khớp: hình dạng một đòi tên nhánh
  viết hoa, hình dạng hai đòi một khoá contract. Cách viết sai **trực tiếp nhất** thì rule của luật này
  không nói gì.
- **Bí danh và member expression.** `import { Main as Screen }` rồi `<Screen>`, hoặc `<Branches.Main>`
  — cái sau còn hỏng ngay ở phép kiểm `name.type`. Landmark nằm trong một block, viết kiểu nào trong
  hai kiểu đó, đều không bị báo.
- **Chỉ có đúng một phần tử landmark được biết.** Tập nhánh landmark có **một** thành viên. Những
  landmark còn lại mà luật đã dự trù đều vô hình với cả hai rule, và người thêm nhánh mới cho một
  landmark khác **không được nhắc** phải thêm vào tập này.
- **Khoá không phải literal.** Y như rule trên: `contract={khoa}` trong một block mà entry khai
  `host: "main"` đi lọt sạch.
- **Miễn trừ là một đoạn đường dẫn, không phải một file.** BẤT KỲ file nào nằm trong thư mục của nhánh
  landmark đều được miễn toàn bộ rule — một helper, một story, một component thứ hai chuyển vào đó.
  Cấm theo thư mục không phải cấm theo file, và ở đây miễn trừ theo thư mục lách được bằng một lệnh
  `mv`.
- **Bề mặt trang ở layout khác thì thành báo sai.** Vị từ ghi cứng `/components/pages/`, đòi thư mục
  viết hoa và file tên `index` hoặc `component`. Một kho đơn-gói khác layout, một thư mục viết thường,
  hay một file đặt tên khác đều khiến một bề mặt trang **đúng luật** bị báo là đặt sai landmark.
- **Bảng entry thụt lề khác bốn dấu cách.** Cửa sổ chặn một entry tìm dấu xuống dòng, **đúng bốn** dấu
  cách, rồi một khoá trong ngoặc kép. Nếu bảng thụt hai dấu cách, cửa sổ chạy tới hết file và một entry
  không khai host sẽ **thừa hưởng** host đầu tiên nó gặp bên dưới.
- **JSX chết vẫn bị báo.** Một landmark nằm trong nhánh không bao giờ render vẫn bị tính là landmark
  thứ hai.
- **Một layout và một trang dưới nó cùng mở landmark.** Rule đọc một file mỗi lần, nên không thấy.
  Nguồn nói thẳng điều này thay vì để nó ngầm, và đó chính là lý do rule thu hẹp **chỗ được phép** thay
  vì đi đếm số lần.

---

## Luật

1. Danh tính của một rule là **tên được publish** của nó. Không có mã số thứ hai.
2. Một rule đọc **một file**. Thứ gì cần hai file là câu hỏi cho review, và phải được **viết ra** như vậy.
3. Bảng không đọc được thì **im lặng**, không bao giờ báo lỗi. Một cái đọc mà chẳng nhìn vào đâu thì
   không có quyền trả lời "ở đây không có gì".
4. Nhánh landmark và host do entry khai là **hai hình dạng** với **hai tập file** được phép giữ chúng.
5. Phép kiểm nhánh khung trong rule thứ nhất là một **phép thu hẹp**, không phải trang trí: bỏ nó đi
   thì rule sẽ đòi landmark ở đúng những file mà rule thứ hai từ chối.
6. Mọi rule publish ở mức `error`. `error` nghĩa là build gãy, không phải cảnh báo để xếp hàng xử lý.

## Ngoại lệ

Ngoại lệ là **một phần của cách giữ luật**, không phải chỗ lách.

- **Thư mục của chính nhánh landmark.** Miễn hoàn toàn khỏi rule thứ hai, vì file đó vẽ phần tử bằng
  tay và **bắt buộc phải thế**.
- **Layout gốc và layout chuyển tiếp.** Không được miễn bằng tên — chúng đơn giản là **không dựng
  chrome**, nên điều kiện thứ hai của rule thứ nhất sai. Đòi landmark ở một trong hai chỗ đó là tự đặt
  landmark thứ hai vào tài liệu.
- **Bề mặt trang.** Được phép render entry khai host landmark, và **không** được phép import nhánh
  landmark. Bất đối xứng này là cố ý: render node ngoài cùng của màn hình không phải cùng một hành
  động với việc import một landmark về để bọc thứ gì đó.
- **Bản ghi và cây sinh tự động.** **Không** được miễn ở đây. Cổng của rule thứ nhất và hai vị từ của
  rule thứ hai là bộ lọc duy nhất; một bản ghi chứa file mang hình dạng route sẽ bị lint như source.
