require("dotenv").config({ quiet: true });

const STATUS = ["Novo", "Contato", "Catálogo", "Follow Up", "Fechado", "Perdido"];
const PRIORIDADES = ["A", "B", "C"];

const CONFIG = {
  spreadsheetId: process.env.SPREADSHEET_ID || "",
  credentialsFile: process.env.GOOGLE_CREDENTIALS || "",
  leadsFile: process.env.LEADS_FILE || require("path").resolve(__dirname, "leads.xlsx"),
  cidades: (process.env.CIDADES || "Aracaju,Salvador,Brasília,Camaçari")
    .split(",")
    .map((cidade) => cidade.trim())
    .filter(Boolean),
};

module.exports = {
  CONFIG,
  PRIORIDADES,
  STATUS,
};
