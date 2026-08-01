import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gooeyToast } from 'goey-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ email: false, password: false });
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setErrors({
        email: !email,
        password: !password
      });
      return;
    }

    try {
      setLoading(true);
      // Log in user via Supabase
      await login(email, password);
      gooeyToast.success('Selamat datang di Trilateration IPS System!');
      navigate('/dashboard');
    } catch (err) {
      gooeyToast.error(err.message || 'Terjadi kesalahan. Silakan periksa kembali data Anda.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container" style={{ background: 'rgb(229 229 229 / 85%)' }}>
      <div className="login-card">
        <div className="login-header">
          <i className="bi bi-broadcast-pin" style={{ fontSize: '3rem', color: '#6366f1' }}></i>
          <h2>Trilateration IPS</h2>
          <p>Sistem Monitoring & Pelacakan Lokasi</p>
        </div>
        <div className="login-body">
          <form onSubmit={handleSubmit}>
            <div className="form-floating" style={{ marginBottom: errors.email ? '10px' : '20px' }}>
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
              {errors.email && <div className="invalid-feedback text-start mt-1 mb-2">Email harus diisi</div>}
            </div>
            <div className="form-floating" style={{ marginBottom: errors.password ? '10px' : '20px' }}>
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
              <label htmlFor="password" className={errors.password ? 'text-danger' : ''}>Kata Sandi</label>
              {errors.password && <div className="invalid-feedback text-start mt-1 mb-2">Password harus diisi</div>}
            </div>
            
            <div className="form-check mb-3">
              <input className="form-check-input" type="checkbox" id="remember" disabled={loading} />
              <label className="form-check-label" htmlFor="remember">
                Ingat saya
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-login" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Memproses...
                </>
              ) : 'Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
