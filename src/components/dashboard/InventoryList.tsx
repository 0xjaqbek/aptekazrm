'use client'

import { differenceInDays } from 'date-fns'
import { AlertTriangle, CheckCircle, XCircle, Package } from 'lucide-react'

interface InventoryItem {
  id: string
  gtin: string
  drug_name: string | null
  batch_number: string
  expiry_date: string
  quantity: number
  min_quantity: number
}

interface InventoryListProps {
  inventory: InventoryItem[]
}

export function InventoryList({ inventory }: InventoryListProps) {
  const getStatus = (expiryDate: string, quantity: number, minQuantity: number) => {
    const daysUntilExpiry = differenceInDays(new Date(expiryDate), new Date())
    
    if (daysUntilExpiry < 0) return 'expired'
    if (quantity === 0) return 'empty'
    if (daysUntilExpiry < 30 || quantity <= minQuantity) return 'warning'
    return 'good'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired':
        return 'bg-red-500 border-red-600'
      case 'empty':
        return 'bg-red-700 border-red-800'
      case 'warning':
        return 'bg-orange-500 border-orange-600'
      default:
        return 'bg-green-500/20 border-green-500/30'
    }
  }

  const getStatusIcon = (status: string) => {
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

  if (inventory.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">Brak leków w magazynie</p>
        <p className="text-slate-500 text-sm">Skanuj leki aby dodać je do systemu</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {inventory.map((item) => {
        const status = getStatus(item.expiry_date, item.quantity, item.min_quantity)
        const daysUntilExpiry = differenceInDays(new Date(item.expiry_date), new Date())
        
        return (
          <div
            key={item.id}
            className={`border rounded-xl p-4 ${getStatusColor(status)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-white text-lg">
                  {item.drug_name || `GTIN: ${item.gtin.slice(-8)}`}
                </h3>
                <p className="text-white/70 text-sm mt-1">
                  Seria: {item.batch_number}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-white/80 text-sm">
                    Ważność: {new Date(item.expiry_date).toLocaleDateString('pl-PL')}
                  </p>
                  {daysUntilExpiry >= 0 && daysUntilExpiry < 30 && (
                    <span className="text-orange-300 text-xs font-bold">
                      ({daysUntilExpiry} dni)
                    </span>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center gap-2">
                  {getStatusIcon(status)}
                  <span className="text-white font-bold text-2xl">
                    {item.quantity}
                  </span>
                </div>
                {item.quantity <= item.min_quantity && item.quantity > 0 && (
                  <p className="text-orange-300 text-xs mt-1">
                    Min: {item.min_quantity}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}