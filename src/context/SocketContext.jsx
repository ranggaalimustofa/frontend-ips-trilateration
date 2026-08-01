import React, { createContext, useContext, useEffect, useState } from 'react';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // In production, connect to backend server endpoint from .env or config
    // const socketConnection = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    // setSocket(socketConnection);
    
    return () => {
      // socketConnection.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocketContext = () => useContext(SocketContext);
