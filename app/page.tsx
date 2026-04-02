'use client';

import { useState } from 'react';
import MedicineScanner from '../src/components/scanner/MedicineScanner';

type ScannedData = {
  gtin: string;
  expiryDate: string;
  batch: string;
};

export default function Home() {
  const [scannedData, setScannedData] = useState<ScannedData | null>(null);

  return (
    <main className="min-h-screen bg-slate-900 text-white p-6">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-black text-blue-400">MedStock ZRM</h1>
        <p className="text-slate-400">System Zarządzania Lekami</p>
      </header>

      {!scannedData ? (
        <MedicineScanner onResult={(data) => setScannedData({
          gtin: data.gtin ?? '',
          expiryDate: data.expiryDate ?? '',
          batch: data.batch ?? ''
        })} />
      ) : (
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl">
          <h2 className="text-xl font-bold mb-4 text-green-400">Wykryto produkt!</h2>
          
          <div className="space-y-3">
            <p><span className="text-slate-400">GTIN:</span> {scannedData.gtin}</p>
            <p><span className="text-slate-400">Data ważności:</span> 
              <span className="font-mono text-lg ml-2">{scannedData.expiryDate}</span>
            </p>
            <p><span className="text-slate-400">Seria:</span> {scannedData.batch}</p>
          </div>

          <button 
            onClick={() => setScannedData(null)}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition-colors"
          >
            Skanuj kolejny
          </button>
        </div>
      )}
    </main>
  );
}