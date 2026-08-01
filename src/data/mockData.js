export const members = [
    { id: 'M001', name: 'John Doe', email: 'john.doe@example.com', status: 'Aktif', joinDate: '2023-01-01' },
    { id: 'M002', name: 'Alice Smith', email: 'alice.smith@example.com', status: 'Aktif', joinDate: '2023-01-15' },
    { id: 'M003', name: 'Bob Johnson', email: 'bob.johnson@example.com', status: 'Aktif', joinDate: '2023-02-05' },
    { id: 'M004', name: 'Emma Wilson', email: 'emma.wilson@example.com', status: 'Tidak Aktif', joinDate: '2023-02-20' },
    { id: 'M005', name: 'Michael Jones', email: 'michael.jones@example.com', status: 'Aktif', joinDate: '2023-03-10' },
    { id: 'M006', name: 'Sarah Brown', email: 'sarah.brown@example.com', status: 'Aktif', joinDate: '2023-03-25' },
    { id: 'M007', name: 'David Davis', email: 'david.davis@example.com', status: 'Tidak Aktif', joinDate: '2023-04-05' },
    { id: 'M008', name: 'Lisa Miller', email: 'lisa.miller@example.com', status: 'Aktif', joinDate: '2023-04-20' }
];

export const presenceData = [
    { memberId: 'M001', name: 'John Doe', checkIn: '08:30', checkOut: '10:15', duration: '1j 45m', area: 'Area Kardio' },
    { memberId: 'M002', name: 'Alice Smith', checkIn: '09:00', checkOut: '11:30', duration: '2j 30m', area: 'Area Beban' },
    { memberId: 'M003', name: 'Bob Johnson', checkIn: '07:45', checkOut: '-', duration: '-', area: 'Area Kelas' },
    { memberId: 'M005', name: 'Michael Jones', checkIn: '06:30', checkOut: '08:00', duration: '1j 30m', area: 'Area Kardio' },
    { memberId: 'M006', name: 'Sarah Brown', checkIn: '18:00', checkOut: '-', duration: '-', area: 'Kolam Renang' },
    { memberId: 'M008', name: 'Lisa Miller', checkIn: '17:30', checkOut: '19:00', duration: '1j 30m', area: 'Area Beban' }
];

export const positionData = [
    { id: 'M001', name: 'John Doe', initials: 'JD', status: 'Aktif', area: 'cardio', x: 120, y: 95 },
    { id: 'M002', name: 'Alice Smith', initials: 'AS', status: 'Aktif', area: 'weights', x: 620, y: 95 },
    { id: 'M003', name: 'Bob Johnson', initials: 'BJ', status: 'Aktif', area: 'classroom', x: 120, y: 380 },
    { id: 'M005', name: 'Michael Jones', initials: 'MJ', status: 'Aktif', area: 'pool', x: 620, y: 380 },
    { id: 'M006', name: 'Sarah Brown', initials: 'SB', status: 'Aktif', area: 'cardio', x: 180, y: 120 },
    { id: 'M008', name: 'Lisa Miller', initials: 'LM', status: 'Aktif', area: 'weights', x: 680, y: 120 }
];
