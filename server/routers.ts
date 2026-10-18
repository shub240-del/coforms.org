import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { publicAccount, SPACEFORM_SESSION_COOKIE, createAppSession, googleConfiguration, loginAccount, revokeAppSession, signupAccount } from "./auth";
import { generateDraft } from "./ai";
import { bindPublicUploadsToResponse, completeFormResponse, createForm, getFormForAccount, getPublicUploadForQuestion, getPublishedFormBySlug, getQuestions, getAllQuestions, listFormsForAccount, listResponsesForAccount, recordResponseQuestionView, setFormPublished, startFormResponse, updateForm } from "./db";
import { answersSchema, editRequiresUnpublishForPayment, parseJson, publicQuestion, questionInputSchema, respondentQuestion, responsesToCsv, validateQuestionAnswers } from "./forms";
import { preparePublicUpload } from "./uploads";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

const accountInput = z.object({ name: z.string().trim().min(1).max(160), email: z.string().email().max(320), password: z.string().min(12).max(200) });
const safeHttpsUrl = (value: string) => { try { return new URL(value).protocol === "https:"; } catch { return false; } };
const redirectUrlInput = z.string().trim().max(2048).refine(value => value === "" || (value.startsWith("/") && !value.startsWith("//")) || safeHttpsUrl(value), "Use a same-site path or a secure HTTPS URL.");
const logoUrlInput = z.string().trim().max(2048).refine(value => value === "" || safeHttpsUrl(value), "Use a secure HTTPS image URL.");
const formSettingsInput = z.object({ thankYouText: z.string().trim().max(500).optional(), redirectUrl: redirectUrlInput.optional(), logoUrl: logoUrlInput.optional() });
const formUpdateInput = z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(255), description: z.string().max(5000).nullable().optional(), questions: z.array(questionInputSchema).max(100), theme: z.record(z.string(), z.unknown()).nullable().optional(), settings: formSettingsInput.optional() });
function setAppCookie(res: any, token: string, expiresAt: Date) { res.cookie(SPACEFORM_SESSION_COOKIE, token, { ...getSessionCookieOptions(res.req), maxAge: Math.max(0, expiresAt.getTime() - Date.now()) }); }
function publicForm(form: any, questions: any[], includeLogic = true) { return { id: form.id, title: form.title, description: form.description, slug: form.slug, status: form.status, theme: parseJson(form.theme), settings: parseJson(form.settings), ...(form.responseCount === undefined ? {} : { responseCount: Number(form.responseCount) }), questions: questions.map(question => includeLogic ? publicQuestion(question) : respondentQuestion(question)) }; }
function responseData(result: any) { const answersByResponse = new Map<string, Record<string, unknown>>(); for (const answer of result.answers) { const values = answersByResponse.get(answer.responseId) ?? {}; try { values[answer.questionId] = answer.value ? JSON.parse(answer.value) : null; } catch { values[answer.questionId] = answer.value; } answersByResponse.set(answer.responseId, values); } return answersByResponse; }

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.appUser ? publicAccount(ctx.appUser) : null),
    googleEnabled: publicProcedure.query(() => ({ enabled: googleConfiguration(), message: googleConfiguration() ? "Google sign-in is configured." : "Google sign-in is unavailable until Google credentials are configured." })),
    signup: publicProcedure.input(accountInput).mutation(async ({ input, ctx }) => { try { const account = await signupAccount(input.name, input.email, input.password); const session = await createAppSession(account.id); setAppCookie(ctx.res, session.token, session.expiresAt); return publicAccount(account); } catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Unable to create account." }); } }),
    login: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => { try { const account = await loginAccount(input.email, input.password); const session = await createAppSession(account.id); setAppCookie(ctx.res, session.token, session.expiresAt); return publicAccount(account); } catch (error) { throw new TRPCError({ code: "UNAUTHORIZED", message: error instanceof Error ? error.message : "Invalid email or password." }); } }),
    requestPasswordReset: publicProcedure.input(z.object({ email: z.string().email() })).mutation(async () => ({ status: "unavailable" as const, message: "Password reset email delivery is not configured; no email was sent." })),
    logout: publicProcedure.mutation(async ({ ctx }) => { if (ctx.appSessionToken) { await revokeAppSession(ctx.appSessionToken); } const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); ctx.res.clearCookie(SPACEFORM_SESSION_COOKIE, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  forms: router({
    list: protectedProcedure.query(({ ctx }) => listFormsForAccount(ctx.appUser.id)),
    create: protectedProcedure.input(z.object({ title: z.string().trim().min(1).max(255), description: z.string().max(5000).optional() })).mutation(({ ctx, input }) => createForm(ctx.appUser.id, input.title, input.description)),
    get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ ctx, input }) => { const form = await getFormForAccount(input.id, ctx.appUser.id); if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found." }); return publicForm(form, await getQuestions(form.id)); }),
    update: protectedProcedure.input(formUpdateInput).mutation(async ({ ctx, input }) => {
      const normalized = { ...input, questions: input.questions.map(question => ({ ...question, type: question.type === "hidden" ? "hidden_field" : question.type, label: question.label ?? question.title ?? "", settings: { ...(question.settings ?? {}), ...(question.options ? { options: question.options } : {}) }, logic: question.logic ? { ...question.logic, questionId: question.logic.questionId ?? question.logic.whenQuestionId } : null })) };
      const owned = await getFormForAccount(input.id, ctx.appUser.id);
      if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found." });
      if (editRequiresUnpublishForPayment(owned.status, normalized.questions)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Unpublish this form before adding a payment question. Payment processing is not configured." });
      const form = await updateForm(input.id, ctx.appUser.id, normalized);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found." });
      return publicForm(form, await getQuestions(form.id));
    }),
    setPublished: protectedProcedure.input(z.object({ id: z.string().uuid(), published: z.boolean() })).mutation(async ({ ctx, input }) => {
      const owned = await getFormForAccount(input.id, ctx.appUser.id);
      if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found." });
      const questions = await getQuestions(owned.id);
      if (input.published && questions.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Add at least one question before publishing." });
      if (input.published && questions.some(question => question.type === "payment")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Payment questions cannot be published until a payment provider is connected." });
      const form = await setFormPublished(input.id, ctx.appUser.id, input.published);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found." });
      return publicForm(form, await getQuestions(form.id));
    }),
    bySlug: publicProcedure.input(z.object({ slug: z.string().min(8).max(96).regex(/^[a-z0-9-]+$/) })).query(async ({ input }) => {
      const form = await getPublishedFormBySlug(input.slug);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Published form not found." });
      return publicForm(form, await getQuestions(form.id), false);
    }),
    start: publicProcedure.input(z.object({ slug: z.string().min(8).max(96).regex(/^[a-z0-9-]+$/) })).mutation(async ({ input }) => {
      const form = await getPublishedFormBySlug(input.slug);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Published form not found." });
      return startFormResponse(form.id);
    }),
    progress: publicProcedure.input(z.object({ slug: z.string().min(8).max(96), responseId: z.string().uuid(), progressToken: z.string().min(32).max(100), questionId: z.string().uuid() })).mutation(async ({ input }) => {
      const form = await getPublishedFormBySlug(input.slug);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Published form not found." });
      const recorded = await recordResponseQuestionView({ formId: form.id, responseId: input.responseId, progressToken: input.progressToken, questionId: input.questionId });
      if (!recorded) throw new TRPCError({ code: "BAD_REQUEST", message: "This response session is no longer active." });
      return { success: true };
    }),
    visible: publicProcedure.input(z.object({ slug: z.string().min(8).max(96), answers: answersSchema })).mutation(async ({ input }) => {
      const form = await getPublishedFormBySlug(input.slug);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Published form not found." });
      const questions = await getQuestions(form.id);
      const normalizedQuestions = questions.map(question => ({ ...question, required: Boolean(question.required), settings: parseJson(question.settings) ?? {}, logic: parseJson(question.logic) }));
      const result = validateQuestionAnswers(normalizedQuestions as any, input.answers);
      return { questionIds: Array.from(result.visibleQuestionIds) };
    }),
    prepareUpload: publicProcedure.input(z.object({ slug: z.string().min(8).max(96), questionId: z.string().uuid(), fileName: z.string().min(1).max(255), mimeType: z.string().min(1).max(160), size: z.number().int().positive() })).mutation(async ({ input }) => { const form = await getPublishedFormBySlug(input.slug); if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Published form not found." }); const question = (await getQuestions(form.id)).find(item => item.id === input.questionId); if (!question || question.type !== "file_upload") throw new TRPCError({ code: "BAD_REQUEST", message: "This question does not accept files." }); try { return await preparePublicUpload({ formId: form.id, questionId: question.id, fileName: input.fileName, mimeType: input.mimeType, size: input.size }); } catch (error) { throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "Uploads are unavailable." }); } }),
    submit: publicProcedure.input(z.object({ slug: z.string().min(8).max(96), responseId: z.string().uuid(), progressToken: z.string().min(32).max(100), answers: answersSchema })).mutation(async ({ input }) => {
      const form = await getPublishedFormBySlug(input.slug);
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Published form not found." });
      const questions = await getQuestions(form.id);
      const normalizedQuestions = questions.map(question => ({ ...question, required: Boolean(question.required), settings: parseJson(question.settings) ?? {}, logic: parseJson(question.logic) }));
      const validation = validateQuestionAnswers(normalizedQuestions as any, input.answers);
      if (!validation.ok) throw new TRPCError({ code: "BAD_REQUEST", message: "Please review the answers and try again.", cause: validation.errors });
      const visible = validation.visibleQuestionIds;
      const answerRows = Object.entries(input.answers).filter(([questionId]) => visible.has(questionId)).map(([questionId, value]) => ({ questionId, value }));
      const uploadedPaths: string[] = [];
      for (const question of questions) {
        if (question.type !== "file_upload" || !visible.has(question.id)) continue;
        const value = input.answers[question.id];
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const assetPath = (value as Record<string, unknown>).path;
        if (typeof assetPath !== "string") continue;
        const upload = await getPublicUploadForQuestion(form.id, question.id, assetPath);
        if (!upload) throw new TRPCError({ code: "BAD_REQUEST", message: "This file does not belong to the selected question. Please upload it again." });
        uploadedPaths.push(assetPath);
      }
      const completed = await completeFormResponse({ formId: form.id, responseId: input.responseId, progressToken: input.progressToken, answers: answerRows });
      if (!completed) throw new TRPCError({ code: "BAD_REQUEST", message: "This response session has expired or was already submitted." });
      await bindPublicUploadsToResponse(form.id, input.responseId, uploadedPaths);
      const redirectCandidate = parseJson(form.settings)?.redirectUrl;
      return { responseId: input.responseId, status: "submitted" as const, redirectUrl: typeof redirectCandidate === "string" && redirectCandidate ? redirectCandidate : null };
    }),
    responses: protectedProcedure.input(z.object({ formId: z.string().uuid() })).query(async ({ ctx, input }) => { const result = await listResponsesForAccount(input.formId, ctx.appUser.id); if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found." }); const map = responseData(result); return { form: { id: result.form.id, title: result.form.title, slug: result.form.slug }, questions: (await getAllQuestions(input.formId)).map(publicQuestion), responses: result.responses.map(response => ({ id: response.id, status: response.status, submittedAt: response.submittedAt, answers: map.get(response.id) ?? {} })), metrics: { total: result.metrics.submitted, submitted: result.metrics.submitted, started: result.metrics.started, completionRate: result.metrics.started ? Math.round(result.metrics.submitted / result.metrics.started * 100) : 0, questionViews: result.metrics.questionViews } }; }),
    responsesCsv: protectedProcedure.input(z.object({ formId: z.string().uuid() })).query(async ({ ctx, input }) => { const result = await listResponsesForAccount(input.formId, ctx.appUser.id); if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found." }); const map = responseData(result); const questions = await getAllQuestions(input.formId); return responsesToCsv(result.responses.map(response => ({ submittedAt: response.submittedAt, answers: map.get(response.id) ?? {} })), questions.map(question => ({ id: question.id, label: question.label }))); }),
  }),
  ai: router({ generate: protectedProcedure.input(z.object({ prompt: z.string().trim().min(3).max(2000) })).mutation(async ({ input }) => { try { return await generateDraft(input.prompt); } catch (error) { throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "AI drafting failed. Try a manual draft instead." }); } }) }),
});
export type AppRouter = typeof appRouter;
