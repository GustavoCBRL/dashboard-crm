CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  cidade VARCHAR(100) NOT NULL,
  prioridade VARCHAR(1) NOT NULL CHECK (prioridade IN ('A', 'B', 'C')),
  empresa VARCHAR(255) NOT NULL,
  contato VARCHAR(30) DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'Novo'
    CHECK (status IN ('Novo', 'Contato', 'Catálogo', 'Follow Up', 'Fechado', 'Perdido')),
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS leads_cidade_empresa_unique
ON leads (LOWER(cidade), LOWER(empresa));

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_set_updated_at ON leads;
CREATE TRIGGER leads_set_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
