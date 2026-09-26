# shape-slot

Mẫu FE chuẩn cho pattern **shape + slot**, đi qua đủ các tầng.
Stack: Next.js 15, React 19, SWR, react-hook-form + zod, next-intl, `@starci/grammar`, `@starci/eslint-canon-fe`.

```bash
npm install
npm run lint                                                       # eslint-canon-fe, kể cả law shape-slot: 0 lỗi
npm run typecheck                                                  # tsc: 0 lỗi
npm run test:unit                                                  # audit spec: 27/27
node ../../scripts/checks/architecture.mjs . --config architecture.json   # architecture check: ok
```

## Hai trục
- **shape** (`state`): hình thù giao diện. Mỗi giá trị là 1 bản vẽ.
- **slot**: dữ liệu của 1 API. Mỗi slot có tình trạng riêng: `isLoading`, `isForbidden`, `isError` hoặc trống.
  Tình trạng render theo công thức (`composites/SlotView`) và không bao giờ vẽ.

## Tên (thống nhất, không đặt tuỳ ý)

| Tầng | Connected (`index.tsx`, export ra ngoài) | Pure (`component.tsx`, được vẽ và audit) | Type |
|---|---|---|---|
| Page | `OperatePage` | `OperatePageBase` | `OperatePageProps`, `OperatePageBaseProps`, `OperatePageState` |
| Layout | `WorkspaceLayout` | `WorkspaceLayoutBase` | `WorkspaceLayoutProps`, `WorkspaceLayoutBaseProps`, `WorkspaceLayoutState` |
| Overlay | `SendHandoffOverlay` | `SendHandoffOverlayBase` | `…Props`, `…BaseProps`, `…State` |
| Block | `HandoffBlock` | `HandoffBlockBase` | `…Props`, `…BaseProps`, `…State`, `…Data`, `…Actions`, `…Labels` |

- Chỉ dùng `export const X = …`, không có `export default`.
- Ngoại lệ duy nhất là file route của Next: `const Page = …` rồi `export default Page`.
- Hook SWR:
  - đọc: `useQueryXSwr` + `QUERY_X_SWR_KEY` + `UseQueryXSwrParams`;
  - ghi: `useMutateXSwr` + `MUTATE_X_SWR_KEY` + `MutateXSwrArg`.
- Tên file trùng tên export.

## Các tầng

| Tầng | Thư mục | Trong mẫu | Shape | Gọi API |
|---|---|---|---|---|
| Route | `app/` | `[workspaceId]/layout.tsx`, `operate/[handoffId]/page.tsx` | – | không |
| Page | `features/pages/<Name>/` | `OperatePage` | `view` / `edit` | không; chỉ ghép Block bằng atom |
| Layout | `features/layouts/<Name>/` | `WorkspaceLayout` | `sidebar` / `mobile` | không |
| Overlay | `features/overlays/<domain>/<Name>/` | `SendHandoffOverlay` | `form` / `confirm` | chỉ gọi lệnh (mutation); form dùng react-hook-form + zod |
| Block | `components/blocks/<domain>/<Name>/` | `HandoffBlock` (2 slot), `SendHistoryBlock` (1 slot), `ModuleNavBlock`, `WorkspaceHeaderBlock` | ví dụ `prepared` / `sent` / `returned` | **có**: mỗi Block tự gọi API của nó |
| Branch | `components/branches/<Name>/` | `DrawerBranch`, `OrderDisclosure` | không | không; chỉ có tương tác nội tại |
| Composite | `components/composites/<Name>/` | `OrderSummary`, `SlotView` | không | không |
| Leaf | `components/leaves/<Name>/` | `MoneyText`, `StatusChip` | không | không |
| Hook | `hooks/<domain>/` | `sales` (SWR), `slot` (`useSlotLabels`), `ui` (chỉ hook nội tại như `useMediaQuery`) | – | đi qua `modules/` |
| Module | `modules/` | `api/sales` (transport + schema zod), `slot` (`Slot`, `toSlot`, `SlotLabels`) | – | là tầng transport |

## Luật (lint `starci-fe/*` bắt tự động)

| # | Luật | Rule |
|---|---|---|
| 1 | `component.tsx` chỉ nhận `{ state, props, on }`:<br>- `props` là atom;<br>- `on` là hàm, tham số là atom;<br>- riêng Layout nhận thêm `children` của router. | `base-props-atom` |
| 2 | Chỉ `index.tsx` cùng thư mục (và spec) được import `component.tsx`. `index.tsx` không re-export `XBase`. | `base-import-pair` |
| 3 | `XState` chỉ liệt kê hình thù. Không được có `pending` / `loading` / `failed` / `empty` / `closed` / … | `no-data-status-shape` |
| 4 | `component.tsx` của Block không tự rẽ nhánh theo `isLoading` / `isError` / `isForbidden`; mọi slot đi qua `SlotView`. | `slot-status-through-slotview` |
| 5 | `XBase` nhận `XBaseProps`; `X` nhận `XProps`. | `public-component-signature` |
| 6 | Không có chữ tiếng Việt trong source; chữ hiển thị nằm trong `messages/`. | `no-second-language-in-source` |

Ngoài các rule lint ở trên còn 3 quy ước:
- Tình trạng dữ liệu (kể cả 403) tính riêng cho từng slot, tức từng API, và chỉ Block có. Page, Layout và Overlay không có tình trạng dữ liệu.
- Route 404 do `notFound()` xử lý.
- Mỗi `component.tsx` có `xDefaultState`: đó là shape dùng để vẽ skeleton khi slot còn đang tải.
