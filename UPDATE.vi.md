# Cập nhật cây này

Đọc file này trước khi sửa bất cứ thứ gì dưới `knowledge/`, `operators/`, `templates/`, `workflows/`,
`scripts/` hay `resources/`. Đây là chuẩn để bảo trì cây, không phải bản mô tả những gì cây đang nói.

Một cây skills hình dạng này là một tập địa chỉ ổn định. Rule mang id mà file khác, biên nhận và
validator trỏ tới; operator mang bảng bước mà script đọc; template mang hợp đồng mà mọi tài liệu được
viết ra đều bị đối chiếu. Thứ giữ cho một cây như vậy còn dùng được sau một năm không phải là nó nói
nhiều bao nhiêu, mà là mỗi điều được nói ở bao nhiêu chỗ. Mọi lần sửa đều đo bằng đúng một thước:
**số nhà trên một khái niệm**. Một thay đổi trả lời câu hỏi mà nơi khác đã trả lời rồi thì đã làm cây
to ra và tệ đi, bất kể nó thêm được gì.

## Bốn câu hỏi, theo thứ tự

Trước khi viết, trả lời bốn câu này theo thứ tự và dừng ở câu đầu tiên đúng.

**1. Điều đó đã bị cấm sẵn chưa?**
Nếu một rule đã nói không mà vi phạm vẫn xảy ra thì đây là lỗ hổng cưỡng chế, không phải lỗ hổng tri
thức. Cách sửa là một script, một validator, một bước operator hay một mã dừng — thứ lẽ ra đã từ chối
việc đó. Thêm một rule lặp lại rule cây đã publish thì lỗ vẫn còn nguyên và có thêm một nhà phải nuôi.
Cổng báo không phát hiện nào trong khi việc rõ ràng sai chính là dấu hiệu của trường hợp này.

**2. Khái niệm này chưa có nhà nào cả?**
Vậy thì một rule, đặt trong file mà bên đọc nó ràng, phát biểu một *hình dạng*. Rule nói điều gì phải
đúng với mọi thể hiện; nó không bao giờ trưng ví dụ lấy từ sản phẩm mà cây tình cờ được cài vào. Nối
thêm số thứ tự kế tiếp của tiền tố topic đó.

**3. Một rule đang sai, hoặc hẹp hơn sự thật?**
Sửa Case của chính rule đó và giữ nguyên id. Một rule anh em sinh ra vì rule gốc hơi lệch là con đường
phổ biến nhất khiến cây mọc thêm nhà thứ hai. Nới một Case, thay `Dùng khi` của nó, hay thêm một Case
vào cùng rule đều tốt hơn một id mới.

**4. Khái niệm đã nằm ở hai chỗ?**
Gom lại. Chọn một nhà — file mà bên đọc khái niệm ấy ràng — và rút mọi chỗ còn lại về một câu trích
dẫn id của rule ấy. Trích dẫn là một liên kết và một định danh, không bao giờ là một câu diễn giải;
diễn giải là nhà thứ hai khoác áo trích dẫn.

## Được thêm gì, và không được thêm gì

Được thêm:

- **Một khái niệm** chưa có nhà, dưới dạng một rule phát biểu hình dạng.
- **Một cổng**: validator, lượt quét, ràng buộc schema hay mã dừng khiến một rule sẵn có từ chối được.
- **Một bước operator**, khi một operator sẵn có từ nay phải đọc hoặc phát ra thêm thứ gì.
- **Một ghi chú bằng chứng** dưới `tests/evidence/`, ghi những lần xuất hiện đã biện minh cho rule.

Không được thêm:

- **Ví dụ code lấy từ một sản phẩm.** Rule phát biểu hình dạng: một quan hệ, một ràng buộc, một điều
  kiện. Tên component cụ thể, đường dẫn file, số dòng, sha commit và số đếm thuộc về bằng chứng, không
  thuộc về luật.
- **Tên sản phẩm.** Cây được cài bởi những đội không chia sẻ lịch sử đã sinh ra nó. Một rule nêu tên
  một repo, một ứng dụng, một công ty hay một trang thì họ không đọc được.
- **Một ngưỡng được nhắc lại.** Một con số sống ở đúng một rule. Mọi rule khác cần nó thì trích id của
  rule ấy. Hai bản sao của một con số sẽ trôi khỏi nhau, và người ta phát hiện ra sự trôi ấy dưới dạng
  mâu thuẫn giữa hai cổng cùng xanh.

## Sửa thế nào

- **Id là địa chỉ công khai ổn định.** Biên nhận, validator, rule khác và ghi chú của đội khác đều trỏ
  vào chúng. Không bao giờ đánh số lại, dùng lại, hay lặng lẽ đổi nghĩa của một id.
- **Case chỉ nối thêm.** Case là số thứ tự trong phạm vi rule. Thêm Case *n+1*; không đánh số lại
  những Case phía trên. Sửa chữ của một Case đang sai là đúng; tách một Case thành hai id mới thì không.
- **Một ngưỡng sống một lần.** Khi một rule cần con số mà rule khác sở hữu, nó nêu tên rule chủ và
  tình huống, rồi dừng. Khi hai rule đều muốn sở hữu một con số thì đó là dấu hiệu khái niệm đã bị cắt
  sai chỗ: gom trước, rồi mới phát biểu con số một lần.
- **Đổi hợp đồng trước, đổi tài liệu sau.** Hình dạng được cưỡng chế bằng hợp đồng template. Muốn đổi
  hình dạng thì đổi hợp đồng, chạy validator template, và đưa mọi tài liệu nó nêu tên về đúng hình
  dạng trong cùng một commit.

## Xoá thế nào

Một rule không bao giờ bị xoá và không bao giờ bị đánh số lại. Nó **nghỉ**: số của nó thôi được
publish, và file từng publish nó ghi lại việc nghỉ bằng văn xuôi, nêu id và nêu rule sống sót đã nhận
nó. Con số ấy không bao giờ được dùng lại. Vì vậy một topic có thể publish một dãy không liên tục, và
đó chính là kết quả mong muốn — người đọc gặp một trích dẫn cũ vẫn tra ra được.

Cổng trích dẫn hiểu điều này: một dòng nói rằng một số đã nghỉ thì được phép nêu những số topic không
còn publish, nên bản ghi vẫn hợp lệ mà không mở lại địa chỉ.

## Bằng chứng

- Một rule cần **ít nhất hai lần xuất hiện độc lập** trước khi thành luật. Một lần là giai thoại, và
  luật hoá nó là biến một tai nạn cục bộ thành ràng buộc lên tất cả mọi người.
- Các lần xuất hiện được ghi dưới `tests/evidence/`, có ngày, bằng văn xuôi, với đủ chi tiết cụ thể mà
  chúng cần — đường dẫn, số đếm, ảnh chụp, số dòng. Bằng chứng được phép cụ thể chính vì nó không phải
  luật.
- Rule trích bằng chứng của mình ở dòng `Sources:`. Dòng ấy là mối nối giữa hình dạng và những quan
  sát đã biện minh cho nó.
- Bằng chứng đi ngược lại rule dự định thì ghi đúng như nó có. Một rule viết ngược với quan sát còn tệ
  hơn không có rule, và con số từ chối nó là thứ hữu ích nhất trong file.

## Ngôn ngữ

- **File `.md` tiếng Anh là thẩm quyền runtime duy nhất.** Mọi context manifest, danh sách phụ thuộc,
  ràng buộc operator và đầu vào validator đều nêu tên một file tiếng Anh.
- **File `.vi.md` cùng gốc tên là bản soi cho người đọc**, viết trong cùng commit với bản tiếng Anh nó
  soi. Không gì nạp một bản soi làm thẩm quyền.
- Thứ duy nhất *đọc* bản soi là cổng đối chiếu chứng minh nó chưa trôi khỏi bản gốc tiếng Anh. Cổng ấy
  không lấy thẩm quyền từ bản soi; nó chỉ so sánh.

## Cưỡng chế trước đã

Mọi rule mà một operator dựa vào đều có thứ đứng sau để từ chối một vi phạm: một validator, một ràng
buộc schema, một lượt quét, hay một mã dừng trong chính bảng của operator. Một rule không có gì đứng
sau là lời khuyên, và lời khuyên chính là thứ bốn câu hỏi ở trên tồn tại để khỏi phải thêm vào.

Một cổng đọc chính file rule. Nó không mang bản sao riêng của một ngưỡng, một danh sách đóng hay một
tập tên — nó phân tích chúng ra từ file publish chúng, để sửa rule là cổng đổi theo và không có nhà
thứ hai nào để quên. Một cổng gõ cứng điều mà rule phát biểu thì chính nó đã là nhà thứ hai của khái
niệm ấy, và lần sửa rule kế tiếp sẽ đi qua nó trong im lặng.

## Sinh lại

Một số file trong cây được sinh ra và không bao giờ được sửa tay. Sau khi đổi nguồn của chúng, sinh
lại và commit kết quả:

| File sinh ra | Sinh lại bằng |
| --- | --- |
| `operators/INDEX.md` (+ bản soi) | `node scripts/generate-operators-index.mjs` |
| `alias/INDEX.md` (+ bản soi) | `node scripts/generate-alias-doc.mjs` |
| `docs/reference/**` (+ `docs/vi/reference/**`) | `node docs/scripts/generate-docs.mjs` |
| catalog của trang đã publish | bước sinh của chính trang đó |

Mỗi generator có chế độ `--check`, và lượt test dùng chế độ ấy: một file sinh ra bị cũ là lỗi build
chứ không phải một sai lệch im lặng.

## Phát hành

- Một phiên bản, một **dòng phả hệ**. Mỗi lần phát hành thêm đúng một dòng vào mục phả hệ của index
  gốc, nói đổi gì và vì sao, mới nhất lên trước. Phả hệ là lịch sử của chính cây và là tường thuật duy
  nhất nó giữ.
- **Patch**: một cổng, một validator, một câu chữ, một file sinh lại, một ghi chú bằng chứng. Không id
  nào đổi nghĩa và không hình dạng tài liệu nào đổi.
- **Minor**: một khái niệm mới với id mới, một bước operator mới, một mục template mới, một mã dừng
  mới, một khái niệm được gom khiến id cũ nghỉ. Mọi địa chỉ cũ vẫn tra ra được.
- **Major**: một địa chỉ thôi tra ra được, một hình dạng tài liệu đổi tới mức bản đã cài không đọc
  nổi, hoặc hợp đồng định tuyến của entry đổi.

Một cây chỉ publish được khi lượt test của nó xanh. Không có thời gian ân hạn, vì một cây mà cổng của
chính nó đang đỏ thì không thể là thẩm quyền cho bất cứ thứ gì khác.

## Danh mục kiểm trước khi commit

Đi hết danh mục. Mỗi dòng là một thứ đã từng hỏng trong im lặng.

1. **Validator trích dẫn** — mọi định danh rule được trích ở bất cứ đâu đều tra ra một rule đã publish.
2. **Validator template** — mọi tài liệu được viết ra khớp hợp đồng của kind nó thuộc về, kể cả bản soi.
3. **Self-test của operator** — validator của từng operator nhận các nhánh hợp lệ và bác các đột biến.
4. **Kiểm docs** — bản tham chiếu sinh ra khớp với cây.
5. **Số nhà trên một khái niệm** — với mọi khái niệm lần sửa này chạm tới, đếm số file phát biểu nó.
   Con số ấy không được tăng. Nếu nó tăng, một trong số đó là câu trích dẫn bạn chưa viết.
6. **Không có danh tính sản phẩm trong luật** — không tên repo, tên ứng dụng, đường dẫn tuyệt đối,
   trích dẫn file:dòng, sha commit hay số đếm khảo sát trong `knowledge/**` hay `operators/**`. Nếu là
   bằng chứng thì nó thuộc về `tests/evidence/`.
7. **Mọi rule mới đều có cổng** — nêu tên cổng ấy. Nếu không nêu được thì bạn đang ở câu hỏi 1, không
   phải câu hỏi 2.

## Phả hệ của chuẩn này

Đúc ra từ việc vận hành một cây hình dạng này qua vài vòng dùng thật, nơi mọi điều ở trên đều học được
từ một lần hỏng cụ thể: một rule thêm vào chỗ thiếu cổng, một ngưỡng chép sang file thứ hai rồi mâu
thuẫn với bản gốc, một rule anh em sinh ra vì rule sẵn có hẹp hơn đúng một chữ, và một bộ test xanh
phủ lên một việc làm hoàn toàn sai. Chuẩn này được viết để cài kèm cây và để bất kỳ đội nào sở hữu một
cây như vậy đi theo.
