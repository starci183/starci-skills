---
title: Cài embedding bằng Ollama
---

# Cài embedding bằng Ollama

## Kiểm tra trước khi chọn

Chọn model trước lần index đầu tiên. Ghi nhận RAM hệ thống, GPU và VRAM, rồi kiểm tra Ollama cùng model đang
có trên máy:

```text
ollama --version
ollama list
ollama ps
```

Trên Windows dùng `Get-CimInstance Win32_ComputerSystem`, `Get-CimInstance Win32_Processor` và
`nvidia-smi --query-gpu=name,memory.total --format=csv,noheader`. Trên Linux dùng `free -h`, `lscpu` và
`nvidia-smi`; trên Apple silicon dùng `system_profiler SPHardwareDataType`. Phải báo các số đo trước khi tư
vấn. VRAM dùng chung, model khác và Docker service đang chạy đều chiếm budget thực tế.

## Profile khuyến nghị

Ưu tiên họ Qwen3 embedding cho source StarCi vì cùng một họ xử lý được văn bản đa ngôn ngữ và code. Kích
thước model chỉ là tier triển khai thực dụng, không phải lời đảm bảo tuyệt đối về chất lượng retrieval:

| Máy | Khuyến nghị mặc định | Dung lượng pull | Độ dài embedding gốc | Đánh đổi |
|---|---|---:|---:|---|
| Chỉ CPU, RAM 8–16 GB, hoặc còn dưới 4 GB VRAM | `qwen3-embedding:0.6b` | khoảng 639 MB | kiểm tra bằng `ollama show` | nhanh và nhẹ nhất; retrieval ít sâu hơn |
| Còn 4–6 GB VRAM, hoặc RAM 16–32 GB có CPU fallback | `qwen3-embedding:4b` | khoảng 2.5 GB | kiểm tra bằng `ollama show` | cân bằng latency và code retrieval |
| Tối thiểu 8 GB VRAM và 32 GB RAM | `qwen3-embedding:8b` | khoảng 4.7 GB | 4096 | tier chất lượng cao; index chậm và tốn bộ nhớ nhất |

Nếu máy đồng thời chạy database, SonarQube hoặc LLM khác, hạ một tier khi `ollama ps` cho thấy model spill
nhiều sang CPU hoặc GPU gần đầy. Máy StarCi hiện tại—i7-14700KF, RAM 64 GB và RTX 5060 8 GB—chạy được 8B
Q4 và đã đo khoảng 89% GPU / 11% CPU; 4B là lựa chọn ưu tiên latency.

`nomic-embed-text` là fallback nhỏ khoảng 274 MB / 768 chiều cho máy rất hạn chế, nhưng context ngắn hơn và
không phải mặc định cho source catalog đa ngôn ngữ. Không chọn chat/generation model chỉ vì Ollama chạy được;
model phải khai báo capability `embedding`.

## Cài và kiểm tra

Cài Ollama từ `https://ollama.com/download`, khởi động local service rồi pull đúng tag đã chọn:

```text
ollama pull qwen3-embedding:0.6b
ollama pull qwen3-embedding:4b
ollama pull qwen3-embedding:8b
```

Chỉ pull một model đã chọn, không pull cả ba trừ khi chủ máy yêu cầu dữ liệu so sánh. Chạy
`ollama show <model>` và ghi lại `embedding length`. Warm model bằng một request `/api/embed` tới
`http://localhost:11434`, xác nhận trả về một vector không rỗng, rồi đọc `ollama ps` để biết tỷ lệ CPU/GPU
thực tế. Docker truy cập service host qua `http://host.docker.internal:11434`; Ollama không bao giờ là public
tunnel origin.

## Khóa model

Index và query phải dùng đúng cùng model tag, vector name và dimension. Schema collection Qdrant khóa
dimension đó. Đổi bất kỳ giá trị nào yêu cầu dựng lại toàn bộ source-context collection và mọi routed
partition; không trộn vector từ hai model trong một collection hoặc chỉ đổi query model của MCP. Vì index có
thể dựng lại, không giữ point thủ công và chỉ rebuild sau khi đã biết chính xác các partition bị ảnh hưởng.

Profile StarCi đóng gói sẵn là `qwen3-embedding:8b` với 4096 chiều. Profile thấp hơn phải được cấu hình trước
lần `setup` đầu tiên; đổi profile đang tồn tại là một lượt rebuild được báo riêng, không phải upgrade tại chỗ.
