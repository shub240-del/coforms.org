# SpaceForm clone — delivery outcomes

Status legend: `[ ]` open, `[x]` complete. Mark an outcome complete only when its product behavior is implemented and there is evidence from source/diagnostics/build or a focused check.

## [x] Reference-matched public website and content

Recreate the public site at `https://spaceform.site/` as a responsive frontend, including the brand/header and navigation; homepage hero and CTAs; short-version metrics; “How it works” section and form-draft demo; feature sections for jump logic, themes, payments, response table/CSV, link/embed/QR, branding and teams; pricing cards; FAQ; CTA and footer. Provide public `/features`, `/templates`, `/pricing`, `/faq`, `/privacy`, `/terms`, and `/refund` routes, as well as `/signup` and `/login`. Match the reference’s warm off-white, black, golden-yellow, thin-rule and large-type visual language across desktop and mobile layouts.

Status: Implemented in `client/src/pages/Marketing.tsx`, `Marketing.css`, and `AppPages.tsx`; all declared public pages are present in the route manifest and compile in the production build. Billing/payment copy remains explicitly non-live.

## [ ] Persistent accounts, sessions, and workspace access

Implement email/password signup and login, secure password hashing, revocable authenticated sessions, logout, account-scoped data access, and protected dashboard routes. Provide the reference’s Google sign-in route only when configured with real provider credentials; password-reset and team-invitation email delivery must remain credential-gated. Preserve the starter’s platform OAuth identity implementation separately, and use an app-owned cookie/session that does not collide with reserved platform names. Workspace membership and seat/role rules must be persisted and enforced for the advertised team-workspace flows.

Status: Email/password accounts, hashed/revocable app sessions, protected owner-scoped APIs, logout, and state/nonce-protected Google OAuth are implemented. Google credentials and mail delivery are not configured. Workspace/member authorization, invitations, and seat/role enforcement remain open; all form access currently requires the account that owns the form.

## [ ] Persistent form builder and publication controls

Allow an authenticated owner/workspace member to create, edit, autosave, preview, reorder, duplicate, publish, unpublish, and delete their forms. Support required/optional validation, per-question settings and options, conditional skip logic, themes, custom accent/background/font, branding, and thank-you/redirect settings. Provide all 27 question types observed on signup: short text, long text, email, phone, number, URL, date, time, date-time, dropdown, single choice, multiple choice, checkbox, yes/no, rating, opinion scale, NPS, ranking, file upload, signature, image choice, address, name, matrix, hidden field, payment, and scheduling. Provider-dependent payment capture must not be represented as live without a real integration.

Status: Create/edit/autosave/reorder, 27 field types, validation, conditional logic, themes, logo URL, thank-you copy, redirect settings, and publish/unpublish are implemented. Payment-question publishing is blocked until a payment provider is connected, and adding a payment question to an already-published form is rejected until it is unpublished. Form duplication/deletion, full-form preview, workspace-member editing, and plan gating remain open.

## [ ] Public, no-login respondent experience and durable submissions

A published form must have a unique public link and be answerable without account creation. Present questions one at a time; validate entries; apply branch logic; accept supported question inputs (including managed-storage uploads); persist submitted responses and answers; and show the form’s completion or configured redirect state. Store form, question, response, answer, progress, and upload ownership data in the managed database/object storage using additive schema changes.

Status: Public one-question flow, server-side branch evaluation, per-type server validation, no-login submissions, hashed progress tokens/events, completion rate, thank-you/redirect behavior, and managed-storage file paths are implemented. File paths are bound to their form/question and response; the application does not independently verify object bytes after a signed PUT, and the managed runtime storage API has no listing/deletion operation. Payment capture remains intentionally unavailable.

## [ ] Response management, analytics, export, and sharing

Provide the owner/workspace response table, response summary and per-question/progress metrics; allow CSV export of collected responses; provide a public share link, QR code, and iframe embed snippet. Response APIs and screens must enforce form/workspace ownership, and public respondent endpoints must expose only the published form configuration needed for completion.

Status: Owner response table, per-question answer/reach counts, starts/submissions/completion rate, CSV export, share links, QR, and iframe snippet are implemented. Workspace-member access and response filtering/sorting remain open. Respondent-facing form payloads omit private branch rules.

## [ ] AI-assisted draft creation and plan presentation

Allow a user to describe a form in a sentence, request an AI-generated first draft using the built-in Manus LLM from the server, review/edit the proposed questions, and save a valid draft. Validate generated data and offer a recoverable manual-build path when the model is unavailable or output is invalid. Preserve the reference’s Starter/Pro/Team pricing and advertised plan features; gate plan-dependent app actions and clearly identify checkout/provider-dependent actions rather than claiming they are live.

Status: Server-side built-in LLM generation, structured output validation, editable drafts, and recoverable UI errors are implemented. Starter three-draft quotas, Pro/Team feature enforcement, and checkout are not implemented; pricing states billing is not live.

## [x] Runtime, route declaration, and implementation checks

Keep `GET /manus-routes.json` synchronized with all user-facing static and dynamic routes and exclude API/assets. Keep public URLs relative in Preview. With the registered TypeScript diagnostics, resolve actionable project errors and run `pnpm check`, `pnpm test`, and `pnpm build`; start the site on the configured runtime port, verify `/api/health` and the JSON route manifest, and deliver only the current Preview unless a later explicit publication request is made.

Status: TypeScript check passed; all 12 unit tests passed; production frontend/server build succeeded; the configured dev service and stable Preview origin returned HTTP 200 for `/api/health` and HTTP 200 `application/json` for `/manus-routes.json`. No publish was requested.
