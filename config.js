require("dotenv").config({ quiet: true });

const STATUS = ["Novo", "Contato", "Catálogo", "Follow Up", "Fechado", "Perdido"];
const PRIORIDADES = ["A", "B", "C"];

const CONFIG = {
  spreadsheetId:
    process.env.SPREADSHEET_ID || "1Aa6Zoc1-kIxjCEfUuYdaSjfWKiRBMWbva_srV1MxRaY",
  credentialsFile:
    process.env.GOOGLE_CREDENTIALS ||
    require("path").resolve(__dirname, "contatos-dismobile-498515-5250939c30a8.json"),
  leadsFile: process.env.LEADS_FILE || require("path").resolve(__dirname, "leads.xlsx"),
  cidades: (process.env.CIDADES || "Aracaju,Salvador,Brasília")
    .split(",")
    .map((cidade) => cidade.trim())
    .filter(Boolean),
};

module.exports = {
  CONFIG,
  PRIORIDADES,
  STATUS,
};
