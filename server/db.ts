import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, SfAccount, sfAccounts, sfAnswers, sfForms, sfQuestions, sfResponses, sfResponseEvents, sfSessions, sfUploads, sfWorkspaceMembers, sfWorkspaces, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) _db = drizzle(process.env.DATABASE_URL);
  return _db;
}
function requireDb() { if (!_db) throw new Error("Database is not available"); return _db; }

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const updateSet: Record<string, unknown> = { lastSignedIn: user.lastSignedIn ?? new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) if (user[field] !== undefined) updateSet[field] = user[field] ?? null;
  if (user.role !== undefined) updateSet.role = user.role; else if (user.openId === ENV.ownerOpenId) updateSet.role = "admin";
  await db.insert(users).values({ openId: user.openId, name: user.name ?? null, email: user.email ?? null, loginMethod: user.loginMethod ?? null, role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user"), lastSignedIn: user.lastSignedIn ?? new Date() }).onDuplicateKeyUpdate({ set: updateSet });
}
export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return rows[0]; }

export async function insertAccount(account: { id: string; email: string; name: string; passwordHash: string | null; provider: string; providerSubject?: string | null }) { const db = requireDb(); await db.insert(sfAccounts).values(account); const rows = await db.select().from(sfAccounts).where(eq(sfAccounts.id, account.id)).limit(1); if (!rows[0]) throw new Error("Account insert failed"); return rows[0]; }
export async function getAccountByEmail(email: string) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const rows = await db.select().from(sfAccounts).where(eq(sfAccounts.email, email)).limit(1); return rows[0]; }
export async function getAccountById(id: string) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const rows = await db.select().from(sfAccounts).where(eq(sfAccounts.id, id)).limit(1); return rows[0]; }
export async function getAccountByProviderSubject(provider: string, providerSubject: string) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const rows = await db.select().from(sfAccounts).where(and(eq(sfAccounts.provider, provider), eq(sfAccounts.providerSubject, providerSubject))).limit(1); return rows[0]; }
export async function upsertGoogleAccount(input: { subject: string; email: string; name: string }) { const existing = await getAccountByProviderSubject("google", input.subject); if (existing) return existing; const byEmail = await getAccountByEmail(input.email); if (byEmail) return byEmail; return insertAccount({ id: crypto.randomUUID(), email: input.email, name: input.name, passwordHash: null, provider: "google", providerSubject: input.subject }); }
export async function insertSession(session: { id: string; accountId: string; tokenHash: string; expiresAt: Date }) { const db = requireDb(); await db.insert(sfSessions).values(session); }
export async function getAccountBySessionHash(tokenHash: string) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const rows = await db.select({ account: sfAccounts, session: sfSessions }).from(sfSessions).innerJoin(sfAccounts, eq(sfSessions.accountId, sfAccounts.id)).where(and(eq(sfSessions.tokenHash, tokenHash), isNull(sfSessions.revokedAt))).limit(1); const row = rows[0]; return row && row.session.expiresAt > new Date() ? row.account : undefined; }
export async function revokeSessionByHash(tokenHash: string) { const db = requireDb(); await db.update(sfSessions).set({ revokedAt: new Date() }).where(eq(sfSessions.tokenHash, tokenHash)); }
export async function ensureWorkspaceForAccount(accountId: string) { const db = requireDb(); const existing = await db.select().from(sfWorkspaces).where(eq(sfWorkspaces.ownerAccountId, accountId)).limit(1); if (existing[0]) return existing[0]; const workspace = { id: crypto.randomUUID(), ownerAccountId: accountId, name: "Personal workspace" }; await db.insert(sfWorkspaces).values(workspace); await db.insert(sfWorkspaceMembers).values({ workspaceId: workspace.id, accountId, role: "owner" }); return (await db.select().from(sfWorkspaces).where(eq(sfWorkspaces.id, workspace.id)).limit(1))[0]; }
export async function getOwnedWorkspace(accountId: string) { const db = requireDb(); const rows = await db.select({ workspace: sfWorkspaces }).from(sfWorkspaces).leftJoin(sfWorkspaceMembers, eq(sfWorkspaces.id, sfWorkspaceMembers.workspaceId)).where(and(eq(sfWorkspaceMembers.accountId, accountId), eq(sfWorkspaceMembers.role, "owner"))).limit(1); return rows[0]?.workspace ?? (await db.select().from(sfWorkspaces).where(eq(sfWorkspaces.ownerAccountId, accountId)).limit(1))[0]; }

export async function listFormsForAccount(accountId: string) {
  const db = requireDb();
  const forms = await db.select().from(sfForms).where(eq(sfForms.ownerAccountId, accountId)).orderBy(desc(sfForms.updatedAt));
  if (!forms.length) return [];
  const counts = await db.select({ formId: sfResponses.formId, responseCount: sql<number>`count(*)` }).from(sfResponses).innerJoin(sfForms, eq(sfForms.id, sfResponses.formId)).where(and(eq(sfForms.ownerAccountId, accountId), eq(sfResponses.status, "submitted"))).groupBy(sfResponses.formId);
  const countByForm = new Map(counts.map(row => [row.formId, Number(row.responseCount)]));
  return forms.map(form => ({ ...form, responseCount: countByForm.get(form.id) ?? 0 }));
}
export async function getFormForAccount(id: string, accountId: string) {
  const db = requireDb();
  const rows = await db.select().from(sfForms).where(and(eq(sfForms.id, id), eq(sfForms.ownerAccountId, accountId))).limit(1);
  if (!rows[0]) return undefined;
  const totals = await db.select({ responseCount: sql<number>`count(*)` }).from(sfResponses).where(and(eq(sfResponses.formId, id), eq(sfResponses.status, "submitted")));
  return { ...rows[0], responseCount: Number(totals[0]?.responseCount ?? 0) };
}
export async function getPublishedFormBySlug(slug: string) {
  const db = requireDb();
  const rows = await db.select().from(sfForms).where(and(eq(sfForms.slug, slug), eq(sfForms.status, "published"))).limit(1);
  return rows[0];
}
export async function getQuestions(formId: string) { const db = requireDb(); return db.select().from(sfQuestions).where(and(eq(sfQuestions.formId, formId), eq(sfQuestions.archived, 0))).orderBy(asc(sfQuestions.position)); }
export async function getAllQuestions(formId: string) { const db = requireDb(); return db.select().from(sfQuestions).where(eq(sfQuestions.formId, formId)).orderBy(asc(sfQuestions.position)); }
export async function createForm(accountId: string, title: string, description?: string | null) {
  const db = requireDb();
  const workspace = await getOwnedWorkspace(accountId);
  if (!workspace) throw new Error("Workspace not found");
  const id = crypto.randomUUID();
  const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "form"}-${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  await db.insert(sfForms).values({ id, workspaceId: workspace.id, ownerAccountId: accountId, title: title.trim(), description: description ?? null, slug, theme: JSON.stringify({ accent: "#f2c84b", background: "#f7f4ed", font: "sans" }), settings: JSON.stringify({}), status: "draft" });
  return getFormForAccount(id, accountId);
}
export async function updateForm(id: string, accountId: string, patch: { title: string; description?: string | null; theme?: Record<string, unknown> | null; settings?: Record<string, unknown> | null; questions: Array<{ id?: string; type: string; label: string; description?: string | null; required: boolean; settings?: Record<string, unknown>; logic?: Record<string, unknown> | null }> }) {
  const db = requireDb();
  const saved = await db.transaction(async tx => {
    const owned = await tx.select().from(sfForms).where(and(eq(sfForms.id, id), eq(sfForms.ownerAccountId, accountId))).limit(1);
    if (!owned[0]) return false;
    await tx.update(sfForms).set({ title: patch.title.trim(), description: patch.description ?? null, theme: patch.theme ? JSON.stringify(patch.theme) : owned[0].theme, settings: patch.settings ? JSON.stringify(patch.settings) : owned[0].settings }).where(eq(sfForms.id, id));
    const activeQuestions = await tx.select({ id: sfQuestions.id }).from(sfQuestions).where(and(eq(sfQuestions.formId, id), eq(sfQuestions.archived, 0)));
    const retained = new Set<string>();
    for (const [position, question] of patch.questions.entries()) {
      const questionId = question.id ?? crypto.randomUUID();
      const values = { formId: id, position, type: question.type, label: question.label, description: question.description ?? null, required: question.required ? 1 : 0, settings: JSON.stringify(question.settings ?? {}), logic: question.logic ? JSON.stringify(question.logic) : null, archived: 0 };
      const existing = await tx.select({ id: sfQuestions.id }).from(sfQuestions).where(and(eq(sfQuestions.id, questionId), eq(sfQuestions.formId, id))).limit(1);
      if (existing[0]) await tx.update(sfQuestions).set(values).where(and(eq(sfQuestions.id, questionId), eq(sfQuestions.formId, id)));
      else await tx.insert(sfQuestions).values({ id: questionId, ...values });
      retained.add(questionId);
    }
    for (const question of activeQuestions) if (!retained.has(question.id)) await tx.update(sfQuestions).set({ archived: 1 }).where(and(eq(sfQuestions.id, question.id), eq(sfQuestions.formId, id)));
    return true;
  });
  return saved ? getFormForAccount(id, accountId) : undefined;
}
export async function setFormPublished(id: string, accountId: string, published: boolean) {
  const db = requireDb();
  await db.update(sfForms).set({ status: published ? "published" : "draft", publishedAt: published ? new Date() : null }).where(and(eq(sfForms.id, id), eq(sfForms.ownerAccountId, accountId)));
  return getFormForAccount(id, accountId);
}
export async function insertResponse(formId: string, answers: Array<{ questionId: string; value: unknown }>, metadata?: Record<string, unknown>) { const db = requireDb(); const responseId = crypto.randomUUID(); await db.insert(sfResponses).values({ id: responseId, formId, status: "submitted", metadata: JSON.stringify(metadata ?? {}), submittedAt: new Date() }); if (answers.length) await db.insert(sfAnswers).values(answers.map(answer => ({ id: crypto.randomUUID(), responseId, questionId: answer.questionId, value: JSON.stringify(answer.value) }))); return responseId; }
export async function listResponsesForAccount(formId: string, accountId: string) {
  const db = requireDb();
  const form = await getFormForAccount(formId, accountId);
  if (!form) return undefined;
  const allResponses = await db.select().from(sfResponses).where(eq(sfResponses.formId, formId)).orderBy(desc(sfResponses.startedAt));
  const responses = allResponses.filter(response => response.status === "submitted");
  const answers = responses.length ? await db.select().from(sfAnswers).where(inArray(sfAnswers.responseId, responses.map(response => response.id))) : [];
  const events = allResponses.length ? await db.select().from(sfResponseEvents).where(inArray(sfResponseEvents.responseId, allResponses.map(response => response.id))) : [];
  const views = new Map<string, Set<string>>();
  for (const event of events) if (event.eventType === "question_view" && event.questionId) { const respondents = views.get(event.questionId) ?? new Set<string>(); respondents.add(event.responseId); views.set(event.questionId, respondents); }
  return { form, responses, answers, metrics: { started: allResponses.length, submitted: responses.length, questionViews: Array.from(views, ([questionId, respondentIds]) => ({ questionId, count: respondentIds.size })) } };
}
export async function insertUpload(upload: { id: string; formId: string; key: string; url: string; contentType: string; byteSize: number }) { const db = requireDb(); await db.insert(sfUploads).values(upload); return upload; }
export async function getPublicUploadForQuestion(formId: string, questionId: string, assetPath: string) {
  const db = requireDb();
  const rows = await db.select().from(sfUploads).where(and(eq(sfUploads.formId, formId), eq(sfUploads.url, assetPath), isNull(sfUploads.responseId))).limit(1);
  const upload = rows[0];
  if (!upload || !upload.key.includes(`/questions/${questionId}/`)) return undefined;
  return upload;
}
export async function bindPublicUploadsToResponse(formId: string, responseId: string, assetPaths: string[]) {
  if (!assetPaths.length) return;
  const db = requireDb();
  await db.update(sfUploads).set({ responseId }).where(and(eq(sfUploads.formId, formId), isNull(sfUploads.responseId), inArray(sfUploads.url, assetPaths)));
}

function hashProgressToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function progressTokenMatches(metadata: string | null, token: string) {
  if (!metadata || !token) return false;
  try {
    const saved = JSON.parse(metadata) as { progressTokenHash?: unknown };
    const expected = typeof saved.progressTokenHash === "string" ? saved.progressTokenHash : "";
    const actual = hashProgressToken(token);
    return expected.length === actual.length && timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch { return false; }
}
export async function startFormResponse(formId: string) {
  const db = requireDb();
  const responseId = crypto.randomUUID();
  const progressToken = randomBytes(32).toString("base64url");
  await db.insert(sfResponses).values({ id: responseId, formId, status: "in_progress", metadata: JSON.stringify({ progressTokenHash: hashProgressToken(progressToken) }), startedAt: new Date(), submittedAt: null });
  return { responseId, progressToken };
}
export async function recordResponseQuestionView(input: { formId: string; responseId: string; progressToken: string; questionId: string }) {
  const db = requireDb();
  const response = await db.select().from(sfResponses).where(and(eq(sfResponses.id, input.responseId), eq(sfResponses.formId, input.formId), eq(sfResponses.status, "in_progress"))).limit(1);
  if (!response[0] || !progressTokenMatches(response[0].metadata, input.progressToken)) return false;
  const question = await db.select({ id: sfQuestions.id }).from(sfQuestions).where(and(eq(sfQuestions.id, input.questionId), eq(sfQuestions.formId, input.formId), eq(sfQuestions.archived, 0))).limit(1);
  if (!question[0]) return false;
  await db.insert(sfResponseEvents).values({ id: crypto.randomUUID(), responseId: input.responseId, questionId: input.questionId, eventType: "question_view", metadata: null });
  return true;
}
export async function completeFormResponse(input: { formId: string; responseId: string; progressToken: string; answers: Array<{ questionId: string; value: unknown }> }) {
  const db = requireDb();
  return db.transaction(async tx => {
    const response = await tx.select().from(sfResponses).where(and(eq(sfResponses.id, input.responseId), eq(sfResponses.formId, input.formId), eq(sfResponses.status, "in_progress"))).limit(1);
    if (!response[0] || !progressTokenMatches(response[0].metadata, input.progressToken)) return false;
    await tx.update(sfResponses).set({ status: "submitted", submittedAt: new Date() }).where(and(eq(sfResponses.id, input.responseId), eq(sfResponses.formId, input.formId), eq(sfResponses.status, "in_progress")));
    if (input.answers.length) await tx.insert(sfAnswers).values(input.answers.map(answer => ({ id: crypto.randomUUID(), responseId: input.responseId, questionId: answer.questionId, value: JSON.stringify(answer.value) })));
    return true;
  });
}
