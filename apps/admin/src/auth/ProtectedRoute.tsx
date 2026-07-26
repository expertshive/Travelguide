import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Spinner } from '../ui';

function FullPageSpinner() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner label="Loading session…" />
    </div>
  );
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullPageSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <FullPageSpinner />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
