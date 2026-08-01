import React from 'react';
import { useAuth } from '../context/AuthContext';

const TopNavbar = () => {
  const { user } = useAuth();
  const email = user?.email || 'admin@fittrack.com';
  const name = user?.user_metadata?.name || email.split('@')[0];
  const nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1);
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="top-navbar">
      <div className="search-bar">
        <i className="bi bi-search"></i>
        <input type="text" placeholder="Cari subjek, tag, laporan, dll..." />
      </div>
      <div className="user-profile">
        <div className="user-avatar">{initial}</div>
        <div>
          <div className="fw-bold">{nameCapitalized}</div>
          <div className="text-muted small">{email}</div>
        </div>
      </div>
    </div>
  );
};

export default TopNavbar;
