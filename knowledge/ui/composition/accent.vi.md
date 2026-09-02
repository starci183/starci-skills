# Accent composition

File này trả lời đúng một câu hỏi: trang chỉ có một ngân sách nhỏ cho phần nhấn mạnh mạnh nhất, vậy
ngân sách đó tiêu ở đâu, và tiêu ở đó thì hứa điều gì.

Accent khan hiếm là do thiết kế. Mỗi treatment chủ đạo thêm vào lại làm giảm ý nghĩa của cái trước
đó, nên đây là quyết định về phân bổ chứ không phải về sơn phết. Không thứ gì trong file này được
đổi điều mà sản phẩm đang tuyên bố; accent chỉ làm cho một tuyên bố sẵn có dễ tìm hơn.

## ACCENT-1 — Một điểm nhấn quyết định chủ đạo

Chi phối số treatment mạnh nhất mà một vùng quyết định được giữ.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một vùng quyết định có đúng một bước kế tiếp rõ ràng | Đúng một điểm nhấn chủ đạo nằm bên trong decision owner đó, trên `Button variant="primary"`, dù nó mang `onPress` hay `href` |
| Case 2 | Các action anh em cùng ở trong vùng | Mỗi action anh em mang một variant công khai yếu hơn, nói đúng hệ quả thật của nó |
| Case 3 | Hai lựa chọn ngang hàng thật sự mang hệ quả ngang nhau | Không cái nào mang điểm nhấn chủ đạo, và không phần sơn nào phá thế hoà |
| Case 4 | Nhiều vùng tách biệt, mỗi vùng có bước kế tiếp riêng | Mỗi điểm nhấn chủ đạo được đếm trong chính decision owner của nó, và không cái nào bị đếm hai lần |
| Case 5 | Con số đó sẽ đổi ở bố cục hẹp hoặc ở trạng thái đang tải | Số điểm nhấn chủ đạo trùng khít nhau ở mọi state và mọi bề rộng |

## ACCENT-2 — Điểm nhấn định danh gọn

Chi phối cái mỏ neo thị giác nhỏ giúp người đọc quét qua các mục ngang hàng.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Các tính năng, hàng hoặc section ngang hàng cần một mỏ neo gọn để quét | `IconTile tone="accent"`, hoặc `Icon` ở vai trò đã khai báo, mang nó, với glyph ngữ nghĩa đã duyệt được gọi tên trong receipt |
| Case 2 | Mỏ neo nằm cạnh một cái tên | Phần chữ nhìn thấy được ở lại, và dấu hiệu không bao giờ thay chỗ nó |
| Case 3 | Direction muốn một plate khác cỡ hoặc khác hình | Geometry đã công bố mang nó, ở `sm` 32 hoặc `md` 40 pixel CSS danh nghĩa, và không ô bo tròn có màu nào được dựng lại quanh một icon |
| Case 4 | Glyph sẽ là danh tính duy nhất của một tính năng xa lạ | Mọi tính năng xa lạ đều mang một cái tên; không glyph nào là danh tính duy nhất của nó |

## ACCENT-3 — Selection, điểm đến và focus vẫn tách bạch

Chi phối ba treatment hay bị nhập lại thành một.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Một vùng có thể cùng lúc mang selection bền, một điểm đến, một điểm nhấn câu lệnh và focus bàn phím | Cả bốn thứ đều phân giải về owner công khai riêng và treatment riêng của mình |
| Case 2 | Đang diễn đạt selection | Selection mang một dấu hiệu không dựa vào màu và sống sót khi focus dời đi chỗ khác |
| Case 3 | Một điểm đến nằm trong đoạn văn | Nó nhận ra được là điểm đến ngay lúc nghỉ, trước hover và trước focus |
| Case 4 | Màu bị bỏ đi, hoặc người xem ở chế độ forced colors | Cả ba vẫn phân biệt được, vì không cái nào chỉ dựa vào phần tô |
| Case 5 | Một cú hover thoáng qua bị nhầm là selection | Không dấu hiệu thoáng qua nào mang một giá trị bền |

## ACCENT-4 — Accent cho tiến độ đòi một phép đo thật

Chi phối phần tô accent đọc lên như mức hoàn thành.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Authority cấp một giá trị đã kiểm chứng từ 0 đến 100 | `Progress` mang `label` trung thực và đúng `value` đó, và phần tô accent chỉ trình bày phép đo ấy |
| Case 2 | Giá trị chưa giải quyết | `isSkeleton` được gắn, và không thanh dài bằng không nào nêu ra một phép đo không ai thực hiện |
| Case 3 | Một thanh, vòng hay đường chỉ để trang trí, hoặc diễn đạt thứ hạng chứ không phải mức hoàn thành | Nó không mang ngữ nghĩa progress nào cả |
| Case 4 | Phần tô rất dễ bị đọc thành một kết cục | Phần tô nêu một phép đo, và một owner kết cục riêng nêu kết cục |

## ACCENT-5 — Kết cục và authority huỷ hoại không phải là accent

Chi phối những treatment mà accent không được đứng thay.

| Case | Dùng khi | Khẳng định |
| --- | --- | --- |
| Case 1 | Nội dung báo thành công, cảnh báo, nguy hiểm, đang chạy hoặc selection | `Badge`, một presentation-state owner, hoặc owner của trạng thái hiện hành mang nó; accent primary không mang thứ nào trong số đó |
| Case 2 | Cần một CTA huỷ hoại cuối cùng | Trước hết cần một treatment action danger có kiểu, và chừng nào `ButtonVariant` chưa công bố giá trị danger thì receipt ghi nhận gap đó |
| Case 3 | Màu đỏ cục bộ có thể lấp gap đó ngay hôm nay | Không màu đỏ cục bộ nào và không lần sơn lại `primary` của family nào đứng cạnh action đó |
| Case 4 | Một action primary bình thường trông có vẻ nặng hệ quả | Hệ quả và bước xác nhận được gọi tên trong quyết định sản phẩm, không suy ra từ phần nhấn mạnh |

## File này không quyết định

Nội dung mang cấp độ nào thuộc [Hierarchy](hierarchy.vi.md), và action nào xứng đáng nhận điểm nhấn
quyết định thuộc [CTA](cta.vi.md). Các state owner có thể ở những điều kiện nào thuộc
[State](state.vi.md). Một khác biệt có sống sót qua forced colors và qua reduced motion sau khi
render không thuộc [Accessibility](../proof/accessibility.vi.md) và [Motion](../proof/motion.vi.md),
còn điểm nhấn có tuyên bố điều mà authority chưa từng nói không thuộc
[Render truth](../proof/render-truth.vi.md).
