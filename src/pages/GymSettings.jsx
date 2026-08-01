import React from 'react';
import GymLayoutManager from '../components/GymLayoutManager';

const GymSettings = () => {
  return (
    <div id="gym-settings-content" className="p-2">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Pengaturan Tempat Gym</h2>
          <p className="text-muted mb-0">Kelola denah lantai dan area ruangan gym secara interaktif</p>
        </div>
      </div>
      <GymLayoutManager />
    </div>
  );
};

export default GymSettings;
