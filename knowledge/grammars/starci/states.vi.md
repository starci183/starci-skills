# Field, action, state, focus và motion của StarCi Core

## Field

Business code truyền label, value, hint/error, validity, disabled state và change effect vào Common `Input` hay `OtpInput`. Core cung cấp scoped field material; không tự suy validation. Binding: [FIELD-1..4](field.vi.md), [FEEDBACK-1](../../ui/composition/feedback.vi.md) và [ACCESSIBILITY-1](../../ui/proof/accessibility.vi.md).

```tsx
<Input
  id="email"
  name="email"
  label="Email"
  value={email}
  errorMessage={error}
  isError={error !== undefined}
  onValueChange={setEmail}
/>
```

Core render kỳ vọng: một field stack có label ổn định, quan hệ description/error, material đúng theme và không có ARIA hay CSS do app tự viết.

## Destination và command

Binding: [ACTION-1..4](../../ui/composition/action.vi.md), [STATE-1](../../ui/composition/state.vi.md) và [CONTROL-STATE-1..2](control-state.vi.md).

```tsx
<TextAction href="/courses/foundations">Xem khóa học</TextAction>
<TextAction onPress={openFilters}>Bộ lọc</TextAction>
<Button type="submit" isPending={saving}>Lưu</Button>
```

`TextAction` và `Button` nhận `href` cho đích đến và `onPress` cho command; kiểu dữ liệu cấm truyền cả hai trên một phần tử, nên Style dùng chung không làm mất khác biệt semantics. Pending chỉ nằm trên initiator, giữ label, chặn lặp và settle từ application truth.

## Presentation state

Common sở hữu `neutral | affirmative | attention | negative | unavailable | pending | skeleton`, guard và state-capable prop. Core map tone/material nhìn thấy mà không bịa fact. Binding: [STATE-1..4](../../ui/composition/state.vi.md), [RENDER-TRUTH-1..4](../../ui/proof/render-truth.vi.md) và [TONE-4..5](../../ui/presentation/tone.vi.md).

Chỉ dùng `EmptyNotice` sau khi feature authority resolve truth empty/failure/unavailable. Chỉ dùng `Progress` cho progress đo được có tên; zero không phải failure và skeleton không phải progress.

## Focus và accessibility

Core giữ native DOM, label, controlled selection và focus-visible treatment của Common. `Tooltip` chỉ bổ sung. Modal focus containment/restoration tổng quát vẫn là Common gap. Binding: [ACCESSIBILITY-1..4](../../ui/proof/accessibility.vi.md), [FOCUS-1..4](../../ui/proof/focus.vi.md) và [ICON-5..6](icon.vi.md).

## Motion

Core bind family motion duration/easing và tôn trọng reduced motion. Motion chỉ truyền transition hay spatial continuity; không mang truth duy nhất, đổi DOM order hay trì hoãn operability. Binding: [MOTION-1..4](../../ui/proof/motion.vi.md).
