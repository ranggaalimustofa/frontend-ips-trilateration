import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { io } from 'socket.io-client';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import Swal from 'sweetalert2';

const ROOM_COLORS = [
  { fill: 'rgba(99, 102, 241, 0.15)', border: '#6366f1', text: '#6366f1' },
  { fill: 'rgba(16, 185, 129, 0.15)',  border: '#10b981', text: '#10b981' },
  { fill: 'rgba(251, 191, 36, 0.15)', border: '#fbbf24', text: '#fbbf24' },
  { fill: 'rgba(248, 113, 113, 0.15)', border: '#f87171', text: '#f87171' },
  { fill: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#a855f7' },
  { fill: 'rgba(249, 115, 22, 0.15)', border: '#f97316', text: '#f97316' },
  { fill: 'rgba(20, 184, 166, 0.15)', border: '#14b8a6', text: '#14b8a6' },
  { fill: 'rgba(239, 68, 68, 0.15)',  border: '#ef4444', text: '#ef4444' },
];

const OFFLINE_THRESHOLD_MS = 30000;  // 30 seconds = offline
const SLOW_THRESHOLD_MS    = 15000;  // 15 seconds = slow/warning

const PositionMonitoring = () => {
  const [rooms, setRooms] = useState([]);
  const [activeMembers, setActiveMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('Semua Status');
  const [areaFilter, setAreaFilter] = useState('Semua Area');
  const [activeMarker, setActiveMarker] = useState(null);
  const [bgImage, setBgImage] = useState(null);
  const [scaleMeters, setScaleMeters] = useState(() => {
    return Number(localStorage.getItem('gym_scale_meters') || 10);
  });
  const [scalePixels, setScalePixels] = useState(() => {
    return Number(localStorage.getItem('gym_scale_pixels') || 1200);
  });
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 900 });
  // anchorStatus: { [anchorId]: { anchorId, name, x, y, lastSeen: Date, distance: number } }
  const [anchorStatus, setAnchorStatus] = useState({});
  const anchorStatusRef = useRef({});
  const [hoveredAnchorId, setHoveredAnchorId] = useState(null);
  // anchorLogs: array of { id, anchorId, name, event, distance, time }
  const [anchorLogs, setAnchorLogs] = useState([]);
  const MAX_LOGS = 50;

  const scaleFactor = scalePixels / scaleMeters;

  const socketRef = useRef(null);
  const canvasAreaRef = useRef(null);
  const transformRef = useRef(null);

  // Fit image to viewport canvas (fits both width and height)
  const fitImageToView = useCallback((imgW, imgH) => {
    if (!transformRef.current || !canvasAreaRef.current) return;
    setTimeout(() => {
      const area = canvasAreaRef.current.getBoundingClientRect();
      const containerWidth = area.width || 800;
      const containerHeight = area.height || 600;
      
      // Calculate scale based on both width and height — use the smaller one so the image always fits
      const fitByWidth  = (containerWidth  / imgW) * 0.96;
      const fitByHeight = (containerHeight / imgH) * 0.96;
      const fitScale = Math.min(fitByWidth, fitByHeight);
      
      // Center the image in the viewport
      const posX = (containerWidth  - imgW * fitScale) / 2;
      const posY = (containerHeight - imgH * fitScale) / 2;
      transformRef.current.setTransform(posX, posY, fitScale, 300, 'easeOut');
    }, 120);
  }, []);

  // Fetch active gym rooms and active check-ins from database
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 0. Fetch gym profile scale settings
      const { data: gymProfile, error: profileError } = await supabase
        .from('gym_profiles')
        .select('images')
        .eq('gymId', 1)
        .single();

      let currentScalePixels = scalePixels;
      if (!profileError && gymProfile && gymProfile.images) {
        try {
          const parsed = JSON.parse(gymProfile.images);
          if (parsed.scaleMeters) {
            localStorage.setItem('gym_scale_meters', parsed.scaleMeters.toString());
            setScaleMeters(Number(parsed.scaleMeters));
          }
          if (parsed.scalePixels) {
            localStorage.setItem('gym_scale_pixels', parsed.scalePixels.toString());
            setScalePixels(Number(parsed.scalePixels));
            currentScalePixels = Number(parsed.scalePixels);
          }
        } catch (e) {
          // ignore
        }
      }
      
      // 1. Fetch Gym Rooms (from location_rooms table)
      const { data: roomData, error: roomError } = await supabase
        .from('location_rooms')
        .select('*')
        .order('roomId', { ascending: true });
      if (roomError) throw roomError;
      
      const formattedRooms = (roomData || []).map(r => ({
        id: r.roomId,
        name: r.name,
        x: Number(r.x),
        y: Number(r.y),
        w: Number(r.w),
        h: Number(r.h),
        colorIdx: Number(r.colorId || 0)
      }));
      setRooms(formattedRooms);

      // 2. Fetch Active Presences (checked-in today, out_time is null)
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      
      const { data: presenceData, error: presenceError } = await supabase
        .from('presences')
        .select('*, members(name, member_status, tags(tagId, battery_level))')
        .eq('date', todayStr)
        .is('out_time', null);
      if (presenceError) throw presenceError;

      const formattedMembers = [];
      for (const p of (presenceData || [])) {
        const name = p.members?.name || 'Unknown Member';
        const initials = name
          .split(' ')
          .map(n => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();

        const tag = p.members?.tags?.[0];
        const tagId = tag?.tagId;
        const battery = tag?.battery_level ?? 100;

        // Fetch latest position log from position_logs table for this tag
        let xVal = 5.7; // default coordinate in METERS
        let yVal = 0.8;

        if (tagId) {
          const { data: latestLog } = await supabase
            .from('position_logs')
            .select('x_position, y_position')
            .eq('tagId', tagId)
            .order('timestamp', { ascending: false })
            .limit(1);

          if (latestLog && latestLog.length > 0) {
            xVal = Number(latestLog[0].x_position);
            yVal = Number(latestLog[0].y_position);
          }
        }

        formattedMembers.push({
          presenceId: p.presenceId,
          memberId: p.memberId,
          tagId,
          name,
          initials,
          status: p.members?.member_status || 'Aktif',
          x: xVal,
          y: yVal,
          in_time: p.in_time,
          battery
        });
      }

      setActiveMembers(formattedMembers);

      // Load anchor positions from Supabase and init status
      const { data: anchorData, error: anchorError } = await supabase
        .from('anchor_positions')
        .select('*')
        .order('anchorId', { ascending: true });
      if (!anchorError && anchorData) {
        const initStatus = {};
        anchorData.forEach(a => {
          initStatus[a.anchorId] = {
            anchorId: a.anchorId,
            name: a.name,
            x: Number(a.x_position),
            y: Number(a.y_position),
            lastSeen: null,
            distance: null
          };
        });
        anchorStatusRef.current = initStatus;
        setAnchorStatus({ ...initStatus });
      }

      // Load layout map background if cached
      const cachedMap = localStorage.getItem('gym_floor_plan');
      if (cachedMap) {
        setBgImage(cachedMap);
        const img = new Image();
        img.onload = () => {
          const w = img.naturalWidth || 1200;
          const h = img.naturalHeight || 900;
          const aspectRatio = h / w;
          const finalW = currentScalePixels || w;
          const finalH = Math.round(finalW * aspectRatio);
          setCanvasSize({ width: finalW, height: finalH });
          fitImageToView(finalW, finalH);
        };
        img.src = cachedMap;
      }
    } catch (err) {
      console.error('Error fetching position monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Setup Socket.io real-time connection
    const socketUrl = 'http://localhost:5000';
    console.log(`Connecting to positioning socket at ${socketUrl}`);
    const socket = io(socketUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to positioning WebSocket server successfully!');
    });

    socket.on('location_update', (data) => {
      console.log('Live UWB location update received:', data);
      // data format: { tagId, memberId, name, status, x, y, battery, timestamp }
      setActiveMembers((prev) => {
        const idx = prev.findIndex((m) => m.memberId === data.memberId);
        
        const initials = (data.name || 'M')
          .split(' ')
          .map((n) => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();

        const updatedMember = {
          presenceId: idx !== -1 ? prev[idx].presenceId : Date.now(),
          memberId: data.memberId,
          name: data.name,
          initials,
          status: data.status || 'Aktif',
          x: Number(data.x),
          y: Number(data.y),
          in_time: idx !== -1 ? prev[idx].in_time : new Date().toTimeString().split(' ')[0],
          battery: data.battery !== undefined ? data.battery : (idx !== -1 ? prev[idx].battery : 100)
        };

        if (idx !== -1) {
          const newList = [...prev];
          newList[idx] = updatedMember;
          return newList;
        } else {
          return [...prev, updatedMember];
        }
      });
    });

    // Listen to anchor heartbeat from backend
    socket.on('anchor_heartbeat', (heartbeats) => {
      if (!Array.isArray(heartbeats)) return;
      const now = new Date();
      const timeStr = now.toTimeString().substring(0, 8);

      setAnchorStatus(prev => {
        const updated = { ...prev };
        heartbeats.forEach(hb => {
          updated[hb.anchorId] = {
            anchorId: hb.anchorId,
            name: hb.name || hb.anchorId,
            x: hb.x,
            y: hb.y,
            lastSeen: now,
            distance: hb.distance,
            ip: hb.ip || prev[hb.anchorId]?.ip || null
          };
          anchorStatusRef.current[hb.anchorId] = updated[hb.anchorId];
        });
        return updated;
      });

      // Push log entries for each anchor heartbeat received
      setAnchorLogs(prev => {
        const newEntries = heartbeats.map(hb => ({
          id: `${hb.anchorId}-${Date.now()}-${Math.random()}`,
          anchorId: hb.anchorId,
          name: hb.name || hb.anchorId,
          distance: hb.distance,
          rssi: hb.rssi,
          tagId: hb.tagId,
          time: timeStr
        }));
        return [...newEntries, ...prev].slice(0, MAX_LOGS);
      });
    });

    // Heartbeat watchdog: re-evaluate status every 5 seconds to detect offline anchors
    const watchdog = setInterval(() => {
      setAnchorStatus(prev => ({ ...prev })); // force re-render to recalculate elapsed time
    }, 5000);

    return () => {
      clearInterval(watchdog);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Helper to compute anchor connectivity status from lastSeen timestamp
  const getAnchorConnStatus = (lastSeen) => {
    if (!lastSeen) return 'unknown';
    const elapsed = Date.now() - new Date(lastSeen).getTime();
    if (elapsed > OFFLINE_THRESHOLD_MS) return 'offline';
    if (elapsed > SLOW_THRESHOLD_MS)    return 'slow';
    return 'online';
  };

  // Helper to map X, Y coordinates to Room Name
  const getRoomNameFromCoordinates = (x, y) => {
    if (x === null || y === null || (x === 0 && y === 0)) return 'Resepsionis';
    const numX = Number(x) * scaleFactor;
    const numY = Number(y) * scaleFactor;

    const foundRoom = rooms.find(
      (room) =>
        numX >= Number(room.x) &&
        numX <= Number(room.x) + Number(room.w) &&
        numY >= Number(room.y) &&
        numY <= Number(room.y) + Number(room.h)
    );

    return foundRoom ? foundRoom.name : 'Area Umum';
  };

  const handleAreaClick = (roomId, areaName) => {
    // Find dynamic members currently inside this room box
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;

    const membersInArea = activeMembers.filter((m) => {
      const pxX = m.x * scaleFactor;
      const pxY = m.y * scaleFactor;
      return (
        pxX >= room.x &&
        pxX <= room.x + room.w &&
        pxY >= room.y &&
        pxY <= room.y + room.h
      );
    });

    const membersListHtml = membersInArea.length > 0 
      ? `<ul style="text-align: left; margin-top: 10px; font-size: 14px;">${membersInArea.map((m) => `<li><b>${m.name}</b> (${m.memberId}) - Masuk: ${m.in_time.substring(0, 5)}</li>`).join('')}</ul>`
      : '<p style="margin-top: 10px; color: #777;">Tidak ada member di area ini saat ini.</p>';

    const roomWMeters = Number((room.w / scaleFactor).toFixed(1));
    const roomHMeters = Number((room.h / scaleFactor).toFixed(1));

    Swal.fire({
      icon: 'info',
      title: areaName,
      html: `
        <div>
          <span class="badge bg-primary px-3 py-2 mb-2">Dimensi: ${roomWMeters}m &times; ${roomHMeters}m</span>
          ${membersListHtml}
        </div>
      `,
      confirmButtonColor: '#6366f1',
      background: '#fff',
    });
  };

  // Filter Logic
  const filteredMembers = activeMembers.filter((m) => {
    const matchesStatus =
      statusFilter === 'Semua Status' ||
      (statusFilter === 'Aktif' && m.status === 'Aktif') ||
      (statusFilter === 'Tidak Aktif' && m.status !== 'Aktif');

    let matchesArea = true;
    if (areaFilter !== 'Semua Area') {
      const room = rooms.find(r => r.name === areaFilter);
      if (room) {
        const pxX = m.x * scaleFactor;
        const pxY = m.y * scaleFactor;
        matchesArea =
          pxX >= room.x &&
          pxX <= room.x + room.w &&
          pxY >= room.y &&
          pxY <= room.y + room.h;
      } else if (areaFilter === 'Area Umum') {
        matchesArea = getRoomNameFromCoordinates(m.x, m.y) === 'Area Umum';
      }
    }

    return matchesStatus && matchesArea;
  });

  return (
    <div id="position-content">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Live Indoor Positioning Tracker</h2>
          <p className="text-muted mb-0">Visualisasi posisi subjek dan Smart Tag secara real-time berbasis sinyal LoRa & Filter Kalman</p>
        </div>
        <button className="btn btn-outline-primary px-3 rounded-pill" onClick={fetchData}>
          <i className="bi bi-arrow-clockwise me-1"></i> Segarkan Peta
        </button>
      </div>

      <div className="row">
        <div className="col-lg-8 mb-4">
          <div className="indoor-map-container shadow-sm border-0" style={{ height: '620px', display: 'flex', flexDirection: 'column' }}>
            <h5 className="mb-3 d-flex justify-content-between align-items-center">
              <span>Denah Area / Gedung</span>
              <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1" style={{ fontSize: '10px' }}>
                <span className="spinner-grow spinner-grow-sm me-2 text-success" role="status" style={{ width: '8px', height: '8px' }}></span>
                Live Tracking Connected
              </span>
            </h5>
            
            <div ref={canvasAreaRef} style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#f5f7fb', borderRadius: '8px', border: '1px solid #dee2e6' }}>
              <TransformWrapper
                ref={transformRef}
                initialScale={0.65}
                minScale={0.2}
                maxScale={4}
                wheel={{ step: 0.001, smoothStep: 0.001 }}
              >
                {({ zoomIn, zoomOut }) => (
                  <>
                    {/* Zoom Buttons overlay */}
                    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 100, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <button className="btn btn-sm btn-light shadow-sm" onClick={() => zoomIn()} style={{ width: '32px', height: '32px', padding: 0 }}>＋</button>
                      <button className="btn btn-sm btn-light shadow-sm" onClick={() => zoomOut()} style={{ width: '32px', height: '32px', padding: 0 }}>－</button>
                      <button className="btn btn-sm btn-light shadow-sm" onClick={() => fitImageToView(canvasSize.width, canvasSize.height)} title="Fit to width" style={{ width: '32px', height: '32px', padding: 0 }}>⊞</button>
                    </div>

                    <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                      <div
                        id="indoor-map"
                        style={{
                          position: 'relative',
                          width: `${canvasSize.width}px`,
                          height: `${canvasSize.height}px`,
                          background: '#f8fafc',
                          backgroundImage: 
                            'linear-gradient(0deg, transparent 24%, rgba(200, 200, 200, 0.06) 25%, rgba(200, 200, 200, 0.06) 26%, transparent 27%, transparent 74%, rgba(200, 200, 200, 0.06) 75%, rgba(200, 200, 200, 0.06) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(200, 200, 200, 0.06) 25%, rgba(200, 200, 200, 0.06) 26%, transparent 27%, transparent 74%, rgba(200, 200, 200, 0.06) 75%, rgba(200, 200, 200, 0.06) 76%, transparent 77%, transparent)',
                          backgroundSize: '40px 40px',
                          boxShadow: 'inset 0 0 40px rgba(0,0,0,0.02)',
                        }}
                      >
                        {/* Floor Plan background image (if uploaded) */}
                        {bgImage && (
                          <img
                            src={bgImage}
                            alt="Denah Gym"
                            style={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              opacity: 0.85,
                              pointerEvents: 'none'
                            }}
                          />
                        )}

                        {/* Gym Rooms dynamically loaded from DB */}
                        {rooms.map((room) => {
                          const col = ROOM_COLORS[room.colorIdx % ROOM_COLORS.length];
                          return (
                            <div
                              key={room.id}
                              className="gym-area animate-fade-in"
                              style={{
                                position: 'absolute',
                                left: `${room.x}px`,
                                top: `${room.y}px`,
                                width: `${room.w}px`,
                                height: `${room.h}px`,
                                border: `2px solid ${col.border}`,
                                backgroundColor: col.fill,
                                color: col.border,
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: `0 2px 8px ${col.border}22`,
                                textShadow: '0 1px 2px rgba(255,255,255,0.8)'
                              }}
                              onClick={() => handleAreaClick(room.id, room.name)}
                            >
                              <div style={{ textAlign: 'center', padding: '5px' }}>
                                <div>{room.name}</div>
                                <div style={{ fontSize: '9px', opacity: 0.65, fontWeight: 'normal' }}>
                                  {activeMembers.filter(m => {
                                    const pxX = m.x * scaleFactor;
                                    const pxY = m.y * scaleFactor;
                                    return pxX >= room.x && pxX <= room.x + room.w && pxY >= room.y && pxY <= room.y + room.h;
                                  }).length} Orang
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Member Markers */}
                        <div id="member-markers">
                          {filteredMembers.map((member) => (
                            <div
                              key={member.memberId}
                              className={`member-marker ${activeMarker === member.memberId ? 'pulse active' : ''}`}
                              style={{
                                left: `${member.x * scaleFactor}px`,
                                top: `${member.y * scaleFactor}px`,
                                display: 'flex',
                                position: 'absolute',
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                backgroundColor: activeMarker === member.memberId ? 'var(--accent-color)' : 'var(--primary-color)',
                                border: '2px solid white',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                color: 'white',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                zIndex: 99,
                                transform: 'translate(-50%, -50%)',
                                transition: 'left 0.8s cubic-bezier(0.25, 0.8, 0.25, 1), top 0.8s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.2s ease, background-color 0.2s ease'
                              }}
                              onClick={() => setActiveMarker(member.memberId)}
                            >
                              {member.initials}
                              <div
                                className="member-tooltip"
                                style={{
                                  position: 'absolute',
                                  bottom: '40px',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  backgroundColor: 'rgba(33, 37, 41, 0.95)',
                                  color: 'white',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  whiteSpace: 'nowrap',
                                  pointerEvents: 'none',
                                  boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                  opacity: activeMarker === member.memberId ? 1 : 0,
                                  transition: 'opacity 0.2s ease',
                                  zIndex: 1000
                                }}
                              >
                                <div className="fw-bold">{member.name}</div>
                                <div className="text-muted" style={{ fontSize: '9px' }}>ID: {member.memberId}</div>
                                <div style={{ color: '#10b981', fontSize: '10px', marginTop: '3px' }}>
                                  📍 {getRoomNameFromCoordinates(member.x, member.y)}
                                </div>
                                {member.battery !== undefined && (
                                  <div style={{ color: member.battery < 20 ? '#f87171' : member.battery < 60 ? '#fbbf24' : '#10b981', fontSize: '10px', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <i className={`bi ${member.battery < 20 ? 'bi-battery text-danger animate-pulse' : member.battery < 60 ? 'bi-battery-half text-warning' : 'bi-battery-full text-success'}`}></i>
                                    Baterai: {member.battery}%
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Anchor Markers */}
                        <div id="anchor-markers">
                          {Object.values(anchorStatus).map((anchor) => {
                            const connStatus = getAnchorConnStatus(anchor.lastSeen);
                            const statusColor = {
                              online: '#10b981',   // Emerald
                              slow: '#f59e0b',     // Amber
                              offline: '#ef4444',  // Red
                              unknown: '#94a3b8',  // Slate
                            }[connStatus];

                            const statusLabel = {
                              online: 'Online',
                              slow: 'Lambat',
                              offline: 'Offline',
                              unknown: 'Menunggu',
                            }[connStatus];

                            const isOnline = connStatus === 'online';

                            return (
                              <div
                                key={anchor.anchorId}
                                className="anchor-marker"
                                onMouseEnter={() => setHoveredAnchorId(anchor.anchorId)}
                                onMouseLeave={() => setHoveredAnchorId(null)}
                                style={{
                                  left: `${anchor.x * scaleFactor}px`,
                                  top: `${anchor.y * scaleFactor}px`,
                                  display: 'flex',
                                  position: 'absolute',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  backgroundColor: '#1f2937', // Gray 800 background
                                  border: `2px solid ${statusColor}`,
                                  boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                  color: statusColor,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                  zIndex: 90,
                                  transform: 'translate(-50%, -50%)',
                                  transition: 'all 0.2s ease',
                                }}
                              >
                                {isOnline && (
                                  <span style={{
                                    position: 'absolute',
                                    inset: -4,
                                    borderRadius: '50%',
                                    border: `1.5px solid ${statusColor}`,
                                    opacity: 0.6,
                                    animation: 'pulse-ring 1.4s ease-out infinite'
                                  }} />
                                )}

                                <i className={`bi ${connStatus === 'online' ? 'bi-broadcast' : connStatus === 'slow' ? 'bi-wifi-2' : connStatus === 'offline' ? 'bi-wifi-off' : 'bi-hourglass-split'}`}></i>

                                {/* Tooltip */}
                                <div
                                  className="anchor-tooltip"
                                  style={{
                                    position: 'absolute',
                                    bottom: '34px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    backgroundColor: 'rgba(17, 24, 39, 0.95)', // Slate 900
                                    color: 'white',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    whiteSpace: 'nowrap',
                                    pointerEvents: 'none',
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                                    opacity: hoveredAnchorId === anchor.anchorId ? 1 : 0,
                                    visibility: hoveredAnchorId === anchor.anchorId ? 'visible' : 'hidden',
                                    transition: 'opacity 0.2s ease, visibility 0.2s ease',
                                    zIndex: 1000,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                  }}
                                >
                                  <div className="fw-bold d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: statusColor }} />
                                    {anchor.name}
                                  </div>
                                  <div className="text-muted" style={{ fontSize: '9px', marginTop: '2px' }}>ID: {anchor.anchorId}</div>
                                  <div style={{ color: '#e5e7eb', fontSize: '10px', marginTop: '4px' }}>
                                    📍 X: {anchor.x.toFixed(2)}m · Y: {anchor.y.toFixed(2)}m
                                  </div>
                                  {anchor.distance !== null && anchor.distance !== undefined && (
                                    <div style={{ color: '#93c5fd', fontSize: '10px', marginTop: '2px' }}>
                                      📡 Jarak: {anchor.distance.toFixed(2)}m
                                    </div>
                                  )}
                                  <div style={{ color: statusColor, fontSize: '10px', marginTop: '2px', fontWeight: 600 }}>
                                    Status: {statusLabel}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </TransformComponent>
                  </>
                )}
              </TransformWrapper>
            </div>

            {/* Map Legend */}
            <div className="map-legend mt-3 position-relative border-0 shadow-none py-2 px-0 bg-transparent" style={{ bottom: 'auto', left: 'auto', transform: 'none', justifyContent: 'center' }}>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: 'var(--primary-color)' }}></div>
                <span>Member Aktif</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: 'var(--accent-color)' }}></div>
                <span>Fokus Pilihan</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ 
                  backgroundColor: '#1f2937', 
                  border: '1.5px solid #10b981', 
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10b981',
                  fontSize: '8px',
                  width: '14px',
                  height: '14px'
                }}>
                  <i className="bi bi-broadcast" style={{ fontSize: '8px' }}></i>
                </div>
                <span>Anchor UWB</span>
              </div>
              <div className="legend-item animate-pulse">
                <span className="spinner-grow spinner-grow-sm text-success me-1" role="status" style={{ width: '10px', height: '10px' }}></span>
                <span className="text-muted" style={{ fontSize: '11px' }}>Pergerakan Tag Real-time</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-4">

          {/* Member di Lokasi — dikembalikan ke atas */}

          <div className="member-filter mb-4 shadow-sm border-0">
            <h5 className="mb-3">Filter Panel</h5>
            <div className="mb-3">
              <label className="form-label text-muted small">Status Member</label>
              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option>Semua Status</option>
                <option>Aktif</option>
                <option>Tidak Aktif</option>
              </select>
            </div>
            <div>
              <label className="form-label text-muted small">Area / Ruangan</label>
              <select
                className="form-select"
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
              >
                <option>Semua Area</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.name}>{room.name}</option>
                ))}
                <option value="Area Umum">Area Umum</option>
              </select>
            </div>
          </div>

          <div className="member-list shadow-sm border-0" style={{ height: '400px' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Member di Lokasi</h5>
              <span className="badge bg-primary rounded-pill px-2">{filteredMembers.length} Aktif</span>
            </div>
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border spinner-border-sm text-primary" role="status"></div>
                <p className="mt-2 text-muted small">Memuat daftar...</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-5 text-muted small">
                Tidak ada member aktif yang terdeteksi di lokasi.
              </div>
            ) : (
              <div id="member-list-container">
                {filteredMembers.map((member) => {
                  const area = getRoomNameFromCoordinates(member.x, member.y);
                  return (
                    <div
                      key={member.memberId}
                      className={`member-item d-flex align-items-center p-2 mb-2 rounded border ${activeMarker === member.memberId ? 'active border-primary' : 'border-light'}`}
                      onClick={() => setActiveMarker(member.memberId)}
                      style={{ transition: 'all 0.2s ease', cursor: 'pointer' }}
                    >
                      <div className="member-avatar bg-primary text-white" style={{ width: '36px', height: '36px', minWidth: '36px' }}>
                        {member.initials}
                      </div>
                      <div className="member-info flex-grow-1 min-w-0 ms-2">
                        <div className="member-name text-truncate fw-bold" style={{ fontSize: '13px' }}>{member.name}</div>
                        <div className="member-status text-truncate" style={{ fontSize: '11px', color: '#666' }}>📍 {area}</div>
                      </div>
                      <span className="status-badge status-active font-monospace" style={{ fontSize: '9px', padding: '2px 8px' }}>
                        {member.in_time.substring(0, 5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Anchor Status + Log Panel side by side */}
      <div className="row mt-3">
        {/* Anchor Status Panel */}
        <div className="col-lg-6 mb-4">
          <div className="member-list shadow-sm border-0" style={{ minHeight: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Status Koneksi Anchor</h5>
              <span className="badge bg-secondary rounded-pill px-2" style={{ fontSize: '10px' }}>
                {Object.keys(anchorStatus).length} Anchor
              </span>
            </div>
            {Object.keys(anchorStatus).length === 0 ? (
              <div className="text-center py-3 text-muted small">Tidak ada data anchor.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.values(anchorStatus).map(anchor => {
                  const connStatus = getAnchorConnStatus(anchor.lastSeen);
                  const elapsed = anchor.lastSeen
                    ? Math.floor((Date.now() - new Date(anchor.lastSeen).getTime()) / 1000)
                    : null;
                  const statusConfig = {
                    online:  { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Online',   icon: 'bi-wifi',            pulse: true  },
                    slow:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  label: 'Lambat',   icon: 'bi-wifi-2',          pulse: false },
                    offline: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Offline',  icon: 'bi-wifi-off',        pulse: false },
                    unknown: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Menunggu', icon: 'bi-hourglass-split', pulse: false },
                  }[connStatus];
                  return (
                    <div key={anchor.anchorId} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', borderRadius: '10px',
                      background: statusConfig.bg,
                      border: `1px solid ${statusConfig.color}33`,
                      transition: 'all 0.4s ease'
                    }}>
                      <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: statusConfig.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontSize: '14px'
                        }}>
                          <i className={`bi ${statusConfig.icon}`}></i>
                        </div>
                        {statusConfig.pulse && (
                          <span style={{
                            position: 'absolute', top: 0, left: 0,
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: statusConfig.color, opacity: 0.35,
                            animation: 'pulse-ring 1.4s ease-out infinite'
                          }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{anchor.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          X:{anchor.x}m · Y:{anchor.y}m
                          {anchor.ip && (
                            <span style={{ marginLeft: '6px', color: '#6366f1', fontWeight: 600 }}>
                              · IP: {anchor.ip}
                            </span>
                          )}
                          {anchor.distance !== null && (
                            <span style={{ marginLeft: '6px', color: statusConfig.color }}>
                              · dist: {anchor.distance.toFixed(2)}m
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '3px 10px',
                          borderRadius: '20px', background: statusConfig.color,
                          color: '#fff', display: 'block', marginBottom: '2px'
                        }}>{statusConfig.label}</span>
                        <span style={{ fontSize: '9px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {elapsed === null ? '—' : elapsed < 60 ? `${elapsed}d` : `${Math.floor(elapsed/60)}m ${elapsed%60}d`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Log Panel */}
        <div className="col-lg-6 mb-4">
          <div className="member-list shadow-sm border-0" style={{ minHeight: 'auto' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Log Aktivitas Anchor</h5>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span className="badge bg-primary rounded-pill px-2" style={{ fontSize: '10px' }}>
                  {anchorLogs.length} Event
                </span>
                <button
                  className="btn btn-sm btn-outline-secondary rounded-pill px-2 py-0"
                  style={{ fontSize: '10px' }}
                  onClick={() => setAnchorLogs([])}
                  title="Bersihkan log"
                >
                  <i className="bi bi-trash3"></i>
                </button>
              </div>
            </div>
            {anchorLogs.length === 0 ? (
              <div className="text-center py-4 text-muted small">
                <i className="bi bi-broadcast me-1"></i>
                Menunggu sinyal dari anchor...
              </div>
            ) : (
              <div style={{
                maxHeight: '260px', overflowY: 'auto',
                display: 'flex', flexDirection: 'column', gap: '4px',
                paddingRight: '4px'
              }}>
                {anchorLogs.map((log) => (
                  <div key={log.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 12px', borderRadius: '8px',
                    background: '#f8fafc', border: '1px solid #e2e8f0',
                    fontSize: '11px', animation: 'fadeInLog 0.3s ease',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{
                      fontFamily: 'monospace', fontSize: '10px',
                      color: '#6366f1', fontWeight: 700, flexShrink: 0
                    }}>{log.time}</span>
                    <span style={{ color: '#1e293b', fontWeight: 600, flexShrink: 0 }}>
                      <i className="bi bi-broadcast-pin me-1" style={{ color: '#10b981' }}></i>
                      {log.name}
                    </span>
                    
                    {log.tagId ? (
                      <span className="badge bg-info-subtle text-info border border-info-subtle px-2 py-0.5 rounded-pill" style={{ fontSize: '9px', fontWeight: 600 }}>
                        🏷️ {log.tagId}
                      </span>
                    ) : (
                      <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2 py-0.5 rounded-pill" style={{ fontSize: '9px', fontWeight: 500 }}>
                        💓 Heartbeat
                      </span>
                    )}

                    <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '10px', alignItems: 'center', fontFamily: 'monospace' }}>
                      {log.rssi !== null && log.rssi !== undefined && (
                        <span style={{ color: '#f97316', fontSize: '10px', fontWeight: 600 }}>
                          📶 {log.rssi} dBm
                        </span>
                      )}
                      <span style={{ color: '#475569', fontWeight: 700 }}>
                        {log.distance !== null && log.distance !== undefined
                          ? `📏 ${Number(log.distance).toFixed(2)}m`
                          : '—'
                        }
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PositionMonitoring;

