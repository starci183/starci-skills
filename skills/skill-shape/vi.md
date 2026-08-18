---
title: Skill shape · Vietnamese
---

# Cấu trúc chung của skill

## LOADS

None.


## Bản ghi

Mỗi lượt chạy nhận một capability và phải trả về **một phase công việc cùng sáu bảng kết quả**.
Mô-đun này quy định **mọi skill phải in gì, hỏi gì và ghi lại gì**; nội dung công việc của từng skill
không nằm ở đây. Nếu mỗi skill tự đặt một kiểu báo cáo, các bản ghi sẽ không còn đối chiếu được với
nhau. Khi chính định dạng của bằng chứng cũng không thống nhất, cả cây không thể dùng làm bằng chứng.

## Luật

Trước khi hành động, skill phải khai **mình đang ở đâu**; khi kết thúc, nó phải nói rõ **đã ghi gì**.
`CONTEXT` đứng đầu vì một lượt chạy chưa gọi tên được Source, project và biên giới ghi thì chưa được
chạm vào bất cứ thứ gì. Sáu bảng kết quả đứng cuối vì công việc chưa thể xem là xong nếu chưa tách bạch
**điều đã quyết**, **thứ đã ghi** và **việc còn nợ**.

Phát hiện không phải là được phép. Thấy một thứ cần sửa không bao giờ là thẩm quyền để sửa nó.

## Chín năng lực

Bảy capability trực tiếp làm việc. Hai capability chỉ **quan sát**: `starci-stale-list` đo trạng thái
máy, còn `starci-diagnose` lần theo một skill khác. Chỉ hai capability này không có stage apply. Một
bản báo cáo đã tự sửa thứ nó đang đo thì không còn đáng tin: route vừa bị âm thầm làm mới sẽ trông như
thể ngay từ đầu nó đã đúng.

| Skill | Hành trình | Sở hữu |
|---|---|---|
| `starci-init` | plan → review → apply, nội bộ | làm một Source sẵn sàng: bootstrap, route workspace, state worktree — ba root, mỗi root một lần duyệt |
| `starci-stale-list` | chỉ plan | project nào có route không còn mô tả đúng máy này, và ai dọn từng cái |
| `starci-diagnose` | chỉ plan | một lượt lần theo chỉ-đọc: skill sẽ dừng ở đâu, và cái dừng đó có đúng hay không |
| `starci-repair` | plan → review → apply | một source đỏ trở lại xanh: pass format, autofix và defect giữ tách nhau, và pass defect được chia cho nhiều agent |
| `starci-fe-design-layout` | mở hoặc tiếp session, chọn direction, rồi các lượt layout | 3–4 lựa chọn direction không có hash riêng, rồi 3–4 phương án layout mỗi bề mặt, buộc theo hash |
| `starci-fe-design-block` | các lượt block | 3–4 giải phẫu mỗi region dưới direction nằm trong layout của nó, buộc theo hash |
| `starci-fe-design-execute` | thi hành | source frontend, chỉ sau khi mọi hash đạt tới được đã được chấp nhận |
| `starci-be-plan` | plan | brief backend: file nào, biên giới nào, ca kiểm thử nào |
| `starci-be-approve` | duyệt, rồi apply | sự chấp thuận, rồi source backend |

**Không có orchestrator.** Hai việc mà orchestrator từng giữ vì thế được giao rõ: **Layout mở
session**, và **Execute từ chối chạy** khi còn bất cứ hash layout hay block đạt tới được nào chưa được
chấp nhận. Skill nào không tìm được tiền đề của mình thì **dừng**; nó không bao giờ chạy tiếp dựa trên
giả định rằng ai đó đã duyệt cái gì.

## CONTEXT — in trước mọi thứ khác

Dưới đúng tiêu đề `### CONTEXT`. Một nhãn trơn là không hợp lệ: bộ kiểm nhận diện mục này bằng tiêu đề
của nó.

| Trường | Giá trị |
|---|---|
| Workdir | thư mục làm việc tuyệt đối |
| Source | repository tuyệt đối chứa `AGENTS.md` và cây quy tắc |
| Project | project do người khai, không bao giờ suy từ tên thư mục |
| Role targets | các repository giải ra từ `.workspace/<project>/<role>/config.json` |
| Trust | cây quy tắc tuyệt đối |
| Purpose | một câu nói phase này phải chốt được điều gì |
| Record | bằng chứng của phase này đọng ở đâu — một session dưới `<Source>/.worktrees/<project>/sessions/` với lượt design, chính các commit của lượt chạy với repair, `None` với lượt không ghi gì |
| Phase | `layout`, `block`, `execute`, `plan`, `approve` hoặc `apply` |
| Touching | những đường dẫn chính xác phase này được ghi |
| Read | contract, source, schema hay runtime đã đọc, kèm trạng thái của nó |
| Missing | bằng chứng bắt buộc còn thiếu và nó chặn gì — hoặc `None` |

`Project` và các route vai trò của nó giải qua mô-đun workspace, và một route phải được **xác minh
trước khi đọc**. Phase nào không giải được Workdir, Source, Project, các repository vai trò hay Trust
thì đã bị chặn trước cả khi bắt đầu việc riêng của mục tiêu.

## Các trạng thái tiến trình

| Trạng thái | Nghĩa | Việc kế tiếp |
|---|---|---|
| working | còn bằng chứng hoặc còn việc an toàn để làm | tiếp tục, không hỏi |
| needs approval | một quyết định, lời hứa, giá hay biên giới ghi có thể sai | gộp vào `NEED APPROVALS` |
| phase complete | điều kiện kết thúc đã đạt | ghi vào đúng chỗ phase đã khai, gọi phase sau |

Một đường tool thất bại không làm lượt chạy bị chặn: thử đường an toàn thay thế trước. Mọi thứ cần
duyệt **đã biết tại thời điểm đó** được gộp thành **một** lượt hỏi, không hỏi lắt nhắt. Sau phản hồi,
vẫn phase đó tiếp tục, ghi thêm bản sửa, rồi trình lại brief đã sửa.

**Gộp là gộp lúc HỎI, không phải lúc TRẢ LỜI.** Một lượt hỏi giúp người đọc khỏi bị ngắt năm lần; nó không
nhập năm quyết định thành một chữ "ừ". Một câu trả lời bao trùm — "làm hết đi" — duyệt đúng những dòng đã
được viết ra, và **không duyệt bất cứ thứ gì chưa từng được viết thành một dòng**: không duyệt một biên giới
mà chính skill tự đề ra trong lúc người đọc đang trả lời chuyện khác, và không duyệt một thao tác ghi nằm
ngoài biên giới mà các dòng đó gọi tên. Một lượt chạy đọc một chữ thành thẩm quyền cho việc không ai liệt
kê là đã thôi hỏi và bắt đầu tự cho.

## Các phase

**Các lượt design** chính là mặt để rà soát. Lựa chọn direction hỗ trợ một lượt layout và không có
approval hash riêng; candidate chính xác, lựa chọn hoặc phản hồi của nó nằm trong `directionReview` của
lượt layout, còn object được chọn nằm trong candidate layout. Mỗi lượt được ghi giữ đúng prompt, các phương án, phản hồi và phán
quyết của người chủ, và sự chấp nhận **buộc theo hash**. Phản hồi mở một lượt mới; nó không bao giờ sửa
một lượt đã được chấp nhận.

**Plan** đọc canon, hợp đồng và source sống, rồi ra một brief: mục tiêu, bằng chứng, biên giới, quyết
định, phương án thay thế, bằng chứng nghiệm thu. Nó không viết code sản phẩm.

**Approve** lặp cho tới khi người dùng chấp thuận **tường minh**, và giữ một điểm dừng cứng **trước**
lần ghi sản phẩm đầu tiên. Mọi lần từ chối được ghi kèm cái thay thế và lý do của người dùng.

**Apply** xác nhận biên giới ghi, ghi một baseline commit lấy **trước** khi sửa, rồi thi hành đúng bản
đã duyệt và chứng minh tại biên sản phẩm bằng đúng bằng chứng mà lần duyệt đã nêu tên. Một đường dẫn
ngoài `Touching` được trả về cho chủ của nó, không được lặng lẽ xuất hiện trong diff.

## Đầu ra — sáu bảng, đúng thứ tự này

Đúng tiêu đề `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED`,
`### OWED`. Bảng rỗng vẫn phải có một dòng ghi `None`.

| Bảng | Chứa | Không bao giờ chứa |
|---|---|---|
| OUTPUTS | cái đã quyết hoặc đã chứng minh, ở mức khái niệm | đường dẫn file |
| CHANGES | mọi đường dẫn đã ghi và chuyện gì xảy ra với nó | khái niệm |
| NEED APPROVALS | một quyết định có thể sai, mặc định có bằng chứng đứng trước | phán đoán thi hành thông thường |
| WARNINGS | một giả định, xung đột, tham chiếu cũ hay rủi ro không đảo được | thứ đang chặn tiến độ — cái đó là approval |
| REJECTED | đề xuất **thật** đã bị từ chối, cái thay thế, lý do của người dùng | một lần từ chối dựng lại từ ký ức |
| OWED | việc hoặc bằng chứng đã **không** xảy ra | rủi ro, vì rủi ro là warning |

`OWED`, `WARNINGS` và `NEED APPROVALS` là **ba lời khai khác nhau** — việc còn dở, rủi ro, và một cái
chặn cần người dùng. Gộp chúng lại chính là cách một lượt chạy chưa xong đọc ra như đã xong.

## Bản ghi

**Không có tệp bản ghi riêng.** Bằng chứng của một phase chính là sáu bảng nó in ra, và chỗ nào cần sống
lâu hơn phiên làm việc thì nó đọng vào đúng cái kho vốn đã sở hữu loại việc đó: lượt design đọng trong
session của nó dưới `<Source>/.worktrees/<project>/sessions/`, gắn với hash; lượt repair đọng trong chính
các commit của nó, mà baseline và cách tách từng pass đã là dấu vết. Một chỗ thứ ba, viết tay và không ai
đọc, là thêm một cái nhà nữa cho một sự thật vốn đã có nhà — và là loại nhà cũ đi mà không gì phát hiện
được, chính vì không ai đọc nó.

Một phase được duyệt gọi tên `Approved revision: <identity>` của nó, và Apply trích đúng identity đó cùng
baseline commit. Chính cặp đó chứng minh cái gì đã đổi sau khi Apply bắt đầu, và nó sống sót ở bất cứ nơi
nào phase ghi lại — nó là một **câu**, không phải một tệp.

Phần tường thuật, bằng chứng và giá trị trong bảng viết bằng tiếng Việt. Tiêu đề, nhãn schema, đường
dẫn, câu lệnh và tên định danh trong code giữ nguyên, vì dịch chúng là làm hỏng bộ kiểm.

Bằng chứng cũ không bị viết lại cho khớp định dạng mới. Bản ghi lịch sử là bằng chứng; muốn sửa thì **ghi
thêm**.

## Quy tắc

1. `CONTEXT` in trước khi hành động, và nó gọi tên `Touching` trước mọi lần ghi.
2. Phát hiện không phải là được phép.
3. Việc cần duyệt thì gộp lúc hỏi, không bao giờ nhập lại lúc trả lời.
4. Một session, một bản ghi. Không skill nào mở bản ghi song song cho cùng một việc.
5. Sự chấp nhận buộc theo hash; lượt đã chấp nhận không bao giờ bị sửa tại chỗ.
6. Execute chỉ chạy khi mọi hash đạt tới được đã được chấp nhận.
7. Baseline commit lấy **trước** lần ghi sản phẩm đầu tiên, không lấy từ một cây đã sửa nửa vời.
8. Đường dẫn ngoài `Touching` được trả về cho chủ của nó.
9. Mọi phase kết thúc bằng đủ sáu bảng, kể cả bảng chỉ có `None`.

## Ngoại lệ

- **Init sở hữu ba root.** Bootstrap của Source, `.workspace/<project>/` và `.worktrees/<project>/` hỏng
  theo ba chiều khác nhau — bootstrap chết thì agent không được định tuyến, route sai thì lượt chạy
  **đọc** sai repository, worktree sai thì nó **ghi** vào chỗ bị cấm ghi. Một lần duyệt **không bao giờ**
  phủ hơn một root, và một lượt chạy được phép chỉ chạm đúng một root.
- **Năng lực chỉ đọc.** Apply của nó chốt một phán quyết và chuyển việc sửa về cho chủ. Nó không bao
  giờ biến việc đo thành một lần sửa source chưa khai báo.
- **Session được tiếp tục.** Layout được phép **tiếp** thay vì **mở**. Session id và mọi hash đã chấp
  nhận sống sót qua lần tiếp đó, không đổi.

## Ví dụ đã giải

**Lượt chạy.** "Thiết kế trang kết quả bài luyện coding."

```text
### CONTEXT
Phase: layout
Project: example-app
Role targets: fe -> <disk>\example-app-fe (đã xác minh: contract có mặt)
Touching: .worktrees/example-app/sessions/<session>/
Purpose: chốt 3-4 phương án layout cho một bề mặt mới
Read: contract key + why + host (74KB trên 192KB), danh sách branch, bảng route
Missing: None
```

Layout **mở** session vì không có orchestrator, chạy một lượt, rồi kết thúc bằng sáu bảng — `NEED
APPROVALS` mang đúng một quyết định sản phẩm mà yêu cầu không nói ra, `OWED` mang các lượt block chưa
xảy ra.

Nếu gọi `starci-fe-design-execute` ở đúng thời điểm này thì nó **dừng**, không chạy: hash layout đang ở
trạng thái đề xuất, chưa được chấp nhận, và không có gì khác trong cây làm cho nó thành được chấp nhận.

## Phạm vi

Mô-đun này quyết định **hình dạng mà mọi skill báo cáo theo**. Nó không quyết định một layout được
chứa gì, class nào là đúng, hay repository nào được đọc — ba chuyện đó thuộc mô-đun brainstorm,
compiler và context.
