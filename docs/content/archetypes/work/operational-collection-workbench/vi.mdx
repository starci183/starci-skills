# Bàn làm việc bộ sưu tập vận hành

## LOADS

Không có.

## Bản ghi

### Định danh

| Trường | Giá trị |
|---|---|
| Archetype ID | `operational-collection-workbench` |
| Họ | Work |
| Tác vụ chủ đạo | Liên tục tìm, kiểm tra và thao tác trên các bản ghi vận hành tương đồng mà không mất ngữ cảnh bộ sưu tập. |
| Bí danh tìm kiếm | worklist, queue, admin table, moderation, operations, master detail, record processing |
| Thẩm quyền | Topology trang và hành vi responsive dùng chung giữa các sản phẩm; không sở hữu ngữ nghĩa sản phẩm, component, token hay breakpoint cố định. |

Archetype này sở hữu một vòng lặp vận hành hữu hạn. Nó giữ điều khiển bộ sưu tập và kết quả nhất quán trong khi một bản ghi được chọn nhận phần kiểm tra sâu hơn cùng các hành động thay đổi trạng thái.

### Bất biến

- `collection-region` là owner duy trì liên tục chính; chọn bản ghi không bao giờ làm mất bộ lọc, sắp xếp, trang hay vị trí cuộn.
- `record-detail` phụ thuộc vào bộ sưu tập nhưng sở hữu đầy đủ dữ kiện, hành động, cảnh báo và phản hồi hành động của bản ghi được chọn.
- Hành động phá hủy hoặc có hệ quả phải hiển thị đối tượng và hệ quả trước khi cam kết.
- Cách trình bày rộng, trung gian và gọn giữ nguyên bản ghi có thể tìm kiếm, ý nghĩa trạng thái, hành động, phục hồi và điểm đến focus.
- Bảng là tùy chọn. Bản ghi tương đồng có thể dùng hàng hoặc một owner bộ sưu tập dày đặc khác, nhưng đây không bao giờ là catalogue khám phá bằng card.

## Nhận diện

### Mã tình huống

| Mã | Tình huống quan sát được | Hệ quả |
|---|---|---|
| `AR-OCW-01` | Người dùng liên tục xử lý các bản ghi tương đồng thay vì hoàn thành một tác vụ kết thúc duy nhất. | Tín hiệu dương bắt buộc. |
| `AR-OCW-02` | Tìm kiếm, bộ lọc, sắp xếp hoặc phân trang thu hẹp đáng kể một bộ sưu tập vận hành hữu hạn. | Bắt buộc có `collection-controls` và ngữ cảnh truy vấn bền vững. |
| `AR-OCW-03` | Một bản ghi được chọn cần dữ kiện hoặc hành động phong phú hơn khả năng của một hàng. | Bắt buộc có `record-detail` phối hợp. |
| `AR-OCW-04` | Hành động chuyển trạng thái, quyền, xuất bản, khóa, sao lưu hoặc trạng thái hệ trọng khác. | Bắt buộc thể hiện eligibility, xác nhận khi có hệ quả, pending, thành công, thất bại và xung đột. |
| `AR-OCW-05` | Nhiều bản ghi có thể cập nhật trong lúc người vận hành làm việc. | Giữ phục hồi stale/xung đột mà không âm thầm thay thế ngữ cảnh cục bộ. |
| `AR-OCW-90` | Các mục chủ yếu được khám phá và so sánh như card hoặc lựa chọn catalogue. | Từ chối; dùng archetype discovery. |
| `AR-OCW-91` | Trang là overview trạng thái không đồng nhất trước khi hành động. | Từ chối; dùng `overview-dashboard`. |
| `AR-OCW-92` | Người dùng hoàn thành một thao tác hữu hạn ngắn hoặc đọc một chủ thể tường thuật. | Từ chối; dùng authority task hoặc detail. |

### Quy tắc lựa chọn

Chỉ chọn khi có bằng chứng `AR-OCW-01`, không có mã từ chối và xuất hiện ít nhất một mã từ `AR-OCW-02` đến `AR-OCW-05`. Khi chưa biết độ sâu của bản ghi được chọn hoặc hệ quả hành động, trả `needs-evidence` thay vì tự đặt một pane chi tiết thường trực.

## Sơ đồ vùng

```text
operational-workspace
├─ workspace-header
│  ├─ workspace-identity
│  ├─ bounded-summary
│  └─ primary-entry-action [when evidenced]
├─ collection-controls [AR-OCW-02]
│  ├─ search
│  ├─ filters
│  ├─ sort-or-view-policy
│  └─ active-query-summary
├─ workbench
│  ├─ collection-region
│  │  ├─ result-feedback
│  │  ├─ operational-collection
│  │  └─ pagination
│  └─ record-detail [AR-OCW-03]
│     ├─ selected-record-context
│     ├─ record-facts
│     ├─ action-region [AR-OCW-04]
│     └─ action-feedback
└─ temporary-confirmation [consequential AR-OCW-04 action only]
```

### Nghĩa vụ vùng

| Vùng | Nghĩa vụ |
|---|---|
| `workspace-header` | Gọi tên chủ thể vận hành và summary hữu hạn mà không cạnh tranh với bộ sưu tập. |
| `collection-controls` | Sở hữu trạng thái truy vấn, bộ lọc đang hoạt động, hành vi reset và số kết quả; nhãn luôn hiển thị hoặc có thể xác định bằng chương trình. |
| `collection-region` | Sở hữu lựa chọn, trạng thái kết quả, ngữ nghĩa hàng, phân trang và cuộn trang chính. |
| `record-detail` | Sở hữu dữ liệu, eligibility, cảnh báo, hành động và trạng thái cục bộ của bản ghi được chọn; không proxy chúng qua page owner. |
| `temporary-confirmation` | Gọi tên chính xác đối tượng và hệ quả, giữ focus bên trong, rồi trả focus xác định sau hủy hoặc hoàn tất. |

## Hợp đồng responsive

### Rộng

- Chỉ dùng master-detail phối hợp khi có bằng chứng `AR-OCW-03`: bộ sưu tập là chính và chi tiết là hỗ trợ.
- Điều khiển thẳng hàng với bộ sưu tập và có thể wrap theo ý nghĩa; chúng không trở thành toolbar trôi nổi.
- Bộ sưu tập chỉ sở hữu cuộn ngang khi cột thiết yếu không thể giảm hợp lý. Cấm cuộn ngang ở cấp trang.
- Vùng chi tiết hỗ trợ chỉ được giữ hiển thị khi không tạo owner cuộn mơ hồ cạnh tranh hoặc che nội dung đang focus.

### Trung gian

- Chuyển cấu trúc khi khả năng hiểu bộ sưu tập hoặc đối tượng hành động không còn vừa, không theo nhãn thiết bị.
- Thay pane chi tiết thường trực bằng overlay hoặc panel theo bước, đồng thời giữ bản ghi được chọn và ngữ cảnh truy vấn.
- Giảm cột theo ưu tiên với nhãn accessible; không nén mọi cột desktop thành mảnh khó đọc.
- Bộ lọc có thể dùng surface tạm thời có tên, nhưng bộ lọc đang hoạt động và reset vẫn thấy được từ bộ sưu tập.

### Gọn

- Trình bày bộ sưu tập và chi tiết thành hai bước rõ ràng. Chọn bản ghi mở chi tiết; hành động quay lại kết quả phục hồi bộ lọc, trang, selection anchor và vị trí cuộn.
- Hàng trở thành summary dẫn theo ưu tiên hoặc anatomy hàng xếp chồng, không biến thành các card rời rạc. Trạng thái và hành động khả dụng vẫn liên kết bằng chương trình với bản ghi.
- Hành động chi tiết ở cùng record detail. Hành động có hệ quả mở surface xác nhận có tên và không phụ thuộc swipe hay hover.
- Surface tạm thời chuyển focus vào trong, giữ focus khi modal và trả về bản ghi hoặc điều khiển đã gọi.

### Reflow

- Thứ tự ngữ nghĩa là header, controls, phản hồi kết quả, bộ sưu tập, chi tiết được chọn khi gọi, rồi confirmation.
- Văn bản, nhãn bản địa hóa và zoom reflow mà không che hành động hoặc gây cuộn ngang cấp trang.
- Trang sở hữu cuộn dọc; một surface chi tiết/xác nhận tạm thời có thể sở hữu cuộn khi mở. Cấm cuộn lồng trong hàng.
- Điều khiển sticky hoặc action bar là tùy chọn và phải nhường khi chiều cao không đủ hoặc focus sẽ bị che.

### Tương đương tương tác

- Tìm kiếm, bộ lọc, sắp xếp, phân trang, lựa chọn, chi tiết, hành động được phép, xác nhận, retry và phục hồi xung đột tồn tại ở mọi kích thước.
- Thay đổi cách trình bày không reset trạng thái truy vấn, lựa chọn, bản nháp hay hành động đang pending.
- Trạng thái loading, empty, error, unavailable, permission, stale/conflict và success gọi tên phạm vi và giữ đường phục hồi an toàn.
- Người dùng bàn phím và công nghệ hỗ trợ tiếp cận cùng bản ghi và hành động; trạng thái không bao giờ chỉ dựa vào màu.

## Nghĩa vụ trạng thái

| Họ trạng thái | Trạng thái và hành vi bắt buộc |
|---|---|
| Bộ sưu tập | `loading`, `ready`, `empty`, `filtered-empty`, `error`, `refreshing`; refreshing giữ kết quả cũ có thể đọc khi an toàn. |
| Truy vấn | resting, editing, applying, active và reset; bộ lọc hoạt động có thể nhận biết và được serialize nhất quán. |
| Lựa chọn | none, selected, selection-loading, selected-missing và selected-stale; bản ghi mất phải giải thích cách phục hồi. |
| Chi tiết | loading, ready, partial-error, unavailable và permission-refused với retry hoặc return đúng phạm vi. |
| Hành động | eligible, disabled-with-reason, confirming, submitting, succeeded, failed và conflict; ngăn cam kết trùng. |
| Phân trang | first, middle, last, phục hồi out-of-range và chính sách page-size khi product truth cho phép. |
| Focus | collection entry, selection-to-detail, detail-to-results, confirmation entry/return, action error và success destination. |
| Responsive | persistent detail, temporary detail và two-step detail giữ nguyên ý nghĩa bản ghi/hành động. |

## Ranh giới

### Chấp nhận

- Worklist moderation, membership, submission, account, content, audit hoặc backup có xử lý bản ghi lặp lại.
- Bộ sưu tập quản trị dày đặc mà bản ghi được chọn sở hữu dữ kiện hoặc chuyển trạng thái phong phú hơn.
- Bộ sưu tập audit vận hành chỉ đọc khi lọc và kiểm tra bản ghi vẫn là tác vụ chủ đạo.

### Từ chối

- Dashboard KPI/trạng thái không đồng nhất, khám phá catalogue hoặc gallery, một form kết thúc ngắn, một detail tường thuật, assessment hữu hạn, điều hướng cây hoặc chỉnh sửa hàng loạt kiểu spreadsheet là tác vụ chủ đạo.
- Bộ sưu tập chỉ nhằm chọn sản phẩm/card để so sánh thay vì vận hành bản ghi.

### Phán quyết ranh giới

Trả `accept` chỉ khi quy tắc lựa chọn pass. Trả `reject` cho `AR-OCW-90` đến `AR-OCW-92`. Trả `needs-evidence` khi tính tương đồng bản ghi, độ sâu lựa chọn, hệ quả hành động hoặc phục hồi responsive làm thay đổi đáng kể topology.

## Bàn giao

1. Business cung cấp loại bản ghi, vai trò, bộ lọc, chuyển trạng thái, hệ quả hành động và retention.
2. Archetype này cố định tính liên tục của bộ sưu tập, quan hệ master-detail tùy chọn và cách thay thế responsive.
3. Grammar gán semantic owner sản phẩm cho controls, rows, detail, feedback và confirmation mà không thay topology.
4. Principles phân giải density, measure, gap, ưu tiên cột, hình học overlay và motion chính xác.
5. Direction cung cấp character thị giác trong các vùng này mà không biến worklist thành catalogue hoặc dashboard chung chung.

## Đầu ra

Trả các trường archetype chuẩn từ shelf router với `archetypeId: operational-collection-workbench`, các mã `AR-OCW-*` khớp, hợp đồng responsive chính xác, nghĩa vụ trạng thái, handoff, confidence và evidence đã route. Đầu ra không gọi tên product component, source path, class, token hay breakpoint cố định.
