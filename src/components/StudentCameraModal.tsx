import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle, Image as ImageIcon, FlipHorizontal } from 'lucide-react';

interface StudentCameraModalProps {
  isOpen: boolean;
  studentName?: string;
  onCapture: (photoDataUrl: string) => void;
  onClose: () => void;
}

export const StudentCameraModal: React.FC<StudentCameraModalProps> = ({
  isOpen,
  studentName,
  onCapture,
  onClose
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera tracks
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start camera stream
  const startCamera = useCallback(async (facing: 'user' | 'environment') => {
    stopCamera();
    setIsInitializing(true);
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 720 },
          height: { ideal: 720 }
        },
        audio: false
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera device detected on this device.');
      } else {
        setCameraError(err.message || 'Unable to start camera.');
      }
    } finally {
      setIsInitializing(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (isOpen && !previewImage) {
      startCamera(facingMode);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, startCamera, stopCamera]);

  // Make sure video srcObject stays attached on re-render
  useEffect(() => {
    if (videoRef.current && stream && !previewImage) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, previewImage]);

  // Flip camera (front/back)
  const handleToggleFacingMode = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Capture snapshot from live video
  const handleCaptureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = canvasRef.current || document.createElement('canvas');
    const size = Math.min(video.videoWidth || 480, video.videoHeight || 480);
    canvas.width = 400;
    canvas.height = 400;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Crop center square
    const sx = ((video.videoWidth || size) - size) / 2;
    const sy = ((video.videoHeight || size) - size) / 2;

    if (facingMode === 'user') {
      // Mirror user selfie feed
      ctx.translate(400, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPreviewImage(dataUrl);
    stopCamera();
  };

  // Retake photo
  const handleRetake = () => {
    setPreviewImage(null);
    startCamera(facingMode);
  };

  // Upload file fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 400;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 400, 400);
          const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setPreviewImage(croppedDataUrl);
          stopCamera();
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Confirm photo
  const handleConfirm = () => {
    if (previewImage) {
      onCapture(previewImage);
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setPreviewImage(null);
    setCameraError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-[#1A1C23] border border-[#2D3139] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2D3139] bg-[#0F1115]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Student Profile Photo</h3>
              <p className="text-[11px] text-slate-400">
                {studentName ? `Take photo for ${studentName}` : 'Capture or upload student photo'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#252830] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport / Live Stream / Preview */}
        <div className="relative p-5 bg-[#0F1115] flex flex-col items-center justify-center min-h-[320px]">
          {previewImage ? (
            <div className="relative w-64 h-64 rounded-2xl overflow-hidden border-2 border-emerald-500/60 shadow-xl bg-black">
              <img
                src={previewImage}
                alt="Captured Preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/80 text-black text-[10px] font-bold">
                Captured
              </div>
            </div>
          ) : cameraError ? (
            <div className="p-6 text-center space-y-3 max-w-xs">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-rose-300">{cameraError}</p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Try Camera Again
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-xl bg-[#252830] hover:bg-[#2D3139] text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-purple-400" /> Upload from Gallery / Device
                </button>
              </div>
            </div>
          ) : (
            <div className="relative w-64 h-64 rounded-2xl overflow-hidden border border-[#2D3139] bg-black shadow-inner">
              {isInitializing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 text-xs text-slate-300 gap-2">
                  <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
                  <span>Starting camera...</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
              />
              {/* Framing Oval Guide */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-44 h-52 border-2 border-dashed border-purple-400/50 rounded-full opacity-70" />
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-[#2D3139] bg-[#1A1C23] flex items-center justify-between gap-2">
          {previewImage ? (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="px-4 py-2 rounded-xl bg-[#252830] hover:bg-[#2D3139] text-slate-300 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Retake
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Use This Photo
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  title="Switch Camera (Front / Rear)"
                  className="p-2 rounded-xl bg-[#252830] hover:bg-[#2D3139] text-slate-300 hover:text-white transition"
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload Image File"
                  className="px-3 py-2 rounded-xl bg-[#252830] hover:bg-[#2D3139] text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                  <span>Gallery</span>
                </button>
              </div>

              <button
                type="button"
                disabled={isInitializing || !!cameraError}
                onClick={handleCaptureSnapshot}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-900/40 transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>Snap Photo</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
