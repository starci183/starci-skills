# phân lớp mô-đun

## Định nghĩa

Một capability là một folder sở hữu một chủ đề — AI layer, database layer hoặc một API feature. Các rule ở đây nói về SEAM giữa các capability: import có thể đặt tên gì, capability được nói về chính nó tới đâu, và cross-capability dependency được phép nối ở đâu.

Mỗi rule tồn tại vì phương án ngược lại tạo ra cycle. Không phải loại cycle compiler ồn ào bắt được ngay, mà là loại im lặng: capability chạm vào internal của chính nó qua public door, một barrel kéo vào dependency graph mà không ai yêu cầu, hoặc một module import thẳng sibling module khiến hai capability không thể khởi động tách rời.

Câu hỏi giải quyết một trường hợp là: **file này có thể chuyển sang repository khác cùng capability mà vẫn có nghĩa không?** Nếu nó đặt tên barrel, vươn ngang sang capability khác, hoặc trỏ vào chính mình qua public alias, thì không.

Rule này được giữ bởi [`sources/be/module-layering.mjs`](../../../sources/be/module-layering.mjs).

## Quy tắc

**LAYERING-1 · Import phải nêu file khai báo symbol, không bao giờ nêu barrel.**

`@modules/ai/ai-invoke.service`, không `@modules/ai`. Barrel là file re-export cả folder; import barrel để lấy một symbol kéo toàn bộ folder vào graph. Đó là cách unit spec cuối cùng khởi động database driver và hai capability vốn không tham chiếu nhau kết thúc trong cycle thông qua phần thứ ba.

Barrel cũng phá hỏng điều người đọc cần biết từ import list: FILE này phụ thuộc vào cái gì.

**LAYERING-2 · Bên trong một capability, import chỉ dùng relative path.**

File dưới `modules/ai/` vươn tới `@modules/ai/...` nghĩa là capability đang nói chuyện với chính nó qua public front door. Đó là nam châm tạo cycle và là lời nói dối về boundary: alias có nghĩa “đến từ nơi khác”, nên dùng alias cho thứ không đến từ nơi khác là một tín hiệu cần dừng lại.

**LAYERING-3 · Cross-capability dependency được đăng ký tại composition root.**

`@Module` trong capability tree không được import trực tiếp module của capability khác. Việc đó cần biết về cả hai và thuộc về application root — nơi duy nhất có nhiệm vụ biết application được tạo từ gì.

Nesting bên trong một capability vẫn được phép, cũng như aggregator. Rule này nói về các edge SIDEWAYS, không nói về edge đi xuống.

**LAYERING-4 · Composition root là nơi duy nhất biết toàn bộ hệ thống.**

Capability nào tồn tại, capability nào global và chúng khởi động theo thứ tự nào đều thuộc về root. Đẩy bất kỳ kiến thức nào vào một capability khiến capability đó không thể tự khởi động — trong khi điều đầu tiên cần làm khi một phần hỏng là khởi động riêng phần đó.

**LAYERING-5 · Public surface của capability là các file mà capability muốn caller import.**

Không có index barrel re-export mọi thứ; caller phải nêu file. Nhờ vậy, surface hiện ngay trong import list của caller thay vì được khai báo trong barrel mà không ai đọc, và dependency bất ngờ sẽ hiện ra như một import lạ chứ không phải một tên nữa trong danh sách.

## Bị cấm

| Không bao giờ | Tại sao nó bị từ chối | Thay vào đó |
|---|---|---|
| `@modules/<name>` không có file phía sau | Barrel kéo toàn bộ folder vào graph để lấy một symbol và che mất file thực sự được dùng | Nêu file khai báo |
| `@features/<name>` hoặc `@tests/<name>` như một barrel | Tương tự | Tương tự |
| `@modules/<own capability>/...` từ bên trong capability đó | Capability nói với chính nó qua public door: cycle magnet và alias không còn mang nghĩa “ở nơi khác” | Một relative import |
| `@Module` của capability import module capability khác | Hai capability không thể khởi động tách rời; edge được nối ở nơi không sở hữu quyết định | Đăng ký tại composition root |
| Barrel file re-export cả folder | Nó làm mọi rule phía trên không thể thực thi được | Để caller nêu file |
| Biết startup order bên trong capability | Capability không còn tự khởi động được, trong khi đó là điều cần nhất khi nó hỏng | Giữ ở root |

## Ví dụ

### Trường hợp thông thường — import nêu file

```ts
import {
    AiInvokeService,
} from "@modules/ai/ai-invoke.service"
```

```ts
// Wrong: to get one service this pulls in everything the ai folder re-exports, and a reader
// cannot tell which file is actually depended on.
import {
    AiInvokeService,
} from "@modules/ai"
```

Chúng khác nhau ở việc dependency là file hay cả folder.

### Bẫy alias

```ts
// inside modules/ai/: the sibling is a relative import
import {
    AiEntitlementService,
} from "./ai-entitlement.service"
```

```ts
// Wrong: the same file, reached through the capability's own public alias. The alias is supposed
// to mean "this comes from somewhere else", and now it does not.
import {
    AiEntitlementService,
} from "@modules/ai/ai-entitlement.service"
```

Chúng khác nhau ở việc alias còn báo hiệu một lần vượt boundary hay không.

### Bẫy edge ngang

```ts
// apps/<app>/src/app.module.ts -- the composition root, whose job IS knowing the whole
@Module({
    imports: [
        AiModule,
        MembershipModule,
    ],
})
export class AppModule {}
```

```ts
// Wrong: inside modules/membership/. Membership and AI can no longer be started apart, and the
// decision was made in a file whose subject is neither of them.
@Module({
    imports: [
        AiModule,
    ],
})
export class MembershipModule {}
```

Chúng khác nhau ở việc mỗi capability có còn tự khởi động được hay không.
