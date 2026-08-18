---
title: Backend plan · Vietnamese
---

# starci-be-plan

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@skill-shape` | `skills/skill-shape` | module | hợp đồng báo cáo chung mà mọi skill đều đọc |

## NESTED SKILLS

Không có. Plan kết thúc bằng brief; nó không tự chạy setup hay approval.

## Cách chạy

Đọc `@skill-shape` trước. Phase này chỉ tạo brief và ranh giới file đã sẵn sàng để phê duyệt; tuyệt đối
không ghi source backend.

## QUY TRÌNH

### 1 — Lập context lock

`Phase` là `plan`, `Touching` là `None`. Một bản kế hoạch đã ghi product code tức là đã vượt qua bước
phê duyệt của chính nó.

### 2 — Resolve và kiểm tra route backend

Đọc `.workspace/<project>/<role>/config.json` của role `be`, rồi kiểm tra checkout trước khi đọc source
(`WORKSPACE-5`). Route stale đồng nghĩa schema và thư mục sibling sắp dùng làm mẫu thuộc về một trạng thái
sản phẩm khác; phải dừng tại đây.

### 3 — Đọc schema đang chạy, không dùng trí nhớ

Schema trong checkout mới là bằng chứng: entity, relation, enum, projection và những gì transport đang
công bố. Field nhớ được có thể đã đổi tên. Capability sẽ re-key theo enrolment, user hay course đều phải
được đọc từ schema, không được đoán.

### 4 — Đọc trọn thư mục operation sibling

Tìm operation cùng loại gần nhất và đọc toàn bộ: cách chia layer, input của handler, đường raise và nhận
diện exception, cách projection nhận dữ liệu, cách test được viết. **Bám theo family, không tự nghĩ ra
shape mới.** Nếu các sibling không thống nhất, đếm cả family và theo đa số, không theo file gần nhất.

### 5 — Gọi tên mọi file trước khi tạo file đầu tiên

Brief phải liệt kê từng path capability cần, file đó chứa gì và vì sao phải tách riêng. Không để lại câu
“sẽ đặt ở đâu đó”: chưa gọi tên được file thì chưa thể duyệt ranh giới, và ranh giới chưa duyệt là nơi
code ngoài scope lặng lẽ đi vào diff.

### 6 — Liệt kê test case ngay bây giờ

Viết test case khi các branch gợi ý chúng còn chưa tồn tại. Gọi tên từng đường lỗi: input bị từ chối,
không có row, viewer không đủ quyền, concurrent write, delivery trùng, projection rỗng. Mọi exception mà
capability có thể raise phải kế thừa abstract exception; một bare throw là defect, không phải test case.

### 7 — Xác định ranh giới, phương án khác và bằng chứng chấp nhận

Cuối brief phải nêu capability không làm gì, những phương án đã cân nhắc và lý do loại, cùng bằng chứng
chính xác sẽ chứng minh nó chạy đúng: test nào, query nào, runtime call nào.

### 8 — Đóng phase

Nói brief và boundary chính xác bằng văn xuôi thân thiện. Không kết thúc khi vẫn còn việc plan thuộc
`own`; brief cùng boundary chính xác là mục `NEED APPROVALS` duy nhất.

## Điểm dừng

- Route không có hoặc stale → báo bằng chứng route đã fail rồi kết thúc lượt chạy.
- Không đọc được schema → dừng; kế hoạch dựa trên schema nhớ lại chỉ là tưởng tượng.
- Không có sibling cùng loại → nói rõ đây là **family mới**, kèm lý do, để người duyệt biết họ đang đặt
  tiền lệ chứ không phải theo tiền lệ.

## ĐẦU RA

Trả brief sẵn sàng duyệt cùng file boundary chính xác bằng văn xuôi ngắn. Không in bảng trạng thái.

| Output | Owner |
|---|---|
| brief đã sẵn sàng phê duyệt cùng ranh giới file chính xác | `starci-be-approve` |

Owner có thể dùng brief đó trong một lượt approval được yêu cầu riêng. Skill này không tự khởi chạy nó.
