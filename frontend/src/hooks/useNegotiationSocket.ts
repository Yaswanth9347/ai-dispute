'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

interface NegotiationUpdate {
  negotiationId: string;
  proposalId?: string;
  status: string;
  amount?: number;
  message?: string;
  userId?: string;
  timestamp: string;
}

interface UseNegotiationSocketProps {
  negotiationId: string | null;
  onUpdate?: (data: NegotiationUpdate) => void;
}

export function useNegotiationSocket({ negotiationId, onUpdate }: UseNegotiationSocketProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<NegotiationUpdate | null>(null);

  useEffect(() => {
    if (!negotiationId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const socketInstance = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketInstance.on('connect', () => {
      console.log('✅ Socket connected');
      setIsConnected(true);
      socketInstance.emit('join:negotiation', negotiationId);
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('negotiation:update', (data: NegotiationUpdate) => {
      console.log('📨 Negotiation update:', data);
      setLastUpdate(data);
      onUpdate?.(data);
    });

    socketInstance.on('negotiation:proposal', (data: NegotiationUpdate) => {
      console.log('💰 New proposal:', data);
      setLastUpdate(data);
      onUpdate?.(data);
    });

    socketInstance.on('negotiation:accepted', (data: NegotiationUpdate) => {
      console.log('✅ Proposal accepted:', data);
      setLastUpdate(data);
      onUpdate?.(data);
    });

    socketInstance.on('negotiation:rejected', (data: NegotiationUpdate) => {
      console.log('❌ Proposal rejected:', data);
      setLastUpdate(data);
      onUpdate?.(data);
    });

    socketInstance.on('negotiation:timeout', (data: NegotiationUpdate) => {
      console.log('⏰ Negotiation timeout:', data);
      setLastUpdate(data);
      onUpdate?.(data);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.emit('leave:negotiation', negotiationId);
      socketInstance.disconnect();
    };
  }, [negotiationId, onUpdate]);

  const sendProposal = useCallback((amount: number, message?: string) => {
    if (socket && isConnected) {
      socket.emit('negotiation:propose', {
        negotiationId,
        amount,
        message,
      });
    }
  }, [socket, isConnected, negotiationId]);

  const acceptProposal = useCallback((proposalId: string) => {
    if (socket && isConnected) {
      socket.emit('negotiation:accept', {
        negotiationId,
        proposalId,
      });
    }
  }, [socket, isConnected, negotiationId]);

  const rejectProposal = useCallback((proposalId: string, reason?: string) => {
    if (socket && isConnected) {
      socket.emit('negotiation:reject', {
        negotiationId,
        proposalId,
        reason,
      });
    }
  }, [socket, isConnected, negotiationId]);

  return {
    isConnected,
    lastUpdate,
    sendProposal,
    acceptProposal,
    rejectProposal,
  };
}
