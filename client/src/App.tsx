import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthScreen, Dashboard, ForgotPassword, FormBuilder, NewForm, PublicForm, ResponsesPage } from "./pages/AppPages";
import { LegalPage, MarketingHome, MarketingPage } from "./pages/Marketing";

function Router() {
  return (
    <Switch>
      <Route path="/" component={MarketingHome} />
      <Route path="/features" component={() => <MarketingPage section="features" />} />
      <Route path="/templates" component={() => <MarketingPage section="templates" />} />
      <Route path="/pricing" component={() => <MarketingPage section="pricing" />} />
      <Route path="/faq" component={() => <MarketingPage section="faq" />} />
      <Route path="/privacy" component={() => <LegalPage kind="privacy" />} />
      <Route path="/terms" component={() => <LegalPage kind="terms" />} />
      <Route path="/refund" component={() => <LegalPage kind="refund" />} />
      <Route path="/signup" component={() => <AuthScreen mode="signup" />} />
      <Route path="/login" component={() => <AuthScreen mode="login" />} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/forms/new" component={NewForm} />
      <Route path="/forms/:id/responses" component={ResponsesPage} />
      <Route path="/forms/:id" component={FormBuilder} />
      <Route path="/f/:slug" component={PublicForm} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
