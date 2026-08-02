import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isActive, isCollapsed, toggleSidebar, toggleSidebarDesktop }) => {
  const navigate = useNavigate();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { logout, gymProfile, user } = useAuth();

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await logout();
      navigate('/');
    } catch (err) {
      console.error('Logout failed:', err);
      // Fallback navigate to login anyway
      navigate('/');
    }
  };

  return (
    <div className={`sidebar ${isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`} id="sidebar">
      <div className="sidebar-header d-flex justify-content-between align-items-center" style={{ paddingRight: '15px' }}>
        <div className="logo-container d-flex align-items-center">
          <i className="bi bi-broadcast-pin me-2" style={{ fontSize: '1.5rem', color: '#6366f1' }}></i>
          <h3>{gymProfile?.name || 'Trilateration IPS'}</h3>
        </div>
        <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'} d-none d-lg-block toggle-icon`} style={{ fontSize: '1.5rem', cursor: 'pointer' }} onClick={toggleSidebarDesktop}></i>
      </div>
      <ul className="sidebar-menu">
        <li>
          <NavLink to="/dashboard" end className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-speedometer2"></i> <span>Dashboard IPS</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard/position" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-geo-alt"></i> <span>Live Position Tracker</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard/tags" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-tag"></i> <span>Smart Tag & Subjek</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard/gym-layout" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-map"></i> <span>Tata Letak Denah Area</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard/device" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-broadcast"></i> <span>Anchor & Gateway</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard/settings" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-person-gear"></i> <span>Profil & Akun Pengguna</span>
          </NavLink>
        </li>
        {user?.user_metadata?.role === 'superadmin' && (
          <li>
            <NavLink to="/dashboard/superadmin" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
              <i className="bi bi-shield-lock-fill"></i> <span>Superadmin Panel</span>
            </NavLink>
          </li>
        )}
        <li className="mt-3">
          <a href="#" id="logout-btn" onClick={handleLogout}>
            <i className="bi bi-box-arrow-right"></i> <span>Keluar</span>
          </a>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
