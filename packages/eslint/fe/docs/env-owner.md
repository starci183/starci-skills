# Environment owner

Law module: `env-owner.mjs`. Catalogue: R49 FE_ENV_OWNER.

The environment is read in exactly one place, `modules/config`, and nothing there has a literal default that stands in for a real deployment value. A missing production variable must fail when the config module loads, not point production at a developer's machine.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/no-env-outside-config`

`process.env` and `import.meta.env` are read only in `modules/config`.

**Invalid** (`src/hooks/session/useSession.ts`)

```ts
const url = process.env.API_URL
```

**Valid** (`src/hooks/session/useSession.ts`)

```ts
import { config } from "@/modules/config"
const url = config.apiUrl
```

**Finding code:** `FE_ENV_OWNER`

**Vì sao (why):** `<file>` đọc biến môi trường. Chỉ `modules/config` được đọc env.

**Cách sửa:** Đọc giá trị từ export có kiểu của `modules/config` thay vì `process.env`.

## `starci-fe/no-hardcoded-endpoint-fallback`

No URL literal as a fallback, and no literal default for an address or secret variable.

**Invalid** (`src/modules/config/env.ts`)

```ts
const url = process.env.API_URL ?? "http://localhost:3068"
```

**Valid** (`src/modules/config/env.ts`)

```ts
const url = process.env.API_URL
```

**Finding code:** `FE_ENV_OWNER`

**Vì sao (why):** `<file>` có giá trị dự phòng cứng cho địa chỉ hoặc bí mật (`?? "http://localhost…"`). Thiếu biến ở production phải ném lỗi khi nạp cấu hình, không được lặng lẽ trỏ về máy dev.

**Cách sửa:** Xóa giá trị dự phòng; để `modules/config` ném lỗi khi thiếu biến ở production.
