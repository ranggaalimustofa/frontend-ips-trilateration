import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { gooeyToast } from 'goey-toast';
import { formatDateIndo } from '../utils/dateFormatter';

const DeviceSettings = () => {
  const [activeTab, setActiveTab] = useState('anchors'); // 'anchors' | 'firmware'
  const [anchors, setAnchors] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Firmware Upload State
  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return '-';
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    return `${formatDateIndo(lastSeen)} ${timeStr}`;
  };
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Forms State
  const [anchorForm, setAnchorForm] = useState({
    anchorId: '',
    name: '',
    ip_address: '',
    x_position: 0,
    y_position: 0,
    rssi_1m: -40.0,
    path_loss_exp: 3.2,
    status: 'active'
  });
  const [showAnchorModal, setShowAnchorModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Fetch all devices data
  const fetchDevicesData = async () => {
    try {
      setLoading(true);

      // 1. Fetch anchors (from anchor_positions table)
      const { data: anchorData, error: anchorError } = await supabase
        .from('anchor_positions')
        .select('*')
        .order('anchorId', { ascending: true });
      if (anchorError) throw anchorError;
      setAnchors(anchorData || []);

    } catch (err) {
      console.error('Error fetching devices data:', err);
      gooeyToast.error('Gagal mengambil data perangkat: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedDefaultAnchors = async () => {
    try {
      setLoading(true);
      const defaultAnchors = [
        { anchorId: 'anchor-01', name: 'Anchor Node A', ip_address: '192.168.1.101', x_position: 0.00, y_position: 0.00, rssi_1m: -40.00, path_loss_exp: 3.20, status: 'active' },
        { anchorId: 'anchor-02', name: 'Anchor Node B', ip_address: '192.168.1.102', x_position: 3.50, y_position: 7.90, rssi_1m: -40.00, path_loss_exp: 3.20, status: 'active' },
        { anchorId: 'anchor-03', name: 'Anchor Node C', ip_address: '192.168.1.103', x_position: 7.90, y_position: 0.00, rssi_1m: -58.00, path_loss_exp: 1.04, status: 'active' }
      ];

      const { error } = await supabase
        .from('anchor_positions')
        .upsert(defaultAnchors);

      if (error) throw error;

      gooeyToast.success('3 Anchor Node default berhasil dimuat!');
      fetchDevicesData();
    } catch (err) {
      console.error('Error seeding default anchors:', err);
      gooeyToast.error('Gagal memuat anchor default: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevicesData();
  }, []);

  // --- UWB TAGS ACTIONS REMOVED (Moved to dedicated Tags.jsx CRUD page) ---

  // --- UWB ANCHORS ACTIONS ---
  const handleOpenAddAnchor = () => {
    setIsEditMode(false);
    setAnchorForm({
      anchorId: '',
      name: '',
      ip_address: '',
      x_position: 0,
      y_position: 0,
      rssi_1m: -40.0,
      path_loss_exp: 3.2,
      status: 'active'
    });
    setShowAnchorModal(true);
  };

  const handleOpenEditAnchor = (anchor) => {
    setIsEditMode(true);
    setAnchorForm({
      anchorId: anchor.anchorId,
      name: anchor.name || '',
      ip_address: anchor.ip_address || '',
      x_position: Number(anchor.x_position || 0),
      y_position: Number(anchor.y_position || 0),
      rssi_1m: Number(anchor.rssi_1m !== undefined && anchor.rssi_1m !== null ? anchor.rssi_1m : -40.0),
      path_loss_exp: Number(anchor.path_loss_exp !== undefined && anchor.path_loss_exp !== null ? anchor.path_loss_exp : 3.2),
      status: anchor.status || 'active'
    });
    setShowAnchorModal(true);
  };

  const handleSaveAnchor = () => {
    if (!anchorForm.anchorId || !anchorForm.name) {
      gooeyToast.error('ID dan Nama Anchor wajib diisi.');
      return;
    }

    const savePromise = (async () => {
      const payload = {
        name: anchorForm.name.trim(),
        ip_address: anchorForm.ip_address.trim(),
        x_position: Number(anchorForm.x_position),
        y_position: Number(anchorForm.y_position),
        rssi_1m: Number(anchorForm.rssi_1m),
        path_loss_exp: Number(anchorForm.path_loss_exp),
        status: anchorForm.status
      };

      if (isEditMode) {
        const { error } = await supabase
          .from('anchor_positions')
          .update(payload)
          .eq('anchorId', anchorForm.anchorId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('anchor_positions')
          .insert([{ anchorId: anchorForm.anchorId.trim(), ...payload }]);
        if (error) throw error;
      }

      setShowAnchorModal(false);
      fetchDevicesData();
    })();

    gooeyToast.promise(savePromise, {
      loading: isEditMode ? 'Memperbarui data anchor...' : 'Menambahkan anchor baru...',
      success: isEditMode ? 'Anchor berhasil diperbarui!' : 'Anchor baru berhasil ditambahkan!',
      error: (err) => `Gagal menyimpan: ${err.message}`
    });
  };

  const handleDeleteAnchor = async (anchorId) => {
    const confirm = await Swal.fire({
      title: 'Hapus Anchor?',
      text: `Apakah Anda yakin ingin menghapus anchor "${anchorId}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f87171',
      confirmButtonText: 'Hapus',
      cancelButtonText: 'Batal'
    });

    if (confirm.isConfirmed) {
      const deletePromise = (async () => {
        const { error } = await supabase.from('anchor_positions').delete().eq('anchorId', anchorId);
        if (error) throw error;
        fetchDevicesData();
      })();

      gooeyToast.promise(deletePromise, {
        loading: 'Menghapus anchor...',
        success: 'Anchor berhasil dihapus.',
        error: (err) => `Gagal menghapus: ${err.message}`
      });
    }
  };

  // --- FIRMWARE FLAPPING ACTIONS ---
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFlashFirmware = () => {
    Swal.fire({
      title: 'Flash Firmware?',
      text: `File "${selectedFile.name}" akan di-upload dan di-flash ke unit MCU MCU terhubung.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#6366f1',
      confirmButtonText: 'Mulai Flash'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: 'Flashing...',
          text: 'Mengirimkan payload firmware biner ke MCU via Serial OTA...',
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
            setTimeout(() => {
              Swal.close(); // Close the loading Swal spinner
              gooeyToast.success('Firmware berhasil di-flash. Perangkat me-reboot otomatis.');
              setSelectedFile(null);
            }, 3000);
          }
        });
      }
    });
  };

  return (
    <div id="device-settings-content" className="p-2">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Pengaturan Anchor & Gateway MCU</h2>
          <p className="text-muted mb-0">Kelola titik koordinat Node Anchor IPS dan Pembaruan Firmware MCU</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <ul className="nav nav-tabs mb-4 border-bottom" style={{ gap: '5px' }}>
        <li className="nav-item">
          <button
            className={`nav-link px-4 py-2 fw-semibold ${activeTab === 'anchors' ? 'active text-primary border-bottom border-primary border-3' : 'text-muted border-0'}`}
            onClick={() => setActiveTab('anchors')}
          >
            <i className="bi bi-broadcast-pin me-2"></i>Anchor Node
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link px-4 py-2 fw-semibold ${activeTab === 'firmware' ? 'active text-primary border-bottom border-primary border-3' : 'text-muted border-0'}`}
            onClick={() => setActiveTab('firmware')}
          >
            <i className="bi bi-cpu-fill me-2"></i>Pembaruan Firmware
          </button>
        </li>
      </ul>

      {/* Tab Contents */}
      {loading && activeTab !== 'firmware' ? (
        <div className="text-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Memuat data dari database Supabase...</p>
        </div>
      ) : (
        <div>
          {/* UWB TAGS TAB REMOVED (Moved to Tags.jsx CRUD page) */}

          {/* 2. UWB ANCHORS TAB */}
          {activeTab === 'anchors' && (
            <div className="data-table-container">
              <div className="table-header">
                <div>
                  <h5>Daftar Anchor Node (Pemancar)</h5>
                  <p className="text-muted mb-0">Node referensi koordinat UWB untuk kalkulasi trilaterasi</p>
                </div>
                <button className="btn btn-primary-hover-reverse btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5" onClick={handleOpenAddAnchor} style={{ borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                  <i className="bi bi-plus-circle fs-6"></i> Tambah Anchor
                </button>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID Anchor</th>
                      <th>Nama Anchor</th>
                      <th>Alamat IP</th>
                      <th>Koordinat X, Y</th>
                      <th>Kalibrasi (1m / Path Loss n)</th>
                      <th>Status Perangkat</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anchors.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center p-5">
                          <div className="py-3">
                            <i className="bi bi-broadcast text-muted opacity-50" style={{ fontSize: '3rem' }}></i>
                            <h6 className="mt-3 fw-bold text-dark">Belum ada Anchor Node yang terdaftar</h6>
                            <p className="text-muted small mb-3">Tambahkan node anchor fisik atau muat data anchor default untuk pengujian.</p>
                            <div className="d-flex justify-content-center gap-2">
                              <button className="btn btn-primary btn-sm rounded-pill px-3" onClick={handleOpenAddAnchor}>
                                <i className="bi bi-plus-circle me-1"></i> Tambah Anchor Manual
                              </button>
                              <button className="btn btn-outline-primary btn-sm rounded-pill px-3" onClick={handleSeedDefaultAnchors}>
                                <i className="bi bi-magic me-1"></i> Muat 3 Anchor Default
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      anchors.map((anchor) => (
                        <tr key={anchor.anchorId}>
                          <td className="fw-semibold font-monospace">{anchor.anchorId}</td>
                          <td className="fw-semibold">{anchor.name}</td>
                          <td>
                            <span className="badge bg-light text-dark border font-monospace" style={{ fontSize: '11px' }}>
                              <i className="bi bi-ethernet me-1 text-primary"></i>
                              {anchor.ip_address || 'Belum diatur'}
                            </span>
                          </td>
                          <td className="fw-semibold font-monospace">
                            X: {Number(anchor.x_position).toFixed(2)}m, Y: {Number(anchor.y_position).toFixed(2)}m
                          </td>
                          <td>
                            <span className="badge border px-2 py-1 font-monospace" style={{ fontSize: '11px', backgroundColor: '#e0e7ff', color: '#4338ca', borderColor: '#c7d2fe' }}>
                              A: {anchor.rssi_1m ?? -40} dBm | n: {anchor.path_loss_exp ?? 3.2}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${anchor.status === 'active' ? 'bg-success' : 'bg-danger'}`}>
                              {anchor.status === 'active' ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button className="btn-action btn-edit" title="Edit Posisi & Kalibrasi" onClick={() => handleOpenEditAnchor(anchor)}>
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button className="btn-action btn-delete" title="Hapus" onClick={() => handleDeleteAnchor(anchor.anchorId)}>
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. FIRMWARE FLAPPING TAB */}
          {activeTab === 'firmware' && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-4 bg-light p-3 rounded-3">
                <div>
                  <h5 className="mb-0 text-dark fw-bold">Pembaruan Firmware MCU</h5>
                  <p className="text-muted mb-0 small">Fitur untuk mem-flash memori controller (ESP/AVR) secara langsung via Web Serial OTA</p>
                </div>
                <button className="btn btn-primary px-4 py-2" disabled={!selectedFile} onClick={handleFlashFirmware}>
                  <i className="bi bi-lightning-charge-fill me-2"></i> Flash ke Perangkat
                </button>
              </div>

              <div className="row justify-content-center mt-5">
                <div className="col-md-9 col-lg-7">
                  <div
                    className="upload-area text-center bg-white rounded-4 shadow-sm"
                    style={{
                      border: `3px dashed ${isDragging ? '#10b981' : '#6366f1'}`,
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      transform: isDragging ? 'scale(1.02)' : 'scale(1)',
                      backgroundColor: isDragging ? '#f0fff8' : '#ffffff'
                    }}
                    onClick={triggerFileSelect}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                      accept=".bin,.hex"
                    />

                    <div className="py-5 px-4">
                      {selectedFile ? (
                        <div className="selected-file-info zoom-in">
                          <div className="d-inline-block position-relative mb-3">
                            <i className="bi bi-file-earmark-zip-fill text-success" style={{ fontSize: '5rem' }}></i>
                            <i className="bi bi-check-circle-fill text-white bg-success rounded-circle position-absolute" style={{ fontSize: '1.5rem', bottom: '10px', right: '-10px', border: '3px solid white' }}></i>
                          </div>
                          <h4 className="mt-2 text-dark font-weight-bold">{selectedFile.name}</h4>
                          <span className="badge bg-light text-dark px-3 py-2 mt-2" style={{ border: '1px solid #ddd' }}>
                            <i className="bi bi-hdd-fill text-secondary me-2"></i>
                            {(selectedFile.size / 1024).toFixed(2)} KB
                          </span>
                          <p className="text-muted mt-3 mb-0" style={{ fontSize: '0.85rem' }}>Klik area ini lagi untuk mengganti file</p>
                        </div>
                      ) : (
                        <div className="upload-prompt">
                          <i className={`bi bi-cloud-arrow-up-fill ${isDragging ? 'text-success' : 'text-primary'}`} style={{ fontSize: '5rem' }}></i>
                          <h3 className="mt-3 font-weight-bold">Unggah File Firmware</h3>
                          <p className="text-muted mb-0">Klik area ini atau seret file biner (<b>.bin</b> / <b>.hex</b>) ke sini</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-center mt-4 animate-fade-in">
                    <p className="text-muted d-inline-block me-3 mb-0" style={{ fontSize: '0.95rem' }}>Belum memiliki file biner terbaru?</p>
                    <a href="#" className="btn btn-outline-primary rounded-pill px-4 py-2" style={{ transition: 'all 0.3s' }}>
                      <i className="bi bi-download me-2"></i> Unduh Firmware Resmi
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL TAG REMOVED (Moved to Tags.jsx CRUD page) */}

      {/* MODAL ANCHOR */}
      {showAnchorModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{isEditMode ? 'Edit Konfigurasi Anchor' : 'Tambah Anchor Node Baru'}</h5>
                <button type="button" className="btn-close" onClick={() => setShowAnchorModal(false)}></button>
              </div>
              <div className="modal-body">
                <form>
                  <div className="mb-3">
                    <label className="form-label">ID Anchor</label>
                    <input
                      type="text"
                      className="form-control"
                      value={anchorForm.anchorId}
                      disabled={isEditMode}
                      onChange={(e) => setAnchorForm({ ...anchorForm, anchorId: e.target.value })}
                      placeholder="Cth: anchor-04"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nama Node Anchor</label>
                    <input
                      type="text"
                      className="form-control"
                      value={anchorForm.name}
                      onChange={(e) => setAnchorForm({ ...anchorForm, name: e.target.value })}
                      placeholder="Cth: Anchor Node Timur"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Alamat IP Anchor (MCU Gateway)</label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      value={anchorForm.ip_address}
                      onChange={(e) => setAnchorForm({ ...anchorForm, ip_address: e.target.value })}
                      placeholder="Cth: 192.168.1.101"
                    />
                  </div>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">Posisi Koordinat X (m)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={anchorForm.x_position}
                        onChange={(e) => setAnchorForm({ ...anchorForm, x_position: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">Posisi Koordinat Y (m)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={anchorForm.y_position}
                        onChange={(e) => setAnchorForm({ ...anchorForm, y_position: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-6 mb-3">
                      <label className="form-label">RSSI 1 Meter (A in dBm)</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        value={anchorForm.rssi_1m}
                        onChange={(e) => setAnchorForm({ ...anchorForm, rssi_1m: e.target.value })}
                        placeholder="-40.0"
                        required
                      />
                      <small className="text-muted" style={{ fontSize: '10px' }}>Kekuatan sinyal referensi jarak 1m</small>
                    </div>
                    <div className="col-6 mb-3">
                      <label className="form-label">Path Loss Exponent (n)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control"
                        value={anchorForm.path_loss_exp}
                        onChange={(e) => setAnchorForm({ ...anchorForm, path_loss_exp: e.target.value })}
                        placeholder="3.2"
                        required
                      />
                      <small className="text-muted" style={{ fontSize: '10px' }}>Faktor redaman propagasi ruangan</small>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Status Perangkat</label>
                    <select
                      className="form-select"
                      value={anchorForm.status}
                      onChange={(e) => setAnchorForm({ ...anchorForm, status: e.target.value })}
                    >
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif</option>
                    </select>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAnchorModal(false)}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={handleSaveAnchor}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceSettings;
