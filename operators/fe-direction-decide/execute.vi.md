# Thực thi `fe.direction.decide`

## Một việc duy nhất

Biến input đã validate cùng exact context thành một typed frontend direction receipt. Đây là một
operator invocation tuyến tính. Nó không gọi operator khác, không route workflow, không pause bên
trong và không implement.

## Chuỗi thực thi

1. **Validate input và resume.** Áp dụng input schema cùng semantic validation. Từ chối authority stale,
   source drift, owner overlap, tổ hợp change level sai, compare chưa được cấp quyền và progress không
   đổi.
2. **Bind authority.** Bind request, business receipt, backend/architecture receipt tùy trường hợp,
   Grammar đã publish, project, target, change level và owner ceiling. Evidence có thể phản bác nhưng
   không được thay authority.
3. **Quan sát context hiện có.** Quan sát artifact trực tiếp mà không nhận producer rationale làm đáp
   án. Với target đã có, ghi regions, actions, states, responsive behavior và owner boundary hiện tại.
   Với target mới, verify target chưa tồn tại và chỉ quan sát host/product family được cấp authority.
4. **Compile một UI contract.** Khóa purpose, actor task, representative content, region responsibility,
   thứ tự thông tin/hành động, state matrix đóng, exit, responsive rule, accessibility obligation,
   Grammar binding, quyết định giữ/thay đổi và non-goal.
5. **Giải quyết nhu cầu reference.** Khi domain hoặc interaction model còn lạ, research bên ngoài có
   giới hạn từ exact reference. Ghi relationship hữu ích cùng limitation; không copy page, brand,
   palette hay component anatomy. Dừng với owning gap nếu evidence không chốt được business hoặc
   interaction decision.
6. **Tạo candidate.** `refine` giữ cấu trúc đã duyệt. Approved-direction reuse giữ nguyên direction
   triple được cung cấp. Trường hợp khác tạo một dominant reversible candidate, hoặc đúng ba/bốn
   candidate khác biệt material trong compare mode đã được cấp quyền.
7. **Áp dụng Grammar filter.** Reject candidate tự bịa shared interface, vượt owner ceiling, mô phỏng
   Grammar chưa publish trong source cục bộ hoặc trái published composition. `GRAMMAR_REQUIRED` kết
   thúc invocation.
8. **Render decision evidence.** Candidate `new` hoặc `reconstruct` được generate phải là page hay
   substantial surface thực tế, có representative content, composition wide/constrained và ít nhất
   một trạng thái pending, failure, recovery hoặc boundary quan trọng. Compare mode render mọi
   alternative trong cùng inspectable artifact và làm rõ material difference.
9. **Falsify.** Tấn công business/backend conformance, hierarchy, content density, action feedback,
   recovery, responsive reflow, content stress, keyboard/focus, accessibility, family coherence,
   reversibility và owner leakage. Ghi disposition add/change/remove cùng contradiction.
10. **Chốt hoặc block.** Trong dominant mode, chọn candidate hợp lệ trội hơn material. Trong compare
    mode, hoặc khi còn nhiều candidate hợp lệ mà không có đáp án trội hơn, phát
    `DIRECTION_CHOICE_REQUIRED` với đúng ba/bốn alternative. Không chọn theo gu.
11. **Phát output rồi dừng.** Output phải theo output schema và bind mọi fingerprint source, authority,
    context, scope, artifact, input và progress. Không mutate source hay claim downstream proof.

## Thực thi khi resume

Resume bắt đầu lại tại validation, chỉ reuse observation/artifact còn nguyên fingerprint, rồi consume
exact delta. Alternative selection phải là candidate trong blocked receipt và có exact product
authority. Operator không brainstorm lại trước khi phát selected decision. Resume stale hoặc không có
delta trả `NO_PROGRESS` hay failure stale-binding tương ứng.

## Các đòn tấn công bắt buộc

Operator không được chốt khi còn bất kỳ mục áp dụng nào chưa giải quyết:

- business state hay recovery path chưa có UI representation;
- action thiếu pending, success/failure feedback hoặc recovery;
- proposal thay API, auth, persistence hay data assumption;
- mutable region thuộc excluded owner;
- reusable pattern chưa có trong Grammar đã publish;
- wide/constrained transformation thiếu hoặc mâu thuẫn;
- keyboard, focus, label, contrast intent hay reading order chưa chốt;
- representative content, multi-item behavior, long content, empty/error state hay boundary behavior
  làm direction hỏng;
- tồn tại reversible candidate mạnh hơn material nhưng chưa được đánh giá.

