# Principles goal

Gate Principles phải xác định chính xác layout/block đã duyệt sẽ render thành contract, node, state
và visual rule nào. Mỗi kết luận phải neo vào accepted hash, contract registry, source hoặc business
fact có owner.

Không hallucinate bất kỳ tình huống nào. State, interaction, data field hoặc contract chưa có bằng
chứng phải trả `returned-to-owner` hoặc finding; tuyệt đối không lấp chỗ trống bằng “best practice”,
placeholder hay suy luận ngầm.

Mọi quyết định visual phải có principle receipt theo từng `slot + concern`: input phân loại, mã tình
huống, output chính xác và evidence. Coverage thiếu một decision hoặc recipe khác bảng trong
`principles/<concern>/INDEX.md` thì Gate 3 thất bại và Execute chưa được viết source.
