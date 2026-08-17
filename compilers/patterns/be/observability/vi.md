---
title: Observability · Vietnamese
---

# Quan trắc

Đầu vào là một shape đã được duyệt: một handler, worker, cron, một nhánh quyết định, một khối `catch`, một entry point đứng một mình, một đường đi của tín hiệu, hay một tiến trình telemetry mà ai đó đã đồng ý là nên có. Module này không mở lại quyết định ấy. Đầu ra của nó là kiến trúc source — dòng log đi ra qua service nào, cái tên lấy từ tập đóng nào, object có kiểu nào đi bên cạnh, tầng nào giữ transport và correlation id, và lối ra hợp lệ được khai trong file nào.

## Luật

Một dòng log là **một sự kiện có tên ổn định và dữ liệu đi kèm**, không phải một câu tiếng Anh. Nó đi ra qua **một** service duy nhất, đối số đầu tiên là **một thành viên enum**, và mọi thứ thay đổi được đi **bên cạnh** cái tên đó dưới dạng dữ liệu.

Lý do nằm ở những gì xảy ra sau khi dòng log rời khỏi tiến trình. Câu `handling order 4f2a for user 91` người đọc hiểu được, còn mọi thứ khác thì không: không đếm được, không group được, không đặt alert được, không lọc theo user được — trừ khi viết một regex, và regex đó vỡ ngay lần đầu có người sửa lại câu chữ. Cùng sự kiện ấy viết thành `ORDER_HANDLED` kèm `{ orderId, userId }` thì đếm được ngay từ giây nó tồn tại.

Câu hỏi chốt hạ: **có bao giờ mình muốn biết chuyện này xảy ra bao nhiêu lần không?** Nếu có — và với bất cứ thứ gì đáng log thì câu trả lời là có — nó cần một cái tên sống sót qua việc bị viết lại.

**Đây là luật bắt buộc, không phải lời khuyên.** Mọi dòng rời khỏi tiến trình đều thuộc đúng một mã dưới đây, và mọi tiến trình telemetry vận chuyển những dòng đó cũng vậy. Không có service nào nhỏ đến mức được miễn: một cron ba dòng vẫn log qua house service, vì cùng lý do một HTTP handler phải làm thế. Câu "chỉ là một dòng debug thôi mà" không phải ngoại lệ — đó là chỗ luật này bị bỏ qua nhiều nhất.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `OBSERVABILITY-<n>`. Mã đặt tên cho TÌNH HUỐNG; các cột nói tình huống ấy đòi gì và từ chối gì. Mã `1`–`6` quản một dòng log đơn lẻ. Mã `7`–`8` quản đường ống mà dòng đó đi qua, vì một cái tên sự kiện hoàn hảo chẳng đáng gì nếu nó không tới nơi nào, và một stack telemetry không ai sở hữu là sự cố thứ hai đang chờ sự cố thứ nhất.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `OBSERVABILITY-1` | Cần ghi lại một chuyện vừa xảy ra, trong tiến trình đang phục vụ một request hoặc một job | Log đi ra qua house logging service, được inject. Không bao giờ: `Logger` của framework, một logger tự tạo tại chỗ, `console.*` |
| `OBSERVABILITY-2` | Đang đặt tên cho chuyện vừa xảy ra | Đối số đầu tiên là một thành viên của enum tên log đóng. Không bao giờ: template literal, chuỗi ghép, hay một chuỗi trần làm tên sự kiện |
| `OBSERVABILITY-3` | Có id, số lượng, thời lượng, kết cục cần ghi kèm | Id, số lượng, thời lượng và kết cục đi thành một object có kiểu, đứng cạnh cái tên. Không bao giờ: nhét phần thay đổi được vào trong tên, hoặc bỏ nó đi luôn |
| `OBSERVABILITY-4` | Đang chọn chỗ đặt dòng log trong một hàm | Sự kiện ghi lại một QUYẾT ĐỊNH và bằng chứng nó được đưa ra trên đó. Không bao giờ: "đã vào hàm X", "đang rời handler", trace vào-ra |
| `OBSERVABILITY-5` | Dòng log nằm trong một `catch` | Một thất bại ghi code và metadata của exception. Không bao giờ: lấy câu thông báo đã render hay đã stringify của exception làm khoá group |
| `OBSERVABILITY-6` | Một chương trình chạy ngoài vòng đời request (CLI, agent, script) | Chương trình đứng một mình được dùng logger thường, khai một lần theo path. Không bao giờ: lấy lối ra theo từng dòng, hoặc đòi nó cho bất cứ thứ gì mà request chạm tới được |
| `OBSERVABILITY-7` | Đang dựng hoặc mở rộng đường đi của tín hiệu | Phase 1 Minimal giao con đường tín hiệu nhỏ nhất mà đầy đủ; Phase 2 Full cần bằng chứng đo được. Không bao giờ: coi Full là món nợ Minimal phải trả, hay lấy việc công cụ có sẵn làm lý do |
| `OBSERVABILITY-8` | Một collector, exporter, store hay dashboard sắp gia nhập runtime | Tiến trình telemetry tại chỗ mới phải khai đủ vòng đời trước khi chạy. Không bao giờ: thêm collector, exporter, store hay dashboard chỉ vì tính năng của nó |

`OBSERVABILITY-6` LÀ MỘT LỐI RA, KHÔNG PHẢI MỘT MỨC ĐỘ NGHIÊM KHẮC. Nó không nói luật nhẹ hơn với chương trình nhỏ; nó nói một chương trình không có request nào để correlate thì cũng chẳng có gì cho house service gắn vào. Ranh giới là request, không phải kích thước. Mọi thứ phục vụ qua HTTP hay qua queue đều có request, và mọi thứ có request đều dùng house service.

`OBSERVABILITY-7` và `OBSERVABILITY-8` không nói về cách viết một dòng log mà vẫn thuộc module này, vì cùng một kiểu hỏng sinh ra cả hai: một thứ được thêm vào runtime chỉ vì nó có sẵn, và sau đó không ai nói được nó chở tín hiệu gì hay ai là người tắt nó đi.

## Đọc một shape đã duyệt

1. **Đọc xem shape nói gì.** Nó nói rằng một handler, worker, cron, nhánh, `catch`, entry point, đường tín hiệu hay tiến trình telemetry có tồn tại và đã được đồng ý. Đó là quyết định, và nó đã đóng.
2. **Gọi tên phần shape không nói, rồi dừng lại ở đó.** Một shape đã duyệt gần như không bao giờ nói receiver là gì, thành viên enum nào, những trường có kiểu nào đi cạnh tên, bằng chứng nào đứng sau một quyết định, hay ai sở hữu và khi nào gỡ một tiến trình. Cái gì shape không nói thì module này không âm thầm bịa ra — nó được ghi là chưa giải, cho tới khi bảng Đầu vào bên dưới có bằng chứng.
3. **Giải từ ngoài vào trong.** Quyết đường ống trước khi quyết dòng log: `OBSERVABILITY-7` (đây là Minimal, hay là một bổ sung Phase 2 có bằng chứng đo được?) rồi `OBSERVABILITY-8` (có tiến trình mới nào gia nhập runtime không, và vòng đời của nó đã khai đủ chưa?). Xong xuôi mới đi xuống một call site cụ thể.
4. **Tại call site, hỏi câu hỏi của từng mã theo thứ tự.** Có request hay job nào để dòng này gắn vào không — nếu không, đây là lối ra `OBSERVABILITY-6` và mọi thứ bên dưới không áp dụng. Nếu có: receiver nào (`-1`), thành viên enum nào (`-2`), object có kiểu nào đi cạnh (`-3`), dòng này có ghi một quyết định kèm bằng chứng không (`-4`), và nếu nó nằm trong `catch` thì khoá group đã là danh tính của exception chưa (`-5`)?
5. **Khi hai mã cùng khớp, cả hai đều được sinh ra.** Chúng là hai lỗi khác nhau và không gộp lại. Một lời gọi đúng house service mà truyền template literal là `-1` đạt và `-2` hỏng. Một template literal thường phá `-2` và `-3` cùng lúc: một cái làm tên hết group được, một cái làm dữ liệu hết query được. Một thành viên enum hoàn hảo đặt cho việc "đã vào hàm" thì đạt `-2` mà vẫn phá `-4`. `-5` là trường hợp hẹp hơn và nghiêm hơn của `-3`, nên một dòng thất bại giải ra `-5`, không phải `-3`.

## `OBSERVABILITY-1` — log đi ra qua house service, và chỉ qua đó

**Tình huống.** Một service, handler, worker hay cron cần ghi lại một chuyện vừa xảy ra, và tiến trình đang phục vụ một request hoặc một job.

**Nó sinh ra gì trong source.** House logging service được inject vào class và lời gọi thực hiện trên nó. Không có gì được tạo tại chỗ. Correlation id, cấu hình transport và phần redaction nằm trong đúng service đó và không lặp lại ở call site.

**Dấu hiệu nhận biết.** Một logger được tạo tại chỗ trong class — `new Logger(...)` — hoặc một `console.*` còn sót. Dòng log ra đúng định dạng nhưng khi tra cứu thì **không có correlation id**. Cùng một request, có dòng thì tìm thấy trong log store, có dòng thì không.

Câu tự hỏi: dòng này có mang theo được request đã sinh ra nó không, hay chỉ mang theo nội dung của chính nó?

**Ranh giới.** Không phải `OBSERVABILITY-2`: `-1` hỏi **đi qua đâu**; `-2` hỏi **tên là gì**. Gọi đúng service mà truyền một template literal thì vẫn hỏng, và hỏng theo mã `-2`. Không phải `OBSERVABILITY-6`: nếu đoạn code đó chạy **ngoài** vòng đời request thì không còn request nào để gắn vào; đó là lối ra `-6`, không phải một lần vi phạm `-1`. Đây không phải chuyện định dạng — logger của framework ghi ra stdout đúng hình dạng và vẫn đánh mất request mà nó thuộc về, vì correlation id nằm trong service mà nó đi vòng qua.

**Tình huống nghiệp vụ hay gặp.** Handler thanh toán · worker xử lý job nền · cron dọn dữ liệu · listener của message queue · interceptor · guard · service tích hợp bên thứ ba.

## `OBSERVABILITY-2` — tên sự kiện là thành viên enum

**Tình huống.** Đang đặt đối số đầu tiên cho một lời gọi log. Đối số đó **đặt tên cho chuyện đã xảy ra**, và nó phải đến từ một tập đóng.

**Nó sinh ra gì trong source.** Một thành viên của enum tên log đóng ở vị trí đầu tiên. Nếu sự kiện chưa tồn tại, một thành viên mới được thêm vào chính enum đó kèm dòng JSDoc riêng — cái tên được sinh ra trong tập, không bao giờ tại call site.

**Dấu hiệu nhận biết.** Có `${}` trong đối số đầu tiên. Có dấu `+` nối chuỗi trong đối số đầu tiên. Đối số đầu tiên là một chuỗi viết thẳng, dù không có biến nào bên trong.

Câu tự hỏi: nếu ngày mai có người sửa lại câu chữ cho hay hơn, dashboard dựng trên dòng này có tắt tiếng không?

**Ranh giới.** Không phải `OBSERVABILITY-3`: `-2` cấm nhét dữ liệu **vào trong** tên; `-3` nói dữ liệu đi **bên cạnh** tên. Hai mã này thường bị vi phạm cùng lúc bởi một template literal, nhưng chúng là hai lỗi khác nhau: một cái làm tên hết group được, một cái làm dữ liệu hết query được. Không phải `OBSERVABILITY-4`: `-2` không hỏi sự kiện có đáng log hay không. Một tên enum đặt cho việc "đã vào hàm" vẫn là vi phạm `-4` dù đúng chuẩn `-2`. Chuỗi viết thẳng cũng bị cấm, không chỉ chuỗi có nội suy: một chuỗi cứng chỉ cách việc trở thành một sự kiện khác đúng **một** lần sửa chữ, và không ai coi việc sửa chữ là đổi hành vi.

**Tình huống nghiệp vụ hay gặp.** Tạo đơn hàng · huỷ đơn · gia hạn thuê bao · webhook nhận được · retry lần thứ n · job xong · job chết · đồng bộ bỏ qua vì trùng.

## `OBSERVABILITY-3` — phần thay đổi được đi cạnh cái tên

**Tình huống.** Sự kiện đã có tên, và còn id, số lượng, thời lượng, kết cục cần ghi lại kèm.

**Nó sinh ra gì trong source.** Một đối số thứ hai: object có kiểu, với interface thuộc riêng sự kiện đó, để trường mới được thêm vào một chỗ và mọi call site sai kiểu đỏ ngay lúc build chứ không im lặng tới lúc có người đi tra cứu.

**Dấu hiệu nhận biết.** Đối số thứ hai vắng mặt, trong khi câu chuyện rõ ràng có "cái nào" và "bao nhiêu". Dữ liệu bị nhét vào tên để "đọc cho tiện". Muốn thêm một trường mà lại phải sửa chính cái tên.

Câu tự hỏi: sáu tháng nữa cần lọc theo tenant, mình thêm một trường hay phải viết lại tên sự kiện?

**Ranh giới.** Không phải `OBSERVABILITY-2`: xem trên. Không phải `OBSERVABILITY-5`: `-3` nói về dữ liệu của một sự kiện bình thường; `-5` nói riêng về dữ liệu của một **thất bại**, nơi trường bắt buộc là danh tính của exception.

**Tình huống nghiệp vụ hay gặp.** `orderId` + `amount` + `currency` · `jobId` + `queueName` + `durationMs` · `tenantId` + `count` · `attempt` + `maxAttempts` · `outcome` + `reason`.

## `OBSERVABILITY-4` — log quyết định, không log việc đi ngang qua

**Tình huống.** Đang chọn chỗ đặt dòng log trong một hàm. Có hai chỗ hấp dẫn: đầu hàm, và chỗ code vừa **chọn** một nhánh.

**Nó sinh ra gì trong source.** Một dòng đặt tại nhánh, gọi tên thứ vừa được chọn và mang theo bằng chứng đã chọn trên đó. Không có gì ở đầu hàm hay cuối hàm.

**Dấu hiệu nhận biết.** Tên sự kiện nghe như tên hàm: `MethodEntered`, `HandlerStarted`, `LeavingService`. Đọc dòng log lên không biết được **vì sao** code làm thế, chỉ biết là nó có chạy. Xoá dòng log đi thì chẳng ai mất thông tin gì, vì source đã nói y hệt.

Câu tự hỏi: người đọc học được gì từ dòng này mà đọc source không suy ra được?

**Ranh giới.** Không phải `OBSERVABILITY-3`: một dòng ghi đúng quyết định mà thiếu bằng chứng thì vẫn hỏng, nhưng hỏng theo `-3` — thiếu dữ liệu, không phải sai chỗ đặt. Không phải `OBSERVABILITY-2`: mã `-2` chỉ xét hình dạng của tên. Một tên enum hoàn hảo cho một sự kiện vô nghĩa vẫn là vi phạm `-4`. Bước của pipeline là ranh giới mờ nhất: một sự kiện "step xong" chỉ đáng tồn tại khi step đó là một **kết cục** có thể khác đi — thành công, bỏ qua, thất bại — chứ không phải khi nó chỉ đánh dấu con trỏ đã đi tới đâu.

**Tình huống nghiệp vụ hay gặp.** Cấp quyền dùng thử vì chưa từng mua · bỏ qua tạo bản ghi vì đã tồn tại · chọn nhà cung cấp dự phòng vì cái chính hết hạn mức · từ chối webhook vì chữ ký sai · dừng retry vì đã chạm ngưỡng.

## `OBSERVABILITY-5` — thất bại ghi danh tính, không ghi câu chữ

**Tình huống.** Dòng log nằm trong một `catch`, và nó sẽ là thứ alert group theo.

**Nó sinh ra gì trong source.** `code` của exception và metadata của nó nằm trong object dữ liệu, đóng vai khoá group. Câu thông báo dễ đọc cho người có thể tồn tại bên cạnh như một trường phụ.

**Dấu hiệu nhận biết.** Có `error.message`, `String(error)` hoặc `${error}` đi vào trường dữ liệu. Một sự cố duy nhất hiện ra thành nhiều nhóm alert khác nhau trên dashboard. Sửa một câu thông báo cho dễ hiểu hơn xong thì alert cũ im lặng.

Câu tự hỏi: nếu ngày mai có người viết lại câu thông báo của exception này, alert có tách làm hai không?

**Ranh giới.** Không phải `OBSERVABILITY-3`: `-5` là trường hợp riêng và **nghiêm hơn** của `-3` — dữ liệu bắt buộc ở đây là `code` và metadata của exception. Không phải `OBSERVABILITY-4`: `-5` không nói dòng đó có đáng log hay không, chỉ nói khi đã log thì khoá group phải là danh tính. Câu chữ vẫn được phép tồn tại, miễn là nó không phải khoá group: nó là một trường phụ để người đọc dễ hiểu, không phải thứ dashboard đếm.

**Tình huống nghiệp vụ hay gặp.** Job chết · gọi API bên thứ ba lỗi · vi phạm ràng buộc CSDL · timeout · hết hạn mức · payload không hợp lệ.

## `OBSERVABILITY-6` — chương trình đứng một mình là lối ra duy nhất

**Tình huống.** Một CLI, một agent, một script chạy ngoài vòng đời request. Không có request để correlate, không có transport được cấu hình sẵn cho nó.

**Nó sinh ra gì trong source.** Một logger thường trong entry point của chính chương trình đó, và một dòng trong lint config giới hạn lối ra theo path của chương trình. Không có gì khác thay đổi.

**Dấu hiệu nhận biết.** Entry point là `main.ts` của một chương trình tự chạy rồi thoát. Logger được cần **trước khi** injector tồn tại. Không có `traceId` nào để gắn vào, vì không có ai gọi tới.

Câu tự hỏi: có tồn tại một request hoặc một job để dòng này gắn vào không? Nếu có thì đây **không** phải lối ra.

**Ranh giới.** Không phải `OBSERVABILITY-1`: lối ra dựa trên **có request hay không**, không dựa trên "chương trình này nhỏ mà". Một worker xử lý queue có job để gắn vào, nên nó nằm ở `-1`. Khai một lần theo path: lối ra là một dòng trong lint config trỏ vào thư mục của những chương trình đó, không phải một comment tắt rule trên từng dòng. Hai chỗ khai cùng một ngoại lệ là cách một trong hai chỗ âm thầm phình ra mà không ai thấy.

**Tình huống nghiệp vụ hay gặp.** CLI quản trị · agent chạy trong sandbox · script migrate chạy tay · tool build · bootstrap trước DI.

## `OBSERVABILITY-7` — Minimal trước, Full khi có bằng chứng

**Tình huống.** Đang dựng hoặc mở rộng đường đi của tín hiệu: log, metric, trace, alert.

**Nó sinh ra gì trong source.** Con đường nhỏ nhất mà đầy đủ: các tín hiệu lõi đã nêu được thu, được giữ hoặc chuyển tiếp qua một backend đã duyệt, sức khoẻ xem được, alert nguy cấp bắn được. Mọi thứ vượt quá đó là hạng mục Phase 2 và không được viết bây giờ.

**Dấu hiệu nhận biết.** Brief liệt kê một danh sách công cụ thay vì một danh sách tín hiệu. Lý do thêm là "nó tích hợp sẵn rồi", "cloud có mà", "bật cho đủ bộ". Không ai nói được cái gì **đã** có, cái gì đang thêm, cái gì cố tình hoãn.

Câu tự hỏi: con đường nhỏ nhất **đầy đủ** để thu được các tín hiệu lõi đã nêu, giữ hoặc chuyển tiếp chúng qua một backend đã duyệt, xem được sức khoẻ và bắn được các alert nguy cấp — con đường đó là gì?

**Ranh giới.** Không phải `OBSERVABILITY-8`: `-7` hỏi **có nên mở rộng phạm vi tín hiệu không**; `-8` hỏi **ai trả giá vòng đời** cho tiến trình sẽ chở tín hiệu đó. Một Phase 2 hợp lệ vẫn phải qua `-8`. Phase 2 không phải nợ của Phase 1: Minimal xong là xong. Full mở lại ở một Review sau, khi có một khoảng trống SLO hoặc debug đo được, một giới hạn scale/cardinality, một ràng buộc tuân thủ hay cư trú dữ liệu, một yêu cầu độ tin cậy, hoặc một chi phí đã chứng minh.

**Tình huống nghiệp vụ hay gặp.** Thêm tracing phân tán · thêm metric tuỳ biến · thêm profiling liên tục · thêm bộ dashboard thứ hai · nâng retention.

## `OBSERVABILITY-8` — mỗi tiến trình telemetry tự trả giá vòng đời của nó

**Tình huống.** Sắp có một agent, collector, exporter, store hay dashboard service trở thành một phần của runtime.

**Nó sinh ra gì trong source.** Hoặc không sinh ra gì mới — tín hiệu đi qua tiến trình hoặc backend đã duyệt sẵn có — hoặc một tiến trình được khai báo với đầy đủ chủ sở hữu, tài nguyên, cổng, credential, cách lưu trữ, health check, backup và điều kiện gỡ bỏ, tất cả viết ra trước khi nó chạy.

**Dấu hiệu nhận biết.** Brief nói về tính năng của công cụ, không nói về tín hiệu mà đường hiện tại **không** chở nổi. Không ai trả lời được: ai sở hữu, chiếm bao nhiêu tài nguyên, mở cổng nào, credential ở đâu, lưu bao lâu, health check ra sao, ai backup, khi nào thì gỡ đi. Câu "cứ dựng lên đã, sau tính" xuất hiện.

Câu tự hỏi: tín hiệu này có đi được qua tiến trình đã có hoặc một backend đã duyệt không? Nếu có thì tiến trình mới bị từ chối.

**Ranh giới.** Không phải `OBSERVABILITY-7`: xem trên. Không phải `OBSERVABILITY-1`: `-1` nói về **một dòng** đi qua đâu; `-8` nói về **cả một tiến trình** được thêm vào runtime. Managed không xoá nghĩa vụ: backend được quản lý làm giảm phần vận hành tại chỗ, nhưng PII, cardinality, egress, retention và chi phí vẫn phải được kiểm soát **trước khi** telemetry vượt qua ranh giới. Và "cloud-first" không có nghĩa là "cloud-only": bảo mật, cư trú dữ liệu, độ tin cậy hoặc chi phí đều có thể làm managed thành lựa chọn sai — khi đó lý do được ghi lại, không phải bỏ qua.

**Tình huống nghiệp vụ hay gặp.** Dựng collector tại chỗ · thêm một TSDB · thêm dashboard service · sidecar log shipper · store trace riêng.

## Tầng giữ

Tầng nào thực sự giữ từng mã ở thời điểm này. `unrepresentable` nghĩa là một union đóng hoặc kiểu branded làm cho giá trị sai không viết ra được; `enforced` nghĩa là một rule trong `@starci/eslint-canon-be` báo lỗi, tên nêu bên dưới; `documented` nghĩa là không có gì máy móc giữ nó, chỉ có người đọc giữ.

| Mã | Tầng | Cái gì giữ nó |
|---|---|---|
| `OBSERVABILITY-1` | `enforced` | `<plugin>/no-framework-logger` báo import `Logger` và `new Logger(...)`; `no-console` (rule chuẩn, nằm trong `recommended`) khoá nốt lối ra thứ ba |
| `OBSERVABILITY-2` | `enforced` | `<plugin>/no-interpolated-log-message` báo template literal, chuỗi ghép bằng `+` hoặc chuỗi trần ở đối số đầu tiên. Tại điểm neo, chữ ký của service thu hẹp chính đối số đó về `TName extends WinstonLog`, nên tầng kiểu cũng từ chối |
| `OBSERVABILITY-3` | `documented` | Không có gì kiểm tra rằng một object dữ liệu đã được truyền, hay rằng người ta thêm trường thay vì viết lại tên. `messageType` có kiểu tại điểm neo định hình object một khi có object được truyền; nó không thể bắt buộc phải có |
| `OBSERVABILITY-4` | `documented` | Muốn biết một dòng ghi quyết định hay ghi việc đi ngang qua thì phải biết đoạn code đó DÙNG ĐỂ LÀM GÌ. Không parser nào biết chuyện đó |
| `OBSERVABILITY-5` | `documented` | Parser chỉ thấy một trường mang giá trị chuỗi. Nó không phân biệt được `error.code` với `error.message` một khi cái nào cũng đã được gán vào một trường tên `error` |
| `OBSERVABILITY-6` | `documented` | Lối ra là config chứ không phải code: `standaloneProgramGlobs` được export để một danh sách duy nhất giới hạn phạm vi rule. Không có gì báo việc lối ra bị lấy theo từng dòng |
| `OBSERVABILITY-7` | `documented` | Ranh giới phase nằm trong một bản ghi Review, không nằm trong source. Không rule nào đọc được một lần hoãn |
| `OBSERVABILITY-8` | `documented` | Các trường vòng đời là một brief, và tiến trình sắp thêm thường không phải TypeScript |

Hai trên tám được `enforced`. Đó là con số thật thà, và sáu dòng `documented` mới là điểm chính của bảng này: chúng chỉ đúng chỗ luật chỉ còn sống nhờ người đọc, tức là chỗ nó sẽ bị phá trước tiên.

Tầng sở hữu mối quan tâm này là module logging thuộc platform: correlation id, cấu hình transport và phần redaction sống ở đó và không ở đâu khác. Mọi tầng còn lại — handler, worker, cron, service nghiệp vụ — phải mù tịt về transport, về correlation và về định dạng, chỉ biết đúng service được inject, thành viên enum và object có kiểu của nó.

## Điểm neo

Code thật để đối chiếu từng mã. Một luật không chỉ tay vào được thì chỉ là một đề xuất.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `OBSERVABILITY-1` | `modules/platform/winston/winston.service.ts` | Một class `@Injectable()` giữ cả ba transport; call site inject nó và không tạo gì cả. `eslint.config.mjs` bật `no-console` cho `src/**` và `apps/**` |
| `OBSERVABILITY-2` | `modules/platform/winston/enums/winston-log.ts` và chữ ký `log<TName extends WinstonLog>(name: TName, …)` trong `winston.service.ts` | Một enum đóng khoảng 128 thành viên, mỗi thành viên một dòng JSDoc; chữ ký chỉ nhận thành viên của enum đó |
| `OBSERVABILITY-3` | `modules/platform/winston/types/messages/*.ts` cùng `configMap` trong `modules/platform/winston/config.ts` | Mỗi sự kiện ánh xạ tới một interface có tên (`jobId`, `queueName`, `durationMs`, `success`), truy tới qua `(typeof configMap)[TName]["messageType"]` |
| `OBSERVABILITY-4` | `modules/platform/winston/enums/winston-log.ts` | Những thành viên có JSDoc nêu một quyết định — `EnrollmentAlreadyExists` "skipped create to stay idempotent", `CdnSynchronizerCourseAlreadySynced` "hash matched, upload skipped". Đồng thời nhìn họ `*StepExecuted` nằm ngay bên cạnh, vốn chỉ ghi việc đi ngang qua |
| `OBSERVABILITY-5` | `features/api/processors/ai/generate-cv/generate-cv.worker.ts` (lời gọi `JobExecutedFailed` trong `catch`) và `JobExecutedMessage.error?: string` trong `types/messages/worker.ts` | Trường đó đang được điền bằng `error.message`. Điểm neo này cho thấy luật đang bị bỏ lỡ, và đó chính là việc của một điểm neo |
| `OBSERVABILITY-6` | `apps/cli/src/main.ts` và `apps/playground-*-agent/src/main.ts` (đoạn bootstrap `new Logger()`) đối chiếu `standaloneProgramGlobs` trong `@starci/eslint-canon-be` | Bốn entry point đứng một mình, và những comment `eslint-disable` theo từng dòng chúng đang mang thay vì một glob khai một lần |
| `OBSERVABILITY-7` | `modules/platform/winston/winston.providers.ts` cùng cờ `loki` theo từng sự kiện trong `config.ts` | Ba provider — chỉ console, chỉ backend chuyển tiếp, cả hai — và một cờ cho mỗi sự kiện quyết định dòng nào được vượt sang. Đó CHÍNH LÀ con đường Minimal: không collector, không tracer, không pipeline metric nào bên cạnh |
| `OBSERVABILITY-8` | `modules/platform/env/config.ts` phần `loki` | Host, cờ bật auth và credential khai thành config có kiểu cho một backend được quản lý. Những trường vòng đời mà mã này đòi — chủ sở hữu, cổng, lưu trữ, health, backup, điều kiện gỡ — không có điểm neo, vì chưa có tiến trình telemetry tại chỗ nào để mang chúng: nửa đó **chưa neo được** |

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| receiver | Lời gọi thực hiện trên cái gì: house service được inject, hay một thứ khác |
| event | Thành viên enum đặt tên cho chuyện đã xảy ra, và nó đã tồn tại hay chưa |
| data | Những trường có kiểu đi cạnh cái tên: id, số lượng, thời lượng, kết cục |
| decision | Code đã chọn gì, và chọn trên bằng chứng nào |
| failure identity | Code và metadata của exception, khi dòng log nằm trong một `catch` |
| lifecycle | Có tồn tại một request hay một job để dòng này được correlate vào không |
| phase | Thay đổi này là Phase 1 Minimal, hay một bổ sung Phase 2 có bằng chứng đo được |
| process budget | Với mọi tiến trình telemetry mới: chủ sở hữu, tài nguyên, cổng, credential, lưu trữ, health, backup, điều kiện gỡ bỏ |

## Quy tắc

1. Một service duy nhất sở hữu việc logging. Correlation id, cấu hình transport và phần redaction sống ở đó và không ở đâu khác.
2. Tên sự kiện đến từ một tập đóng, không bao giờ đến từ call site.
3. Cái tên nói chuyện GÌ đã xảy ra; dữ liệu nói cái nào, bao nhiêu, bao lâu, và kết thúc ra sao.
4. Thêm một trường không phải là viết lại tên. Một tên sự kiện sống lâu hơn mọi trường bên cạnh nó.
5. Một thất bại group theo danh tính, nên sửa câu chữ cho hay hơn không bao giờ tách một alert làm hai.
6. Lối ra hợp lệ được khai một lần, theo path, trong cấu hình lint.
7. Phase 2 bắt đầu từ một phép đo, không bao giờ từ việc một tích hợp có sẵn cho tiện.
8. Một tiến trình telemetry mà không ai đồng ý sở hữu thì không phải là một phần của runtime.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ đều đóng và nêu rõ mã nó áp dụng vào.

- **Chương trình đứng một mình** (`OBSERVABILITY-6`). Một chương trình chạy ngoài vòng đời request được dùng logger thường. Khai **một lần theo path** trong lint config; không khai bằng comment tắt rule trên từng dòng, vì ngoại lệ khai theo dòng lớn dần cho tới lúc không ai đo được nó rộng bao nhiêu.
- **Bổ sung Phase 2** (`OBSERVABILITY-7`). Một bổ sung cụ thể vượt quá Minimal được chấp nhận khi có SLO hoặc khoảng trống debug đo được, giới hạn scale/cardinality, ràng buộc tuân thủ hay cư trú dữ liệu, yêu cầu độ tin cậy, hoặc chi phí đã chứng minh. Công cụ **có sẵn** không phải bằng chứng.
- **Backend được quản lý** (`OBSERVABILITY-8`). Backend được quản lý giảm phần sở hữu runtime tại chỗ; nó không xoá nghĩa vụ kiểm soát PII, cardinality, egress, retention và chi phí trước khi telemetry vượt qua ranh giới. Sở hữu tại chỗ vẫn hợp lệ khi bảo mật, cư trú dữ liệu, độ tin cậy hoặc chi phí đòi hỏi — được ghi lại như một ràng buộc, không phải chọn làm mặc định.
- **Câu chữ của lỗi** (`OBSERVABILITY-5`). Được phép nằm trong dữ liệu như một trường phụ cho người đọc. Không được là thứ alert group theo.

## Đầu ra

Một khối cho mỗi call site hoặc mỗi tiến trình mà shape đã duyệt sinh ra.

```text
call site: <file · method>
situation: <OBSERVABILITY-1 … OBSERVABILITY-8>
event: <enum member | n/a>
data: <typed fields beside the name>
tier: <unrepresentable | enforced | documented>
reason: <business fact that excludes the adjacent code>
```

## Ví dụ đã giải

**Shape đã duyệt:** một worker nền chạy một job sinh CV bằng AI và báo lại nó kết thúc ra sao.

```text
call site: src/features/api/processors/ai/generate-cv/generate-cv.worker.ts · handle
situation: OBSERVABILITY-3
event: JobExecuted
data: jobId, queueName, durationMs, success
tier: documented
reason: the worker is serving a job, so a lifecycle exists to correlate to — that excludes the OBSERVABILITY-6 exit, which turns on the absence of a request or job, not on the program being small
```

```text
call site: src/features/api/processors/ai/generate-cv/generate-cv.worker.ts · handle (catch)
situation: OBSERVABILITY-5
event: JobExecutedFailed
data: exception code and metadata as the grouping key; message only as a secondary field
tier: documented
reason: the line sits in a catch and is what alerts group by, which makes it the narrower and stricter case of OBSERVABILITY-3 rather than ordinary event data
```

**Shape không nói gì, và vì thế không giải được gì.** Nó không nói thành viên enum nào đặt tên cho thất bại, thành viên đó đã có sẵn trong tập đóng hay chưa, và interface message có kiểu nào chở các trường của nó. Nó không nói `code` của exception là gì, nên khoá group vẫn treo cho tới khi có bằng chứng ấy. Và nó không nói gì về đường ống: chuyện dòng này có vượt sang backend chuyển tiếp hay không là một quyết định `OBSERVABILITY-7`, còn ở đây không có tiến trình telemetry mới nào được đề xuất nên `OBSERVABILITY-8` không có gì để cân. Tại điểm neo hiện nay, `JobExecutedMessage.error?: string` đang được điền bằng `error.message` — luật đang bị bỏ lỡ, chỉ có người đọc giữ và không có gì khác giữ, vì parser không phân biệt được `error.code` với `error.message` một khi cái nào cũng đã nằm trong một trường tên `error`.

## Phạm vi

Module này phát biểu một luật đúng với mọi back end có ghi log. Nó không gọi tên sản phẩm nào, repository nào hay module riêng tư nào. Mọi ví dụ đều là TypeScript bình thường trong một hình dạng NestJS bình thường; các điểm neo là path, và một repository cất house service của mình ở chỗ khác thì đọc chúng như mô tả về thứ cần đi tìm, không phải như một đường import.
