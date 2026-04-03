'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../src/hooks/useAuth'
import { useAppStore } from '../../src/lib/store'
import { createClient } from '../../src/lib/supabase/client'
import { InventoryList } from '@/src/components/dashboard/InventoryList'
import MedicineScanner from '@/src/components/scanner/MedicineScanner'
import { LogOut, Package, QrCode, Plus, Camera } from 'lucide-react'

export default function DashboardPage() {
  const { loading: authLoading, signOut } = useAuth()
  const { user, currentTeam, setCurrentTeam } = useAppStore()
  const [showScanner, setShowScanner] = useState(false)
  const [inventory, setInventory] = useState<any[]>([])
  const [storage, setStorage] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'inventory' | 'storage'>('inventory')
  const router = useRouter()
  const supabase = createClient()

  const fetchData = async () => {
    if (!currentTeam) return

    setLoading(true)
    
    // Pobierz inventory (karetka)
    const { data: inventoryData } = await supabase
      .from('inventory')
      .select('*')
      .eq('team_id', currentTeam.id)
      .order('expiry_date', { ascending: true })
    
    if (inventoryData) setInventory(inventoryData)
    
    // Pobierz storage (szafa)
    const { data: storageData } = await supabase
      .from('storage')
      .select('*')
      .eq('team_id', currentTeam.id)
      .order('expiry_date', { ascending: true })
    
    if (storageData) setStorage(storageData)
    
    setLoading(false)
  }

  useEffect(() => {
    if (!currentTeam) return
    fetchData()

    // Subskrypcja real-time
    const channel = supabase
      .channel('changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `team_id=eq.${currentTeam.id}`,
        },
        () => fetchData()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'storage',
          filter: `team_id=eq.${currentTeam.id}`,
        },
        () => fetchData()
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [currentTeam])

  const handleScan = async (data: any) => {
    // Dodaj zeskanowany lek do storage (szafa)
    const { error } = await supabase
      .from('storage')
      .upsert({
        team_id: currentTeam!.id,
        gtin: data.gtin,
        drug_name: data.drug_name || `GTIN: ${data.gtin?.slice(-8)}`,
        batch_number: data.batch,
        expiry_date: data.expiryDate,
        quantity: 1,
        min_quantity: 10
      }, {
        onConflict: 'team_id,gtin,batch_number'
      })
    
    if (error) {
      console.error('Błąd dodawania do storage:', error)
      alert('Błąd dodawania leku: ' + error.message)
    } else {
      // Jeśli lek istnieje w storage, zwiększ quantity
      const { data: existing } = await supabase
        .from('storage')
        .select('quantity')
        .eq('team_id', currentTeam!.id)
        .eq('gtin', data.gtin)
        .eq('batch_number', data.batch)
        .single()
      
      if (existing && existing.quantity > 1) {
        await supabase
          .from('storage')
          .update({ quantity: existing.quantity + 1 })
          .eq('team_id', currentTeam!.id)
          .eq('gtin', data.gtin)
          .eq('batch_number', data.batch)
      }
      
      alert('Lek dodany do szafy!')
      fetchData()
    }
    
    setShowScanner(false)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  if (!currentTeam) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-md mx-auto mt-20 text-center">
          <Package className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Dołącz do zespołu</h2>
          <p className="text-slate-400 mb-6">
            Zeskanuj kod QR swojej karetki, aby rozpocząć pracę
          </p>
          <button
            onClick={() => setShowScanner(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
          >
            Skanuj kod QR zespołu
          </button>
        </div>
        
        {showScanner && (
          <div className="fixed inset-0 bg-black z-50 p-4">
            <MedicineScanner
              onResult={async (data) => {
                const { data: team } = await supabase
                  .from('teams')
                  .select('*')
                  .eq('qr_token', data.gtin)
                  .single()
                
                if (team) {
                  setCurrentTeam(team)
                  setShowScanner(false)
                } else {
                  alert('Nieprawidłowy kod QR')
                }
              }}
            />
            <button
              onClick={() => setShowScanner(false)}
              className="absolute top-4 right-4 bg-red-500 p-2 rounded-full"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{currentTeam.name}</h1>
            <p className="text-xs text-slate-400">{user?.full_name}</p>
          </div>
          <button
            onClick={signOut}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-3 font-medium transition-colors ${
            activeTab === 'inventory'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Karetka
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`flex-1 py-3 font-medium transition-colors ${
            activeTab === 'storage'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          Szafa (Zapasy)
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'inventory' ? (
          <>
            <div className="mb-4 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Leki w karetce</h2>
              <button
                onClick={() => setShowScanner(true)}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium"
              >
                <Camera size={16} />
                Dodaj nowy lek
              </button>
            </div>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : (
              <InventoryList inventory={inventory} onUpdate={fetchData} />
            )}
          </>
        ) : (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-white">Zapasy w szafie</h2>
              <p className="text-xs text-slate-400">
                Kliknij &quot;+&quot; przy leku w karetce aby przenieść z zapasów
              </p>
            </div>
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : storage.length === 0 ? (
              <div className="text-center py-12 bg-slate-800 rounded-xl">
                <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Brak zapasów w szafie</p>
                <p className="text-slate-500 text-sm mt-2">
                  Zeskanuj nowe leki aby dodać je do zapasów
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {storage.map((item) => (
                  <div key={item.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-white">{item.drug_name}</h3>
                        <p className="text-slate-400 text-sm">Seria: {item.batch_number}</p>
                        <p className="text-slate-500 text-xs mt-1">
                          Ważność: {new Date(item.expiry_date).toLocaleDateString('pl-PL')}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-white font-bold text-2xl">{item.quantity}</span>
                        <p className="text-xs text-slate-400">sztuk w zapasie</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-50">
          <div className="relative h-full">
            <MedicineScanner onResult={handleScan} />
            <button
              onClick={() => setShowScanner(false)}
              className="absolute top-4 right-4 bg-red-500 p-3 rounded-full"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}