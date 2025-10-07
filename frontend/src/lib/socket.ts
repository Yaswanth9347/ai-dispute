"use client";

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SERVER_URL = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/?$/, '')
  : 'http://localhost:8080';

export function getSocket(token?: string) {
  if (socket) return socket;

  socket = io(SERVER_URL, {
    autoConnect: true,
    auth: token ? { token } : undefined,
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    // no-op here; consumers listen to events they care about
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connect error', err);
  });

  return socket;
}

export function closeSocket() {
  if (!socket) return;
  try {
    socket.disconnect();
  } catch (e) {
    // swallow
  }
  socket = null;
}

export default getSocket;
