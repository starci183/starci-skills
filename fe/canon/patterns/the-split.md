# sự chia rẽ

## Định nghĩa

Một bề mặt sở hữu một yêu cầu là hai tệp.`index.tsx`tìm nạp, giải quyết tình huống nào người đọc
là trong, và giải quyết các từ.`component.tsx`lấy một tình huống đã được giải quyết sẵn và rút ra nó.

Sự chia rẽ không phải là sự ngăn nắp về mặt tổ chức. Đó là một đường được vẽ sao cho **mọi thứ có thể sai
về DỮ LIỆU tồn tại trong một tệp và mọi thứ có thể sai về BẢN VẼ tồn tại trong tệp kia** —
và không xem xét nào phải đọc tệp khác.

Câu hỏi xác định nửa dòng thuộc về: **điều này có thể sai khi mạng không hoạt động
được không?** Sai cây, sai đường may, thiếu trạng thái: vẽ. Một yêu cầu sai, một tình huống sai,
chọn sai từ: dữ liệu.

Điều giữ luật này là[`sources/fe/the-split.mjs`](../../../sources/fe/the-split.mjs). Nó kiểm tra cả hai
hướng mà cây cú pháp có thể chứng minh: nửa bản vẽ không thể vươn tới thế giới và phần được kết nối
khối phải nhập và chỉ hiển thị chính xác`_X`sinh đôi.

Implementation anchors in `starci-academy-fe`:
`src/components/blocks/dashboard/CreditStatRow/index.tsx` and `src/components/blocks/dashboard/CreditStatRow/component.tsx`.

## Quy tắc

**SPLIT-1 · Drawing half nhận mọi thứ và không yêu cầu gì.**

Không yêu cầu, không lưu trữ, không gọi dịch thuật, không đọc ngôn ngữ hiện tại. Mọi giá trị nó biểu hiện
đã được quyết định, đó là điều khiến nó có thể kết xuất được từ một thiết bị cố định — và một thành phần
không thể được kết xuất từ thiết bị cố định không thể được kiểm tra vì thử nghiệm sẽ phải đứng vững
đầu tiên trên thế giới.

**SPLIT-2 · Connected half quyết định TÌNH HUỐNG, không quyết định styling.**

Nó quyết định trạng thái được đặt tên này là gì và chuyển nó xuống. Nó không quyết định làm thế nào một nhà nước
trông như thế nào, mọi thứ nằm cách nhau bao xa, hoặc yếu tố nào vẽ nên cái gì. Đó là một nửa bản vẽ, và
một tập tin được kết nối với họ đã đưa ra quyết định mà nó không thể thấy được hậu quả của nó.

**SPLIT-3 · Tình huống đi qua ranh giới dưới dạng TÊN, không bao giờ là một túi flag.** `state="pending"` thay vì `isLoading`, `hasError`, `isEmpty`. Tên là một value từ closed set;
thiết lập; bốn lá cờ thừa nhận mười sáu sự kết hợp, trong đó hầu hết chưa từng được nhìn thấy. Công đoàn là cái gì
làm cho bức vẽ trở nên đầy đủ một nửa: mọi tình huống tồn tại đều được vẽ ra và không có tình huống nào làm được điều đó.
không tồn tại có thể được thể hiện.

**SPLIT-4 · Copy được resolve trước khi đi qua ranh giới.**

Nửa bản vẽ nhận được chữ chứ không phải chìa khóa. Một chuỗi được dịch là một giá trị giống như bất kỳ chuỗi nào khác và một chuỗi
thành phần tra cứu đã có được sự phụ thuộc vào toàn bộ thời gian chạy dịch cho một công việc
việc đó đã được thực hiện cách đây một tập tin.

**SPLIT-5 · Connected half không tự vẽ gì.**

Nó nhập chính xác`_${FolderName}`từ`./component`và hiển thị một thành phần đó trên mọi JSX
con đường. Một tệp được kết nối hiển thị một lá, nhánh hoặc cây thay thế đã trở thành cả hai nửa và
dòng dừng lại có nghĩa là bất cứ điều gì thời điểm nó được vượt qua một lần.

Không có ngoại lệ khối mỏng. Một lá, một cây ở mọi trạng thái, không có trạng thái miền cục bộ hoặc một
cặp song sinh trình bày chỉ chuyển tiếp đạo cụ là những trường hợp có nhiều khả năng phát triển tình huống thứ hai nhất
sau này; họ vẫn lai cùng một cặp song sinh.

**SPLIT-6 · Surface không có request thì không split.**

Hai tệp dành cho một thành phần không tìm nạp gì là nghi lễ: không có một nửa dữ liệu, vì vậy tệp thứ hai
tập tin không chứa gì mà tập tin đầu tiên có thể sai. Sự phân chia tồn tại vì có một yêu cầu tồn tại.

## Forbidden

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| Một yêu cầu, lệnh gọi đọc hoặc dịch lưu trữ trong nửa bản vẽ | Nó ngừng hiển thị từ một vật cố định, vì vậy nó không thể kiểm tra được nếu không có thế giới | Đặt nó vào nửa được kết nối và chuyển kết quả |
| Đọc ngôn ngữ hiện tại trong khi vẽ | Sự phụ thuộc tương tự, mang tên nhỏ hơn | Giải quyết các từ một tập tin |
| Một phím dịch qua dòng | Nửa bản vẽ lấy thời gian dịch cho một công việc đã được thực hiện | Gửi chuỗi đã giải quyết |
| Cờ thay vì một tình huống được đặt tên | Bốn boolean thừa nhận mười sáu kết hợp và hầu hết chưa từng tồn tại | Một công đoàn bị phân biệt đối xử |
| Kiểu dáng quyết định ở nửa kết nối | Nó đưa ra một quyết định mà nó không thể thấy được hậu quả | Hãy để một nửa bản vẽ quyết định tình huống sẽ như thế nào |
| Đánh dấu ở nửa được kết nối | Nó đã trở thành cả hai nửa và dòng này không còn ý nghĩa gì nữa | Render một nửa bản vẽ và không có gì khác |
| Hiển thị trực tiếp một chiếc lá vì khối mỏng | Yêu cầu và bản trình bày không còn có thể được kiểm tra độc lập nữa và trạng thái được thêm đầu tiên vượt qua dòng | Tạo chính xác`_X`và chỉ hiển thị nó |
| Tách một thành phần không tìm nạp gì | Không có dữ liệu nào phân nửa nên file thứ 2 là lễ | Một tập tin |

## Ví dụ

### Ranh giới

```tsx
// index.tsx - it settles the situation and resolves the words
const quest = useQueryMyDailyQuestSwr()
if (quest.error !== undefined) return <_DailyQuest state="failed" props={{ label: t("label") }} />
```

```tsx
// component.tsx - it draws a situation that has already been decided
const isLoading = input.state === "pending"
```
Chúng khác nhau ở một điều: cái nào trong số chúng có thể sai trong khi mạng vẫn ổn.

### Tình huống, không phải các flag

```tsx
type Props =
    | { state: "pending"; props: Frame }
    | { state: "failed"; props: Frame & { message: string } }
    | { state: "ready"; props: Frame & { rows: ReadonlyArray<Row> } }
```

```tsx
type Props = { isLoading: boolean; hasError: boolean; isEmpty: boolean; rows: ReadonlyArray<Row> }
```
Chúng khác nhau ở một điều: liệu một tình huống mà không ai từng thấy có thể được diễn đạt hay không.

### Các chuỗi chữ

```tsx
<_DailyQuest state="failed" props={{ label: t("label"), message: t("failed") }} />
```

```tsx
<_DailyQuest state="failed" props={{ labelKey: "quest.label", messageKey: "quest.failed" }} />
```
Chúng khác nhau ở một điểm: liệu nửa bản vẽ có cần kiểm tra thời gian chạy dịch hay không.

### Bẫy block mỏng

```tsx
export const CreditStatRow = () => {
    const quota = useQueryMyAiQuotaSwr()
    return <_CreditStatRow state="settled" props={{ label: t("credit"), value: formatQuota(quota.data) }} />
}
```

```tsx
export const CreditStatRow = () => {
    const quota = useQueryMyAiQuotaSwr()
    return <StatRow props={{ label: t("credit"), value: formatQuota(quota.data) }} />
}
```
Chúng khác nhau ở một điểm: liệu mọi kết xuất được kết nối có vượt qua cặp song sinh trình bày chính xác hay không.
