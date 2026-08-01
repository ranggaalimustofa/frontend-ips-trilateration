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
          <i className="bi bi-activity me-2" style={{ fontSize: '1.5rem' }}></i>
          <h3>{gymProfile?.name || 'FitTrack Pro'}</h3>
        </div>
        <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-left'} d-none d-lg-block toggle-icon`} style={{ fontSize: '1.5rem', cursor: 'pointer' }} onClick={toggleSidebarDesktop}></i>
      </div>
      <ul className="sidebar-menu">
        <li>
          <NavLink to="/dashboard" end className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-speedometer2"></i> <span>Dashboard</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard/position" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-geo-alt"></i> <span>Monitoring Posisi</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard/members" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-people"></i> <span>Data Member</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard/presence" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-calendar-check"></i> <span>Data Kehadiran</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard/tags" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-tag"></i> <span>Manajemen Tag</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/dashboard/reports" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
            <i className="bi bi-file-earmark-bar-graph"></i> <span>Laporan</span>
          </NavLink>
        </li>
        <li>
          <a 
            href="#" 
            className="menu-item" 
            onClick={(e) => { e.preventDefault(); setIsSettingsOpen(!isSettingsOpen); }}
          >
            <i className="bi bi-gear"></i> <span>Pengaturan</span>
            <i className={`bi bi-chevron-${isSettingsOpen ? 'up' : 'down'} ms-auto`} style={{fontSize: '0.8rem', marginRight: 0}}></i>
          </a>
          {isSettingsOpen && (
            <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
              <li>
                <NavLink to="/dashboard/settings" end className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} style={{ paddingLeft: '45px', fontSize: '0.95em' }} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
                  <i className="bi bi-circle" style={{ fontSize: '0.5rem', marginRight: '10px' }}></i> <span>Profil</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/dashboard/gym-layout" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} style={{ paddingLeft: '45px', fontSize: '0.95em' }} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
                  <i className="bi bi-circle" style={{ fontSize: '0.5rem', marginRight: '10px' }}></i> <span>Denah Lokasi</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/dashboard/device" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} style={{ paddingLeft: '45px', fontSize: '0.95em' }} onClick={() => window.innerWidth <= 992 && toggleSidebar()}>
                  <i className="bi bi-circle" style={{ fontSize: '0.5rem', marginRight: '10px' }}></i> <span>Perangkat MCU</span>
                </NavLink>
              </li>
            </ul>
          )}
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
