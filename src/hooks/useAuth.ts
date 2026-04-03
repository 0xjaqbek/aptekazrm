import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase/client'
import { useAppStore } from '../lib/store'
import { User } from '@supabase/supabase-js'

export function useAuth() {
  const [loading, setLoading] = useState(true)
  const { setUser } = useAppStore()
  const supabase = createClient()

  useEffect(() => {
    // Pobierz aktualną sesję
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchUserProfile(session.user)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    // Nasłuchuj zmian w auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchUserProfile(session.user)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserProfile(supabaseUser: User) {
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', supabaseUser.id)
      .single()
    
    if (profile) {
      setUser({
        id: supabaseUser.id,
        email: supabaseUser.email!,
        full_name: profile.full_name,
        role: profile.role,
      })
    }
    setLoading(false)
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  return { loading, signOut }
}