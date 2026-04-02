'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { parseGS1DataMatrix } from '../../lib/gs1-parser';
import { Zap, ZapOff, Camera, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// --- INTERFEJSY DLA TYPESCRIPT ---
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

// --- KOMPONENT ---
export default function MedicineScanner({ onResult }: { onResult: (data: GS1Data) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pobieranie listy kamer
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          const formattedDevices = devices.map((d) => ({ id: d.id, label: d.label }));
          setCameras(formattedDevices);
          // Wybieramy ostatnią kamerę (zazwyczaj główny obiektyw z tyłu)
          setSelectedCameraId(devices[devices.length - 1].id);
        } else {
          setError("Nie znaleziono żadnej kamery.");
        }
      })
      .catch(() => setError("Brak uprawnień do kamery."));
  }, []);

  // Logika startu skanera
  useEffect(() => {
    if (!selectedCameraId) return;

    const html5QrCode = new Html5Qrcode("reader", { 
      formatsToSupport: [Html5QrcodeSupportedFormats.DATA_MATRIX],
      verbose: false 
    });
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      setIsReady(false);
      try {
        const videoConstraints: ExtendedMediaTrackConstraints = {
          deviceId: { exact: selectedCameraId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          focusMode: "continuous"
        };

        await html5QrCode.start(
          selectedCameraId, 
          { 
            fps: 30,
            qrbox: (w, h) => {
              const size = Math.floor(Math.min(w, h) * 0.6);
              return { width: size, height: size };
            },
            videoConstraints: videoConstraints as MediaTrackConstraints
          },
          (decodedText) => {
            if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(100);
            const parsed = parseGS1DataMatrix(decodedText);
            html5QrCode.stop().then(() => onResult({
              gtin: parsed.gtin ?? undefined,
              expiryDate: parsed.expiryDate ?? undefined,
              batch: parsed.batch ?? undefined
            })).catch(console.error);
          },
          () => {} // Szukanie kodu...
        );

        setIsReady(true);
        setError(null);

        // Opcjonalne funkcje sprzętowe (Zoom)
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
        setError("Błąd inicjalizacji tego obiektywu.");
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
      if (!scannerRef.current) return;
      const track = (scannerRef.current as unknown as Html5QrcodeWithTrack).getRunningTrack();
      const caps = track.getCapabilities() as ExtendedMediaTrackCapabilities;
      if (caps.torch) {
        const newState = !isFlashOn;
        await track.applyConstraints({
          advanced: [{ torch: newState } as ExtendedMediaTrackConstraints]
        });
        setIsFlashOn(newState);
      }
    } catch (e) {
      console.error("Błąd latarki", e);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-slate-950 rounded-[2.5rem] border border-white/10 shadow-2xl">
      {/* Wybór obiektywu */}
      {cameras.length > 1 && (
        <div className="mb-4 flex items-center gap-2 bg-white/5 p-2 rounded-2xl border border-white/10">
          <Camera className="text-blue-400 ml-2" size={18} />
          <select 
            value={selectedCameraId}
            onChange={(e) => setSelectedCameraId(e.target.value)}
            className="bg-transparent text-white text-[11px] font-bold w-full outline-none p-1 uppercase tracking-tight"
          >
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id} className="bg-slate-900">
                {camera.label || `Obiektyw ${camera.id.substring(0, 4)}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="relative overflow-hidden rounded-[2rem] bg-black aspect-square border-2 border-blue-500/20">
        <div id="reader" className="w-full h-full"></div>

        {/* UI Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[160px] h-[160px] border-2 border-white/20 rounded-3xl shadow-[0_0_0_999px_rgba(0,0,0,0.6)]">
             <div className="w-full h-0.5 bg-blue-500/50 mt-[80px] animate-pulse"></div>
          </div>
        </div>

        {/* Przycisk Flash */}
        <button 
          type="button"
          onClick={toggleFlash}
          className="absolute bottom-6 right-6 p-4 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white active:scale-90 transition-all"
        >
          {isFlashOn ? <Zap fill="currentColor" className="text-yellow-400" /> : <ZapOff /> }
        </button>

        {/* Statusy */}
        {!isReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
            <Loader2 className="animate-spin text-blue-500 mb-2" />
            <span className="text-[10px] text-blue-400 uppercase tracking-widest">Uruchamiam obiektyw...</span>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-8 text-center">
            <AlertCircle className="text-red-500 mb-2" />
            <p className="text-red-400 text-xs font-bold uppercase mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="flex items-center gap-2 text-[10px] text-white bg-white/10 px-4 py-2 rounded-full">
              <RefreshCw size={12} /> ODŚWIEŻ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}