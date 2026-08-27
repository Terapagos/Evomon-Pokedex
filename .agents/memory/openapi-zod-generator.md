---
name: OpenAPI Zod generator compatibility
description: The workspace generator is pinned to a Zod version that cannot compile certain modern shortcut emitters.
---

Avoid OpenAPI `format: uri` and `type: integer` in this workspace's generated API contracts; use plain strings and numbers with application-level validation where needed.

**Why:** The current Orval/Zod output emits `zod.url()` and `zod.int()` for those schema declarations, but the installed Zod runtime does not provide those APIs, causing the post-codegen TypeScript build to fail.

**How to apply:** When extending the API specification, favor `type: string` and `type: number` unless the generated output has been confirmed compatible with the installed Zod version.