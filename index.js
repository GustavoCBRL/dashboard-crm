const fs = require("fs");
const path = require("path");
const { CONFIG, PRIORIDADES, STATUS } = require("./config");
const {
  adicionarContato,
  atualizarLead,
  listarLeads,
  obterResultados,
  deletarLead,
} = require("./leadsRepository");
const { sincronizarPlanilha } = require("./googleSheets");

function arquivoExiste(caminho) {
  return fs.existsSync(caminho);
}

function lerContatosJson(arquivoJson) {
  const caminho = path.resolve(process.cwd(), arquivoJson);

  if (!arquivoExiste(caminho)) {
    throw new Error(`Arquivo JSON não encontrado: ${caminho}`);
  }

  const conteudo = fs.readFileSync(caminho, "utf8");
  const dados = JSON.parse(conteudo);
  const contatos = Array.isArray(dados) ? dados : dados.contatos;

  if (!Array.isArray(contatos)) {
    throw new Error(
      'O JSON precisa ser uma lista ou ter a chave "contatos" com uma lista.',
    );
  }

  return contatos;
}

async function consultarPlanilhaResultados() {
  const resultados = await obterResultados();

  console.log(`
Resultados:
  - Contatos: ${resultados.contatos};
  - Números a revisar: ${resultados.reverContatos};
  - Catálogos Enviados: ${resultados.catalogos};
  - Follow Ups Realizados: ${resultados.followUps};
  - Negócios Fechados: ${resultados.fechados};
  - Negócios Perdidos: ${resultados.perdidos};
`);

  console.log("Resultados por cidade:");
  for (const [cidade, parcial] of Object.entries(resultados.porCidade)) {
    console.log(
      `  - ${cidade}: ${parcial.contatos} contatos, ${parcial.reverContatos} números a revisar, ${parcial.catalogos} catálogos, ${parcial.followUps} follow ups, ${parcial.fechados} fechados, ${parcial.perdidos} perdidos`,
    );
  }
}

function mostrarAjuda() {
  console.log(`
Uso:
  node index.js
  node index.js resultados
  node index.js sincronizar
  node index.js adicionar-contato '{"cidade":"Salvador","prioridade":"A","empresa":"Empresa X","contato":"71999999999","status":"Novo","observacoes":"Lead novo"}'
  node index.js adicionar-contatos-json ./contatos.json

Migração do Excel atual para PostgreSQL:
  npm run db:migrate
  npm run import:xlsx

Configuração por ambiente:
  DATABASE_URL=postgresql://usuario:senha@host:porta/database
  SPREADSHEET_ID=...
  GOOGLE_CREDENTIALS=./arquivo-google.json
  GOOGLE_CREDENTIALS_JSON='{"type":"service_account",...}'
  CIDADES=Aracaju,Salvador,Brasília,Camaçari,Recife,Fortaleza
`);
}

async function main() {
  const [comando = "rodar", ...args] = process.argv.slice(2);

  switch (comando) {
    case "rodar":
      await consultarPlanilhaResultados();
      await sincronizarPlanilha();
      break;
    case "resultados":
      await consultarPlanilhaResultados();
      break;
    case "sincronizar":
      await sincronizarPlanilha();
      break;
    case "adicionar-contato": {
      const [json] = args;
      if (!json) {
        throw new Error("Informe os dados do contato em JSON.");
      }
      await adicionarContato(JSON.parse(json));
      break;
    }
    case "adicionar-contatos-json": {
      const [arquivoJson] = args;
      if (!arquivoJson) {
        throw new Error(
          "Informe o caminho do arquivo JSON com a lista de contatos.",
        );
      }
      const contatos = lerContatosJson(arquivoJson);
      await adicionarContato(contatos);
      break;
    }
    case "ajuda":
    case "--help":
    case "-h":
      mostrarAjuda();
      break;
    default:
      throw new Error(`Comando desconhecido: ${comando}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Erro: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIG,
  STATUS,
  PRIORIDADES,
  adicionarContato,
  atualizarLead,
  consultarPlanilhaResultados,
  lerContatosJson,
  listarLeads,
  obterResultados,
  sincronizarPlanilha,
};
