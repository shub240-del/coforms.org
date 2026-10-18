import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft, ArrowRight, BarChart3, Check, ChevronDown, ChevronLeft, ChevronRight,
  Clipboard, Copy, Download, ExternalLink, Eye, FilePlus2, FileText, GripVertical,
  LayoutDashboard, Link2, LoaderCircle, LogOut, Mail, Menu, MoreHorizontal,
  Palette, Plus, Settings2, Share2, Sparkles, Trash2, Upload, WandSparkles, X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import "./AppPages.css";

type FieldType =
  | "short_text" | "long_text" | "email" | "phone" | "number" | "url" | "date" | "time"
  | "date_time" | "dropdown" | "single_choice" | "multiple_choice" | "checkbox" | "yes_no"
  | "rating" | "opinion_scale" | "nps" | "ranking" | "file_upload" | "signature" | "image_choice"
  | "address" | "name" | "matrix" | "hidden" | "payment" | "scheduling";

type Question = {
  id: string;
  type: FieldType;
  title: string;
  description?: string | null;
  required?: boolean;
  options?: string[];
  settings?: Record<string, any>;
  logic?: { whenQuestionId?: string; operator?: "equals" | "not_equals"; value?: string } | null;
};
type Theme = { accent?: string; background?: string; font?: string; radius?: string };
type FormDoc = {
  id: string | number;
  title: string;
  description?: string | null;
  slug?: string | null;
  published?: boolean;
  isPublished?: boolean;
  status?: string;
  questions: Question[];
  theme?: Theme;
  settings?: { thankYouText?: string; redirectUrl?: string; logoUrl?: string };
  responseCount?: number;
  updatedAt?: string | Date;
};

const FIELD_TYPES: { type: FieldType; name: string; group: string }[] = [
  { type: "short_text", name: "Short text", group: "Text" },
  { type: "long_text", name: "Long text", group: "Text" },
  { type: "email", name: "Email", group: "Text" },
  { type: "phone", name: "Phone", group: "Text" },
  { type: "number", name: "Number", group: "Text" },
  { type: "url", name: "Website", group: "Text" },
  { type: "date", name: "Date", group: "Date & time" },
  { type: "time", name: "Time", group: "Date & time" },
  { type: "date_time", name: "Date and time", group: "Date & time" },
  { type: "dropdown", name: "Dropdown", group: "Choices" },
  { type: "single_choice", name: "Multiple choice", group: "Choices" },
  { type: "multiple_choice", name: "Checkboxes", group: "Choices" },
  { type: "checkbox", name: "Consent checkbox", group: "Choices" },
  { type: "yes_no", name: "Yes / no", group: "Choices" },
  { type: "rating", name: "Rating", group: "Rating" },
  { type: "opinion_scale", name: "Opinion scale", group: "Rating" },
  { type: "nps", name: "NPS", group: "Rating" },
  { type: "ranking", name: "Ranking", group: "Choices" },
  { type: "file_upload", name: "File upload", group: "More" },
  { type: "signature", name: "Signature", group: "More" },
  { type: "image_choice", name: "Picture choice", group: "Choices" },
  { type: "address", name: "Address", group: "Contact" },
  { type: "name", name: "Name", group: "Contact" },
  { type: "matrix", name: "Matrix", group: "Choices" },
  { type: "hidden", name: "Hidden field", group: "More" },
  { type: "payment", name: "Payment", group: "More" },
  { type: "scheduling", name: "Scheduling", group: "Date & time" },
];

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => { const random = Math.random() * 16 | 0; return (character === "x" ? random : (random & 3 | 8)).toString(16); });
}
function displayDate(date?: string | Date) {
  if (!date) return "Just now";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "Just now" : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function prettyStatus(form: any) {
  return form?.published || form?.isPublished || form?.status === "published" ? "Published" : "Draft";
}
function normalizeForm(data: any): FormDoc | null {
  const form = data?.form ?? data;
  if (!form || typeof form !== "object") return null;
  const objectValue = (value: any) => {
    if (typeof value !== "string") return value && typeof value === "object" ? value : {};
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed : {}; } catch { return {}; }
  };
  const settings = objectValue(form.settings);
  const theme = objectValue(form.theme ?? settings.theme);
  const questions = Array.isArray(form.questions) ? form.questions.map((raw: any) => {
    const settings = objectValue(raw.settings);
    const logic = objectValue(raw.logic);
    return {
      ...raw,
      id: String(raw.id),
      type: raw.type === "hidden_field" ? "hidden" : raw.type,
      title: raw.title ?? raw.label ?? "Untitled question",
      required: Boolean(raw.required),
      options: raw.options ?? settings.options,
      settings,
      logic: raw.logic ? { ...logic, whenQuestionId: logic.whenQuestionId ?? logic.questionId } : null,
    };
  }) : [];
  return { ...form, published: form.published ?? form.status === "published", questions, theme, settings } as FormDoc;
}
function questionOptions(q: Question): string[] {
  const options = q.options ?? q.settings?.options;
  return Array.isArray(options) ? options.map(String) : ["Option 1", "Option 2", "Option 3"];
}
function shouldShowQuestion(question: Question, answers: Record<string, any>) {
  if (!question.logic?.whenQuestionId) return true;
  const prior = answers[question.logic.whenQuestionId];
  const lhs = Array.isArray(prior) ? prior.join(", ") : String(prior ?? "");
  const rhs = String(question.logic.value ?? "");
  return question.logic.operator === "not_equals" ? lhs !== rhs : lhs === rhs;
}
function saveCsv(filename: string, columns: string[], rows: string[][]) {
  const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [columns, ...rows].map(row => row.map(quote).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function SpaceFormLogo({ small = false }: { small?: boolean }) {
  return <span className={`sf-brand ${small ? "sf-brand-small" : ""}`}><span className="sf-brand-mark"><FileText size={14} strokeWidth={2.4} /></span><span>spaceform</span></span>;
}

function AppShell({ children, title }: { children: React.ReactNode; title: string }) {
  const [location, setLocation] = useLocation();
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => setLocation("/") });
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = [
    { href: "/dashboard", label: "My forms", icon: LayoutDashboard },
    { href: "/dashboard?tab=templates", label: "Templates", icon: FileText },
    { href: "/dashboard?tab=analytics", label: "Analytics", icon: BarChart3 },
    { href: "/dashboard?tab=settings", label: "Settings", icon: Settings2 },
  ];
  return <div className="sf-app-shell">
    <aside className={`sf-sidebar ${menuOpen ? "sf-sidebar-open" : ""}`}>
      <div className="sf-sidebar-top"><Link href="/dashboard"><SpaceFormLogo /></Link><button className="sf-icon-btn sf-mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <button className="sf-workspace-select"><span className="sf-workspace-icon">S</span><span><b>My workspace</b><small>Starter plan</small></span><ChevronDown size={14} /></button>
      <div className="sf-nav-label">WORKSPACE</div>
      <nav className="sf-side-nav">{nav.map(item => <Link key={item.href} href={item.href} className={location === item.href ? "active" : ""}><item.icon size={17} /><span>{item.label}</span></Link>)}</nav>
      <div className="sf-sidebar-grow" />
      <div className="sf-upgrade-card"><span className="sf-upgrade-kicker"><Sparkles size={13} /> A little more room</span><b>Get more from your forms.</b><p>Unlock unlimited AI drafts and your own branding.</p><Link href="/pricing" className="sf-small-dark-btn">Explore Pro <ArrowRight size={14} /></Link></div>
      <button className="sf-account-row" onClick={() => logout.mutate()}><span className="sf-avatar">S</span><span><b>My account</b><small>Sign out</small></span><LogOut size={15} /></button>
    </aside>
    {menuOpen && <button className="sf-nav-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    <main className="sf-app-main">
      <header className="sf-app-topbar"><button className="sf-icon-btn sf-mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={19} /></button><div className="sf-app-crumb">Workspace <ChevronRight size={13} /> <b>{title}</b></div><div className="sf-app-top-actions"><Link href="/" className="sf-view-site"><ExternalLink size={14} /> View website</Link><span className="sf-avatar sf-avatar-sm">S</span></div></header>
      <div className="sf-app-content">{children}</div>
    </main>
  </div>;
}

function AuthFrame({ children, heading, points }: { children: React.ReactNode; heading: string; points: string[] }) {
  return <div className="sf-auth-frame"><aside className="sf-auth-aside"><Link href="/"><SpaceFormLogo /></Link><div className="sf-auth-promise"><h2>{heading}</h2><ul>{points.map(point => <li key={point}><Check size={16} />{point}</li>)}</ul></div><small>© 2026 SpaceForm</small></aside><section className="sf-auth-content">{children}</section></div>;
}

export function AuthScreen({ mode = "login" }: { mode?: "login" | "signup" }) {
  const isSignup = mode === "signup";
  const [, setLocation] = useLocation();
  const requestedNext = new URLSearchParams(window.location.search).get("next");
  const afterAuth = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/dashboard";
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  useEffect(() => { if (me.data) setLocation(afterAuth); }, [me.data, afterAuth, setLocation]);
  const signup = trpc.auth.signup.useMutation({
    onSuccess: async () => { await utils.auth.me.invalidate(); setLocation(afterAuth); },
    onError: e => setError(e.message),
  });
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => { await utils.auth.me.invalidate(); setLocation(afterAuth); },
    onError: e => setError(e.message),
  });
  const googleEnabled = trpc.auth.googleEnabled.useQuery(undefined, { retry: false });
  const busy = signup.isPending || login.isPending;
  function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (isSignup) {
      if (password.length < 12) { setError("Use at least 12 characters for your password."); return; }
      if (password !== confirm) { setError("Those passwords do not match."); return; }
      signup.mutate({ name, email, password });
    } else login.mutate({ email, password });
  }
  const points = isSignup
    ? ["Unlimited forms and responses, free forever", "27 question types, from short text to scheduling", "Public shareable links — no login for respondents", "CSV export whenever you want it"]
    : ["Every form, draft or live, in one dashboard", "Responses land the moment someone submits", "Per-question completion — see where people quit"];
  return <AuthFrame heading={isSignup ? "Start collecting responses today" : "Your forms are exactly where you left them"} points={points}>
    <div className="sf-auth-card"><Link href="/" className="sf-auth-mobile-brand"><SpaceFormLogo /></Link><div className="sf-auth-heading"><h1>{isSignup ? "Join SpaceForm" : "Sign in to SpaceForm"}</h1><p>{isSignup ? "Free forever — no credit card required." : "Enter your credentials below to continue."}</p></div>
      <button className="sf-google-btn" onClick={() => { if (googleEnabled.data?.enabled) window.location.assign("/api/auth/google"); else toast.message("Google sign-in", { description: "Connect Google OAuth credentials to enable this option." }); }}><span className="sf-google-g">G</span>Continue with Google</button>
      {!googleEnabled.isLoading && !googleEnabled.data?.enabled && <p className="sf-provider-note">{googleEnabled.data?.message ?? "Google sign-in needs provider credentials before it can be enabled."}</p>}
      <div className="sf-or"><span />or continue with email<span /></div>
      <form onSubmit={submit} className="sf-auth-form">
        {isSignup && <label>Full Name<input autoComplete="name" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required /></label>}
        <label>Email<input autoComplete="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password{!isSignup && <Link href="/forgot-password" className="sf-forgot">Forgot?</Link>}<input autoComplete={isSignup ? "new-password" : "current-password"} type="password" placeholder={isSignup ? "At least 12 characters" : "••••••••"} value={password} onChange={e => setPassword(e.target.value)} minLength={isSignup ? 12 : 1} required /></label>
        {isSignup && <label>Confirm Password<input autoComplete="new-password" type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>}
        {error && <div className="sf-form-error" role="alert">{error}</div>}
        <button className="sf-primary-btn sf-auth-submit" disabled={busy}>{busy ? <LoaderCircle size={17} className="sf-spin" /> : null}{isSignup ? "Create free account" : "Sign in"}</button>
      </form>
      {isSignup ? <p className="sf-auth-legal">By creating an account, you agree to our <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>, and confirm you’re at least 18.</p> : <p className="sf-auth-legal">New to SpaceForm? Continuing with Google creates an account: you agree to our <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>}
      <p className="sf-auth-switch">{isSignup ? "Already have an account?" : "Don't have an account?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Sign up free"}</Link></p>
    </div>
  </AuthFrame>;
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const reset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: result => {
      if ((result as any)?.emailSent) setMessage("If an account matches, reset instructions have been sent.");
      else setMessage("Email delivery is not configured yet. Ask the workspace owner to connect a mail provider.");
    },
    onError: error => setMessage(error.message),
  });
  return <AuthFrame heading="Your forms are right where you left them" points={["A secure link to get back into your account", "Your forms and responses stay in your workspace"]}>
    <div className="sf-auth-card"><Link href="/"><SpaceFormLogo /></Link><div className="sf-auth-heading"><h1>Reset your password</h1><p>Enter the email address on your account.</p></div><form className="sf-auth-form" onSubmit={e => { e.preventDefault(); setMessage(""); reset.mutate({ email }); }}><label>Email<input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required /></label>{message && <div className="sf-form-note" role="status">{message}</div>}<button className="sf-primary-btn" disabled={reset.isPending}>{reset.isPending ? "Checking…" : "Send reset instructions"}</button></form><p className="sf-auth-switch"><Link href="/login">Back to sign in</Link></p></div>
  </AuthFrame>;
}

export function Dashboard() {
  const [location, setLocation] = useLocation();
  const formsQuery = trpc.forms.list.useQuery();
  const create = trpc.forms.create.useMutation({ onSuccess: (form: any) => setLocation(`/forms/${form.id}`), onError: error => toast.error(error.message) });
  const items = Array.isArray(formsQuery.data) ? formsQuery.data as any[] : ((formsQuery.data as any)?.forms ?? []);
  const totalResponses = items.reduce((sum: number, form: any) => sum + Number(form.responseCount ?? form.responsesCount ?? 0), 0 as number);
  return <AppShell title="My forms"><div className="sf-page-header"><div><div className="sf-eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}</div><h1>Your forms</h1><p>Everything you’re building, all in one place.</p></div><button className="sf-primary-btn" onClick={() => create.mutate({ title: "Untitled form" })} disabled={create.isPending}><Plus size={17} /> Create a form</button></div>
    <div className="sf-metric-row"><div className="sf-metric-card"><span>Forms</span><b>{items.length}</b><small>Across your workspace</small></div><div className="sf-metric-card"><span>Responses</span><b>{totalResponses}</b><small>Collected to date</small></div><div className="sf-metric-card"><span>Plan</span><b>Starter</b><small><Link href="/pricing">See upgrade options <ArrowRight size={12} /></Link></small></div></div>
    <section className="sf-section-block"><div className="sf-section-heading"><div><h2>Recent forms</h2><p>Your forms, from first draft to live link.</p></div><div className="sf-list-controls"><button className="sf-filter-btn">All forms <ChevronDown size={14} /></button><button className="sf-icon-btn" aria-label="More options"><MoreHorizontal size={18} /></button></div></div>
      {formsQuery.isLoading ? <div className="sf-loading"><LoaderCircle className="sf-spin" /> Loading your forms…</div> : items.length === 0 ? <div className="sf-empty"><span className="sf-empty-icon"><FilePlus2 size={24} /></span><h3>Your first form starts here.</h3><p>Start from a blank page or describe what you need and let AI sketch out a first draft.</p><button className="sf-primary-btn" onClick={() => create.mutate({ title: "Untitled form" })}><Plus size={16} /> Create your first form</button></div> : <div className="sf-form-list">{items.map((form: any) => <div className="sf-form-row" key={form.id}><Link href={`/forms/${form.id}`} className="sf-form-row-main"><span className="sf-doc-icon"><FileText size={18} /></span><span><b>{form.title || "Untitled form"}</b><small>Edited {displayDate(form.updatedAt)} · {form.responseCount ?? 0} responses</small></span></Link><span className={`sf-status ${prettyStatus(form).toLowerCase()}`}><i />{prettyStatus(form)}</span><Link href={`/forms/${form.id}/responses`} className="sf-row-action">View responses <ArrowRight size={14} /></Link><Link href={`/forms/${form.id}`} className="sf-icon-btn" aria-label={`Edit ${form.title}`}><ArrowRight size={16} /></Link></div>)}</div>}
    </section>
    <section className="sf-template-strip"><div><span className="sf-eyebrow">A GOOD PLACE TO BEGIN</span><h2>Skip the blank page.</h2><p>Start with a template, or let AI give your idea some shape.</p></div><Link href="/templates" className="sf-text-link">Browse templates <ArrowRight size={14} /></Link></section>
  </AppShell>;
}

export function FormBuilder() {
  const [, params] = useRoute("/forms/:id");
  const id = params?.id ?? "";
  const [, setLocation] = useLocation();
  const query = trpc.forms.get.useQuery({ id }, { enabled: Boolean(id) });
  const update = trpc.forms.update.useMutation({ onSuccess: () => setSaveState("Saved"), onError: e => { setSaveState("Not saved"); toast.error(e.message); } });
  const publish = trpc.forms.setPublished.useMutation({ onSuccess: () => { toast.success("Publication updated"); query.refetch(); }, onError: e => toast.error(e.message) });
  const draft = trpc.ai.generate.useMutation({ onSuccess: (generated: any) => { const draftedQuestions: Question[] = (generated.questions ?? []).map((raw: any) => ({ id: makeId(), type: raw.type === "hidden_field" ? "hidden" : raw.type, title: raw.title ?? raw.label ?? "Untitled question", description: raw.description ?? "", required: Boolean(raw.required), options: raw.options ?? raw.settings?.options, settings: raw.settings ?? {}, logic: raw.logic ? { ...raw.logic, whenQuestionId: raw.logic.whenQuestionId ?? raw.logic.questionId } : null })); setForm(prev => prev ? { ...prev, title: generated.title || prev.title, description: generated.description || prev.description, questions: draftedQuestions } : prev); setSelected(draftedQuestions[0]?.id ?? ""); setAiOpen(false); }, onError: e => toast.error(e.message) });
  const [form, setForm] = useState<FormDoc | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [tab, setTab] = useState<"build" | "design" | "logic">("build");
  const [saveState, setSaveState] = useState("Saved");
  const [shareOpen, setShareOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const initialized = useRef(false);
  useEffect(() => {
    const normalized = normalizeForm(query.data);
    if (normalized) { setForm(normalized); setSelected(normalized.questions[0]?.id ?? ""); initialized.current = true; }
  }, [query.data]);
  useEffect(() => {
    if (!form || !initialized.current) return;
    setSaveState("Saving…");
    const timer = window.setTimeout(() => update.mutate({ id: String(form.id), title: form.title, description: form.description ?? "", questions: form.questions.map(question => ({ ...question, title: question.title, options: questionOptions(question), settings: { ...(question.settings ?? {}), options: questionOptions(question) } })), theme: form.theme ?? {}, settings: form.settings ?? {} }), 650);
    return () => window.clearTimeout(timer);
  }, [form]);
  const selectedQuestion = form?.questions.find(q => q.id === selected);
  function changeQuestion(id: string, patch: Partial<Question>) {
    setForm(current => current ? { ...current, questions: current.questions.map(q => q.id === id ? { ...q, ...patch } : q) } : current);
  }
  function addQuestion(type: FieldType) {
    const item: Question = { id: makeId(), type, title: `New ${FIELD_TYPES.find(f => f.type === type)?.name.toLowerCase() ?? "question"}`, required: false, options: ["Option 1", "Option 2", "Option 3"] };
    setForm(current => current ? { ...current, questions: [...current.questions, item] } : current); setSelected(item.id); setTab("build");
  }
  function moveQuestion(index: number, by: number) {
    setForm(current => {
      if (!current) return current;
      const next = [...current.questions]; const target = index + by;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, questions: next };
    });
  }
  function deleteQuestion(id: string) { setForm(current => current ? { ...current, questions: current.questions.filter(q => q.id !== id) } : current); setSelected(form?.questions.find(q => q.id !== id)?.id ?? ""); }
  if (query.isLoading || !form) return <div className="sf-editor-loading"><LoaderCircle className="sf-spin" /> Opening your form…</div>;
  const isPublished = Boolean(form.published || form.isPublished || form.status === "published");
  const shareUrl = typeof window === "undefined" ? "" : `${window.location.origin}/f/${form.slug ?? form.id}`;
  const fields = FIELD_TYPES.reduce((groups, item) => { (groups[item.group] ||= []).push(item); return groups; }, {} as Record<string, typeof FIELD_TYPES>);
  return <div className="sf-editor-page">
    <header className="sf-editor-header"><Link href="/dashboard" className="sf-back-link"><ArrowLeft size={16} /> Back to forms</Link><div className="sf-editor-doc"><span className={`sf-status ${isPublished ? "published" : "draft"}`}><i />{isPublished ? "Published" : "Draft"}</span><span className="sf-save-state">{saveState}</span></div><div className="sf-editor-actions"><button className="sf-outline-btn" onClick={() => setAiOpen(true)}><Sparkles size={15} /> AI draft</button><button className="sf-outline-btn" onClick={() => setShareOpen(true)}><Share2 size={15} /> Share</button><button className="sf-primary-btn" onClick={() => publish.mutate({ id: String(form.id), published: !isPublished })} disabled={publish.isPending}>{isPublished ? "Unpublish" : "Publish"}</button></div></header>
    <div className="sf-editor-body">
      <aside className="sf-builder-left"><div className="sf-builder-tabs"><button onClick={() => setTab("build")} className={tab === "build" ? "active" : ""}><FileText size={15} />Build</button><button onClick={() => setTab("design")} className={tab === "design" ? "active" : ""}><Palette size={15} />Design</button><button onClick={() => setTab("logic")} className={tab === "logic" ? "active" : ""}><Settings2 size={15} />Logic</button></div>
        {tab === "build" && <div className="sf-question-list"><div className="sf-list-caption">QUESTIONS <span>{form.questions.length}</span></div>{form.questions.map((q, index) => <button key={q.id} className={`sf-question-nav ${q.id === selected ? "active" : ""}`} onClick={() => setSelected(q.id)}><GripVertical size={14} /><span className="sf-question-number">{String(index + 1).padStart(2, "0")}</span><span className="sf-question-nav-text"><b>{q.title}</b><small>{FIELD_TYPES.find(f => f.type === q.type)?.name ?? q.type}{q.required ? " · required" : ""}</small></span></button>)}<div className="sf-add-question"><label>Add a question type<select value="" onChange={e => e.target.value && addQuestion(e.target.value as FieldType)}><option value="">Choose field…</option>{Object.entries(fields).map(([group, entries]) => <optgroup key={group} label={group}>{entries.map(field => <option key={field.type} value={field.type}>{field.name}</option>)}</optgroup>)}</select></label><div className="sf-add-common">{FIELD_TYPES.slice(0, 5).map(field => <button key={field.type} title={`Add ${field.name}`} onClick={() => addQuestion(field.type)}><Plus size={12} />{field.name}</button>)}</div></div></div>}
        {tab === "design" && <div className="sf-design-panel"><span className="sf-list-caption">YOUR LOOK</span><label>Accent color<div className="sf-color-input"><input type="color" value={form.theme?.accent ?? "#e7bd45"} onChange={e => setForm(v => v ? { ...v, theme: { ...v.theme, accent: e.target.value } } : v)} /><code>{form.theme?.accent ?? "#e7bd45"}</code></div></label><label>Background<div className="sf-color-input"><input type="color" value={form.theme?.background ?? "#faf9f5"} onChange={e => setForm(v => v ? { ...v, theme: { ...v.theme, background: e.target.value } } : v)} /><code>{form.theme?.background ?? "#faf9f5"}</code></div></label><label>Typeface<select value={form.theme?.font ?? "sans"} onChange={e => setForm(v => v ? { ...v, theme: { ...v.theme, font: e.target.value } } : v)}><option value="sans">Modern sans</option><option value="serif">Editorial serif</option><option value="mono">Monospace</option></select></label><div className="sf-theme-swatches"><button onClick={() => setForm(v => v ? { ...v, theme: { accent: "#e7bd45", background: "#faf9f5", font: "sans" } } : v)}><i className="swatch-yellow" />Paper</button><button onClick={() => setForm(v => v ? { ...v, theme: { accent: "#80a98e", background: "#f5f7f3", font: "serif" } } : v)}><i className="swatch-green" />Field</button><button onClick={() => setForm(v => v ? { ...v, theme: { accent: "#a5a2d8", background: "#f7f6fb", font: "sans" } } : v)}><i className="swatch-lilac" />Soft</button></div><p className="sf-helper-copy">Color and type are saved as you edit.</p></div>}
        {tab === "logic" && <div className="sf-logic-panel"><span className="sf-list-caption">JUMP LOGIC</span><p>Show a question only when an earlier answer makes it relevant.</p>{form.questions.map(q => <div className="sf-logic-row" key={q.id}><span>{q.title}</span><select value={q.logic?.whenQuestionId ?? ""} onChange={e => changeQuestion(q.id, { logic: e.target.value ? { ...(q.logic ?? {}), whenQuestionId: e.target.value } : null })}><option value="">Always show</option>{form.questions.filter(prev => form.questions.indexOf(prev) < form.questions.indexOf(q)).map(prev => <option value={prev.id} key={prev.id}>If {prev.title}</option>)}</select>{q.logic?.whenQuestionId && <><select value={q.logic.operator ?? "equals"} onChange={e => changeQuestion(q.id, { logic: { ...q.logic, operator: e.target.value as "equals" | "not_equals" } })}><option value="equals">is</option><option value="not_equals">is not</option></select><input value={q.logic.value ?? ""} onChange={e => changeQuestion(q.id, { logic: { ...q.logic, value: e.target.value } })} placeholder="Answer value" /></>}</div>)}</div>}
      </aside>
      <section className="sf-builder-canvas"><div className="sf-builder-canvas-top"><span>FORM EDITOR</span><button className="sf-ghost-btn" onClick={() => setShareOpen(true)}><Eye size={14} /> Preview / share</button></div><div className="sf-form-canvas" style={{ background: form.theme?.background ?? "#faf9f5", "--form-accent": form.theme?.accent ?? "#e7bd45" } as React.CSSProperties}><div className="sf-form-canvas-inner"><div className="sf-step-label">YOUR FORM <span>·</span> {form.questions.length} QUESTIONS</div><input className="sf-form-title-edit" value={form.title} onChange={e => setForm(v => v ? { ...v, title: e.target.value } : v)} aria-label="Form title" placeholder="Give your form a title" /><textarea className="sf-form-description-edit" value={form.description ?? ""} onChange={e => setForm(v => v ? { ...v, description: e.target.value } : v)} placeholder="A short description helps people know what to expect." rows={2} />
        {form.questions.length === 0 && <div className="sf-canvas-empty"><FilePlus2 size={24} /><b>Your form begins with a question.</b><p>Choose one from the left to add it to the canvas.</p></div>}
        {selectedQuestion && <div className="sf-selected-question"><div className="sf-selected-header"><span><b>{String(form.questions.findIndex(q => q.id === selected) + 1).padStart(2, "0")}</b> · {FIELD_TYPES.find(f => f.type === selectedQuestion.type)?.name}</span><div><button onClick={() => moveQuestion(form.questions.findIndex(q => q.id === selected), -1)} title="Move up"><ChevronLeft size={16} /></button><button onClick={() => moveQuestion(form.questions.findIndex(q => q.id === selected), 1)} title="Move down"><ChevronRight size={16} /></button><button onClick={() => deleteQuestion(selected)} title="Delete question"><Trash2 size={15} /></button></div></div><label className="sf-edit-label">QUESTION<input value={selectedQuestion.title} onChange={e => changeQuestion(selected, { title: e.target.value })} /></label><label className="sf-edit-label">DESCRIPTION <span className="sf-muted-optional">OPTIONAL</span><textarea value={selectedQuestion.description ?? ""} onChange={e => changeQuestion(selected, { description: e.target.value })} placeholder="Add a little context…" rows={2} /></label>{["dropdown", "single_choice", "multiple_choice", "image_choice", "ranking", "matrix"].includes(selectedQuestion.type) && <label className="sf-edit-label">OPTIONS <textarea value={questionOptions(selectedQuestion).join("\n")} onChange={e => changeQuestion(selected, { options: e.target.value.split("\n").filter(Boolean) })} rows={4} placeholder="One option per line" /></label>}<label className="sf-toggle-line"><span><b>Required</b><small>People need to answer this before continuing.</small></span><input type="checkbox" checked={Boolean(selectedQuestion.required)} onChange={e => changeQuestion(selected, { required: e.target.checked })} /></label><div className="sf-question-preview"><span className="sf-preview-overline">PREVIEW</span><FieldInput question={selectedQuestion} value={undefined} onChange={() => {}} disabled /></div></div>}
        {form.questions.length > 0 && <button className="sf-canvas-add" onClick={() => addQuestion("short_text")}><Plus size={15} /> Add a question</button>}
      </div></div><div className="sf-canvas-footer"><span><span className="sf-footer-dot" /> Autosave is on</span><span>Made with <b>spaceform</b></span></div></section>
      <aside className="sf-builder-inspector"><div className="sf-inspector-title"><span>FORM SETTINGS</span><MoreHorizontal size={17} /></div><label>Form name<input value={form.title} onChange={e => setForm(v => v ? { ...v, title: e.target.value } : v)} /></label><label>Intro text<textarea value={form.description ?? ""} onChange={e => setForm(v => v ? { ...v, description: e.target.value } : v)} rows={3} placeholder="Tell people what this is about" /></label><label>Thank-you message<textarea value={form.settings?.thankYouText ?? ""} onChange={e => setForm(v => v ? { ...v, settings: { ...(v.settings ?? {}), thankYouText: e.target.value } } : v)} rows={2} placeholder="Thanks for sharing." /></label><label>After-submit redirect<input value={form.settings?.redirectUrl ?? ""} onChange={e => setForm(v => v ? { ...v, settings: { ...(v.settings ?? {}), redirectUrl: e.target.value } } : v)} placeholder="/thanks or https://example.com/thanks" /></label><label>Logo image URL<input value={form.settings?.logoUrl ?? ""} onChange={e => setForm(v => v ? { ...v, settings: { ...(v.settings ?? {}), logoUrl: e.target.value } } : v)} placeholder="https://example.com/logo.png" /></label><p className="sf-helper-copy">Redirects accept a local path or secure HTTPS address.</p><div className="sf-inspector-summary"><span>Questions</span><b>{form.questions.length}</b></div><div className="sf-inspector-summary"><span>Responses</span><b>{form.responseCount ?? 0}</b></div><Link className="sf-inspector-link" href={`/forms/${form.id}/responses`}><BarChart3 size={15} /> View responses <ArrowRight size={14} /></Link><button className="sf-inspector-link" onClick={() => setShareOpen(true)}><Share2 size={15} /> Share your form <ArrowRight size={14} /></button><div className="sf-inspector-tip"><Sparkles size={14} /><span><b>A good form is a short one.</b><small>Keep each question focused and easy to answer.</small></span></div></aside>
    </div>
    {aiOpen && <div className="sf-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setAiOpen(false)}><section className="sf-modal"><button className="sf-modal-close" onClick={() => setAiOpen(false)}><X size={18} /></button><span className="sf-eyebrow"><WandSparkles size={13} /> AI FORM DRAFT</span><h2>What do you want to build?</h2><p>Describe your form. AI will draft the questions, order and field types.</p><textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. Feedback from people who came to our Saturday baking class…" rows={4} /><button className="sf-primary-btn" disabled={!prompt.trim() || draft.isPending} onClick={() => draft.mutate({ prompt })}>{draft.isPending ? <><LoaderCircle className="sf-spin" size={16} /> Drafting…</> : <><Sparkles size={16} /> Draft my questions</>}</button><small>Your draft stays editable. No payment provider is connected.</small></section></div>}
    {shareOpen && <ShareDialog form={form} url={shareUrl} onClose={() => setShareOpen(false)} />}
  </div>;
}

function ShareDialog({ form, url, onClose }: { form: FormDoc; url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy(value: string) { try { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { toast.error("Could not copy to clipboard."); } }
  const embed = `<iframe src="${url}" title="${form.title}" width="100%" height="600" frameborder="0"></iframe>`;
  return <div className="sf-modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section className="sf-modal sf-share-modal"><button className="sf-modal-close" onClick={onClose}><X size={18} /></button><span className="sf-eyebrow"><Share2 size={13} /> SHARE YOUR FORM</span><h2>Ready to collect answers?</h2><p>Anyone with this link can respond. No account needed.</p>{!form.published && !form.isPublished && form.status !== "published" && <div className="sf-notice">Publish the form before the public link becomes available.</div>}<div className="sf-share-link-row"><input readOnly value={url} /><button className="sf-primary-btn" onClick={() => copy(url)}><Copy size={15} />{copied ? "Copied" : "Copy link"}</button></div><div className="sf-share-tools"><div className="sf-qr-card"><QRCodeSVG value={url || "https://spaceform.site"} size={128} bgColor="#ffffff" fgColor="#191919" level="M" /><span>SCAN TO OPEN</span><button className="sf-text-link" onClick={() => { const svg = document.querySelector(".sf-qr-card svg"); if (!svg) return; const xml = new XMLSerializer().serializeToString(svg); const anchor = document.createElement("a"); anchor.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`; anchor.download = "spaceform-qr.svg"; anchor.click(); }}>Download QR <Download size={13} /></button></div><div className="sf-embed-card"><b>Embed this form</b><p>Paste this snippet into your site.</p><pre>{embed}</pre><button className="sf-outline-btn" onClick={() => copy(embed)}><Clipboard size={14} /> Copy embed code</button></div></div></section></div>;
}

export function ResponsesPage() {
  const [, params] = useRoute("/forms/:id/responses");
  const id = params?.id ?? "";
  const formQuery = trpc.forms.get.useQuery({ id }, { enabled: !!id });
  const responseQuery = trpc.forms.responses.useQuery({ formId: id }, { enabled: !!id });
  const form = normalizeForm(formQuery.data);
  const result = responseQuery.data as any;
  const responses: any[] = Array.isArray(result) ? result : (result?.responses ?? []);
  const questions = normalizeForm({ ...(form ?? {}), questions: result?.questions ?? form?.questions })?.questions ?? [];
  const metrics = result?.metrics ?? {};
  const viewedByQuestion = new Map<string, number>((metrics.questionViews ?? []).map((item: any) => [item.questionId, Number(item.count)]));
  function exportResponses() {
    const headers = ["Response ID", "Submitted at", ...questions.map(q => q.title)];
    const rows = responses.map(response => {
      const answerValues = response.answers ?? response.values ?? {};
      const answerById = Array.isArray(answerValues) ? Object.fromEntries(answerValues.map((a: any) => [a.questionId ?? a.fieldId, a.value])) : answerValues;
      return [String(response.id ?? ""), String(response.submittedAt ?? response.createdAt ?? ""), ...questions.map(q => { const value = answerById[q.id]; return Array.isArray(value) ? value.join("; ") : typeof value === "object" ? JSON.stringify(value) : String(value ?? ""); })];
    });
    saveCsv(`${(form?.title || "spaceform").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-responses.csv`, headers, rows);
  }
  return <AppShell title="Responses"><div className="sf-page-header"><div><Link href={`/forms/${id}`} className="sf-back-link"><ArrowLeft size={14} /> Back to builder</Link><h1>{form?.title || "Responses"}</h1><p>Every answer in one place.</p></div><button className="sf-primary-btn" onClick={exportResponses} disabled={!responses.length}><Download size={16} /> Export CSV</button></div>
    <div className="sf-response-stats"><div><span>Started</span><b>{metrics.started ?? responses.length}</b></div><div><span>Submitted</span><b>{responses.length}</b></div><div><span>Completion rate</span><b>{metrics.completionRate ?? 0}%</b></div><div><span>Questions</span><b>{questions.length}</b></div><div><span>Form status</span><b>{form?.published ? "Published" : "Draft"}</b></div></div>
    <div className="sf-table-wrap"><table className="sf-response-table"><thead><tr><th>Submitted</th>{questions.map(q => <th key={q.id}>{q.title}</th>)}</tr></thead><tbody>{responses.map((response: any, index: number) => { const source = response.answers ?? response.values ?? {}; const byId = Array.isArray(source) ? Object.fromEntries(source.map((a: any) => [a.questionId ?? a.fieldId, a.value])) : source; return <tr key={response.id ?? index}><td>{displayDate(response.submittedAt ?? response.createdAt)}</td>{questions.map(q => <td key={q.id}>{Array.isArray(byId[q.id]) ? byId[q.id].join(", ") : typeof byId[q.id] === "object" ? JSON.stringify(byId[q.id]) : String(byId[q.id] ?? "—")}</td>)}</tr>; })}</tbody></table>{!responseQuery.isLoading && !responses.length && <div className="sf-empty sf-empty-compact"><span className="sf-empty-icon"><BarChart3 size={24} /></span><h3>Your responses will show up here.</h3><p>Publish your form and share the link to start collecting answers.</p></div>}</div>
    {questions.length > 0 && <section className="sf-section-block"><div className="sf-section-heading"><div><h2>Question summary</h2><p>Response counts and reach by question.</p></div></div><div className="sf-summary-grid">{questions.map(q => { const count = responses.filter((r: any) => { const a = r.answers ?? r.values ?? {}; return Boolean(Array.isArray(a) ? a.find((x: any) => (x.questionId ?? x.fieldId) === q.id)?.value : a[q.id]); }).length; return <div key={q.id} className="sf-summary-card"><span>{q.title}</span><b>{count} <small>of {responses.length} answered · {viewedByQuestion.get(q.id) ?? 0} reached</small></b><div className="sf-progress"><i style={{ width: `${responses.length ? count / responses.length * 100 : 0}%` }} /></div></div>; })}</div></section>}
  </AppShell>;
}

function FieldInput({ question, value, onChange, disabled = false, onFile }: { question: Question; value: any; onChange: (value: any) => void; disabled?: boolean; onFile?: (file: File) => Promise<void> }) {
  const options = questionOptions(question);
  const basic = (type: string, placeholder = "Your answer") => <input type={type} placeholder={placeholder} value={value ?? ""} disabled={disabled} onChange={e => onChange(e.target.value)} />;
  switch (question.type) {
    case "short_text": case "name": case "address": return basic("text", question.type === "name" ? "Your name" : question.type === "address" ? "Street address" : "Type your answer…");
    case "email": return basic("email", "you@example.com");
    case "phone": return basic("tel", "+1 (555) 000-0000");
    case "number": return basic("number", "0");
    case "url": return basic("url", "https://");
    case "date": return basic("date");
    case "time": return basic("time");
    case "date_time": case "scheduling": return basic("datetime-local");
    case "long_text": return <textarea rows={4} placeholder="Type your answer…" value={value ?? ""} disabled={disabled} onChange={e => onChange(e.target.value)} />;
    case "dropdown": return <select value={value ?? ""} disabled={disabled} onChange={e => onChange(e.target.value)}><option value="">Choose an option…</option>{options.map(o => <option key={o}>{o}</option>)}</select>;
    case "single_choice": case "image_choice": case "yes_no": {
      const choices = question.type === "yes_no" ? ["Yes", "No"] : options;
      return <div className="sf-choice-list">{choices.map((option, i) => <label className={`sf-choice ${value === option ? "selected" : ""}`} key={option}><input type="radio" name={question.id} value={option} checked={value === option} disabled={disabled} onChange={() => onChange(option)} />{question.type === "image_choice" && <span className={`sf-choice-tile tile-${i % 3}`} />}{option}</label>)}</div>;
    }
    case "multiple_choice": return <div className="sf-choice-list">{options.map(option => { const selected = Array.isArray(value) ? value : []; return <label className={`sf-choice ${selected.includes(option) ? "selected" : ""}`} key={option}><input type="checkbox" checked={selected.includes(option)} disabled={disabled} onChange={e => onChange(e.target.checked ? [...selected, option] : selected.filter(item => item !== option))} />{option}</label>; })}</div>;
    case "checkbox": return <label className="sf-choice"><input type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={e => onChange(e.target.checked)} />I agree</label>;
    case "rating": return <div className="sf-rating-row">{[1, 2, 3, 4, 5].map(n => <button type="button" className={Number(value) >= n ? "chosen" : ""} key={n} disabled={disabled} onClick={() => onChange(n)} aria-label={`${n} out of 5`}>★</button>)}</div>;
    case "opinion_scale": return <div className="sf-scale-row">{Array.from({ length: Number(question.settings?.max ?? 5) - Number(question.settings?.min ?? 1) + 1 }, (_, i) => Number(question.settings?.min ?? 1) + i).map(n => <button type="button" className={Number(value) === n ? "chosen" : ""} key={n} disabled={disabled} onClick={() => onChange(n)}>{n}</button>)}</div>;
    case "nps": return <div className="sf-nps-grid">{Array.from({ length: 11 }, (_, n) => <button type="button" className={Number(value) === n ? "chosen" : ""} key={n} disabled={disabled} onClick={() => onChange(n)}>{n}</button>)}</div>;
    case "ranking": return <select multiple size={Math.min(options.length, 5)} value={Array.isArray(value) ? value : []} disabled={disabled} onChange={e => onChange(Array.from(e.target.selectedOptions).map(o => o.value))}>{options.map(o => <option key={o}>{o}</option>)}</select>;
    case "matrix": return <div className="sf-matrix">{(question.settings?.rows ?? ["Experience", "Value", "Support"]).map((row: string) => <div key={row}><b>{row}</b><div>{options.map(option => <label key={option}><input type="radio" name={`${question.id}-${row}`} checked={value?.[row] === option} disabled={disabled} onChange={() => onChange({ ...(value ?? {}), [row]: option })} />{option}</label>)}</div></div>)}</div>;
    case "file_upload": return <label className="sf-upload-box"><Upload size={20} /><span>{value?.name ?? "Choose a file or drag it here"}</span><small>Max 10 MB</small><input type="file" disabled={disabled} onChange={e => { const file = e.target.files?.[0]; if (file && onFile) void onFile(file); else if (file) onChange({ name: file.name, size: file.size }); }} /></label>;
    case "signature": return <SignaturePad value={value} onChange={onChange} disabled={disabled} />;
    case "hidden": return <span className="sf-hidden-field-note">Hidden from respondents</span>;
    case "payment": return <div className="sf-payment-notice"><span>₹</span><div><b>Payment setup required</b><small>Connect Stripe or Razorpay to collect payments.</small></div></div>;
    default: return basic("text");
  }
}

function SignaturePad({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => { const canvas = canvasRef.current; if (!canvas) return; const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) }; };
  const drawStart = (e: React.PointerEvent<HTMLCanvasElement>) => { if (disabled) return; drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); const p = point(e); const ctx = canvasRef.current?.getContext("2d"); if (p && ctx) { ctx.beginPath(); ctx.moveTo(p.x, p.y); } };
  const drawMove = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing.current) return; const p = point(e); const ctx = canvasRef.current?.getContext("2d"); if (!p || !ctx) return; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.strokeStyle = "#222"; ctx.lineTo(p.x, p.y); ctx.stroke(); };
  const drawEnd = () => { if (!drawing.current) return; drawing.current = false; const canvas = canvasRef.current; if (canvas) onChange(canvas.toDataURL("image/png")); };
  return <div className="sf-signature-pad"><canvas ref={canvasRef} width={560} height={140} onPointerDown={drawStart} onPointerMove={drawMove} onPointerUp={drawEnd} onPointerCancel={drawEnd} />{!disabled && <button type="button" className="sf-text-link" onClick={() => { const ctx = canvasRef.current?.getContext("2d"); const c = canvasRef.current; if (ctx && c) { ctx.clearRect(0, 0, c.width, c.height); onChange(""); } }}>Clear signature</button>}</div>;
}

export function PublicForm() {
  const [, params] = useRoute("/f/:slug");
  const slug = params?.slug ?? "";
  const query = trpc.forms.bySlug.useQuery({ slug }, { enabled: Boolean(slug) });
  const submit = trpc.forms.submit.useMutation({ onSuccess: result => { if (result.redirectUrl) window.location.assign(result.redirectUrl); else setComplete(true); }, onError: e => toast.error(e.message) });
  const prepareUpload = trpc.forms.prepareUpload.useMutation();
  const evaluateVisibility = trpc.forms.visible.useMutation();
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [index, setIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<{ responseId: string; progressToken: string } | null>(null);
  const startedFor = useRef("");
  const startResponse = trpc.forms.start.useMutation({ onSuccess: setProgress, onError: error => { startedFor.current = ""; toast.error(error.message); } });
  const recordProgress = trpc.forms.progress.useMutation({ onError: error => toast.error(error.message) });
  const normalized = normalizeForm(query.data);
  const questions = useMemo(() => normalized?.questions.filter(q => q.type !== "hidden") ?? [], [normalized]);
  const visible = visibleIds ? questions.filter(q => visibleIds.includes(q.id)) : questions;
  const current = visible[Math.min(index, Math.max(visible.length - 1, 0))];
  useEffect(() => {
    if (!normalized || !slug || startedFor.current === normalized.id) return;
    startedFor.current = String(normalized.id);
    setProgress(null);
    startResponse.mutate({ slug });
  }, [normalized?.id, slug]);
  useEffect(() => {
    if (progress && current) recordProgress.mutate({ slug, responseId: progress.responseId, progressToken: progress.progressToken, questionId: current.id });
  }, [progress?.responseId, current?.id]);
  useEffect(() => { if (questions.length && index >= visible.length) setIndex(Math.max(visible.length - 1, 0)); }, [visible.length, index, questions.length]);
  function submitAnswers() {
    if (!progress) { toast.message("Preparing your response…"); return; }
    submit.mutate({ slug, responseId: progress.responseId, progressToken: progress.progressToken, answers });
  }
  async function uploadFile(file: File) {
    if (!current) return;
    setUploadBusy(true);
    try {
      const result = await prepareUpload.mutateAsync({ slug, questionId: current.id, fileName: file.name, mimeType: file.type || "application/octet-stream", size: file.size }) as any;
      const uploadUrl = result?.uploadUrl; const assetPath = result?.assetPath;
      if (!uploadUrl || !assetPath) throw new Error("File upload is not configured yet.");
      const uploaded = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!uploaded.ok) throw new Error("The upload did not finish. Please try again.");
      setAnswers(value => ({ ...value, [current.id]: { name: file.name, path: assetPath } }));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not upload this file."); }
    finally { setUploadBusy(false); }
  }
  async function next() {
    if (!current) { submitAnswers(); return; }
    const value = answers[current.id];
    if (current.required && (value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length) || (current.type === "checkbox" && value !== true))) { toast.error("Please answer this question before continuing."); return; }
    try {
      const result = await evaluateVisibility.mutateAsync({ slug, answers });
      const nextVisible = questions.filter(question => result.questionIds.includes(question.id));
      const currentPosition = questions.findIndex(question => question.id === current.id);
      const nextIndex = nextVisible.findIndex(question => questions.findIndex(item => item.id === question.id) > currentPosition);
      setVisibleIds(nextVisible.map(question => question.id));
      if (nextIndex < 0) submitAnswers();
      else setIndex(nextIndex);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not continue this form."); }
  }
  if (query.isLoading) return <div className="sf-public-loading"><LoaderCircle className="sf-spin" /> Opening your form…</div>;
  if (!normalized) return <div className="sf-form-not-found"><SpaceFormLogo /><h1>This form isn’t available.</h1><p>Check the link and try again.</p></div>;
  if (complete) return <div className="sf-public-form" style={{ background: normalized.theme?.background ?? "#faf9f5" }}><div className="sf-public-card sf-complete-card"><span className="sf-complete-check"><Check size={22} /></span><span className="sf-eyebrow">RESPONSE RECORDED</span><h1>{normalized.settings?.thankYouText || "Thanks for sharing."}</h1><p>Your answer has been sent.</p><span className="sf-powered-by">Made with <SpaceFormLogo small /></span></div></div>;
  if (!current) return <div className="sf-form-not-found"><SpaceFormLogo /><h1>This form has no questions yet.</h1><p>Come back when it’s ready.</p></div>;
  return <div className="sf-public-form" style={{ background: normalized.theme?.background ?? "#faf9f5", "--form-accent": normalized.theme?.accent ?? "#e7bd45" } as React.CSSProperties}><header className="sf-public-brand">{normalized.settings?.logoUrl ? <img src={normalized.settings.logoUrl} alt={`${normalized.title} logo`} /> : <SpaceFormLogo />}</header><main className="sf-public-card"><div className="sf-public-progress"><span>QUESTION {String(index + 1).padStart(2, "0")} <i>/</i> {String(visible.length).padStart(2, "0")}</span><div><i style={{ width: `${Math.min(100, (index + 1) / Math.max(visible.length, 1) * 100)}%` }} /></div></div>{index === 0 && <><h1 className="sf-public-title">{normalized.title}</h1>{normalized.description && <p className="sf-public-intro">{normalized.description}</p>}</>}<section className="sf-public-question"><h2>{current.title}{current.required && <span> *</span>}</h2>{current.description && <p>{current.description}</p>}<div className="sf-public-field"><FieldInput question={current} value={answers[current.id]} onChange={v => setAnswers(old => ({ ...old, [current.id]: v }))} onFile={uploadFile} /></div></section><div className="sf-public-actions"><span>{index > 0 ? <button className="sf-public-back" onClick={() => setIndex(i => Math.max(0, i - 1))}><ChevronLeft size={15} /> Back</button> : <span className="sf-required-note">* Required</span>}</span><button className="sf-primary-btn" onClick={next} disabled={submit.isPending || uploadBusy || evaluateVisibility.isPending || startResponse.isPending || !progress}>{submit.isPending || evaluateVisibility.isPending || startResponse.isPending ? <LoaderCircle size={16} className="sf-spin" /> : null}{index >= visible.length - 1 ? "Submit" : "Continue"}<ArrowRight size={15} /></button></div><div className="sf-public-footer"><span>Press <kbd>Enter ↵</kbd> to continue</span><span>{index + 1} of {visible.length}</span></div></main><div className="sf-powered-by">Made with <SpaceFormLogo small /></div></div>;
}

export function NewForm() {
  const [, setLocation] = useLocation();
  const started = useRef(false);
  const create = trpc.forms.create.useMutation({
    onSuccess: form => setLocation(`/forms/${(form as any).id}`),
    onError: error => toast.error(error.message),
  });
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    create.mutate({ title: "Untitled form" });
  }, []);
  return <div className="sf-editor-loading"><LoaderCircle className="sf-spin" /> Creating a draft…</div>;
}
