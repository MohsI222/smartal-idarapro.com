/** Electronic Signature Canvas Component */
import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface SignatureCanvasProps {
  onSave: (signatureData: string) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
}

export function SignatureCanvas({ onSave, onCancel, width = 500, height = 200 }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size only once
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    // Set default styles
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Handle touch events for mobile
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!isDrawing) return;
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    };

    const handleTouchEnd = () => {
      setIsDrawing(false);
    };

    canvas.addEventListener("touchstart", handleTouchStart);
    canvas.addEventListener("touchmove", handleTouchMove);
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawing) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = () => {
    console.log("[SignatureCanvas] handleSave called, hasSignature:", hasSignature);
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) {
      console.log("[SignatureCanvas] Cannot save - no canvas or no signature");
      return;
    }

    const signatureData = canvas.toDataURL("image/png");
    console.log("[SignatureCanvas] Signature data length:", signatureData.length);
    onSave(signatureData);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', visibility: 'visible' }}>
      <div style={{ border: '2px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff', display: 'block', visibility: 'visible' }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          style={{ cursor: 'crosshair', touchAction: 'none', display: 'block', visibility: 'visible' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '8px', visibility: 'visible' }}>
        <Button onClick={handleSave} style={{ flex: '1', display: 'block', visibility: 'visible' }} disabled={!hasSignature}>
          حفظ التوقيع
        </Button>
        <Button onClick={clearCanvas} variant="outline" size="icon" style={{ display: 'block', visibility: 'visible' }}>
          <Trash2 className="h-4 w-4" />
        </Button>
        {onCancel && (
          <Button onClick={onCancel} variant="outline" style={{ flex: '1', display: 'block', visibility: 'visible' }}>
            إلغاء
          </Button>
        )}
      </div>
      {!hasSignature && (
        <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', display: 'block', visibility: 'visible' }}>
          يرجى التوقيع في المربع أعلاه
        </p>
      )}
    </div>
  );
}
