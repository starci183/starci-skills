# Nâng cấp cấu trúc Business / SRS

## Mục tiêu

Tách rõ Functional Requirements, Non-functional Requirements và Customer Journeys để người đọc dễ tìm, đọc và rà soát từng phần. Mỗi chức năng phải có đặc tả hành vi đầy đủ như SRS, bao gồm luồng chính, luồng thay thế và luồng ngoại lệ; bảng liệt kê tên chức năng chỉ đóng vai trò mục lục.

Yêu cầu là tách thành folder thật trên filesystem. Mỗi chức năng, NFR hoặc customer journey có một folder riêng và một file `index.yaml` chứa đầy đủ nội dung của mục đó. Khi thực hiện nâng cấp, schema/validator phải hỗ trợ cấu trúc này.

## Cấu trúc folder và file

Một dự án chỉ có một `.starciwork` tại gốc source đã chọn. Bên trong là `features/<feature>/`; từng feature mới sở hữu `business/`, `architecture/`, `ui/`, `implementation/` và `uat/` khi có nội dung. Tên dự án nằm trong metadata, không thêm một folder tên dự án. Ví dụ chatbot dùng `.starciwork/features/chatbot/business/` và `.starciwork/features/chatbot/architecture/`. Quy tắc/dữ liệu/journey dùng chung có một feature chịu trách nhiệm sở hữu, các feature khác tham chiếu bằng ID; không nhân bản cùng đặc tả.

```text
.starciwork/features/<feature>/business/
├── index.yaml
├── overview/
│   └── index.yaml
└── srs/
    ├── index.yaml
    ├── functional-requirements/
    │   ├── index.yaml
    │   ├── <A>/
    │   │   └── index.yaml
    │   └── <B>/
    │       └── index.yaml
    ├── non-functional-requirements/
    │   ├── index.yaml
    │   └── <NFR>/
    │       └── index.yaml
    ├── business-rules/
    │   ├── index.yaml
    │   └── <rule>/
    │       └── index.yaml
    ├── data/
    │   ├── index.yaml
    │   └── <entity>/
    │       └── index.yaml
    └── customer-journeys/
        ├── index.yaml
        └── <journey>/
            └── index.yaml
```

Các tên trong dấu `<...>` là placeholder; khi viết thật dùng tên mô tả nội dung, ví dụ `functional-requirements/human-handoff/index.yaml` hoặc `customer-journeys/customer-gets-human-help/index.yaml`.

- `index.yaml` của folder cha sở hữu metadata và phạm vi tổng hợp; nội dung chi tiết nằm trong `index.yaml` của từng folder con.
- `functional-requirements/<A>/index.yaml` chứa toàn bộ đặc tả chức năng A: actors, trigger, điều kiện, main flow, alternative flows, exception flows, postconditions, refs và acceptance criteria.
- Main flow, alternatives, exceptions và acceptance criteria là các phần bên trong cùng file của chức năng; không tách chúng thành các file hoặc folder riêng.
- `non-functional-requirements/<NFR>/index.yaml` chứa đầy đủ nội dung, phạm vi áp dụng và tiêu chí kiểm chứng của NFR đó.
- `customer-journeys/<journey>/index.yaml` chứa đầy đủ hành trình và tham chiếu đến các chức năng liên quan.
- Thêm chức năng/NFR/journey bằng cách thêm folder có `index.yaml`; giữ ID ổn định và một nơi sở hữu nội dung chính.

## Functional Requirements

Mỗi chức năng hoặc nhóm FR thuộc cùng một use case có folder riêng dưới `functional-requirements/`. File `index.yaml` trong folder đó phải chứa:

| Thành phần | Nội dung bắt buộc |
| --- | --- |
| ID, tên, mục tiêu | Định danh ổn định và nhu cầu mà chức năng giải quyết. |
| Nguồn yêu cầu | Nguồn gốc, phạm vi và trạng thái chấp nhận của yêu cầu. |
| Actors, trigger | Người tham gia chính/phụ và sự kiện khởi đầu. |
| Preconditions, inputs | Điều kiện trước và dữ liệu đầu vào. |
| Main flow | Các bước theo thứ tự: actor, hành động/yêu cầu, phản hồi hệ thống, điều kiện kiểm tra và tác động lên trạng thái/dữ liệu. |
| Alternative flows | Các nhánh hợp lệ khác của use case; ghi bước bắt đầu rẽ, điều kiện, các bước xử lý, điểm quay lại hoặc kết thúc và kết quả. |
| Exception flows | Các tình huống lỗi/ngăn cản hoàn thành; ghi bước xảy ra, điều kiện, phản hồi, xử lý/phục hồi, điểm quay lại hoặc kết thúc và trạng thái còn lại. |
| Postconditions | Kết quả và trạng thái sau thành công, thất bại hoặc hủy. |
| Business rules | Tham chiếu các quy tắc nghiệp vụ áp dụng. |
| NFR liên quan | Tham chiếu yêu cầu chất lượng và giới hạn áp dụng cho chức năng. |
| Acceptance criteria | Given / When / Then kiểm chứng các luồng và kết quả; liên kết đến FR, flow và nhánh tương ứng. |

Hành vi khi thao tác lặp, retry, xử lý đồng thời hoặc kết quả chưa xác định phải được mô tả ở nơi có liên quan. Khi không có alternative hoặc exception phù hợp, ghi lý do thay vì tự tạo tình huống không thuộc phạm vi.

### Ví dụ: Chuyển hội thoại cho nhân viên

Ví dụ này minh họa cấu trúc; quy tắc sản phẩm cụ thể lấy từ SRS và quyết định nghiệp vụ có thẩm quyền.

- Main flow: khách yêu cầu hỗ trợ → hệ thống chấp nhận yêu cầu và dừng bắt đầu lượt gửi tự động mới → nhân viên nhận hội thoại → đọc ngữ cảnh → trả lời khách.
- Alternative flows: nhân viên chủ động tiếp quản; hoặc chưa có nhân viên phù hợp, hội thoại chuyển sang chờ.
- Exception flows: người tiếp quản không có quyền; quyền bị thu hồi trong quá trình xử lý; gửi câu trả lời thất bại hoặc chưa rõ kết quả.
- Mỗi nhánh phải được viết thành các bước đầy đủ, có điểm rẽ, điều kiện, kết quả và acceptance criteria; các dòng trên chỉ là mục lục nhánh.

## Non-functional Requirements

NFR được tách dưới `non-functional-requirements/`, mỗi NFR có folder riêng với một file `index.yaml`. Có thể thêm cấp folder để phân nhóm khi cần. Mỗi NFR cần có:

- ID, nội dung và lý do nghiệp vụ.
- Phạm vi áp dụng: toàn sản phẩm hoặc các FR/journey cụ thể.
- Tiêu chí kiểm chứng, điều kiện đo và cách đánh giá kết quả.
- Mức mục tiêu đã được chốt; nếu chưa chốt thì ghi quyết định còn thiếu và người quyết định.
- Nguồn yêu cầu và liên kết đến acceptance criteria.

Một NFR có thể áp dụng cho nhiều chức năng. FR tham chiếu NFR dùng chung để tránh sao chép và tạo mâu thuẫn. Không tự đặt SLA, ngân sách hay ngưỡng chất lượng khi chưa có cơ sở nghiệp vụ.

## Business Rules & Data

Quy tắc nghiệp vụ dùng chung nằm tại `business-rules/<rule>/index.yaml`, có ID riêng để các FR tham chiếu. Dữ liệu nằm tại `data/<entity>/index.yaml`, mô tả ý nghĩa nghiệp vụ, thuộc tính, kiểm tra hợp lệ, chủ sở hữu, độ nhạy cảm, trạng thái và chuyển trạng thái.

Ràng buộc và giao tiếp bên ngoài phải được ghi tại phạm vi sở hữu phù hợp. Chi tiết thiết kế kỹ thuật được chuyển sang Architecture.

## Customer Journeys

Customer Journeys được tách dưới `customer-journeys/`, mỗi journey có folder riêng với một file `index.yaml` mô tả hành trình xuyên suốt từ nhu cầu đến kết quả của khách hàng. Một journey có thể đi qua nhiều FR.

Mỗi journey cần có:

- ID, tên, actor và mục tiêu của khách.
- Bối cảnh, điểm bắt đầu và điều kiện trước.
- Các chặng theo thứ tự: hành động của khách/người tham gia, điểm tương tác, phản hồi và kết quả khách quan sát được.
- Liên kết từng chặng đến FR/use case/flow liên quan và NFR áp dụng.
- Các hướng đi đáng kể như chờ xử lý, chuyển người, hủy hoặc chưa đạt kết quả; tham chiếu nhánh chi tiết trong FR.
- Điểm kết thúc và tiêu chí xác định kết quả thực sự đạt được.

Ví dụ: khách hỏi → bot chưa giải đáp được → chuyển cho nhân viên → khách nhận hỗ trợ. Journey này liên kết các chức năng nhận/trả lời câu hỏi, chuyển người và gửi tin/theo dõi kết quả.

Chi tiết main/alternative/exception flow được sở hữu tại chức năng tương ứng. Journey tham chiếu và kết nối các chức năng để thể hiện trải nghiệm xuyên suốt, tránh lặp lại một bộ đặc tả khác. Hành trình của chủ doanh nghiệp và nhân viên phải ghi rõ actor, phân biệt với khách hàng cuối.

## Tiêu chí hoàn thành nâng cấp

- Có các folder riêng `functional-requirements/`, `non-functional-requirements/` và `customer-journeys/` theo cây đã ghi.
- Mỗi mục có folder riêng và một file `index.yaml` chứa đầy đủ nội dung; file của folder cha không gom lại nội dung chi tiết của mọi mục con.
- Mỗi chức năng có đủ cấu trúc SRS, không dừng ở tên hoặc mô tả một câu.
- Alternative/exception flows có điểm rẽ, điều kiện, bước xử lý, điểm quay lại/kết thúc và kết quả kiểm chứng được.
- NFR có phạm vi và tiêu chí đánh giá rõ ràng; mục tiêu chưa quyết định được ghi nhận đúng trạng thái.
- Journey thể hiện nhu cầu đến kết quả của đúng actor và liên kết các chức năng liên quan.
- ID và liên kết FR, BR, NFR, flows, acceptance criteria và journeys nhất quán; một nội dung có một nơi sở hữu chính.
- Khi chuyển cấu trúc hiện có, giữ nguồn gốc yêu cầu, các quyết định, ID và bằng chứng lịch sử; việc tổ chức lại không tự biến bản draft thành yêu cầu đã được chấp nhận.
