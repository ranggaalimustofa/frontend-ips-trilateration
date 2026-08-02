import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import PositionMonitoring from './pages/PositionMonitoring';
import Settings from './pages/Settings';
import GymSettings from './pages/GymSettings';
import DeviceSettings from './pages/DeviceSettings';
import Tags from './pages/Tags';
import Superadmin from './pages/Superadmin';
import { AuthProvider, useAuth } from './context/AuthContext';
import { GooeyToaster } from 'goey-toast';
import 'goey-toast/styles.css';

// Router guard to protect dashboard routes
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100" style={{ backgroundColor: '#f8f9fa' }}>
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Memuat...</span>
          </div>
          <p className="text-muted">Memverifikasi sesi Anda...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

// Route check to prevent logged-in users from seeing the login page again
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Route guard to protect superadmin routes
const SuperadminRoute = ({ children }) => {
  const { user } = useAuth();
  if (user?.user_metadata?.role !== 'superadmin') {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <GooeyToaster position="top-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="position" element={<PositionMonitoring />} />
            <Route path="tags" element={<Tags />} />
            <Route path="settings" element={<Settings />} />
            <Route path="gym-layout" element={<GymSettings />} />
            <Route path="device" element={<DeviceSettings />} />
            <Route path="superadmin" element={<SuperadminRoute><Superadmin /></SuperadminRoute>} />
          </Route>
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
