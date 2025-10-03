// filepath: frontend/src/app/EvidenceStatus.tsx
"use client";
import { useEffect, useState } from "react";
import { getEvidenceStatus } from "@/lib/api";

export default function EvidenceStatus({ evidenceId }: { evidenceId: string }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const s = await getEvidenceStatus(evidenceId);
        if (!cancelled) {
          setStatus(s.status || s);
          if (s.processed) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Error fetching status", err);
      }
    }

    poll();
    const timer = setInterval(poll, 2000); // poll every 2s

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [evidenceId]);

  if (loading) return <p>Processing evidence...</p>;
  if (!status) return <p>Processing failed or timeout.</p>;

  return (
    <div>
      <h2>Evidence Status</h2>
      <pre>{JSON.stringify(status, null, 2)}</pre>
    </div>
  );
}
