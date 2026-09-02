# Thực thi `release.deploy`

## Một việc duy nhất

Triển khai một bản phát hành bất biến lên một target đã khai, và chứng minh trạng thái ổn định mà nó
đạt tới. Đây là một lần gọi operator tuyến tính. Nó không gọi operator khác, không định tuyến workflow,
không tự dừng giữa chừng, và không trả về chỉ dẫn điều khiển dạng tự do.

Phục hồi và rollback là hai nhánh của chính việc này, không phải hai việc khác. Một rollout không ổn
định được vẫn là vấn đề của operator này, và lần chạy kết thúc ở đúng một trong ba điểm cuối: release
được triển khai, release cũ được khôi phục, hoặc công việc bị chặn kèm lý do chính xác.

## Bản phát hành là bất biến và chính xác

Một release được định danh bằng digest `sha256:` của nó, không phải bằng tag, nhánh hay số build.
Artifact không bao giờ được dựng lại, gắn tag lại, hay thay thế bên trong lượt này. Nếu digest không
phân giải được, lần chạy bị chặn; nó không dựng một bản thay thế rồi gọi đó là cùng một release.

Manifest phải đã được kiểm đúng với release này. Manifest ghim vào release khác không thể cho phép
release này, vì đúng phép thế đó là cách một image chưa qua rà soát chạm tới một target đã rà soát.

## Sự cho phép được khai, không bao giờ được ngầm hiểu

Triển khai đòi giấy phép riêng đã khai, phủ đúng project này, môi trường này, target này và hành động
`deploy`, còn hiệu lực tại lúc target được quan sát. Không task thường nào, không tiền lệ từ dự án anh
em nào, và không sự gấp gáp nào ngầm cho phép nó.

Mất mát không hồi lại, xoay vòng credential, hoặc một host, domain, tenant hay project mới đều nằm hẳn
ngoài thẩm quyền của operator này và trả `APPROVAL_REQUIRED`.

## Credential được phân giải, không bao giờ được ghi lại

Handle được phân giải qua custody sẵn có đúng lúc cần. Giá trị đã phân giải không bao giờ đi vào kế
hoạch, manifest, receipt, một dòng log, một tham số lệnh, hay một tin nhắn. Receipt chỉ ghi những
handle nào đã được phân giải, và không trường nào trong hợp đồng chứa nổi một giá trị kể cả khi có
người cố tình.

## Trình tự thực thi

1. **Kiểm tra input và resume.** Áp `input.schema.json` cùng kiểm tra ngữ nghĩa. Từ chối giấy phép lạ
   hoặc hết hạn, manifest ghim nơi khác, quan sát của target khác, danh tính bị thay thế không khớp
   release đang chạy, deadline không chứa nổi cửa sổ của nó, danh tính rollback trùng release, và
   resume không đổi gì.
2. **Ràng release và kế hoạch.** Biên dịch ý định đã khai cùng trạng thái quan sát thành kế hoạch mà
   lượt này sẽ chạy. Mọi tác động đều là compare-and-set với release đã đóng băng, target đã đóng băng,
   và revision đã quan sát.
3. **Khởi tạo execution root và phân giải credential.** Execution root bị ignore và dựng lại được.
   Credential phân giải theo tên; không có gì bị ghi xuống.
4. **Chuẩn bị host, publish artifact, migrate, và hoà hợp domain.** Mỗi bước trong số này sở hữu một
   ranh giới và ghi revision quan sát được của ranh giới đó trước và sau. Một trạng thái mong muốn vốn
   đã khớp là một no-op bất biến đã được chứng minh và phải được ghi đúng như vậy; khai là đã áp dụng
   mà không dịch chuyển revision sẽ bị loại.
5. **Rollout.** Ở dự án này, đẩy `main` kích hoạt workflow GitHub Actions. Bước rollout ghi revision
   của target trước và sau.
6. **Giám sát dưới deadline có chặn và backoff.** Quan sát phân biệt `progressing` với thất bại. Boot ở
   đây mất khoảng tám tới chín phút, nên `progressing` là điều kiện dự kiến trong phần lớn cửa sổ và
   không bao giờ bị coi là hỏng. Một probe chập chờn duy nhất không bao giờ biến thành phục hồi; điều
   kiện thất bại phải kéo dài qua nhiều lần quan sát.
7. **Phát hiện trôi dạt đồng thời trước khi hành động.** Nếu xuất hiện một release không phải release
   này cũng không phải release nó thay thế, lần chạy dừng lại và lập kế hoạch lại. Nó không bao giờ
   được phục hồi hay rollback như thể release đó thuộc về đây.
8. **Đi vào nhánh phục hồi khi thất bại kéo dài.** Phục hồi chỉ lặp lại những hành động thuận nghịch đã
   được duyệt và giữ nguyên danh tính release. Cạn kiệt, một hành động không an toàn, một ranh giới đã
   đổi, hay một danh tính rollback không còn đều đưa việc sang phê duyệt, rollback, hoặc bị chặn.
9. **Đi vào nhánh rollback khi phục hồi không giữ nổi.** Rollback chỉ hợp lệ khi đúng release an toàn
   đó còn tồn tại, trạng thái dữ liệu và schema hiện tại còn tương thích, và mọi thay đổi ở provider
   hay runtime đều ghi revision trước và sau.
10. **Chứng minh trạng thái ổn định rồi dừng.** Ổn định nghĩa là digest bất biến đang hoạt động, mọi
    target đã khai đều sẵn sàng, không target bị thay thế nào còn hoạt động trừ khi chiến lược cho
    phép, và mọi probe đã khai đều pass suốt cả cửa sổ. Ghi receipt dưới
    `input.project.artifactRootRef`, phát đúng một output theo `output.schema.json`, rồi dừng.

## Trạng thái ổn định được chứng minh, không được giả định

Một rollout trả về mà không báo lỗi thì chưa phải là một lần triển khai. Sự phân biệt này được thi
hành: kết cục `deployed` đòi bằng chứng giám sát, một điều kiện cuối là ổn định, digest đang chạy bằng
đúng digest đã triển khai, mọi target đều sẵn sàng, và mọi probe đã khai đều pass suốt cả cửa sổ.

Đó là thứ biến ba kiểu hỏng im lặng thành phát hiện được:

- workflow kết thúc trong khi digest cũ vẫn đang phục vụ;
- một trong hai target không bao giờ quay lại và cái còn lại gánh hết tải;
- probe sẵn sàng pass đúng một lần, đúng vào khoảnh khắc nó được hỏi.

## Thực thi khi resume

Resume bắt đầu lại từ bước kiểm tra, chỉ tái dùng những quan sát còn nguyên fingerprint, và tiêu thụ
đúng phần delta. Resume không thêm được thay đổi nào về cho phép, manifest, credential hay quan sát thì
trả `NO_PROGRESS`. Một lần chạy tiếp nối giữ nguyên danh tính release; một release khác là một lần
triển khai khác.

## Các đòn tấn công bắt buộc

Operator không được báo là đã triển khai khi còn bất kỳ mục nào áp dụng được mà chưa xử lý:

- một bước khai là đã áp dụng mà không dịch chuyển revision của ranh giới nó sở hữu, hoặc ghi revision
  cho một ranh giới nó chỉ đọc;
- digest đang chạy ở cuối không phải digest mà lần chạy này triển khai;
- một probe đã khai chưa từng pass trong cửa sổ, hoặc cửa sổ chưa từng trôi đủ;
- một target bị thay thế vẫn còn hoạt động dưới chiến lược không cho phép;
- phục hồi được kích hoạt chỉ từ một lần quan sát thất bại, hoặc hành động lên một danh tính release
  khác;
- một release lạ đã được quan sát mà lần chạy vẫn tiếp tục;
- một lần chạy đã rollback lại được báo như là đã giao thành công chính release nó vừa từ chối.
