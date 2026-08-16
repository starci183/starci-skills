---
id: be-lints-testing-audit
title: audit.md
slug: /be/lints/testing/audit
sidebar_label: audit.md
sidebar_position: 3
description: Phản biện mức thực thi của luật kiểm thử — quy tắc nào có thật, mã luật nào bỏ trống, cửa nào còn mở.
---

# audit.md

> Version: `2.00` · Mô-đun: `testing`

Phản biện này hỏi một câu: **những gì tài liệu này nói có chỉ được vào mã nguồn không.** Mọi khẳng
định dưới đây đọc từ tệp quy tắc, không đọc từ trí nhớ.

## Verdict

**Chấp nhận, kèm bốn phát hiện.**

Đếm được **đúng năm** quy tắc trong bảng công bố của tệp nguồn, khớp con số dự kiến. Cả năm đều ánh
xạ vào đúng một mã luật, **không quy tắc nào mồ côi**. Cả năm đều ở mức `error`.

Nhưng luật có **mười một** mã và chỉ **năm** mã được canh. Sáu mã còn lại không có quy tắc nào — và
đó là tình trạng đúng, không phải thiếu sót, vì chính đầu tệp nguồn đã nói phần lớn luật này người
mới đọc được. Điều nguy hiểm không phải sáu mã trống; điều nguy hiểm là **năm quy tắc kia bị đọc
thành đã đóng kín**.

## Kiểm phân định

| Phép thử | Kết quả |
|---|---|
| Số quy tắc công bố | 5, khớp dự kiến. Đọc từ bảng `rules` xuất khẩu, không đoán theo số khối chú thích |
| Quy tắc ↔ mã luật | 5/5 ánh xạ. `TESTING-6`, `TESTING-2`, `TESTING-9`, `TESTING-3`, `TESTING-10` |
| Quy tắc mồ côi (không mã luật nào) | 0 |
| Mã luật không có quy tắc | 6: `TESTING-1`, `TESTING-4`, `TESTING-5`, `TESTING-7`, `TESTING-8`, `TESTING-11` |
| Định danh | Tên công bố, không có mã số thứ hai. Tên trong tài liệu chép **nguyên văn** từ bảng `rules` |
| Mức nghiêm trọng | 5/5 ở `error` trong cấu hình khuyến nghị |
| Nhận biết kiểu | 0/5. Mọi phép kiểm là so **tên đã viết ra** |
| Quy tắc báo ở cuối tệp | 3/5 dùng `Program:exit`, nên một dòng đổi kết luận cả tệp |
| Cửa còn mở đã ghi | 23 hàng trong bảng Open của `INDEX.md` |
| Quy tắc không có cửa mở nào | 0. Không quy tắc nào kín |

## Findings

**F1 — Hai danh sách gói nhà cung cấp trong cùng một tệp không khớp nhau.** Danh sách **cấm** của
`no-model-call-in-e2e` và danh sách **chấp nhận** của `harness-calls-provider-directly` được viết
riêng, và chúng lệch: có gói nằm trong danh sách chấp nhận của harness mà danh sách cấm của làn luồng
không có. Hệ quả cụ thể: cùng một dòng nhập khẩu vừa hợp lệ ở harness vừa **không bị cấm** ở e2e.
Hai danh sách bảo trì tay cho cùng một khái niệm là hình dạng đã hỏng một lần rồi sẽ hỏng lại.

**F2 — Chú thích đầu tệp mang con số đã bị chính tệp đó rút lại.** Đầu tệp viết rằng đã đo được *tám*
spec và *một* e2e, "vì thế quy tắc thứ hai hạ cánh kèm một khoảng miễn thay vì hạ thẳng về không".
Phần `recommended` ở cuối tệp kể lại rằng con số **tám** là ước lượng bằng `grep` và nó **sai** — nó
đếm cả những tệp chỉ *có chứa* một matcher lời gọi, tức là đúng hình dạng quy tắc **cố ý cho phép** —
còn số đo thật là **1 trên 181**. Chú thích đầu tệp giữ lại con số đã bị bác.

**F3 — Chú thích đầu tệp mô tả một pha `warn` mà cấu hình đã ship không có.** Đầu tệp nói về "một
khoảng miễn thay vì không", `recommended` nói "cả hai hạ cánh ở `warn` kèm số đếm, đốt nợ dần, rồi
lật sang `error` khi về không". Cấu hình thật đã ở `error` cho cả năm, kèm ghi chú đốt nợ xong. Văn
mô tả một trạng thái quá khứ ở thì hiện tại.

**F4 — `e2e-uses-production-transport` có hành vi thật lệch xa tên của nó.** Tên nói về transport,
nhưng nửa sau phần cài đặt chỉ là một phép so **tên phương thức** trên bất kỳ đối tượng nào. Nó báo
`connection.execute(sql)` của một trình điều khiển cơ sở dữ liệu, `queue.process(handler)` trong phần
dựng, và `execute` của một bộ khách kiểm thử. Nghiêm trọng hơn: dòng `connection.execute(sql)` bị báo
thường là dòng **đọc trạng thái về** — tức là làm đúng thứ `e2e-asserts-persisted-state` đòi. Hai quy
tắc kéo ngược nhau trên cùng một dòng, và cách dập nhanh nhất là đổi tên một lời gọi hợp lệ.

## Decisions

- **Giữ đúng năm quy tắc, đúng tên đã công bố.** Không đặt mã số thứ hai. Tiêu đề mục trong ba tài
  liệu là tên quy tắc **nguyên văn**, kể cả khi tên chứa một chữ gắn với sản phẩm — đó là chuỗi in ra
  trong log build và phải viết đúng trong dòng vô hiệu hoá.
- **Ghi cửa mở làm nội dung chính, không làm phụ lục.** Mỗi quy tắc có ít nhất một hàng thật. Không
  hàng nào ghi "không có".
- **Không tài liệu hoá quy tắc chưa tồn tại.** Sáu mã luật trống nằm ở mục "Rủi ro còn mở" dưới đây,
  không nằm trong bảng `Rules`. Một quy tắc không chỉ ra được là một đề xuất, không phải một luật.
- **Không đề xuất sửa nguồn trong tài liệu này.** F1–F4 là phát hiện, không phải bản vá. Sửa nguồn là
  một thay đổi luật và phải đi qua `changelog.md`.
- **Nhận sự bất đối xứng của làn.** Ba quy tắc canh làn luồng, một canh làn unit, một canh làn
  harness, **không quy tắc nào canh làn integration**. Ghi nhận là chủ ý hiện tại chứ không phải sót.

## Rủi ro còn mở

Mỗi mục nói **quy tắc phải soi thêm cái gì** mới đóng được cửa — hoặc vì sao đóng nó tốn hơn lợi.

### Cửa mở của từng quy tắc

**`no-call-only-spec` — một khẳng định ngoại phạm gỡ ngòi cả tệp.** Muốn đóng: đếm theo **thân của
mỗi `it`/`test`** thay vì theo tệp, tức là phải nhận diện lời gọi khai báo ca kiểm thử, `describe`
lồng nhau, `it.each`, và các bảng ca sinh động lúc chạy. Tốn hơn lợi ở phần cuối: một ca sinh trong
vòng lặp không có thân tĩnh để đếm. **Đề xuất giữ mở**, nhưng phải nói rõ trong tài liệu — và đã nói.

**`no-call-only-spec` — matcher không cần được gọi.** Muốn đóng: yêu cầu nút cuối chuỗi member là
`callee` của một `CallExpression`. Rẻ và đáng làm; đây là cửa duy nhất trên kệ này có thể đóng bằng
một điều kiện.

**`no-call-only-spec` — tập chín tên matcher.** Muốn đóng: đổi từ danh sách trắng sang một mẫu
`^(?:to(?:Have)?(?:Been)?(?:Been)?Call|toHaveReturned)` — nhưng như thế sẽ nuốt cả những matcher
thuộc kết quả. Danh sách tay là lựa chọn có ý thức; giá của nó là phải cập nhật khi bộ chạy kiểm thử
thêm matcher.

**`no-call-only-spec` — viết lại thành khẳng định giá trị trên `mock.calls`.** Muốn đóng: phải soi
**chủ ngữ** của `expect(...)`, nhận ra `x.mock.calls`, `x.mock.results`, `x.mock.lastCall`. Làm được
mà không cần kiểu. **Đây là cửa mở đáng đóng thứ hai.**

**`no-call-only-spec` — `expect` bí danh hoặc khẳng định dời ra hàm trợ giúp.** Muốn đóng: phải phân
giải liên tệp, tức là phải có thông tin kiểu hoặc một đồ thị nhập khẩu. Tốn hơn lợi cho một quy tắc
lint theo tệp.

**`e2e-asserts-persisted-state` — dòng nhập khẩu và dòng dọn dẹp đã đủ bật cờ.** Đây là **rủi ro lớn
nhất trên kệ**, vì gần như mọi tệp luồng đều đóng nguồn dữ liệu trong phần dọn dẹp, nên quy tắc bị gỡ
ngòi ở phần lớn kho mã mà không ai biết. Muốn đóng: chỉ tính khi cái tên đó xuất hiện **bên trong
thân một ca kiểm thử**, và chỉ khi giá trị đọc ra chảy tới một `expect`. Việc thứ nhất làm được bằng
cách xét tổ tiên của nút. Việc thứ hai cần lần vết luồng dữ liệu — đắt, nhưng chỉ trong phạm vi một
tệp nên vẫn khả thi.

**`e2e-asserts-persisted-state` — sáu cái tên là toàn bộ vốn từ.** Vừa rò (đọc bằng tên khác thì báo
nhầm) vừa lỏng (trùng chữ ở thuộc tính thì bật cờ). Muốn đóng: cần biết **kiểu** của đối tượng, tức
là cần chương trình đã dựng kiểu. Đó là một thứ hạng công cụ khác. **Giữ mở, và ghi rõ rằng quy tắc
này đo từ vựng.**

**`no-model-call-in-e2e` — nhập khẩu động, `require`, và `fetch` thẳng.** Muốn đóng: thêm visitor cho
`ImportExpression` và cho `CallExpression` có callee `require`; với `fetch` thì soi chuỗi URL theo một
danh sách máy chủ nhà cung cấp. Hai cái đầu rẻ và đáng làm. Cái thứ ba lại là một danh sách tay nữa —
xem F1 để biết vì sao nên dè dặt.

**`no-model-call-in-e2e` — chạm tới mô hình mà không nhập khẩu gì.** Luật đòi bản giả là **mặc định
của thế giới kiểm thử**, đúng vì "một luật phải nhờ trí nhớ là một luật chỉ cách một buổi chiều đãng
trí". Không quy tắc lint nào chứng minh được điều đó: nó là một dữ kiện về cách **thế giới kiểm thử
được dựng**, không phải một hình dạng trong tệp spec. Chỗ giữ luật này là chính bộ dựng thế giới, nơi
bản giả được cài mặc định và bỏ bản giả phải là một hành động cố ý. **Giữ mở ở tầng lint, đóng ở tầng
hạ tầng.**

**`e2e-uses-production-transport` — thuộc tính tính toán và mọi tên phương thức khác.** Muốn đóng
phần thứ nhất: xử lý `MemberExpression` tính toán khi thuộc tính là một chuỗi hằng. Rẻ. Muốn đóng
phần thứ hai (`publish`, `handle`, gọi thẳng service): cần biết **đối tượng là gì**, tức là cần kiểu.
Mở rộng danh sách tên phương thức sẽ làm F4 nặng thêm chứ không nhẹ đi — thêm `handle` là báo nhầm
mọi bộ xử lý sự kiện của thư viện.

**`e2e-uses-production-transport` — báo nhầm đối đầu với `e2e-asserts-persisted-state`.** Đây là rủi
ro **giữa hai quy tắc**, không thuộc riêng quy tắc nào. Muốn đóng: một trong hai phải biết kiểu. Cho
tới lúc đó, người xem lại mã phải biết rằng dập quy tắc này bằng cách đổi tên một lời gọi hợp lệ là
một cách sửa **sai**.

**`harness-calls-provider-directly` — dòng nhập khẩu không dùng thoả mãn yêu cầu nhà cung cấp.** Muốn
đóng: kiểm rằng định danh nhập khẩu **được gọi** ở đâu đó trong tệp, chứ không chỉ tồn tại. Làm được
bằng phạm vi biến của bộ lint, không cần kiểu. **Đây là cửa mở đáng đóng thứ ba.**

**`harness-calls-provider-directly` — chứng thư đọc bằng dấu chấm và bằng chuỗi mẫu.** Muốn đóng:
thêm visitor cho `MemberExpression` (so tên thuộc tính) và cho `TemplateElement` (so `raw`). Rẻ, và
cửa này rò đúng vào **dạng viết thông thường nhất**, nên đây là cửa mở **đáng đóng nhất trên cả kệ**.

**`harness-calls-provider-directly` — cổng khoác kiểu hoặc mã thông báo khác.** Muốn đóng hết:
`Partial`, `Omit`, `Required`, một `interface` tự viết trùng hình dạng, một mã thông báo tiêm phụ
thuộc. Phần kiểu tiện ích có thể mở rộng phép quét token; phần `interface` trùng hình dạng và phần mã
thông báo thì không, vì cả hai đều là **quan hệ ngữ nghĩa** chứ không phải một chuỗi ký tự. Đóng một
nửa thì đắt mà vẫn để hở nửa còn lại.

**`harness-calls-provider-directly` — phạm vi trợ giúp là đúng một mảnh đường dẫn.** Muốn đóng: gom
mọi thư mục tên `helpers` dưới mọi gốc, hoặc quyết định theo cấu hình dự án thay vì theo chuỗi. Cấm
một thư mục không phải cấm một tệp, và đây đúng là hình dạng đó.

**Chung cho cả năm — hậu tố tên tệp là toàn bộ cổng.** Đổi `.spec.ts` thành `.test.ts` là một quy tắc
thôi tồn tại. Muốn đóng: không đóng được ở tầng quy tắc, vì làn tách bằng hậu tố **là chính luật**
(`TESTING-7`). Chỗ giữ nó là cấu hình bộ chạy kiểm thử và cấu hình glob của lint: một tệp kiểm thử
không khớp làn nào phải là lỗi cấu hình, không phải một tệp im lặng.

### Mã luật chưa có quy tắc nào

Sáu mã dưới đây **không được canh**. Ghi ở đây chứ không ghi trong bảng `Rules`, vì một quy tắc không
chỉ ra được là một đề xuất chứ không phải một luật.

| Mã luật | Nội dung | Vì sao chưa có quy tắc |
|---|---|---|
| `TESTING-1` | Một e2e là **một luồng nghiệp vụ**, và tên tệp là tên luồng | Không máy nào biết một cái tên có mô tả một câu nghiệp vụ hay chỉ là một nhóm resolver đội lốt. Một mẫu cấm hậu tố `-queries` sẽ bắt được đúng cách viết đó và bỏ sót mọi cách viết khác |
| `TESTING-4` | Đường thất bại chỉ lên e2e khi kéo theo một luồng trọng yếu | "Trọng yếu" là một phán đoán nghiệp vụ |
| `TESTING-5` | Unit spec phủ các **nhánh quyết định** | Cần biết nhánh nào tồn tại trong mã sản xuất và ca nào chạm tới nhánh nào. Đây là việc của công cụ đo phủ, và cả công cụ đó cũng đo dòng chứ không đo quyết định |
| `TESTING-7` | Làn tách bằng hậu tố | Chính quy tắc **dùng** hậu tố để chọn làn, nhưng không quy tắc nào **bắt buộc** một tệp kiểm thử phải mang một hậu tố hợp lệ. Cửa này thuộc cấu hình bộ chạy |
| `TESTING-8` | Một làn được cấu hình mà rỗng là làn báo xanh vĩnh viễn | Lint chạy trên **tệp có thật**; một làn rỗng đúng nghĩa là **không có tệp nào** để chạy. Không quy tắc lint nào bắt được cái vắng mặt. Chỗ giữ là bước kiểm cấu hình trong pipeline |
| `TESTING-11` | Seed thử nghiệm phải dựng một thế giới sống, không phải một tài khoản rỗng | Nội dung dữ liệu là phán đoán nghiệp vụ |

Ngoài ra, hai đòi hỏi **bên trong** `TESTING-9` cũng không có quy tắc nào: bản giả phải trả **JSON
thật đúng hình dạng bộ phân tích cú pháp chờ đợi** (một chuỗi đánh dấu như `"stubbed"` nhảy qua đúng
đoạn hay vỡ nhất), và bản giả phải là **mặc định của thế giới** chứ không nhờ tác giả nhớ. Cả hai đều
là dữ kiện về nội dung và về hạ tầng, không phải hình dạng cú pháp.

## Re-audit Triggers

- Bảng `rules` xuất khẩu thêm hoặc bớt một mục.
- Một trong hai danh sách gói nhà cung cấp đổi, hoặc F1 được sửa.
- Một tập tên đóng đổi: chín matcher lời gọi, sáu tên đọc trạng thái, ba tên bus, hai tên phương
  thức, ba tên ký hiệu cổng.
- Một cổng chọn làn đổi biểu thức chính quy, hoặc phạm vi trợ giúp `/src/tests/helpers/` đổi.
- Một mức nghiêm trọng rời khỏi `error`, hoặc một số đo đốt nợ trong `recommended` đổi.
- Xuất hiện một quy tắc canh làn integration, hoặc canh một trong sáu mã luật đang trống.
- Một dòng vô hiệu hoá **không nêu lý do** xuất hiện cho bất kỳ quy tắc nào trong năm quy tắc này.
- Một cửa mở trong bảng Open của `INDEX.md` được đóng, hoặc phát hiện thêm một cửa mới.
