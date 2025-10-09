'use client';

import { useState, useEffect, useRef } from 'react';

export default function DocumentSignaturePage() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [documentData, setDocumentData] = useState<any>(null);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [signature, setSignature] = useState<string>('');
  const [typedSignature, setTypedSignature] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Check for demo user data
    const token = localStorage.getItem('auth_token');
    const userData = localStorage.getItem('user_data');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }

    // Load demo settlement document
    loadSettlementDocument();
    setIsLoading(false);
  }, []);

  const loadSettlementDocument = () => {
    const demoDocument = {
      caseId: 'ADR-2024-001',
      caseTitle: 'Property Boundary Dispute',
      documentType: 'Settlement Agreement',
      generatedAt: '2024-10-16 05:45 PM',
      agreementId: 'SA-2024-001-001',
      selectedOption: 'Joint Survey & Boundary Correction',
      parties: {
        plaintiff: {
          name: 'Demo User',
          email: 'demo@aidispute.com',
          address: '123 Plaintiff Street, Demo City - 110001',
          phone: '+91 9876543210'
        },
        defendant: {
          name: 'John Smith',
          email: 'john.smith@example.com',
          address: '456 Defendant Avenue, Demo City - 110002',
          phone: '+91 9876543211'
        }
      },
      settlementTerms: [
        'Joint government survey to be commissioned within 15 days of signing this agreement',
        'Survey costs of ₹25,000 shall be borne entirely by the Defendant (John Smith)',
        'If survey confirms encroachment as claimed by Plaintiff, Defendant shall remove the encroaching structure within 30 days of survey report',
        'Upon confirmation of encroachment, Defendant shall pay ₹1,50,000 as compensation to Plaintiff for loss of use and inconvenience',
        'Payment shall be made through NEFT/RTGS within 7 days of structure removal',
        'Both parties shall bear their own legal costs incurred in this dispute',
        'This agreement constitutes full and final settlement of all claims related to the boundary dispute',
        'Both parties agree not to pursue any further legal action regarding this matter',
        'Any violation of this agreement shall attract penalty of ₹50,000 plus legal costs',
        'This agreement is binding on heirs, successors, and assigns of both parties'
      ],
      legalBasis: {
        applicableLaws: [
          'Section 89 of Code of Civil Procedure, 1908',
          'Indian Contract Act, 1872 - Section 10 (Valid Contracts)',
          'Registration Act, 1908 - For survey verification',
          'Indian Easements Act, 1882 - Property rights'
        ],
        jurisdiction: 'District Court, Demo City',
        governingLaw: 'Laws of India'
      },
      timeline: {
        surveyDeadline: '2024-10-31',
        removalDeadline: '2024-11-30 (if encroachment confirmed)',
        paymentDeadline: '2024-12-07 (if encroachment confirmed)'
      },
      signatures: {
        plaintiff: {
          required: true,
          completed: false,
          signedAt: null,
          ipAddress: null
        },
        defendant: {
          required: true,
          completed: false,
          signedAt: null,
          ipAddress: null
        },
        witness: {
          required: true,
          completed: false,
          name: 'AI Dispute Resolver System',
          signedAt: null
        }
      },
      documentHash: 'SHA256:a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
      downloadUrl: '/documents/settlement_ADR-2024-001_agreement.pdf'
    };

    setDocumentData(demoDocument);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    window.location.href = '/';
  };

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to base64
    const signatureData = canvas.toDataURL();
    setSignature(signatureData);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature('');
    setTypedSignature('');
  };

  const generateTypedSignature = () => {
    if (!typedSignature.trim()) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw typed signature
    ctx.font = '32px Dancing Script, cursive';
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'center';
    ctx.fillText(typedSignature, canvas.width / 2, canvas.height / 2 + 10);

    // Convert to base64
    const signatureData = canvas.toDataURL();
    setSignature(signatureData);
  };

  const handleSignDocument = async () => {
    if (!signature && signatureMode !== 'type') {
      alert('Please provide your signature before signing the document.');
      return;
    }

    if (signatureMode === 'type' && !typedSignature.trim()) {
      alert('Please type your name for the signature.');
      return;
    }

    setIsSigning(true);

    // Simulate signing process
    setTimeout(() => {
      const now = new Date().toISOString();
      const mockIpAddress = '192.168.1.100';
      
      setDocumentData((prev: any) => ({
        ...prev,
        signatures: {
          ...prev.signatures,
          plaintiff: {
            ...prev.signatures.plaintiff,
            completed: true,
            signedAt: now,
            ipAddress: mockIpAddress,
            signatureData: signature || `Typed: ${typedSignature}`
          }
        }
      }));

      alert('Document signed successfully! The defendant will now be notified to provide their signature. Once all signatures are collected, the settlement agreement will be legally binding and sent to all parties.');
      setIsSigning(false);
    }, 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settlement document...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">Please log in to sign documents.</p>
          <a 
            href="/auth/login" 
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global Navbar is provided by layout; page-specific nav removed to avoid duplication */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settlement Agreement Signature</h1>
          <p className="text-gray-600 mt-2">
            Review the settlement agreement and provide your digital signature to make it legally binding.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Document Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Settlement Agreement</h2>
                    <p className="text-sm text-gray-600">
                      Generated: {documentData?.generatedAt} | ID: {documentData?.agreementId}
                    </p>
                  </div>
                  <button
                    onClick={() => alert('In the real system, this would download the PDF document')}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              <div className="p-6 max-h-96 overflow-y-auto">
                <div className="prose max-w-none">
                  <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">SETTLEMENT AGREEMENT</h1>
                    <p className="text-gray-600">
                      Case: {documentData?.caseTitle} ({documentData?.caseId})
                    </p>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">PARTIES</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-900">PLAINTIFF</h4>
                        <p className="text-blue-800">{documentData?.parties.plaintiff.name}</p>
                        <p className="text-blue-700 text-sm">{documentData?.parties.plaintiff.email}</p>
                        <p className="text-blue-700 text-sm">{documentData?.parties.plaintiff.address}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium text-gray-900">DEFENDANT</h4>
                        <p className="text-gray-800">{documentData?.parties.defendant.name}</p>
                        <p className="text-gray-700 text-sm">{documentData?.parties.defendant.email}</p>
                        <p className="text-gray-700 text-sm">{documentData?.parties.defendant.address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">SELECTED SETTLEMENT OPTION</h3>
                    <p className="text-gray-700 font-medium">{documentData?.selectedOption}</p>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">TERMS AND CONDITIONS</h3>
                    <ol className="space-y-2">
                      {documentData?.settlementTerms.map((term: string, index: number) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="font-medium text-gray-600 mt-1">{index + 1}.</span>
                          <span className="text-gray-700">{term}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">TIMELINE</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-yellow-50 rounded-lg">
                        <div className="font-medium text-yellow-900">Survey Deadline</div>
                        <div className="text-yellow-800">{documentData?.timeline.surveyDeadline}</div>
                      </div>
                      <div className="p-3 bg-orange-50 rounded-lg">
                        <div className="font-medium text-orange-900">Removal Deadline</div>
                        <div className="text-orange-800">{documentData?.timeline.removalDeadline}</div>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="font-medium text-green-900">Payment Deadline</div>
                        <div className="text-green-800">{documentData?.timeline.paymentDeadline}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">LEGAL BASIS</h3>
                    <div className="text-sm text-gray-700">
                      <p className="mb-2"><span className="font-medium">Applicable Laws:</span></p>
                      <ul className="space-y-1 ml-4">
                        {documentData?.legalBasis.applicableLaws.map((law: string, index: number) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-gray-500 mt-1">•</span>
                            <span>{law}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3">
                        <span className="font-medium">Jurisdiction:</span> {documentData?.legalBasis.jurisdiction}
                      </p>
                      <p>
                        <span className="font-medium">Governing Law:</span> {documentData?.legalBasis.governingLaw}
                      </p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">DOCUMENT INTEGRITY</h3>
                    <div className="p-4 bg-gray-50 rounded-lg text-sm">
                      <p><span className="font-medium">Document Hash:</span> <code className="text-xs bg-gray-200 px-2 py-1 rounded">{documentData?.documentHash}</code></p>
                      <p className="mt-2 text-gray-600">This hash ensures the document integrity and prevents tampering.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Signature Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Digital Signature</h2>
                <p className="text-sm text-gray-600 mt-1">Provide your signature to sign the agreement</p>
              </div>

              <div className="p-6">
                {/* Signature Mode Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Signature Method</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="draw"
                        checked={signatureMode === 'draw'}
                        onChange={(e) => setSignatureMode(e.target.value as 'draw')}
                        className="mr-2"
                      />
                      <span className="text-sm">Draw Signature</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="type"
                        checked={signatureMode === 'type'}
                        onChange={(e) => setSignatureMode(e.target.value as 'type')}
                        className="mr-2"
                      />
                      <span className="text-sm">Type Signature</span>
                    </label>
                  </div>
                </div>

                {/* Drawing Canvas */}
                {signatureMode === 'draw' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Draw Your Signature
                    </label>
                    <div className="border border-gray-300 rounded-lg">
                      <canvas
                        ref={canvasRef}
                        width={300}
                        height={150}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        className="w-full h-32 cursor-crosshair bg-white rounded-lg"
                        style={{ touchAction: 'none' }}
                      />
                    </div>
                    <button
                      onClick={clearSignature}
                      className="mt-2 px-3 py-1 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Typed Signature */}
                {signatureMode === 'type' && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type Your Full Name
                    </label>
                    <input
                      type="text"
                      value={typedSignature}
                      onChange={(e) => setTypedSignature(e.target.value)}
                      onBlur={generateTypedSignature}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                    <canvas
                      ref={canvasRef}
                      width={300}
                      height={150}
                      className="w-full h-20 mt-2 border border-gray-200 rounded bg-gray-50"
                    />
                  </div>
                )}

                {/* Signature Status */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Signature Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Your Signature:</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        documentData?.signatures.plaintiff.completed 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {documentData?.signatures.plaintiff.completed ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Defendant Signature:</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                        Pending
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>System Witness:</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs font-medium">
                        Auto-signed
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sign Button */}
                {!documentData?.signatures.plaintiff.completed && (
                  <button
                    onClick={handleSignDocument}
                    disabled={isSigning || (!signature && !typedSignature)}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isSigning ? 'Signing Document...' : 'Sign Agreement'}
                  </button>
                )}

                {documentData?.signatures.plaintiff.completed && (
                  <div className="text-center">
                    <div className="text-green-600 text-2xl mb-2">✓</div>
                    <div className="text-green-800 font-medium">Document Signed Successfully</div>
                    <div className="text-green-700 text-sm mt-1">
                      Signed at: {new Date(documentData.signatures.plaintiff.signedAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Legal Notice */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-6">
              <div className="flex items-start space-x-2">
                <div className="text-yellow-600 text-lg">⚖️</div>
                <div>
                  <h4 className="font-medium text-yellow-900 mb-1">Legal Notice</h4>
                  <p className="text-yellow-800 text-sm">
                    By signing this document, you agree to be legally bound by all terms and conditions. 
                    This digital signature has the same legal validity as a handwritten signature under the 
                    Information Technology Act, 2000.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Information */}
        <div className="mt-8 p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="text-indigo-600 text-xl">📝</div>
            <div>
              <h3 className="font-semibold text-indigo-800 mb-2">Document Generation & Digital Signature Demo</h3>
              <p className="text-indigo-700 text-sm">
                This demonstrates the complete document generation and digital signature workflow. The settlement agreement 
                is automatically generated from the chosen settlement option with all legal terms, timelines, and party details. 
                Digital signatures are collected from all parties with IP address logging and timestamp verification. 
                Once all signatures are collected, the final document is distributed to all parties and their lawyers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}