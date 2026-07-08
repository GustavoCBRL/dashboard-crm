# Dashboard CRM

Aplicação Node.js/Express para gerenciar leads comerciais da Dismobile com dashboard web, PostgreSQL como banco principal e sincronização opcional com Google Sheets.

## Funcionalidades

- Dashboard web com métricas de leads, contatos, catálogos enviados, follow ups, fechados e perdidos.
- Cadastro manual de leads pela interface web.
- Importação de contatos em lote via arquivo JSON.
- Filtros por cidade, status e busca textual.
- Controle de prioridade dos leads: `A`, `B` e `C`.
- Persistência em PostgreSQL, ideal para Railway.
- Migração do arquivo local `leads.xlsx` para PostgreSQL.
- Sincronização opcional do banco PostgreSQL para abas no Google Sheets.

## Tecnologias

- Node.js
- Express
- PostgreSQL
- pg
- dotenv
- ExcelJS, usado somente para importar a planilha legada
- Google Sheets API (`googleapis`)
- HTML, CSS e JavaScript puro no front-end

## Estrutura principal

```text
.
├── config.js                         # Configurações e constantes
├── db.js                             # Conexão PostgreSQL
├── index.js                          # CLI principal
├── leadsRepository.js                # Consultas e gravações de leads no PostgreSQL
├── googleSheets.js                   # Sincronização PostgreSQL -> Google Sheets
├── migrate.js                        # Executor de migrations SQL
├── migrations/
│   └── 001_create_leads.sql          # Schema inicial do banco
├── scripts/
│   └── import-xlsx-to-postgres.js    # Migração do leads.xlsx para PostgreSQL
├── server.js                         # API Express e servidor da interface web
├── public/
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── package.json
└── .gitignore
```

## Pré-requisitos

- Node.js instalado.
- PostgreSQL disponível localmente ou em produção, como Railway PostgreSQL.
- Variável `DATABASE_URL` configurada.
- Opcional: Service Account do Google para sincronizar com Google Sheets.

## Instalação

```bash
git clone https://github.com/GustavoCBRL/dashboard-crm-dismobile.git
cd dashboard-crm-dismobile
npm install
```

## Configuração

Crie um arquivo `.env` local, ou configure as variáveis diretamente no ambiente/Railway.

Exemplo:

```bash
DATABASE_URL="postgresql://usuario:senha@host:5432/banco"
PGSSLMODE="disable"
CIDADES="Aracaju,Salvador,Brasília, Camaçari,Recife"
PORT="3000"

# Opcional para sincronização com Google Sheets
SPREADSHEET_ID="id-da-sua-planilha-google"
GOOGLE_CREDENTIALS="./credencial-google.json"
# ou, em produção:
# GOOGLE_CREDENTIALS_JSON='{"type":"service_account",...}'
```

Variáveis disponíveis:

| Variável                  | Descrição                                                | Obrigatória                       |
| ------------------------- | -------------------------------------------------------- | --------------------------------- |
| `DATABASE_URL`            | URL de conexão PostgreSQL                                | Sim                               |
| `PGSSLMODE`               | Use `disable` para PostgreSQL local sem SSL              | Não                               |
| `CIDADES`                 | Lista de cidades/abas separadas por vírgula              | Não                               |
| `PORT`                    | Porta do servidor web                                    | Não                               |
| `SPREADSHEET_ID`          | ID da planilha do Google Sheets                          | Só para sincronização             |
| `GOOGLE_CREDENTIALS`      | Caminho do JSON da Service Account                       | Só para sincronização local       |
| `GOOGLE_CREDENTIALS_JSON` | Conteúdo JSON da Service Account em variável de ambiente | Só para sincronização em produção |

## Banco de dados

A tabela principal é `leads`:

```sql
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  cidade VARCHAR(100) NOT NULL,
  prioridade VARCHAR(1) NOT NULL,
  empresa VARCHAR(255) NOT NULL,
  contato VARCHAR(30) DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'Novo',
  observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Também existe um índice único por cidade + empresa para evitar duplicidade:

```sql
CREATE UNIQUE INDEX leads_cidade_empresa_unique
ON leads (LOWER(cidade), LOWER(empresa));
```

## Criar/atualizar o schema

Com `DATABASE_URL` configurada:

```bash
npm run db:migrate
```

## Migrar dados do Excel local para PostgreSQL

Antes de gravar no banco, confira quantos leads serão importados:

```bash
npm run import:xlsx:dry-run
```

Para importar de fato:

```bash
npm run import:xlsx
```

O script lê `leads.xlsx`, cria/aplica a migration se necessário e insere os leads no PostgreSQL. Duplicados por cidade + empresa são ignorados.

A planilha `leads.xlsx` é tratada como dado local/sensível e não deve ser versionada. Para demonstrações públicas, use apenas dados fictícios.

## Uso pela interface web

```bash
npm start
```

ou:

```bash
npm run gui
```

Acesse:

```text
http://localhost:3000
```

Na interface é possível:

- acompanhar indicadores do funil comercial;
- filtrar leads;
- cadastrar um novo lead;
- importar contatos via JSON;
- sincronizar dados do PostgreSQL com o Google Sheets.

## Uso pelo terminal

### Ver ajuda

```bash
npm run ajuda
```

### Consultar resultados

```bash
npm run resultados
```

### Sincronizar PostgreSQL com Google Sheets

```bash
npm run sincronizar
```

### Adicionar um contato

```bash
node index.js adicionar-contato '{"cidade":"Salvador","prioridade":"A","empresa":"Empresa X","contato":"71999999999","status":"Novo","observacoes":"Lead novo"}'
```

### Adicionar contatos via JSON

```bash
node index.js adicionar-contatos-json ./arquivos_json/exemplo.json
```

O JSON pode ser uma lista direta:

```json
[
  {
    "cidade": "Salvador",
    "prioridade": "A",
    "empresa": "Empresa X",
    "contato": "71999999999",
    "status": "Novo",
    "observacoes": "Lead novo"
  }
]
```

Ou um objeto com a chave `contatos`:

```json
{
  "contatos": [
    {
      "cidade": "Salvador",
      "prioridade": "A",
      "empresa": "Empresa X",
      "contato": "71999999999",
      "status": "Novo",
      "observacoes": "Lead novo"
    }
  ]
}
```

## Status dos leads

- `Novo`
- `Contato`
- `Catálogo`
- `Follow Up`
- `Fechado`
- `Perdido`

## Deploy no Railway

1. Suba o projeto para o GitHub.
2. Crie um novo projeto no Railway a partir do repositório.
3. Adicione um serviço PostgreSQL no Railway.
4. Confirme que o serviço da aplicação recebeu a variável `DATABASE_URL`.
5. Configure, se necessário:

```text
CIDADES=Aracaju,Salvador,Brasília,Camaçari,Recife
NODE_ENV=production
GOOGLE_CREDENTIALS_JSON={...}
SPREADSHEET_ID=...
```

6. Execute a migration/importação uma vez:

```bash
npm run db:migrate
npm run import:xlsx
```

7. O comando de start do Railway pode ser:

```bash
npm start
```

## Segurança e dados sensíveis

Não versionar:

- arquivos `.env`;
- JSON de credenciais do Google;
- IDs reais de planilhas Google no código;
- planilhas com dados reais de leads;
- arquivos JSON de importação com contatos reais;
- backups locais;
- `node_modules`.

Esses itens estão protegidos no `.gitignore`. O arquivo `arquivos_json/exemplo.json` contém apenas dados fictícios para documentação e testes manuais.
