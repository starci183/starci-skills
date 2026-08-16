---
title: Cart checkout has no voucherCode wiring (course-scoping undecided)
role: be
state: open
cost: medium
opened: 2026-08-03
rule: payment-modifier-capability-model
paths: [src/features/api/core/graphql/mutations/courses/courses-checkout/graphql-types/request.ts, src/features/api/core/graphql/mutations/courses/courses-checkout/courses-checkout.handler.ts, src/features/api/core/graphql/mutations/courses/courses-checkout/courses-checkout-pricing.service.ts]
---

## What is wrong

Cart checkout has no voucherCode wiring (course-scoping undecided)

## Why it was left

CourseVoucherEntity.reserve()/previewDiscount() are scoped to ONE courseId; the cart checkout (courses-checkout) prices and pays for MULTIPLE course lines in one transaction via CoursesCheckoutPricingService, and the 2026-08-04 capability-model design decision only settled the currency-gating rule (Percent everywhere, Flat VND-only, installment VND-only) — it never decided which cart LINE a course-scoped voucher discounts, or how an unscoped (course:null) voucher should divide across lines vs applying to the order total. Wiring voucherCode onto CoursesCheckoutRequest without that design call would mean inventing cart-voucher semantics on the spot inside an unrelated capability-gating task, so single-course course-enroll got the full fix (matrix gate + USD percent wiring) and cart checkout was left as-is rather than half-wired.

## What paying it looks like

Decide (with the transactions/rewards domain owner) which cart line a course-scoped voucher discounts (first matching line? cheapest? explicit courseId param alongside voucherCode?) and how an unscoped voucher divides across lines, then add voucherCode to CoursesCheckoutRequest, gate it through PAYMENT_MODIFIER_CAPABILITY the same way course-enroll.handler.ts does, and reserve/settle it inside the same db transaction courses-checkout.handler.ts already opens for the order + transaction_items rows.

## Notes

See .artifacts/states/transactions/business.md § "Payment-modifier capability model (design decision 2026-08-04)" and findings.md #3 for the parent design; this entry is the cart-specific carve-out from that decision.
