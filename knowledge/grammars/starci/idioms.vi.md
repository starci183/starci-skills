# StarCi Core — idiom

Idiom là một cách ghép mà StarCi quay lại dùng: một lối lắp các renderer Grammar đã công bố mà chủ sở
hữu đã chọn hơn một lần. File này là gu, không phải luật. Luật universal nằm ở
[knowledge/ui](../../ui/INDEX.vi.md); còn mỗi renderer là gì và sở hữu cái gì thì nằm ở
[DNA](DNA.vi.md), sinh ra từ package. Ở đây không kể lại giải phẫu renderer, và cũng không bảo ai đi
tìm cảm hứng ở đâu: một định hướng được ghép từ các idiom này cộng với hình dạng nghiệp vụ, còn tham
chiếu, khi yêu cầu có kèm, được đọc xuyên qua chúng.

Điều kiện để một cách ghép thành idiom chỉ có một: xuất hiện ít nhất hai lần trong các block bằng
chứng — starci `src/components/blocks/dashboard/*` và
`src/components/blocks/commerce/ProSubscriptionBlock`, cùng nivo
`apps/app/src/components/blocks/auth/AuthenticationPanel`. Cách ghép mới thấy một lần được ghi ở cuối
file và không bao giờ được đem ra ghép. Chỗ nào chủ sở hữu đã tự viết ra ý định thì câu đó được trích
nguyên từ `classNames.ts` của chính block, vì đó là lời của chủ sở hữu về lý do hình dạng ấy tồn tại.
Mọi ô composition chỉ gọi tên renderer và prop mà package thực sự công bố.

## Joined bands in one flush card

Một thẻ duy nhất, không thẻ lồng: thân thẻ phẳng, và chỉ có đường kẻ ngang chia nó thành các dải.

| Dùng khi | Cách ghép Grammar | Bằng chứng |
| --- | --- | --- |
| Một mục dashboard chứa từ hai loại nội dung trở lên nhưng cùng thuộc một tiêu đề | `SurfaceCard label composition="joined"` bọc một thân `flex flex-col` của app mà các con là các dải; thẻ sở hữu biên ngoài và việc cắt, app sở hữu `border-t border-separator` giữa các dải | 10 block dashboard: `ChangelogList`, `ContinueLearning`, `DailyQuest`, `FeedExplorer`, `JobReadinessWidget`, `OverviewContributions`, `StreakStrip`, `TrendingContents`, `WeeklyChallengeCard`, `WeeklyGoals`. Chủ sở hữu: "Stack full-bleed bands inside one bounded dashboard surface", "Separate stacked dashboard bands without inventing extra vertical space" (`blocks/dashboard/classNames.ts`) |
| Một dải là danh sách các phần tử ngang hàng | `ul`/`div` của app với `m-0 list-none p-0 divide-y divide-separator`; mỗi hàng `px-4 pt-3 pb-3 last:pb-4`, nên lề trong không đổi và chỉ mép dưới ngoài cùng mới nới ra | `ChangelogList`, dải task của `DailyQuest`, trụ đo của `JobReadinessWidget`, hàng finisher của `WeeklyChallengeCard`, `MyCoursesProgress`, `RecommendedCourses`, lưới quyền lợi bên commerce. Chủ sở hữu: "One divided row inside a flush dashboard list: px-4 always; pb-4 only on the bottom edge" (`blocks/dashboard/classNames.ts`) |
| Một mục giải thích mang cả chữ, tranh và danh sách | Vẫn một thẻ ấy, ba thứ thành ba dải nối nhau thay vì ba thẻ | Thẻ quyền lợi của `ProSubscriptionBlock`: dải mở đầu, dải tranh hành trình, lưới quyền lợi trong cùng một `SurfaceCard label composition={"joined"}` |

## A neutral band opens the card with its summary

Câu trả lời một dòng của thẻ nằm trước, trên nền phụ, và tách khỏi phần bằng chứng bên dưới — là bản
tóm tắt, không phải một phán quyết.

| Dùng khi | Cách ghép Grammar | Bằng chứng |
| --- | --- | --- |
| Thẻ nêu một số đo trước khi trưng bằng chứng cho số đo ấy | Dải của app `bg-surface-secondary text-foreground px-4 pt-4 pb-3` làm con đầu tiên của thẻ joined, rồi `border-t border-separator` | Dải đầu của `JobReadinessWidget`, dải tóm tắt của `WeeklyGoals`, dải đếm ngược của `WeeklyChallengeCard`, dải mở đầu quyền lợi của `ProSubscriptionBlock` |
| Dải nằm giữa hai đường kẻ chứ không ở trên cùng | Vẫn cách xử lý ấy nhưng `px-4 py-3` | Dải phần thưởng của `DailyQuest`. Chủ sở hữu: "Neutral band between separators: px-4 always; p-3 on both separator sides vertically" (`blocks/dashboard/classNames.ts`) |
| Bản tóm tắt là kết quả đã chứng minh, không phải lời hứa còn treo | Chỉ khi đó dải mới nhận màu trạng thái; lời hứa chưa nhận vẫn trung tính | Chủ sở hữu: "Keep an unclaimed promise neutral; only a proven claimed outcome receives success" (`DailyQuest/classNames.ts`); "Present weekly progress as a neutral summary rather than a state outcome" (`WeeklyGoals/classNames.ts`); [TRUTH-1..4](../../ui/proof/render-truth.vi.md) |

## The card's one action closes the bottom band

Một thẻ có nhiều nhất một hành động đi tiếp, và nó nằm trong dải riêng sát mép dưới thẻ — không bao
giờ trôi nổi giữa nội dung.

| Dùng khi | Cách ghép Grammar | Bằng chứng |
| --- | --- | --- |
| Thẻ mở ra một lối đi tiếp | Dải của app `border-t border-separator px-4 pb-4 pt-3` làm con cuối cùng, chứa một `Button` hoặc `TextAction` | `JobReadinessWidget`, `StreakStrip`, `WeeklyChallengeCard`, `WeeklyGoals`. Chủ sở hữu: "Keep a card's lone action separated at the bottom edge" (`blocks/dashboard/classNames.ts`) |
| Hành động là mua và phải sống được trên màn hình hẹp | Vẫn dải ấy nhưng `grid grid-cols-1 gap-2`, `Button variant="primary"` kéo hết bề ngang dải, và tuỳ chọn một `Text size="xs" tone="muted"` bên dưới | `ProSubscriptionBlock`. Chủ sở hữu: "Full-bleed divider and inset action content for the purchase boundary" (`ProSubscriptionBlock/classNames.ts`) |

## Generated art is a band, not a card

Tranh sinh ra được cấp một dải bên trong chính mặt phẳng mà nó thuộc về. Nó không thành thẻ thứ hai,
và cũng không bị đóng khung thụt vào để rồi lộ viền đen hai bên.

| Dùng khi | Cách ghép Grammar | Bằng chứng |
| --- | --- | --- |
| Bức tranh chính là điều mục ấy muốn nói | Một dải tràn viền riêng bên trong thẻ joined: `border-t border-separator` phía trên, không lề trong, ảnh để `block h-auto w-full` để tỉ lệ gốc còn nguyên | Dải hành trình của `ProSubscriptionBlock`. Chủ sở hữu: "The generated journey is its own edge-to-edge joined band; the SurfaceCard owns outer clipping" và "Preserve the generated asset ratio without an inset frame or letterbox" (`ProSubscriptionBlock/classNames.ts`) |
| Bức tranh là phần thưởng hoặc gợi mở mang tính trang trí | `MediaFrame aspect="landscape" fit="contain" treatment="plain"` đặt trong dải `bg-accent-soft` của app, hoặc một mảng accent với tranh neo ở mép sau và `alt=""`/`aria-hidden` | Khối tranh của `TrendingContents` — chủ sở hữu: "Keep generated discovery media prominent without becoming a separate card"; hero của `DailyQuest` — chủ sở hữu: "The generated quest illustration stays decorative on the hero's trailing edge" |

## Title and one supporting line

Hai dòng xếp sát nhau: tên của thứ đang nói, rồi một dòng mờ bổ nghĩa cho nó. Đây là quan hệ lặp lại
nhiều nhất trong toàn bộ tập mặt phẳng.

| Dùng khi | Cách ghép Grammar | Bằng chứng |
| --- | --- | --- |
| Ở trong một hàng hay một ô, khi tiêu đề không phải cấu trúc tài liệu | `Text size="sm" weight="semibold"` rồi `Text size="xs" tone="muted"`, xếp chồng ở [GAP-1](../../ui/presentation/gap.vi.md) | Các hàng dashboard và các hàng quyền lợi bên commerce. Chủ sở hữu: "Title and explanation stack for one outcome" (`ProSubscriptionBlock/classNames.ts`) |
| Tiêu đề là tên của chính mặt phẳng | `Heading` rồi `Text size="sm" tone="muted"` | Phần đầu và cây thông báo của nivo `AuthenticationPanel`. Chủ sở hữu: "Title and subtitle stay visually coupled" (`AuthenticationPanel/classNames.ts`) |
| Phần bổ nghĩa phải nằm trên tiêu đề | `Text size="xs" tone="muted"` trước, rồi `Text size="md" weight="semibold"` | `ContinueLearning`. Chủ sở hữu: "Keep the supporting kind close to the destination title it qualifies" |
| Muốn Grammar sở hữu cặp này | `SurfaceCopyGroup` — renderer duy nhất được công bố cho nhịp ấy | Trạng thái mua của `ProSubscriptionBlock` |

Đếm mỗi container một lần trên toàn bộ block bằng chứng, cặp này xuất hiện tám lần, bảy trong số đó
dựng tay bằng `div` của app; bản kiểm kê và đề xuất cấp slot có kiểu cho `SurfaceCopyGroup` nằm ở
[audits/1.0.1/proposals/copy-group-composite.md](../../../audits/1.0.1/proposals/copy-group-composite.md).

## Pending is the same tree, resting

Mặt phẳng đang tải chính là mặt phẳng hoàn chỉnh với nội dung nghỉ: cùng thẻ, cùng dải, cùng số hàng.
Nó không bao giờ là một vòng xoay, cũng không bao giờ là một cây khác.

| Dùng khi | Cách ghép Grammar | Bằng chứng |
| --- | --- | --- |
| Block đang đợi dữ liệu | `SurfaceCard state={loading ? "pending" : "neutral"}`, một mảng phần tử nghỉ có độ dài cố định thay cho dữ liệu thật, và `isSkeleton` trên mọi `Text` và `Heading` bên trong | `ChangelogList`, `ContinueLearning`, `DailyQuest`, `JobReadinessWidget`, `OverviewContributions`, `StreakStrip`, `WeeklyChallengeCard`, `WeeklyGoals`, `ProSubscriptionBlock` |
| Hành động đã có nhưng chưa được phép chạy | Vẫn cây ấy với `Button isDisabled` thay vì gỡ nút đi, để bố cục không nhảy khi dữ liệu về | Hành động mua của `ProSubscriptionBlock` |
| Block không có dữ liệu nào, hoặc lần đọc thất bại | Một cây khác hẳn: `SurfaceCard composition="single"` bọc một `EmptyNotice` với `message`, `actionLabel` tuỳ chọn và `iconSource` — rỗng và hỏng là state, không phải biến thể nghỉ | `ContinueLearning`, `DailyQuest`, `TrendingContents`; [STATE-1](../../ui/composition/state.vi.md) |

## One highlighted card

Trong một khung nhìn, nhiều nhất một thẻ mang `isHighlight`, và đó là việc người đọc nên làm tiếp
theo. Highlight là một khẳng định về nhiệm vụ, không phải trang trí.

| Dùng khi | Cách ghép Grammar | Bằng chứng |
| --- | --- | --- |
| Các phần tử ngang hàng cùng hiện nhưng một cái là bước kế tiếp có chủ đích | `SurfaceCard isHighlight={true}` chỉ trên đúng thẻ đó; các thẻ còn lại giữ nguyên mọi prop khác, để khác biệt đọc ra là thứ hạng chứ không phải một component khác | `ContinueLearning`, nơi chỉ mục học dở đầu tiên được làm nổi — chủ sở hữu: "The first resumable item is the focal task; later items remain useful but quieter" |
| Khung nhìn tồn tại để chốt một quyết định | Thẻ quyết định là thẻ được làm nổi và nằm ở rail của `PrimaryRailLayout`; mọi thứ giải thích ở lại `primary` và không làm nổi | Rail gói cước của `ProSubscriptionBlock` |

## Single-column form stack

Các ô nhập, rồi câu trạng thái, rồi một nút gửi chính — một cột, một nút gửi, đúng thứ tự ấy.

| Dùng khi | Cách ghép Grammar | Bằng chứng |
| --- | --- | --- |
| Một bước hỏi thông tin đăng nhập hoặc mã | `form` của app bọc `flex flex-col gap-4`: mỗi ô là `Input` với `label`, `placeholder`, `hint`, `errorMessage`, `isError`, `isDisabled`; rồi câu trạng thái `Text size="sm" tone="muted" live` (`assertive` khi là lời từ chối, còn lại `polite`); rồi một `Button variant="primary" type="submit" isPending` | nivo `AuthenticationPanel`, cả bước `details` lẫn bước `code`. Chủ sở hữu: "Credentials and their submit controls form one semantic unit" (`AuthenticationPanel/classNames.ts`) |
| Có những lối đi tiếp phụ | Chúng đứng sau form dưới dạng `TextAction size="sm"` trong một hàng biết xuống dòng, không bao giờ là một `Button variant="primary"` thứ hai | Hàng gửi lại/quay lại và dòng chân của `AuthenticationPanel`. Chủ sở hữu: "Secondary text actions wrap cleanly instead of overflowing" |

## Seen once, not yet an idiom

Ghi lại để không ai suy ngược chúng thành gu nhà, và để lần xuất hiện thứ hai có thể nâng chúng lên.
Một định hướng không được ghép từ bảng này; yêu cầu nào cần đúng những hình dạng ấy là một lựa chọn
dành cho chủ sở hữu.

| Cách ghép | Ở đâu | Lần thứ hai sẽ chốt điều gì |
| --- | --- | --- |
| Rail quyết định có giá: `Heading level={2}` cạnh `Badge tone="accent"`, rồi giá và kỳ hạn thành một dữ kiện có nhãn, rồi dải hành động dưới đáy | Gói cước của `ProSubscriptionBlock` | Cặp giá/kỳ hạn có phải cách nhà này nêu một khoản thu định kỳ hay không |
| `SurfaceAccordionCard depth="top"` mang nội dung giải thích phụ mà không có thẻ nào bọc ngoài | Phần công bố của `ProSubscriptionBlock` | Gấp mở có phải câu trả lời của nhà cho nội dung buộc phải có mà không buộc phải đọc hay không |
| Khối định hướng trước dải đầu tiên: breadcrumb, rồi `SectionHeader composition="context-intro" level={1}`, trong một cột `max-w-3xl` | `ProSubscriptionBlock` | Một route có mở đầu bằng định hướng thay vì bằng mặt phẳng đầu tiên hay không |
| Lối tắt qua nhà cung cấp đặt trên một `Divider` có nhãn, trước form thông tin đăng nhập | nivo `AuthenticationPanel` | Lối tắt có luôn đứng trước form hay không |
| Một `IconTile` dẫn đầu đặt cạnh khối chữ | `ContinueLearning` | Tranh định danh thuộc về bên cạnh chữ hay bên trên chữ |

Chính đề xuất của chủ sở hữu còn ghi một hình dạng nữa — một dòng mờ bổ trợ rồi tới một hành động —
với hai lần xuất hiện, và từ chối nâng nó lên ("Two instances are not a pattern yet; it stays
app-owned"). Nó ở ngoài file này cho tới khi chủ sở hữu nói khác.
