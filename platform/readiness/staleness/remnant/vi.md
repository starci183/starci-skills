---
title: Trust-tree remnant
---

# Trust-tree remnant

## LOADS

None.

## Dấu hiệu stale

Target checkout được current route resolve chứa `.claude/` nested từ Source cũ. Module này không search
repository ngoài route.

## Evidence cho stale list

Count file recursive và hỏi Git file nào tracked. Report path, total file và tracked file. Shallow listing
không phải evidence; content populated hoặc tracked không bao giờ được gọi là safe to delete.

## Inventory cho repair

Hai fact phải cùng đúng: mọi file untracked bởi target repository và directory chỉ có empty path hoặc file
không law hiện tại nào gọi tên. Nếu không, trả owner decision; đó có thể là project config thật hoặc Source khác.

## Apply

Sau exact destructive approval, chỉ xóa remnant đã verify trong pass/commit riêng. Không edit hoặc delete
tracked content. Ghi `removed`, không ghi `repaired`.

## Proof

In recursive count trước, absolute target đã approve và count sau. Removal commit không chứa pass khác.
