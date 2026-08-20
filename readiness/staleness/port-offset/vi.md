---
title: Staleness · port offset
---

# Port offset

## LOADS

Không có.

## Luật

`.workspace/ports/config.json` là authority duy nhất cho slot step chung của Source, và mỗi
`.workspace/ports/<project>.json` là authority duy nhất cho family offset cùng application slot map bền.
Product repository được khai service identity/base port và giữ `ports` đã resolve cho runtime consumer;
không được sở hữu offset hay slot.

Shared service resolve bằng `basePort + family.offset`. Application service resolve bằng
`basePort + family.offset + application.slot * slotStep`. Application mặc định dùng slot `0`; application
thêm dùng slot nguyên không âm riêng. Frontend và backend dùng cùng công thức để một cặp application luôn
di chuyển cùng nhau.

Service declaration trong backend `metadata.json` dùng một scope:

- `shared`: bắt buộc `basePort`;
- `application`: bắt buộc `basePort` và `application`;
- `tool`: bắt buộc `port` tường minh và `reason` không rỗng, có tham gia host collision check;
- `external`: bắt buộc `port` tường minh và `reason` không rỗng, không tham gia local host collision vì
  không bind trong Source runtime.

## Stale khi

- registry config hoặc bất kỳ project allocation record nào absent/invalid;
- routed family/application chưa có allocation, hai application trùng slot, hoặc product còn lưu
  `portOffset`, `basePorts`, `fixedPorts`, offset note hay allocation authority khác;
- service không resolve được, projection `ports` lệch công thức, hoặc effective local port đụng service khác;
- frontend hay consumer khác hardcode giá trị lệch backend projection.

## Evidence cho stale list

Chạy `node .claude/scripts/check-port-offsets.mjs`. Report registry root, config path, slot step, từng family được gồm,
application slot, service projection, collision set, exclusion và mọi exact finding. Command chỉ check,
không mở target secret hay ghi target.

## Inventory

Ghi registry, routed backend metadata, mọi declared service và mọi frontend/runtime consumer đã biết. Tách
allocation defect khỏi consumer drift. Project bị exclude vẫn phải được gọi tên; silence không có nghĩa đã đo.

## Apply

Ghi slot step chung đúng một lần trong `.workspace/ports/config.json` và từng family allocation đúng một lần
trong `.workspace/ports/<project>.json`. Thay product allocation ownership bằng
`portServices` và projection `ports` đã derive, rồi cập nhật mọi consumer đã chạm. Migration một family
coordinate frontend/backend route thành một structural pass vì di chuyển một nửa tạo runtime pair sai.
Không renumber effective port đang sạch trừ khi xử collision đã đo.

## Proof

Chạy checker cho mọi family trong scope, search target repository cho allocation field đã retire, rồi start
đồng thời mọi application runtime trong scope và prove từng local listener unique/reachable. Giữ Docker data
service đang chạy; runtime smoke không public datastore port.
