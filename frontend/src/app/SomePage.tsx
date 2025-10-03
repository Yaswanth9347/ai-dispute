// frontend/src/app/SomePage.tsx
"use client";
import EvidenceStatus from "./EvidenceStatus";

export default function SomePage() {
  const evidenceId = "c17f9dfb-ab3a-4115-a121-8388a76f80b4"; // replace with your id
  return (
    <div>
      <h1>Some Page</h1>
      <EvidenceStatus evidenceId={evidenceId} />
    </div>
  );
}
