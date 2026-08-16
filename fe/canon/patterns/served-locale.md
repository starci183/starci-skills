# ngôn ngữ được phục vụ

## Định nghĩa

Một số dữ liệu được dịch trên máy chủ. Tài liệu khóa học, nội dung, tên danh mục - API
lưu trữ một cái cho mỗi ngôn ngữ và trả lại cái mà nó được yêu cầu. Có nghĩa là yêu cầu phải hỏi,
và một yêu cầu không nói gì sẽ nhận được mặc định của máy chủ, mãi mãi, ở mọi ngôn ngữ.

Đây không phải là luật tương tự như[`translation`](translation.md). Người đó quyết định **ai chọn
word** bên trong cây thành phần: nửa được kết nối giải quyết bản sao, không có gì bên dưới khối nói một từ
của riêng nó. Điều này giải quyết **những gì yêu cầu tuyên bố** trên đường đi. Một màn hình có thể tuân theo`translation`một cách hoàn hảo — mọi nhãn đều được giải quyết, không có chữ nào bên dưới một khối — và vẫn hiển thị một
Người đọc Việt một khóa học tiếng Anh, vì chrome đến từ từ điển và nội dung đến
từ một API chưa bao giờ được cho biết sẽ phân phát ngôn ngữ nào.

Câu hỏi quyết định xem nội dung nào đó có thuộc về nơi này hay không: **liệu người đọc bằng ngôn ngữ khác có nhận được
DATA khác với cuộc gọi này?** Nếu có, yêu cầu phải khai báo ngôn ngữ và phải
khai báo nó ở một nơi thay vì ở mỗi địa điểm cuộc gọi.

Điều giữ luật này là[`sources/fe/served-locale.mjs`](../../../sources/fe/served-locale.mjs).

Implementation anchors in `starci-academy-fe`:
`src/modules/api/graphql/clients/links/locale.ts` and `src/modules/api/graphql/clients/create-apollo-client.ts`.

## Quy tắc

**LOCALE-1 · Client gắn locale, và mọi client đều phải làm vậy.**

Ngôn ngữ nằm trong chuỗi truyền tải bên cạnh mã thông báo xác thực chứ không phải trong hook cần thiết
nó. Đính kèm nó cho mỗi cuộc gọi có nghĩa là toàn bộ bề mặt chỉ có song ngữ trong khi mọi tác giả đều nhớ,
và người đầu tiên quên gửi một trang song ngữ bằng chrome và đơn ngữ trong đó
nội dung — được đọc dưới dạng khoảng trống dịch thuật chứ không phải là tiêu đề bị thiếu, vì vậy nó được tìm kiếm trong
từ điển.

Một vị khách cũng đọc bằng một ngôn ngữ nào đó nên điều này là vô điều kiện. Không giống như mã thông báo mang, không có
đường dẫn ẩn danh không khai báo gì một cách hợp pháp.

**LOCALE-2 · Transport đọc locale từ address, không đọc từ argument.**

URL đã mang ngôn ngữ của người đọc và phần mềm trung gian đã chuyển hướng họ đến ngôn ngữ đó. Đó
làm cho địa chỉ trở thành tuyên bố có ý định mạnh mẽ nhất và hữu ích hơn là không ai phải làm vậy
nhớ vượt qua nhé MỘT`locale`tham số được xâu chuỗi qua các hook và các hàm truy vấn là một tham số
hook tiếp theo bị bỏ qua và sự thiếu sót này là vô hình: cuộc gọi thành công và trả về ngôn ngữ mặc định.

**LOCALE-3 · Cookie không phải transport khi API ở origin khác.**

Ứng dụng có thể ghi nhớ lựa chọn của người đọc trong cookie và máy chủ cũng có thể đọc lựa chọn đó. cũng không
thực tế mang giá trị qua ranh giới nguồn gốc: yêu cầu có nguồn gốc chéo sẽ không gửi cookie trừ khi nó
chọn thông tin xác thực và đường dẫn ẩn danh có chủ ý không làm như vậy. Một cookie mà máy chủ có thể đọc
nguyên tắc và không bao giờ nhận được trong thực tế là loại đúng đắt nhất.

**LOCALE-4 · Default của server là floor, không phải fallback để client dựa vào.**

Máy chủ trả lời yêu cầu không được khai báo bằng tiếng Anh là cẩn thận, không dễ dãi. điều trị
mặc định đó là "dự phòng hoạt động" biến tiêu đề bị thiếu thành quyết định sản phẩm im lặng và
người đọc để ý là người được phục vụ sai ngôn ngữ.

**LOCALE-5 · Một nơi set header để một nơi có thể được kiểm tra.**

Tiêu đề được viết bởi liên kết và không có gì khác. Trang web cuộc gọi thứ hai cài đặt nó bằng tay là một
câu trả lời thứ hai cho "yêu cầu này ở địa điểm nào" và cả hai không đồng ý ngay lần đầu tiên một trong số họ
được cập nhật.

## Forbidden

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Một ứng dụng khách GraphQL được lắp ráp mà không có liên kết ngôn ngữ | Mọi cuộc gọi mà nó thực hiện đều được cung cấp ngôn ngữ mặc định và khoảng trống được coi là lỗi dịch thuật | Đặt liên kết miền địa phương vào chuỗi, bên cạnh liên kết xác thực |
| Đính kèm ngôn ngữ cho mỗi hook hoặc mỗi truy vấn | Tác giả đầu tiên quên tàu một mặt đơn ngữ, không có gì báo cáo | Đính kèm nó một lần trong quá trình vận chuyển |
| Luồng một`locale`tranh luận thông qua hook | Đó là một tham số bị bỏ qua và sự thiếu sót trả về giá trị mặc định thay vì lỗi | Đọc địa chỉ trong liên kết |
| Dựa vào cookie để tiếp cận API có nguồn gốc chéo | Nó không được gửi trừ khi yêu cầu chọn thông tin xác thực và đường dẫn ẩn danh không | Gửi tiêu đề |
| Coi máy chủ mặc định là dự phòng | Nó chuyển đổi một tiêu đề bị thiếu thành một quyết định im lặng về sản phẩm | Khai báo miền địa phương theo mọi yêu cầu |
| Đặt tiêu đề ngôn ngữ tại trang web cuộc gọi | Hai câu trả lời cho một câu hỏi và chúng khác nhau ở lần chỉnh sửa đầu tiên | Hãy để liên kết sở hữu nó |

## Ví dụ

### Nơi locale được gắn vào

```ts
// the chain: unconditional, beside the auth link, so every call declares a language
export const createLinkChain = (params) => [
    createRetryLink(),
    createTimeoutLink(),
    createAttachLocaleLink({ debug }),
    ...(withAuth ? [createAttachBearerTokenLink({ debug })] : []),
    createHttpLink({ uri, headers, signal }),
]
```

```ts
// Wrong: the chain is complete, authenticated, retried, timed out - and mute about language
export const createLinkChain = (params) => [
    createRetryLink(),
    createTimeoutLink(),
    ...(withAuth ? [createAttachBearerTokenLink({ debug })] : []),
    createHttpLink({ uri, headers, signal }),
]
```
Chúng khác nhau ở một điểm: liệu người đọc trên URL tiếng Việt có được cung cấp tài liệu tiếng Việt hay không.

### Locale đến từ đâu

```ts
// the link reads the address, so no caller has to remember anything
const locale = localeFromPath(window.location.pathname) ?? localeFromCookie(document.cookie) ?? DEFAULT_LOCALE
```

```ts
// Wrong: correct at this call site, and the next hook will not pass it
export const useQueryCourseSwr = ({ displayId, locale }) =>
    useSWR([KEY, displayId, locale], () => queryCourse({ request: { displayId }, headers: { "x-locale": locale } }))
```
Chúng khác nhau ở một điều: việc có đúng hay không phụ thuộc vào khả năng ghi nhớ của mỗi tác giả tương lai.

### Header không ai nên viết hai lần

```ts
// one link owns it
operation.setContext((previous) => ({ headers: { ...previous.headers, "x-locale": locale } }))
```

```ts
// Wrong: a second answer to the same question, in a file that will not be updated with the first
const result = await queryCourse({ request, headers: { "x-locale": "vi" } })
```
Chúng khác nhau ở một điều: phải có bao nhiêu nơi đồng ý thì câu trả lời mới là đúng.
