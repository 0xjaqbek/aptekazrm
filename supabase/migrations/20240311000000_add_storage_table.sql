-- Tabela zapasów (szafa główna)
CREATE TABLE IF NOT EXISTS storage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  gtin TEXT NOT NULL,
  drug_name TEXT,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, gtin, batch_number)
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_storage_team_id ON storage(team_id);
CREATE INDEX IF NOT EXISTS idx_storage_expiry_date ON storage(expiry_date);

-- Trigger dla updated_at
DROP TRIGGER IF EXISTS update_storage_updated_at ON storage;
CREATE TRIGGER update_storage_updated_at
  BEFORE UPDATE ON storage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS dla storage
ALTER TABLE storage ENABLE ROW LEVEL SECURITY;

-- Polityki
DROP POLICY IF EXISTS "Users can view storage of their team" ON storage;
CREATE POLICY "Users can view storage of their team"
  ON storage FOR SELECT
  USING (team_id IN (SELECT id FROM teams WHERE coordinator_id = auth.uid()));

DROP POLICY IF EXISTS "Coordinators can manage storage" ON storage;
CREATE POLICY "Coordinators can manage storage"
  ON storage FOR ALL
  USING (team_id IN (SELECT id FROM teams WHERE coordinator_id = auth.uid()));

-- Przenieś istniejące leki do storage jako zapas (opcjonalnie)
INSERT INTO storage (team_id, gtin, drug_name, batch_number, expiry_date, quantity)
SELECT team_id, gtin, drug_name, batch_number, expiry_date, 20
FROM inventory
WHERE team_id IN (SELECT id FROM teams)
ON CONFLICT (team_id, gtin, batch_number) DO NOTHING;