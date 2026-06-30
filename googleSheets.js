const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { CONFIG } = require("./config");
const { listarLeads } = require("./leadsRepository");

function arquivoExiste(caminho) {
  return fs.existsSync(caminho);
}

function criarAuthGoogle() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  if (!arquivoExiste(CONFIG.credentialsFile)) {
    throw new Error(`Credencial do Google não encontrada: ${CONFIG.credentialsFile}`);
  }

  return new google.auth.GoogleAuth({
    keyFile: CONFIG.credentialsFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function criarClienteGoogleSheets() {
  const auth = criarAuthGoogle();
  return google.sheets({
    version: "v4",
    auth,
  });
}

async function sincronizarPlanilha() {
  const sheets = await criarClienteGoogleSheets();
  const leads = await listarLeads();

  for (const cidade of CONFIG.cidades) {
    const leadsCidade = leads.filter((lead) => lead.cidade === cidade);
    const linhas = [
      ["Prioridade", "Empresa", "Contato", "Status de Contato", "Observações"],
      ...leadsCidade.map((lead) => [
        lead.prioridade,
        lead.empresa,
        lead.contato,
        lead.status,
        lead.observacoes || "",
      ]),
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${cidade}!A1:E${linhas.length}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: linhas,
      },
    });

    await sheets.spreadsheets.values.clear({
      spreadsheetId: CONFIG.spreadsheetId,
      range: `${cidade}!A${linhas.length + 1}:E1000`,
    });

    console.log(`Aba ${cidade} sincronizada.`);
  }

  console.log("Sincronização concluída!");
}

module.exports = {
  criarClienteGoogleSheets,
  sincronizarPlanilha,
};
