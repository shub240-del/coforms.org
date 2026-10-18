# SpaceForm clone — implementation plan

## Product scope and constraints

Recreate the public-facing website at `https://spaceform.site/` and implement the approved full-stack form-builder experience. The public website includes the landing page, product/features content, pricing, FAQ, templates entry, signup/login, and legal pages. The application includes account sessions, a dashboard, form creation and publishing, public respondent flows, response storage and reporting, CSV and sharing tools, and AI-assisted drafts.

The reference advertises 25 question types on the homepage and 27 on signup. Preserve the displayed homepage copy where practical, and implement 27 field types in the application. Google sign-in, password-reset/invitation email delivery, paid subscriptions, and live Stripe/Razorpay form payments depend on provider credentials and are integration-gated; the interface must not imply those services are live before configuration. Stripe/Razorpay form-payment questions can be represented and edited, but no charge is initiated until a real provider integration is deliberately configured.

## Implementation approach

Use the initialized React 19 + Vite frontend, Express server, tRPC API, Drizzle ORM, and managed MySQL database. Extend the starter rather than replacing the toolchain. Keep form and response data server-owned and tenant-scoped; the public respondent route needs no account. Use additive migrations for application tables and retain the starter's platform `users`/OAuth implementation for compatibility, while SpaceForm's selected email/Google account flow uses separate application-account records and a separate app session. Do not use the platform's reserved cookie or JWT-secret names.

The account layer will support email/password registration and login, hashed passwords using Node's built-in crypto APIs, opaque revocable sessions stored by token hash, protected tRPC procedures, logout, and account-scoped ownership checks. The session cookie will be HttpOnly, `Secure`, `SameSite=None`, and path `/` so it is eligible in the HTTPS embedded Preview. Google OAuth will be state/nonce protected and enabled only when the user's Google client credentials exist. Password reset and invitation flows will avoid disclosing whether an email account exists and expose no false success; actual delivery remains disabled until a mail provider is configured.

Persist accounts, sessions, workspaces/members, forms, question definitions, responses, answers, response progress events, and upload references. Questions store type-specific settings and visibility rules; forms store title/description, publication state, public slug, theme, font, accent/background, branding, redirect/thank-you settings, and plan metadata. Add indexes and foreign keys for owner/workspace, slug, form, response, and answer lookups. Store uploads through the managed Storage presign API and retain stable `/manus-storage/...` references with ownership metadata. Never store payment-card fields.

### Product routes

- Public marketing: `/`, `/features`, `/templates`, `/pricing`, `/faq`, `/privacy`, `/terms`, `/refund`.
- Accounts: `/signup`, `/login`, `/forgot-password`.
- Authenticated app: `/dashboard`, `/forms/new`, `/forms/:id`, `/forms/:id/responses`, and account/workspace settings as needed.
- Public forms: `/f/:slug` with no respondent login.
- API and health endpoints remain under `/api/`.

Publish a synchronized `GET /manus-routes.json` manifest before starting the dev server. Include static routes and dynamic page patterns; omit API endpoints and assets.

### Form creation and response workflow

Provide an editable form builder with autosave, question add/remove/reorder, required flags, validation, option editing, logic rules, preview, themes, accent/background/font customization, branding, and draft/publish/unpublish transitions. Implement these 27 field types: short text, long text, email, phone, number, URL, date, time, date-time, dropdown, single choice, multiple choice, checkbox, yes/no, rating, opinion scale, NPS, ranking, file upload, signature, image choice, address, name, matrix, hidden field, payment, and scheduling. Unsupported provider-dependent actions (payment capture, for example) stay clearly gated.

Published respondent pages advance one question at a time, validate the active field, apply conditional skip logic, support keyboard and touch, persist a response on submit, and show a completion/redirect state. Store responses durably. The owner dashboard provides a response table, per-question summaries and completion/progress metrics, CSV export, shareable links, QR code, and an embeddable iframe snippet. Public form slugs are unique and unguessable; form management and private responses require an authorized owner or workspace member.

AI-assisted drafting accepts a short natural-language request and calls the built-in Manus LLM server-side using `MANUS_API_URL` and `MANUS_API_KEY`. Validate generated JSON before saving; if generation is unavailable or invalid, show a recoverable error and retain the prompt so manual creation remains possible. Respect Starter's three-draft limit and show the Pro/Team upgrade entry points without pretending checkout is live.

### Frontend design

Follow the supplied reference rather than inventing a new brand direction: a quiet editorial SaaS aesthetic with warm off-white paper, near-black ink, restrained golden-yellow accents, fine separators, generous whitespace, bold large sans-serif headlines, and small monospaced labels. Recreate the compact lower-case wordmark and yellow square form icon in CSS/SVG. Use CSS-built form and dashboard mockups rather than unrelated stock imagery. Keep layouts responsive: split-panel account screens, centered marketing hero, clean pricing cards, and a left navigation/main work area for the app. Use subtle transitions only; preserve visible focus states and `prefers-reduced-motion` behavior.

- **Design movement:** Reference-matched editorial product design; minimal, tactile, and calm.
- **Core principles:** clear hierarchy, low-friction form completion, visible control over logic and styling, and readable response data.
- **Color philosophy:** warm paper and charcoal keep attention on the form; yellow signals actions and highlights without overpowering; muted gray is reserved for supporting labels.
- **Layout paradigm:** full-width editorial landing sections, split authentication panels, and a compact persistent app sidebar beside a flexible work canvas.
- **Signature elements:** yellow square form mark, marker-like highlight behind selected headline text, and thin rule/mono-label section dividers.
- **Interaction philosophy:** direct manipulation with explicit save/publish state, one-question-at-a-time respondent flow, and simple visible validation.
- **Animation:** brief opacity/position transitions on navigation and builder actions; no motion that blocks form completion; honor reduced motion.
- **Typography system:** neutral contemporary sans-serif for content and a restrained monospace face for overlines, counts, and metadata.
- **Brand essence:** a form builder for people who want clear, finishable forms and reliable responses; approachable, precise, and quietly confident.
- **Brand voice:** concise and practical; sample lines: “Forms worth finishing.” and “Write one sentence. Start with a useful first draft.”
- **Wordmark & logo:** custom lowercase wordmark paired with a small outlined form tile on a warm yellow square.
- **Signature brand color:** warm golden yellow used for the form mark, selected text highlight, and primary action cues.

## Project structure

- `client/src/pages/` — public marketing/legal pages, auth screens, dashboard, builder, response views, and public form runner.
- `client/src/components/` — reusable navigation, pricing/feature sections, field renderers, builder controls, tables, share tools, and workspace chrome.
- `client/src/lib/` — tRPC client, field registry/validation, CSV and share helpers.
- `client/src/index.css` — reference-matched design tokens, typography, responsive layout and motion rules.
- `server/_core/` — Express startup, app-session middleware, Google callback, and existing platform helpers.
- `server/` — tRPC routers, authentication, AI draft generation, upload authorization, and database operations.
- `drizzle/schema.ts` plus additive migration files — account, workspace, forms, questions, responses, answers, events, and upload records.
- `shared/` — shared validated form/field types and constants.
- `client/public/manus-routes.json` — current user-facing route manifest.
- `plan.md` and `TODO.md` — approved approach and deliverable criteria.

## Build and delivery workflow

1. Preserve the current Vite/Express/tRPC/Drizzle starter and configure no additional platform capabilities; server and database are already enabled. Inspect existing schema and retain the starter's managed configuration.
2. Before application edits, confirm the host TypeScript diagnostics registration (already registered for TypeScript); resolve actionable diagnostics as the project grows.
3. Create the route manifest and source structure, then implement the approved outcome groups with small reusable modules. Use additive Drizzle migrations and the managed database. Use built-in platform AI and Storage only through their server-side contracts.
4. Add focused unit tests for field validation, conditional logic, CSV serialization, session helpers, and route/data ownership. Run `pnpm check`, `pnpm test`, and `pnpm build`; start the development service on the configured port after meaningful content exists and verify readiness, health, and the route manifest.
5. Do not publish or enable auto-publish without a separate request. Deliver the working Preview and accurately identify any provider-gated integrations.

## Delivery status and constraints

The public reference-matched pages, owner-scoped form workflow, public submissions, server-side field/branch validation, response progress events, and runtime checks are implemented. Remaining product gaps are workspace-member authorization/invitation/seat rules, form duplication/deletion/full-form preview, and Starter/Pro/Team feature quotas. Google sign-in is implemented with state and nonce validation but requires real provider credentials; password-reset and invitation delivery require an email provider. Payment capture and checkout remain unavailable and are not represented as live. Managed file references are bound to the originating form/question and submitted response, but the app does not independently verify object bytes after upload.
