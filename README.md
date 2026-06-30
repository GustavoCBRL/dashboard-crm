# Dashboard CRM Dismobile

Aplicação Node.js para gerenciar leads comerciais da Dismobile em uma planilha local (`leads.xlsx`), visualizar indicadores em um dashboard web e sincronizar os dados com o Google Sheets.

## Funcionalidades

- Dashboard web com métricas de leads, contatos, catálogos enviados, follow ups, fechados e perdidos.
- Cadastro manual de leads pela interface web.
- Importação de contatos em lote via arquivo JSON.
- Filtros por cidade, status e busca textual.
- Controle de prioridade dos leads: `A`, `B` e `C`.
- Criação automática de hyperlinks de WhatsApp nos contatos da planilha local.
- Backup local da planilha antes de cada gravação.
- Sincronização da planilha local com abas no Google Sheets.
- Comandos CLI para criar planilha, consultar resultados, adicionar contatos e sincronizar.

## Tecnologias

- Node.js
- Express
- ExcelJS
- Google Sheets API (`googleapis`)
- HTML, CSS e JavaScript puro no front-end

## Estrutura principal

```text
.
├── index.js              # Regras principais, CLI, Excel e Google Sheets
├── server.js             # API Express e servidor da interface web
├── public/
│   ├── index.html        # Tela do dashboard
│   ├── app.js            # Lógica do front-end
│   └── styles.css        # Estilos da interface
├── arquivos_json/        # Exemplos/arquivos de importação JSON
├── package.json
└── .gitignore
```

## Pré-requisitos

- Node.js instalado.
- Uma credencial de Service Account do Google com acesso à planilha desejada.
- A planilha do Google Sheets precisa ter abas com os mesmos nomes configurados em `CIDADES`.

## Instalação

Clone o projeto e instale as dependências:

```bash
git clone https://github.com/GustavoCBRL/dashboard-crm-dismobile.git
cd dashboard-crm-dismobile
npm install
```

## Configuração

A aplicação pode ser configurada por variáveis de ambiente:

```bash
export SPREADSHEET_ID="id-da-sua-planilha-google"
export GOOGLE_CREDENTIALS="/caminho/para/credencial-google.json"
export LEADS_FILE="./leads.xlsx"
export CIDADES="Aracaju,Salvador,Brasília"
```

Variáveis disponíveis:

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `SPREADSHEET_ID` | ID da planilha do Google Sheets | ID definido no código |
| `GOOGLE_CREDENTIALS` | Caminho do JSON da Service Account | `./contatos-dismobile-498515-5250939c30a8.json` |
| `LEADS_FILE` | Caminho da planilha Excel local | `./leads.xlsx` |
| `CIDADES` | Lista de cidades/abas separadas por vírgula | `Aracaju,Salvador,Brasília` |
| `PORT` | Porta do servidor web | `3000` |

Importante: arquivos de credenciais, `.env`, `leads.xlsx`, backups e `node_modules` são ignorados pelo Git.

## Uso pela interface web

Inicie o servidor:

```bash
npm run gui
```

Acesse no navegador:

```text
http://localhost:3000
```

Na interface é possível:

- acompanhar indicadores do funil comercial;
- filtrar leads;
- cadastrar um novo lead;
- importar contatos via JSON;
- sincronizar a planilha local com o Google Sheets.

## Uso pelo terminal

### Ver ajuda

```bash
npm run ajuda
```

### Criar a planilha local

```bash
node index.js criar-planilha
```

### Consultar resultados

```bash
npm run resultados
```

### Sincronizar com Google Sheets

```bash
npm run sincronizar
```

### Rodar consulta de resultados e sincronização

```bash
npm start
```

### Adicionar um contato

```bash
node index.js adicionar-contato '{"cidade":"Salvador","prioridade":"A","empresa":"Empresa X","contato":"71999999999","status":"Novo","observacoes":"Lead novo"}'
```

### Adicionar contatos via JSON

```bash
node index.js adicionar-contatos-json ./arquivos_json/salvador.json
```

O arquivo JSON pode ser uma lista direta:

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

A aplicação trabalha com os seguintes status:

- `Novo`
- `Contato`
- `Catálogo`
- `Follow Up`
- `Fechado`
- `Perdido`

## Segurança e dados sensíveis

Não versionar:

- arquivos `.env`;
- JSON de credenciais do Google;
- planilhas com dados reais de leads;
- backups locais;
- `node_modules`.

Esses itens já estão protegidos no `.gitignore`.

## Licença

Projeto privado/de uso interno da Dismobile.
