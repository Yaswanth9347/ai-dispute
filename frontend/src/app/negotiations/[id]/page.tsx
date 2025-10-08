'use client';

import { useParams } from 'next/navigation';
import NegotiationRoom from '@/components/settlement/NegotiationRoom';

export default function NegotiationPage() {
  const params = useParams();
  const negotiationId = params?.id as string;

  // Mock data - replace with actual API call
  const parties = [
    { id: '1', name: 'John Doe', role: 'plaintiff' },
    { id: '2', name: 'Jane Smith', role: 'defendant' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <NegotiationRoom
        negotiationId={negotiationId}
        caseId="case-123"
        parties={parties}
      />
    </div>
  );
}
