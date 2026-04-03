import { openDB, IDBPDatabase } from 'idb'

let dbInstance: IDBPDatabase | null = null

export async function initOfflineDB() {
  if (dbInstance) return dbInstance
  
  dbInstance = await openDB('medstock-offline', 1, {
    upgrade(db) {
      // Store dla inventory
      if (!db.objectStoreNames.contains('inventory')) {
        const inventoryStore = db.createObjectStore('inventory', { keyPath: 'id' })
        inventoryStore.createIndex('team_id', 'team_id')
      }
      
      // Store dla queue
      if (!db.objectStoreNames.contains('syncQueue')) {
        const queueStore = db.createObjectStore('syncQueue', { 
          keyPath: 'id', 
          autoIncrement: true 
        })
        queueStore.createIndex('synced', 'synced')
      }
      
      // Store dla teams
      if (!db.objectStoreNames.contains('teams')) {
        db.createObjectStore('teams', { keyPath: 'id' })
      }
    },
  })
  
  return dbInstance
}

export async function saveInventoryOffline(teamId: string, inventory: any[]) {
  const db = await initOfflineDB()
  const tx = db.transaction('inventory', 'readwrite')
  
  // Usuń stare dane dla tego teamu
  const index = tx.store.index('team_id')
  let cursor = await index.openCursor(IDBKeyRange.only(teamId))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  
  // Zapisz nowe
  for (const item of inventory) {
    await tx.store.put({ ...item, team_id: teamId })
  }
  
  await tx.done
}

export async function getInventoryOffline(teamId: string) {
  const db = await initOfflineDB()
  const items = await db.getAllFromIndex('inventory', 'team_id', teamId)
  return items
}

export async function addToSyncQueue(action: any) {
  const db = await initOfflineDB()
  await db.add('syncQueue', {
    ...action,
    synced: false,
    created_at: new Date().toISOString()
  })
}

export async function getPendingSync() {
  const db = await initOfflineDB()
  // Poprawione: użyj IDBKeyRange zamiast false
  const range = IDBKeyRange.only(false)
  return await db.getAllFromIndex('syncQueue', 'synced', range)
}

export async function markAsSynced(id: number) {
  const db = await initOfflineDB()
  const item = await db.get('syncQueue', id)
  if (item) {
    item.synced = true
    await db.put('syncQueue', item)
  }
}

// Dodatkowa funkcja do czyszczenia starej kolejki
export async function clearSyncedQueue() {
  const db = await initOfflineDB()
  const pending = await getPendingSync()
  
  const tx = db.transaction('syncQueue', 'readwrite')
  for (const item of pending) {
    if (item.synced) {
      await tx.store.delete(item.id)
    }
  }
  await tx.done
}