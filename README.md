# 🏋️‍♂️ FitTrack Pro — Web Dashboard Indoor Positioning System

Aplikasi Web Dashboard Admin berbasis **React 19, Vite, Socket.IO Client, Bootstrap 5, dan Chart.js** untuk pemantauan lokasi anggota gym secara *real-time* berbasis **ESP32 LoRa Trilaterasi**.

---

## 📌 Fitur Utama

- 📍 **Interactive 2D Position Monitoring Canvas**:
  - Peta denah 2D area gym dengan fitur *Zoom, Pan, Pinch* interaktif.
  - Tracking posisi Smart Tag secara *real-time* tanpa perlu reload halaman.
  - Indikator koordinat \((X, Y)\), persentase baterai, dan nama anggota pada setiap tag.
- 📊 **Real-Time Analytics & Dashboard**:
  - Ringkasan statistik jumlah anggota aktif, jam sibuk (*peak hours*), dan durasi latihan.
  - Visualisasi grafik dengan **Chart.js** & **React-Chartjs-2**.
- 📝 **Sistem Presensi Otomatis**:
  - Log jam masuk (*check-in*) dan jam keluar (*check-out*) otomatis berdasarkan zona deteksi.
- 👥 **Manajemen Anggota & Smart Tag**:
  - Pengelolaan data member, pendaftaran Smart Tag LoRa, serta status perangkat.
- 🎯 **Gym Layout & Anchor Calibration Manager**:
  - Konfigurasi dimensi denah area gym dan kalibrasi posisi koordinat Anchor Node (Anchor 01, 02, 03).
- 🔑 **Multi-Role Authentication**:
  - Login terproteksi dengan role Admin & Superadmin (Manajemen akun admin).
- ✨ **UI Modern & Dynamic Animations**:
  - Menggunakan **Framer Motion** untuk efek animasi halus, SweetAlert2, dan Bootstrap 5 styling.

---

## 🛠️ Teknologi & Stack

- **Framework**: React 19 (Vite)
- **Styling**: Bootstrap 5 + Bootstrap Icons + Custom CSS
- **Animation Engine**: Framer Motion
- **Real-Time WebSockets**: Socket.IO Client
- **Interactive Canvas**: React Zoom Pan Pinch & React Draggable
- **Charts & Data Viz**: Chart.js & React-Chartjs-2
- **Database & Auth**: Supabase JS Client

---

## 📂 Struktur Direktori Project

```text
frontend/
├── public/                    # Aset statis & ikon
├── src/
│   ├── assets/                # Aset gambar & ilustrasi
│   ├── components/            # Komponen UI Reusable (Sidebar, TopNavbar, GymLayoutManager)
│   ├── context/               # React Context (AuthContext, SocketContext)
│   ├── data/                  # Mock data & konstanta awal
│   ├── hooks/                 # Custom React Hooks (useSocket)
│   ├── layouts/               # Dashboard Layout Wrapper
│   ├── pages/                 # Halaman Aplikasi (Dashboard, Monitoring, Members, dll.)
│   ├── services/              # Supabase Client Service
│   ├── utils/                 # Helper fungsi (dateFormatter)
│   ├── App.jsx                # Router & Konfigurasi Aplikasi
│   ├── index.css              # Global Design System & Styling
│   └── main.jsx               # Entry Point React DOM
├── .env                       # Environment variables (Vite)
├── .gitignore                 # Aturan pengabaian berkas Git
├── index.html                 # Template utama HTML
├── package.json               # Manifest dependensi NPM
├── vite.config.js             # Konfigurasi Vite Bundler
└── README.md                  # Dokumentasi Utama
```

---

## 🚀 Panduan Instalasi & Penggunaan

### 1. Prasyarat
- **Node.js**: Versi 18 atau 20+
- **NPM**: Versi 9 ke atas
- Backend **Express Server** & **MQTT Broker** yang sedang berjalan

### 2. Instalasi Dependensi
Jalankan perintah berikut pada direktori `frontend/`:
```bash
npm install
```

### 3. Konfigurasi Environment Variables (`.env`)
Buat file `.env` di root direktori frontend:

```env
VITE_SUPABASE_URL=https://<your-supabase-project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_URL=http://localhost:5000
```

### 4. Menjalankan Mode Development
```bash
npm run dev
```
Aplikasi akan dapat diakses di browser pada URL: `http://localhost:5173`.

### 5. Build untuk Produksi
```bash
npm run build
```
Hasil build bundel siap rilis akan disimpan di folder `dist/`.

---

## 🖥️ Halaman-Halaman Utama

| Halaman | URL Path | Fungsi Utama |
| :--- | :--- | :--- |
| **Login** | `/login` | Otentikasi masuk Admin / Superadmin |
| **Dashboard** | `/` | Ringkasan statistik & metrik utama gym |
| **Position Monitoring** | `/monitoring` | Canvas 2D interaktif tracking posisi tag secara *real-time* |
| **Presensi** | `/presence` | Log data presensi masuk/keluar anggota |
| **Anggota** | `/members` | CRUD data anggota gym |
| **Smart Tag** | `/tags` | Manajemen perangkat Smart Tag LoRa |
| **Anchor & Layout** | `/device-settings` | Kalibrasi posisi koordinat Anchor Node & denah area |
| **Superadmin** | `/superadmin` | Kelola akun admin & ubah password master |

---

## 📄 Lisensi & Kontribusi

Dikembangkan untuk proyek tugas akhir / skripsi **Indoor Positioning System berbasis ESP32 & LoRa Trilaterasi**.
