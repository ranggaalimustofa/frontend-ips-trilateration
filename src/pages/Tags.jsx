import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { gooeyToast } from 'goey-toast';
import { formatDateIndo } from '../utils/dateFormatter';

const Tags = () => {
  const [tags, setTags] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua Status');
  const [batteryFilter, setBatteryFilter] = useState('Semua Baterai');

  // Form Modal State
  const [showModal, setShowModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tagForm, setTagForm] = useState({ tagId: '', memberId: '' });

  // Load tags and members
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch tags and nested members
      const { data: tagData, error: tagError } = await supabase
        .from('tags')
        .select('*, members(name)')
        .order('created_at', { ascending: false });
      if (tagError) throw tagError;
      setTags(tagData || []);

      // 2. Fetch members for mapping dropdown
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('memberId, name')
        .order('name', { ascending: true });
      if (memberError) throw memberError;
      setMembers(memberData || []);

    } catch (err) {
      console.error('Error fetching tags data:', err);
      gooeyToast.error('Gagal Memuat Data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Format dynamic relative last seen string
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

  // CRUD Actions
  const handleOpenAdd = () => {
    setIsEditMode(false);
    setTagForm({ tagId: '', memberId: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (tag) => {
    setIsEditMode(true);
    setTagForm({ tagId: tag.tagId, memberId: tag.memberId || '' });
    setShowModal(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!tagForm.tagId.trim()) {
      gooeyToast.warning('ID Tag wajib diisi!');
      return;
    }

    const savePromise = (async () => {
      if (isEditMode) {
        // Update tag linkage
        const { error } = await supabase
          .from('tags')
          .update({ memberId: tagForm.memberId || null })
          .eq('tagId', tagForm.tagId);
        if (error) throw error;
      } else {
        // Insert new tag
        const { error } = await supabase
          .from('tags')
          .insert([{ 
            tagId: tagForm.tagId.trim(), 
            memberId: tagForm.memberId || null,
            battery_level: 100,
            last_seen: new Date().toISOString()
          }]);
        if (error) throw error;
      }

      setShowModal(false);
      fetchData();
    })();

    gooeyToast.promise(savePromise, {
      loading: isEditMode ? 'Memperbarui kaitan tag...' : 'Mendaftarkan smart tag baru...',
      success: isEditMode ? 'Kaitan Tag berhasil diperbarui!' : 'Smart Tag baru berhasil didaftarkan!',
      error: (err) => `Gagal menyimpan: ${err.message}`
    });
  };

  const handleDelete = async (tagId) => {
    const confirm = await Swal.fire({
      title: 'Hapus Smart Tag?',
      text: `Apakah Anda yakin ingin menghapus tag "${tagId}" dari sistem?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f87171',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal'
    });

    if (confirm.isConfirmed) {
      const deletePromise = (async () => {
        const { error } = await supabase
          .from('tags')
          .delete()
          .eq('tagId', tagId);
        if (error) throw error;
        fetchData();
      })();

      gooeyToast.promise(deletePromise, {
        loading: 'Menghapus Smart Tag...',
        success: 'Smart Tag berhasil dihapus.',
        error: (err) => `Gagal menghapus: ${err.message}`
      });
    }
  };

  // Filter & Search Logic
  const filteredTags = tags.filter((tag) => {
    const isOnline = tag.last_seen 
      ? (new Date() - new Date(tag.last_seen) < 120000) 
      : false;
    
    const bat = tag.battery_level !== undefined ? tag.battery_level : 100;

    // Search filter
    const matchesSearch = 
      tag.tagId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tag.members?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter
    let matchesStatus = true;
    if (statusFilter === 'Online') matchesStatus = isOnline;
    if (statusFilter === 'Offline') matchesStatus = !isOnline;

    // Battery filter
    let matchesBattery = true;
    if (batteryFilter === 'Baterai Lemah') matchesBattery = bat < 20;
    if (batteryFilter === 'Baterai Sedang') matchesBattery = bat >= 20 && bat < 60;
    if (batteryFilter === 'Baterai Penuh') matchesBattery = bat >= 60;

    return matchesSearch && matchesStatus && matchesBattery;
  });

  // Calculate statistics
  const totalTagsCount = tags.length;
  const onlineTagsCount = tags.filter(t => t.last_seen && (new Date() - new Date(t.last_seen) < 120000)).length;
  const lowBatteryCount = tags.filter(t => (t.battery_level !== undefined ? t.battery_level : 100) < 20).length;

  return (
    <div id="tags-crud-content" className="animate-fade-in">
      <h2 className="mb-4">Manajemen Smart Tag</h2>

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-4 mb-3 mb-md-0">
          <div className="card border-0 shadow-sm p-4 bg-primary text-white position-relative overflow-hidden" style={{ borderRadius: '16px' }}>
            <div className="position-absolute" style={{ right: '-20px', bottom: '-20px', fontSize: '8rem', opacity: 0.15, pointerEvents: 'none' }}>
              <i className="bi bi-tags"></i>
            </div>
            <h6 className="text-white-50 text-uppercase tracking-wider small fw-bold">Total Smart Tag</h6>
            <h2 className="display-5 fw-bold mb-1">{totalTagsCount}</h2>
            <p className="mb-0 text-white-50 small">Tag terdaftar di sistem</p>
          </div>
        </div>
        
        <div className="col-md-4 mb-3 mb-md-0">
          <div className="card border-0 shadow-sm p-4 bg-success text-white position-relative overflow-hidden" style={{ borderRadius: '16px' }}>
            <div className="position-absolute" style={{ right: '-20px', bottom: '-20px', fontSize: '8rem', opacity: 0.15, pointerEvents: 'none' }}>
              <i className="bi bi-wifi"></i>
            </div>
            <h6 className="text-white-50 text-uppercase tracking-wider small fw-bold">Tag Aktif (Online)</h6>
            <h2 className="display-5 fw-bold mb-1">{onlineTagsCount}</h2>
            <p className="mb-0 text-white-50 small">Terhubung dalam 2 menit terakhir</p>
          </div>
        </div>

        <div className="col-md-4">
          <div className={`card border-0 shadow-sm p-4 ${lowBatteryCount > 0 ? 'bg-danger animate-pulse text-white' : 'bg-dark text-white'} position-relative overflow-hidden`} style={{ borderRadius: '16px', transition: 'all 0.3s' }}>
            <div className="position-absolute" style={{ right: '-20px', bottom: '-20px', fontSize: '8rem', opacity: 0.15, pointerEvents: 'none' }}>
              <i className="bi bi-battery-alert"></i>
            </div>
            <h6 className="text-white-50 text-uppercase tracking-wider small fw-bold">Baterai Lemah (&lt;20%)</h6>
            <h2 className="display-5 fw-bold mb-1">{lowBatteryCount}</h2>
            <p className="mb-0 text-white-50 small">Memerlukan pengisian daya segera</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="card border-0 shadow-sm mb-4 p-3" style={{ borderRadius: '12px' }}>
        <div className="row g-3">
          <div className="col-lg-5">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Cari berdasarkan ID Tag atau Nama Subjek..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-6 col-lg-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>Semua Status</option>
              <option>Online</option>
              <option>Offline</option>
            </select>
          </div>
          <div className="col-md-6 col-lg-3">
            <select
              className="form-select"
              value={batteryFilter}
              onChange={(e) => setBatteryFilter(e.target.value)}
            >
              <option>Semua Baterai</option>
              <option>Baterai Lemah (&lt;20%)</option>
              <option>Baterai Sedang (20%-60%)</option>
              <option>Baterai Penuh (&gt;60%)</option>
            </select>
          </div>
          <div className="col-md-12 col-lg-1 d-flex justify-content-end">
            <button className="btn btn-outline-secondary w-100" onClick={fetchData} title="Segarkan Data">
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="data-table-container">
        <div className="table-header">
          <div>
            <h5>Daftar Smart Tag & Subjek</h5>
            <p className="text-muted mb-0">Total {filteredTags.length} dari {tags.length} tag terdaftar</p>
          </div>
          <div>
            <button className="btn btn-primary-hover-reverse btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5" onClick={handleOpenAdd} style={{ borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
              <i className="bi bi-plus-circle fs-6"></i> Daftarkan Tag Baru
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-3 text-muted mb-0">Memuat data Smart Tag...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID Tag</th>
                  <th>Subjek / Pemegang Tag</th>
                  <th>Telemetri Baterai</th>
                  <th>Status Koneksi</th>
                  <th>Terakhir Terdeteksi</th>
                  <th>Tanggal Pendaftaran</th>
                  <th className="text-end">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredTags.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-5 text-muted">
                      Tidak ada data Smart Tag ditemukan yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredTags.map((tag) => {
                    const isOnline = tag.last_seen 
                      ? (new Date() - new Date(tag.last_seen) < 120000) 
                      : false;

                    const bat = tag.battery_level !== undefined ? tag.battery_level : 100;
                    
                    let batColor = 'text-success';
                    let batIcon = 'bi-battery-full';
                    if (bat < 20) {
                      batColor = 'text-danger animate-pulse';
                      batIcon = 'bi-battery text-danger animate-pulse';
                    } else if (bat < 60) {
                      batColor = 'text-warning';
                      batIcon = 'bi-battery-half';
                    }

                    return (
                      <tr key={tag.tagId}>
                        <td className="fw-semibold font-monospace">{tag.tagId}</td>
                        <td>
                          {tag.members ? (
                            <div className="d-flex align-items-center">
                              <div className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '32px', height: '32px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                {tag.members.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="fw-semibold text-dark">{tag.members.name}</span>
                            </div>
                          ) : (
                            <span className="text-muted small italic">
                              <i className="bi bi-exclamation-circle me-1"></i>Belum Dikaitkan
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex align-items-center">
                            <span className={`d-flex align-items-center fw-bold ${batColor}`}>
                              <i className={`bi ${batIcon} me-2`} style={{ fontSize: '1.25rem' }}></i>
                              {bat}%
                            </span>
                          </div>
                        </td>
                        <td>
                          {isOnline ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-3 py-1">
                              Online
                            </span>
                          ) : (
                            <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle rounded-pill px-3 py-1">
                              Offline
                            </span>
                          )}
                        </td>
                        <td className="font-monospace small">{formatLastSeen(tag.last_seen)}</td>
                        <td>{formatDateIndo(tag.created_at)}</td>
                        <td className="pe-4 text-end">
                          <div className="action-buttons justify-content-end">
                            <button
                              className="btn-action btn-edit"
                              title="Edit Pengikatan Member"
                              onClick={() => handleOpenEdit(tag)}
                            >
                              <i className="bi bi-link-45deg"></i>
                            </button>
                            <button
                              className="btn-action btn-delete"
                              title="Hapus Tag"
                              onClick={() => handleDelete(tag.tagId)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="modal fade show animate-fade-in" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: '16px' }}>
              <div className="modal-header border-bottom-0 pt-4 px-4">
                <h5 className="modal-title fw-bold text-dark">
                  {isEditMode ? (
                    <span><i className="bi bi-link-45deg text-primary me-2"></i>Kaitkan Smart Tag</span>
                  ) : (
                    <span><i className="bi bi-plus-circle text-primary me-2"></i>Daftarkan Smart Tag Baru</span>
                  )}
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              
              <form onSubmit={handleSave}>
                <div className="modal-body px-4 pb-4">
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-bold">ID Smart Tag (Kunci Utama)</label>
                    <input
                      type="text"
                      className="form-control py-2 font-monospace"
                      value={tagForm.tagId}
                      disabled={isEditMode}
                      onChange={(e) => setTagForm({ ...tagForm, tagId: e.target.value })}
                      placeholder="Cth: tag-09"
                      required
                    />
                    {!isEditMode && <div className="form-text text-muted small">Masukkan kode ID unik perangkat keras tag fisik.</div>}
                  </div>
                  
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-bold">Kaitkan dengan Anggota Gym (Member)</label>
                    <select
                      className="form-select py-2"
                      value={tagForm.memberId}
                      onChange={(e) => setTagForm({ ...tagForm, memberId: e.target.value })}
                    >
                      <option value="">-- Tanpa Kaitan (Biarkan Kosong) --</option>
                      {members.map((m) => (
                        <option key={m.memberId} value={m.memberId}>
                          {m.name} ({m.memberId})
                        </option>
                      ))}
                    </select>
                    <div className="form-text text-muted small">Pasangkan tag ini ke anggota gym yang meminjamnya hari ini.</div>
                  </div>
                </div>

                <div className="modal-footer border-top-0 pb-4 px-4">
                  <button type="button" className="btn btn-light px-3 py-2 rounded-pill" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary px-4 py-2 rounded-pill">Simpan Perubahan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tags;
