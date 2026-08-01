import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { gooeyToast } from 'goey-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

const Superadmin = () => {
  const { session } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create admin form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Change superadmin password states
  const [superPassword, setSuperPassword] = useState('');
  const [superPasswordConfirm, setSuperPasswordConfirm] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/superadmin/admins', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAdmins(data.admins || []);
      } else {
        throw new Error(data.error || 'Gagal memuat daftar admin');
      }
    } catch (err) {
      console.error('Error fetching admins:', err.message);
      gooeyToast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, [session]);

  const handleCreateAdmin = (e) => {
    e.preventDefault();
    if (!email || !password) {
      gooeyToast.warning('Email dan password harus diisi!');
      return;
    }

    if (password.length < 6) {
      gooeyToast.warning('Kata sandi minimal 6 karakter!');
      return;
    }

    const createPromise = (async () => {
      setCreateLoading(true);
      const res = await fetch('http://localhost:5000/api/superadmin/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setEmail('');
        setPassword('');
        fetchAdmins();
      } else {
        throw new Error(data.error || 'Gagal membuat admin');
      }
    })();

    gooeyToast.promise(createPromise, {
      loading: 'Membuat akun admin baru...',
      success: 'Akun admin baru berhasil dibuat.',
      error: (err) => `Gagal Membuat Admin: ${err.message}`
    });

    createPromise.finally(() => {
      setCreateLoading(false);
    });
  };

  const handleDeleteAdmin = async (id, adminEmail) => {
    const result = await Swal.fire({
      title: 'Hapus Admin?',
      text: `Apakah Anda yakin ingin menghapus akun admin ${adminEmail}? Tindakan ini tidak dapat dibatalkan.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus!',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    });

    if (result.isConfirmed) {
      const deletePromise = (async () => {
        const res = await fetch(`http://localhost:5000/api/superadmin/admins/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        });
        const data = await res.json();

        if (res.ok && data.success) {
          fetchAdmins();
        } else {
          throw new Error(data.error || 'Gagal menghapus admin');
        }
      })();

      gooeyToast.promise(deletePromise, {
        loading: 'Menghapus akun admin...',
        success: 'Akun admin berhasil dihapus.',
        error: (err) => `Gagal Menghapus: ${err.message}`
      });
    }
  };

  const handleChangeSuperPassword = (e) => {
    e.preventDefault();
    if (!superPassword || !superPasswordConfirm) {
      gooeyToast.warning('Semua kolom password harus diisi!');
      return;
    }

    if (superPassword !== superPasswordConfirm) {
      gooeyToast.error('Kata sandi baru dan konfirmasi tidak cocok!');
      return;
    }

    if (superPassword.length < 6) {
      gooeyToast.warning('Kata sandi minimal 6 karakter!');
      return;
    }

    const changePromise = (async () => {
      setPwdLoading(true);
      const res = await fetch('http://localhost:5000/api/superadmin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ password: superPassword })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuperPassword('');
        setSuperPasswordConfirm('');
      } else {
        throw new Error(data.error || 'Gagal mengubah password');
      }
    })();

    gooeyToast.promise(changePromise, {
      loading: 'Mengubah password superadmin...',
      success: 'Password superadmin berhasil diubah.',
      error: (err) => `Gagal Mengubah Password: ${err.message}`
    });

    changePromise.finally(() => {
      setPwdLoading(false);
    });
  };

  return (
    <div id="superadmin-content">
      <h2 className="mb-4">Superadmin Panel</h2>

      <div className="row">
        {/* Left Side: Create Admin & Superadmin Password */}
        <div className="col-lg-5 mb-4">
          {/* Create Admin Form */}
          <div className="data-table-container mb-4 shadow-sm border-0">
            <h5 className="mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-person-plus-fill text-primary"></i> Tambah Akun Admin Baru
            </h5>
            <form onSubmit={handleCreateAdmin}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-muted">Email Admin</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-muted">Password Awal</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-100 btn-primary-hover-reverse d-flex justify-content-center align-items-center gap-2 px-3 py-2"
                style={{ borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}
                disabled={createLoading}
              >
                {createLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Memproses...
                  </>
                ) : (
                  <>
                    <i className="bi bi-plus-circle"></i> Daftarkan Admin
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Superadmin Password Form */}
          <div className="data-table-container shadow-sm border-0">
            <h5 className="mb-3 d-flex align-items-center gap-2">
              <i className="bi bi-key-fill text-warning"></i> Ubah Password Superadmin
            </h5>
            <form onSubmit={handleChangeSuperPassword}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-muted">Password Baru</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Minimal 6 karakter"
                  value={superPassword}
                  onChange={(e) => setSuperPassword(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-muted">Konfirmasi Password Baru</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Ulangi password baru"
                  value={superPasswordConfirm}
                  onChange={(e) => setSuperPasswordConfirm(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-outline-primary w-100 d-flex justify-content-center align-items-center gap-2 px-3 py-2"
                style={{ borderRadius: '8px', fontSize: '13px', fontWeight: '600' }}
                disabled={pwdLoading}
              >
                {pwdLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle"></i> Perbarui Password Superadmin
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: List of Admins */}
        <div className="col-lg-7 mb-4">
          <div className="data-table-container shadow-sm border-0" style={{ height: '100%' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-people-fill text-info"></i> Daftar Akun Admin Gym
              </h5>
              <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={fetchAdmins} disabled={loading}>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
              </button>
            </div>

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                <p className="mt-2 text-muted small">Memuat akun admin...</p>
              </div>
            ) : admins.length === 0 ? (
              <div className="text-center py-5 text-muted small">
                Belum ada akun admin terdaftar. Gunakan formulir di samping untuk menambahkan admin.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Dibuat Pada</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map((adm) => (
                      <tr key={adm.id}>
                        <td>
                          <div className="fw-semibold">{adm.email}</div>
                          <span className="badge bg-secondary-subtle text-secondary small" style={{ fontSize: '10px' }}>Admin</span>
                        </td>
                        <td className="small text-muted font-monospace">
                          {adm.created_at ? new Date(adm.created_at).toLocaleString('id-ID') : '-'}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1.5 px-2.5 py-1"
                            style={{ borderRadius: '6px', fontSize: '11px', fontWeight: '500' }}
                            onClick={() => handleDeleteAdmin(adm.id, adm.email)}
                          >
                            <i className="bi bi-trash3-fill"></i> Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Superadmin;
