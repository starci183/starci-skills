# trạng thái tải

## Định nghĩa

Một surface đang chờ dữ liệu phải vẽ **đúng hình dạng sẽ vẽ khi dữ liệu đến**, chỉ bỏ các giá trị đi.
Không phải một tree khác, cũng không phải vài thanh xám trông có vẻ tương tự — mà là chính các
component đó, theo đúng cách sắp xếp đó, ở trạng thái nghỉ.

Lý do là nguy cơ lệch, và đó không phải giả thuyết. Tree thứ hai mô tả tree thứ nhất là bản mô tả
không ai cập nhật: đúng vào ngày được viết, rồi sai ngay lần đầu hình dạng thật thay đổi. Không có gì
chuyển sang đỏ, vì hình dạng nghỉ không có assertion nào để fail — nó chỉ đơn giản là sai trên màn
hình, và thường chỉ bị nhận ra đúng lúc có người đang nhìn.

Câu hỏi quyết định là: **nếu component này đổi hình dạng vào ngày mai, phiên bản chờ có đổi theo
không?** Nếu không, đó là một bản mô tả thứ hai và nó sẽ lệch dần.

Luật này được bảo đảm bởi [`sources/fe/loading.mjs`](../../../sources/fe/loading.mjs).

Implementation anchors in `starci-academy-fe`: `src/components/leaves/Text/index.tsx` and
`src/components/blocks/dashboard/pending-gate.test.tsx`.

## Hai nửa gặp nhau như thế nào

Đây là seam thường bị hiểu sai nhất, nên phải được ghi rõ thay vì để người đọc tự suy ra. Block và
leaf biểu đạt trạng thái chờ khác nhau, và phép chuyển giữa hai bên chỉ là một dòng:

| Tầng | Trạng thái chờ được biểu đạt như thế nào |
|---|---|
| block | `pending` là một thành viên của state union — một tình huống thực, đứng cạnh `ready`, `empty`, `failed` |
| leaf, composite | `isLoading`, một flag được nhận vào và không được tự quyết định |
| seam | `const isLoading = input.state === "pending"` ở nửa presentational |

Block sở hữu TÌNH HUỐNG vì chỉ nó biết câu trả lời đã đến hay chưa. Leaf sở hữu DIỆN MẠO của trạng
thái nghỉ vì chỉ nó biết anatomy của mình. Không bên nào có thể làm phần của bên kia; dòng duy nhất
ở giữa là nơi hai bên gặp nhau.

## Luật

**LOADING-1 · Một hình dạng, hai trạng thái. Không bao giờ có hai tree.**

Component vẽ dữ liệu cũng phải vẽ trạng thái chờ. Nó không ủy quyền cho twin, và không nhận một
placeholder dựng sẵn để render thay cho chính nó.

**LOADING-2 · Phần tử ở trạng thái nghỉ vẫn là CHÍNH phần tử đó, chỉ được làm rỗng.**

Cùng tag, cùng cách sắp xếp, cùng kích thước — chỉ bỏ các giá trị và đặt surface nghỉ vào chỗ đó.
Nhờ vậy layout đứng yên khi dữ liệu đến, và đó chính là mục tiêu: người đọc đã bắt đầu đọc sẽ mất
vị trí khi trang dịch chuyển bên dưới họ.

**LOADING-3 · Hình dạng nghỉ phải giữ chiều cao của section.**

Region không vẽ gì trong lúc chờ sẽ co lại, rồi cả cột bên dưới nhảy lên khi câu trả lời đến. Một
dãy row phải nghỉ như một dãy row — số lượng là một quyết định có chủ đích để region nghỉ có kích
thước như region thật.

**LOADING-4 · Phần tử ở trạng thái nghỉ phải được ẩn khỏi assistive technology.**

Chưa có gì để đọc. Shimmer được thông báo cho screen reader là nhiễu đúng lúc người đọc đang chờ
được thông tin, còn các giá trị đã làm rỗng sẽ bị đọc như những khoảng trống.

**LOADING-5 · Không được vẽ control trước khi nó có nơi để đi tới.**

Card ở trạng thái nghỉ phải để trống vị trí dành cho action thay vì làm shimmer một button. Target
đến trước destination là thứ người đọc bấm vào nhưng không nhận được gì — và đó là cách nhanh nhất để
họ học rằng surface này không đáng tin.

**LOADING-6 · Mỗi region tự sở hữu trạng thái chờ của mình.**

Một flag dùng chung cho các request độc lập khiến region nhanh nhất phải chờ region chậm nhất, đồng
thời trộn nhiều tình huống thực thành một. Màn hình hoàn thiện dần trong một giây được cảm nhận là
nhanh hơn màn hình hiện ra cùng lúc sau ba giây.

**LOADING-7 · Trạng thái chờ là một tình huống thực, không phải sự vắng mặt của tình huống.**

`pending` nằm trong union cạnh `ready`, `empty` và `failed`, đồng thời mang đủ thông tin cần thiết để
vẽ frame — tên của chính region không biến mất trong lúc nội dung đang đến. Component coi trạng thái
chờ là "chưa có data" sẽ không phân biệt được với "không có gì", trong khi hai tình huống này cần
hai cách diễn đạt khác nhau.

## Forbidden

| Không bao giờ | Vì sao bị từ chối | Thay vào đó |
|---|---|---|
| Một twin component có nhiệm vụ mô phỏng hình dạng component khác | Không thể giữ chúng đồng bộ; chỉ nhận ra khi chúng đã lệch | Cho component một trạng thái nghỉ |
| Prop `skeleton={<...>}` | Vẫn là tree thứ hai, được truyền từ bên ngoài và càng xa hình dạng mà nó sao chép | Truyền flag xuống |
| Ternary chọn giữa hai component KHÁC NHAU | Hình dạng nghỉ được viết ở call site và sẽ lệch khỏi component thật | Một component, hai trạng thái |
| Region không vẽ gì trong lúc chờ | Cột nhảy khi câu trả lời đến và người đọc mất vị trí | Nghỉ ở chiều cao của region thật |
| Shimmer được thông báo cho assistive technology | Gây nhiễu đúng lúc người đọc đang chờ được thông tin | Ẩn nó khi đang nghỉ |
| Control được vẽ trước khi destination tồn tại | Người đọc bấm vào và biết rằng surface không đáng tin | Để trống vị trí cho tới khi có nơi để đi tới |
| Một flag dùng chung cho các request độc lập | Region nhanh nhất phải chờ region chậm nhất, biến bốn tình huống thành một | Để mỗi region hoàn thiện khi nó hoàn thiện |
| Coi trạng thái chờ là dữ liệu thiếu | "Chưa đến" và "không có" cần hai cách diễn đạt khác nhau | Đưa `pending` vào union |

## Ví dụ

### Seam, gói trong một dòng

```tsx
// the block owns the situation; the leaf owns what resting looks like
const isLoading = input.state === "pending"
```

```tsx
// the block decides what resting LOOKS like, which is the leaf's own anatomy
{input.state === "pending" ? <div className="h-4 w-24 animate-pulse rounded bg-default" /> : <Text ... />}
```

Chúng chỉ khác nhau ở một điểm: file nào biết hình dạng của thứ đang ở trạng thái nghỉ.

### Cùng phần tử, chỉ làm rỗng

```tsx
<Avatar props={{ name }} isLoading={isLoading} />
```

```tsx
{isLoading ? <AvatarSkeleton /> : <Avatar props={{ name }} />}
```

Chúng chỉ khác nhau ở một điểm: phiên bản chờ có thay đổi khi phiên bản thật thay đổi hay không.

### Chiều cao

```tsx
// a run of rows rests as a run of rows, so nothing moves when the data lands
const rows = isLoading ? RESTING_ROWS : props.rows
```

```tsx
// nothing is drawn, the section collapses, and the whole column jumps on arrival
{isLoading ? null : props.rows.map(...)}
```

Chúng chỉ khác nhau ở một điểm: người đọc có giữ được vị trí hay không.

### Control chưa có nơi để đi tới

```tsx
{item === undefined ? null : <SeeMoreLink props={{ label: resumeLabel }} on={{ press }} />}
```

```tsx
<SeeMoreLink props={{ label: resumeLabel }} isLoading={isLoading} on={{ press }} />
```

Chúng chỉ khác nhau ở một điểm: người đọc có thể bấm vào thứ hiện chưa dẫn tới đâu hay không.
