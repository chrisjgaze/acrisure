import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import MagicLinkPage from "./pages/MagicLinkPage";
import RequestMagicLinkPage from "./pages/RequestMagicLinkPage";
import CompanyDetailsPage from "./pages/CompanyDetailsPage";
import CompanyContactPage from "./pages/CompanyContactPage";
import TurnoverPage from "./pages/TurnoverPage";
import TradingArrangementsPage from "./pages/TradingArrangementsPage";
import CustomersPage from "./pages/CustomersPage";
import ReviewPage from "./pages/ReviewPage";
import PostSubmissionPage from "./pages/PostSubmissionPage";
import ClassPickerPage from "./pages/ClassPickerPage";
import CyberPage from "./pages/CyberPage";
import DNOPage from "./pages/DNOPage";
import TerrorismPage from "./pages/TerrorismPage";
import ClassReviewPage from "./pages/ClassReviewPage";
import DashboardPage from "./pages/DashboardPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import NewClientPage from "./pages/NewClientPage";
import ClientViewPage from "./pages/ClientViewPage";
import ComparatorPage from "./pages/ComparatorPage";
import AdminPage from "./pages/AdminPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import NotFound from "./pages/NotFound";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner position="top-right" />
      <Routes>
        {/* Client-facing — no auth */}
        <Route path="/invite/:token" element={<MagicLinkPage />} />
        <Route path="/invite/request" element={<RequestMagicLinkPage />} />
        <Route path="/form/classes" element={<ClassPickerPage />} />
        <Route path="/form/company" element={<CompanyDetailsPage />} />
        <Route path="/form/company-contact" element={<CompanyContactPage />} />
        <Route path="/form/financial" element={<TurnoverPage />} />
        <Route path="/form/trading" element={<TradingArrangementsPage />} />
        <Route path="/form/customers" element={<CustomersPage />} />
        <Route path="/form/review" element={<ReviewPage />} />
        <Route path="/form/submitted" element={<PostSubmissionPage />} />
        <Route path="/form/cyber" element={<CyberPage />} />
        <Route path="/form/dno" element={<DNOPage />} />
        <Route path="/form/terrorism" element={<TerrorismPage />} />
        <Route path="/form/class-review/:classKey" element={<ClassReviewPage />} />

        {/* Broker-facing — requires auth */}
        <Route path="/login" element={<AuthProvider><LoginPage /></AuthProvider>} />
        <Route path="/auth/callback" element={<AuthProvider><AuthCallbackPage /></AuthProvider>} />
        <Route path="/" element={<AuthProvider><RequireAuth><Navigate to="/dashboard" replace /></RequireAuth></AuthProvider>} />
        <Route path="/dashboard" element={<AuthProvider><RequireAuth><DashboardPage /></RequireAuth></AuthProvider>} />
        <Route path="/analytics" element={<AuthProvider><RequireAuth><AnalyticsPage /></RequireAuth></AuthProvider>} />
        <Route path="/clients/new" element={<AuthProvider><RequireAuth><NewClientPage /></RequireAuth></AuthProvider>} />
        <Route path="/clients/:id" element={<AuthProvider><RequireAuth><ClientViewPage /></RequireAuth></AuthProvider>} />
        <Route path="/clients/:id/comparator" element={<AuthProvider><RequireAuth><ComparatorPage /></RequireAuth></AuthProvider>} />
        <Route path="/admin" element={<AuthProvider><RequireAuth><RequireAdmin><AdminPage /></RequireAdmin></RequireAuth></AuthProvider>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;