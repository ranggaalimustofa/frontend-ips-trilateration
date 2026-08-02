import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gooeyToast } from 'goey-toast';
import { supabase } from '../services/supabaseClient';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'Nama lengkap wajib diisi';
    if (!email.trim()) newErrors.email = 'Alamat email wajib diisi';
    if (!password) newErrors.password = 'Kata sandi wajib diisi';
    if (password && password.length < 6) newErrors.password = 'Kata sandi minimal 6 karakter';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Konfirmasi kata sandi tidak cocok';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            name: name.trim(),
            role: 'admin'
          }
        }
      });

      if (error) throw error;

      gooeyToast.success('Pendaftaran akun berhasil! Silakan masuk dengan akun baru Anda.');
      navigate('/');
    } catch (err) {
      console.error('Registration error:', err);
      gooeyToast.error(err.message || 'Gagal mendaftarkan akun. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ background: 'rgb(229 229 229 / 85%)' }}>
      <div className="login-card" style={{ maxWidth: '440px' }}>
        <div className="login-header">
          <i className="bi bi-broadcast-pin" style={{ fontSize: '3rem', color: '#6366f1' }}></i>
          <h2>Pendaftaran Akun IPS</h2>
          <p>Daftarkan akun baru untuk mengelola Sistem IPS</p>
        </div>
        <div className="login-body">
          <form onSubmit={handleSubmit}>
            <div className="form-floating" style={{ marginBottom: errors.name ? '10px' : '15px' }}>
              <input
                type="text"
                className={`form-control ${errors.name ? 'is-invalid' : ''}`}
                id="name"
                placeholder="Nama Lengkap"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors(prev => ({ ...prev, name: false }));
                }}
                disabled={loading}
              />
              <label htmlFor="name" className={errors.name ? 'text-danger' : ''}>Nama Lengkap</label>
              {errors.name && <div className="invalid-feedback text-start mt-1 mb-2">{errors.name}</div>}
            </div>

            <div className="form-floating" style={{ marginBottom: errors.email ? '10px' : '15px' }}>
              <input
                type="email"
                className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                id="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors(prev => ({ ...prev, email: false }));
                }}
                disabled={loading}
              />
              <label htmlFor="email" className={errors.email ? 'text-danger' : ''}>Alamat Email</label>
              {errors.email && <div className="invalid-feedback text-start mt-1 mb-2">{errors.email}</div>}
            </div>

            <div className="form-floating" style={{ marginBottom: errors.password ? '10px' : '15px' }}>
              <input
                type="password"
                className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                id="password"
                placeholder="Kata Sandi"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors(prev => ({ ...prev, password: false }));
                }}
                disabled={loading}
              />
              <label htmlFor="password" className={errors.password ? 'text-danger' : ''}>Kata Sandi (min. 6 karakter)</label>
              {errors.password && <div className="invalid-feedback text-start mt-1 mb-2">{errors.password}</div>}
            </div>

            <div className="form-floating" style={{ marginBottom: errors.confirmPassword ? '10px' : '20px' }}>
              <input
                type="password"
                className={`form-control ${errors.confirmPassword ? 'is-invalid' : ''}`}
                id="confirmPassword"
                placeholder="Konfirmasi Kata Sandi"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: false }));
                }}
                disabled={loading}
              />
              <label htmlFor="confirmPassword" className={errors.confirmPassword ? 'text-danger' : ''}>Konfirmasi Kata Sandi</label>
              {errors.confirmPassword && <div className="invalid-feedback text-start mt-1 mb-2">{errors.confirmPassword}</div>}
            </div>

            <button type="submit" className="btn btn-primary btn-login w-100 py-2 mb-3" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Mendaftarkan...
                </>
              ) : 'Daftar Akun'}
            </button>

            <div className="text-center mt-3">
              <span className="text-muted small">Sudah memiliki akun? </span>
              <Link to="/" className="fw-bold text-decoration-none" style={{ color: '#6366f1' }}>
                Masuk di sini
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
