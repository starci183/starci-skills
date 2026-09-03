# UI proof

Proof là tầng quyết định chỉ tồn tại sau khi trang đã render:

```text
business
-> composition quyết định vùng, cấp độ, action, state và điểm nhấn
-> presentation chốt giá trị CSS trên boundary do app sở hữu
-> UI đã render  <- proof quan sát ở đây
```

Mọi rule trong folder này được operator audit tiêu thụ, trừ đúng một ngoại lệ được gọi tên trong danh
mục dưới đây: [UX](ux.vi.md) còn được `uat.verify` đọc, vì phần lớn tiêu chí của nó chỉ trả lời được
bằng một lượt chạy tác vụ chứ không phải bằng một ảnh chụp. Operator đó không truy cập được ý định, chỉ
truy cập được đầu ra: cây accessibility đã được tính, phần tử đang thật sự giữ focus, khung hình nơi
animation dừng lại, và tuyên bố mà trang cuối cùng đưa ra. Những chủ đề này nằm chung một chỗ vì
không cái nào xác lập được bằng cách đọc source. Một rule `:focus-visible` không chứng minh có một
chỉ dấu nhìn thấy được, một prop `label` không chứng minh một cái tên được tính ra, một thuộc tính
`motion` không chứng minh một transition, và một bản copy đã duyệt không chứng minh điều mà trang
render ra đang khẳng định. Vì vậy mỗi rule đều nêu quan sát nào sẽ bác bỏ nó, để một kết luận đạt
luôn gọi tên được thứ đã thật sự được nhìn.

## Danh mục

| Knowledge | Quyết định điều gì | Rule |
| --- | --- | --- |
| [Accessibility](accessibility.vi.md) | Tên, quan hệ, kích thước mục tiêu và tương phản có tới được mọi người đọc không | A11Y-1 đến A11Y-5 |
| [Contrast](contrast.vi.md) | Khác biệt và chữ có sống sót qua phép đo ở mọi theme và mọi state không | COLOR-3, COLOR-5, COLOR-6 |
| [Focus](focus.vi.md) | Focus nhìn thấy ở đâu, đi xa tới đâu, và quay về đâu | FOCUS-1 đến FOCUS-6 |
| [Motion](motion.vi.md) | Ý nghĩa có sống sót khi chuyển động dừng, bị giảm hoặc bị cắt ngang không | MOTION-1 đến MOTION-5 |
| [Render truth](render-truth.vi.md) | Mọi tuyên bố đã render có truy về được authority thật không | TRUTH-1 đến TRUTH-5 |
| [Taste](taste.vi.md) | Một bề mặt đã qua sạch canon có đủ đẹp để ship không | TASTE-1 đến TASTE-13 |
| [UX](ux.vi.md) | Một người mang theo nhiệm vụ có thật sự làm xong nó trên sản phẩm đang chạy không | UX-1 đến UX-12 (do `uat.verify` đọc) |

Mọi topic ở đây đều tự chứa. Nó publish các tiêu chí của mình và đóng lại bằng rule verdict của chính
nó: tập chặn cửa, ngưỡng, verdict, và một lần fail đi về đâu. Không có rule nào gom các topic lại, vì
một rule mà toàn bộ nội dung là trỏ sang rule khác chính là một tầng id thứ hai: thêm một địa chỉ mà
không thêm một quyết định nào. Chỗ duy nhất các topic gặp nhau là receipt: `## Verdict` mang một hàng
cho mỗi topic, mỗi hàng chép từ topic đã tính ra nó, và một dòng nói `ship`, `fix-first` hay
`blocked` trên các hàng ấy.

Một topic đã nghỉ ở đây. `UI-1` đến `UI-11` từng là một file scorecard gọi tên các lens rồi trỏ sang
những rule sở hữu chúng; nay mỗi số ấy tra về đúng rule topic đã sống sót, và những số ấy không bao
giờ được dùng lại. Bảng ánh xạ nằm ở
[bằng chứng gom nhà](../../../tests/evidence/20260903-consolidation.md).

## Cấu trúc rule

`A11Y-1`, `FOCUS-5` và các tên `PREFIX-n` khác là địa chỉ thứ tự ổn định trong chủ đề của chúng. Con
số không phải mức độ nghiêm trọng, cũng không phải một mức tuân thủ. Một chủ đề có thể công bố một
dãy không liền số: `contrast.vi.md` chỉ công bố `COLOR-3`, `COLOR-5` và `COLOR-6`, vì các số còn lại của tiền tố đó đã
nghỉ cùng chủ đề sinh ra chúng và không bao giờ được dùng lại, còn cả tiền tố `UI-` thì đã nghỉ.

Mỗi rule gồm heading, một dòng gọi tên thứ mà rule chi phối, và đúng một bảng:

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Tình huống đã render cụ thể dẫn tới rule này. | Bằng chứng runtime chính xác, và việc nhìn thấy nó sẽ bác bỏ điều gì. |

Ô `Quan sát` gọi tên một thứ chụp được từ trang đang chạy, như một cái tên được tính ra, một phần tử
đang active, một hình chữ nhật đã đo, một thời lượng đã tính, một kết quả đã truy vết, và nói rõ một
quan sát ngược lại sẽ bác bỏ điều gì. Nó không bao giờ chỉ nhắc lại một ý định.

Một case thuộc về rule hàng xóm thì không nằm trong bảng. Nó đứng thành một dòng ngay sau bảng, theo
dạng `Không phải rule này: <điều kiện> thuộc PREFIX-n`. Mỗi file khép lại bằng mục
`## File này không quyết định`, dẫn sang các file anh em và sang nhóm composition, nơi quyết định
đang bị kiểm chứng đã được đưa ra.

Tên component và tên prop trong các file này đều phải phân giải được về `@starci/grammar/common`. Ở
đâu hợp đồng công khai chưa có owner cho một hành vi cần thiết, phần audit ghi nhận capability gap
thay vì chấp nhận một giải pháp cục bộ.
