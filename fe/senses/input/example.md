---
id: fe-senses-input-example
title: example.md
slug: /fe/senses/input/example
sidebar_label: example.md
sidebar_position: 3
description: StarCi Academy Input cases with UI and code.
---

# example.md

> Version: `1.03` · Module: `input` · Guide: [`vi.md`](./vi.md) · Tests: [`prompt.md`](./prompt.md)

## Example Index

| Case | Compiler answer |
|---|---|
| Ordinary form field | `Field`, component-owned treatment |
| Kinds | Behavior mapping, no decorative glyph |
| Password reveal | Intrinsic accessible operation |
| Search context | Named search owner |
| Help/error | Field contract |
| Disabled/display-only | Different jobs, no fake read-only Input |
| Direct action | Field and Button peers |
| Pending validation | Named owner required |

## Cases

### Ordinary field on a bounded surface

**Dùng khi:** labelled email/title remains an editable value.  
**Không dùng khi:** caller wants a second visual field variant because the card feels loud.

<CodeUiTabs example="input-bounded-ground" />

### Ordinary field on a page

**Dùng khi:** the same Field contract is placed by a page/form owner.  
**Không dùng khi:** page ground is used to expose a caller-controlled variant.

<CodeUiTabs example="input-open-ground" />

### Kind changes behavior

**Dùng khi:** email, secret, new secret, OTP or ordinary text behavior is known.  
**Không dùng khi:** kind is inferred from an icon or decoration.

<CodeUiTabs example="input-kind-not-decoration" />

### Password visibility

**Dùng khi:** show/hide is a separately named observable operation.  
**Không dùng khi:** a decorative eye icon has no accessible name.

<CodeUiTabs example="input-password-visibility" />

### Search/value context

**Dùng khi:** context is intrinsic to a named owner such as SearchBox.  
**Không dùng khi:** caller invents currency/protocol prefix on generic Input.

<CodeUiTabs example="input-value-context" />

### Help and error

**Dùng khi:** label, hint and invalid message form one Field contract.  
**Không dùng khi:** only border colour changes.

<CodeUiTabs example="input-help-error" />

### Disabled versus display-only

**Dùng khi:** disabled is temporary inability to edit; display-only uses a reading component.  
**Không dùng khi:** unsupported `readOnly` is fabricated on Input.

<CodeUiTabs example="input-disabled-readonly" />

### Direct action

**Dùng khi:** email entry and “Mời học viên” are two peer operations in one named owner.  
**Không dùng khi:** the button is disguised as a suffix.

<CodeUiTabs example="input-direct-action" />

### Pending validation

**Dùng khi:** a named composite defines whether typing stays enabled and how result is announced.  
**Không dùng khi:** generic Input is given an invented pending-validation appearance.

<CodeUiTabs example="input-pending-validation" />

## Boundary Matrix

| Business | Output |
|---|---|
| Email đăng nhập | `Field kind=email` |
| Mật khẩu hiện tại | `Field kind=password` + reveal labels |
| OTP | `Field kind=code` |
| Search toolbar | `SearchBox` |
| Navbar opens search | `PressableInputLike` |
| Global result combobox | `SearchCommandField` |
| ID chỉ đọc | Display component; not Input |
| Currency/date/generic suffix | `INSUFFICIENT CONTEXT` |
