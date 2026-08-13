import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from './auth/ProtectedRoute';
import AdminLayout from './layout/AdminLayout';
import DashboardPage from './pages/DashboardPage';
import DynamicTablePage from './pages/DynamicTablePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import IntegrationsPage from './pages/IntegrationsPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import RolesPage from './pages/RolesPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/db/:segment/:model" element={<DynamicTablePage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
