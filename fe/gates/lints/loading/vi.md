---
id: fe-lints-loading-vi
title: vi.md
slug: /gates/lints/loading/vi
sidebar_label: vi.md
sidebar_position: 1
description: Ba quy tắc giữ luật loading — bắt gì, giữ mã nào, và cửa nào còn mở.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `loading`

Tài liệu này không viết lại luật. Luật nằm ở `fe/canon/patterns/loading.md`. Ở đây chỉ ghi **phần
máy nhìn thấy được** của luật đó, và — phần hiếm ai chịu viết ra — **phần máy không nhìn thấy**.

Vì sao luật này đáng có máy giữ, nói một lần cho cả ba quy tắc: một hình dạng lúc chờ **không có
mệnh đề nào để sai**. Nó không vỡ kiểu, không đỏ test, không ném lỗi. Nó chỉ sai trên màn hình, và
chỉ trong đúng một giây có người tình cờ đang nhìn. Đó chính xác là loại khuyết tật mà không có công
cụ nào khác sẽ báo — nên nếu không đặt quy tắc lint, sẽ không bao giờ có ai báo cả.

## Bảng tra nhanh

| Quy tắc | Mã luật | Bắt gì |
|---|---|---|
| `no-resting-twin-component` | `LOADING-1` | Một tệp có tên kết thúc bằng `Skeleton` nằm trong cây thành phần — tức là một bản mô tả thứ hai của một hình dạng đã có bản mô tả |
| `no-placeholder-prop` | `LOADING-1` | Một cây dựng sẵn được truyền vào qua thuộc tính `skeleton`, `placeholder` hoặc `fallback`; và một binding `*Skeleton` nhập vào theo đường dẫn tương đối |
| `no-resting-branch-at-call-site` | `LOADING-2` | Một cờ chờ chọn giữa **hai phần tử gốc khác tên** ngay tại nơi gọi |

Bảy mã trong luật, hai mã có người giữ. Năm mã còn lại — `LOADING-3` tới `LOADING-7` — không có quy
tắc nào. Xem `audit.md`; không bịa ánh xạ để bảng trông cho đầy.

---

## `no-resting-twin-component`

**Bắt gì?** Một tệp **mang tên** một bản sao hình dạng. Đường dẫn kết thúc bằng
`<Tên>Skeleton/index.tsx` hoặc `<Tên>Skeleton.tsx`, trong đó `<Tên>` chỉ gồm chữ và số. Báo một lần
duy nhất trên nút `Program`, nghĩa là **cả tệp** là phát hiện, không phải một dòng nào trong đó.

**Giữ mã nào?** `LOADING-1` — một hình dạng, hai trạng thái; không bao giờ hai cây.

**Phát hiện thế nào?** Chỉ bằng **tên tệp**. Nội dung tệp không hề được đọc để ra quyết định này. Đường
dẫn được chuẩn hoá `\` thành `/`, phải chứa `/src/components/`, không được kết thúc bằng
`.test.tsx`/`.spec.tsx`, rồi khớp với hai biểu thức chính quy nói trên. Bộ đếm dừng ở đó.

**Vì sao nên để máy giữ luật này?** Một bản sao hình dạng **không thể được giữ cho khớp**. Nó chỉ
có thể bị phát hiện *sau khi* đã lệch. Người sửa thành phần thật không có lý do gì để mở tệp bên
cạnh, và không có gì nhắc họ. Một quy tắc theo tên tệp thì thô, nhưng nó bắt được đúng cái khoảnh
khắc bản sao *ra đời* — lúc rẻ nhất để từ chối nó.

**Những chỗ còn lọt.**

- Đổi tên là thoát sạch: `AvatarPlaceholder`, `AvatarLoading`, `AvatarShimmer`, `AvatarResting`,
  `avatar-skeleton.tsx`, `Card.Skeleton.tsx` — không cái nào khớp. Chỉ chữ `Skeleton` viết đúng hoa
  thường, và một dấu chấm hay gạch nối trong tên tệp là hết khớp.
- Đặt bản sao **bên trong một tệp có tên hợp lệ** thì vô hình hoàn toàn:
  `export const AvatarSkeleton = () => …` nằm trong `Avatar/index.tsx`. Quy tắc không đọc khai báo.
- `AvatarSkeleton/view.tsx` thoát: mẫu thứ nhất đòi `index`, mẫu thứ hai đòi tên trên chính tệp.
- `AvatarSkeleton.jsx` thoát: phần mở rộng chỉ nhận `tsx?`.
- Ra khỏi `/src/components/` là quy tắc **không tồn tại**.

---

## `no-placeholder-prop`

**Bắt gì?** Hai chuyện, cùng một tội.

1. `prop` — một phần tử JSX dựng sẵn đưa vào qua thuộc tính tên đúng là `skeleton`, `placeholder`
   hoặc `fallback`.
2. `import` — một binding có tên cục bộ dạng `*Skeleton` nhập vào từ một đường dẫn **tương đối**.
   Tên đúng bằng `Skeleton` được miễn: đó là nguyên thuỷ mà một thành phần **nghỉ bằng**, không phải
   bản sao của một thành phần.

**Giữ mã nào?** `LOADING-1`, ở dạng "trao từ bên ngoài". Xa hơn một bản sao thường một bậc: thành
phần bị mô tả thậm chí không nhìn thấy bản mô tả của chính nó.

**Phát hiện thế nào?** Nửa `prop`: thăm `JSXAttribute`, `name.type` phải là `JSXIdentifier`, `name.name`
phải nằm trong đúng ba chuỗi trên, giá trị phải là `JSXExpressionContainer`, và
`expression.type` phải là `JSXElement` hoặc `JSXFragment`. Nửa `import`: thăm `ImportDeclaration`,
`source.value` phải khớp `^\.\.?\/`, rồi từng `specifier.local.name` khớp `^[A-Za-z0-9]*Skeleton$`.

**Vì sao nên để máy giữ luật này?** Một cây nghỉ truyền vào bằng prop là thứ trông **lịch sự nhất**
trong ba tội: nơi gọi có vẻ đang "cấu hình", không phải đang vẽ lại. Chính vẻ lịch sự đó khiến không
ai chặn nó trong review. Máy không bị vẻ ngoài đánh lừa.

**Những chỗ còn lọt.**

- **Gom vào một cái tên là thoát.** `const resting = <AvatarBar/>` rồi `skeleton={resting}`: biểu
  thức là `Identifier`, không phải `JSXElement`. Tương tự `skeleton={SHAPES.avatar}`,
  `skeleton={renderResting()}`, `skeleton={<AvatarBar/> as ReactNode}`, `fallback={a ? <A/> : <B/>}`.
- **Truyền tham chiếu thay vì phần tử**: `skeleton={AvatarBar}`.
- **Tên thuộc tính thứ tư**: `loadingView`, `restingSlot`, `emptyState`, `renderSkeleton={() => …}`.
  Danh sách đóng ở ba tên.
- **Cây nằm trong một prop dạng đối tượng**: `props={{ fallback: <AvatarBar/> }}` là một `Property`
  trong `ObjectExpression`, không phải `JSXAttribute`. Ở nơi mọi thứ đều đi qua một prop đối tượng,
  quy tắc này gần như không thấy gì.
- **Nhập theo alias**: `from "@/components/…"` không bắt đầu bằng `./` hay `../` nên không bị xét.
- **Đổi tên khi nhập**: `import { AvatarSkeleton as Resting }`, hoặc `import * as Shapes`. Chỉ tên
  cục bộ được đọc, tên gốc thì không.

---

## `no-resting-branch-at-call-site`

**Bắt gì?** Một biểu thức ba ngôi mà **văn bản điều kiện** chứa `isLoading`, `isSkeleton` hoặc
`isPending`, và **hai nhánh là hai phần tử gốc khác tên nhau**.

**Giữ mã nào?** `LOADING-2` — phần tử lúc nghỉ là **cùng một phần tử**, đã rút giá trị ra.

**Phát hiện thế nào?** Thăm `ConditionalExpression`. Điều kiện được **đọc ngược lại thành chuỗi** bằng
`sourceCode.getText(node.test)` rồi khớp `\bis(?:Loading|Skeleton|Pending)\b` — đây là so khớp văn
bản, không phải phân tích ngữ nghĩa. Mỗi nhánh được rút về **một chuỗi**: `JSXElement` thành tên thẻ
mở (kể cả dạng `Card.Body`), `JSXFragment` thành `"<>"`, mọi thứ khác thành `null`. Chỉ báo khi cả
hai chuỗi đều tồn tại **và khác nhau**.

`null` ở một nhánh cố ý không bị báo: một điều khiển chưa có nơi để đi là `LOADING-5` đang **đúng**,
không phải một cây thứ hai.

**Vì sao nên để máy giữ luật này?** Nhánh tại nơi gọi là cách rẻ nhất để viết ra một cây thứ hai —
không cần tạo tệp, không cần đặt tên, không để lại dấu vết nào ngoài một dòng dài. Nó cũng là cách
duy nhất trong ba cách mà tác giả *biết* mình đang mô tả hình dạng của thứ khác, nên là chỗ đáng
chặn ngay khi gõ.

**Những chỗ còn lọt.**

- **Cùng tên thẻ gốc là đi lọt.** `isLoading ? <div className="h-4 animate-pulse"/> : <div><Avatar/><Text/></div>`
  — hai bên đều rút về `div`, bằng nhau, quy tắc trả về. Hai cây hoàn toàn khác nhau đi qua như một.
  Bọc chung một vỏ cũng vậy: `<Row>…</Row>` ở cả hai nhánh.
- **Đọc trạng thái ngay tại chỗ**: `input.state === "pending" ? <AvatarBar/> : <Avatar/>` hoàn toàn
  vô hình, vì mẫu đòi chữ `is` đứng trước. Đây đúng là biểu thức mà đoạn "đường nối" của luật đang
  nói tới.
- **Cờ có thêm danh từ**: `isLoadingCourses`, `isPendingReview` — `\b` sau `Loading` gãy vì ký tự
  tiếp theo vẫn là ký tự từ.
- **Cách gọi khác của "đang chờ"**: `loading`, `busy`, `isFetching`, `isWaiting`, `!data`.
- **Không viết bằng ba ngôi**: `if (isLoading) return <AvatarBar/>`, cặp `{isLoading && …}` /
  `{!isLoading && …}`, hoặc `switch` trên union trạng thái. Chỉ `ConditionalExpression` được thăm.
- **Chọn thành phần vào một biến**: `const El = isLoading ? AvatarBar : Avatar` rồi `<El/>`. Hai
  nhánh là `Identifier`, `armName` trả `null`.

---

## Luật

1. Danh tính của một quy tắc là **tên nó công bố**. Không đặt mã số riêng cho quy tắc; mã số thuộc
   về luật mà nó giữ.
2. Chỉ ghi những quy tắc **có thật** trong tệp nguồn. Một quy tắc "đáng lẽ nên có" thuộc về
   `audit.md`.
3. Mỗi quy tắc phải có ít nhất một hàng trung thực ở bảng **cửa còn mở**. Viết "không có" cho gọn là
   sai lệch nguy hiểm hơn cả việc không có quy tắc nào.
4. Ba quy tắc đều `type: "problem"`, đều `schema: []`, đều không có bản vá tự động. Mọi phát hiện đều
   là một quyết định hình dạng mà con người phải làm.
5. Phạm vi được quyết định **trước tiên**; ngoài `/src/components/` thì `create` trả về đối tượng
   rỗng và quy tắc không tốn gì.

## Ngoại lệ

- **Tệp test.** `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx` được miễn cả ba. Một bản sao dựng
  tay trong test là **vật liệu để đối chiếu**, không phải bản mô tả thứ hai mà ai đó vẽ ra màn hình.
- **Ngoài cây thành phần.** Ghi ra như một ngoại lệ vì nó rộng nhất: ba quy tắc chỉ quản cây thành
  phần, không quản gì khác.
- **Nguyên thuỷ nghỉ.** Binding có tên đúng bằng `Skeleton` được miễn ở nửa `import`. Nó **không**
  được miễn ở `no-resting-twin-component`, và chỗ bất nhất này là một phát hiện — xem `audit.md`.
- **Ba ngôi có `null` một bên.** Cố ý bỏ qua.
- **Thuộc tính `placeholder` dạng chuỗi.** `placeholder="Tìm kiếm"` không bao giờ bị báo.
