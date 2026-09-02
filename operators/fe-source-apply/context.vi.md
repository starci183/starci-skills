# Context cho `fe.source.apply`

## Mục đích

Context là đúng phần vật liệu đã có sẵn để ghi một cây đã resolve vào product source. Nó trả lời câu
"operator này được đọc những gì?" trước khi byte đầu tiên được ghi. Context không bao giờ nới rộng
phạm vi nhiệm vụ và không bao giờ biến bằng chứng thành thẩm quyền.

Mọi tham chiếu đều bất biến trong suốt lần gọi và bị ràng bằng fingerprint `sha256:`. Những quan sát
dựa trên source thì ràng thêm cả source head đã quan sát được.

## Các lớp context

| Context | Vai trò trong quyết định | Tư cách thẩm quyền |
| --- | --- | --- |
| Resolution receipt | Các quyết định đã xong: từng node, thuộc tính, chủ sở hữu, rule và class. | Bắt buộc. Nguồn duy nhất của những giá trị operator này được ghi. |
| Cây đã resolve | Artifact mà receipt mô tả, ràng bằng fingerprint riêng của nó. | Bắt buộc. Chính nội dung đang được mang vào source. |
| Frontend source | Checkout đã route và head của nó. | Bằng chứng bắt buộc rằng lần ghi rơi đúng vào source đã đóng băng. |
| Direction receipt | Direction đã duyệt mà resolution hiện thực hoá. | Bằng chứng về ý định. Không bao giờ là nguồn giá trị. |
| Owner audit | Các phát hiện trước đó của cùng owner. | Bằng chứng và lịch sử hồi quy. |

## Context bắt buộc

Mỗi lần gọi đều cần:

1. một resolution receipt kèm fingerprint, tham chiếu cây đã resolve, chế độ phát contract, danh sách
   đầy đủ các class nó đã công bố, và danh sách đầy đủ các mã rule nó đã áp dụng;
2. tham chiếu frontend source đã route, với head bằng đúng `input.project.sourceHead`.

`context.directionRefs` và `context.auditRefs` là bằng chứng và được phép rỗng.

## Ref

| Alias | Trỏ tới | Bind | Bắt buộc |
| --- | --- | --- | --- |
| `@receipt/fe-presentation-resolution/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Bắt buộc: The only source of values this operator may write. |
| `@fe` | `<checkout:input.project.id/fe>  (the frontend checkout of the project this invocation binds)` | fingerprint + sourceHead (git rev-parse HEAD of the checkout) | Bắt buộc: The checkout the declared write set lands on; the one place this operator writes product source. |
| `@receipt/fe-direction-decision/<invocationId>` | `<@artifacts of invocation <invocationId>>/<receiptType>.json (the receipt file that invocation registered in output.artifactRefs)` | fingerprint + the sourceHead the receipt binds | Tuỳ chọn: Intent; never a source of values. |
| `@artifacts` | `input.project.artifactRootRef; convention <Source>/.worktrees/sessions/<invocationId>/artifacts/` | fingerprint per artifact; every artifact an operator writes is registered in output.artifactRefs | Bắt buộc: Where the application receipt is written. |

## Resolution là danh sách giá trị

`context.resolution.classNames` là danh sách đầy đủ và đã đóng băng những chuỗi class operator này
được phép ghi, còn `context.resolution.appliedRuleIds` là danh sách đầy đủ những mã nó được phép mang
vào thuộc tính contract. Cả hai đều không phải gợi ý, và không phải một tập con.

Một class mà lần ghi sẽ sinh ra nhưng resolution không chứa là `WRITE_REJECTED`. Không có làm tròn,
không có giá trị gần đúng, và không có chuyện chép từ file bên cạnh: operator này không có cách nào
quyết một giá trị, nên một giá trị nó không tìm thấy là một giá trị chưa tồn tại.

`input.resolution` nhắc lại tham chiếu và fingerprint của receipt mà bên gọi tin rằng mình đã bind. Nó
phải bằng đúng `context.resolution`. Bên gọi nêu tên một receipt nhưng bind một receipt khác thì bị
`RESOLUTION_STALE` trước khi mở bất kỳ file nào.

## Trần owner

`input.scope.mutableOwners` nêu từng owner được phép ghi và đúng đường gốc mà owner đó sở hữu.
`input.scope.observationOnlyOwnerRefs` nêu những owner chỉ được đọc và không bao giờ được ghi. Hai tập
rời nhau, và owner của target nằm trong tập được sửa.

Một đường dẫn chỉ nằm trong trần khi nó nằm dưới gốc của chính owner đã khai nó. Chỉ thuộc về owner
thôi thì chưa đủ, vì một ownerRef được phép sửa gắn vào một đường nằm ngoài gốc của chính nó chính là
cách một lần ghi thoát khỏi trần mà vẫn trông như đã được cho phép.

## Ranh giới

Context là chỉ đọc. Operator này là ranh giới đột biến duy nhất của pipeline frontend: nó là operator
duy nhất ghi product source, và nó không ghi gì khác. Nó không quyết giá trị, không chọn component,
không dựng lại cấu trúc cây, không sửa knowledge, không publish Grammar, không chạy service, và không
ghi phán quyết lên thứ nó vừa ghi.

## Tài nguyên

Operator này chạy trọn trên profile `opus` (`claude-opus-5`, runtime `claude`), khai dưới `resources` trong `operator.json` và được `scripts/validate-resources.mjs` kiểm. Quyền nó cần: ghi source. Nó không bao giờ tìm trên mạng, tuân thủ Grammar đã publish, và không sinh hình. Một quyền không nằm trong `requires` thì không dùng được dù profile có cho phép.
