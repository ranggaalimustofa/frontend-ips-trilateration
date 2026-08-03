import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { supabase } from '../services/supabaseClient';
import Swal from 'sweetalert2';
import { gooeyToast } from 'goey-toast';

// ─── Constants ────────────────────────────────────────────────────────────────
const ROOM_COLORS = [
  { fill: 'rgba(59,130,246,0.25)', border: '#3b82f6', text: '#93c5fd' },
  { fill: 'rgba(34,197,94,0.25)',  border: '#22c55e', text: '#86efac' },
  { fill: 'rgba(168,85,247,0.25)', border: '#a855f7', text: '#d8b4fe' },
  { fill: 'rgba(249,115,22,0.25)', border: '#f97316', text: '#fdba74' },
  { fill: 'rgba(236,72,153,0.25)', border: '#ec4899', text: '#f9a8d4' },
  { fill: 'rgba(234,179,8,0.25)',  border: '#eab308', text: '#fde047' },
  { fill: 'rgba(20,184,166,0.25)', border: '#14b8a6', text: '#5eead4' },
  { fill: 'rgba(239,68,68,0.25)',  border: '#ef4444', text: '#fca5a5' },
];

const MIN_RECT_SIZE = 20; // px in canvas space

// ─── RoomRect ─────────────────────────────────────────────────────────────────
const RoomRect = ({ room, selected, onSelect, onDelete, onUpdate, getScale }) => {
  const dragState  = useRef(null);
  const resizeState = useRef(null);
  const col = ROOM_COLORS[room.colorIdx % ROOM_COLORS.length];

  // ── drag-move ──
  const onMouseDownMove = (e) => {
    if (e.target.closest('[data-handle]')) return;
    e.stopPropagation();
    onSelect(room.id);
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: room.x,
      origY: room.y,
    };
    const onMove = (me) => {
      if (!dragState.current) return;
      const s = getScale();
      const dx = (me.clientX - dragState.current.startX) / s;
      const dy = (me.clientY - dragState.current.startY) / s;
      onUpdate(room.id, { x: dragState.current.origX + dx, y: dragState.current.origY + dy });
    };
    const onUp = () => {
      dragState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ── resize ──
  const onMouseDownResize = (e, corner) => {
    e.stopPropagation();
    resizeState.current = {
      corner,
      startX: e.clientX, startY: e.clientY,
      origX: room.x, origY: room.y,
      origW: room.w, origH: room.h,
    };
    const onMove = (me) => {
      if (!resizeState.current) return;
      const { corner: c, startX, startY, origX, origY, origW, origH } = resizeState.current;
      const s = getScale();
      const dx = (me.clientX - startX) / s;
      const dy = (me.clientY - startY) / s;
      let nx = origX, ny = origY, nw = origW, nh = origH;
      if (c.includes('e')) nw = Math.max(MIN_RECT_SIZE, origW + dx);
      if (c.includes('s')) nh = Math.max(MIN_RECT_SIZE, origH + dy);
      if (c.includes('w')) { nx = origX + dx; nw = Math.max(MIN_RECT_SIZE, origW - dx); }
      if (c.includes('n')) { ny = origY + dy; nh = Math.max(MIN_RECT_SIZE, origH - dy); }
      onUpdate(room.id, { x: nx, y: ny, w: nw, h: nh });
    };
    const onUp = () => {
      resizeState.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const handles = [
    { id: 'nw', style: { top: -5, left: -5, cursor: 'nw-resize' } },
    { id: 'ne', style: { top: -5, right: -5, cursor: 'ne-resize' } },
    { id: 'sw', style: { bottom: -5, left: -5, cursor: 'sw-resize' } },
    { id: 'se', style: { bottom: -5, right: -5, cursor: 'se-resize' } },
    { id: 'n',  style: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize'  } },
    { id: 's',  style: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' } },
    { id: 'w',  style: { left: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'w-resize'  } },
    { id: 'e',  style: { right: -4, top: '50%', transform: 'translateY(-50%)', cursor: 'e-resize'  } },
  ];

  return (
    <div
      onMouseDown={onMouseDownMove}
      style={{
        position: 'absolute',
        left: room.x, top: room.y,
        width: room.w, height: room.h,
        background: col.fill,
        border: `2px solid ${selected ? '#fff' : col.border}`,
        boxShadow: selected ? `0 0 0 2px ${col.border}, 0 4px 24px ${col.border}55` : `0 2px 8px ${col.border}44`,
        borderRadius: 6,
        cursor: 'move',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
        zIndex: selected ? 20 : 10,
        transition: 'box-shadow .15s, border-color .15s',
      }}
    >
      {/* label */}
      <div style={{
        fontSize: 13, fontWeight: 700, color: col.text,
        textShadow: '0 1px 4px #000',
        textAlign: 'center',
        padding: '2px 8px',
        pointerEvents: 'none',
        maxWidth: '90%',
        wordBreak: 'break-word',
        lineHeight: 1.3,
      }}>
        {room.name}
      </div>
      <div style={{ fontSize: 10, color: col.text, opacity: .65, pointerEvents: 'none' }}>
        {Math.round(room.w)}×{Math.round(room.h)}
      </div>

      {/* delete button */}
      {selected && (
        <button
          data-handle="del"
          onClick={(e) => { e.stopPropagation(); onDelete(room.id); }}
          style={{
            position: 'absolute', top: -14, right: -14,
            width: 24, height: 24, borderRadius: '50%',
            background: '#ef4444', border: '2px solid #fff',
            color: '#fff', fontSize: 13, lineHeight: 1,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 30,
            boxShadow: '0 2px 6px #0008',
          }}
        >×</button>
      )}

      {/* resize handles */}
      {selected && handles.map(h => (
        <div
          key={h.id}
          data-handle={h.id}
          onMouseDown={(e) => onMouseDownResize(e, h.id)}
          style={{
            position: 'absolute',
            width: 10, height: 10,
            background: col.border,
            border: '2px solid #fff',
            borderRadius: 2,
            zIndex: 25,
            ...h.style,
          }}
        />
      ))}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const GymLayoutManager = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bgImage, setBgImage]       = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 900 });
  const [scaleMeters, setScaleMeters] = useState(() => {
    return Number(localStorage.getItem('gym_scale_meters') || 10);
  });
  const [scalePixels, setScalePixels] = useState(() => {
    return Number(localStorage.getItem('gym_scale_pixels') || 1200);
  });
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 1200, height: 900 });

  // Monitor scalePixels and imgNaturalSize to scale canvas height proportionally
  useEffect(() => {
    if (imgNaturalSize.width) {
      const aspectRatio = imgNaturalSize.height / imgNaturalSize.width;
      setCanvasSize({
        width: scalePixels,
        height: Math.round(scalePixels * aspectRatio),
      });
    }
  }, [scalePixels, imgNaturalSize]);

  // Fetch gym rooms and scale settings from Supabase on mount
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch facility profile scale settings
        const { data: facilityProfile, error: profileError } = await supabase
          .from('facility_profiles')
          .select('images')
          .eq('facilityId', 1)
          .single();

        let dbScaleMeters = 10;
        let dbScalePixels = 1200;

        if (!profileError && facilityProfile && facilityProfile.images) {
          try {
            const parsed = JSON.parse(gymProfile.images);
            if (parsed.scaleMeters) dbScaleMeters = Number(parsed.scaleMeters);
            if (parsed.scalePixels) dbScalePixels = Number(parsed.scalePixels);
            
            localStorage.setItem('gym_scale_meters', dbScaleMeters.toString());
            localStorage.setItem('gym_scale_pixels', dbScalePixels.toString());
            setScaleMeters(dbScaleMeters);
            setScalePixels(dbScalePixels);
          } catch (e) {
            // images is not JSON (mock string banner), ignore
          }
        }

        // 2. Fetch rooms layout
        const { data, error } = await supabase
          .from('location_rooms')
          .select('*')
          .order('roomId', { ascending: true });
        
        if (error) throw error;
        
        const formatted = (data || []).map(r => ({
          id: r.roomId,
          name: r.name,
          x: Number(r.x),
          y: Number(r.y),
          w: Number(r.w),
          h: Number(r.h),
          colorIdx: Number(r.colorId || 0)
        }));
        
        setRooms(formatted);

        // 3. Load cached floor plan background if exists
        const cachedMap = localStorage.getItem('gym_floor_plan');
        if (cachedMap) {
          setBgImage(cachedMap);
          setTimeout(() => {
            const img = new Image();
            img.onload = () => {
              const w = img.naturalWidth  || 1200;
              const h = img.naturalHeight || 900;
              setImgNaturalSize({ width: w, height: h });
              
              const savedPx = Number(localStorage.getItem('gym_scale_pixels'));
              const finalW = savedPx || w;
              setScalePixels(finalW);
              fitImageToView(finalW, h);
            };
            img.src = cachedMap;
          }, 200);
        }
      } catch (err) {
        console.error('Error loading gym rooms:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRooms();
  }, []);
  const [showGrid, setShowGrid]     = useState(true);
  const [tool, setTool]             = useState('select'); // 'select' | 'draw'
  const [selectedId, setSelectedId] = useState(null);
  const [newName, setNewName]       = useState('');
  const [newColorIdx, setNewColorIdx] = useState(0);
  const [pendingRoom, setPendingRoom] = useState(null);   // room drawn, awaiting name
  const [toast, setToast]           = useState(null);
  const [transformState, setTransformState] = useState({ scale: 1 });
  // Ref untuk scale real-time (tidak stale seperti React state)
  const transformStateRef = useRef({ scale: 1, positionX: 0, positionY: 0 });
  const canvasRef     = useRef(null);
  const canvasAreaRef = useRef(null); // ref untuk mengukur ukuran viewport canvas
  const fileRef       = useRef(null);
  const transformRef  = useRef(null);

  // Selalu kembalikan scale terkini dari ref (bukan dari state yang bisa stale)
  const getCurrentScale = useCallback(() => transformStateRef.current.scale, []);

  // Fit gambar agar pas di viewport canvas (menyesuaikan lebar gambar)
  const fitImageToView = useCallback((imgW, imgH) => {
    if (!transformRef.current || !canvasAreaRef.current) return;
    setTimeout(() => {
      const area = canvasAreaRef.current.getBoundingClientRect();
      const containerWidth = area.width || 800;
      const containerHeight = area.height || 600;
      
      // Hitung scale berdasarkan lebar container agar pas lebar gambar
      const fitScale = (containerWidth / imgW) * 0.96;
      
      // Posisi agar gambar di tengah viewport
      const posX = (containerWidth  - imgW * fitScale) / 2;
      const posY = (containerHeight - imgH * fitScale) / 2;
      transformRef.current.setTransform(posX, posY, fitScale, 300, 'easeOut');
    }, 120); // tunggu DOM selesai layout
  }, []);

  // ── helpers ──
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  // ── image upload ──
  const handleImgUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target.result;
      setBgImage(src);
      try {
        localStorage.setItem('gym_floor_plan', src);
      } catch (err) {
        console.warn('Unable to cache background image in localStorage (usually due to size constraints):', err);
      }
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth  || 1200;
        const h = img.naturalHeight || 900;
        setImgNaturalSize({ width: w, height: h });
        setScalePixels(w);
        localStorage.setItem('gym_scale_pixels', w.toString());
        showToast('Denah berhasil diunggah ✓');
        fitImageToView(w, h); // otomatis fit seluruh gambar ke viewport
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  // ── canvas coordinate dari mouse event ──
  // canvasAreaRef = div pembungkus TransformWrapper (posisinya tetap, tidak ikut transform)
  // positionX/Y dari transformStateRef = offset pan yang diterapkan library ke konten
  // Formula: canvasX = (screenX - areaLeft - posX) / scale
  const getCanvasPos = useCallback((e) => {
    if (!canvasAreaRef.current) return { x: 0, y: 0 };
    const { scale, positionX, positionY } = transformStateRef.current;
    const r = canvasAreaRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - positionX) / scale,
      y: (e.clientY - r.top  - positionY) / scale,
    };
  }, []);

  // ── drawing handlers ──
  // drawingRef menyimpan koordinat aktif (untuk closure window listener)
  // previewRef adalah DOM ref ke elemen preview — di-update langsung tanpa setDrawing
  // sehingga tidak ada React re-render saat mouse bergerak (zero-lag)
  const drawingRef = useRef(null);
  const previewRef = useRef(null);

  const onCanvasMouseDown = useCallback((e) => {
    if (tool !== 'draw') { setSelectedId(null); return; }
    e.stopPropagation();

    const { x, y } = getCanvasPos(e);
    drawingRef.current = { x0: x, y0: y, x1: x, y1: y };

    // Tampilkan preview langsung via DOM (no re-render)
    if (previewRef.current) {
      const col = ROOM_COLORS[newColorIdx % ROOM_COLORS.length];
      previewRef.current.style.display = 'block';
      previewRef.current.style.left    = x + 'px';
      previewRef.current.style.top     = y + 'px';
      previewRef.current.style.width   = '0px';
      previewRef.current.style.height  = '0px';
      previewRef.current.style.background = col.fill;
      previewRef.current.style.border     = `2px dashed ${col.border}`;
    }

    const onMove = (me) => {
      if (!drawingRef.current) return;
      const { x: cx, y: cy } = getCanvasPos(me);
      drawingRef.current.x1 = cx;
      drawingRef.current.y1 = cy;
      // Update DOM langsung, TANPA setDrawing → tidak ada re-render
      if (previewRef.current) {
        const { x0, y0 } = drawingRef.current;
        previewRef.current.style.left   = Math.min(x0, cx) + 'px';
        previewRef.current.style.top    = Math.min(y0, cy) + 'px';
        previewRef.current.style.width  = Math.abs(cx - x0) + 'px';
        previewRef.current.style.height = Math.abs(cy - y0) + 'px';
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      if (previewRef.current) previewRef.current.style.display = 'none';
      if (!drawingRef.current) return;
      const { x0, y0, x1, y1 } = drawingRef.current;
      drawingRef.current = null;
      const nx = Math.min(x0, x1), ny = Math.min(y0, y1);
      const nw = Math.abs(x1 - x0), nh = Math.abs(y1 - y0);
      if (nw < MIN_RECT_SIZE || nh < MIN_RECT_SIZE) return;
      setPendingRoom({ x: nx, y: ny, w: nw, h: nh, colorIdx: newColorIdx });
      setNewName('');
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [tool, getCanvasPos, newColorIdx]);

  // ─── drawing preview rect (elemen permanen, visibility dikontrol via previewRef) ───
  const drawingPreview = (
    <div
      ref={previewRef}
      style={{
        display: 'none',          // dikontrol langsung via DOM
        position: 'absolute',
        left: 0, top: 0, width: 0, height: 0,
        borderRadius: 6,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  );
  const confirmAddRoom = () => {
    if (!pendingRoom) return;
    const name = newName.trim() || 'Ruangan Baru';
    const room = { id: Date.now(), name, ...pendingRoom, colorIdx: newColorIdx };
    setRooms(r => [...r, room]);
    setSelectedId(room.id);
    setPendingRoom(null);
    setNewName('');
    setTool('select');
    showToast(`"${name}" ditambahkan ✓`);
  };

  const cancelAddRoom = () => {
    setPendingRoom(null);
    setNewName('');
  };

  const handleMetersChange = (val) => {
    const meters = Number(val) || 1;
    setScaleMeters(meters);
    localStorage.setItem('gym_scale_meters', meters.toString());
  };

  const handlePixelsChange = (val) => {
    const px = Number(val) || 1;
    setScalePixels(px);
    localStorage.setItem('gym_scale_pixels', px.toString());
  };

  // ── room ops ──
  const updateRoom = (id, patch) =>
    setRooms(r => r.map(x => x.id === id ? { ...x, ...patch } : x));

  const deleteRoom = (id) => {
    setRooms(r => r.filter(x => x.id !== id));
    setSelectedId(null);
    showToast('Ruangan dihapus');
  };

  const handleSaveLayout = () => {
    const savePromise = (async () => {
      // 1. Delete all existing rooms in the database
      const { error: deleteError } = await supabase
        .from('location_rooms')
        .delete()
        .neq('roomId', 0); // deletes all rows

      if (deleteError) throw deleteError;

      // 2. Insert all current rooms
      if (rooms.length > 0) {
        const payload = rooms.map(r => ({
          name: r.name,
          x: Number(r.x),
          y: Number(r.y),
          w: Number(r.w),
          h: Number(r.h),
          colorId: Number(r.colorIdx),
          facilityId: 1
        }));

        const { error: insertError } = await supabase
          .from('location_rooms')
          .insert(payload);

        if (insertError) throw insertError;
      }

      // 3. Save scale calibration to facility_profiles.images column
      const configStr = JSON.stringify({
        scaleMeters: Number(scaleMeters),
        scalePixels: Number(scalePixels)
      });

      const { error: profileError } = await supabase
        .from('facility_profiles')
        .update({ images: configStr })
        .eq('facilityId', 1);

      if (profileError) {
        console.warn('Could not save scale metadata to facility_profiles:', profileError.message);
      }
    })();

    gooeyToast.promise(savePromise, {
      loading: 'Menyimpan layout denah area...',
      success: 'Layout denah area berhasil disimpan ke database!',
      error: (err) => `Gagal Menyimpan: ${err.message}`
    });
  };

  const selectedRoom = rooms.find(r => r.id === selectedId);


  // ─── inline name dialog ───
  const nameDialog = pendingRoom && (() => {
    const col = ROOM_COLORS[newColorIdx % ROOM_COLORS.length];
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,.6)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: '#dee2e6  ', border: `1px solid ${col.border}`,
          borderRadius: 12, padding: '24px 28px', minWidth: 300,
          boxShadow: `0 0 40px ${col.border}44`,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: col.text, marginBottom: 16 }}>
            Nama Ruangan / Area
          </div>
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmAddRoom(); if (e.key === 'Escape') cancelAddRoom(); }}
            placeholder="cth. Ruang Server, Area Kerja, Lobby ..."
            style={{
              width: '100%', padding: '9px 12px',
              background: '#ffff', border: `1px solid ${col.border}66`,
              borderRadius: 7, color: '#e2f0ff', fontSize: 14,
              outline: 'none', marginBottom: 8,
            }}
          />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#4a7a9b', marginBottom: 6 }}>Warna Area</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {ROOM_COLORS.map((c, i) => (
                <div
                  key={i}
                  onClick={() => setNewColorIdx(i)}
                  style={{
                    width: 24, height: 24, borderRadius: 5,
                    background: c.border,
                    border: newColorIdx === i ? '2px solid #fff' : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: newColorIdx === i ? `0 0 6px ${c.border}` : 'none',
                    transition: 'all .15s',
                  }}
                />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={confirmAddRoom}
              style={{
                flex: 1, padding: '9px', borderRadius: 7,
                background: col.border, border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 13,
                cursor: 'pointer',
              }}
            >Tambahkan</button>
            <button
              onClick={cancelAddRoom}
              style={{
                padding: '9px 16px', borderRadius: 7,
                background: 'transparent', border: '1px solid #1e3a5f',
                color: '#7aa8cc', fontSize: 13, cursor: 'pointer',
              }}
            >Batal</button>
          </div>
        </div>
      </div>
    );
  })();

  // ─── styles ───
  const S = {
    layout: {
      display: 'flex', height: 600, gap: 0,
      border: '1px solid #dee2e6', borderRadius: 10, overflow: 'hidden',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      background: '#f5f7fb',
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    },
    sidebar: {
      width: 260, flexShrink: 0,
      background: '#ffffff',
      borderRight: '1px solid #dee2e6',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    },
    sideSection: { padding: '14px 14px 10px', borderBottom: '1px solid #f0f0f0' },
    sideTitle: { fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', color: '#aaa', marginBottom: 10 },
    canvasArea: { flex: 1, position: 'relative', overflow: 'hidden', background: '#f5f7fb' },
    toolBtn: (active) => ({
      flex: 1, padding: '8px 6px', borderRadius: 6,
      border: active ? '1px solid #6366f1' : '1px solid #dee2e6',
      background: active ? 'rgba(99, 102, 241, 0.1)' : '#f8f9fa',
      color: active ? '#6366f1' : '#555',
      fontSize: 12, cursor: 'pointer', textAlign: 'center',
      fontWeight: active ? 600 : 400,
      transition: 'all .15s',
    }),
    uploadZone: {
      border: '2px dashed #6366f1', borderRadius: 8,
      padding: '18px 10px', textAlign: 'center',
      cursor: 'pointer', background: 'rgba(99, 102, 241, 0.03)',
      transition: 'border .2s',
    },
    roomItem: (sel, col) => ({
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', borderRadius: 6, marginBottom: 5,
      border: sel ? `1px solid ${col.border}` : '1px solid #f0f0f0',
      background: sel ? `${col.fill}` : '#f8f9fa',
      cursor: 'pointer', transition: 'all .15s',
    }),
    badge: (col) => ({
      width: 12, height: 12, borderRadius: 3,
      background: col.border, flexShrink: 0,
    }),
  };

  return (
    <div>
      {/* ─ Header hint ─ */}
      <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 8, fontSize: 12, color: '#555' }}>
        <strong style={{ color: '#6366f1' }}>Editor Denah Area</strong>
        {' '}— Upload gambar denah, pilih tool <em>Gambar</em>, lalu klik &amp; seret untuk menambah area/ruangan.
      </div>

      <div style={S.layout}>
        {/* ══ SIDEBAR ══ */}
        <div style={S.sidebar}>

          {/* Upload */}
          <div style={S.sideSection}>
            <div style={S.sideTitle}>Denah Lantai</div>
            <div
              style={S.uploadZone}
              onClick={() => fileRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { fileRef.current.files = e.dataTransfer.files; handleImgUpload({ target: { files: [f] } }); } }}
            >
              <div style={{ fontSize: 26, marginBottom: 6 }}>🗺️</div>
              <div style={{ fontSize: 12, color: '#6366f1' }}>{bgImage ? 'Klik / drag untuk ganti denah' : 'Upload gambar denah'}</div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>PNG · WEBP · JPG</div>
            </div>
            <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }} onChange={handleImgUpload} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <label style={{ fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={showGrid}
                  onChange={() => setShowGrid(v => !v)}
                  style={{ accentColor: '#6366f1' }}
                />
                Tampilkan Grid
              </label>
            </div>
          </div>

          {/* Skala Kalibrasi */}
          <div style={S.sideSection}>
            <div style={S.sideTitle}>Skala Kalibrasi (m : px)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>Fisik (meter)</div>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 6, padding: '2px 8px' }}>
                    <input
                      type="number"
                      value={scaleMeters}
                      onChange={e => handleMetersChange(e.target.value)}
                      style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#333', padding: '4px 0' }}
                      min="1"
                    />
                    <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>m</span>
                  </div>
                </div>
                <div style={{ fontSize: 16, color: '#ccc', alignSelf: 'flex-end', marginBottom: 6 }}>:</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>Kanvas (pixel)</div>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: 6, padding: '2px 8px' }}>
                    <input
                      type="number"
                      value={scalePixels}
                      onChange={e => handlePixelsChange(e.target.value)}
                      style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: '#333', padding: '4px 0' }}
                      min="100"
                    />
                    <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>px</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>
                * Lebar kanvas diatur ke <strong>{scalePixels}px</strong>. Skala: <strong>1m = {scaleMeters > 0 ? Math.round(scalePixels / scaleMeters) : 0}px</strong>.
              </div>
            </div>
          </div>

          {/* Tools */}
          <div style={S.sideSection}>
            <div style={S.sideTitle}>Tool</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={S.toolBtn(tool === 'select')} onClick={() => setTool('select')}>✦ Pilih</button>
              <button style={S.toolBtn(tool === 'draw')}   onClick={() => setTool('draw')}>⬜ Gambar</button>
            </div>
            {tool === 'draw' && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
                  Klik &amp; seret di atas denah untuk menggambar rectangle ruangan.
                </div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 5 }}>Warna default</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ROOM_COLORS.map((c, i) => (
                    <div
                      key={i} onClick={() => setNewColorIdx(i)}
                      style={{
                        width: 20, height: 20, borderRadius: 4,
                        background: c.border, cursor: 'pointer',
                        border: newColorIdx === i ? '2px solid #6366f1' : '2px solid transparent',
                        transition: 'all .15s',
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Room list */}
          <div style={{ ...S.sideSection, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <div style={S.sideTitle}>Daftar Ruangan</div>
              <span style={{ fontSize: 10, background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', borderRadius: 3, padding: '1px 6px', marginBottom: 10 }}>
                {rooms.length}
              </span>
            </div>
            {rooms.length === 0 && (
              <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', padding: '16px 0' }}>
                Belum ada ruangan.<br />Gunakan tool Gambar.
              </div>
            )}
            {rooms.map(r => {
              const col = ROOM_COLORS[r.colorIdx % ROOM_COLORS.length];
              const sel = selectedId === r.id;
              return (
                <div
                  key={r.id}
                  style={S.roomItem(sel, col)}
                  onClick={() => { setSelectedId(sel ? null : r.id); setTool('select'); }}
                >
                  <div style={S.badge(col)} />
                  <div style={{ flex: 1, fontSize: 13, color: '#333' }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: '#aaa', fontFamily: 'monospace' }}>
                    {Math.round(r.w)}×{Math.round(r.h)}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteRoom(r.id); }}
                    style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
                  >×</button>
                </div>
              );
            })}
          </div>

          {/* Selected room info */}
          {selectedRoom && (
            <div style={{ ...S.sideSection, background: '#f8f9fa' }}>
              <div style={S.sideTitle}>Properti Ruangan</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>Nama</div>
                <input
                  value={selectedRoom.name}
                  onChange={e => updateRoom(selectedRoom.id, { name: e.target.value })}
                  style={{
                    width: '100%', padding: '7px 10px',
                    background: '#fff', border: '1px solid #dee2e6',
                    borderRadius: 6, color: '#333', fontSize: 13, outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                {['x', 'y', 'w', 'h'].map(field => (
                  <div key={field}>
                    <div style={{ fontSize: 10, color: '#aaa', marginBottom: 3, textTransform: 'uppercase' }}>{field === 'w' ? 'Lebar' : field === 'h' ? 'Tinggi' : field.toUpperCase()}</div>
                    <input
                      type="number"
                      value={Math.round(selectedRoom[field])}
                      onChange={e => updateRoom(selectedRoom.id, { [field]: +e.target.value })}
                      style={{
                        width: '100%', padding: '5px 8px',
                        background: '#fff', border: '1px solid #dee2e6',
                        borderRadius: 5, color: '#333', fontSize: 12,
                        outline: 'none', fontFamily: 'monospace',
                      }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>Warna</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ROOM_COLORS.map((c, i) => (
                  <div
                    key={i}
                    onClick={() => updateRoom(selectedRoom.id, { colorIdx: i })}
                    style={{
                      width: 22, height: 22, borderRadius: 4,
                      background: c.border, cursor: 'pointer',
                      border: selectedRoom.colorIdx === i ? '2px solid #fff' : '2px solid transparent',
                      transition: 'all .15s',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Bottom actions */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8 }}>
            <button
              onClick={handleSaveLayout}
              style={{
                flex: 1, padding: '9px', borderRadius: 7,
                background: '#6366f1', border: 'none',
                color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >Simpan</button>
            <button
              onClick={() => fitImageToView(canvasSize.width, canvasSize.height)}
              style={{
                padding: '9px 12px', borderRadius: 7,
                background: 'transparent', border: '1px solid #dee2e6',
                color: '#666', fontSize: 12, cursor: 'pointer',
              }}
              title="Fit/Reset zoom"
            >⊞ Fit</button>
          </div>
        </div>

        {/* ══ CANVAS AREA ══ */}
        <div ref={canvasAreaRef} style={S.canvasArea}>
          {/* Toolbar hint overlay */}
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 100,
            background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(4px)',
            border: '1px solid #dee2e6', borderRadius: 7,
            padding: '6px 12px', fontSize: 11, color: '#666',
            pointerEvents: 'none',
            boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
          }}>
            {tool === 'draw'
              ? '⬜ Klik & seret untuk menggambar ruangan • ESC untuk batal'
              : '✦ Scroll untuk zoom · Drag canvas untuk pan · Klik ruangan untuk pilih'}
          </div>

          <TransformWrapper
            ref={transformRef}
            initialScale={0.7}
            minScale={0.1}
            maxScale={4}
            wheel={{ step: 0.001, smoothStep: 0.001 }}
            panning={{
              excluded: ['room-rect', '[data-handle]'],
              disabled: tool === 'draw',
            }}
            onTransformed={(_, state) => {
              // Update ref dulu (sinkron/real-time) lalu update state untuk re-render
              transformStateRef.current = {
                scale: state.scale,
                positionX: state.positionX,
                positionY: state.positionY,
              };
              setTransformState({ scale: state.scale });
            }}
          >
            {({ zoomIn, zoomOut }) => (
              <>
                {/* Zoom controls */}
                <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 100, display: 'flex', gap: 4 }}>
                  {[['＋', () => zoomIn()], ['－', () => zoomOut()]].map(([label, fn]) => (
                    <button key={label} onClick={fn} style={{
                      width: 32, height: 32, borderRadius: 6,
                      background: '#fff', border: '1px solid #dee2e6',
                      color: '#6366f1', fontSize: 16, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    }}>{label}</button>
                  ))}
                </div>

                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '100%' }}
                  contentStyle={{ cursor: tool === 'draw' ? 'crosshair' : 'grab' }}
                >
                  {/* Canvas — hanya butuh onMouseDown; move & up sudah dihandle window */}
                  <div
                    ref={canvasRef}
                    onMouseDown={onCanvasMouseDown}
                    style={{
                      width: canvasSize.width,
                      height: canvasSize.height,
                      position: 'relative',
                      background: showGrid
                        ? 'linear-gradient(rgba(99, 102, 241, 0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(99, 102, 241, 0.08) 1px,transparent 1px)'
                        : '#f5f7fb',
                      backgroundSize: showGrid ? '50px 50px' : undefined,
                      backgroundColor: '#f5f7fb',
                      userSelect: 'none',
                    }}
                  >
                    {/* Background image */}
                    {bgImage && (
                      <img
                        src={bgImage}
                        alt="Denah"
                        style={{
                          position: 'absolute', inset: 0,
                          width: '100%', height: '100%',
                          objectFit: 'cover', opacity: .55,
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {/* Empty state */}
                    {!bgImage && rooms.length === 0 && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        color: '#ccc', pointerEvents: 'none',
                      }}>
                        <div style={{ fontSize: 48, marginBottom: 12, opacity: .4 }}>🗺️</div>
                        <div style={{ fontSize: 14, color: '#bbb' }}>Upload denah atau mulai menggambar ruangan</div>
                      </div>
                    )}

                    {/* Room rectangles */}
                    {rooms.map(r => (
                      <RoomRect
                        key={r.id}
                        room={r}
                        selected={selectedId === r.id}
                        onSelect={setSelectedId}
                        onDelete={deleteRoom}
                        onUpdate={updateRoom}
                        getScale={getCurrentScale}
                      />
                    ))}

                    {/* Drawing preview */}
                    {drawingPreview}
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>
      </div>

      {/* Name dialog */}
      {nameDialog}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#6366f1', border: 'none',
          color: '#fff', borderRadius: 8, padding: '10px 22px',
          fontSize: 13, zIndex: 300,
          boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
          animation: 'toastIn .3s ease',
        }}>
          {toast}
          <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
        </div>
      )}
    </div>
  );
};

export default GymLayoutManager;