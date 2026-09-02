# Pending contrast (awaiting relocation)

Giữ nguyên văn từ `ui/color.md` đã xoá. Những rule đo tương phản này chưa có file kế thừa: `presentation/tone.md` chỉ nói rằng lỗi tương phản được sửa bằng cách đổi surface, chứ không công bố ngưỡng, ma trận theme hay yêu cầu forced colors. Đừng trích các ID này như routing hiện hành; chúng đang chờ được chuyển về đúng chủ.

## COLOR-3 — Action, destination, selection và focus khác nhau

### When

Cùng region có command, destination, persistent selection hoặc keyboard focus. Hover hay pointer
feedback tạm thời không phải persistent selection.

### Apply

- Dùng Common `Button` hoặc `TextAction` với `onPress` cho command và với `href` cho destination, `Tabs`/current prop cho selection và Common focus owner cho focus.
- Giữ non-color cue: native element/anatomy, `aria-current`, selected indicator hoặc visible focus outline.
- Chứng minh bốn state độc lập khi bỏ color và bật forced colors; đo required UI boundary tối thiểu 3:1.
- Family được recolor từng cue hiện có; application chọn destination và command consequence nhưng không merge contract.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Current tab có `aria-current`/selection anatomy và indicator 2 px. | `PASS` | Persistent selection không chỉ là accent color. |
| Inline destination không khác surrounding copy cho tới hover. | `COMMON_IMPLEMENTATION_GLITCH` | Destination thiếu persistent cue; sửa Common link appearance. |
| Focus và selection dùng cùng một fill, không outline hay state attribute. | `APP_OVERRIDE` · `WRONG_OWNER` | User không phân biệt transient focus với current state; khôi phục cả hai owner. |

## COLOR-5 — Theme và contrast đo được

### When

Family hỗ trợ light, dark, system, forced color, hover, focus, selected, disabled, pending hoặc outcome
state. Authored token value không bao giờ tự là contrast result.

### Apply

- Resolve active family/theme rồi capture computed foreground và background thật sau transparency/overlay composition.
- Yêu cầu tối thiểu 4.5:1 cho normal text, 3:1 cho large text và 3:1 cho required non-text UI/state boundary nơi WCAG tương ứng áp dụng.
- Đo mọi material state và forced-colors result; ghi token source/formula tách khỏi numeric ratio.
- Family sửa paint fail dưới scope của nó; application được chọn page canvas nhưng không che một Common pair fail.

### Examples

| Tình huống | Kết luận | Vì sao / cần làm gì |
| --- | --- | --- |
| Muted body text đo 4.7:1 ở light và 5.1:1 ở dark mode. | `PASS` | Rendered pair vượt normal-text threshold ở cả hai theme. |
| Source token trông đủ tối nhưng overlay background chưa được đo. | `PROOF_MISSING` | Formula không phải final pixel; capture computed color rồi tính ratio. |
| Selected text của offset family chỉ đạt 2.6:1 trên soft fill. | `FAMILY_OVERRIDE_GLITCH` · `VALUE_DRIFT` | Family paint fail rendered threshold; sửa scoped pair rồi retest mọi state. |
