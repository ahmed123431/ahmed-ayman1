import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SidebarProvider } from './contexts/SidebarContext';
import { UserProvider } from './contexts/UserContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { SearchProvider } from './contexts/SearchContext';
import { ReportSettingsProvider } from './contexts/ReportSettingsContext';
import { AssetProvider } from './contexts/AssetContext';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Subscription from './pages/Subscription';
import Projects from './pages/Projects';
import AssetManagement from './pages/AssetManagement';

import AssetDashboard from './pages/AssetDashboard';
import OptimalReplacement from './pages/OptimalReplacement';
import FMEA from './pages/FMEA';
import OperatingCosts from './pages/OperatingCosts';
import Reports from './pages/Reports';
import MaintenanceTask from './pages/MaintenanceTask';
import MaintenancePlan from './pages/MaintenancePlan';
import ReportPreview from './pages/ReportPreview';
import Settings from './pages/Settings';
import ChangePassword from './pages/ChangePassword';
import Alerts from './pages/Alerts';
import CostAnalysis from './pages/CostAnalysis';
import FloatingAIChat from './components/FloatingAIChat';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <UserProvider>
          <SidebarProvider>
            <SearchProvider>
              <ReportSettingsProvider>
                <AssetProvider>
                  <Router>
                    <Routes>
                      {/* Authentication */}
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<SignUp />} />

                      {/* Protected Routes */}
                      <Route element={<ProtectedRoute />}>

                    {/* Main Flow */}
                    <Route path="/subscription" element={<Subscription />} />
                    <Route path="/" element={<Projects />} />
                    <Route path="/assets" element={<AssetManagement />} />
                    <Route path="/dashboard" element={<AssetManagement />} />
                    <Route path="/asset-dashboard/:assetId" element={<AssetDashboard />} />

                    {/* Sidebar Navigation Pages */}
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/optimal-replacement" element={<OptimalReplacement />} />
                    <Route path="/fmea" element={<FMEA />} />
                    <Route path="/maintenance-tasks" element={<MaintenanceTask />} />
                    <Route path="/maintenance-plan" element={<MaintenancePlan />} />
                    <Route path="/cost-analysis" element={<CostAnalysis />} />
                    <Route path="/operating-costs" element={<OperatingCosts />} />
                    <Route path="/reports" element={<Reports />} />
                      <Route path="/report-preview" element={<ReportPreview />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/change-password" element={<ChangePassword />} />
                    </Route>
                  </Routes>

                  {/* Floating AI Chat Button - appears on all pages except login/signup */}
                  <FloatingAIChat />
                </Router>
              </AssetProvider>
            </ReportSettingsProvider>
            </SearchProvider>
          </SidebarProvider>
        </UserProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
