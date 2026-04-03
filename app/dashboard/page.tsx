'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../../src/hooks/useAuth'
import { useAppStore } from '../../src/lib/store'
import { createClient } from '../../src/lib/supabase/client'
import  MedicineScanner  from '../../src/components/scanner/MedicineScanner'
import { InventoryList } from '../../src/components/dashboard/InventoryList'
import { LogOut, QrCode, Package, AlertTriangle, CheckCircle } from 'lucide-react'

export default function DashboardPage() {
  const { loading: authLoading, signOut } = useAuth()
  const { user, currentTeam, setCurrentTeam } = useAppStore()
  const [showScanner, setShowScanner] = useState(false)
  const [scanningForRefill, setScanningForRefill] = useState(false)
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Pobierz inventory dla obecnego zespołu
  useEffect(() => {
    if (!currentTeam) return

    const fetchInventory = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('inventory')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('expiry_date', { ascending: true })
      
      if (data) setInventory(data)
      setLoading(false)
    }

    fetchInventory()

    // Subskrypcja real-time
    const channel = supabase
      .channel('inventory_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `team_id=eq.${currentTeam.id}`,
        },
        () => fetchInventory()
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [currentTeam])

  const handleScan = async (data: any) => {
    if (scanningForRefill) {
      // Uzupełnienie leku
      await supabase
        .from('inventory')
        .update({ quantity: data.quantity + 1 })
        .eq('team_id', currentTeam!.id)
        .eq('gtin', data.gtin)
        .eq('batch_number', data.batch)
      
      // Loguj akcję
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        team_id: currentTeam!.id,
        action: 'refill',
        metadata: { gtin: data.gtin, batch: data.batch }
      })
      
      setScanningForRefill(false)
    } else {
      // Użycie leku
      const item = inventory.find(
        i => i.gtin === data.gtin && i.batch_number === data.batch
      )
      
      if (item && item.quantity > 0) {
        // Dla leków kontrolowanych - wymagaj KZW
        if (data.isControlled) {
          const kzw = prompt('Podaj numer KZW dla leku kontrolowanego:')
          if (!kzw) return
          
          await supabase.from('audit_logs').insert({
            user_id: user?.id,
            team_id: currentTeam!.id,
            action: 'usage',
            kzw_number: kzw,
            metadata: { gtin: data.gtin, batch: data.batch }
          })
        }
        
        await supabase
          .from('inventory')
          .update({ quantity: item.quantity - 1 })
          .eq('id', item.id)
      } else {
        alert('Brak leku w magazynie!')
      }
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

      {/* Actions */}
      <div className="p-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            setScanningForRefill(false)
            setShowScanner(true)
          }}
          className="bg-blue-600 hover:bg-blue-700 p-4 rounded-xl flex items-center justify-center gap-2 font-bold"
        >
          <Package size={20} />
          Użyj lek
        </button>
        <button
          onClick={() => {
            setScanningForRefill(true)
            setShowScanner(true)
          }}
          className="bg-green-600 hover:bg-green-700 p-4 rounded-xl flex items-center justify-center gap-2 font-bold"
        >
          <QrCode size={20} />
          Uzupełnij
        </button>
      </div>

      {/* Inventory List */}
      <div className="p-4">
        <h2 className="text-lg font-bold text-white mb-3">Stan leków</h2>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        ) : (
          <InventoryList inventory={inventory} />
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