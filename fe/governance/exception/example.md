---
id: fe-governance-exception-example
title: example.md
slug: /fe/governance/exception/example
sidebar_label: example.md
sidebar_position: 2
description: Ví dụ chi tiết và live UI cho named local exceptions.
---

# example.md

> Version: `1.02` · Ví dụ minh họa mindset, không biến exception cụ thể thành universal pattern.

## Capstone prerequisite trong nội dung khóa học

Ordinary curriculum row có index, title, duration và completion state. Capstone `Production Architecture`
cần hiển thị prerequisite vì học viên mới đạt `2/3 tiêu chí`: Assessment 3 chưa hoàn thành. Local UI
giữ row identity, thêm explanation cùng `Xem yêu cầu`, không thêm feature này vào mọi row.

**Named:** `capstone-prerequisite-row`.  
**Scope:** capstone bị chặn bởi prerequisite chưa hoàn tất.  
**Generic stays closed:** ordinary curriculum row không nhận child/variant mới.  
**Exit:** prerequisite complete thì dùng ordinary unlocked state.

**Not when:** module chỉ chưa được mở theo chronology bình thường; dùng standard locked state, không tạo exception.

<CodeUiTabs example="exception-capstone-prerequisite" />

## Review đang moderation

Review approved hiển thị avatar Minh Anh, `5 sao`, ngày, comment thật. Một review khác bị moderation do
có email/phone trong nội dung. UI giữ row trong chronology, thay comment bằng message `Đánh giá đang
được kiểm tra để bảo vệ thông tin cá nhân`, kèm status chip và action đúng quyền.

**Named:** `review-moderation-placeholder`.  
**Scope:** đúng review đang pending moderation.  
**Generic stays closed:** approved review không có moderation wrapper.  
**Exit:** approved render comment chuẩn; removed render removed state chuẩn.

**Not when:** API chỉ đang loading; dùng skeleton/loading state của generic review.

<CodeUiTabs example="exception-review-moderation" />

## Vocabulary tại product boundary

Connected layer nhận một infrastructure field name rồi map sang product term trước khi pure course
card render. UI title, count và actions dùng một vocabulary nhất quán; không để response shape quyết
định wording. Ví dụ demo chỉ thể hiện boundary mapping, không tuyên bố một cặp từ cụ thể là luật cho
mọi product.

<CodeUiTabs example="exception-vocabulary-boundary" />

## Rejected exception: “card này cần thoáng hơn”

Request không có relationship khác, chỉ muốn tăng padding/radius riêng. Nó không vượt admission test:
không evidence, không scope có nghĩa, không exit condition. Review lại padding, hierarchy hoặc content
density theo rule chung; không tạo key/variant exception.

<CodeUiTabs example="exception-rejected-cosmetic" />

## Từ exception thứ hai đến đề xuất thay default

Nếu capstone, certification exam và mentor review đều cần prerequisite relationship độc lập, đội ngũ
thu thập ba evidence. Chưa tự động sửa generic curriculum row. Trước hết so sánh:

- có thật cùng relationship không;
- có cùng lifecycle/exit không;
- một reusable state mới có làm ordinary rows phức tạp không;
- migration ảnh hưởng bao nhiêu screen.

Chỉ sau review mới quyết định giữ ba local exceptions hay thay default ở version mới.

<CodeUiTabs example="exception-evidence-review" />

## Ma trận admission

| Request | Accept? | Lý do |
|---|---:|---|
| Capstone bị prerequisite chặn | Có | Relationship và exit rõ |
| Review pending moderation | Có | Local lifecycle khác generic row |
| Card “trông hơi chật” | Không | Cosmetic preference, thiếu evidence |
| Mobile cần stack | Thường không | Responsive state nên thuộc generic shape nếu relationship không đổi |
| API dùng vocabulary khác UI | Boundary mapping | Không mở public component vocabulary theo database |
| Copy exception sang screen tương tự | Không | Screen mới phải được đánh giá và đặt tên riêng |
