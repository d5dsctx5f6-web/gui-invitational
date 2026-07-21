# engine

Pure TypeScript scoring engine: `(events, courseSetups, config) → derived state`.

No framework imports in this directory, ever — no Next.js, no React, no I/O. Enforced by
`eslint.config.mjs` (`no-restricted-imports` on this path). Everything the engine needs comes in
as plain arguments; everything it produces is a plain return value.
