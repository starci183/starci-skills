---
id: fe-lints-the-split-vi
title: vi.md
slug: /fe/lints/the-split/vi
sidebar_label: vi.md
sidebar_position: 1
description: Hai luật máy giữ được của the split — bắt gì, nhìn bằng gì, và cửa nào còn mở.
---

# vi.md

> Phiên bản: `2.00` · Mô-đun: `the-split`

# Hai luật máy giữ được

Luật `the split` nói sáu điều. **Máy chỉ giữ được hai.** Đây không phải thiếu sót lười biếng, mà là
hình dạng của bài toán: một tệp có gọi mạng, có đọc kho trạng thái, có tra chữ dịch thì **nhìn thấy
được** trong danh sách lời gọi của nó; còn một tệp vẽ sai — sai cây, sai đường nối, thiếu trạng thái —
thì trông y hệt một tệp vẽ đúng. Nên máy đứng canh ở phía nó nhìn được, phía còn lại là việc của
người duyệt.

Tài liệu này ghi lại **cái máy thấy** và, quan trọng hơn, **cái máy không thấy**. Một cửa lách chưa
ai biết còn nguy hiểm hơn một điều luật không có luật máy nào giữ: điều luật không có máy giữ thì ai
cũng biết là chưa được giữ, còn một luật máy rò rỉ thì ai cũng tưởng nó đã đóng.

## Bảng tra nhanh

| Luật | Mã luật | Bắt gì |
|---|---|---|
| `presentational-purity` | `SPLIT-1` | Nửa vẽ gọi thẳng ra thế giới: một yêu cầu mạng, một kho trạng thái, thời gian chạy dịch thuật, hoặc một truy vấn trực tiếp |
| `connected-block-has-presentational-twin` | `SPLIT-5` | Một block đã đọc thế giới mà không nhập, hoặc không vẽ, hoặc vẽ thêm cái gì ngoài đúng bản sao `_<TênThưMục>` của nó |

---

## `presentational-purity`

**Bắt gì?** Trong tệp tên `component.tsx`, mọi lời gọi mà **tên hàm** rơi vào một trong bốn họ: yêu
cầu mạng (`useSWR`, `useSWRMutation`, `use…Swr`), kho trạng thái (`useAppSelector`, `useDispatch`,
`use…Store`), thời gian chạy dịch thuật (`useTranslations`, `useLocale`, `useFormatter`), và truy vấn
trực tiếp (`query<ChữHoa>…`, `mutation<ChữHoa>…`). Mỗi lời gọi khớp là một báo lỗi `reaches`.

**Giữ mã nào?** `SPLIT-1` — nửa vẽ nhận mọi thứ đã quyết và không tự đi hỏi cái gì.

**Phát hiện thế nào?**

- Phạm vi: lấy `context.filename` (không có thì `context.getFilename()`), đổi hết `\` thành `/`, rồi
  thử với `/(?:^|\/)component\.tsx$/`. Ngoài phạm vi, `create` trả về **object rỗng** — luật không
  tồn tại trên tệp đó chứ không phải tệp đó "đạt".
- Trong phạm vi: đúng **một** visitor, `CallExpression`. Bắt buộc `node.callee.type === "Identifier"`,
  rồi thử `callee.name` với một biểu thức chính quy hợp của bốn họ. Báo lỗi neo vào chính node lời gọi
  và chèn tên đã khớp vào thông điệp.

**Vì sao nên để máy giữ luật này?** Vì hậu quả của nó là **không dựng được từ dữ liệu mẫu**. Một tệp
vẽ có gọi mạng thì muốn kiểm thử nó phải dựng cả thế giới lên trước; và cái giá đó không hiện ra lúc
viết, nó hiện ra sáu tháng sau khi ai đó muốn viết bài kiểm thử đầu tiên. Con mắt người duyệt bỏ sót
một dòng `useTranslations` giữa hai trăm dòng JSX là chuyện thường; máy thì không bỏ sót dòng nào.
Thêm nữa, mỗi báo lỗi ở đây là một **lần dời chỗ**, không phải một lần xoá: lời gọi vẫn phải nằm đâu
đó, và chỗ đó là nửa còn lại.

**Những chỗ còn lọt.**

- **Gọi qua thuộc tính.** `hooks.useTranslations()`, `store.useAppSelector()`, `client.queryOrder()` —
  visitor thoát ngay khi `callee.type !== "Identifier"`. Thế giới đi vào qua một namespace và không ai
  báo gì.
- **Hàm bọc mang tên bình thường.** `useOrderData()`, `useRowsFor(id)`, `loadSummary()` — không họ nào
  khớp. Đây là động tác **dọn dẹp** thông thường, không phải phá hoại: ai đó gom lời gọi vào một hook
  riêng cho gọn, và luật tắt.
- **Hậu tố viết hoa hết.** Họ yêu cầu đúng chữ `Swr`; `useOrderSWR()` nằm ngoài.
- **Đổi tên lúc nhập.** `import { useTranslations as translate }` rồi gọi `translate("x")`. Luật này
  **không đọc import lần nào**. Luật anh em đóng đúng cái lỗ này, luật này thì không.
- **Với tay qua con, không qua lời gọi.** Nửa vẽ nhập một block đã nối và vẽ `<OrderTotal />`. Không có
  `CallExpression` nào trong tệp này mang tên thế giới, nên không có báo lỗi.
- **Phạm vi theo tên tệp.** `view.tsx`, `presentation.tsx`, `Component.tsx` (chữ C hoa),
  `component.jsx` — luật biến mất. Tên tệp là thứ rẻ nhất trong một kho mã để đổi.
- **Chữ "purity" hứa nhiều hơn nó làm.** Luật không nhìn props, không nhìn tác dụng phụ, không nhìn
  `useEffect`, `fetch`, `Date.now()`, cũng không nhìn khoá dịch đi qua ranh giới. "Thuần" ở đây nghĩa
  là "không gọi bốn họ tên hàm", không hơn.

---

## `connected-block-has-presentational-twin`

**Bắt gì?** Một tệp `index.tsx` nằm trong một thư mục block viết hoa, **và đã đọc thế giới**. Khi đó:

- không nhập đúng `_<TênThưMục>` từ `./component` ⇒ `missing`, và dừng ở đó;
- có nhập, nhưng vẽ thêm bất kỳ thẻ JSX nào khác ⇒ một `bypass` cho **mỗi** thẻ lạ;
- có nhập mà không vẽ bản sao lần nào ⇒ `unused`.

Tệp không đọc thế giới thì không bao giờ bị báo.

**Giữ mã nào?** `SPLIT-5` — nửa đã nối không tự vẽ gì cả.

**Phát hiện thế nào?**

- Phạm vi: tên tệp đã chuẩn hoá thử với
  `/\/src\/components\/blocks\/(?:[^/]+\/)*([A-Z][A-Za-z0-9]*)\/index\.tsx$/`. Nhóm bắt số 1 là tên
  thư mục, và bản sao là chuỗi `_` cộng tên đó — **suy ra**, không cấu hình.
- `ImportDeclaration`: đặt `importsTwin` **chỉ khi** chuỗi nguồn đúng bằng `./component` và có một
  specifier thoả `imported.name === local.name === twin`. Song song, mọi specifier có `imported.name`
  khớp họ thế giới được thêm vào một tập tên cục bộ, bất kể nguồn nào.
- `CallExpression`: đặt `readsWorld` khi callee kiểu `Identifier` nằm trong tập đó **hoặc** tự nó khớp
  họ thế giới.
- `JSXOpeningElement`: đẩy **mọi** tên thẻ kiểu `JSXIdentifier` vào danh sách đã vẽ, và bật
  `rendersTwin` khi trùng khít.
- `Program:exit`: chưa đọc thế giới thì im lặng; rồi mới lần lượt `missing` → `bypass` → `unused`.

**Vì sao nên để máy giữ luật này?** Vì đây là chỗ luật bị lách bằng **lý lẽ nghe rất hợp lý**: "block
này mỏng thôi", "có mỗi một lá", "trạng thái nào cũng cùng một cây". Ba câu đó đều đúng vào lúc nói và
đều sai sáu tuần sau, khi trạng thái thứ hai xuất hiện và ranh giới đã mất từ lâu. Người duyệt rất khó
từ chối một lý lẽ hợp lý; máy thì không có nhánh nào để nghe lý lẽ — trong mã nguồn **không hề có**
ngoại lệ block mỏng. Thêm nữa, `bypass` bắt cả thẻ HTML thường: một `<div>` bọc ngoài cũng là nửa đã
nối bắt đầu tự vẽ.

**Những chỗ còn lọt.**

- **Giặt sạch lời gọi thế giới là tắt luôn cả luật.** `readsWorld` là cổng duy nhất. Một
  `useOrderData()` bọc sẵn khiến `Program:exit` trả về ngay, và block **biến mất** khỏi tầm nhìn chứ
  không phải "vi phạm". Hai luật dùng chung một bộ dò, nên một lần bọc hạ cả hai.
- **Nhập mặc định rồi đổi tên.** `import swr from "…"` — specifier mặc định không có `imported`, tên
  cục bộ lại không khớp họ nào.
- **Vẽ mà không dùng JSX.** `createElement(Row, props)` là `CallExpression`, không bao giờ là
  `JSXOpeningElement`. Nếu bản sao vẫn được vẽ ở một nhánh JSX khác thì `rendered` chỉ có bản sao,
  `rendersTwin` bật, và cả một cây thay thế đi lọt.
- **Thẻ có dấu chấm.** `<Ui.Card>`, `<Icons.Spinner>` — `node.name.type` là `JSXMemberExpression`,
  visitor thoát trước khi đẩy vào danh sách. Vẽ nguyên một cây bằng namespace thì không ai báo.
- **Đường dẫn phải đúng một chuỗi ký tự.** Ngoài `/src/components/blocks/`, thư mục phải bắt đầu bằng
  chữ hoa, và cửa vào phải tên `index.tsx`. Đặt bề mặt ở `src/features/`, `src/app/`, hay bỏ `src/`,
  hay vào bằng `index.ts` — không có luật nào ở đó cả.
- **Luật không bao giờ mở `component.tsx` ra xem.** "has presentational twin" được quyết bằng **một cái
  tên**. `_X` có thể chưa tồn tại, có thể được xuất từ chỗ khác, có thể tự nó gọi mạng, có thể vẽ một
  cái `<div>` rỗng. Luật chỉ kiểm rằng `index.tsx` có nhập đúng chuỗi đó và có vẽ đúng thẻ đó.
- **Đổi tên khi nhập là báo nhầm chứ không phải lọt.** `import { _Order as View }` hay
  `import * as View from "./component"` đều làm `importsTwin` sai và sinh `missing` cho một tệp viết
  đúng tinh thần. Đây là ma sát, không phải cửa lách — nhưng phải biết trước để không đi gỡ luật.

---

## Luật

1. Danh tính của một luật là **tên đã công bố** của nó. Mô-đun này không đặt thêm mã số nào cho luật.
2. Mỗi luật đọc đúng một tệp. Không luật nào mở nửa còn lại ra xem.
3. Không luật nào nhận tuỳ chọn: cả hai khai báo `schema: []`. Kho mã chỉ còn một núm là mức nghiêm
   trọng, và mức đã công bố là `error`.
4. Ngoài phạm vi nghĩa là **không cài visitor**, không phải "tệp đó đạt".
5. Tên bản sao suy ra từ tên thư mục; phép nhập phải khít cả ba: chuỗi nguồn, tên nhập, tên cục bộ.
6. Một lời gọi khớp ở bất kỳ đâu trong tệp là đủ để bật `readsWorld` cho cả tệp.

## Ngoại lệ

**Không có ngoại lệ nào trong mã nguồn.** Không tuỳ chọn, không danh sách miễn, không nhánh block
mỏng, không opt-out theo tệp. Chính văn bản luật cũng nói thẳng: một lá, một cây ở mọi trạng thái,
không có trạng thái nghiệp vụ cục bộ, hay một bản sao chỉ chuyển tiếp props — tất cả vẫn phải đi qua
đúng bản sao đó.

Lối ra duy nhất là một dòng comment tắt luật, và mô-đun này **không cấp** dòng nào. Kho mã nào cần một
ngoại lệ thì đó là một **thay đổi luật**, và chỗ của nó là `changelog.md`, không phải dòng comment
phía trên lời gọi.
