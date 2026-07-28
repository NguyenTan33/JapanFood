import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { UserRole, normalizeUserRole } from '@/types';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  loginPath?: string;
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles = ['ADMIN', 'MANAGER', 'STAFF'],
  loginPath = '/pos/login',
  children,
}) => {
  const { currentUser, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !currentUser) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${loginPath}?redirect=${redirect}`} state={{ from: location }} replace />;
  }

  const normalizedRole = normalizeUserRole(currentUser.role);
  if (!allowedRoles.includes(normalizedRole)) {
    if (normalizedRole === 'KITCHEN') {
      return <Navigate to="/kds" replace />;
    }
    if (normalizedRole === 'CUSTOMER') {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/pos" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
