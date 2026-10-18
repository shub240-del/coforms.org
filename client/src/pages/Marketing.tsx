import type { ReactNode } from "react";
import "./Marketing.css";

type MarketingSection = "features" | "templates" | "pricing" | "faq";

type IconName = "arrow" | "check" | "spark" | "grid" | "branch" | "palette" | "table" | "share" | "team";

function Icon({ name }: { name: IconName }) {
  if (name === "arrow") {
    return <span className="sf-icon sf-icon-arrow" aria-hidden="true">↗</span>;
  }
  if (name === "check") {
    return <span className="sf-icon sf-icon-check" aria-hidden="true">✓</span>;
  }
  const paths: Record<Exclude<IconName, "arrow" | "check">, ReactNode> = {
    spark: <><path d="M12 2l1.7 7.3L21 11l-7.3 1.7L12 20l-1.7-7.3L3 11l7.3-1.7L12 2z" /><path d="M20 17v5M17.5 19.5h5" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    branch: <><circle cx="6" cy="5" r="2.5" /><circle cx="18" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 5H14a4 4 0 014 4v7.5M8.5 5v5a4 4 0 004 4H18" /></>,
    palette: <><path d="M12 3a9 9 0 100 18h1.3a2 2 0 001.2-3.6l-.7-.5a2 2 0 011.2-3.6H17A4 4 0 0021 9.5C19.8 5.7 16.2 3 12 3z" /><circle cx="7.5" cy="10" r="1" /><circle cx="10" cy="6.8" r="1" /><circle cx="14" cy="6.5" r="1" /></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="1" /><path d="M3 9h18M9 9v11M15 9v11" /></>,
    share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5" /></>,
    team: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3.5 20c.5-3.3 2.3-5 5.5-5s5 1.7 5.5 5M15 15c2.7-.1 4.4 1.4 5 4" /></>,
  };
  return <svg className="sf-line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name as Exclude<IconName, "arrow" | "check">]}</svg>;
}

function Header() {
  return (
    <header className="sf-header">
      <a className="sf-wordmark" href="/" aria-label="SpaceForm home"><span className="sf-mark" aria-hidden="true"><i /><i /><i /></span><span>spaceform</span></a>
      <nav className="sf-nav" aria-label="Primary navigation">
        <a href="/features">Features</a>
        <a href="/templates">Templates</a>
        <a href="/pricing">Pricing</a>
        <a href="/faq">FAQ</a>
      </nav>
      <div className="sf-header-actions">
        <a className="sf-text-link" href="/login">Sign in</a>
        <a className="sf-button sf-button-small" href="/signup">Create a form <Icon name="arrow" /></a>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="sf-footer">
      <div className="sf-footer-top">
        <div><a className="sf-wordmark" href="/"><span className="sf-mark" aria-hidden="true"><i /><i /><i /></span><span>spaceform</span></a><p className="sf-footer-note">Thoughtful forms for better answers.</p></div>
        <div className="sf-footer-links">
          <div><span className="sf-footer-label">Explore</span><a href="/features">Features</a><a href="/templates">Templates</a><a href="/pricing">Pricing</a></div>
          <div><span className="sf-footer-label">Company</span><a href="/faq">FAQ</a><a href="mailto:hello@spaceform.site">Contact</a><a href="/signup">Get started</a></div>
          <div><span className="sf-footer-label">Legal</span><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/refund">Refunds</a></div>
        </div>
      </div>
      <div className="sf-footer-bottom"><span>© 2025 SpaceForm. Made for the curious.</span><span>Payments and billing are not live in this demo.</span></div>
    </footer>
  );
}

function Button({ children, quiet = false, href = "/signup" }: { children: ReactNode; quiet?: boolean; href?: string }) {
  return <a className={`sf-button${quiet ? " sf-button-quiet" : ""}`} href={href}>{children}<Icon name="arrow" /></a>;
}

function SectionHeading({ overline, title, copy, align = "left" }: { overline: string; title: string; copy?: string; align?: "left" | "center" }) {
  return <div className={`sf-section-heading sf-align-${align}`}><span className="sf-overline">{overline}</span><h2>{title}</h2>{copy && <p>{copy}</p>}</div>;
}

function MiniForm() {
  return <div className="sf-form-window" aria-label="Example SpaceForm survey preview">
    <div className="sf-window-bar"><span className="sf-window-dot" /><span>Customer check-in <small>· draft</small></span><span className="sf-window-menu">•••</span></div>
    <div className="sf-form-body">
      <div className="sf-form-progress"><span /><b>2 of 6</b></div>
      <span className="sf-form-tag">QUESTION 02</span>
      <h3>What are you hoping to make space for?</h3>
      <p className="sf-form-helper">A sentence or two is plenty.</p>
      <div className="sf-input-line">Type your answer here<span>↵</span></div>
      <div className="sf-form-foot"><span>← Back</span><button type="button">Continue <Icon name="arrow" /></button></div>
    </div>
  </div>;
}

function Metrics() {
  return <section className="sf-metrics" aria-label="SpaceForm highlights">
    <div><strong>25<span>+</span></strong><span>question types</span></div>
    <div><strong>02</strong><span>minutes to publish</span></div>
    <div><strong>∞</strong><span>ways to ask better</span></div>
  </section>;
}

const featureCards = [
  { icon: "branch" as IconName, title: "Ask the next right question", copy: "Use jump logic to make every answer feel considered. Branching paths keep forms short, relevant, and human." },
  { icon: "palette" as IconName, title: "Make it unmistakably yours", copy: "Set a visual rhythm with colors, type, backgrounds, and a custom ending. Your form should feel like part of your work." },
  { icon: "table" as IconName, title: "See the shape of answers", copy: "A calm response table makes patterns easy to spot. Filter, sort, and export when it is time to do something with them." },
  { icon: "share" as IconName, title: "Share it anywhere", copy: "Send a link, embed it in a page, or let someone scan a QR code. SpaceForm meets people where they already are." },
  { icon: "team" as IconName, title: "Build together", copy: "Invite teammates, keep projects tidy, and give everyone the context they need without another sprawling workspace." },
  { icon: "spark" as IconName, title: "Start with a useful blank", copy: "Templates take the first bit of friction away, while a flexible editor keeps the final form entirely yours." },
];

function FeatureGrid() {
  return <section className="sf-feature-grid" id="features-grid"><div className="sf-card-grid">{featureCards.map((feature) => <article className="sf-feature-card" key={feature.title}><div className="sf-card-icon"><Icon name={feature.icon} /></div><h3>{feature.title}</h3><p>{feature.copy}</p><a href="/features" className="sf-card-link">Learn more <Icon name="arrow" /></a></article>)}</div></section>;
}

function DemoSection() {
  return <section className="sf-demo sf-container"><div className="sf-demo-copy"><span className="sf-overline">HOW IT WORKS</span><h2>Less form. More conversation.</h2><p>Start with a clear question, then let the answers guide what comes next. SpaceForm helps you collect signal without making people work for it.</p><Button quiet href="/features">See all features</Button></div><div className="sf-demo-visual"><div className="sf-annotation sf-annotation-one"><span>01</span><b>Clear by default</b><small>One thing at a time.</small></div><MiniForm /><div className="sf-annotation sf-annotation-two"><span>02</span><b>Made to move</b><small>Share when it is ready.</small></div></div></section>;
}

function HomeHero() {
  return <section className="sf-hero sf-container"><div className="sf-hero-inner"><span className="sf-overline">FORMS WITH A POINT OF VIEW</span><h1>Ask better.<br /><em>Hear more.</em></h1><p>Create thoughtful forms that make it easy for people to give useful answers—and easy for you to do something with them.</p><div className="sf-hero-actions"><Button>Create your first form</Button><Button quiet href="/templates">Browse templates</Button></div><span className="sf-hero-note">Free to start · No credit card required</span></div><div className="sf-hero-figure" aria-hidden="true"><div className="sf-orbit sf-orbit-one" /><div className="sf-orbit sf-orbit-two" /><div className="sf-hero-sun"><span>the good<br />questions<br /><b>live here</b></span></div><span className="sf-figure-label sf-figure-label-one">01 / clarity</span><span className="sf-figure-label sf-figure-label-two">02 / context</span></div></section>;
}

function HomePage() {
  return <div className="sf-shell"><Header /><main><HomeHero /><Metrics /><DemoSection /><section className="sf-feature-intro sf-container"><SectionHeading overline="WHY SPACEFORM" title="A little more care in every question." copy="The tools you need to make forms feel less like paperwork and more like a good conversation." align="center" /><FeatureGrid /></section><section className="sf-quote sf-container"><div className="sf-quote-mark">“</div><blockquote>Good questions do not just collect information. They make people feel understood.</blockquote><span className="sf-quote-rule" /></section><CtaBand /></main><Footer /></div>;
}

function CtaBand() {
  return <section className="sf-cta"><div className="sf-cta-inner"><span className="sf-overline">A BETTER WAY TO ASK</span><h2>Your next good question<br /><em>starts here.</em></h2><Button>Create a free form</Button><p>No credit card. No awkward onboarding. Just a blank page and a useful place to begin.</p></div></section>;
}

function FeaturePage() {
  return <div className="sf-shell"><Header /><main><section className="sf-page-hero sf-container"><span className="sf-overline">FEATURES</span><h1>Everything you need<br /><em>to ask with intention.</em></h1><p>SpaceForm keeps the craft in your hands and the busywork out of the way.</p></section><section className="sf-feature-story sf-container"><div className="sf-story-copy"><span className="sf-overline">JUMP LOGIC</span><h2>Every answer can open a better path.</h2><p>Show only what is relevant, with simple conditions that feel natural to the person answering. No maze of menus required.</p><ul className="sf-check-list"><li><Icon name="check" />Branch by answer, score, or completion</li><li><Icon name="check" />Keep optional questions out of the way</li><li><Icon name="check" />Preview every route before you share</li></ul></div><div className="sf-logic-card" aria-label="Example jump logic"><span className="sf-overline">IF / THEN</span><div className="sf-logic-node sf-logic-question">Are you working with a team? <b>Yes</b></div><div className="sf-logic-line" /><div className="sf-logic-branches"><div><span>YES</span><strong>Tell us who is involved.</strong></div><div><span>NO</span><strong>What would make it easier?</strong></div></div></div></section><section className="sf-light-section"><div className="sf-container"><SectionHeading overline="THE DETAILS MATTER" title="Flexible enough to sound like you." copy="From a one-question pulse check to a long-form intake, create a visual language that makes sense for your audience." /><FeatureGrid /></div></section><CtaBand /></main><Footer /></div>;
}

const templates = [
  ["01", "Client discovery", "Learn what a new client needs before the first call."],
  ["02", "Event feedback", "Turn a full room into clear next steps."],
  ["03", "Team pulse", "A small, regular check-in for the people doing the work."],
  ["04", "Project intake", "Get the context you need to start well."],
  ["05", "Customer research", "Ask open questions without losing the thread."],
  ["06", "Blank canvas", "A good place to start when the question is yours."],
];

function TemplatesPage() {
  return <div className="sf-shell"><Header /><main><section className="sf-page-hero sf-container"><span className="sf-overline">TEMPLATES</span><h1>Start with a question.<br /><em>Not a blank page.</em></h1><p>Six considered starting points for the conversations you have every day.</p></section><section className="sf-template-grid sf-container">{templates.map(([number, title, copy]) => <a className="sf-template-card" href="/signup" key={title}><span className="sf-template-number">{number}</span><div className="sf-template-art" aria-hidden="true"><span /><span /><span /></div><h2>{title}</h2><p>{copy}</p><span className="sf-card-link">Use this template <Icon name="arrow" /></span></a>)}</section><CtaBand /></main><Footer /></div>;
}

const plans = [
  { name: "Starter", price: "$0", detail: "For trying a thoughtful form on for size.", features: ["Unlimited forms", "25 question types", "100 responses / month", "Shareable link"] },
  { name: "Pro", price: "$19", detail: "For independent makers and small teams.", features: ["Everything in Starter", "Unlimited responses", "Jump logic and custom themes", "Embed and QR sharing"], featured: true },
  { name: "Team", price: "$49", detail: "For teams who ask together.", features: ["Everything in Pro", "Up to 10 collaborators", "Response exports", "Shared workspaces"] },
];

function PricingPage() {
  return <div className="sf-shell"><Header /><main><section className="sf-page-hero sf-container"><span className="sf-overline">PRICING</span><h1>Simple plans for<br /><em>better questions.</em></h1><p>Start free, then grow into the plan that fits how you work. Monthly pricing, no surprises.</p></section><section className="sf-pricing-grid sf-container">{plans.map((plan) => <article className={`sf-price-card${plan.featured ? " sf-price-featured" : ""}`} key={plan.name}>{plan.featured && <span className="sf-price-badge">MOST POPULAR</span>}<span className="sf-overline">{plan.name.toUpperCase()}</span><div className="sf-price"><strong>{plan.price}</strong><span>/ month</span></div><p>{plan.detail}</p><a className={`sf-button${plan.featured ? "" : " sf-button-quiet"}`} href="/signup">Choose {plan.name} <Icon name="arrow" /></a><ul className="sf-check-list">{plan.features.map((feature) => <li key={feature}><Icon name="check" />{feature}</li>)}</ul></article>)}</section><p className="sf-billing-note"><span>NOTE</span> Billing and payment processing are not live in this demo. These plans are presented for product direction only.</p><CtaBand /></main><Footer /></div>;
}

const faqItems = [
  ["What is SpaceForm?", "SpaceForm is a focused form builder for people who care about the quality of the answers they receive. It combines a calm editor, useful question types, and simple sharing tools."],
  ["How many question types are there?", "The landing experience highlights 25+ question types, with more being added over time. The signup experience references 27 available types as the product expands."],
  ["Can I use my own branding?", "Yes. Pro and Team plans are designed to support custom colors, type, backgrounds, a branded ending, and a clean share experience."],
  ["Does SpaceForm process payments?", "Not yet. The billing and payment screens in this public concept are illustrative only; no payment processing or SaaS subscription is live here."],
  ["Can I embed a form on my site?", "Yes, embed, share-link, and QR-code patterns are part of the product direction. The exact implementation will depend on the form and your publishing setup."],
  ["Can my team work together?", "Team is designed for shared workspaces and up to 10 collaborators, so everyone can contribute without passing files around."],
];

function FaqPage() {
  return <div className="sf-shell"><Header /><main><section className="sf-page-hero sf-container"><span className="sf-overline">FAQ</span><h1>Good to know<br /><em>before you begin.</em></h1><p>A few answers about building, sharing, and making SpaceForm yours.</p></section><section className="sf-faq-list sf-container">{faqItems.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</section><CtaBand /></main><Footer /></div>;
}

export function MarketingHome() {
  return <HomePage />;
}

export function MarketingPage({ section = "features" }: { section?: MarketingSection }) {
  if (section === "templates") return <TemplatesPage />;
  if (section === "pricing") return <PricingPage />;
  if (section === "faq") return <FaqPage />;
  return <FeaturePage />;
}

export function LegalPage({ kind = "privacy" }: { kind?: "privacy" | "terms" | "refund" }) {
  const content = {
    privacy: { label: "PRIVACY", title: "Privacy, plainly stated.", intro: "This is a concise product-facing privacy overview for the SpaceForm concept. It is not a substitute for a final legal policy.", sections: [["What we collect", "We only want the information needed to provide the service: account details, form content, responses, and basic product usage information. We do not sell personal information."], ["How we use it", "We use information to operate SpaceForm, keep it secure, improve the product, and respond to support requests. We do not claim that processing is live in this demo."], ["Your choices", "You can ask about, export, correct, or delete your account information. Contact hello@spaceform.site for questions about a future production service."]]},
    terms: { label: "TERMS", title: "A clear agreement.", intro: "These concept terms describe the intended relationship between SpaceForm and its users. They should be reviewed before any production launch.", sections: [["Using SpaceForm", "Use the service lawfully and only with content you have permission to collect. You are responsible for the questions you publish and the responses you receive."], ["Your content", "You keep ownership of the forms and content you create. You give SpaceForm the limited permission needed to host and display that content while using the service."], ["Availability", "This public-facing demo does not provide live SaaS processing, storage guarantees, or a production service-level commitment."]]},
    refund: { label: "REFUNDS", title: "A fair way to unwind.", intro: "Payment and subscription processing are not live in this demo. The following is a plain-language direction for a future refund policy.", sections: [["If a future charge goes wrong", "Contact support within 14 days of a charge and tell us what happened. We will review accidental, duplicate, or materially incorrect charges fairly."], ["Cancellations", "A cancellation would stop the next renewal while preserving access according to the plan terms. We would make the timing and effective date clear before any production launch."], ["Questions", "For billing questions, email hello@spaceform.site. No payment is being requested or processed by this concept website."]]}
  }[kind];
  return <div className="sf-shell"><Header /><main><section className="sf-legal sf-container"><span className="sf-overline">{content.label}</span><h1>{content.title}</h1><p className="sf-legal-intro">{content.intro}</p><div className="sf-legal-body">{content.sections.map(([heading, copy]) => <section key={heading}><h2>{heading}</h2><p>{copy}</p></section>)}</div><a className="sf-back-link" href="/">← Back to SpaceForm</a></section></main><Footer /></div>;
}

export default MarketingHome;
