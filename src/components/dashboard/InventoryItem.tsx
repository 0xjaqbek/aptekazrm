'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import { Minus, Plus, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface InventoryItemProps {
  item: {
    id: string
    team_id: string
    gtin: string
    drug_name: string
    batch_number: string
    expiry_date: string
    quantity: number
    min_quantity: number
    is_controlled: boolean
  }
  onUpdate: () => void
}

export function InventoryItem({ item, onUpdate }: InventoryItemProps) {
  const [loading, setLoading] = useState(false)
  const [showKZW, setShowKZW] = useState(false)
  const supabase = createClient()

  const getStatus = () => {
    const daysUntilExpiry = new Date(item.expiry_date).getTime() - new Date().getTime()
    const daysUntilExpiryNum = daysUntilExpiry / (1000 * 3600 * 24)
    
    if (daysUntilExpiryNum < 0) return 'expired'
    if (item.quantity === 0) return 'empty'
    if (daysUntilExpiryNum < 30 || item.quantity <= item.min_quantity) return 'warning'
    return 'good'
  }

  const getStatusColor = () => {
    const status = getStatus()
    switch (status) {
      case 'expired': return 'bg-red-500 border-red-600'
      case 'empty': return 'bg-red-700 border-red-800'
      case 'warning': return 'bg-orange-500 border-orange-600'
      default: return 'bg-green-500/20 border-green-500/30'
    }
  }

  const getStatusIcon = () => {
    const status = getStatus()
    switch (status) {
      case 'expired':
      case 'empty':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-orange-400" />
      default:
        return <CheckCircle className="w-5 h-5 text-green-400" />
    }
  }

  const handleUse = async () => {
    if (item.is_controlled) {
      setShowKZW(true)
      return
    }
    
    await performUse()
  }

  const performUse = async (kzwNumber?: string) => {
    setLoading(true)
    
    // Odejmij z inventory
    const { error: inventoryError } = await supabase
      .from('inventory')
      .update({ quantity: item.quantity - 1 })
      .eq('id', item.id)
    
    if (!inventoryError) {
      // Zapisz do audit log
      await supabase.from('audit_logs').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        team_id: item.team_id,
        action: 'usage',
        kzw_number: kzwNumber || null,
        metadata: { 
          drug_name: item.drug_name, 
          batch: item.batch_number,
          gtin: item.gtin
        }
      })
      
      onUpdate()
    }
    
    setLoading(false)
    setShowKZW(false)
  }

  const handleRefill = async () => {
    setLoading(true)
    
    // Sprawdź czy są zapasy w storage
    const { data: storage } = await supabase
      .from('storage')
      .select('quantity, id')
      .eq('team_id', item.team_id)
      .eq('gtin', item.gtin)
      .eq('batch_number', item.batch_number)
      .single()
    
    if (storage && storage.quantity > 0) {
      // Odejmij z storage
      await supabase
        .from('storage')
        .update({ quantity: storage.quantity - 1 })
        .eq('id', storage.id)
      
      // Dodaj do inventory
      const { error } = await supabase
        .from('inventory')
        .update({ quantity: item.quantity + 1 })
        .eq('id', item.id)
      
      if (!error) {
        // Zapisz do audit log
        await supabase.from('audit_logs').insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          team_id: item.team_id,
          action: 'refill',
          metadata: { 
            drug_name: item.drug_name, 
            batch: item.batch_number,
            gtin: item.gtin
          }
        })
        
        onUpdate()
      }
    } else {
      alert('Brak zapasów w szafie! Zeskanuj nowe leki aby uzupełnić zapasy.')
    }
    
    setLoading(false)
  }

  const status = getStatus()
  const daysUntilExpiry = new Date(item.expiry_date).getTime() - new Date().getTime()
  const daysUntilExpiryNum = Math.floor(daysUntilExpiry / (1000 * 3600 * 24))

  return (
    <>
      <div className={`border rounded-xl p-4 ${getStatusColor()}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <h3 className="font-bold text-white text-lg">{item.drug_name}</h3>
            </div>
            <p className="text-white/70 text-sm mt-1">Seria: {item.batch_number}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-white/80 text-xs">
                Ważność: {new Date(item.expiry_date).toLocaleDateString('pl-PL')}
              </p>
              {daysUntilExpiryNum >= 0 && daysUntilExpiryNum < 30 && (
                <span className="text-orange-300 text-xs font-bold">
                  ({daysUntilExpiryNum} dni)
                </span>
              )}
            </div>
            {item.is_controlled && (
              <span className="inline-block mt-2 text-xs bg-red-500/30 text-red-300 px-2 py-0.5 rounded">
                Wymaga KZW
              </span>
            )}
          </div>
          
          <div className="text-right">
            <div className="flex items-center gap-3">
              <button
                onClick={handleUse}
                disabled={loading || item.quantity === 0}
                className="bg-red-600 hover:bg-red-700 w-10 h-10 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center font-bold text-xl"
              >
                <Minus size={20} />
              </button>
              
              <span className="text-white font-bold text-3xl min-w-[50px]">
                {item.quantity}
              </span>
              
              <button
                onClick={handleRefill}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 w-10 h-10 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center font-bold text-xl"
              >
                <Plus size={20} />
              </button>
            </div>
            {item.quantity <= item.min_quantity && item.quantity > 0 && (
              <p className="text-orange-300 text-xs mt-1">
                Min: {item.min_quantity}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal KZW dla leków kontrolowanych */}
      {showKZW && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Lek kontrolowany</h3>
            <p className="text-slate-300 mb-4">
              Podaj numer KZW dla leku: <strong>{item.drug_name}</strong>
            </p>
            <input
              type="text"
              id="kzwInput"
              placeholder="Numer KZW"
              className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const input = document.getElementById('kzwInput') as HTMLInputElement
                  if (input.value) {
                    performUse(input.value)
                  } else {
                    alert('Podaj numer KZW')
                  }
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-bold"
              >
                Potwierdź użycie
              </button>
              <button
                onClick={() => setShowKZW(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg font-bold"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}