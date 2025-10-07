'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { FinalDecision } from '@/types';

interface DigitalSignatureProps {
  finalDecision: FinalDecision;
  onSign: (signatureData: string) => void;
  currentUserId: string;
  isLoading?: boolean;
}

export function DigitalSignature({ 
  finalDecision, 
  onSign, 
  currentUserId, 
  isLoading = false 
}: DigitalSignatureProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });

  const hasUserSigned = finalDecision.signatures.some(sig => sig.userId === currentUserId);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hasUserSigned) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setLastPosition({ x, y });
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || hasUserSigned) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(lastPosition.x, lastPosition.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    setLastPosition({ x, y });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (hasUserSigned) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData = canvas.toDataURL('image/png');
    onSign(signatureData);
  };

  const isCanvasEmpty = () => {
    const canvas = canvasRef.current;
    if (!canvas) return true;

    const ctx = canvas.getContext('2d');
    if (!ctx) return true;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageData.data.every(pixel => pixel === 0);
  };

  return (
    <div className="space-y-6">
      {/* Settlement Agreement Document */}
      <Card>
        <CardHeader>
          <CardTitle>Settlement Agreement</CardTitle>
          <CardDescription>
            Review the final settlement terms before signing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Case Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">Case Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Case ID:</span>
                  <span className="ml-2">{finalDecision.caseId}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Decision Date:</span>
                  <span className="ml-2">{new Date(finalDecision.decidedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Settlement Terms */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Settlement Terms</h4>
              <div className="space-y-3">
                {finalDecision.terms.map((term, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium uppercase">
                            {term.party}
                          </span>
                          {term.timeline && (
                            <span className="text-sm text-gray-600">
                              Timeline: {term.timeline}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-800">{term.description}</p>
                      </div>
                      {term.amount && (
                        <div className="text-right">
                          <span className="text-lg font-semibold text-green-600">
                            ₹{term.amount.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision Text */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Final Decision</h4>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-gray-800 leading-relaxed">{finalDecision.decisionText}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Signature Section */}
      <Card>
        <CardHeader>
          <CardTitle>Digital Signature</CardTitle>
          <CardDescription>
            {hasUserSigned 
              ? 'You have already signed this agreement' 
              : 'Please sign below to accept the settlement agreement'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasUserSigned ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-lg font-semibold text-green-600 mb-2">
                Agreement Signed Successfully
              </h3>
              <p className="text-gray-600">
                You signed this agreement on{' '}
                {new Date(
                  finalDecision.signatures.find(sig => sig.userId === currentUserId)?.signedAt || ''
                ).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Signature Canvas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sign here:
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full h-32 border border-gray-200 rounded bg-white cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                  />
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Click and drag to sign. Use a mouse or touchpad for best results.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearSignature}
                >
                  Clear Signature
                </Button>
                <Button
                  onClick={saveSignature}
                  disabled={isCanvasEmpty() || isLoading}
                  className="px-8"
                >
                  {isLoading ? 'Signing...' : 'Sign Agreement'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signature Status */}
      <Card>
        <CardHeader>
          <CardTitle>Signature Status</CardTitle>
          <CardDescription>
            Track who has signed the agreement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {finalDecision.signatures.map((signature) => (
              <div key={signature.userId} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center">
                    ✓
                  </div>
                  <div>
                    <p className="font-medium text-green-800">{signature.user.name}</p>
                    <p className="text-sm text-green-600">
                      Signed on {new Date(signature.signedAt).toLocaleDateString()} at{' '}
                      {new Date(signature.signedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const img = new Image();
                    img.src = signature.signatureData;
                    const win = window.open('');
                    win?.document.write(img.outerHTML);
                  }}
                >
                  View Signature
                </Button>
              </div>
            ))}

            {finalDecision.signatures.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">✍️</div>
                <p>No signatures yet</p>
                <p className="text-sm mt-1">Waiting for parties to sign the agreement</p>
              </div>
            )}
          </div>

          {/* Agreement Status */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Agreement Status</h4>
                <p className="text-sm text-gray-600">
                  {finalDecision.signatures.length} of {/* total parties needed */} 2 signatures collected
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                finalDecision.status === 'completed' 
                  ? 'bg-green-100 text-green-800'
                  : finalDecision.status === 'signed'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {finalDecision.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal Notice */}
      <Card>
        <CardHeader>
          <CardTitle>Legal Notice</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              <strong>Digital Signature Validity:</strong> Your digital signature is legally binding under the 
              Information Technology Act, 2000 and Indian Evidence Act, 1872.
            </p>
            <p>
              <strong>Agreement Enforceability:</strong> This settlement agreement is legally enforceable 
              and can be presented in court if needed.
            </p>
            <p>
              <strong>Record Keeping:</strong> A permanent record of this agreement and all signatures 
              will be maintained for legal purposes.
            </p>
            <p>
              <strong>Document Access:</strong> You will receive a copy of the signed agreement via email 
              once all parties have signed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}