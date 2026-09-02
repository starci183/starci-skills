# Output của `fe.source.apply`

Operator trả về một vỏ đóng với `outcome` bằng `applied` hoặc `blocked`. Nó không bao giờ phát ra
handoff hay chỉ dẫn điều phối dạng văn xuôi tự do.

## Receipt khi applied

Một receipt đã applied chứa:

- các binding chính xác về project, source, target, resolution, trần owner, input và tiến độ;
- resolution thật sự đã đọc, kèm fingerprint của nó và fingerprint của cây đã resolve;
- write set đã khai, nhắc lại đầy đủ để cái trần và kết quả đọc được cạnh nhau;
- mỗi đường được đụng tới một mục ghi, nêu owner, hành động, fingerprint trước và sau, các node được
  mang theo, các class đã ghi, các mã đã khai, và việc thuộc tính contract có được ghi hay không;
- danh sách class và danh sách rule mà resolution đã công bố;
- các finding cho file được tạo mới, file không đổi, và những đường đã khai mà không sinh ra gì.

Receipt giải trình mọi byte đã vào repository. Nó không chứng minh kết quả render đúng, và không mang
phán quyết, điểm số hay lời khẳng định đạt nào.

## Các hành động ghi

Mỗi mục ghi nêu đúng một hành động:

| Hành động | Nghĩa | Fingerprint trước | Class |
| --- | --- | --- | --- |
| `created` | Đường dẫn chưa tồn tại và bây giờ đã có | `null` | Được phép |
| `modified` | Đường dẫn đã có và nội dung đã xê dịch | Bắt buộc, và khác với fingerprint sau | Được phép |
| `unchanged` | Bản chiếu trùng đúng nội dung hiện tại | Bắt buộc, và bằng fingerprint sau | Cấm |

`unchanged` là một phép đo, không phải một ý kiến: fingerprint lấy trước bản chiếu và fingerprint lấy
sau phải giống hệt nhau. Một mục `unchanged` mà phát class thì bị từ chối, vì một class được ghi ra
tự nó đã là một thay đổi.

Một receipt applied đòi ít nhất một lần ghi `created` hoặc `modified`. Một lần ghi mà mọi đường đã
khai đều trở về không đổi là `NO_PROGRESS`, không phải một thành công lặng lẽ.

## Đường đã khai mà không sinh ra gì

Một đường đã khai không có mục ghi nào thì phải mang finding `WRITE_SET_PATH_UNUSED`. Write set là một
cái trần và việc trần rộng hơn kết quả là bình thường, nhưng một đường biến mất khỏi báo cáo thì không
phân biệt được với một đường bị bỏ qua im lặng.

## Receipt khi blocked

Receipt đã blocked không có phần application, và không file nào được ghi. Nó chứa đúng một failure có
kiểu, các đường dẫn và tham chiếu liên quan, domain sở hữu, tính lặp lại được, và chỉ khi lặp lại được
thì mới có token resume dùng một lần kèm phần delta vật chất cần bổ sung.

## Mã lỗi

| Mã | Vấn đề sở hữu | Delta vật chất hợp lệ |
| --- | --- | --- |
| `INVALID_INPUT` | Hợp đồng input đóng bị vi phạm. | Input đã sửa. |
| `SOURCE_DRIFT` | Source quan sát được không còn khớp head đã đóng băng. | Binding source làm mới. |
| `OWNER_CONFLICT` | Một đường đã khai nằm ngoài mọi gốc owner được sửa, hoặc nằm dưới owner chỉ quan sát. | Thẩm quyền owner đã sửa. |
| `RESOLUTION_STALE` | Resolution đã đọc khác resolution đã bind. | Resolution receipt hiện hành và fingerprint của nó. |
| `WRITE_REJECTED` | Một file hoặc một giá trị mà lần ghi sinh ra nằm ngoài phạm vi được cho phép. | Write set đã sửa, hoặc một resolution mới công bố giá trị đó. |
| `NO_PROGRESS` | Không có gì thay đổi, hoặc một resume không thêm delta nào. | Resolution, write set hoặc scope mới thật sự. |

`WRITE_REJECTED` là kết quả dự kiến khi write set hẹp hơn thay đổi, không phải lỗi của resolution. Nó
thuộc về bên gọi đã khai cái trần, và ghi lại chính source đó với write set đã sửa mới là bước tiếp
theo đúng.

## Bất biến liên trường

- `outcome="applied"` đòi `receipt.status="applied"`, `application` khác null, `failure` null, và
  `resume` null.
- `outcome="blocked"` đòi `receipt.status="blocked"`, `application` null, và `failure` khác null. Một
  failure lặp lại được thì đòi có resume; một failure không lặp lại được thì cấm có resume.
- Tham chiếu và fingerprint của resolution đã áp dụng bằng đúng tham chiếu và fingerprint đã bind.
- Mọi đường đã ghi đều có trong write set đã khai, dưới cùng một owner.
- Mọi đường đã khai đều nằm dưới gốc của chính owner được sửa của nó, và không bao giờ nằm dưới một
  owner chỉ quan sát.
- Mọi đường đã khai được ghi nhiều nhất một lần.
- Ý định `create` đã khai không bao giờ báo là sửa, và ý định `modify` đã khai không bao giờ báo là
  tạo mới.
- Mọi class đã ghi đều có trong danh sách class của resolution, và mọi mã được mang theo đều có trong
  danh sách rule đã áp dụng.
- Một lần ghi có mang class thì phải gọi tên những node mang chúng.
- `created` có fingerprint trước là null; `modified` có fingerprint trước khác fingerprint sau;
  `unchanged` có hai fingerprint bằng nhau và không phát class nào.
- Ít nhất một lần ghi là tạo mới hoặc sửa.
- Chế độ `receipt-only` không ghi thuộc tính contract nào; chế độ `attribute` ghi thuộc tính đó ở mọi
  nơi có class đã resolve được ghi.
- Mọi đường đã khai mà không có lần ghi nào đều mang finding `WRITE_SET_PATH_UNUSED`.
- Mọi finding đều gọi tên một đường đã khai và đồng ý với hành động đã ghi nhận của đường đó.
- `artifactRefs` đăng ký mọi đường được tạo mới hoặc được sửa.
- `handoff` luôn là `null`.

## Kết quả thực tế

Ghi một cây dashboard đã resolve: file trang được sửa và mang `GAP-5` cùng lời khai của nó, một file
summary section mới được tạo và mang `GAP-4` với `GAP-1`, còn đường legend đã khai thì không sinh ra
gì và được báo là không dùng tới. Hai đường vào `artifactRefs`, một đường thì không, vì không có gì
được ghi vào nó.

Ghi một cây đã resolve mà thay đổi chạm tới shell: lần gọi trả `WRITE_REJECTED` gọi tên đường shell
đó, và không file nào ở bất kỳ đâu được ghi.
