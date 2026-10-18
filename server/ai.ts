import { invokeLLM, listLLMModels } from "./_core/llm";
import { QUESTION_TYPES, questionInputSchema } from "./forms";

const draftSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: QUESTION_TYPES.map(type => type === "hidden_field" ? "hidden" : type) },
          label: { type: "string" },
          description: { type: "string" },
          required: { type: "boolean" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["type", "label", "description", "required", "options"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "description", "questions"],
  additionalProperties: false,
} as const;

async function selectAvailableModel() {
  const catalog = await listLLMModels();
  const available = new Set(catalog.data.map(model => model.id));
  const configured = process.env.MANUS_LLM_MODEL;
  if (configured) {
    if (!available.has(configured)) throw new Error("The configured AI model is not available in the current Manus model catalog.");
    return configured;
  }
  if (available.has("gpt-5-mini")) return "gpt-5-mini";
  const gpt = catalog.data.find(model => model.id.startsWith("gpt-5"))?.id;
  const fallback = gpt ?? catalog.data[0]?.id;
  if (!fallback) throw new Error("No AI drafting models are available right now.");
  return fallback;
}

function parseJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned) as unknown; }
  catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    throw new Error("AI returned invalid JSON.");
  }
}

export async function generateDraft(prompt: string) {
  const response = await invokeLLM({
    model: await selectAvailableModel(),
    messages: [
      { role: "system", content: "Create a useful, concise form draft. Use suitable question types, keep the wording clear, and return only data matching the requested schema." },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_schema", json_schema: { name: "spaceform_draft", strict: true, schema: draftSchema } },
  });
  const proxyError = (response as unknown as { error?: string | { message?: string } }).error;
  if (proxyError) throw new Error(typeof proxyError === "string" ? proxyError : proxyError.message || "AI drafting failed.");
  const content = response.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content) throw new Error("AI returned no draft. Try again or create the form manually.");
  const parsed = parseJson(content);
  const object = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  if (!object || typeof object.title !== "string" || typeof object.description !== "string" || !Array.isArray(object.questions)) throw new Error("AI draft did not match the expected form shape.");
  const questions = object.questions.map(item => questionInputSchema.parse(item));
  return { title: object.title.trim().slice(0, 255), description: object.description.trim().slice(0, 5000), questions };
}
