import { z } from "zod";

export const QUESTION_TYPES = [
  "short_text", "long_text", "email", "phone", "number", "url", "date", "time", "date_time",
  "dropdown", "single_choice", "multiple_choice", "checkbox", "yes_no", "rating", "opinion_scale",
  "nps", "ranking", "file_upload", "signature", "image_choice", "address", "name", "matrix",
  "hidden_field", "payment", "scheduling",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export function editRequiresUnpublishForPayment(status: string, questions: Array<{ type: string }>) {
  return status === "published" && questions.some(question => question.type === "payment");
}

export const questionInputSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum([...QUESTION_TYPES, "hidden"] as const),
  label: z.string().trim().min(1).max(255).optional(),
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(5000).optional().nullable(),
  required: z.boolean().default(false),
  options: z.array(z.string().max(500)).max(100).optional(),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  logic: z.object({
    questionId: z.string().uuid().optional(),
    whenQuestionId: z.string().uuid().optional(),
    operator: z.enum(["equals", "not_equals", "contains", "exists"]).optional().default("equals"),
    value: z.unknown().optional(),
  }).optional().nullable(),
}).superRefine((question, ctx) => {
  if (!question.label && !question.title) ctx.addIssue({ code: "custom", path: ["label"], message: "A question label is required." });
});
export type QuestionInput = z.infer<typeof questionInputSchema>;

const answerValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.unknown()), z.record(z.string(), z.unknown()), z.null()]);
export const answersSchema = z.record(z.string().uuid(), answerValue);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const optionsFor = (question: QuestionInput) => {
  const configured = question.options ?? question.settings?.options;
  return Array.isArray(configured) ? configured.map(String) : ["Option 1", "Option 2", "Option 3"];
};
const numberValue = (value: unknown) => typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
const dateOnlyValid = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export function validateQuestionAnswers(questions: Array<QuestionInput & { id: string }>, answers: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const visible = new Set<string>();
  for (const question of questions) {
    const rule = question.logic;
    let isVisible = true;
    if (rule) {
      const actual = answers[rule.questionId ?? rule.whenQuestionId ?? ""];
      if (rule.operator === "exists") isVisible = actual !== undefined && actual !== null && actual !== "";
      if (rule.operator === "equals") isVisible = JSON.stringify(actual) === JSON.stringify(rule.value);
      if (rule.operator === "not_equals") isVisible = JSON.stringify(actual) !== JSON.stringify(rule.value);
      if (rule.operator === "contains") isVisible = Array.isArray(actual) ? actual.some(item => String(item) === String(rule.value)) : String(actual ?? "").toLowerCase().includes(String(rule.value ?? "").toLowerCase());
    }
    if (!isVisible) continue;
    visible.add(question.id);

    const value = answers[question.id];
    const hasValue = value !== undefined && value !== null && value !== "";
    const empty = !hasValue || (Array.isArray(value) && value.length === 0) || (question.type === "checkbox" && value !== true);
    if (question.required && empty) errors[question.id] = "This question is required.";
    if (!hasValue) continue;

    const fail = (message: string) => { errors[question.id] = message; };
    const options = optionsFor(question);
    const optionSet = new Set(options);
    switch (question.type) {
      case "email":
        if (typeof value !== "string" || !z.string().email().safeParse(value).success) fail("Enter a valid email address.");
        break;
      case "phone":
        if (typeof value !== "string" || value.length > 100 || !/^[+()\d\s.-]+$/.test(value)) fail("Enter a valid phone number.");
        break;
      case "url":
        if (typeof value !== "string" || !z.string().url().safeParse(value).success) fail("Enter a valid URL.");
        break;
      case "number": {
        const n = numberValue(value);
        if (!Number.isFinite(n)) fail("Enter a valid number.");
        else if (typeof question.settings?.min === "number" && n < question.settings.min) fail(`Enter a number of at least ${question.settings.min}.`);
        else if (typeof question.settings?.max === "number" && n > question.settings.max) fail(`Enter a number no greater than ${question.settings.max}.`);
        break;
      }
      case "date":
        if (!dateOnlyValid(value)) fail("Enter a valid date.");
        break;
      case "time":
        if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)) fail("Enter a valid time.");
        break;
      case "date_time": case "scheduling":
        if (typeof value !== "string" || Number.isNaN(Date.parse(value))) fail("Enter a valid date and time.");
        break;
      case "rating": {
        const n = numberValue(value);
        if (!Number.isInteger(n) || n < 1 || n > 5) fail("Choose a rating from 1 to 5.");
        break;
      }
      case "opinion_scale": {
        const n = numberValue(value);
        const min = typeof question.settings?.min === "number" ? question.settings.min : 1;
        const max = typeof question.settings?.max === "number" ? question.settings.max : 5;
        if (!Number.isInteger(n) || n < min || n > max) fail(`Choose a value from ${min} to ${max}.`);
        break;
      }
      case "nps": {
        const n = numberValue(value);
        if (!Number.isInteger(n) || n < 0 || n > 10) fail("Choose a score from 0 to 10.");
        break;
      }
      case "dropdown": case "single_choice": case "image_choice":
        if (typeof value !== "string" || !optionSet.has(value)) fail("Choose one of the available options.");
        break;
      case "yes_no":
        if (value !== "Yes" && value !== "No") fail("Choose Yes or No.");
        break;
      case "multiple_choice": case "ranking":
        if (!Array.isArray(value) || value.some(item => typeof item !== "string" || !optionSet.has(item)) || new Set(value).size !== value.length) fail("Use only distinct available options.");
        break;
      case "checkbox":
        if (typeof value !== "boolean") fail("Choose a valid checkbox value.");
        break;
      case "matrix": {
        const rows = Array.isArray(question.settings?.rows) ? question.settings.rows.map(String) : ["Experience", "Value", "Support"];
        if (!isRecord(value) || Object.keys(value).some(row => !rows.includes(row)) || Object.values(value).some(answer => typeof answer !== "string" || !optionSet.has(answer))) fail("Complete the matrix using the available rows and options.");
        else if (question.required && rows.some(row => !(row in value))) fail("Complete every row in this matrix.");
        break;
      }
      case "file_upload":
        if (!isRecord(value) || typeof value.name !== "string" || value.name.length > 255 || typeof value.path !== "string" || !/^\/manus-storage\/spaceform\/forms\/[a-f0-9-]+\/questions\/[a-f0-9-]+\/[a-zA-Z0-9._/-]{1,512}$/.test(value.path)) fail("Choose a valid uploaded file.");
        break;
      case "signature":
        if (typeof value !== "string" || value.length > 2_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value)) fail("Provide a valid signature.");
        break;
      case "short_text": case "name": case "address": case "hidden": case "hidden_field":
        if (typeof value !== "string" || value.length > 5000) fail("Enter a valid text answer.");
        break;
      case "long_text":
        if (typeof value !== "string" || value.length > 20000) fail("Keep your answer under 20,000 characters.");
        break;
      case "payment":
        fail("Payment collection is not configured for this form.");
        break;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors, visibleQuestionIds: visible };
}

function csvCell(value: unknown): string {
  const raw = Array.isArray(value) || (value && typeof value === "object") ? JSON.stringify(value) : String(value ?? "");
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}
export function responsesToCsv(rows: Array<{ submittedAt?: Date | null; answers: Record<string, unknown> }>, columns: Array<{ id: string; label: string }>) {
  const header = ["submitted_at", ...columns.map(column => column.label)];
  return [header.map(csvCell).join(","), ...rows.map(row => [row.submittedAt?.toISOString() ?? "", ...columns.map(column => row.answers[column.id])].map(csvCell).join(","))].join("\n") + "\n";
}

export function publicQuestion(question: { id: string; position: number; type: string; label: string; description: string | null; required: number; settings: string | null; logic: string | null }) {
  return {
    id: question.id,
    position: question.position,
    type: question.type,
    label: question.label,
    description: question.description,
    required: Boolean(question.required),
    settings: parseJson(question.settings),
    logic: parseJson(question.logic),
  };
}
export function respondentQuestion(question: { id: string; position: number; type: string; label: string; description: string | null; required: number; settings: string | null }) {
  const { logic: _privateLogic, ...safeQuestion } = publicQuestion({ ...question, logic: null });
  return safeQuestion;
}
export function parseJson(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null; } catch { return null; }
}
