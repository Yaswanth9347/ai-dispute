"use client";

import React, { useEffect, useState } from 'react';
import getSocket from '@/lib/socket';
import { Badge } from '@/components/ui/badge';
import { Activity, WifiOff } from 'lucide-react';

export default function SocketStatus() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') || undefined : undefined;
    const socket = getSocket(token || undefined);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onDisconnect);

    setConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onDisconnect);
    };
  }, []);

  return (
    <Badge variant="outline" className={connected ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
      {connected ? (
        <span className="flex items-center gap-2"> <Activity className="h-4 w-4" /> Real-time: Active</span>
      ) : (
        <span className="flex items-center gap-2"> <WifiOff className="h-4 w-4" /> Real-time: Disconnected</span>
      )}
    </Badge>
  );
}
