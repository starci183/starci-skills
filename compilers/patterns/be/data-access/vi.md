---
title: Data-access · Vietnamese
---

# Truy cập dữ liệu

Đầu vào là một shape đã được duyệt: một thao tác, một entity hoặc một capability mà hành vi của nó đã chốt. Module này không mở lại quyết định ấy. Đầu ra của nó là kiến trúc source — constructor nhận tay cầm nào, decorator nào gọi tên tay cầm ấy, file nào nêu tên bảng, tầng nào giữ transaction, và relation được hỏi ở đâu. Shape nói hệ thống làm gì; pattern này nói đoạn code làm việc đó nằm ở đâu và phải có hình dáng nào.

## Luật

Mọi lần chạm vào dữ liệu đều đi qua một `EntityManager`, được tiêm bằng một decorator **gọi tên datasource** mà nó thuộc về. Ở đây không có repository injection, cũng không có connection mặc định ngầm: cả hai đều là những cái tay cầm trông giống hệt nhau dù đang trỏ vào database nào, mà ứng dụng này thì có nhiều hơn một database.

Toàn bộ luật bắt nguồn từ một tính chất duy nhất. `EntityManager` là **một đơn vị công việc có thể truyền đi** — đưa cho helper, bọc vào transaction, đánh tráo bằng bản transactional — còn repository thì không, vì nó bị buộc vào một entity duy nhất suốt đời. Ngay khi một use case cần ghi hai bảng một cách nguyên tử, code dựng trên repository phải viết lại chứ không mở rộng được, và lần viết lại ấy rơi vào module nào phát hiện ra trước.

Câu hỏi duy nhất phân định: **thao tác này có thể mọc thêm một lệnh ghi thứ hai không?** Gần như luôn luôn có thể, và một tay cầm không mang nổi transaction sang lệnh ghi thứ hai thì nó đã sai ngay từ đầu.

**Đây là luật bắt buộc, không phải lời khuyên.** Mỗi constructor chạm vào dữ liệu, mỗi class entity và mỗi thao tác nhiều lệnh ghi đều mang đúng một mã tình huống dưới đây, và không có thao tác nào nhỏ đến mức được miễn: đọc một dòng vẫn là `DATA-1` đúng cùng lý do mà tất toán một đơn hàng là `DATA-1`. Câu "có mỗi một bảng thôi mà" là chỗ luật này bị bỏ qua nhiều nhất, bởi vì bảng thứ hai đến sau, và lúc nó đến thì tay cầm đã sai rồi.

## Mã tình huống

Mọi tình huống module này quản đều mang một mã, `DATA-<n>`. Số hiệu là cố định và được trích dẫn từ các file luật khác cũng như từ hồ sơ công việc; một mã giữ nguyên số và nguyên nghĩa của nó chừng nào nó còn tồn tại.

| Mã | Tình huống | Source phải trông như thế nào |
|---|---|---|
| `DATA-1` | Đang tiêm handle vào constructor: chỗ này chạm database nào? | Một `EntityManager` được tiêm, tham số mang decorator `@Inject*EntityManager()` gọi tên datasource. Cấm: tham số `EntityManager` trần; dựa vào connection mặc định của framework |
| `DATA-2` | Đang chọn hình dáng của handle | Chạm dữ liệu qua `EntityManager`. Cấm: `@InjectRepository(...)`; tham số kiểu `Repository<T>`, `TreeRepository<T>` hoặc `MongoRepository<T>` |
| `DATA-3` | Đang khai một entity mới, hoặc sắp đổi tên một class entity | `@Entity("table_name")`, hoặc `@Entity({ name: "table_name" })` khi còn cần thêm schema. Cấm: `@Entity()` để tên bảng được suy ra từ tên class |
| `DATA-4` | Nhiều lệnh ghi phải cùng sống hoặc cùng chết | Việc phải cùng thành công hoặc cùng thất bại chạy trong một transaction, manager transactional được truyền vào mọi thứ bên trong. Cấm: helper tự lấy manager tiêm sẵn của nó trong khi người gọi đang giữa transaction |
| `DATA-5` | Câu trả lời này để làm gì, và ai trả giá cho nó | Relation, select và thứ tự khai ở call site — nơi biết câu trả lời dùng để làm gì. Cấm: relation `eager` trên entity |

`DATA-1` VÀ `DATA-2` CÙNG ĐỌC MỘT THAM SỐ CONSTRUCTOR NHƯNG KHÔNG PHẢI MỘT DỮ KIỆN. `DATA-1` nói về một tay cầm **không khai nó trỏ vào database nào**; `DATA-2` nói về một tay cầm **không mọc thêm được lệnh ghi thứ hai**, dù nó trỏ vào đâu đi nữa. Một `@InjectRepository` được viết rất tử tế hỏng cả hai; một `EntityManager` trần chỉ hỏng cái thứ nhất. Chúng là hai mã vì chúng hỏng độc lập và được sửa theo hai cách khác nhau.

## Đọc một shape đã duyệt

1. Đọc cái shape nói ra: thao tác nào tồn tại, nó chạm những bảng nào, nó trả về câu trả lời gì. Phần này đã chốt và không tranh luận lại ở đây.
2. Đọc cái shape **không** nói ra, và do đó không giải quyết: nó không bao giờ nói handle trỏ vào datasource nào, constructor nhận handle hình dáng nào, bảng tên là gì, những lệnh ghi nào phải cùng bị hoàn lại, hay call site nào cần relation nào. Năm khoảng trống ấy chính là phần module này giải, và không bịa thêm gì để lấp chúng.
3. Giải từ ngoài vào trong: datasource trước hình dáng handle, hình dáng handle trước transaction, transaction trước những relation mà một call site đơn lẻ hỏi. Một quyết định bên trong đặt trên một quyết định bên ngoài sai thì phải làm lại hai lần.
4. Hỏi câu hỏi của từng mã theo thứ tự. `DATA-1`: chỗ tiêm có nói đây là database nào không? `DATA-2`: tay cầm này có mang được lệnh ghi thứ hai không? `DATA-3`: entity có tự gọi tên bảng của nó không? `DATA-4`: mọi thứ bên trong transaction có nhận manager transactional qua tham số không? `DATA-5`: mỗi relation có được hỏi bởi chính call site cần nó không?
5. Khi hai mã cùng khớp thì cả hai cùng áp dụng — chúng không phải hai lựa chọn thay nhau. Một repository injection hỏng đồng thời `DATA-1` và `DATA-2`, và được sửa bằng hai lần sửa khác nhau; một manager tiêm rất đúng nhưng dùng bên trong transaction của người khác thì hỏng `DATA-4` trong khi vẫn qua sạch `DATA-1`. Sinh một khối output cho mỗi tình huống, không bao giờ gộp một khối cho cả hai.

## `DATA-1` — handle phải nói nó trỏ vào database nào

**Tình huống.** Bạn viết constructor cho một service, một handler hoặc một cron để chạm vào dữ liệu. Kiểu `EntityManager` không nói gì về connection: manager của database chính và manager của một bản replica phân tích hay một sandbox là cùng một kiểu.

**Nó sinh ra gì trong source.** Một tham số constructor kiểu `EntityManager` mang decorator `@Inject*EntityManager()` gọi tên datasource. Wrapper của nhà chỉ dài một dòng: nó buộc injector của chính framework vào một hằng connection có tên. Ứng dụng giữ nhiều hơn một họ datasource, và chính dữ kiện đó khiến một `EntityManager` không decorator trở thành mập mờ chứ không chỉ là luộm thuộm.

**Dấu hiệu nhận biết.** Trong constructor có một tham số kiểu `EntityManager` mà không có decorator nào đứng trước. Đọc file từ trên xuống dưới không tìm được một chữ nào nói đây là database nào. Wiring của module thì đúng, nên code chạy — cho tới hôm ai đó đổi provider mặc định.

**Ranh giới.** Không phải `DATA-2`: `DATA-1` nói handle **không khai** nó trỏ vào đâu; `DATA-2` nói handle **sai hình dáng** dù nó trỏ đúng vào đâu. Một `@InjectRepository` viết rất tử tế vẫn hỏng cả hai; một `EntityManager` trần chỉ hỏng cái thứ nhất. Cũng không phải `DATA-4`: `DATA-1` xét **chỗ tiêm**, `DATA-4` xét **chỗ dùng** — tiêm đúng vẫn có thể dùng sai bằng cách gọi manager của mình trong khi người gọi đang mở transaction.

**Tình huống nghiệp vụ hay gặp.** Service nghiệp vụ mới · cron chạy nền · projection đọc từ CDC · seeder · guard cần tra quyền · job xử lý hàng đợi · service dọn dữ liệu tạm.

## `DATA-2` — handle phải mang được lệnh ghi thứ hai

**Tình huống.** Bạn đang chọn hình dáng của tay cầm. Repository trông tiện hơn: nó đã biết entity, gọi ngắn hơn, IDE gợi ý đẹp hơn. Nhưng nó **buộc vào một entity**, nên cái ngày thao tác này phải ghi thêm một bảng nữa, nó không đi cùng được.

**Nó sinh ra gì trong source.** Dữ liệu được chạm qua `EntityManager`, không bao giờ qua repository — không bằng decorator `@InjectRepository`, cũng không bằng kiểu `Repository`, `TreeRepository` hay `MongoRepository` trên tham số constructor. Bắt cả kiểu chứ không chỉ decorator là điều quan trọng, vì riêng cái kiểu đã đủ buộc chặt tay cầm. Hình dáng mã này sinh ra là một `entityManager.transaction` ghi nhiều bảng qua `manager` của callback; một handler dựng bằng repository không thể viết được như vậy nếu không có mỗi bảng một tay cầm, và khi đó các bảng commit tách rời nhau.

**Dấu hiệu nhận biết.** Constructor có `@InjectRepository(...)`, hoặc một tham số kiểu `Repository<T>` / `TreeRepository<T>` / `MongoRepository<T>`. Handler có hai, ba repository — mỗi cái một bảng — và các lệnh ghi nằm cạnh nhau, không có gì gói chúng lại. Trong code review, câu "cái này chưa cần transaction đâu" xuất hiện.

**Ranh giới.** Không phải `DATA-1`: xem trên. Không phải `DATA-4`: `DATA-2` nói bạn **có** đơn vị công việc để truyền đi; `DATA-4` nói bạn **có truyền nó đi thật không**. Sửa xong `DATA-2` chưa đảm bảo `DATA-4` đúng.

**Tình huống nghiệp vụ hay gặp.** Ghi danh cộng trừ ví · tạo đơn cộng khoá số lượng tồn · duyệt bài nộp cộng cộng điểm · huỷ đơn cộng hoàn tiền cộng ghi nhật ký · tặng thành tích cộng gửi thông báo · mọi thứ có chữ "và" trong câu mô tả nghiệp vụ.

## `DATA-3` — entity phải tự gọi tên cái bảng của nó

**Tình huống.** Bạn khai báo một entity mới, hoặc — nguy hiểm hơn — bạn đang đổi tên một class entity cho hợp nghiệp vụ mới. Nếu tên bảng để ORM tự suy ra, nó suy ra từ tên class.

**Nó sinh ra gì trong source.** `@Entity("table_name")` đứng trên class entity, hoặc `@Entity({ name: "table_name", schema: "..." })` khi còn cần thêm schema. Tên class và tên bảng cố tình khác nhau, và đó chính là điểm mấu chốt: class có thể đổi tên mà bảng không phải chạy theo.

**Dấu hiệu nhận biết.** `@Entity()` không có tham số. Tên bảng trong migration khớp y hệt tên class, kể cả phần hậu tố kiểu `_entity`. Trong PR đổi tên class, phần diff không có file migration nào.

**Ranh giới.** Không phải `DATA-5`: cả hai đều là quyết định nằm trên entity, nhưng `DATA-3` nói về **danh tính** của bảng, còn `DATA-5` nói về **chi phí** mà entity áp lên mọi câu query. Một entity đặt tên bảng rất đúng vẫn có thể bắt cả hệ thống trả giá cho relation eager.

**Tình huống nghiệp vụ hay gặp.** Thêm entity mới · đổi tên class cho khớp ngôn ngữ nghiệp vụ · tách một entity làm hai · gộp hai entity làm một · entity cần nằm trong schema riêng.

## `DATA-4` — transaction là đơn vị công việc, và nó được truyền, không phải được ngầm hiểu

**Tình huống.** Bạn đã mở một transaction. Bên trong, bạn gọi một helper của service khác để cộng điểm, ghi nhật ký, phát thông báo. Helper ấy có manager riêng của nó, được tiêm ở constructor của nó.

**Nó sinh ra gì trong source.** Việc phải cùng thành công hoặc cùng thất bại chạy trong một transaction, với manager transactional được truyền như tham số vào mọi thứ bên trong. Chữ ký của helper nhận phần việc dưới dạng `(manager: EntityManager) => Promise<Result>` và gọi nó bằng manager của chính session đang giữ; các private method trên service cũng nhận `manager` qua tham số y như vậy. Không có gì bên trong tự đi lấy manager tiêm sẵn.

**Dấu hiệu nhận biết.** Bên trong callback của `transaction()` có một lời gọi **không** nhận `manager` làm tham số. Helper dùng `this.entityManager` trong khi người gọi đang ở giữa một transaction. Bug chỉ xuất hiện dưới tải, và luôn có hình dạng "một nửa đã ghi".

**Ranh giới.** Không phải `DATA-2`: xem trên. Không phải `DATA-1`: helper vi phạm `DATA-4` thường không vi phạm `DATA-1` chút nào — manager của nó được tiêm rất đúng, chỉ là nó không nên dùng cái đó ở đây. Đây là lý do mã này không bắt được bằng cách đọc một file. **Không có lint nào giữ mã này.** Chuyện helper có được trao manager transactional của người gọi hay không là một dữ kiện về call graph, không phải về một file đơn lẻ; một luật đọc một file sẽ phải đoán, mà đoán ở đây thì báo đỏ lên code đúng — và một luật báo đỏ lên code đúng thì bị tắt.

**Tình huống nghiệp vụ hay gặp.** Ghi danh rồi cộng ví · duyệt bài rồi cộng XP · thanh toán rồi phát thành tích · huỷ rồi hoàn · mọi service dùng chung được gọi từ bên trong transaction của người khác.

## `DATA-5` — query nói ra cái nó cần, entity không quyết hộ

**Tình huống.** Bạn đang lấy dữ liệu cho một câu trả lời cụ thể. Relation, cột và thứ tự là thuộc tính của **câu trả lời ấy**, không phải thuộc tính của entity. Người biết cần gì là call site.

**Nó sinh ra gì trong source.** Relation, select và thứ tự khai ngay tại call site biết câu trả lời dùng để làm gì — một cây `relations` viết trong handler, kèm ghi chú gọi tên màn hình nào cần nhánh nào. Các relation `@ManyToOne` trên entity không mang tuỳ chọn `eager`, nên call site chỉ cần một cột thì chỉ trả giá cho một cột.

**Dấu hiệu nhận biết.** Trên entity có relation khai `eager`. Một màn hình chỉ cần một cột nhưng query trả về cả cây quan hệ. Có người "tối ưu" bằng cách thêm eager cho tiện, và số truy vấn ở chỗ khác tăng lên.

**Ranh giới.** Không phải `DATA-3`: xem trên. Không phải `DATA-4`: cả hai đều là "quyết định nằm sai chỗ", nhưng `DATA-4` là quyết định về **tính nguyên tử**, còn `DATA-5` là quyết định về **chi phí**. Nhầm `DATA-4` gây mất dữ liệu; nhầm `DATA-5` gây chậm dần đều. **Không có lint nào giữ mã này.** Muốn biết một relation có nên được hỏi ở call site không thì phải biết câu trả lời dùng để làm gì, mà file entity thì không chứa dữ kiện đó.

**Tình huống nghiệp vụ hay gặp.** Danh sách gọn cạnh trang chi tiết đầy đủ · giỏ hàng cần giá và bản dịch · bảng xếp hạng chỉ cần tên và điểm · export chỉ cần vài cột · màn hình quản trị cần cả cây.

## Tầng giữ

Tầng nào thật sự giữ từng mã. `unrepresentable` nghĩa là giá trị sai không viết ra được; `enforced` nghĩa là một rule có tên trong `starci-eslint/packages/be/data-access.mjs` báo nó; `documented` nghĩa là không có gì máy móc giữ nó, chỉ người đọc giữ.

| Mã | Tầng | Ai giữ |
|---|---|---|
| `DATA-1` | `enforced` | `starci-be/must-inject-entity-manager` — báo tham số constructor kiểu `EntityManager` không mang decorator nào khớp `Inject*EntityManager`. Nó đọc cả tham số lẫn lớp bọc parameter-property, nên `private readonly` không giấu được decorator khỏi nó. |
| `DATA-2` | `enforced` | `starci-be/no-injected-repository` — báo cả hai cách viết: decorator `@InjectRepository`, và kiểu `Repository`, `TreeRepository` hoặc `MongoRepository` trên tham số constructor. Bắt cả kiểu chứ không chỉ decorator là điều quan trọng, vì riêng cái kiểu đã đủ buộc chặt tay cầm. |
| `DATA-3` | `enforced` | `starci-be/require-entity-table-name` — báo `@Entity()` mà đối số không mang tên bảng dạng chuỗi, dù trực tiếp hay qua thuộc tính `name` của object options. |
| `DATA-4` | `documented` | Chuyện helper có được trao manager transactional của người gọi hay không là một dữ kiện về call graph, không phải về một file đơn lẻ. Một luật đọc một file sẽ phải đoán, mà đoán ở đây thì báo đỏ lên code đúng — và đó là cách một luật đúng bị tắt. |
| `DATA-5` | `documented` | Một relation có nên được hỏi ở call site hay không phụ thuộc vào việc câu trả lời dùng để làm gì. Không có gì trong file entity nói người gọi cần một cột hay cả cây. |

Hai trên năm mã ở mức `documented`, và đó là tình trạng thật chứ không phải một lỗ hổng cần che đi. Ba mã được enforce đúng là ba mã mà parser nhìn thấy trong một file: một decorator trên tham số, một kiểu trên tham số, và một đối số của decorator. Hai mã còn lại là hai mã cần hoặc call graph hoặc ý định của người gọi — và module giữ các rule tự nói điều đó ngay trong header của nó, thay vì ship ra một heuristic sẽ bị tắt trong vòng một tuần.

## Điểm neo

Một luật không chỉ được vào code thật thì mới chỉ là một đề xuất. Mỗi mã gọi tên một file trong repository tham chiếu và nói ở đó phải nhìn cái gì.

| Mã | Điểm neo | Nhìn cái gì |
|---|---|---|
| `DATA-1` | `src/modules/databases/postgresql/primary/primary.decorators.ts` | Wrapper của nhà chỉ dài một dòng: nó buộc injector của chính framework vào một hằng connection có tên. Bên cạnh đó, `src/modules/databases/` giữ ba họ datasource — chính dữ kiện này khiến một `EntityManager` không decorator trở thành mập mờ chứ không chỉ luộm thuộm. |
| `DATA-2` | `src/features/api/core/graphql/mutations/courses/courses-checkout/courses-checkout.handler.ts` | Một `entityManager.transaction` ghi nhiều bảng qua `manager` của callback. Một handler dựng bằng repository không thể viết được như vậy nếu không có mỗi bảng một tay cầm, và khi đó các bảng commit tách rời nhau. Trên toàn `src/`, `@InjectRepository` và tham số `Repository<…>` xuất hiện đúng không lần nào. |
| `DATA-3` | `src/modules/databases/postgresql/primary/entities/cart-item.entity.ts` | `@Entity("cart_items")` trên một class tên `CartItemEntity`. Hai cái tên cố tình khác nhau, và đó là điểm mấu chốt: class đổi tên được mà bảng không phải chạy theo. |
| `DATA-4` | `src/features/api/core/graphql/mutations/courses/course-enroll/checkout-advisory-lock.ts` | Chữ ký của helper nhận phần việc dưới dạng `(manager: EntityManager) => Promise<Result>` và gọi nó bằng manager của session đang giữ lock. Không có gì bên trong tự đi lấy manager tiêm sẵn. `src/modules/bussiness/achievements/achievements.service.ts` cho thấy đúng hình dáng ấy trên các private method: cái nào cũng nhận `manager` qua tham số. |
| `DATA-5` | `src/features/api/core/graphql/queries/courses/my-cart/my-cart.handler.ts` | Cây `relations` được viết ngay tại call site, kèm ghi chú gọi tên màn hình nào cần nhánh nào. Rồi đọc lại `cart-item.entity.ts`: các relation `@ManyToOne` của nó không mang tuỳ chọn `eager`, nên ai chỉ cần một cột thì chỉ trả giá cho một cột. |

Mã nào cũng có điểm neo. Điểm neo là đường dẫn trong repository tham chiếu và chỉ tồn tại để kiểm chứng.

## Đầu vào

| Đầu vào | Bằng chứng bắt buộc |
|---|---|
| datasource | Công việc này chạm connection nào, và decorator nào gọi tên nó |
| handle | `EntityManager` được tiêm, hoặc manager transactional nhận qua tham số |
| writes | Mọi bảng thao tác này ghi, kể cả những bảng helper ghi thay nó |
| atomicity | Trong số các lệnh ghi đó, những cái nào phải cùng thành công hoặc cùng thất bại |
| helpers | Mọi hàm được gọi bên trong transaction, và mỗi hàm lấy manager từ đâu |
| answer | Người gọi làm gì với kết quả, và do đó nó cần những relation và cột nào |

## Quy tắc

1. `EntityManager` được tiêm phải gọi tên datasource ngay tại chỗ tiêm.
2. Dữ liệu không bao giờ đến dưới dạng repository, không bằng decorator và cũng không bằng kiểu.
3. Entity phải tự nêu tên bảng; tên bảng không bao giờ là hệ quả của tên class. Dạng options hợp lệ ngang dạng chuỗi.
4. Việc phải cùng bị hoàn lại thì nằm trong **một** transaction.
5. Mọi thứ chạy bên trong transaction đều nhận manager transactional qua tham số.
6. Relation được hỏi bởi call site cần nó, entity không phát eager cho tất cả mọi người.
7. Nếu chưa chắc thao tác có mọc thêm lệnh ghi thứ hai không: coi như có. Chọn handle theo giả định đó, vì đổi handle về sau tốn hơn nhiều so với giữ sẵn một handle rộng hơn nhu cầu hôm nay.
8. Mọi constructor chạm dữ liệu, mọi entity và mọi thao tác nhiều lệnh ghi đều quy về đúng một mã cho mỗi tình huống. Không thao tác nào nằm ngoài phạm vi.

## Ngoại lệ

Ngoại lệ là **một phần của luật**, không phải chỗ để lách. Mỗi ngoại lệ dưới đây đều khép kín và nêu rõ mã nó áp dụng vào.

- **Dạng options của `@Entity`.** Thuộc `DATA-3`. `@Entity({ name: "t", schema: "s" })` hợp lệ ngang `@Entity("t")` và không phải một biến thể phong cách cần loại bỏ: nó là dạng duy nhất mang được schema. Cấm nó thì tác giả sẽ xoá schema đi cho vừa luật — hỏng hơn cả cái lỗi mà luật này sinh ra để chặn.
- **Manager lấy từ query runner tự mở.** Thuộc `DATA-4`. Manager transactional không bắt buộc phải đến từ callback của `transaction()`. Một helper tự mở query runner để giữ một lock theo session, rồi truyền **manager của chính runner đó** vào trong, thì vẫn nằm trong một đơn vị công việc và thoả mã này. Điều bị cấm là callee tự đi lấy manager của mình, không phải một cách tạo manager cụ thể nào. Cách đọc này được suy ra từ điểm neo chứ không do luật phẳng cũ nói thẳng, và được ghi nhận như một điểm căng chứ không mặc nhiên coi là đúng.
- **`DATA-4` và `DATA-5` do người giữ.** Thuộc chính hai mã đó. Chúng không nhẹ hơn ba mã kia, chúng nằm ở **tầng giữ khác**. Một reviewer không trả lời được câu "helper này lấy manager ở đâu" thì người ấy vừa tìm ra lỗi, không phải vừa gặp một chỗ luật nói chưa rõ.
- **Nợ khi mới áp dụng.** Cả ba rule đo được không vi phạm nào ở repository tham chiếu nên đều bật ở mức `error`. Một repository mới áp dụng thì đo trước, cái nào trên không thì để `warn` kèm con số, dọn xuống không, rồi mới lật sang `error`. Bật `error` khi còn nợ sẽ chặn mọi commit chạm vào chỗ nợ — và đó là cách một rule đúng bị gỡ ra.

## Đầu ra

Mỗi file mà shape đã duyệt sinh ra thì một khối.

```text
datasource: <connection the decorator names>
handle: <injected EntityManager | transactional manager parameter>
writes: <every table this operation writes>
situation: <DATA-1 | DATA-2 | DATA-3 | DATA-4 | DATA-5>
placement: <where the decision must be stated: injection site, entity, transaction, call site>
reason: <the second write, or the caller whose cost this decision moves>
```

## Ví dụ đã giải

Shape đã duyệt: *thanh toán giỏ hàng thì ghi danh người mua vào mọi khoá trong giỏ và dọn sạch giỏ, còn màn hình giỏ hàng liệt kê từng món kèm giá của nó.*

Shape nói ra hành vi và những bảng liên quan. Nó không nói datasource nào giữ các bảng ấy, handler nhận handle hình dáng nào, các bảng tên là gì, việc ghi danh và việc dọn giỏ có phải cùng bị hoàn lại hay không, hay màn hình giỏ hàng cần những relation nào — nên không điều nào trong số đó được shape giải, và mỗi điều được giải bởi một mã dưới đây.

```text
datasource: primary
handle: injected EntityManager
writes: none — constructor injection only
situation: DATA-1
placement: injection site — the checkout handler constructor
reason: the application holds three datasource families, so an undecorated EntityManager does not say which one this handler writes to
```

```text
datasource: primary
handle: injected EntityManager
writes: enrollments, cart_items
situation: DATA-2
placement: injection site — the checkout handler constructor
reason: not DATA-1, because the datasource is already named here; the fact that excludes it is that this handle must carry a second write, and a repository bound to enrollments cannot travel to cart_items
```

```text
datasource: primary
handle: n/a — declaration site
writes: cart_items
situation: DATA-3
placement: entity — the cart item entity class
reason: not DATA-5, because nothing here is about query cost; the fact that excludes it is that the class may be renamed and the table must not follow, so @Entity("cart_items") states the identity
```

```text
datasource: primary
handle: transactional manager parameter
writes: enrollments, cart_items
situation: DATA-4
placement: transaction — one entityManager.transaction whose callback manager is passed to every helper
reason: not DATA-2, because the handle is already an EntityManager; the fact that excludes it is that an enrolment helper called inside the transaction would otherwise use its own injected manager and commit independently, leaving the cart cleared and the enrolment gone on rollback
```

```text
datasource: primary
handle: injected EntityManager
writes: none — read path
situation: DATA-5
placement: call site — the cart query handler
reason: not DATA-3, because the table identity is already stated; the fact that excludes it is that only this screen knows it needs price and translations, so the relations tree belongs here and the entity grants no eager relation to everyone
```

## Phạm vi

Luật này đúng với mọi back end quan hệ trong stack này chạm dữ liệu qua một tay cầm kiểu đơn vị công việc. Nó không gọi tên một tính năng nào: đọc y như nhau cho một lần tất toán, một cron hay một truy vấn một dòng. Ví dụ là TypeScript thường trong một ứng dụng hình dáng Nest; bảng Điểm neo là nơi duy nhất mang đường dẫn repository, và nó mang chúng để kiểm chứng chứ không phải để minh hoạ.

MỘT ĐỊNH DANH ĐƯỢC SHIP KHÔNG PHẢI LÀ TÊN SẢN PHẨM THEO NGHĨA NÀY. Một rule được trích dẫn bằng đúng tên đã công bố, kèm cả tiền tố plugin, vì đó là chuỗi ký tự chính xác mà build log in ra và comment disable mang theo. Một trích dẫn không dán được vào ô tìm kiếm thì không phải trích dẫn. Điều lệnh cấm trên nhắm tới là VĂN XUÔI và VÍ DỤ cần một sản phẩm mới hiểu được — không bao giờ là một định danh mà ai đó sẽ đọc thấy trong một lần lỗi và phải đi tra.
