# StarCi Core — playbook

Hình dạng nghiệp vụ nào đòi chuỗi idiom nào, và một tham chiếu được phép góp gì vào câu trả lời ấy.
Bản thân các idiom nằm ở [Idiom](idioms.vi.md); còn package công bố những gì thì nằm ở
[DNA](DNA.vi.md). Một hình dạng không có trong đây không phải là idiom của nhà. Nó vẫn có thể được
ghép cho định hướng sản phẩm đã duyệt khi ngữ nghĩa Common, giải phẫu family và dữ kiện sản phẩm hiện
có biểu đạt được nó; chỉ việc nâng nó thành idiom dùng lại của family mới thuộc chủ family.

## Các hình dạng

| Hình dạng nghiệp vụ | Tham chiếu được góp gì | Chuỗi idiom |
| --- | --- | --- |
| Trang quyết định mua — một gói, một giá, một cam kết (thuê bao) | Giữ: thứ tự các vùng (cái gì được đọc trước giá), quyết định duy nhất nào chiếm ưu thế, và cái gì gấp lại thay vì tranh chỗ với nó. Không bao giờ theo sang: bố cục trang, thương hiệu, bảng màu, thang chữ, giải phẫu component, hay bất kỳ control nào tham chiếu vẽ mà Grammar này không công bố. | Cột giải thích ở `primary` của `PrimaryRailLayout`, thẻ quyết định ở `rail`: **Joined bands in one flush card** cho phần giải thích → **A neutral band opens the card with its summary** cho dòng mở đầu → **Generated art is a band, not a card** cho tranh hành trình → **Title and one supporting line** cho từng quyền lợi → **One highlighted card** cho chính thẻ quyết định → **The card's one action closes the bottom band** cho hành động mua → **Pending is the same tree, resting** suốt lần đọc gói. Nội dung phụ thì gấp lại; gấp bằng disclosure hay không là một `DIRECTION_CHOICE_REQUIRED` (mới thấy một lần). |
| Dashboard người học — nhiều mục ngang hàng, một bước kế tiếp có chủ đích | Giữ: có những mục nào và đọc theo thứ tự nào, và mục nào là việc kế tiếp của người đọc. Không bao giờ theo sang: hình học lưới, viền thẻ, mật độ, hay một mục đòi renderer mà family này không công bố. | Trong từng mục: **Joined bands in one flush card** → **A neutral band opens the card with its summary** khi mục nêu một số đo → **Title and one supporting line** trong mọi hàng → **The card's one action closes the bottom band** khi mục dẫn đi đâu đó → **Pending is the same tree, resting** cho mọi lần đọc, với `EmptyNotice` cho rỗng và hỏng. Trên toàn trang: **One highlighted card** đúng một lần, đặt ở mục học tiếp hoặc bước kế tiếp. |
| Đăng nhập — một mặt phẳng, nhiều hành trình, mỗi bước một nút gửi | Giữ: thứ tự các lối vào (lối tắt trước form hay ngược lại), những hành trình nào dùng chung một mặt phẳng, và lối sang hành trình kia nằm ở đâu. Không bao giờ theo sang: thương hiệu nhà cung cấp, tranh minh hoạ, viền ô nhập, hay một hàng đăng nhập mạng xã hội mà sản phẩm này không có nhà cung cấp. | **Title and one supporting line** làm phần đầu mặt phẳng (`Heading` cộng dòng phụ mờ) → **Single-column form stack** cho mỗi bước, mỗi bước đúng một `Button variant="primary" type="submit"` → **Pending is the same tree, resting** qua `isPending` và `isDisabled` chứ không thay cây khác → lối đi tiếp là `TextAction`, đặt cuối. Lối tắt có đứng trước form hay không thì mới thấy một lần; theo thứ tự của tham chiếu và nói rõ ra. |

## Một định hướng đọc file này thế nào

1. **Hình dạng nghiệp vụ trước.** Gọi tên hình dạng và kết quả duy nhất mà mặt phẳng ấy tồn tại để
   tạo ra. Hình dạng chọn chuỗi idiom; không gì khác chọn thay.
2. **Rồi mới tới tham chiếu, nếu yêu cầu có kèm.** Tham chiếu góp thứ tự vùng, quyết định nào chiếm
   ưu thế, và cái gì gấp lại. Nó không góp bố cục, thương hiệu, bảng màu hay giải phẫu component —
   những thứ đó đã có chủ, là family này và [knowledge/ui](../../ui/INDEX.vi.md). Một tham chiếu chỉ
   theo được bằng cách phá vỡ một idiom là bằng chứng về tham chiếu, không phải về StarCi.
3. **Rồi tới các idiom**, ghép theo đúng thứ tự dòng của hình dạng, và lấy trọn từng cái: idiom là
   một quan hệ, lấy một nửa thì thành hình dạng khác.
4. **Rồi tới [DNA](DNA.vi.md)**, để xác nhận mọi renderer và prop mà cách ghép gọi tên đều tồn tại,
   và để đọc bảng gap trong [Family và DNA](family.vi.md) trước khi hứa một năng lực. Cách ghép nào
   cần tới một gap đã ghi thì chưa phải một định hướng.

5. **Rồi giải phần ghép sản phẩm còn lại.** Dùng lại idiom đã có khi phù hợp; nếu không thì ghép ngữ
   nghĩa Common với giải phẫu family hiện có, mở rộng một owner hiện có khi bằng chứng cho thấy gap
   đã khai của nó, và chỉ thêm owner mới cho một gap có bằng chứng. Hình dạng vắng khỏi bảng và hình
   dạng mới thấy một lần chỉ giới hạn điều được gọi là gu nhà, không phải lý do dừng việc sáng tạo đã
   nằm trong phạm vi sản phẩm được duyệt.

`DIRECTION_CHOICE_REQUIRED` chỉ dành cho một lựa chọn sản phẩm trọng yếu mà các phương án chấp nhận
được dẫn tới kết quả khác nhau và yêu cầu chưa trả lời. Xung đột tham chiếu/idiom được giải bằng phân
quyền ở trên: dữ kiện sản phẩm và thứ tự vùng đã duyệt đến từ yêu cầu, ngữ nghĩa Common đến từ
`knowledge/ui`, còn giải phẫu family và phong cách dùng lại đến từ Grammar này. Điểm số hoà không gây
lần dừng này; `interface.generate` áp fallback xác định và tiếp tục.

Thầy làm rõ ngày 2026-09-05 về hình: hình có thể làm nổi bật ý chính, giải thích nội dung, tăng nhận
diện hoặc tạo điểm nhấn gợi cảm xúc phù hợp. Nhấn mạnh thị giác có chủ đích là một vai trò cụ thể;
hình không bắt buộc phải là sơ đồ chức năng mới đáng dùng. Ghi chủ thể, ý hoặc claim được highlight
và thứ tự chú ý mong muốn vào bảng `## Images` của định hướng. Chấm kích thước, tương phản và crop
trên bề mặt đã render: hình phải hỗ trợ thứ bậc ấy, không che nội dung hoặc tranh trọng tâm với hành
động chính. Khoảng trống tự nó không bao giờ là lý do thêm hình; lấp chỗ hoặc cân mật độ mà không có
vai trò nội dung hay điểm nhấn thì không đạt. Ghi không dùng hình khi hình không cải thiện bố cục.
