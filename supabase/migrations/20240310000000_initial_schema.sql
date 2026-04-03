-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums with existence check
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ratownik', 'koordynator', 'admin');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'action_type') THEN
        CREATE TYPE action_type AS ENUM ('usage', 'refill', 'initial_load');
    END IF;
END $$;

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role DEFAULT 'ratownik',
  license_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  qr_token TEXT UNIQUE NOT NULL,
  coordinator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory table
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  gtin TEXT NOT NULL,
  drug_name TEXT,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 5,
  is_controlled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, gtin, batch_number)
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  action action_type NOT NULL,
  kzw_number TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_inventory_team_id ON inventory(team_id);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry_date ON inventory(expiry_date);
CREATE INDEX IF NOT EXISTS idx_audit_logs_team_id ON audit_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_teams_qr_token ON teams(qr_token);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DO $$ 
BEGIN
    -- Profiles policies
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    
    -- Teams policies
    DROP POLICY IF EXISTS "Users can view their teams" ON teams;
    DROP POLICY IF EXISTS "Coordinators can insert teams" ON teams;
    DROP POLICY IF EXISTS "Coordinators can update own teams" ON teams;
    
    -- Inventory policies
    DROP POLICY IF EXISTS "Users can view inventory of their team" ON inventory;
    DROP POLICY IF EXISTS "Coordinators can manage inventory" ON inventory;
    
    -- Audit logs policies
    DROP POLICY IF EXISTS "Users can view logs of their team" ON audit_logs;
    DROP POLICY IF EXISTS "Users can insert logs" ON audit_logs;
END $$;

-- Create fresh policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can view their teams"
  ON teams FOR SELECT
  USING (
    coordinator_id = auth.uid() OR
    EXISTS (SELECT 1 FROM inventory WHERE inventory.team_id = teams.id)
  );

CREATE POLICY "Coordinators can insert teams"
  ON teams FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('koordynator', 'admin'))
  );

CREATE POLICY "Coordinators can update own teams"
  ON teams FOR UPDATE
  USING (coordinator_id = auth.uid());

CREATE POLICY "Users can view inventory of their team"
  ON inventory FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = inventory.team_id AND (
      teams.coordinator_id = auth.uid() OR
      EXISTS (SELECT 1 FROM audit_logs WHERE audit_logs.team_id = inventory.team_id)
    ))
  );

CREATE POLICY "Coordinators can manage inventory"
  ON inventory FOR ALL
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = inventory.team_id AND teams.coordinator_id = auth.uid())
  );

CREATE POLICY "Users can view logs of their team"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = audit_logs.team_id AND (
      teams.coordinator_id = auth.uid() OR
      audit_logs.user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert logs"
  ON audit_logs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = audit_logs.team_id)
  );

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
  BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();