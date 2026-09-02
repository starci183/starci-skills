# Lỗi

Tệp này trả lời một câu hỏi: cho một thất bại trong frontend, nó được biểu diễn ra sao và đi về
đâu?

Nguồn: `src/components/blocks/**/component.tsx`, `blocks/commerce/CartBlock/index.spec.tsx`,
`src/modules/toast/api.ts`, `src/modules/api/graphql/types.ts`, `src/hooks/swr/*`,
`packages/grammar/src/common/conformance.ts`.

## FE-ERROR-1 — Thất bại là một trạng thái của nửa thuần

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Trường hợp chung | `"failed"` là một thành viên của union trạng thái block trong 219 tệp `component.tsx`; nửa nối ánh xạ `error` của SWR sang nó và nửa thuần vẽ nó |
| Case 2 | Nhiều nguồn thất bại | `"sessionsFailed" \| "historyFailed" \| "streamFailed" \| "quotaRejected"` trong `StarCiAiChatState`; `const stateNeedsRetry = (state) => state === "sessionsFailed" \|\| state === "historyFailed" \|\| state === "streamFailed" \|\| state === "quotaRejected"` |
| Case 3 | Câu chữ thất bại | được nửa nối giải vào `labels.states[props.state]` và vẽ như một lượt trợ lý: `{ id: \`state-${props.state}\`, role: "assistant", body: labels.states[props.state] }` |
| Case 4 | Thử lại | một hành động trên `on`: `<Button variant="primary" size="sm" onPress={props.on?.retry}>{labels.retry}</Button>` |
| Case 5 | Spec nửa nối | khẳng định phép ánh xạ: `mocks.cart.isLoading = true … expect(mocks.input?.blockState).toBe("pending")` |

## FE-ERROR-2 — Phong bì GraphQL

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Mọi phản hồi | `{ success, message, error, data }` được chọn trong từng tài liệu (`query Course … { success message error data { … } }`) và định kiểu `GraphQLResponse<T>` trong `modules/api/graphql/types.ts` |
| Case 2 | Hook đọc bóc phong bì | `return result.data?.course?.data ?? null` — thiếu payload thành dữ liệu `null`, không ném |
| Case 3 | Ghi có phản hồi | `runGraphQLWithToast(action, options): Promise<boolean>` — thực thi một lệnh ghi GraphQL và làm nổi cả thất bại vận chuyển lẫn thất bại trong phong bì có kiểu |
| Case 4 | Câu chữ mặc định có bản địa hóa | `const DEFAULT_MESSAGES: ToastMessages = { successTitle: "Success", errorTitle: "Error", unauthorizedTitle: "Unauthorized", … }` ghi đè theo từng lần gọi qua `messages` |

## FE-ERROR-3 — `throw new Error` nơi im lặng sẽ là sai

52 chỗ `throw new Error(…)` tồn tại trong `src/` (không kể spec). Chúng đánh dấu một kết quả mà mã
không thể tiếp tục nếu thiếu.

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Payload rỗng ở lượt đọc bắt buộc | `if (value === undefined) throw new Error("Course Community returned no data")` |
| Case 2 | Mutation không trả gì | `if (result === null) throw new Error("Flashcard review completion returned no result")` |
| Case 3 | Khe dùng ngoài chủ sở hữu | `if (value === undefined) throw new Error("CourseFoundationCategoryBlock slots must be rendered inside CourseFoundationCategoryBlockBase")` |
| Case 4 | Ngoại tuyến | `throw new Error("offline")` bên trong một fetcher để SWR ghi nhận `error` |
| Case 5 | Lớp tùy chỉnh | có đúng một: `class PersonalProjectEnrollmentDeniedError extends Error` trong `useQueryPersonalProjectTaskWorkspaceSwr.ts`; không phải mẫu |

## FE-ERROR-4 — Lan truyền

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Bên trong hook | không bắt; SWR lưu nó và nửa nối đọc `query.error` (`catch (` xuất hiện trong 3 tệp toàn `src/`) |
| Case 2 | Bên trong hành động ghi | `runGraphQLWithToast` trả `false` và hiện toast; bên gọi lật một state cục bộ (`payment.hasFailed`) |
| Case 3 | Sập khi vẽ | `src/app/global-error.tsx` |
| Case 4 | Đo xa | `src/config/sentry.ts`, `src/instrumentation.ts`, `instrumentation-client.ts` |

## FE-ERROR-5 — Gói Grammar

| Case | Dùng khi | Viết |
| --- | --- | --- |
| Case 1 | Định nghĩa không hợp lệ lúc khởi tạo module | `throw new TypeError(\`Invalid ${definition.familyId} Grammar conformance: missing=[…], unknown=[…]\`)` trong `defineGrammarRuleConformance` |
| Case 2 | Giá trị từ vựng không hợp lệ | `assertPresentationState("unknown")` ném `TypeError` (`common/index.test.mjs`) |

## Câu hỏi để ngỏ

Có nên thay `throw new Error("…")` bằng một lớp lỗi có kiểu cho các trường hợp "không có dữ liệu"
hay không: một lớp tùy chỉnh so với 52 lần ném trần, nên dạng trần là điều mã đang làm hôm nay.
