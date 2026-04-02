'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { parseGS1DataMatrix } from '../../lib/gs1-parser';
import { Zap, ZapOff, Loader2, AlertCircle } from 'lucide-react';

// Rozszerzenie natywnych typów przeglądarki dla zaawansowanych funkcji aparatu
interface ExtendedMediaTrackConstraints extends MediaTrackConstraints {
  focusMode?: 'continuous' | 'manual' | 'single-shot';
  torch?: boolean;
}

interface GS1Data {
  gtin?: string;
  expiryDate?: string;
  batch?: string;
}

interface ScannerProps {
  onResult: (data: GS1Data) => void;
}

export default function MedicineScanner({ onResult }: ScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Inicjalizacja instancji skanera
    const html5QrCode = new Html5Qrcode("reader", { 
      formatsToSupport: [Html5QrcodeSupportedFormats.DATA_MATRIX],
      verbose: false 
    });
    scannerRef.current = html5QrCode;

    const startScanner = async () => {
      try {
        // Konfiguracja wideo z uwzględnieniem specyfiki ampułek (Makro/Focus)
        const videoConstraints: ExtendedMediaTrackConstraints = {
          facingMode: "environment",
          width: { min: 1280, ideal: 1920 },
          height: { min: 720, ideal: 1080 },
          focusMode: "continuous"
        };

        await html5QrCode.start(
          { facingMode: "environment" }, 
          { 
            fps: 30,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
              // Mały kwadrat celowniczy wymusza na użytkowniku precyzyjne nakierowanie
              const size = Math.floor(minEdge * 0.6);
              return { width: size, height: size };
            },
            aspectRatio: 1.0,
            videoConstraints: videoConstraints
          },
          (decodedText: string) => {
            // Sukces skanowania
            if (typeof window !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(100);
            }

            const parsedRaw = parseGS1DataMatrix(decodedText);
            
            html5QrCode.stop().then(() => {
              onResult({
                gtin: parsedRaw.gtin || undefined,
                expiryDate: parsedRaw.expiryDate || undefined,
                batch: parsedRaw.batch || undefined
              });
            }).catch((err: Error) => console.error("Stop error:", err));
          },
          () => { /* logowanie klatek pominięte dla wydajności */ }
        );

        // Aktywacja ZOOMU sprzętowego (jeśli wspierany)
        // @ts-expect-error - getRunningTrack zwraca MediaStreamTrack, ale typy html5-qrcode są niepełne
        const track = html5QrCode.getRunningTrack() as MediaStreamTrack;
        const capabilities = track.getCapabilities() as Record<string, unknown>;
        
        if (capabilities.zoom) {
          const zoomCaps = capabilities.zoom as { max: number; min: number };
          await track.applyConstraints({
            advanced: [
              // @ts-expect-error - zoom jest specyficzny dla mobilnych MediaTrackConstraints
              { zoom: zoomCaps.max / 2 }
            ]
          });
        }

        setIsReady(true);
      } catch (err) {
        console.error("Camera start error:", err);
        setError("Nie udało się uruchomić aparatu. Upewnij się, że masz włączone uprawnienia.");
      }
    };

    startScanner();

    // Cleanup przy odmontowaniu komponentu
    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch((err: Error) => console.error("Cleanup error:", err));
      }
    };
  }, [onResult]);

  const toggleFlash = async () => {
    try {
      if (!scannerRef.current) return;
      // @ts-expect-error - dostęp do tracka w runtime
      const track = scannerRef.current.getRunningTrack() as MediaStreamTrack;
      const capabilities = track.getCapabilities() as Record<string, unknown>;
      
      if (capabilities.torch) {
        const newState = !isFlashOn;
        await track.applyConstraints({
          advanced: [
            // @ts-expect-error - torch obsługa sprzętowa diody LED
            { torch: newState }
          ]
        });
        setIsFlashOn(newState);
      }
    } catch (err) {
      console.error("Flash error:", err);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-slate-950 rounded-[3rem] border border-white/10 shadow-2xl">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-black aspect-square border-2 border-blue-500/30">
        
        {/* Kontener renderowania wideo */}
        <div id="reader" className="w-full h-full"></div>

        {/* Nakładka wizualna UI */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Ramka celownika */}
          <div className="w-[180px] h-[180px] border-2 border-white/10 rounded-[2rem] shadow-[0_0_0_999px_rgba(0,0,0,0.7)] flex items-center justify-center">
             {/* Linia skanowania */}
             <div className="w-full h-[1px] bg-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-[pulse_2s_infinite]"></div>
          </div>
          
          <div className="absolute top-12 text-white/30 text-[9px] font-bold tracking-[0.3em] uppercase">
            Scanner Data Matrix GS1
          </div>
        </div>

        {/* Przycisk Flash (Latarka) */}
        <button 
          type="button"
          onClick={toggleFlash}
          className={`absolute bottom-8 right-8 p-5 rounded-full backdrop-blur-xl border transition-all active:scale-90 ${
            isFlashOn 
              ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400' 
              : 'bg-white/5 border-white/10 text-white/70'
          }`}
        >
          {isFlashOn ? <Zap size={24} fill="currentColor" /> : <ZapOff size={24} /> }
        </button>

        {/* Loader przy ładowaniu */}
        {!isReady && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
            <p className="text-blue-400/60 text-xs font-medium uppercase tracking-widest">Inicjalizacja...</p>
          </div>
        )}

        {/* Komunikat o błędzie */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 p-8 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
            <p className="text-red-400 text-sm font-semibold">{error}</p>
            <button 
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-white/60 text-xs"
            >
              Odśwież stronę
            </button>
          </div>
        )}
      </div>

      {/* Instrukcja dla ratownika */}
      <div className="mt-8 px-6 text-center">
        <p className="text-slate-200 text-sm font-semibold tracking-tight">
          Skanowanie w toku...
        </p>
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          Trzymaj ampułkę nieruchomo w odległości około 15 cm. <br/>
          W razie problemów z ostrością użyj latarki.
        </p>
      </div>
    </div>
  );
}