'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../src/lib/supabase/client'
import { useAppStore } from '../../../src/lib/store'
import QRCode from 'react-qr-code'

export default function CreateTeamPage() {
  const [teamName, setTeamName] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdTeam, setCreatedTeam] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()
  const { user } = useAppStore()

  const generateQRToken = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15)
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const qrToken = generateQRToken()
    
    const { data, error } = await supabase
      .from('teams')
      .insert({
        name: teamName,
        qr_token: qrToken,
        coordinator_id: user?.id,
      })
      .select()
      .single()

    if (error) {
      alert('Błąd tworzenia zespołu: ' + error.message)
    } else {
      setCreatedTeam(data)
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Utwórz nowy zespół</h1>

        {!createdTeam ? (
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Nazwa zespołu (np. S01 Kościerzyna)
              </label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg"
            >
              {loading ? 'Tworzenie...' : 'Utwórz zespół'}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <div className="bg-white p-6 rounded-2xl inline-block mb-6">
              <QRCode value={createdTeam.qr_token} size={200} style={{ margin: '0 auto' }} />
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">
              Kod QR dla zespołu {createdTeam.name}
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              Wydrukuj ten kod i umieść go w karetce. Ratownicy zeskanują go aby dołączyć do zespołu.
            </p>
            
            <button
              onClick={() => window.print()}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg mb-3"
            >
              Drukuj kod QR
            </button>
            
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg"
            >
              Przejdź do dashboardu
            </button>
          </div>
        )}
      </div>
    </div>
  )
}