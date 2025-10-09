'use client';

import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import getSocket from '@/lib/socket';

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
  caseId?: string | null;
  onUpdate?: (data: NegotiationUpdate) => void;
}

export function useNegotiationSocket({ negotiationId, caseId, onUpdate }: UseNegotiationSocketProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<NegotiationUpdate | null>(null);

  useEffect(() => {
    if (!negotiationId) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    const socketInstance = getSocket(token);

    socketInstance.on('connect', () => {
      console.log('✅ Socket connected');
      setIsConnected(true);
      // join negotiation-specific room (backwards compatibility)
      try { socketInstance.emit('join-negotiation', negotiationId); } catch (e) {}
      // if a caseId is provided use the canonical case room join
      // (some parts of the app use case rooms: `case-{caseId}`)
      // Accept either prop names for compatibility with different code paths
      try {
        const joinId = caseId || (negotiationId as unknown as string);
        if (joinId) {
          socketInstance.emit('join-case', { case_id: joinId });
        }
      } catch (e) {}
    });

    socketInstance.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setIsConnected(false);
    });

    // Support both colon-separated and hyphen-separated event names for compatibility
    const handleUpdate = (data: NegotiationUpdate) => {
      console.log('📨 Negotiation update:', data);
      setLastUpdate(data);
      onUpdate?.(data);
    };

    const handleProposal = (data: NegotiationUpdate) => {
      console.log('💰 New proposal:', data);
      setLastUpdate(data);
      onUpdate?.(data);
    };

    const handleAccepted = (data: NegotiationUpdate) => {
      console.log('✅ Proposal accepted:', data);
      setLastUpdate(data);
      onUpdate?.(data);
    };

    const handleRejected = (data: NegotiationUpdate) => {
      console.log('❌ Proposal rejected:', data);
      setLastUpdate(data);
      onUpdate?.(data);
    };

    const handleTimeout = (data: NegotiationUpdate) => {
      console.log('⏰ Negotiation timeout:', data);
      setLastUpdate(data);
      onUpdate?.(data);
    };

    // colon-style
    socketInstance.on('negotiation:update', handleUpdate);
    socketInstance.on('negotiation:proposal', handleProposal);
    socketInstance.on('negotiation:accepted', handleAccepted);
    socketInstance.on('negotiation:rejected', handleRejected);
    socketInstance.on('negotiation:timeout', handleTimeout);
    // hyphen-style (backend compatibility)
    socketInstance.on('negotiation-update', handleUpdate);
    socketInstance.on('negotiation-proposal', handleProposal);
    socketInstance.on('negotiation-accepted', handleAccepted);
    socketInstance.on('negotiation-rejected', handleRejected);
    socketInstance.on('negotiation-timeout', handleTimeout);
    // backend also emits negotiation-new-round for new rounds
    socketInstance.on('negotiation-new-round', (data: any) => {
      console.log('🔄 Negotiation new round:', data);
      // forward as an update as well
      handleUpdate(data as NegotiationUpdate);
    });

    setSocket(socketInstance as Socket);

    return () => {
  try { socketInstance.emit('leave-negotiation', negotiationId); } catch (e) {}
  try { socketInstance.emit('leave-case', { case_id: caseId || negotiationId }); } catch (e) {}

      // remove listeners we attached
      socketInstance.off('negotiation:update', handleUpdate);
      socketInstance.off('negotiation:proposal', handleProposal);
      socketInstance.off('negotiation:accepted', handleAccepted);
      socketInstance.off('negotiation:rejected', handleRejected);
      socketInstance.off('negotiation:timeout', handleTimeout);
      socketInstance.off('negotiation-update', handleUpdate);
      socketInstance.off('negotiation-proposal', handleProposal);
      socketInstance.off('negotiation-accepted', handleAccepted);
      socketInstance.off('negotiation-rejected', handleRejected);
      socketInstance.off('negotiation-timeout', handleTimeout);
      socketInstance.off('negotiation-new-round');
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
