# Render truth proof

File này trả lời đúng một câu hỏi: mọi tuyên bố nhìn thấy được và đọc lên được trên trang đã render
có truy ngược về một thứ mà sản phẩm thật sự xác lập không.

Một tuyên bố là bất cứ điều gì trang khẳng định: một từ, một glyph, một sắc thái, một state, một
thông báo live, một lời hứa về lối phục hồi. Phần audit kiểm kê các tuyên bố đã render rồi truy từng
cái về nguồn của nó. Một tuyên bố không có nguồn là tuyên bố bịa, bất kể tầng nào bịa ra nó.

## TRUTH-1 — Dữ kiện trung tính ở nguyên trạng thái trung tính

Chi phối nội dung mà authority cấp mà không kèm bất kỳ status nào.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Authority cấp một dữ kiện thuần | Nó render thành chữ thường, không vai trò status, không state thành công hay lỗi, không tính khẩn. Một vai trò alert trên chữ mặc định sẽ bác bỏ nó |
| Case 2 | Có glyph, sắc thái hoặc vị trí được thêm quanh dữ kiện | Không cái nào đọc lên thành kết cục hay thành sự bảo chứng. Một dấu tích cùng treatment thành công trên một câu mô tả năng lực sẽ bác bỏ nó |
| Case 3 | Một family sơn cả vùng đó | Dữ kiện trung tính vẫn trung tính dưới lớp sơn ấy. Cả một tập dữ kiện gói dịch vụ bị sơn thành cảnh báo sẽ bác bỏ nó |
| Case 4 | State hoặc viewport thay đổi | Kiểm kê lại tuyên bố ở đó, vì một dữ kiện trung tính ở bề rộng này có thể không còn trung tính ở bề rộng khác |

## TRUTH-2 — Quyền dùng đi theo authority

Chi phối các tuyên bố về việc người đọc hiện tại được làm gì.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Authority xác nhận một năng lực tĩnh không dùng được ở đây | Hàng đó mang `state="unavailable"` với label chính xác và một mô tả gọi tên điều kiện đã kiểm chứng. Copy ngụ ý tính năng đã bật sẽ bác bỏ nó |
| Case 2 | Thứ không dùng được là một câu lệnh chứ không phải một năng lực tĩnh | Owner của action mang `isDisabled`, và ngữ nghĩa disabled có mặt trong đầu ra đã render |
| Case 3 | Chỉ có dấu state đứng ra làm bằng chứng | Ở đây dấu đó chỉ trang trí hoặc vắng mặt, nên sự thật khả truy cập vẫn phụ thuộc vào phần chữ được cấp. Suy ra một status không dùng được từ phần sơn sẽ bác bỏ nó |
| Case 4 | Một action đang hiện và được lấy làm bằng chứng về quyền | Hiện diện không phải là quyền. Quyền được giải quyết từ authority rồi mới lái owner thật |
| Case 5 | Một family sơn hàng không dùng được | Nó ở lại dạng bất hoạt. Phần sơn affirmative đè lên một dữ kiện không dùng được sẽ bác bỏ nó |

## TRUTH-3 — Tiến trình không phải kết cục

Chi phối ranh giới giữa việc đang chạy và một kết quả.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Một câu lệnh đã nhận việc | Tiến trình ở lại trên câu lệnh đó, nhãn của nó sống sót, và lần kích hoạt thứ hai bị chặn trong lúc việc chạy |
| Case 2 | Có một kết quả được tuyên bố | Authority đã xác nhận nó trước. Một thông điệp thành công render trong lúc request còn chạy sẽ bác bỏ nó |
| Case 3 | Có tuyên bố về việc điều hướng | Hiệu ứng điều hướng thật sự tồn tại. Một thông điệp nói rằng người đọc đang được đưa đi đâu đó, khi chưa có gì bắt đầu, sẽ bác bỏ nó, và một status điều hướng render thành lỗi thì bác bỏ nó hai lần |
| Case 4 | Pending và kết cục sẽ cùng chiếm một khoảnh khắc | Chúng không được cùng chiếm. Một family sơn affirmative đè lên một control đang pending sẽ bác bỏ trạng thái hiện tại |
| Case 5 | Copy nêu ra một lối phục hồi hoặc một tuyến đường | Nó tồn tại và chạm tới được. Một lời hứa thử lại mà không có lối phục hồi nào được nối sẽ bác bỏ lời hứa đó |

## TRUTH-4 — Bằng chứng tuyên bố và thứ bác bỏ nó

Chi phối những gì khép lại một tuyên bố về render truth.

| Case | Dùng khi | Quan sát |
| --- | --- | --- |
| Case 1 | Đang khép lại bất kỳ state nào chạm tới được | Kiểm kê ở state đó mọi tuyên bố do chữ, icon, hình khối, sắc thái, vị trí, chuyển động, native state, live region và ngữ nghĩa trợ năng mang |
| Case 2 | Một tuyên bố đã được kiểm kê | Truy nó về authority business, về kết quả runtime hiện tại, về quyền hiện tại, và về hiệu ứng hoặc lối phục hồi thật sự tồn tại |
| Case 3 | State, theme hoặc viewport thay đổi | Chạy lại kiểm kê ở đó. Một theme hoặc một trạng thái cũ rồi làm mới bị bỏ sót thì không khép được gì |
| Case 4 | Một family hoặc ứng dụng thêm delta | So sánh riêng đầu ra công khai cô lập, delta của family, delta của ứng dụng và pixel hiện tại |
| Case 5 | Có người đưa ra bản duyệt copy hoặc prop trong source làm bằng chứng | Chúng không đủ. Một tuyên bố đã render được chứng minh bằng đầu ra đã render và bằng authority đã truy ngược |

## File này không quyết định

Một dữ kiện nhận cấp độ nào thuộc [Hierarchy](../composition/hierarchy.vi.md), có những điều kiện
nào và carrier nào giữ từng cái thuộc [State](../composition/state.vi.md), còn một thông điệp thuộc
về đâu thuộc [Feedback](../composition/feedback.vi.md). Tuyên bố có được đọc lên đúng cách không
thuộc [Accessibility](accessibility.vi.md), chuyển động có ngụ ý nó không thuộc [Motion](motion.vi.md),
và người đọc có chạm tới được control hành động theo nó không thuộc [Focus](focus.vi.md).
