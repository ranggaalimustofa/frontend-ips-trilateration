import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { io } from 'socket.io-client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeToday: 0,
    avgDuration: '0.0',
    inactiveMembers: 0,
  });
  const [activities, setActivities] = useState([]);
  const [chartLabels, setChartLabels] = useState(['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']);
  const [chartDataValues, setChartDataValues] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState([]);
  const roomsRef = useRef([]);

  // Helper to map X, Y coordinates to Room Name dynamically
  const getRoomNameFromCoordinates = (x, y) => {
    if (x === null || y === null || (x === 0 && y === 0)) return 'Resepsionis';
    const numX = Number(x);
    const numY = Number(y);

    const foundRoom = roomsRef.current.find(
      (room) =>
        numX >= Number(room.x) &&
        numX <= Number(room.x) + Number(room.w) &&
        numY >= Number(room.y) &&
        numY <= Number(room.y) + Number(room.h)
    );

    return foundRoom ? foundRoom.name : 'Area Umum';
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Gym Rooms dynamically first
      const { data: roomData, error: roomError } = await supabase
        .from('location_rooms')
        .select('*')
        .order('roomId', { ascending: true });
      
      let currentRooms = [];
      if (!roomError && roomData) {
        currentRooms = roomData.map(r => ({
          id: r.roomId,
          name: r.name,
          x: Number(r.x),
          y: Number(r.y),
          w: Number(r.w),
          h: Number(r.h),
          colorIdx: Number(r.colorId || 0)
        }));
        setRooms(currentRooms);
        roomsRef.current = currentRooms;
      }

      // Helper inline function that uses currentRooms directly during this fetch cycle
      const getRoomName = (x, y) => {
        if (x === null || y === null || (x === 0 && y === 0)) return 'Resepsionis';
        const numX = Number(x);
        const numY = Number(y);
        const foundRoom = currentRooms.find(
          (room) =>
            numX >= Number(room.x) &&
            numX <= Number(room.x) + Number(room.w) &&
            numY >= Number(room.y) &&
            numY <= Number(room.y) + Number(room.h)
        );
        return foundRoom ? foundRoom.name : 'Area Umum';
      };

      // 2. Fetch total members and inactive count
      const { data: members, error: mError } = await supabase
        .from('members')
        .select('member_status');
      if (mError) throw mError;

      const total = members.length;
      const inactive = members.filter(m => m.member_status === 'Tidak Aktif').length;

      // 3. Fetch presence records for today
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const { data: todayPresences, error: pError } = await supabase
        .from('presences')
        .select('*')
        .eq('date', todayStr);
      if (pError) throw pError;

      const activeToday = new Set(todayPresences.map(p => p.memberId)).size;

      // 4. Calculate average workout duration from historical completed presences
      const { data: allPresences, error: allPError } = await supabase
        .from('presences')
        .select('in_time, out_time, date');
      if (allPError) throw allPError;

      let totalMinutes = 0;
      let completedSessions = 0;

      allPresences.forEach((p) => {
        if (p.in_time && p.out_time) {
          const [inH, inM] = p.in_time.split(':').map(Number);
          const [outH, outM] = p.out_time.split(':').map(Number);
          let diff = (outH * 60 + outM) - (inH * 60 + inM);
          if (diff < 0) diff += 24 * 60; // handle midnight rollover
          totalMinutes += diff;
          completedSessions += 1;
        }
      });

      const avgDuration = completedSessions > 0
        ? (totalMinutes / completedSessions / 60).toFixed(1)
        : '1.5'; // fallback default

      setStats({
        totalMembers: total,
        activeToday,
        avgDuration,
        inactiveMembers: inactive,
      });

      // 5. Fetch latest 5 activities
      const { data: latestPresences, error: latestError } = await supabase
        .from('presences')
        .select('*, members(name)')
        .order('date', { ascending: false })
        .order('in_time', { ascending: false })
        .limit(5);

      if (latestError) throw latestError;

      const formattedActivities = (latestPresences || []).map(p => {
        const initials = p.members?.name
          ? p.members.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
          : 'M';
        const isCheckIn = !p.out_time;
        const areaName = getRoomName(p.x_position, p.y_position);
        
        return {
          id: p.presenceId,
          memberId: p.memberId,
          name: p.members?.name || 'Unknown Member',
          initials,
          action: isCheckIn ? 'Masuk' : 'Keluar',
          area: areaName,
          date: p.date, // e.g. "2026-05-24"
          time: isCheckIn ? p.in_time.substring(0, 5) : p.out_time.substring(0, 5),
        };
      });

      setActivities(formattedActivities);

      // 6. Calculate Last 7 Days Presence Trend
      const last7Days = [];
      const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayStrVal = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${dayStrVal}`;
        const dayName = dayNames[d.getDay()];
        last7Days.push({ dateStr, dayName, count: 0 });
      }

      allPresences.forEach(p => {
        if (p.date) {
          const match = last7Days.find(d => d.dateStr === p.date);
          if (match) {
            match.count += 1;
          }
        }
      });

      setChartLabels(last7Days.map(d => d.dayName));
      setChartDataValues(last7Days.map(d => d.count));

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Setup Socket.io real-time connection to receive location updates matching the monitoring log
    const socketUrl = 'http://localhost:5000';
    console.log(`Connecting to positioning socket at ${socketUrl} from Dashboard`);
    const socket = io(socketUrl);

    socket.on('location_update', (data) => {
      console.log('Dashboard received live UWB location update:', data);

      const getRoomName = (x, y) => {
        if (x === null || y === null || (x === 0 && y === 0)) return 'Resepsionis';
        const numX = Number(x);
        const numY = Number(y);
        const foundRoom = roomsRef.current.find(
          (room) =>
            numX >= Number(room.x) &&
            numX <= Number(room.x) + Number(room.w) &&
            numY >= Number(room.y) &&
            numY <= Number(room.y) + Number(room.h)
        );
        return foundRoom ? foundRoom.name : 'Area Umum';
      };

      const areaName = getRoomName(data.x, data.y);
      const initials = (data.name || 'M')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      setActivities((prev) => {
        // Find if this member already has a recent activity entry
        const lastAct = prev.find(a => a.memberId === data.memberId);
        
        // If the area is the same, no need to add another movement entry to prevent spam
        if (lastAct && lastAct.area === areaName) {
          return prev;
        }

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const newAct = {
          id: Date.now() + '-' + Math.random(),
          memberId: data.memberId,
          name: data.name,
          initials,
          action: 'Bergerak ke',
          area: areaName,
          date: todayStr,
          time: now.toTimeString().split(' ')[0].substring(0, 5),
        };

        // Filter out old activity for this member and prepend the new one, limit to 5
        const filtered = prev.filter(a => a.memberId !== data.memberId);
        return [newAct, ...filtered].slice(0, 5);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        fill: true,
        label: 'Frekuensi Kehadiran',
        data: chartDataValues,
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 2,
        tension: 0.4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1
        }
      },
    },
  };

  // Helper: format activity time label based on date
  const formatActivityTime = (act) => {
    if (!act.date) return act.time;

    const shortMonths = ['jan','feb','mar','apr','mei','jun','jul','agt','sep','okt','nov','des'];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (act.date === todayStr) {
      return act.time; // e.g. "14:30"
    } else if (act.date === yesterdayStr) {
      return 'Kemarin';
    } else {
      // e.g. "25 mei"
      const [, mo, dy] = act.date.split('-');
      return `${parseInt(dy, 10)} ${shortMonths[parseInt(mo, 10) - 1]}`;
    }
  };

  return (
    <div id="dashboard-content">
      <h2 className="mb-4">Dashboard System Monitoring IPS</h2>

      {/* Stats Cards */}
      <div className="row">
        <div className="col-lg-3 col-md-6 mb-4">
          <div className="stats-card primary shadow-sm border-0">
            <div className="stats-icon">
              <i className="bi bi-people-fill"></i>
            </div>
            <div className="stats-value">{loading ? '...' : stats.totalMembers}</div>
            <div className="stats-label">Total Subjek Terlacak</div>
          </div>
        </div>
        <div className="col-lg-3 col-md-6 mb-4">
          <div className="stats-card success shadow-sm border-0">
            <div className="stats-icon">
              <i className="bi bi-person-check-fill"></i>
            </div>
            <div className="stats-value">{loading ? '...' : stats.activeToday}</div>
            <div className="stats-label">Subjek Terdeteksi Hari Ini</div>
          </div>
        </div>
        <div className="col-lg-3 col-md-6 mb-4">
          <div className="stats-card warning shadow-sm border-0">
            <div className="stats-icon">
              <i className="bi bi-clock-fill"></i>
            </div>
            <div className="stats-value">{loading ? '...' : stats.avgDuration}</div>
            <div className="stats-label">Rata-rata Durasi Area (Jam)</div>
          </div>
        </div>
        <div className="col-lg-3 col-md-6 mb-4">
          <div className="stats-card danger shadow-sm border-0">
            <div className="stats-icon">
              <i className="bi bi-exclamation-triangle-fill"></i>
            </div>
            <div className="stats-value">{loading ? '...' : stats.inactiveMembers}</div>
            <div className="stats-label">Subjek Inaktif</div>
          </div>
        </div>
      </div>

      {/* Charts & Activities Row */}
      <div className="row">
        <div className="col-lg-8 mb-4">
          <div className="data-table-container shadow-sm border-0" style={{ height: '100%', minHeight: '300px' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Tren Pergerakan & Aktivitas Subjek</h5>
              <button className="btn btn-sm btn-outline-primary rounded-pill px-3" onClick={fetchDashboardData}>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
              </button>
            </div>
            <div style={{ height: '300px' }}>
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>
        <div className="col-lg-4 mb-4">
          <div className="data-table-container shadow-sm border-0" style={{ height: '100%' }}>
            <h5 className="mb-3">Log Pergerakan Real-time</h5>
            <div className="activity-list">
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                  <p className="mt-2 text-muted small">Loading aktivitas...</p>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-5 text-muted small">
                  Belum ada pergerakan tag terdeteksi hari ini.
                </div>
              ) : (
                activities.map((act) => (
                  <div className="d-flex align-items-center mb-3" key={act.id}>
                    <div className={`member-avatar me-3 ${act.action === 'Masuk' ? 'bg-primary' : 'bg-danger'}`} style={{ color: 'white' }}>
                      {act.initials}
                    </div>
                    <div className="flex-grow-1">
                      <div className="fw-bold">{act.name}</div>
                      <div className="text-muted small">
                        <span className={`badge ${act.action === 'Masuk' ? 'bg-success' : 'bg-secondary'} me-1`}>
                          {act.action}
                        </span>
                        {act.area}
                      </div>
                    </div>
                    <span className="text-muted small fw-semibold font-monospace">{formatActivityTime(act)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
