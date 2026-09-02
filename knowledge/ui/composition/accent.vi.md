# Accent composition

File này trả lời đúng một câu hỏi: trang chỉ có một ngân sách nhỏ cho phần nhấn mạnh mạnh nhất, vậy
ngân sách đó tiêu ở đâu, và tiêu ở đó thì hứa điều gì.

Accent khan hiếm là do thiết kế. Mỗi treatment chủ đạo thêm vào lại làm giảm ý nghĩa của cái trước
đó, nên đây là quyết định về phân bổ chứ không phải về sơn phết. Không thứ gì trong file này được
đổi điều mà sản phẩm đang tuyên bố; accent chỉ làm cho một tuyên bố sẵn có dễ tìm hơn.

## ACCENT-1 — Một điểm nhấn quyết định chủ đạo

Chi phối số treatment mạnh nhất mà một vùng quyết định được giữ.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một vùng quyết định có đúng một bước kế tiếp rõ ràng | Đúng một điểm nhấn chủ đạo bên trong decision owner đó, trên `Button variant="primary"`, dù nó mang `onPress` hay `href` |
| Case 2 | Các action anh em cùng ở trong vùng | Chúng lấy variant công khai yếu hơn, nói đúng hệ quả thật của mình |
| Case 3 | Hai lựa chọn ngang hàng thật sự mang hệ quả ngang nhau | Không cái nào thành chủ đạo; hệ quả ngang nhau không phải một thế hoà để phá bằng phần sơn |
| Case 4 | Nhiều vùng tách biệt, mỗi vùng có bước kế tiếp riêng | Mỗi vùng được giữ điểm nhấn chủ đạo của mình, đếm trong phạm vi decision owner của nó |
| Case 5 | Con số đó sẽ đổi ở bố cục hẹp hoặc ở trạng thái đang tải | Nó không đổi. Cùng một con số đứng vững ở mọi state và mọi bề rộng |

## ACCENT-2 — Điểm nhấn định danh gọn

Chi phối cái mỏ neo thị giác nhỏ giúp người đọc quét qua các mục ngang hàng.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Các tính năng, hàng hoặc section ngang hàng cần một mỏ neo gọn để quét | `IconTile tone="accent"`, hoặc `Icon` ở vai trò đã khai báo, với glyph ngữ nghĩa đã được duyệt do direction chọn |
| Case 2 | Mỏ neo nằm cạnh một cái tên | Phần chữ nhìn thấy được ở lại. Dấu hiệu hỗ trợ nhận diện chứ không bao giờ thay tên |
| Case 3 | Direction muốn một plate khác cỡ hoặc khác hình | Dùng geometry đã công bố, ở `sm` 32 hoặc `md` 40 pixel CSS danh nghĩa, thay vì tự dựng một ô bo tròn có màu quanh một icon |
| Case 4 | Glyph sẽ là danh tính duy nhất của một tính năng xa lạ | Không được. Thứ xa lạ phải có tên trước khi có dấu hiệu |

## ACCENT-3 — Selection, điểm đến và focus vẫn tách bạch

Chi phối ba treatment hay bị nhập lại thành một.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Một vùng có thể cùng lúc mang selection bền, một điểm đến, một điểm nhấn câu lệnh và focus bàn phím | Mỗi thứ giữ owner công khai riêng và treatment riêng |
| Case 2 | Đang diễn đạt selection | Nó có một dấu hiệu không dựa vào màu, và nó sống sót khi focus dời đi chỗ khác |
| Case 3 | Một điểm đến nằm trong đoạn văn | Nó nhận ra được là điểm đến ngay lúc nghỉ, trước khi bị hover hay focus |
| Case 4 | Màu bị bỏ đi, hoặc người xem ở chế độ forced colors | Cả ba vẫn phân biệt được, vì không cái nào chỉ dựa vào phần tô |
| Case 5 | Một cú hover thoáng qua bị nhầm là selection | Nó không phải selection. Một dấu hiệu thoáng qua không bao giờ mang một giá trị bền |

## ACCENT-4 — Accent cho tiến độ đòi một phép đo thật

Chi phối phần tô accent đọc lên như mức hoàn thành.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Authority cấp một giá trị đã kiểm chứng từ 0 đến 100 | `Progress` với `label` trung thực và đúng `value` đó, và phần tô accent chỉ là cách trình bày phép đo |
| Case 2 | Giá trị chưa giải quyết | `isSkeleton`, vì một thanh dài bằng không nêu ra một phép đo mà không ai thực hiện |
| Case 3 | Một thanh, vòng hay đường chỉ để trang trí, hoặc diễn đạt thứ hạng chứ không phải mức hoàn thành | Nó không mang ngữ nghĩa progress nào cả |
| Case 4 | Phần tô rất dễ bị đọc thành một kết cục | Nó không phải kết cục. Một thanh đầy chỉ đo; chỉ owner của kết cục mới kết luận |

## ACCENT-5 — Kết cục và authority huỷ hoại không phải là accent

Chi phối những treatment mà accent không được đứng thay.

| Case | Dùng khi | Chốt |
| --- | --- | --- |
| Case 1 | Nội dung báo thành công, cảnh báo, nguy hiểm, đang chạy hoặc selection | Nó ở lại với `Badge`, một presentation-state owner, hoặc owner của trạng thái hiện hành. Accent primary không bao giờ đứng thay |
| Case 2 | Cần một CTA huỷ hoại cuối cùng | Trước hết cần một treatment action danger có kiểu, mà `ButtonVariant` công khai hiện chưa có giá trị danger, nên phải ghi nhận gap |
| Case 3 | Màu đỏ cục bộ có thể lấp gap đó ngay hôm nay | Không lấp được. Phần sơn không tạo ra authority huỷ hoại, và một family sơn lại `primary` thành đỏ đã đổi nghĩa của một prop mà nó không sở hữu |
| Case 4 | Một action primary bình thường trông có vẻ nặng hệ quả | Nhấn mạnh không phải authority. Hệ quả và bước xác nhận thuộc về quyết định sản phẩm |

## File này không quyết định

Nội dung mang cấp độ nào thuộc [Hierarchy](hierarchy.vi.md), và action nào xứng đáng nhận điểm nhấn
quyết định thuộc [CTA](cta.vi.md). Các state owner có thể ở những điều kiện nào thuộc
[State](state.vi.md). Một khác biệt có sống sót qua forced colors và qua reduced motion sau khi
render không thuộc [Accessibility](../proof/accessibility.vi.md) và [Motion](../proof/motion.vi.md),
còn điểm nhấn có tuyên bố điều mà authority chưa từng nói không thuộc
[Render truth](../proof/render-truth.vi.md).
