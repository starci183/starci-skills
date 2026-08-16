---
id: fe-layouts-laws-l2-assistant-and-content-are-different-axes-changelog
title: changelog.md
slug: /gates/layouts/laws/l2-assistant-and-content-are-different-axes/changelog
sidebar_label: changelog.md
sidebar_position: 4
description: Lịch sử phiên bản của luật L2.
---

# changelog.md

> Phiên bản hiện tại: `1.00` · Mô-đun: `l2-assistant-and-content-are-different-axes`

## Quy tắc phiên bản

Một thay đổi luật được chấp nhận thì tăng cả mô-đun thêm `0.01` và cập nhật **năm** tài liệu. Thêm
một mã tình huống là bump nhỏ. Đổi câu `Law` là bump lớn cho cả kệ, vì
[`invisible-owner`](../../archetypes/invisible-owner/INDEX.md) chạm tới đúng cái chủ này từ phía
archetype, và bảng định tuyến ở [`../../INDEX.md`](../../INDEX.md) phát biểu luật này bằng một dòng
của riêng nó. Thêm một trường cho union mặt nội dung hoặc cho việc một trang mượn trợ lý là thay đổi
GATE và phải làm ở [`gate.schema.json`](../../gate.schema.json) trước.

## Nghiệm thu — 2026-08-17

Đợt kiểm sau khi lập mô-đun. Không đổi câu `Law`, không thêm bớt mã tình huống, nên **không bump
phiên bản**.

- **Trả khoản nợ mà chính [`audit.md`](./audit.md) ghi ra.** Bảng định tuyến của kệ nay trỏ hàng `L2`
  vào đây với Kind là `fixed`, và đoạn văn dưới bảng không còn viết rằng ba luật `L2`, `L7`, `L11`
  chưa có mô-đun. Đó là thay đổi kệ, nên dòng phiên bản của kệ tăng lên `1.01`; mục "Rủi ro còn mở"
  trong `audit.md` được đánh dấu đã xong thay vì để nó khẳng định một điều nay đã sai.
- **Kiểm lại toàn bộ neo.** Cả ba neo TỪ CHỐI khớp nguyên văn với `.workflows`, và mọi neo CODE mở
  được trong `D:\Repositories\starci-academy-fe`. Không neo nào trỏ về repo `starci-academy` cũ.

## 1.00 — 2026-08-17

Mô-đun được lập lần đầu trên kệ `gates/layouts/`, lấp một trong ba ô mà bảng định tuyến của kệ đang khai
là `owed`. Nguồn: hai dòng từ chối trên một hồ sơ, cộng một lần đọc hết trục trợ lý trong repo sống
gồm chủ ở gốc locale, context, predicate route ẩn, ba consumer và trang duy nhất đang mượn nó.

- **Đặt sáu mã tình huống.** `L2-1` đến `L2-6`, trong đó `L2-5` phát ra một lời từ chối và `L2-6` nói
  về một nhánh **không vẽ gì cả**, mà cả hai vẫn là tình huống đã được phân loại chứ không phải chỗ
  trống.
- **Phát biểu luật bằng hai trục thay vì bằng một lệnh cấm.** Cách viết ngắn gọn "không đặt AI vào
  hàng tab" chỉ chặn được chiều của dòng `:710`. Chiều còn lại, một mặt của trang mọc ra trợ lý
  riêng, bị bác ở dòng `:417` và cần một câu bao được cả hai.
  Neo: `.workflows\designs\starci-academy\global-ai-chatbot.md:710` và cùng file `:417`.
- **Viết `L2-2` thành một sự thay thế chứ không thành một lần xoá.** Lời phán đầy đủ là bỏ mặt AI
  **và** thêm mặt `source`, với trợ lý ở lại dưới dạng nút nổi cùng drawer. Một bản chỉ chép vế đầu
  sẽ để lại một hàng hai mặt và tưởng là đã làm xong.
  Neo: `D:\Repositories\starci-academy-fe\src\components\blocks\learn\ContentTabRow\component.tsx:26`
  và `:62-73`.
- **Tách `L2-3` khỏi `L2-5`, và định nghĩa ranh giới giữa chúng bằng danh sách tên hàm.** Mượn là
  `open`, `setCodeContext`, `clearCodeContext` và `startTangent`. Giữ là đưa `isOpen` vào state của
  trang hoặc sinh thêm một session. Đây là ranh giới duy nhất trong mô-đun này đọc được bằng mắt
  trong một file.
  Neo: `…\src\components\pages\CourseLearnContentPage\index.tsx:95,101,143,373,385`.
- **Đặt `L2-6` thành mã riêng thay vì để nó nằm gọn trong `L1-2`.** Hai mã dùng chung một neo mã ở
  `GlobalAiChatLayout\index.tsx:56-62` nhưng trả lời hai câu hỏi: `L1-2` nói mount không đổi, `L2-6`
  nói context vẫn phải chảy. Cách hỏng của chúng cũng khác nhau, một bên là hội thoại chết, một bên
  là cây React vỡ vì hook ném lỗi kiến trúc.
  Neo: `…\src\modules\ai\global-ai-chat-context.tsx:24-27` và
  `…\src\components\layouts\GlobalAiChatLayout\index.test.tsx:44-49`.
- **Ghi `L2-4` như một luật về đúng một ô.** Điều hướng xoá `codeContext` và không đụng `isOpen` hay
  `tangentVersion`, nên câu "đổi trang thì reset trợ lý" là sai và câu đúng hẹp hơn nhiều.
  Neo: `…\src\components\layouts\GlobalAiChatLayout\index.tsx:32-34` và `:36-38`.
- **Đẩy chuyện grounding ra khỏi hai lần bác.** Dòng `:120` là một neo từ chối thật, nhưng nó nói
  luồng global cố ý không neo vào trang nào, tức là chuyện backend đọc gì. Nó vào mục ngoại lệ và
  không được đếm là lần bác thứ ba.
- **Đẩy chiều rộng và cách vẽ hàng mặt nội dung ra khỏi mô-đun.** `ContentTabRow` là call site của
  `L4` và của `L11`. `L2` chỉ phán đúng một điều về hàng ấy, rằng trợ lý không có tên trong đó.
- **Nhận tên thư mục làm định danh.** Bằng chứng thu được đề xuất tên
  `l2-assistant-and-content-face-are-different-axes`; thư mục được lập là
  `l2-assistant-and-content-are-different-axes`. `id` và `slug` của cả năm record theo tên thư mục,
  vì đó là thứ đường dẫn tương đối và bảng định tuyến của kệ sẽ trỏ tới.
- **Ghi ba khoản nợ đo được vào [`audit.md`](./audit.md)** thay vì để luật nói như thể đã xong: kệ
  vẫn khai `L2` là `owed` ở [`../../INDEX.md`](../../INDEX.md) dòng `97` và đoạn `114-116`; gate
  không có trường nào cho `L2-2` và `L2-3`; và toàn bộ hình dạng của việc mượn trợ lý mới chỉ đo được
  ở đúng một trang.
