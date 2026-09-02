# Dùng StarCi Core

## Import

Renderer và prop type luôn đến từ Common:

```tsx
import { Sidebar, TextAction, WorkspaceShell } from "@starci/grammar/common"
import { CoreGrammarRoot } from "@starci/grammar/core"
import "@starci/grammar/core/styles.css"
```

Dùng `Link` cho destination và `Button` hoặc `TextAction` cho command cùng context ([ACTION-3](../../ui/composition/action.vi.md)). Không dựng lại TextLink, ActionLink, NavLink, SeeMoreLink, Sidebar local hay shell geometry.

## Chọn root

```tsx
<CoreGrammarRoot theme="system">
  <ProductAdapter />
</CoreGrammarRoot>
```

Root cài family scope và visual DNA. Common props, semantic state, accessibility và ownership không đổi. Chỉ chọn family một lần tại composition root.

## Product adapter

Product adapter được map route, permission, copy, selected state, persistence và callback vào Common props. Nó không được sở hữu geometry dùng lại.

Vì vậy `LearnShellLayout` chỉ hợp lệ trong StarCi product code: nó map learning route/state vào Common `WorkspaceShell`, `Sidebar`, `Tabs` hay `Subnav` vô danh. Chính chữ “Learn” là lý do nó không nằm trong Grammar. Nivo áp dụng cùng luật cho mọi adapter mang tên Console.

## Family factory

`defineGrammarFamily` và `COMMON_GRAMMAR_COMPONENTS` public từ Common. Family chỉ được thay renderer có cùng prop/meaning/accessibility contract và chỉ thêm extension không đụng tên. `scopeProps` là family scope contract duy nhất.

## Cấm

- import renderer từ `@starci/grammar/core`;
- clone Common component hay anonymous layout trong app;
- tên product trong public export Grammar;
- business decision, route effect hay persistence trong Common/Core;
- import hơn một sibling family stylesheet vào cùng root.
