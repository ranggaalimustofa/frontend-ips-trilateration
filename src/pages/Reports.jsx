import React, { useState, useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { gooeyToast } from 'goey-toast';
import { supabase } from '../services/supabaseClient';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { formatDateIndo } from '../utils/dateFormatter';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const barOptions = {
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
        precision: 0
      }
    }
  }
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        boxWidth: 12,
        font: {
          size: 11
        }
      }
    }
  }
};

const loadHtml2Pdf = () => {
  return new Promise((resolve, reject) => {
    if (window.html2pdf) {
      resolve(window.html2pdf);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.integrity = 'sha512-GsLlZN/3F2ErC5ifS5QtgpiJtWd43JWSuIgh7mbzZ8zBps+dvLusV+eNQATqgA/HdeKFVgA5v3S/cIrLF7QnIg==';
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'no-referrer';
    script.onload = () => {
      resolve(window.html2pdf);
    };
    script.onerror = () => {
      reject(new Error('Gagal memuat html2pdf dari CDN (Periksa koneksi internet Anda atau integritas script diblokir browser).'));
    };
    document.body.appendChild(script);
  });
};

const Reports = () => {
  const [reportType, setReportType] = useState('Laporan Kehadiran');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Dynamic database states
  const [rooms, setRooms] = useState([]);
  const [membersData, setMembersData] = useState([]);
  const [presenceData, setPresenceData] = useState([]);
  const [logsData, setLogsData] = useState([]);
  const [gymProfile, setGymProfile] = useState(null);

  // Active filters state
  const [activeFilters, setActiveFilters] = useState({
    type: 'Laporan Kehadiran',
    start: '',
    end: '',
  });

  // PDF Configuration & Preview States
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfOrientation, setPdfOrientation] = useState('portrait');
  const [pdfPaperSize, setPdfPaperSize] = useState('a4');
  const [pdfMargin, setPdfMargin] = useState('medium');
  const [pdfIncludeCharts, setPdfIncludeCharts] = useState(true);
  const [pdfIncludeTable, setPdfIncludeTable] = useState(true);
  const [pdfZoom, setPdfZoom] = useState(0.75); // default zoom preview
  const [chartImages, setChartImages] = useState({ img1: null, img2: null });

  // Refs for elements
  const chartRef1 = useRef(null);
  const chartRef2 = useRef(null);
  const pdfContentRef = useRef(null);
  const pdfPrintRef = useRef(null);

  // Fetch all necessary report data from database on mount
  const fetchReportData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Gym Rooms
      const { data: roomData, error: roomError } = await supabase
        .from('location_rooms')
        .select('*');
      if (roomError) throw roomError;
      const roomsList = roomData || [];
      setRooms(roomsList);

      // 2. Fetch Members
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*');
      if (memberError) throw memberError;
      const membersList = memberData || [];
      setMembersData(membersList);

      // 3. Fetch Presences
      const { data: pData, error: pError } = await supabase
        .from('presences')
        .select('*');
      if (pError) throw pError;
      const presList = pData || [];
      setPresenceData(presList);

      // 4. Fetch Position Logs (limit to last 3000 for safety and performance)
      const { data: logData, error: logError } = await supabase
        .from('position_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(3000);
      if (logError) throw logError;
      const logsList = logData || [];
      setLogsData(logsList);

      // 5. Fetch Gym Profile
      const { data: profileData } = await supabase
        .from('gym_profiles')
        .select('*')
        .eq('gymId', 1)
        .single();
      setGymProfile(profileData || null);

    } catch (err) {
      console.error('Error fetching report database metrics:', err);
      gooeyToast.error('Gagal mengambil data laporan dari Supabase: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  const getDateRangeBounds = () => {
    let start = activeFilters.start ? new Date(activeFilters.start) : null;
    let end = activeFilters.end ? new Date(activeFilters.end) : null;

    if (!start && end) {
      // If only end is provided, start is 30 days before end
      start = new Date(end);
      start.setDate(start.getDate() - 30);
    } else if (start && !end) {
      // If only start is provided, end is today
      end = new Date();
    } else if (!start && !end) {
      // Fallback: last 30 days if somehow called but both empty
      end = new Date();
      start = new Date();
      start.setDate(start.getDate() - 30);
    }

    // Adjust end date timezone/time bounds to encompass the entire day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // Safety cap: Limit date range to a maximum of 90 days to keep chart render clean
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 90) {
      start = new Date(end);
      start.setDate(start.getDate() - 90);
    }

    return { start, end };
  };

  const handleGenerateReport = () => {
    setActiveFilters({
      type: reportType,
      start: startDate,
      end: endDate,
    });
      gooeyToast.success(`Filter Diterapkan: Menampilkan ${reportType}`);
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setActiveFilters(prev => ({
      ...prev,
      start: '',
      end: '',
    }));
    gooeyToast.info('Filter Direset: Menampilkan laporan bulanan default.');
  };

  const handleExportCSV = () => {
    let headers = [];
    let rows = [];
    const typeLabel = activeFilters.type.replace(/\s+/g, '_');
    const dateSuffix = `${activeFilters.start ? `_dari_${activeFilters.start}` : ''}${activeFilters.end ? `_hingga_${activeFilters.end}` : ''}`;
    const filename = `${typeLabel}${dateSuffix || '_bulanan_default'}.csv`;

    if (activeFilters.type === 'Laporan Kehadiran') {
      headers = ['Tanggal', 'ID Member', 'Nama Member', 'Jam Masuk', 'Jam Keluar', 'Area Utama'];
      const data = getFilteredPresence();
      rows = data.map(row => {
        const mName = membersData.find(m => m.memberId === row.memberId)?.name || 'Unknown Member';
        return [
          row.date || '',
          row.memberId || '',
          mName,
          row.in_time ? row.in_time.substring(0, 5) : '-',
          row.out_time ? row.out_time.substring(0, 5) : 'Aktif di Lokasi',
          row.area || 'Resepsionis'
        ];
      });
    } else if (activeFilters.type === 'Laporan Penggunaan Area') {
      headers = ['Nama Ruangan', 'Lebar (px)', 'Tinggi (px)', 'Total Telemetry Hit Logs', 'Persentase Kunjungan'];
      const logs = getFilteredLogs();
      const totalLogsCount = logs.length || 1;
      rows = rooms.map(room => {
        const count = logs.filter(log => {
          const lx = Number(log.x_position);
          const ly = Number(log.y_position);
          return lx >= Number(room.x) &&
                 lx <= Number(room.x) + Number(room.w) &&
                 ly >= Number(room.y) &&
                 ly <= Number(room.y) + Number(room.h);
        }).length;
        const pct = ((count / totalLogsCount) * 100).toFixed(1) + '%';
        return [
          room.name || '',
          Math.round(room.w),
          Math.round(room.h),
          count,
          pct
        ];
      });
    } else if (activeFilters.type === 'Laporan Member Baru') {
      headers = ['ID Member', 'Nama Member', 'Email', 'Tanggal Registrasi', 'Status Keaktifan'];
      const data = getFilteredMembers();
      rows = data.map(row => [
        row.memberId || '',
        row.name || '',
        row.email || '',
        row.created_at ? new Date(row.created_at).toLocaleDateString('id-ID') : '',
        row.member_status || ''
      ]);
    } else if (activeFilters.type === 'Laporan Member Tidak Aktif') {
      headers = ['ID Member', 'Nama Member', 'Email', 'Tanggal Registrasi', 'Status Keaktifan'];
      const data = getFilteredMembers().filter(m => m.member_status !== 'Aktif');
      rows = data.map(row => [
        row.memberId || '',
        row.name || '',
        row.email || '',
        row.created_at ? new Date(row.created_at).toLocaleDateString('id-ID') : '',
        row.member_status || ''
      ]);
    }

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
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      gooeyToast.success(`Export CSV Sukses: ${filename}`);
    }
  };

  // Helper: Filter helpers based on active filters
  const getFilteredPresence = () => {
    let data = presenceData;
    if (activeFilters.start) {
      data = data.filter(p => p.date >= activeFilters.start);
    }
    if (activeFilters.end) {
      data = data.filter(p => p.date <= activeFilters.end);
    }
    return data;
  };

  const getFilteredLogs = () => {
    let data = logsData;
    if (activeFilters.start) {
      const startLimit = new Date(activeFilters.start);
      data = data.filter(l => new Date(l.timestamp) >= startLimit);
    }
    if (activeFilters.end) {
      const endLimit = new Date(activeFilters.end);
      endLimit.setHours(23, 59, 59, 999);
      data = data.filter(l => new Date(l.timestamp) <= endLimit);
    }
    return data;
  };

  const getFilteredMembers = () => {
    let data = membersData;
    if (activeFilters.start) {
      const startLimit = new Date(activeFilters.start);
      data = data.filter(m => new Date(m.created_at) >= startLimit);
    }
    if (activeFilters.end) {
      const endLimit = new Date(activeFilters.end);
      endLimit.setHours(23, 59, 59, 999);
      data = data.filter(m => new Date(m.created_at) <= endLimit);
    }
    return data;
  };

  // --- Dynamic Stats Calculations for Charts ---

  // 1. Presence Charts Data
  const getPresenceChartData = () => {
    const presList = getFilteredPresence();
    
    if (activeFilters.start || activeFilters.end) {
      const { start, end } = getDateRangeBounds();
      const dayMap = {};
      
      let curr = new Date(start);
      while (curr <= end) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        dayMap[dateStr] = 0;
        curr.setDate(curr.getDate() + 1);
      }
      
      presList.forEach(p => {
        if (p.date && dayMap[p.date] !== undefined) {
          dayMap[p.date]++;
        }
      });
      
      return {
        labels: Object.keys(dayMap).map(d => d.substring(5)), // MM-DD
        data: Object.values(dayMap),
        label: 'Frekuensi Kehadiran Harian'
      };
    } else {
      // Default: monthly report data for last 5 months
      const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const labels = [];
      const data = [];
      const d = new Date();
      
      for (let i = 4; i >= 0; i--) {
        const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
        labels.push(monthNamesShort[m.getMonth()]);
        
        const count = presenceData.filter(p => {
          if (!p.date) return false;
          const pDate = new Date(p.date);
          return pDate.getMonth() === m.getMonth() && pDate.getFullYear() === m.getFullYear();
        }).length;
        data.push(count);
      }
      return { labels, data, label: 'Frekuensi Kehadiran Bulanan (Default)' };
    }
  };

  const getPresenceDoughnutData = () => {
    const presList = getFilteredPresence();
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    
    presList.forEach(p => {
      if (p.date) {
        const dayIdx = new Date(p.date).getDay();
        counts[dayIdx]++;
      }
    });

    const activeDays = days.filter((_, i) => counts[i] > 0);
    const activeCounts = counts.filter(c => c > 0);

    const defaultColors = [
      'rgba(248, 113, 113, 0.7)', // Coral (Minggu)
      'rgba(99, 102, 241, 0.7)',  // Indigo (Senin)
      'rgba(16, 185, 129, 0.7)',  // Sage Green (Selasa)
      'rgba(251, 191, 36, 0.7)',  // Amber (Rabu)
      'rgba(168, 85, 247, 0.7)',  // Purple (Kamis)
      'rgba(249, 115, 22, 0.7)',  // Orange (Jumat)
      'rgba(20, 184, 166, 0.7)',  // Teal (Sabtu)
    ];
    
    return {
      labels: activeDays.length > 0 ? activeDays : ['Tidak Ada Data'],
      data: activeCounts.length > 0 ? activeCounts : [100],
      colors: activeDays.length > 0 
        ? defaultColors.filter((_, i) => counts[i] > 0)
        : ['rgba(200, 200, 200, 0.4)']
    };
  };

  // 2. Area Charts Data
  const getAreaChartData = () => {
    const logs = getFilteredLogs();
    const labels = [];
    const counts = [];
    
    rooms.forEach(room => {
      labels.push(room.name);
      const count = logs.filter(log => {
        const lx = Number(log.x_position);
        const ly = Number(log.y_position);
        return lx >= Number(room.x) &&
               lx <= Number(room.x) + Number(room.w) &&
               ly >= Number(room.y) &&
               ly <= Number(room.y) + Number(room.h);
      }).length;
      counts.push(count);
    });
    
    const generalCount = logs.filter(log => {
      const lx = Number(log.x_position);
      const ly = Number(log.y_position);
      return !rooms.some(room => 
        lx >= Number(room.x) &&
        lx <= Number(room.x) + Number(room.w) &&
        ly >= Number(room.y) &&
        ly <= Number(room.y) + Number(room.h)
      );
    }).length;
    
    if (generalCount > 0 || rooms.length === 0) {
      labels.push('Area Umum');
      counts.push(generalCount);
    }
    
    return { labels, data: counts };
  };

  const getAreaDoughnutData = () => {
    const defaultColors = [
      'rgba(99, 102, 241, 0.7)',  // Indigo
      'rgba(16, 185, 129, 0.7)',   // Sage Green
      'rgba(251, 191, 36, 0.7)',   // Amber
      'rgba(248, 113, 113, 0.7)',  // Coral
      'rgba(168, 85, 247, 0.7)',  // Purple
      'rgba(249, 115, 22, 0.7)',  // Orange
      'rgba(20, 184, 166, 0.7)',  // Teal
    ];
    
    const { labels, data } = getAreaChartData();
    const colors = labels.map((name, idx) => {
      if (name === 'Area Umum') return 'rgba(100, 116, 139, 0.7)'; // Grey Slate
      return defaultColors[idx % defaultColors.length];
    });

    const hasData = data.some(d => d > 0);
    if (!hasData && rooms.length > 0) {
      // Standard fallback distribution if no active coordinates exist
      return {
        labels: rooms.map(r => r.name),
        data: rooms.map((_, i) => [40, 25, 20, 10, 5][i % 5] || 10),
        colors: rooms.map((_, i) => defaultColors[i % defaultColors.length])
      };
    }
    
    return {
      labels: labels.length > 0 ? labels : ['Tidak Ada Data'],
      data: labels.length > 0 ? data : [100],
      colors: labels.length > 0 ? colors : ['rgba(200, 200, 200, 0.4)']
    };
  };

  // 3. New Member Charts Data
  const getNewMemberChartData = () => {
    const mList = getFilteredMembers();
    
    if (activeFilters.start || activeFilters.end) {
      const { start, end } = getDateRangeBounds();
      const dayMap = {};
      
      let curr = new Date(start);
      while (curr <= end) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        dayMap[dateStr] = 0;
        curr.setDate(curr.getDate() + 1);
      }
      
      mList.forEach(m => {
        if (m.created_at) {
          const cDateStr = m.created_at.substring(0, 10);
          if (dayMap[cDateStr] !== undefined) {
            dayMap[cDateStr]++;
          }
        }
      });
      
      return {
        labels: Object.keys(dayMap).map(d => d.substring(5)),
        data: Object.values(dayMap),
        label: 'Pendaftaran Harian Member Baru'
      };
    } else {
      // Default: monthly report data for last 5 months
      const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const labels = [];
      const data = [];
      const d = new Date();
      
      for (let i = 4; i >= 0; i--) {
        const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
        labels.push(monthNamesShort[m.getMonth()]);
        
        const count = membersData.filter(mem => {
          if (!mem.created_at) return false;
          const cDate = new Date(mem.created_at);
          return cDate.getMonth() === m.getMonth() && cDate.getFullYear() === m.getFullYear();
        }).length;
        data.push(count);
      }
      return { labels, data, label: 'Pendaftaran Bulanan Member Baru (Default)' };
    }
  };

  const getMemberStatusComposition = () => {
    const mList = getFilteredMembers();
    const activeCount = mList.filter(m => m.member_status === 'Aktif').length;
    const inactiveCount = mList.filter(m => m.member_status !== 'Aktif').length;
    
    return {
      labels: ['Aktif', 'Tidak Aktif'],
      data: [activeCount, inactiveCount],
      colors: ['rgba(16, 185, 129, 0.7)', 'rgba(248, 113, 113, 0.7)'] // Success Green and Coral Red
    };
  };

  // 4. Inactive Member Charts Data
  const getInactiveMemberChartData = () => {
    const mList = getFilteredMembers().filter(m => m.member_status !== 'Aktif');
    
    if (activeFilters.start || activeFilters.end) {
      const { start, end } = getDateRangeBounds();
      const dayMap = {};
      
      let curr = new Date(start);
      while (curr <= end) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        dayMap[dateStr] = 0;
        curr.setDate(curr.getDate() + 1);
      }
      
      mList.forEach(m => {
        if (m.created_at) {
          const cDateStr = m.created_at.substring(0, 10);
          if (dayMap[cDateStr] !== undefined) {
            dayMap[cDateStr]++;
          }
        }
      });
      
      return {
        labels: Object.keys(dayMap).map(d => d.substring(5)),
        data: Object.values(dayMap),
        label: 'Member Tidak Aktif Baru Harian'
      };
    } else {
      // Default: monthly report data for last 5 months
      const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const labels = [];
      const data = [];
      const d = new Date();
      
      for (let i = 4; i >= 0; i--) {
        const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
        labels.push(monthNamesShort[m.getMonth()]);
        
        const count = membersData.filter(mem => {
          if (!mem.created_at) return false;
          const cDate = new Date(mem.created_at);
          return mem.member_status !== 'Aktif' && cDate.getMonth() === m.getMonth() && cDate.getFullYear() === m.getFullYear();
        }).length;
        data.push(count);
      }
      return { labels, data, label: 'Member Tidak Aktif Baru Bulanan (Default)' };
    }
  };

  // --- Dynamic Chart Rendering Bindings ---
  let chartTitle1 = 'Grafik Laporan';
  let chartTitle2 = 'Proporsi Data';
  let finalBarData = { labels: [], datasets: [] };
  let finalDoughnutData = { labels: [], datasets: [] };

  if (activeFilters.type === 'Laporan Kehadiran') {
    chartTitle1 = 'Grafik Frekuensi Kehadiran';
    chartTitle2 = 'Proporsi Kehadiran Berdasarkan Hari';
    const { labels, data, label } = getPresenceChartData();
    finalBarData = {
      labels,
      datasets: [
        {
          label,
          data,
          backgroundColor: 'rgba(99, 102, 241, 0.7)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1,
        }
      ]
    };

    const { labels: dLabels, data: dData, colors: dColors } = getPresenceDoughnutData();
    finalDoughnutData = {
      labels: dLabels,
      datasets: [
        {
          data: dData,
          backgroundColor: dColors,
          borderWidth: 1
        }
      ]
    };
  } else if (activeFilters.type === 'Laporan Penggunaan Area') {
    chartTitle1 = 'Grafik Telemetri Penggunaan Area (Hit Logs)';
    chartTitle2 = 'Distribusi Kunjungan Area Gym';
    const { labels, data } = getAreaChartData();
    finalBarData = {
      labels,
      datasets: [
        {
          label: 'Total Logs Terdeteksi',
          data,
          backgroundColor: 'rgba(20, 184, 166, 0.7)',
          borderColor: 'rgba(20, 184, 166, 1)',
          borderWidth: 1,
        }
      ]
    };

    const { labels: dLabels, data: dData, colors: dColors } = getAreaDoughnutData();
    finalDoughnutData = {
      labels: dLabels,
      datasets: [
        {
          data: dData,
          backgroundColor: dColors,
          borderWidth: 1
        }
      ]
    };
  } else if (activeFilters.type === 'Laporan Member Baru') {
    chartTitle1 = 'Grafik Registrasi Member Baru';
    chartTitle2 = 'Proporsi Status Keaktifan Member Baru';
    const { labels, data, label } = getNewMemberChartData();
    finalBarData = {
      labels,
      datasets: [
        {
          label,
          data,
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
        }
      ]
    };

    const { labels: dLabels, data: dData, colors: dColors } = getMemberStatusComposition();
    finalDoughnutData = {
      labels: dLabels,
      datasets: [
        {
          data: dData,
          backgroundColor: dColors,
          borderWidth: 1
        }
      ]
    };
  } else if (activeFilters.type === 'Laporan Member Tidak Aktif') {
    chartTitle1 = 'Grafik Member Tidak Aktif Baru';
    chartTitle2 = 'Proporsi Status Keaktifan Member';
    const { labels, data, label } = getInactiveMemberChartData();
    finalBarData = {
      labels,
      datasets: [
        {
          label,
          data,
          backgroundColor: 'rgba(248, 113, 113, 0.7)',
          borderColor: 'rgba(248, 113, 113, 1)',
          borderWidth: 1,
        }
      ]
    };

    const { labels: dLabels, data: dData, colors: dColors } = getMemberStatusComposition();
    finalDoughnutData = {
      labels: dLabels,
      datasets: [
        {
          data: dData,
          backgroundColor: dColors,
          borderWidth: 1
        }
      ]
    };
  }

  const handleOpenPdfModal = () => {
    // Capture the current Chart.js canvases as static base64 images
    const img1 = chartRef1.current ? chartRef1.current.toBase64Image() : null;
    const img2 = chartRef2.current ? chartRef2.current.toBase64Image() : null;
    setChartImages({ img1, img2 });
    setShowPdfModal(true);
  };

  const getSheetDimensions = () => {
    let width = 210;
    let height = 297;
    if (pdfPaperSize === 'letter') {
      width = 215.9;
      height = 279.4;
    } else if (pdfPaperSize === 'legal') {
      width = 215.9;
      height = 355.6;
    }

    if (pdfOrientation === 'landscape') {
      return { w: height, h: width };
    }
    return { w: width, h: height };
  };

  const downloadPDF = () => {
    const generatePdfPromise = (async () => {
      const html2pdf = await loadHtml2Pdf();
      const element = pdfPrintRef.current;

      const typeLabel = activeFilters.type.replace(/\s+/g, '_');
      const dateSuffix = `${activeFilters.start ? `_dari_${activeFilters.start}` : ''}${activeFilters.end ? `_hingga_${activeFilters.end}` : ''}`;
      const filename = `${typeLabel}${dateSuffix || '_bulanan_default'}.pdf`;

      const opt = {
        margin:       0,
        filename:     filename,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true, 
          logging: false,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: pdfPaperSize, orientation: pdfOrientation }
      };

      await html2pdf().from(element).set(opt).save();
      return filename;
    })();

    gooeyToast.promise(generatePdfPromise, {
      loading: 'Mempersiapkan PDF... Silakan tunggu sebentar.',
      success: (filename) => `Unduh PDF Sukses: ${filename}`,
      error: (err) => `Gagal Membuat PDF: ${err.message}`
    });
  };

  return (
    <div id="reports-content">
      <h2 className="mb-4">Laporan</h2>

      {/* Filter and Search Panel */}
      <div className="card border-0 shadow-sm mb-4 p-3" style={{ borderRadius: '12px' }}>
        <div className="row g-3 align-items-center">
          <div className="col-md-4 col-lg-4">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="bi bi-file-earmark-bar-graph"></i>
              </span>
              <select
                className="form-select border-start-0 ps-0"
                value={reportType}
                onChange={(e) => {
                  const val = e.target.value;
                  setReportType(val);
                  setActiveFilters(prev => ({
                    ...prev,
                    type: val
                  }));
                }}
              >
                <option value="Laporan Kehadiran">Laporan Kehadiran</option>
                <option value="Laporan Penggunaan Area">Laporan Penggunaan Area</option>
                <option value="Laporan Member Baru">Laporan Member Baru</option>
                <option value="Laporan Member Tidak Aktif">Laporan Member Tidak Aktif</option>
              </select>
            </div>
          </div>
          <div className="col-md-3 col-lg-3">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted" title="Tanggal Mulai">
                Mulai
              </span>
              <input
                type="date"
                className="form-control border-start-0 ps-0"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-3 col-lg-3">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted" title="Tanggal Akhir">
                Akhir
              </span>
              <input
                type="date"
                className="form-control border-start-0 ps-0"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="col-md-2 col-lg-2 d-flex gap-2">
            <button className="btn btn-primary flex-grow-1" onClick={handleGenerateReport}>
              <i className="bi bi-file-earmark-arrow-down me-1"></i> Filter
            </button>
            {(activeFilters.start || activeFilters.end || startDate || endDate) && (
              <button 
                className="btn btn-outline-secondary" 
                onClick={handleResetFilters} 
                title="Reset Filter Tanggal"
                style={{ paddingLeft: '12px', paddingRight: '12px' }}
              >
                <i className="bi bi-arrow-counterclockwise"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 text-muted">Menganalisis matriks & merekap laporan dari database...</p>
        </div>
      ) : (
        <>
          {/* Charts Row */}
          <div className="row">
            <div className="col-lg-6 mb-4">
              <div className="data-table-container" style={{ height: '100%', minHeight: '350px' }}>
                <h5 className="mb-3">{chartTitle1}</h5>
                <div style={{ height: '280px' }}>
                  <Bar ref={chartRef1} data={finalBarData} options={barOptions} />
                </div>
              </div>
            </div>
            <div className="col-lg-6 mb-4">
              <div className="data-table-container" style={{ height: '100%', minHeight: '350px' }}>
                <h5 className="mb-3">{chartTitle2}</h5>
                <div style={{ height: '280px' }}>
                  <Doughnut ref={chartRef2} data={finalDoughnutData} options={doughnutOptions} />
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Details Table Card */}
          <div className="data-table-container">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">
                Detail {activeFilters.type}
                <span className="badge bg-primary rounded-pill px-2.5 ms-2" style={{ fontSize: '11px' }}>
                  {activeFilters.type === 'Laporan Kehadiran' && getFilteredPresence().length}
                  {activeFilters.type === 'Laporan Penggunaan Area' && rooms.length}
                  {activeFilters.type === 'Laporan Member Baru' && getFilteredMembers().length}
                  {activeFilters.type === 'Laporan Member Tidak Aktif' && getFilteredMembers().filter(m => m.member_status !== 'Aktif').length}
                  {' Data'}
                </span>
              </h5>
              <div className="d-flex gap-2">
                <button 
                  className="btn btn-outline-danger btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5"
                  onClick={handleOpenPdfModal}
                  style={{ borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}
                >
                  <i className="bi bi-file-earmark-pdf fs-6"></i> Cetak PDF
                </button>
                <button 
                  className="btn btn-outline-success btn-sm d-flex align-items-center gap-1.5 px-3 py-1.5"
                  onClick={handleExportCSV}
                  style={{ borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}
                >
                  <i className="bi bi-filetype-csv fs-6"></i> Export CSV
                </button>
              </div>
            </div>
            
            <div className="table-responsive">
              {activeFilters.type === 'Laporan Kehadiran' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>ID Member</th>
                      <th>Nama Member</th>
                      <th>Jam Masuk</th>
                      <th>Jam Keluar</th>
                      <th>Area Summary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredPresence().length === 0 ? (
                      <tr>
                        <td colSpan="6" className="text-center text-muted py-4">Tidak ada data kehadiran yang sesuai filter.</td>
                      </tr>
                    ) : (
                      getFilteredPresence().map((row, idx) => {
                        const mName = membersData.find(m => m.memberId === row.memberId)?.name || 'Unknown Member';
                        return (
                          <tr key={idx}>
                            <td className="fw-semibold">{formatDateIndo(row.date)}</td>
                            <td className="font-monospace text-muted">{row.memberId}</td>
                            <td className="fw-bold">{mName}</td>
                            <td>{row.in_time ? row.in_time.substring(0, 5) : '-'}</td>
                            <td>
                              {row.out_time ? (
                                <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2">
                                  {row.out_time.substring(0, 5)}
                                </span>
                              ) : (
                                <span className="badge bg-success-subtle text-success border border-success-subtle px-2 animate-pulse">
                                  Aktif di Lokasi
                                </span>
                              )}
                            </td>
                            <td>
                              <span className="badge bg-primary text-white px-2">
                                {row.area || 'Resepsionis'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}

              {activeFilters.type === 'Laporan Penggunaan Area' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama Ruangan</th>
                      <th>Dimensi Kanvas</th>
                      <th>Total Telemetri Hit Logs</th>
                      <th>Persentase Kunjungan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center text-muted py-4">Belum ada ruangan yang ditandai di denah.</td>
                      </tr>
                    ) : (
                      (() => {
                        const logs = getFilteredLogs();
                        const totalLogsCount = logs.length || 1;
                        return rooms.map((room, idx) => {
                          const count = logs.filter(log => {
                            const lx = Number(log.x_position);
                            const ly = Number(log.y_position);
                            return lx >= Number(room.x) &&
                                   lx <= Number(room.x) + Number(room.w) &&
                                   ly >= Number(room.y) &&
                                   ly <= Number(room.y) + Number(room.h);
                          }).length;
                          const pct = ((count / totalLogsCount) * 100).toFixed(1) + '%';
                          return (
                            <tr key={idx}>
                              <td className="fw-bold">{room.name}</td>
                              <td className="font-monospace text-muted">{Math.round(room.w)}px × {Math.round(room.h)}px</td>
                              <td className="fw-semibold text-primary">{count} Hit</td>
                              <td>
                                <div className="d-flex align-items-center gap-2">
                                  <div className="progress flex-grow-1" style={{ height: '6px' }}>
                                    <div className="progress-bar bg-info" style={{ width: pct }}></div>
                                  </div>
                                  <span className="font-monospace fw-bold small" style={{ minWidth: '45px' }}>{pct}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()
                    )}
                  </tbody>
                </table>
              )}

              {activeFilters.type === 'Laporan Member Baru' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID Member</th>
                      <th>Nama Member</th>
                      <th>Email</th>
                      <th>Tanggal Registrasi</th>
                      <th>Status Keaktifan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredMembers().length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted py-4">Tidak ada pendaftaran member baru di rentang tanggal ini.</td>
                      </tr>
                    ) : (
                      getFilteredMembers().map((row, idx) => (
                        <tr key={idx}>
                          <td className="font-monospace fw-semibold text-muted">{row.memberId}</td>
                          <td className="fw-bold">{row.name}</td>
                          <td>{row.email}</td>
                          <td>{formatDateIndo(row.created_at)}</td>
                          <td>
                            <span className={`badge ${row.member_status === 'Aktif' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'} px-2.5`}>
                              {row.member_status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {activeFilters.type === 'Laporan Member Tidak Aktif' && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ID Member</th>
                      <th>Nama Member</th>
                      <th>Email</th>
                      <th>Tanggal Registrasi</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredMembers().filter(m => m.member_status !== 'Aktif').length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-success py-4">✓ Bagus! Semua member yang terdaftar berstatus Aktif.</td>
                      </tr>
                    ) : (
                      getFilteredMembers().filter(m => m.member_status !== 'Aktif').map((row, idx) => (
                        <tr key={idx}>
                          <td className="font-monospace fw-semibold text-muted">{row.memberId}</td>
                          <td className="fw-bold">{row.name}</td>
                          <td>{row.email}</td>
                          <td>{formatDateIndo(row.created_at)}</td>
                          <td>
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5">
                              {row.member_status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Dynamic Helper Methods for PDF Summary and Table Rendering */}
      {(() => {
        const renderPdfSummarySection = () => {
          const cardStyle = {
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '10px 12px',
            height: '100%'
          };
          const titleStyle = {
            fontSize: '9px',
            color: '#64748b',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            marginBottom: '4px'
          };
          const valueStyle = {
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#0f172a',
            margin: 0
          };

          if (activeFilters.type === 'Laporan Kehadiran') {
            const pres = getFilteredPresence();
            const uniqueDates = [...new Set(pres.map(p => p.date))].length || 1;
            const avgPres = (pres.length / uniqueDates).toFixed(1);

            const dayCounts = {};
            pres.forEach(p => {
              const day = new Date(p.date).toLocaleDateString('id-ID', { weekday: 'long' });
              dayCounts[day] = (dayCounts[day] || 0) + 1;
            });
            let maxDay = '-';
            let maxVal = 0;
            Object.entries(dayCounts).forEach(([day, count]) => {
              if (count > maxVal) {
                maxVal = count;
                maxDay = day;
              }
            });

            return (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Total Kehadiran</div>
                    <p style={valueStyle}>{pres.length} Orang</p>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Rata-Rata Harian</div>
                    <p style={valueStyle}>{avgPres} Kunjungan</p>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Hari Teramai</div>
                    <p style={valueStyle}>{maxDay}</p>
                  </div>
                </div>
              </>
            );
          } else if (activeFilters.type === 'Laporan Penggunaan Area') {
            const logs = getFilteredLogs();
            const roomHits = rooms.map(room => {
              const count = logs.filter(log => {
                const lx = Number(log.x_position);
                const ly = Number(log.y_position);
                return lx >= Number(room.x) &&
                       lx <= Number(room.x) + Number(room.w) &&
                       ly >= Number(room.y) &&
                       ly <= Number(room.y) + Number(room.h);
              }).length;
              return { name: room.name, count };
            });
            let topArea = 'Area Umum';
            let topCount = logs.filter(log => {
              const lx = Number(log.x_position);
              const ly = Number(log.y_position);
              return !rooms.some(room => 
                lx >= Number(room.x) &&
                lx <= Number(room.x) + Number(room.w) &&
                ly >= Number(room.y) &&
                ly <= Number(room.y) + Number(room.h)
              );
            }).length;
            roomHits.forEach(rh => {
              if (rh.count > topCount) {
                topCount = rh.count;
                topArea = rh.name;
              }
            });

            return (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Total Telemetri Hit Logs</div>
                    <p style={valueStyle}>{logs.length} Hit</p>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Area Terpopuler</div>
                    <p style={valueStyle} title={`${topCount} Hit`}>{topArea}</p>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Jumlah Area Terdaftar</div>
                    <p style={valueStyle}>{rooms.length} Ruangan</p>
                  </div>
                </div>
              </>
            );
          } else if (activeFilters.type === 'Laporan Member Baru') {
            const mList = getFilteredMembers();
            const activeCount = mList.filter(m => m.member_status === 'Aktif').length;
            const inactiveCount = mList.filter(m => m.member_status !== 'Aktif').length;

            return (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Total Member Baru</div>
                    <p style={valueStyle}>{mList.length} Member</p>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Status Aktif</div>
                    <p style={valueStyle}>{activeCount} Member</p>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Status Tidak Aktif</div>
                    <p style={valueStyle}>{inactiveCount} Member</p>
                  </div>
                </div>
              </>
            );
          } else if (activeFilters.type === 'Laporan Member Tidak Aktif') {
            const rawData = getFilteredMembers();
            const totalNew = rawData.length || 1;
            const inactiveCount = rawData.filter(m => m.member_status !== 'Aktif').length;
            const inactivePct = ((inactiveCount / totalNew) * 100).toFixed(1) + '%';

            return (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Total Member Tidak Aktif</div>
                    <p style={valueStyle}>{inactiveCount} Member</p>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Rasio Tidak Aktif</div>
                    <p style={valueStyle}>{inactivePct}</p>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={cardStyle}>
                    <div style={titleStyle}>Total Terdaftar (Periode Ini)</div>
                    <p style={valueStyle}>{rawData.length} Member</p>
                  </div>
                </div>
              </>
            );
          }
          return null;
        };

        const renderPdfTableSection = () => {
          const tableStyle = {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '10px',
            marginTop: '8px',
            color: '#1e293b'
          };
          const thStyle = {
            borderBottom: '2px solid #cbd5e1',
            padding: '6px 8px',
            fontWeight: 'bold',
            textAlign: 'left',
            backgroundColor: '#f8fafc'
          };
          const tdStyle = {
            borderBottom: '1px solid #f1f5f9',
            padding: '6px 8px',
            textAlign: 'left'
          };

          if (activeFilters.type === 'Laporan Kehadiran') {
            const data = getFilteredPresence();
            return (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Tanggal</th>
                    <th style={thStyle}>ID Member</th>
                    <th style={thStyle}>Nama Member</th>
                    <th style={thStyle}>Jam Masuk</th>
                    <th style={thStyle}>Jam Keluar</th>
                    <th style={thStyle}>Area</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8' }}>Tidak ada data.</td>
                    </tr>
                  ) : (
                    data.map((row, idx) => {
                      const mName = membersData.find(m => m.memberId === row.memberId)?.name || 'Unknown Member';
                      return (
                        <tr key={idx}>
                          <td style={tdStyle}>{formatDateIndo(row.date)}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{row.memberId}</td>
                          <td style={{ ...tdStyle, fontWeight: 'bold' }}>{mName}</td>
                          <td style={tdStyle}>{row.in_time ? row.in_time.substring(0, 5) : '-'}</td>
                          <td style={tdStyle}>{row.out_time ? row.out_time.substring(0, 5) : 'Aktif'}</td>
                          <td style={tdStyle}>{row.area || 'Resepsionis'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            );
          } else if (activeFilters.type === 'Laporan Penggunaan Area') {
            const logs = getFilteredLogs();
            const totalLogsCount = logs.length || 1;
            return (
              <div>
                <h6 style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>1. Rekapitulasi Penggunaan Ruangan</h6>
                <table style={{ ...tableStyle, marginBottom: '20px' }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Nama Ruangan / Area</th>
                      <th style={thStyle}>Total Hit Logs</th>
                      <th style={thStyle}>Persentase Kunjungan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8' }}>Tidak ada data ruangan.</td>
                      </tr>
                    ) : (
                      rooms.map((room, idx) => {
                        const count = logs.filter(log => {
                          if (log.area_name) return log.area_name === room.name;
                          const lx = Number(log.x_position) * 120;
                          const ly = Number(log.y_position) * 120;
                          return lx >= Number(room.x) &&
                                 lx <= Number(room.x) + Number(room.w) &&
                                 ly >= Number(room.y) &&
                                 ly <= Number(room.y) + Number(room.h);
                        }).length;
                        const pct = ((count / totalLogsCount) * 100).toFixed(1) + '%';
                        return (
                          <tr key={idx}>
                            <td style={{ ...tdStyle, fontWeight: 'bold' }}>{room.name}</td>
                            <td style={{ ...tdStyle, color: '#4f46e5', fontWeight: 'bold' }}>{count} Hit</td>
                            <td style={tdStyle}>{pct}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                <h6 style={{ fontSize: '13px', fontWeight: 'bold', color: '#334155', marginBottom: '8px' }}>2. Log Rekam Jejak Posisi Detail (Position Logs)</h6>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Waktu</th>
                      <th style={thStyle}>ID Tag</th>
                      <th style={thStyle}>Koordinat X, Y (m)</th>
                      <th style={thStyle}>Area / Zona Terdeteksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8' }}>Belum ada log rekam jejak posisi.</td>
                      </tr>
                    ) : (
                      logs.slice(0, 100).map((log, idx) => (
                        <tr key={idx}>
                          <td style={{ ...tdStyle, fontSize: '11px' }}>{new Date(log.timestamp).toLocaleString('id-ID')}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 'bold', color: '#4f46e5' }}>{log.tagId}</td>
                          <td style={{ ...tdStyle, fontFamily: 'monospace' }}>X: {Number(log.x_position).toFixed(2)}m, Y: {Number(log.y_position).toFixed(2)}m</td>
                          <td style={{ ...tdStyle, fontWeight: 'bold' }}>
                            <span style={{ backgroundColor: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '12px', fontSize: '10px' }}>
                              📍 {log.area_name || 'Area Umum'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            );
          } else if (activeFilters.type === 'Laporan Member Baru' || activeFilters.type === 'Laporan Member Tidak Aktif') {
            const isInactiveOnly = activeFilters.type === 'Laporan Member Tidak Aktif';
            const rawData = getFilteredMembers();
            const data = isInactiveOnly ? rawData.filter(m => m.member_status !== 'Aktif') : rawData;
            return (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>ID Member</th>
                    <th style={thStyle}>Nama Member</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Tanggal Registrasi</th>
                    <th style={thStyle}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ ...tdStyle, textAlign: 'center', color: '#94a3b8' }}>Tidak ada data.</td>
                    </tr>
                  ) : (
                    data.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{row.memberId}</td>
                        <td style={{ ...tdStyle, fontWeight: 'bold' }}>{row.name}</td>
                        <td style={tdStyle}>{row.email}</td>
                        <td style={tdStyle}>{formatDateIndo(row.created_at)}</td>
                        <td style={tdStyle}>{row.member_status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            );
          }
          return null;
        };

        return (
          <>
            {showPdfModal && (
              <div className="pdf-modal-backdrop" style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1050,
              }}>
                <div className="pdf-modal-card" style={{
                  width: '95%',
                  maxWidth: '1200px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '16px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  maxHeight: '90vh',
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  overflow: 'hidden'
                }}>
                  {/* Header */}
                  <div className="d-flex justify-content-between align-items-center px-4 py-3 bg-white border-bottom">
                    <h5 className="mb-0 fw-bold text-slate-800 d-flex align-items-center gap-2">
                      <i className="bi bi-file-earmark-pdf text-danger fs-4"></i>
                      Ekspor & Pratinjau PDF Laporan
                    </h5>
                    <button 
                      className="btn-close" 
                      onClick={() => setShowPdfModal(false)}
                      aria-label="Close"
                    ></button>
                  </div>

                  {/* Body */}
                  <div className="row g-0 flex-grow-1 overflow-hidden">
                    {/* Left Side: Control Panel */}
                    <div className="col-md-4 bg-white border-end p-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 130px)' }}>
                      <h6 className="fw-bold mb-3 text-slate-700 uppercase tracking-wider small">Konfigurasi Halaman</h6>
                      
                      {/* Orientation selection */}
                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-muted">Orientasi Halaman</label>
                        <div className="d-flex gap-2">
                          <button 
                            type="button"
                            className={`btn btn-sm flex-grow-1 ${pdfOrientation === 'portrait' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setPdfOrientation('portrait')}
                          >
                            <i className="bi bi-file-earmark-aspect-ratio me-1"></i> Portrait
                          </button>
                          <button 
                            type="button"
                            className={`btn btn-sm flex-grow-1 ${pdfOrientation === 'landscape' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setPdfOrientation('landscape')}
                          >
                            <i className="bi bi-file-earmark-aspect-ratio-fill me-1"></i> Landscape
                          </button>
                        </div>
                      </div>

                      {/* Paper size selection */}
                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-muted">Ukuran Kertas</label>
                        <select 
                          className="form-select form-select-sm"
                          value={pdfPaperSize}
                          onChange={(e) => setPdfPaperSize(e.target.value)}
                        >
                          <option value="a4">A4 (210 x 297 mm)</option>
                          <option value="letter">Letter (8.5 x 11 in)</option>
                          <option value="legal">Legal (8.5 x 14 in)</option>
                        </select>
                      </div>

                      {/* Margins */}
                      <div className="mb-4">
                        <label className="form-label small fw-semibold text-muted">Margin Halaman</label>
                        <div className="d-flex gap-2">
                          {['small', 'medium', 'large'].map((marginOption) => (
                            <button
                              key={marginOption}
                              type="button"
                              className={`btn btn-sm flex-grow-1 text-capitalize ${pdfMargin === marginOption ? 'btn-primary' : 'btn-outline-secondary'}`}
                              onClick={() => setPdfMargin(marginOption)}
                            >
                              {marginOption === 'small' ? 'Kecil' : marginOption === 'medium' ? 'Sedang' : 'Besar'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <hr className="my-4" />

                      <h6 className="fw-bold mb-3 text-slate-700 uppercase tracking-wider small">Konten Laporan</h6>
                      
                      {/* Include Charts */}
                      <div className="form-check form-switch mb-3">
                        <input 
                          className="form-check-input" 
                          type="checkbox" 
                          role="switch" 
                          id="pdfIncludeChartsCheck"
                          checked={pdfIncludeCharts}
                          onChange={(e) => setPdfIncludeCharts(e.target.checked)}
                        />
                        <label className="form-check-label small fw-semibold text-muted" htmlFor="pdfIncludeChartsCheck">
                          Sertakan Grafik Visual
                        </label>
                      </div>

                      {/* Include Table */}
                      <div className="form-check form-switch mb-4">
                        <input 
                          className="form-check-input" 
                          type="checkbox" 
                          role="switch" 
                          id="pdfIncludeTableCheck"
                          checked={pdfIncludeTable}
                          onChange={(e) => setPdfIncludeTable(e.target.checked)}
                        />
                        <label className="form-check-label small fw-semibold text-muted" htmlFor="pdfIncludeTableCheck">
                          Sertakan Tabel Detail
                        </label>
                      </div>

                      <hr className="my-4" />

                      <h6 className="fw-bold mb-3 text-slate-700 uppercase tracking-wider small">Pengaturan Pratinjau</h6>
                      
                      {/* Zoom Slider */}
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <label className="form-label small fw-semibold text-muted mb-0">Skala Zoom</label>
                          <span className="badge bg-secondary small">{Math.round(pdfZoom * 100)}%</span>
                        </div>
                        <input 
                          type="range" 
                          className="form-range" 
                          min="0.4" 
                          max="1.5" 
                          step="0.05"
                          value={pdfZoom}
                          onChange={(e) => setPdfZoom(parseFloat(e.target.value))}
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="d-flex flex-column gap-2 mt-4">
                        <button 
                          className="btn btn-primary w-100 py-2 fw-semibold d-flex justify-content-center align-items-center gap-2"
                          onClick={downloadPDF}
                        >
                          <i className="bi bi-download"></i> Unduh PDF Laporan
                        </button>
                        <button 
                          className="btn btn-outline-secondary w-100 py-2 small"
                          onClick={() => setShowPdfModal(false)}
                        >
                          Kembali
                        </button>
                      </div>
                    </div>

                    {/* Right Side: Document Preview Canvas */}
                    <div className="col-md-8 d-flex flex-column bg-dark p-4 justify-content-center align-items-center position-relative overflow-hidden" style={{ maxHeight: 'calc(90vh - 60px)' }}>
                      <div className="position-absolute top-0 start-0 w-100 bg-black bg-opacity-20 px-3 py-2 text-white-50 small d-flex justify-content-between align-items-center" style={{ zIndex: 5 }}>
                        <span>PRATINJAU DOKUMEN CETAK ({pdfPaperSize.toUpperCase()} - {pdfOrientation.toUpperCase()})</span>
                        <span>Gunakan scroll / zoom untuk menavigasi lembar pratinjau</span>
                      </div>

                      {/* Scaled paper sheet wrapper */}
                      <div style={{
                        width: '100%',
                        height: '100%',
                        overflow: 'auto',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        paddingTop: '40px',
                        paddingBottom: '40px',
                        boxSizing: 'border-box'
                      }}>
                        {/* Wrapper to handle scaling centering issues */}
                        <div style={{
                          transform: `scale(${pdfZoom})`,
                          transformOrigin: 'top center',
                          width: `${getSheetDimensions().w}mm`,
                          height: `${getSheetDimensions().h}mm`,
                          transition: 'transform 0.1s ease',
                          flexShrink: 0
                        }}>
                          {/* Actual printable sheet document */}
                          <div 
                            ref={pdfContentRef}
                            style={{
                              width: `${getSheetDimensions().w}mm`,
                              minHeight: `${getSheetDimensions().h}mm`,
                              padding: pdfMargin === 'small' ? '10mm' : pdfMargin === 'large' ? '25mm' : '15mm',
                              background: '#ffffff',
                              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
                              borderRadius: '2px',
                              color: '#1e293b',
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                              boxSizing: 'border-box',
                              position: 'relative',
                            }}
                          >
                            {/* PDF Header / Gym Kop */}
                            <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-4" style={{ borderColor: '#e2e8f0' }}>
                              <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#4f46e5', letterSpacing: '-0.5px' }}>
                                  {gymProfile?.name || 'FitTrack Pro'}
                                </h2>
                                <p style={{ fontSize: '10px', margin: '2px 0 0 0', color: '#64748b' }}>
                                  {gymProfile?.address || 'Jl. Fitness No. 123, Jakarta Selatan'}
                                </p>
                                <p style={{ fontSize: '9px', margin: '1px 0 0 0', color: '#64748b' }}>
                                  Telp: {gymProfile?.telp || '021-12345678'} | Email: {gymProfile?.email || 'info@fittrackpro.com'}
                                </p>
                              </div>
                              <div className="text-end">
                                <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#4338ca', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', padding: '3px 6px', borderRadius: '4px' }}>
                                  Gym Official Report
                                </span>
                                <p style={{ fontSize: '9px', margin: '6px 0 0 0', color: '#64748b' }}>
                                  Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </p>
                              </div>
                            </div>

                            {/* Report Title */}
                            <div className="text-center mb-4">
                              <h4 style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', margin: '0 0 4px 0' }}>
                                {activeFilters.type}
                              </h4>
                              <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>
                                Periode: {activeFilters.start ? formatDateIndo(activeFilters.start) : 'Awal'} s/d {activeFilters.end ? formatDateIndo(activeFilters.end) : 'Hari Ini'}
                              </p>
                            </div>

                            {/* Summary / Ringkasan Cards (Custom per Report Type) */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                              {renderPdfSummarySection()}
                            </div>

                            {/* Charts Section */}
                            {pdfIncludeCharts && (
                              <div className="mb-4">
                                <h5 style={{ fontSize: '12px', fontWeight: 600, color: '#334155', borderLeft: '3px solid #4f46e5', paddingLeft: '8px', marginBottom: '12px' }}>
                                  Analisis Data Grafis
                                  {/* Visual chart images captured */}
                                </h5>
                                <div style={{ display: 'flex', gap: '15px' }}>
                                  <div style={{ flex: 1, textAlign: 'center' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>{chartTitle1}</p>
                                    {chartImages.img1 ? (
                                      <img src={chartImages.img1} alt="Chart 1" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
                                    ) : (
                                      <div className="border rounded d-flex align-items-center justify-content-center bg-light text-muted" style={{ height: '150px', fontSize: '10px' }}>
                                        Grafik sedang dimuat...
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ flex: 1, textAlign: 'center' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>{chartTitle2}</p>
                                    {chartImages.img2 ? (
                                      <img src={chartImages.img2} alt="Chart 2" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
                                    ) : (
                                      <div className="border rounded d-flex align-items-center justify-content-center bg-light text-muted" style={{ height: '150px', fontSize: '10px' }}>
                                        Grafik sedang dimuat...
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Table Section */}
                            {pdfIncludeTable && (
                              <div className="mb-4">
                                <h5 style={{ fontSize: '12px', fontWeight: 600, color: '#334155', borderLeft: '3px solid #4f46e5', paddingLeft: '8px', marginBottom: '12px' }}>
                                  Detail Rekapitulasi Data
                                </h5>
                                <div className="table-responsive">
                                  {renderPdfTableSection()}
                                </div>
                              </div>
                            )}

                            {/* PDF Footer Notes */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '30px', fontSize: '9px', color: '#94a3b8' }}>
                              <span>Laporan FitTrack Pro.</span>
                              <span>Halaman 1 dari 1</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Off-screen hidden print target to avoid transform/zoom offset bugs */}
            {showPdfModal && (
              <div style={{ position: 'absolute', top: 0, left: '-9999px', zIndex: -1000, overflow: 'hidden' }}>
                <div 
                  ref={pdfPrintRef}
                  style={{
                    width: `${getSheetDimensions().w}mm`,
                    padding: pdfMargin === 'small' ? '10mm' : pdfMargin === 'large' ? '25mm' : '15mm',
                    background: '#ffffff',
                    color: '#1e293b',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* PDF Header / Gym Kop */}
                  <div className="d-flex justify-content-between align-items-start border-bottom pb-3 mb-4" style={{ borderColor: '#e2e8f0' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#4f46e5', letterSpacing: '-0.5px' }}>
                        {gymProfile?.name || 'FitTrack Pro'}
                      </h2>
                      <p style={{ fontSize: '10px', margin: '2px 0 0 0', color: '#64748b' }}>
                        {gymProfile?.address || 'Jl. Fitness No. 123, Jakarta Selatan'}
                      </p>
                      <p style={{ fontSize: '9px', margin: '1px 0 0 0', color: '#64748b' }}>
                        Telp: {gymProfile?.telp || '021-12345678'} | Email: {gymProfile?.email || 'info@fittrackpro.com'}
                      </p>
                    </div>
                    <div className="text-end">
                      <span className="badge" style={{ backgroundColor: '#e0e7ff', color: '#4338ca', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', padding: '3px 6px', borderRadius: '4px' }}>
                        Gym Official Report
                      </span>
                      <p style={{ fontSize: '9px', margin: '6px 0 0 0', color: '#64748b' }}>
                        Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  {/* Report Title */}
                  <div className="text-center mb-4">
                    <h4 style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', margin: '0 0 4px 0' }}>
                      {activeFilters.type}
                    </h4>
                    <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>
                      Periode: {activeFilters.start ? formatDateIndo(activeFilters.start) : 'Awal'} s/d {activeFilters.end ? formatDateIndo(activeFilters.end) : 'Hari Ini'}
                    </p>
                  </div>

                  {/* Summary / Ringkasan Cards (Custom per Report Type) */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    {renderPdfSummarySection()}
                  </div>

                  {/* Charts Section */}
                  {pdfIncludeCharts && (
                    <div className="mb-4">
                      <h5 style={{ fontSize: '12px', fontWeight: 600, color: '#334155', borderLeft: '3px solid #4f46e5', paddingLeft: '8px', marginBottom: '12px' }}>
                        Analisis Data Grafis
                      </h5>
                      <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <p style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>{chartTitle1}</p>
                          {chartImages.img1 ? (
                            <img src={chartImages.img1} alt="Chart 1" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
                          ) : (
                            <div className="border rounded d-flex align-items-center justify-content-center bg-light text-muted" style={{ height: '150px', fontSize: '10px' }}>
                              Grafik sedang dimuat...
                            </div>
                          )}
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <p style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>{chartTitle2}</p>
                          {chartImages.img2 ? (
                            <img src={chartImages.img2} alt="Chart 2" style={{ maxWidth: '100%', maxHeight: '180px', objectFit: 'contain' }} />
                          ) : (
                            <div className="border rounded d-flex align-items-center justify-content-center bg-light text-muted" style={{ height: '150px', fontSize: '10px' }}>
                              Grafik sedang dimuat...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Table Section */}
                  {pdfIncludeTable && (
                    <div className="mb-4">
                      <h5 style={{ fontSize: '12px', fontWeight: 600, color: '#334155', borderLeft: '3px solid #4f46e5', paddingLeft: '8px', marginBottom: '12px' }}>
                        Detail Rekapitulasi Data
                      </h5>
                      <div className="table-responsive">
                        {renderPdfTableSection()}
                      </div>
                    </div>
                  )}

                  {/* PDF Footer Notes */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '10px', marginTop: '30px', fontSize: '9px', color: '#94a3b8' }}>
                    <span>Laporan FitTrack Pro.</span>
                    <span>Halaman 1 dari 1</span>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
};

export default Reports;
