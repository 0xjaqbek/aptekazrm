'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { parseGS1DataMatrix } from '../../lib/gs1-parser';
import { Zap, ZapOff, Camera, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  zoom?: { max: number; min: number; step: number };
  torch?: boolean;
}

interface ExtendedMediaTrackConstraints extends MediaTrackConstraints {
  focusMode?: 'continuous' | 'manual' | 'single-shot';
  zoom?: number;
  torch?: boolean;
}

interface Html5QrcodeWithTrack extends Html5Qrcode {
  getRunningTrack(): MediaStreamTrack;
}

interface GS1Data {
  gtin?: string;
  expiryDate?: string;
  batch?: string;
}

interface CameraDevice {
  id: string;
  label: string;
}

export default function MedicineScanner({ onResult }: { onResult: (data: GS1Data) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const formattedDevices = devices.map((d) => ({ id: d.id, label: d.label || `Camera ${d.id.slice(0,4)}` }));
          setCameras(formattedDevices);
          const backCamera = devices.find(d => d.label.toLowerCase().includes('back')) || devices[devices.length - 1];
          setSelectedCameraId(backCamera.id);
        } else {
          setError("Nie znaleziono żadnej kamery.");
        }
      })
      .catch(() => setError("Brak uprawnień do kamery."));
  }, []);

  useEffect(() => {
    if (!selectedCameraId) return;

    const html5QrCode = new Html5Qrcode("reader", { 
      formatsToSupport: [Html5QrcodeSupportedFormats.DATA_MATRIX, Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false 
    });
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      setIsReady(false);
      setScanning(true);
      try {
        await html5QrCode.start(
          selectedCameraId, 
          { 
            fps: 30,
            qrbox: (w, h) => {
              const size = Math.floor(Math.min(w, h) * 0.6);
              return { width: size, height: size };
            },
            aspectRatio: 1.0
          },
          (decodedText) => {
            if (!scanning) return;
            setScanning(false);
            
            if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(200);
            
            let parsed;
            // Sprawdź czy to kod QR zespołu (prosty token) czy GS1
            if (decodedText.length < 30 && !decodedText.includes('01')) {
              parsed = { gtin: decodedText, expiryDate: '', batch: '' };
            } else {
              parsed = parseGS1DataMatrix(decodedText);
            }
            
            html5QrCode.stop().then(() => {
              onResult({
                gtin: parsed.gtin ?? undefined,
                expiryDate: parsed.expiryDate ?? undefined,
                batch: parsed.batch ?? undefined
              });
            }).catch(console.error);
          },
          () => {}
        );

        setIsReady(true);
        setError(null);

        // Auto-zoom jeśli dostępny
        try {
          const track = (html5QrCode as unknown as Html5QrcodeWithTrack).getRunningTrack();
          const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;
          if (caps.zoom) {
            await track.applyConstraints({
              advanced: [{ zoom: caps.zoom.max / 2 } as ExtendedMediaTrackConstraints]
            });
          }
        } catch (e) {
          console.warn("Zoom niedostępny", e);
        }

      } catch (err) {
        console.error(err);
        setError("Błąd inicjalizacji kamery.");
        setScanning(false);
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, [selectedCameraId, onResult]);

  const toggleFlash = async () => {
    try {
      if (!scannerRef.current?.isScanning) return;
      const track = (scannerRef.current as unknown as Html5QrcodeWithTrack).getRunningTrack();
      const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;
      if (caps.torch) {
        const newState = !isFlashOn;
        await track.applyConstraints({
          advanced: [{ torch: newState } as ExtendedMediaTrackConstraints]
        });
        setIsFlashOn(newState);
      } else {
        alert('Ta kamera nie obsługuje latarki');
      }
    } catch (e) {
      console.error("Błąd latarki", e);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-black rounded-2xl overflow-hidden">
      {/* Camera selector */}
      {cameras.length > 1 && (
        <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-md rounded-lg px-3 py-2">
          <select 
            value={selectedCameraId}
            onChange={(e) => {
              setSelectedCameraId(e.target.value);
              setScanning(true);
            }}
            className="bg-transparent text-white text-xs font-medium outline-none"
          >
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative aspect-square bg-black">
        <div id="reader" className="w-full h-full"></div>

        {/* Scanning frame */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 border-2 border-blue-500 rounded-2xl shadow-[0_0_0_999px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-blue-500"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-blue-500"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-blue-500"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-blue-500"></div>
            {isReady && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full">
                <div className="h-0.5 bg-blue-500 animate-pulse"></div>
              </div>
            )}
          </div>
        </div>

        {/* Flash button */}
        <button 
          onClick={toggleFlash}
          className="absolute bottom-6 right-6 p-3 rounded-full bg-black/50 backdrop-blur-md border border-white/20 active:scale-95 transition-all z-10"
        >
          {isFlashOn ? <Zap fill="currentColor" className="text-yellow-400" size={24} /> : <ZapOff className="text-white" size={24} />}
        </button>

        {/* Loading overlay */}
        {!isReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <Loader2 className="animate-spin text-blue-500 mb-3" size={32} />
            <span className="text-xs text-blue-400 uppercase tracking-wider">Uruchamianie kamery...</span>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
            <AlertCircle className="text-red-500 mb-3" size={32} />
            <p className="text-red-400 text-sm font-medium mb-4">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="flex items-center gap-2 text-xs text-white bg-white/10 px-4 py-2 rounded-full"
            >
              <RefreshCw size={12} /> SPRÓBUJ PONOWNIE
            </button>
          </div>
        )}
      </div>

      <div className="p-4 text-center">
        <p className="text-white/60 text-xs">
          Umieść kod Data Matrix lub QR w ramce
        </p>
      </div>
    </div>
  );
}