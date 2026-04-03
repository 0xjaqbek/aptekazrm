export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: 'ratownik' | 'koordynator' | 'admin'
          license_number: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role?: 'ratownik' | 'koordynator' | 'admin'
          license_number?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      teams: {
        Row: {
          id: string
          name: string
          qr_token: string
          coordinator_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          qr_token: string
          coordinator_id?: string | null
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['teams']['Insert']>
      }
      inventory: {
        Row: {
          id: string
          team_id: string
          gtin: string
          drug_name: string | null
          batch_number: string
          expiry_date: string
          quantity: number
          min_quantity: number
          is_controlled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          gtin: string
          drug_name?: string | null
          batch_number: string
          expiry_date: string
          quantity?: number
          min_quantity?: number
          is_controlled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          team_id: string
          action: 'usage' | 'refill' | 'initial_load'
          kzw_number: string | null
          metadata: any
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          team_id: string
          action: 'usage' | 'refill' | 'initial_load'
          kzw_number?: string | null
          metadata?: any
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>
      }
    }
  }
}