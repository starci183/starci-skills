# an toàn kiểu

## Định nghĩa

Type là phần của canon mà máy có thể giữ mà không cần ai nhắc. Phần lớn luật còn lại được thực thi
bằng closed union hoặc slot alias thay vì bằng một rule — vì vậy giá trị của type system ở đây không
chỉ là "ít bug hơn" một cách trừu tượng. Giá trị đó là **phần lớn canon không còn là tùy chọn.**

Các rule trong file này vì thế chỉ có một nhiệm vụ: bảo vệ những chỗ người viết tắt type system.
Cast không sửa lỗi type; nó chỉ làm lỗi im đi, đúng tại seam nơi lỗi đó đáng lẽ phải xuất hiện.

Câu hỏi quyết định là: **compiler đã biết điều gì mà dòng này đang bảo nó quên?** Nếu câu trả lời là
"không có gì, các type thực sự khớp nhau", cast là không cần thiết. Nếu là bất kỳ điều gì khác, cast
đang che giấu vấn đề.

Luật này được bảo đảm bởi [`sources/fe/type-safety.mjs`](../../../sources/fe/type-safety.mjs).

Implementation anchors in `starci-academy-fe`: `src/components/contracts/props.ts` and
`src/components/pages/ProfileSkillsPage/component.test.tsx`.

## Luật

**TYPE-SAFETY-1 · Double cast tắt việc kiểm tra, và là cách tắt rõ ràng nhất.**

Cast qua `unknown` bảo compiler quên mọi điều nó biết về giá trị, vì hai type không có gì chung.
Đó không phải narrowing — narrowing là một khẳng định mà compiler vẫn có thể kiểm tra phần nào.
Đây là xóa thông tin, và seam bị xóa chính là seam đáng kiểm tra nhất: nơi một giá trị đi từ bên
ngoài chương trình vào bên trong.

**TYPE-SAFETY-2 · `any` là cùng một kiểu xóa thông tin nhưng viết ngắn hơn, và nó lan truyền.**

Cast chỉ dừng ở một dòng. `any` thì lan đi: mọi property đọc từ nó đều là `any`, mọi giá trị dẫn
xuất cũng là `any`, và việc xóa type vươn tới cả những file chưa từng nhắc đến nó. Khi shape thật sự
chưa biết, hãy dùng `unknown` — nó buộc narrowing phải diễn ra ở một chỗ có thể nhìn thấy.

**TYPE-SAFETY-3 · Một cách viết duy nhất cho array.**

`Array<T>`, không dùng `T[]`. Cả hai có cùng ý nghĩa, và chính vì vậy đây là rule chứ không phải
sở thích: không có gì sửa cách viết thứ hai, nên một file viết hôm nay sẽ đọc khác file bên cạnh và
mọi diff sau đó đều mang theo nhiễu. Dạng generic vẫn dễ đọc khi element type cũng là generic.

**TYPE-SAFETY-4 · Test được phép cố ý tạo một giá trị sai.**

Muốn chứng minh một API đóng từ chối input xấu thì phải dựng input xấu, và không thể làm vậy nếu
không cast. Ngoại lệ này chỉ áp dụng cho file test, được xác định bằng path — và phải hẹp như vậy vì
ngoại lệ dựa trên phán đoán sẽ bị tranh luận ở mọi call site.

**TYPE-SAFETY-5 · Cast vượt qua review phải ghi lý do ngay trên dòng.**

Đôi khi một boundary thực sự cần cast: type của vendor sai, hoặc runtime bảo đảm một giá trị mà
compiler không thể biết. Những trường hợp đó có tồn tại. Điểm phân biệt là lý do có thể viết thành
một mệnh đề; nếu không viết được, cast đang che giấu vấn đề chứ không bắc cầu qua boundary.

## Forbidden

| Không bao giờ | Vì sao bị từ chối | Thay vào đó |
|---|---|---|
| Cast qua `unknown` | Nó xóa mọi điều compiler đã biết, đúng tại seam nơi kiến thức đó quan trọng nhất | Narrow từ `unknown` bằng một check mà compiler theo dõi được |
| `any` | Nó lan sang mọi giá trị dẫn xuất và cả những file chưa từng nhắc đến nó | Dùng `unknown` rồi narrow ở nơi rõ ràng |
| `T[]` | Hai cách viết cho cùng một thứ và không có gì sửa cách viết thứ hai | `Array<T>` |
| Cast chỉ để làm lỗi biến mất | Lỗi là compiler đang nói một điều đúng | Sửa shape hoặc narrow đúng cách |
| Cast không có lý do đi kèm | Lý do không thể viết thành mệnh đề cho thấy cast đang che giấu vấn đề | Viết rõ mệnh đề hoặc bỏ cast |

## Ví dụ

### Xóa kiểm tra

```ts
const row = parse(payload)
if (!isResumeRow(row)) return
// the compiler followed the check, and knows what `row` is here
```

```ts
const row = payload as unknown as ResumeRow
// the compiler knew the payload's shape and has been told to forget it
```

Chúng chỉ khác nhau ở một điểm: còn thứ gì kiểm tra payload có đúng như nó tự nhận hay không.

### Sự lan truyền

```ts
const answer: unknown = await response.json()
```

```ts
const answer: any = await response.json()
// every property read off `answer` is now `any`, in every file it reaches
```

Chúng chỉ khác nhau ở một điểm: việc xóa type có dừng ở dòng này hay không.

### Trường hợp được phép

```ts
// bearer.test.ts - proving the link refuses a malformed operation means building one
return operation as unknown as ApolloLink.Operation
```

```ts
// component.tsx - the same spelling, in a file whose job is not to build wrong values
return operation as unknown as ApolloLink.Operation
```

Chúng chỉ khác nhau ở một điểm: việc dựng một giá trị sai có phải là mục đích của file hay không.
