'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../src/lib/supabase/client'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // 1. Rejestracja w Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (authData.user) {
        // 2. Próba utworzenia profilu z retry
        let retries = 3
        let profileCreated = false
        
        while (retries > 0 && !profileCreated) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              full_name: fullName,
              license_number: licenseNumber || null,
              role: 'ratownik',
            })
            .select()
            .single()

          if (!profileError) {
            profileCreated = true
            break
          }
          
          console.error(`Profile creation failed (${retries} retries left):`, profileError)
          retries--
          
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)) // Czekaj 1 sek
          } else {
            // Jeśli profil nie został utworzony, spróbuj przez funkcję SQL
            const { error: functionError } = await supabase.rpc('create_profile', {
              user_id: authData.user.id,
              user_full_name: fullName,
              user_role: 'ratownik'
            })
            
            if (functionError) {
              setError('Konto utworzone, ale wystąpił problem z profilem. Skontaktuj się z administratorem.')
            } else {
              profileCreated = true
            }
          }
        }
        
        if (profileCreated) {
          router.push('/dashboard')
        }
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError('Wystąpił nieoczekiwany błąd. Spróbuj ponownie.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Rejestracja</h1>
          <p className="text-slate-400 mt-2">Utwórz nowe konto</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Imię i nazwisko
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Hasło
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Numer prawa wykonywania zawodu (opcjonalnie)
              </label>
              <input
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Rejestracja...' : (
                <>
                  <UserPlus size={18} />
                  Zarejestruj się
                </>
              )}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-6">
            Masz już konto?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              Zaloguj się
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}