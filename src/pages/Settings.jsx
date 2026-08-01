import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { gooeyToast } from 'goey-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

const Settings = () => {
  const { user, fetchGymProfile } = useAuth();
  const emailSession = user?.email || 'admin@fittrack.com';
  const nameSession = user?.user_metadata?.name || emailSession.split('@')[0];
  const nameCapitalized = nameSession.charAt(0).toUpperCase() + nameSession.slice(1);
  const initial = nameSession.charAt(0).toUpperCase();
  const role = user?.user_metadata?.role === 'superadmin' ? 'Super Admin' : 'Admin Gym';

  const [loading, setLoading] = useState(true);
  const [gymProfile, setGymProfile] = useState({
    name: 'FitTrack Pro Gym',
    address: 'Jl. Fitness No. 123, Jakarta Selatan',
    telp: '021-12345678',
    email: 'info@fittrackpro.com',
  });

  const [weekdayOpen, setWeekdayOpen] = useState('06:00');
  const [weekdayClose, setWeekdayClose] = useState('22:00');
  const [weekdayClosed, setWeekdayClosed] = useState(false);
  
  const [weekendOpen, setWeekendOpen] = useState('07:00');
  const [weekendClose, setWeekendClose] = useState('20:00');
  const [weekendClosed, setWeekendClosed] = useState(false);

  useEffect(() => {
    const fetchGymData = async () => {
      try {
        setLoading(true);
        // 1. Fetch gym profile (gymId = 1)
        const { data: profile, error: profileError } = await supabase
          .from('gym_profiles')
          .select('*')
          .eq('gymId', 1)
          .single();
        
        if (profileError) {
          console.warn('Gym profile not found or seed missing:', profileError.message);
          setGymProfile({
            name: profile.name || '',
            address: profile.address || '',
            telp: profile.telp || '',
            email: profile.email || '',
          });
        }

        // 2. Fetch operational times
        const { data: opTimes, error: opError } = await supabase
          .from('operational_times')
          .select('*')
          .eq('gymId', 1);

        if (opError) {
          console.warn('Operational times fetch failed:', opError.message);
        } else if (opTimes && opTimes.length > 0) {
          // Find weekday (Senin)
          const monday = opTimes.find(t => t.day === 'Senin');
          if (monday && monday.open_time && monday.close_time) {
            const openVal = monday.open_time.substring(0, 5);
            const closeVal = monday.close_time.substring(0, 5);
            if (openVal === '00:00' && closeVal === '00:00') {
              setWeekdayClosed(true);
            } else {
              setWeekdayOpen(openVal);
              setWeekdayClose(closeVal);
              setWeekdayClosed(false);
            }
          }
          // Find weekend (Sabtu)
          const saturday = opTimes.find(t => t.day === 'Sabtu');
          if (saturday && saturday.open_time && saturday.close_time) {
            const openVal = saturday.open_time.substring(0, 5);
            const closeVal = saturday.close_time.substring(0, 5);
            if (openVal === '00:00' && closeVal === '00:00') {
              setWeekendClosed(true);
            } else {
              setWeekendOpen(openVal);
              setWeekendClose(closeVal);
              setWeekendClosed(false);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching gym settings:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGymData();
  }, []);

  const handleSaveSettings = (e) => {
    e.preventDefault();

    const savePromise = (async () => {
      // 1. Update gym profile
      const { error: profileError } = await supabase
        .from('gym_profiles')
        .update({
          name: gymProfile.name,
          address: gymProfile.address,
          telp: gymProfile.telp,
          email: gymProfile.email
        })
        .eq('gymId', 1);

      if (profileError) throw profileError;

      // 2. Update operational times
      const days = [
        { name: 'Senin', open: weekdayClosed ? '00:00' : weekdayOpen, close: weekdayClosed ? '00:00' : weekdayClose },
        { name: 'Selasa', open: weekdayClosed ? '00:00' : weekdayOpen, close: weekdayClosed ? '00:00' : weekdayClose },
        { name: 'Rabu', open: weekdayClosed ? '00:00' : weekdayOpen, close: weekdayClosed ? '00:00' : weekdayClose },
        { name: 'Kamis', open: weekdayClosed ? '00:00' : weekdayOpen, close: weekdayClosed ? '00:00' : weekdayClose },
        { name: 'Jumat', open: weekdayClosed ? '00:00' : weekdayOpen, close: weekdayClosed ? '00:00' : weekdayClose },
        { name: 'Sabtu', open: weekendClosed ? '00:00' : weekendOpen, close: weekendClosed ? '00:00' : weekendClose },
        { name: 'Minggu', open: weekendClosed ? '00:00' : weekendOpen, close: weekendClosed ? '00:00' : weekendClose },
      ];

      for (const d of days) {
        const { error: opError } = await supabase
          .from('operational_times')
          .update({
            open_time: `${d.open}:00`,
            close_time: `${d.close}:00`
          })
          .eq('gymId', 1)
          .eq('day', d.name);

        if (opError) throw opError;
      }

      // Refresh global gym profile (updates document title)
      if (fetchGymProfile) {
        await fetchGymProfile();
      }
    })();

    gooeyToast.promise(savePromise, {
      loading: 'Menyimpan pengaturan profil gym...',
      success: 'Pengaturan profil gym berhasil disimpan!',
      error: (err) => `Gagal Menyimpan: ${err.message}`
    });
  };

  return (
    <div id="settings-content">
      <h2 className="mb-4">Pengaturan Profil & Sistem</h2>

      <div className="row">
        <div className="col-lg-4 mb-4">
          <div className="data-table-container">
            <h5 className="mb-3">Profil Admin</h5>
            <div className="d-flex align-items-center mb-4">
              <div className="user-avatar me-3" style={{ width: '80px', height: '80px', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {initial}
              </div>
              <div>
                <h5 className="mb-1">{nameCapitalized}</h5>
                <p className="text-muted mb-1" style={{ fontSize: '0.9rem' }}>{emailSession}</p>
                <span className="badge bg-primary">{role}</span>
              </div>
            </div>
            <button className="btn btn-outline-primary w-100 mb-2" onClick={() => {
              Swal.fire({
                title: 'Informasi Akun',
                html: `<div style="text-align: left;">
                  <p><strong>ID Pengguna:</strong> ${user?.id || 'Demo ID'}</p>
                  <p><strong>Email:</strong> ${emailSession}</p>
                  <p><strong>Status Konfirmasi:</strong> ${user?.email_confirmed_at ? 'Terkonfirmasi' : 'Belum Dikonfirmasi / Demo'}</p>
                  <p><strong>Terakhir Masuk:</strong> ${user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Sekarang'}</p>
                </div>`,
                icon: 'info',
                confirmButtonColor: '#6366f1'
              });
            }}>Lihat Info Sesi</button>
            <button className="btn btn-outline-secondary w-100" onClick={async () => {
              const result = await Swal.fire({
                title: 'Ubah Kata Sandi',
                text: `Kirim email konfirmasi ke ${emailSession} untuk merubah kata sandi Anda?`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Kirim Email Reset',
                cancelButtonText: 'Batal',
                confirmButtonColor: '#6366f1',
                cancelButtonColor: '#64748b'
              });
              
              if (result.isConfirmed) {
                try {
                  Swal.fire({
                    title: 'Mengirim...',
                    text: 'Mengirim email pemulihan kata sandi...',
                    allowOutsideClick: false,
                    didOpen: () => {
                      Swal.showLoading();
                    }
                  });

                  const { error } = await supabase.auth.resetPasswordForEmail(emailSession, {
                    redirectTo: window.location.origin + '/dashboard/settings'
                  });

                  if (error) throw error;

                  Swal.close(); // Close loading spinner
                  gooeyToast.success(`Email instruksi perubahan kata sandi telah dikirim ke ${emailSession}.`);
                } catch (err) {
                  console.error('Error resetting password:', err.message);
                  Swal.close(); // Close loading spinner
                  gooeyToast.error('Gagal Mengirim: ' + err.message);
                }
              }
            }}>Ubah Password</button>
          </div>
        </div>
        
        <div className="col-lg-8 mb-4">
          <div className="data-table-container">
            <h5 className="mb-3">Pengaturan Sistem</h5>
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                <p className="mt-2 text-muted small">Memuat pengaturan...</p>
              </div>
            ) : (
              <form onSubmit={handleSaveSettings}>
                <div className="mb-3">
                  <label htmlFor="gym-name" className="form-label">Nama Fasilitas / Area IPS</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    id="gym-name" 
                    value={gymProfile.name}
                    onChange={e => setGymProfile({ ...gymProfile, name: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="gym-address" className="form-label">Alamat / Lokasi Gedung</label>
                  <textarea 
                    className="form-control" 
                    id="gym-address" 
                    rows="2" 
                    value={gymProfile.address}
                    onChange={e => setGymProfile({ ...gymProfile, address: e.target.value })}
                    required
                  ></textarea>
                </div>
                <div className="mb-3">
                  <label htmlFor="gym-phone" className="form-label">Telepon Kontak</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    id="gym-phone" 
                    value={gymProfile.telp}
                    onChange={e => setGymProfile({ ...gymProfile, telp: e.target.value })}
                    required
                  />
                </div>
                <div className="mb-3">
                  <label htmlFor="gym-email" className="form-label">Email Kontak</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    id="gym-email" 
                    value={gymProfile.email}
                    onChange={e => setGymProfile({ ...gymProfile, email: e.target.value })}
                    required
                  />
                </div>
                
                <div className="mb-4">
                  <label className="form-label fw-bold">Jam Operasional Fasilitas</label>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <div className="p-3 bg-light rounded shadow-sm border border-light-subtle">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div className="fw-bold text-primary" style={{ fontSize: '13px' }}>Hari Kerja (Senin - Jumat)</div>
                          <div className="form-check form-switch mb-0">
                            <input 
                              className="form-check-input" 
                              type="checkbox" 
                              id="weekday-closed" 
                              checked={weekdayClosed}
                              onChange={e => setWeekdayClosed(e.target.checked)}
                            />
                            <label className="form-check-label text-muted small" htmlFor="weekday-closed">Libur</label>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <input 
                            type="time" 
                            className="form-control form-control-sm" 
                            value={weekdayOpen}
                            onChange={e => setWeekdayOpen(e.target.value)}
                            disabled={weekdayClosed}
                            required={!weekdayClosed}
                          />
                          <span className="text-muted small">s/d</span>
                          <input 
                            type="time" 
                            className="form-control form-control-sm" 
                            value={weekdayClose}
                            onChange={e => setWeekdayClose(e.target.value)}
                            disabled={weekdayClosed}
                            required={!weekdayClosed}
                          />
                        </div>
                        {weekdayClosed && (
                          <div className="text-danger small mt-2 fw-semibold animate-fade-in" style={{ fontSize: '11px' }}>
                            ⚠️ Gym Ditetapkan Tutup / Libur pada Hari Kerja.
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="col-md-6">
                      <div className="p-3 bg-light rounded shadow-sm border border-light-subtle">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <div className="fw-bold text-success" style={{ fontSize: '13px' }}>Akhir Pekan (Sabtu - Minggu)</div>
                          <div className="form-check form-switch mb-0">
                            <input 
                              className="form-check-input" 
                              type="checkbox" 
                              id="weekend-closed" 
                              checked={weekendClosed}
                              onChange={e => setWeekendClosed(e.target.checked)}
                            />
                            <label className="form-check-label text-muted small" htmlFor="weekend-closed">Libur</label>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <input 
                            type="time" 
                            className="form-control form-control-sm" 
                            value={weekendOpen}
                            onChange={e => setWeekendOpen(e.target.value)}
                            disabled={weekendClosed}
                            required={!weekendClosed}
                          />
                          <span className="text-muted small">s/d</span>
                          <input 
                            type="time" 
                            className="form-control form-control-sm" 
                            value={weekendClose}
                            onChange={e => setWeekendClose(e.target.value)}
                            disabled={weekendClosed}
                            required={!weekendClosed}
                          />
                        </div>
                        {weekendClosed && (
                          <div className="text-danger small mt-2 fw-semibold animate-fade-in" style={{ fontSize: '11px' }}>
                            ⚠️ Gym Ditetapkan Tutup / Libur pada Akhir Pekan.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" id="auto-checkout" defaultChecked />
                  <label className="form-check-label" htmlFor="auto-checkout">
                    Auto Checkout Member (setelah 12 jam)
                  </label>
                </div>
                <div className="form-check form-switch mb-3">
                  <input className="form-check-input" type="checkbox" id="email-notifications" defaultChecked />
                  <label className="form-check-label" htmlFor="email-notifications">
                    Kirim Notifikasi Email untuk Member Baru
                  </label>
                </div>
                <button type="submit" className="btn btn-primary px-4">
                  Simpan Pengaturan
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
