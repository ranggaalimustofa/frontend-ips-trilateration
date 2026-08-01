import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import TopNavbar from '../components/TopNavbar';

const DashboardLayout = () => {
  const [sidebarActive, setSidebarActive] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebarMobile = () => {
    setSidebarActive(!sidebarActive);
  };
  
  const toggleSidebarDesktop = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div id="dashboard" style={{ display: 'block' }}>
      {/* Mobile Toggle Button */}
      <button className="mobile-toggle" id="mobile-toggle" onClick={toggleSidebarMobile}>
        <i className={`bi ${sidebarActive ? 'bi-chevron-left' : 'bi-chevron-right'}`}></i>
      </button>

      {/* Sidebar */}
      <Sidebar isActive={sidebarActive} isCollapsed={sidebarCollapsed} toggleSidebar={toggleSidebarMobile} toggleSidebarDesktop={toggleSidebarDesktop} />

      {/* Main Content */}
      <div className={`main-content ${sidebarCollapsed ? 'expanded' : ''}`}>
        <TopNavbar />
        
        {/* Child Routes */}
        <Outlet />
      </div>
    </div>
  );
};

export default DashboardLayout;
