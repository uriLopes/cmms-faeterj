import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      console.log('[Socket PWA] Conectado ao servidor:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket PWA] Desconectado. Tentando reconexão...');
    });
  }
  return socket;
}
