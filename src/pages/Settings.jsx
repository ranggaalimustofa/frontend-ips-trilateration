import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { gooeyToast } from 'goey-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

const Settings = () => {
  const { user } = useAuth();
  const emailSession = user?.email || 'admin@ips.local';
  const nameSession = user?.user_metadata?.name || emailSession.split('@')[0];
  const nameCapitalized = nameSession.charAt(0).toUpperCase() + nameSession.slice(1);
  const initial = nameSession.charAt(0).toUpperCase();
  const role = user?.user_metadata?.role === 'superadmin' ? 'Super Admin' : 'Admin Sistem';

  const [displayName, setDisplayName] = useState(nameSession);
  const [displayEmail, setDisplayEmail] = useState(emailSession);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.name || user.email?.split('@')[0] || '');
      setDisplayEmail(user.email || '');
    }
  }, [user]);

  // Handle updating user profile name
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      gooeyToast.warning('Nama lengkap tidak boleh kosong');
      return;
    }

    try {
      setUpdatingProfile(true);
      const { error } = await supabase.auth.updateUser({
        data: { name: displayName.trim() }
      });

      if (error) throw error;
      gooeyToast.success('Profil nama pengguna berhasil diperbarui!');
    } catch (err) {
      console.error('Error updating profile:', err);
      gooeyToast.error('Gagal memperbarui profil: ' + err.message);
    } finally {
      setUpdatingProfile(false);
    }
  };

  // Handle password change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      gooeyToast.warning('Masukkan kata sandi baru');
      return;
    }
    if (newPassword.length < 6) {
      gooeyToast.warning('Kata sandi minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      gooeyToast.warning('Konfirmasi kata sandi tidak cocok');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setNewPassword('');
      setConfirmPassword('');
      gooeyToast.success('Kata sandi akun Anda berhasil diperbarui!');
    } catch (err) {
      console.error('Error changing password:', err);
      gooeyToast.error('Gagal mengubah password: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Send password reset email
  const handleSendResetEmail = async () => {
    const result = await Swal.fire({
      title: 'Kirim Email Reset Password?',
      text: `Kirimkan tautan reset kata sandi ke alamat email ${emailSession}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Kirim Email',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#64748b'
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({
          title: 'Mengirim...',
          text: 'Mengirimkan email pemulihan kata sandi...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        const { error } = await supabase.auth.resetPasswordForEmail(emailSession, {
          redirectTo: window.location.origin + '/dashboard/settings'
        });

        if (error) throw error;

        Swal.close();
        gooeyToast.success(`Email instruksi pemulihan kata sandi telah dikirim ke ${emailSession}.`);
      } catch (err) {
        console.error('Error sending reset email:', err);
        Swal.close();
        gooeyToast.error('Gagal Mengirim: ' + err.message);
      }
    }
  };

  return (
    <div id="settings-content" className="animate-fade-in">
      <h2 className="mb-4">Pengaturan Akun & Profil Pengguna</h2>

      <div className="row">
        {/* Left Column: User Card & Session Summary */}
        <div className="col-lg-4 mb-4">
          <div className="card border-0 shadow-sm p-4 text-center" style={{ borderRadius: '16px', background: '#ffffff' }}>
            <div className="d-flex justify-content-center mb-3">
              <div 
                className="user-avatar bg-primary text-white shadow-sm" 
                style={{ 
                  width: '90px', 
                  height: '90px', 
                  fontSize: '2.5rem', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                }}
              >
                {initial}
              </div>
            </div>
            
            <h4 className="fw-bold mb-1 text-dark">{nameCapitalized}</h4>
            <p className="text-muted mb-2 small">{emailSession}</p>
            
            <div className="mb-4">
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-3 py-1.5 rounded-pill fw-semibold">
                <i className="bi bi-shield-check me-1"></i>{role}
              </span>
            </div>

            <hr className="my-3 text-muted opacity-25" />

            <div className="text-start small text-muted mb-4">
              <div className="d-flex justify-content-between mb-2">
                <span>Status Akun:</span>
                <span className="fw-semibold text-success">
                  <i className="bi bi-check-circle-fill me-1"></i>Terkonfirmasi
                </span>
              </div>
              <div className="d-flex justify-content-between mb-2">
                <span>Terakhir Masuk:</span>
                <span className="fw-semibold text-dark">
                  {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Sekarang'}
                </span>
              </div>
              <div className="d-flex justify-content-between">
                <span>User ID:</span>
                <span className="font-monospace text-truncate ms-2" style={{ maxWidth: '140px' }} title={user?.id}>
                  {user?.id ? `${user.id.substring(0, 10)}...` : 'Demo ID'}
                </span>
              </div>
            </div>

            <button className="btn btn-outline-secondary btn-sm w-100 rounded-pill py-2" onClick={handleSendResetEmail}>
              <i className="bi bi-envelope-at me-1.5"></i> Kirim Email Reset Password
            </button>
          </div>
        </div>

        {/* Right Column: Update Profile & Change Password */}
        <div className="col-lg-8 mb-4">
          {/* Form Update Profile Name */}
          <div className="card border-0 shadow-sm p-4 mb-4" style={{ borderRadius: '16px' }}>
            <h5 className="fw-bold mb-1 text-dark">Informasi Profil Pengguna</h5>
            <p className="text-muted small mb-4">Perbarui nama dan rincian identitas akun Anda di sistem IPS</p>

            <form onSubmit={handleUpdateProfile}>
              <div className="mb-3">
                <label className="form-label text-muted small fw-bold">Nama Lengkap</label>
                <input
                  type="text"
                  className="form-control py-2"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Masukkan nama lengkap Anda"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label text-muted small fw-bold">Alamat Email (Login)</label>
                <input
                  type="email"
                  className="form-control py-2 bg-light"
                  value={displayEmail}
                  disabled
                  readOnly
                />
                <div className="form-text text-muted small">Email digunakan sebagai ID otentikasi login utama Anda.</div>
              </div>

              <div className="d-flex justify-content-end">
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-pill fw-semibold" disabled={updatingProfile}>
                  {updatingProfile ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Menyimpan...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-floppy me-1.5"></i> Simpan Profil
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Form Change Password */}
          <div className="card border-0 shadow-sm p-4" style={{ borderRadius: '16px' }}>
            <h5 className="fw-bold mb-1 text-dark">Keamanan & Ubah Kata Sandi</h5>
            <p className="text-muted small mb-4">Perbarui kata sandi akun Anda secara langsung</p>

            <form onSubmit={handleChangePassword}>
              <div className="mb-3">
                <label className="form-label text-muted small fw-bold">Kata Sandi Baru</label>
                <input
                  type="password"
                  className="form-control py-2"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label text-muted small fw-bold">Konfirmasi Kata Sandi Baru</label>
                <input
                  type="password"
                  className="form-control py-2"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi baru"
                  required
                />
              </div>

              <div className="d-flex justify-content-end">
                <button type="submit" className="btn btn-primary px-4 py-2 rounded-pill fw-semibold" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-key-fill me-1.5"></i> Perbarui Kata Sandi
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
