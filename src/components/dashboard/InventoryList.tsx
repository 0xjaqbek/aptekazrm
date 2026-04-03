'use client'

import { InventoryItem } from './InventoryItem'

interface InventoryItemType {
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

interface InventoryListProps {
  inventory: InventoryItemType[]
  onUpdate: () => void
}

export function InventoryList({ inventory, onUpdate }: InventoryListProps) {
  if (inventory.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-slate-400 mb-2">Brak leków w karetce</div>
        <p className="text-slate-500 text-sm">
          Uzupełnij leki używając przycisku &quot;+&quot; lub dodaj nowe przez skanowanie
        </p>
      </div>
    )
  }

  // Sortuj po dacie ważności (najkrótsze na górze)
  const sortedInventory = [...inventory].sort((a, b) => 
    new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
  )

  return (
    <div className="space-y-3">
      {sortedInventory.map((item) => (
        <InventoryItem key={item.id} item={item} onUpdate={onUpdate} />
      ))}
    </div>
  )
}