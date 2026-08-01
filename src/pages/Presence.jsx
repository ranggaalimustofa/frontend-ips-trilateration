import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import { gooeyToast } from 'goey-toast';
import { formatDateIndo } from '../utils/dateFormatter';

const Presence = () => {
  const getTodayDateString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [presenceList, setPresenceList] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(getTodayDateString());
  const [statusFilter, setStatusFilter] = useState('Semua Member');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch presence records and gym rooms from Supabase
  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // 1. Fetch gym rooms to do coordinate mapping
      const { data: roomData, error: roomError } = await supabase
        .from('location_rooms')
        .select('*');
      if (roomError) throw roomError;
      setRooms(roomData || []);

      // 2. Fetch presence records joined with member details
      let query = supabase
        .from('presences')
        .select('*, members(name, member_status)')
        .order('date', { ascending: false })
        .order('in_time', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      setPresenceList(data || []);
    } catch (error) {
      console.error('Error fetching presence data:', error);
      if (!silent) {
        gooeyToast.error('Gagal mengambil data kehadiran: ' + error.message);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 1. Setup Socket.io real-time connection to receive location updates matching the monitoring log
    const socketUrl = 'http://localhost:5000';
    console.log(`Connecting to positioning socket at ${socketUrl} from Presence page`);
    const socket = io(socketUrl);

    socket.on('location_update', (data) => {
      console.log('Presence page received live location update:', data);
      
      setPresenceList((prev) => {
        // Find if this member has an active check-in record for today (out_time is null/empty)
        const idx = prev.findIndex(
          (r) => r.memberId === data.memberId && (!r.out_time)
        );

        if (idx !== -1) {
          const newList = [...prev];
          newList[idx] = {
            ...newList[idx],
            x_position: Number(data.x),
            y_position: Number(data.y),
          };
          return newList;
        }
        
        return prev;
      });
    });

    // 2. Setup Supabase Realtime subscription for the 'presences' table to catch new check-ins/check-outs instantly
    const channel = supabase
      .channel('presence-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'presences'
        },
        (payload) => {
          console.log('Supabase real-time presence database change:', payload);
          // Silently refresh the list from DB to get the new/updated record with resolved members relation
          fetchData(true);
        }
      )
      .subscribe();

    return () => {
      socket.disconnect();
      supabase.removeChannel(channel);
    };
  }, []);

  // Helper to map X, Y coordinates to Room Name
  const getRoomNameFromCoordinates = (x, y) => {
    if (x === null || y === null || (x === 0 && y === 0)) return 'Luar Area / Resepsionis';
    const numX = Number(x);
    const numY = Number(y);

    const foundRoom = rooms.find(
      (room) =>
        numX >= Number(room.x) &&
        numX <= Number(room.x) + Number(room.w) &&
        numY >= Number(room.y) &&
        numY <= Number(room.y) + Number(room.h)
    );

    return foundRoom ? foundRoom.name : 'Area Umum';
  };

  // Helper to calculate check-in duration
  const calculateDuration = (inTime, outTime) => {
    if (!outTime) return '-';
    try {
      const [inH, inM, inS] = inTime.split(':').map(Number);
      const [outH, outM, outS] = outTime.split(':').map(Number);

      const inTotalMinutes = inH * 60 + inM;
      const outTotalMinutes = outH * 60 + outM;

      let diff = outTotalMinutes - inTotalMinutes;
      if (diff < 0) diff += 24 * 60; // handles midnight transition

      const hours = Math.floor(diff / 60);
      const minutes = diff % 60;

      if (hours === 0) return `${minutes}m`;
      return `${hours}j ${minutes}m`;
    } catch (e) {
      return '-';
    }
  };

  // Filter logic
  const filteredPresence = presenceList.filter((record) => {
    const memberName = record.members?.name || '';
    const memberStatus = record.members?.member_status || 'Aktif';

    // 1. Search Query Filter
    const matchesSearch = memberName.toLowerCase().includes(searchQuery.toLowerCase());

    // 2. Date Filter
    const matchesDate = dateFilter ? record.date === dateFilter : true;

    // 3. Status Filter
    const matchesStatus =
      statusFilter === 'Semua Member' ||
      (statusFilter === 'Member Aktif' && memberStatus === 'Aktif') ||
      (statusFilter === 'Member Tidak Aktif' && memberStatus === 'Tidak Aktif');

    return matchesSearch && matchesDate && matchesStatus;
  });

  const handleExportData = () => {
    if (filteredPresence.length === 0) {
      gooeyToast.info('Tidak ada data untuk diekspor.');
      return;
    }

    const headers = ['ID Member', 'Nama Member', 'Tanggal', 'Jam Masuk', 'Jam Keluar', 'Durasi Latihan', 'Area Utama'];
    const rows = filteredPresence.map((r) => {
      const duration = calculateDuration(r.in_time, r.out_time);
      return [
        r.memberId || '',
        r.members?.name || '',
        r.date || '',
        r.in_time || '',
        r.out_time || 'Aktif di Lokasi',
        duration,
        r.area || 'Resepsionis'
      ];
    });

    // Convert to CSV string, handling quotes and commas safely
    const csvContent = [
      headers.join(','),
      ...rows.map(row => 
        row.map(val => {
          const strVal = String(val);
          if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
            return `"${strVal.replace(/"/g, '""')}"`;
          }
          return strVal;
        }).join(',')
      )
    ].join('\n');

    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      const filename = `Kehadiran_Gym_${dateFilter || 'semua_tanggal'}.csv`;
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      gooeyToast.success(`Data Kehadiran berhasil diekspor sebagai ${filename}`);
    }
  };

  const handleViewDetails = (record) => {
    const duration = calculateDuration(record.in_time, record.out_time);

    Swal.fire({
      icon: 'info',
      title: 'Detail Kehadiran',
      html: `
        <div style="text-align: left; line-height: 1.8;">
          <p><strong>Nama Member:</strong> ${record.members?.name || 'N/A'}</p>
          <p><strong>ID Member:</strong> ${record.memberId}</p>
          <p><strong>Tanggal:</strong> ${formatDateIndo(record.date)}</p>
          <p><strong>Jam Masuk:</strong> ${record.in_time}</p>
          <p><strong>Jam Keluar:</strong> ${record.out_time || 'Masih di Gym (Belum Keluar)'}</p>
          <p><strong>Durasi Latihan:</strong> ${duration}</p>
          <p><strong>Nama Area (Terpopuler):</strong> ${record.area || 'Resepsionis'}</p>
        </div>
      `,
      confirmButtonColor: '#6366f1',
      background: '#fff'
    });
  };

  return (
    <div id="presence-content">
      <h2 className="mb-4">Data Kehadiran</h2>

      {/* Filter and Search Panel */}
      <div className="card border-0 shadow-sm mb-4 p-3" style={{ borderRadius: '12px' }}>
        <div className="row g-3 align-items-center">
          <div className="col-md-4 col-lg-5">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-search"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Cari nama member..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-3 col-lg-3">
            <input
              type="date"
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <div className="col-md-4 col-lg-3">
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="Semua Member">Semua Status Member</option>
              <option value="Member Aktif">Member Aktif</option>
              <option value="Member Tidak Aktif">Member Tidak Aktif</option>
            </select>
          </div>
          <div className="col-md-1 col-lg-1 d-flex justify-content-end">
            <button className="btn btn-outline-secondary w-100" onClick={fetchData} title="Segarkan Data">
              <i className="bi bi-arrow-clockwise"></i>
            </button>
          </div>
        </div>
      </div>

      <div className="data-table-container">
        <div className="table-header">
          <div>
            <h5>Data Kehadiran Member</h5>
            <p className="text-muted mb-0">Menampilkan {filteredPresence.length} catatan kehadiran</p>
          </div>
          <div>
            <button 
              className="btn btn-outline-success btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5" 
              onClick={handleExportData}
              style={{ borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}
            >
              <i className="bi bi-filetype-csv fs-6"></i> Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="mt-2 text-muted">Memuat catatan kehadiran dari Supabase...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID Member</th>
                  <th>Nama</th>
                  <th>Tanggal</th>
                  <th>Waktu Masuk</th>
                  <th>Waktu Keluar</th>
                  <th>Durasi</th>
                  <th>Area Terpopuler</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredPresence.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center p-4 text-muted">
                      Tidak ada data kehadiran hari ini.
                    </td>
                  </tr>
                ) : (
                  filteredPresence.map((record) => (
                    <tr key={record.presenceId}>
                      <td className="fw-semibold">{record.memberId}</td>
                      <td>{record.members?.name || 'Unknown Member'}</td>
                      <td>{formatDateIndo(record.date)}</td>
                      <td className="text-success fw-semibold">{record.in_time}</td>
                      <td className={record.out_time ? 'text-danger fw-semibold' : 'text-warning font-monospace'}>
                        {record.out_time || 'Masih Aktif'}
                      </td>
                      <td className="fw-semibold">
                        {calculateDuration(record.in_time, record.out_time)}
                      </td>
                      <td>
                        <span className="badge bg-info text-dark">
                          {record.area || 'Resepsionis'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-action btn-view"
                            title="Detail"
                            onClick={() => handleViewDetails(record)}
                          >
                            <i className="bi bi-eye"></i>
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
    </div>
  );
};

export default Presence;
