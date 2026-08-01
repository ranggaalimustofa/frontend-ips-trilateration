import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [gymProfile, setGymProfile] = useState(null);

  const fetchGymProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('gym_profiles')
        .select('*')
        .eq('gymId', 1)
        .single();
      
      if (!error && data) {
        setGymProfile(data);
        document.title = data.name;
      }
    } catch (err) {
      console.error('Error fetching gym profile name:', err);
    }
  };

  useEffect(() => {
    fetchGymProfile();
    // Check active session on startup
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(err => {
      console.error('Error fetching session:', err);
      setLoading(false);
    });

    // Listen for auth changes (sign in, sign out, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (event === 'PASSWORD_RECOVERY') {
        const { value: newPassword } = await Swal.fire({
          title: 'Reset Kata Sandi',
          input: 'password',
          inputLabel: 'Masukkan Kata Sandi Baru Anda',
          inputPlaceholder: 'Kata Sandi Baru (min 6 karakter)',
          inputAttributes: {
            autocapitalize: 'off',
            autocorrect: 'off'
          },
          showCancelButton: true,
          confirmButtonText: 'Simpan',
          cancelButtonText: 'Batal',
          confirmButtonColor: '#6366f1',
          cancelButtonColor: '#64748b',
          inputValidator: (value) => {
            if (!value || value.length < 6) {
              return 'Password minimal 6 karakter!';
            }
          }
        });

        if (newPassword) {
          try {
            Swal.fire({
              title: 'Menyimpan...',
              text: 'Memperbarui kata sandi Anda...',
              allowOutsideClick: false,
              didOpen: () => {
                Swal.showLoading();
              }
            });

            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            Swal.fire({
              icon: 'success',
              title: 'Berhasil!',
              text: 'Kata sandi Anda berhasil diperbarui!',
              confirmButtonColor: '#6366f1'
            });
          } catch (err) {
            Swal.fire({
              icon: 'error',
              title: 'Gagal memperbarui',
              text: err.message,
              confirmButtonColor: '#6366f1'
            });
          }
        }
      }
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // Automatic logout after 1 hour of inactivity
  useEffect(() => {
    if (!user) return;

    let timeoutId;
    const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour in milliseconds

    const handleLogout = async () => {
      try {
        await supabase.auth.signOut();
        Swal.fire({
          icon: 'warning',
          title: 'Sesi Berakhir',
          text: 'Sesi Anda telah berakhir karena tidak ada aktivitas selama 1 jam. Silakan login kembali.',
          confirmButtonColor: '#6366f1',
          background: '#fff'
        });
      } catch (err) {
        console.error('Error signing out during auto-logout:', err);
      }
    };

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(handleLogout, INACTIVITY_LIMIT);
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    
    // Initialize timer on mount/user change
    resetTimer();

    // Register event listeners
    events.forEach(evt => window.addEventListener(evt, resetTimer));

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [user]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signup = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, login, logout, signup, gymProfile, fetchGymProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
