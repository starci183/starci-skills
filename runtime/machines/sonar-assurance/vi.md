# Máy đảm bảo Sonar

## LOADS

None.

## Purpose

Máy này chứng minh một ranh giới đảm bảo SonarQube dùng chung cho mọi vai trò backend, frontend và
console đã định tuyến của Source. Máy xác định và kiểm thử được bằng phản hồi nhà cung cấp giả lập.

## Contract

Phải có đủ cả ba vai trò (`be`/backend, `fe`/frontend và console), mọi row phải có role hợp lệ. Bằng chứng phải nêu đúng analysis SHA và trạng thái quality gate là OK. Bugs,
vulnerabilities và code smells bằng không cho tổng thể và phần mới khi nhà cung cấp hỗ trợ; các rating
reliability, security và maintainability là A; hotspots đã xem là 100%; duplicated lines density không
quá 3 cho tổng thể và phần mới; native coverage tối thiểu 80% tổng thể và 90% phần mới.

Trên SonarQube hiện tại, `starci-strict` dùng các condition new-code được server hỗ trợ: new violation
bằng không, ba rating new-code là A, new hotspot review 100%, new duplication không quá 3% và new
coverage tối thiểu 90%. Proof có xác thực vẫn chặn riêng mọi metric overall/new bắt buộc; giới hạn
condition của server không xóa coverage, finding, rating, hotspot hay duplication overall.

Mỗi project đã route có một project-analysis token riêng. Admin/user token không scan source và route
này không tái dùng analysis identity của route khác.

Scanner token khác authority admin/operator. Analysis token dùng `SONAR_TOKEN` hoặc stdin,
execute dùng `SONAR_ADMIN_TOKEN`; thiếu status, SHA hoặc metric bắt buộc là fail. Token
không bao giờ từ argument hay log. Plan và dry-run không gọi nhà cung cấp. Chỉ execute tường minh mới
được reconcile qua API.
Proof execute đọc status, mọi measure bắt buộc và revision analysis mới nhất từ các endpoint Web API
riêng; thiếu bằng chứng là fail.

## Evidence

Máy trả về lỗi có cấu trúc; metric bắt buộc không được hỗ trợ hoặc bị thiếu là incomplete, không phải pass.
Test inject fetch,
vì vậy không test nào gọi SonarQube hoặc thay đổi dịch vụ bên ngoài.
