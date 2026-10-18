import { describe, expect, it } from "vitest";
import { editRequiresUnpublishForPayment, respondentQuestion, validateQuestionAnswers, type QuestionInput } from "./forms";

const question = (overrides: Partial<QuestionInput & { id: string }> = {}): QuestionInput & { id: string } => ({
  id: "00000000-0000-4000-8000-000000000001",
  type: "short_text",
  label: "Your name",
  required: false,
  settings: {},
  ...overrides,
});

describe("form answer validation", () => {
  it("rejects a missing required answer", () => {
    const result = validateQuestionAnswers([question({ required: true })], {});
    expect(result.ok).toBe(false);
    expect(result.errors["00000000-0000-4000-8000-000000000001"]).toBe("This question is required.");
  });

  it("does not require a conditional question while its rule is false", () => {
    const first = question({ type: "single_choice", label: "Interested?", options: ["yes", "no"] });
    const conditional = question({
      id: "00000000-0000-4000-8000-000000000002",
      type: "email",
      label: "Email address",
      required: true,
      logic: { whenQuestionId: first.id, operator: "equals", value: "yes" },
    });
    const result = validateQuestionAnswers([first, conditional], { [first.id]: "no" });
    expect(result.ok).toBe(true);
    expect(result.visibleQuestionIds.has(first.id)).toBe(true);
    expect(result.visibleQuestionIds.has(conditional.id)).toBe(false);
  });

  it("requires a checked value for a required checkbox", () => {
    const requiredConsent = question({ type: "checkbox", label: "I agree", required: true });
    const result = validateQuestionAnswers([requiredConsent], { [requiredConsent.id]: false });
    expect(result.ok).toBe(false);
    expect(result.errors[requiredConsent.id]).toBe("This question is required.");
  });

  it("rejects malformed email answers", () => {
    const email = question({ type: "email", label: "Email", required: true });
    const result = validateQuestionAnswers([email], { [email.id]: "not-an-email" });
    expect(result.ok).toBe(false);
    expect(result.errors[email.id]).toBe("Enter a valid email address.");
  });

  it("does not return private branching rules to respondents", () => {
    const safe = respondentQuestion({ id: "question-id", position: 0, type: "short_text", label: "Name", description: null, required: 0, settings: "{}" });
    expect(safe).not.toHaveProperty("logic");
  });

  it("requires a published form to be unpublished before adding payment", () => {
    expect(editRequiresUnpublishForPayment("published", [{ type: "payment" }])).toBe(true);
    expect(editRequiresUnpublishForPayment("draft", [{ type: "payment" }])).toBe(false);
    expect(editRequiresUnpublishForPayment("published", [{ type: "short_text" }])).toBe(false);
  });
});
