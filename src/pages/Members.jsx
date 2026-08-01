import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { gooeyToast } from 'goey-toast';
import { formatDateIndo } from '../utils/dateFormatter';

const Members = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    memberId: '',
    name: '',
    email: '',
    status: 'Aktif',
  });

  // Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Semua Status');

  // Fetch members from Supabase
  const fetchMembers = async () => {
    try {
      setLoading(true);
      // Query members and join with tags
      const { data, error } = await supabase
        .from('members')
        .select('*, tags(tagId)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map DB structure to page format
      const formatted = data.map((m) => ({
        id: m.memberId,
        memberId: m.memberId,
        name: m.name,
        email: m.email,
        status: m.member_status || 'Aktif',
        joinDate: m.created_at ? new Date(m.created_at).toISOString().split('T')[0] : '-',
        tagId: m.tags && m.tags.length > 0 ? m.tags.map(t => t.tagId).join(', ') : '-',
      }));
      setMembers(formatted);
    } catch (error) {
      console.error('Error fetching members:', error);
      gooeyToast.error('Gagal mengambil data member: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Open add modal & reset state
  const openAddModal = () => {
    // Auto-generate ID suggestion based on timestamp/length
    const nextNum = members.length + 1;
    const suggestedId = `M${String(nextNum).padStart(3, '0')}`;
    setFormData({
      memberId: suggestedId,
      name: '',
      email: '',
      status: 'Aktif',
    });
    setShowAddModal(true);
  };

  // Create/Save new member
  const handleSaveMember = () => {
    if (!formData.memberId || !formData.name || !formData.email) {
      gooeyToast.error('Mohon lengkapi semua field wajib (ID, Nama, dan Email)');
      return;
    }

    const savePromise = (async () => {
      const { error } = await supabase.from('members').insert([
        {
          memberId: formData.memberId.trim(),
          name: formData.name.trim(),
          email: formData.email.trim(),
          member_status: formData.status,
          created_at: new Date().toISOString()
        },
      ]);

      if (error) throw error;

      setShowAddModal(false);
      fetchMembers();
    })();

    gooeyToast.promise(savePromise, {
      loading: 'Menyimpan data member baru...',
      success: 'Member baru berhasil ditambahkan!',
      error: (err) => `Gagal Menambah Member: ${err.message}`
    });
  };

  // Open Edit Modal
  const openEditModal = (member) => {
    setSelectedMember(member);
    setFormData({
      memberId: member.memberId,
      name: member.name,
      email: member.email,
      status: member.status,
    });
    setShowEditModal(true);
  };

  // Update member
  const handleUpdateMember = () => {
    if (!formData.name || !formData.email) {
      gooeyToast.error('Nama dan Email wajib diisi');
      return;
    }

    const updatePromise = (async () => {
      const { error } = await supabase
        .from('members')
        .update({
          name: formData.name.trim(),
          email: formData.email.trim(),
          member_status: formData.status,
        })
        .eq('memberId', selectedMember.memberId);

      if (error) throw error;

      setShowEditModal(false);
      fetchMembers();
    })();

    gooeyToast.promise(updatePromise, {
      loading: 'Memperbarui data member...',
      success: 'Data member berhasil diperbarui!',
      error: (err) => `Gagal Mengupdate Member: ${err.message}`
    });
  };

  // Delete Member
  const handleDeleteMember = async (member) => {
    const result = await Swal.fire({
      title: 'Apakah Anda yakin?',
      text: `Member "${member.name}" akan dihapus permanen beserta data presensinya!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f87171',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
      background: '#fff'
    });

    if (result.isConfirmed) {
      const deletePromise = (async () => {
        const { error } = await supabase
          .from('members')
          .delete()
          .eq('memberId', member.memberId);

        if (error) throw error;
        fetchMembers();
      })();

      gooeyToast.promise(deletePromise, {
        loading: 'Menghapus member dari database...',
        success: 'Member berhasil dihapus dari database.',
        error: (err) => `Gagal Menghapus: ${err.message}`
      });
    }
  };

  const handleViewMember = (member) => {
    setSelectedMember(member);
    setShowViewModal(true);
  };

  // Filter & Search Logic
  const filteredMembers = members.filter((member) => {
    // Search filter: ID, Nama, Email, or associated Tag ID
    const matchesSearch =
      member.memberId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.tagId || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter: Aktif or Tidak Aktif
    const matchesStatus =
      statusFilter === 'Semua Status' || member.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate statistics
  const totalMembersCount = members.length;
  const activeMembersCount = members.filter(m => m.status === 'Aktif').length;
  const inactiveMembersCount = members.filter(m => m.status === 'Tidak Aktif').length;

  return (
    <div id="members-content">
      <h2 className="mb-4">Data Subjek / Entitas Terlacak</h2>

      {/* Summary Cards */}
      <div className="row mb-4">
        <div className="col-md-4 mb-3 mb-md-0">
          <div className="card border-0 shadow-sm p-4 bg-primary text-white position-relative overflow-hidden" style={{ borderRadius: '16px' }}>
            <div className="position-absolute" style={{ right: '-20px', bottom: '-20px', fontSize: '8rem', opacity: 0.15, pointerEvents: 'none' }}>
              <i className="bi bi-people-fill"></i>
            </div>
            <h6 className="text-white-50 text-uppercase tracking-wider small fw-bold">Total Subjek</h6>
            <h2 className="display-5 fw-bold mb-1">{totalMembersCount}</h2>
            <p className="mb-0 text-white-50 small">Subjek / entitas terdaftar</p>
          </div>
        </div>
        
        <div className="col-md-4 mb-3 mb-md-0">
          <div className="card border-0 shadow-sm p-4 bg-success text-white position-relative overflow-hidden" style={{ borderRadius: '16px' }}>
            <div className="position-absolute" style={{ right: '-20px', bottom: '-20px', fontSize: '8rem', opacity: 0.15, pointerEvents: 'none' }}>
              <i className="bi bi-person-check-fill"></i>
            </div>
            <h6 className="text-white-50 text-uppercase tracking-wider small fw-bold">Subjek Aktif</h6>
            <h2 className="display-5 fw-bold mb-1">{activeMembersCount}</h2>
            <p className="mb-0 text-white-50 small">Status pelacakan aktif</p>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card border-0 shadow-sm p-4 bg-dark text-white position-relative overflow-hidden" style={{ borderRadius: '16px' }}>
            <div className="position-absolute" style={{ right: '-20px', bottom: '-20px', fontSize: '8rem', opacity: 0.15, pointerEvents: 'none' }}>
              <i className="bi bi-person-x-fill"></i>
            </div>
            <h6 className="text-white-50 text-uppercase tracking-wider small fw-bold">Subjek Tidak Aktif</h6>
            <h2 className="display-5 fw-bold mb-1">{inactiveMembersCount}</h2>
            <p className="mb-0 text-white-50 small">Status pelacakan nonaktif</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="card border-0 shadow-sm mb-4 p-3" style={{ borderRadius: '12px' }}>
        <div className="row g-3">
          <div className="col-md-7 col-lg-8">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Cari berdasarkan ID, Nama, Email, atau ID Tag..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-4 col-lg-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>Semua Status</option>
              <option>Aktif</option>
              <option>Tidak Aktif</option>
            </select>
          </div>
          <div className="col-md-1 col-lg-1 d-flex justify-content-end">
            <button className="btn btn-outline-secondary w-100" onClick={fetchMembers} title="Segarkan Data">
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="data-table-container">
        <div className="table-header">
          <div>
            <h5>Daftar Subjek & Entitas Tag</h5>
            <p className="text-muted mb-0">Total {filteredMembers.length} dari {members.length} subjek terdaftar</p>
          </div>
          <div>
            <button
                className="btn btn-primary-hover-reverse btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5"
                onClick={openAddModal}
                style={{ borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}
              >
                <i className="bi bi-person-plus-fill fs-6"></i> Tambah Subjek
              </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 text-muted">Memuat data subjek dari Supabase...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID Subjek</th>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>ID Tag</th>
                  <th>Tanggal Terdaftar</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center p-4 text-muted">
                      Tidak ada data member yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr key={member.memberId}>
                      <td className="fw-semibold">{member.memberId}</td>
                      <td>{member.name}</td>
                      <td>{member.email}</td>
                      <td>
                        <span className={`status-badge ${member.status === 'Aktif' ? 'status-active' : 'status-inactive'}`}>
                          {member.status}
                        </span>
                      </td>
                      <td>
                        <span className="badge bg-secondary font-monospace">{member.tagId}</span>
                      </td>
                      <td>{formatDateIndo(member.joinDate)}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-action btn-view" title="Detail" onClick={() => handleViewMember(member)}>
                            <i className="bi bi-eye"></i>
                          </button>
                          <button className="btn-action btn-edit" title="Edit" onClick={() => openEditModal(member)}>
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button className="btn-action btn-delete" title="Hapus" onClick={() => handleDeleteMember(member)}>
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
        )}
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Tambah Member Baru</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)}></button>
              </div>
              <div className="modal-body">
                <form id="add-member-form">
                  <div className="mb-3">
                    <label className="form-label">ID Member</label>
                    <input type="text" className="form-control" name="memberId" value={formData.memberId} onChange={handleInputChange} required placeholder="Cth: M009" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nama Lengkap</label>
                    <input type="text" className="form-control" name="name" value={formData.name} onChange={handleInputChange} required placeholder="Cth: John Doe" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" name="email" value={formData.email} onChange={handleInputChange} required placeholder="Cth: john@example.com" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Status</label>
                    <select className="form-select" name="status" value={formData.status} onChange={handleInputChange}>
                      <option value="Aktif">Aktif</option>
                      <option value="Tidak Aktif">Tidak Aktif</option>
                    </select>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={handleSaveMember}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {showEditModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit Member</h5>
                <button type="button" className="btn-close" onClick={() => setShowEditModal(false)}></button>
              </div>
              <div className="modal-body">
                <form id="edit-member-form">
                  <div className="mb-3">
                    <label className="form-label">ID Member (Kunci Utama)</label>
                    <input type="text" className="form-control bg-light" name="memberId" value={formData.memberId} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Nama Lengkap</label>
                    <input type="text" className="form-control" name="name" value={formData.name} onChange={handleInputChange} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" name="email" value={formData.email} onChange={handleInputChange} required />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Status</label>
                    <select className="form-select" name="status" value={formData.status} onChange={handleInputChange}>
                      <option value="Aktif">Aktif</option>
                      <option value="Tidak Aktif">Tidak Aktif</option>
                    </select>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Batal</button>
                <button type="button" className="btn btn-primary" onClick={handleUpdateMember}>Simpan Perubahan</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Member Modal */}
      {showViewModal && selectedMember && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Detail Member</h5>
                <button type="button" className="btn-close" onClick={() => setShowViewModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-4 text-center mb-4">
                    <div className="member-avatar mx-auto" style={{ width: '120px', height: '120px', fontSize: '3rem', marginBottom: '15px' }}>
                      {selectedMember.name.substring(0, 2).toUpperCase()}
                    </div>
                    <h5>{selectedMember.name}</h5>
                    <p className="text-muted">{selectedMember.email}</p>
                    <span className={`badge ${selectedMember.status === 'Aktif' ? 'bg-success' : 'bg-danger'}`}>
                      {selectedMember.status}
                    </span>
                  </div>
                  <div className="col-md-8">
                    <h6 className="mb-3">Informasi Pribadi</h6>
                    <table className="table table-borderless">
                      <tbody>
                        <tr>
                          <td width="30%">ID Member:</td>
                          <td className="fw-semibold">{selectedMember.memberId}</td>
                        </tr>
                        <tr>
                          <td>ID Tag:</td>
                          <td>
                            <span className="badge bg-secondary font-monospace">{selectedMember.tagId}</span>
                          </td>
                        </tr>
                        <tr>
                          <td>Tanggal Bergabung:</td>
                          <td>{formatDateIndo(selectedMember.joinDate)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowViewModal(false)}>Tutup</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Members;
