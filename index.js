const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { google } = require("googleapis");

const CONFIG = {
  spreadsheetId:
    process.env.SPREADSHEET_ID || "1Aa6Zoc1-kIxjCEfUuYdaSjfWKiRBMWbva_srV1MxRaY",
  credentialsFile:
    process.env.GOOGLE_CREDENTIALS ||
    path.resolve(__dirname, "contatos-dismobile-498515-5250939c30a8.json"),
  leadsFile: process.env.LEADS_FILE || path.resolve(__dirname, "leads.xlsx"),
  cidades: (process.env.CIDADES || "Aracaju,Salvador,Brasília")
    .split(",")
    .map((cidade) => cidade.trim())
    .filter(Boolean),
};

const STATUS = ["Novo", "Contato", "Catálogo", "Follow Up", "Fechado", "Perdido"];
const PRIORIDADES = ["A", "B", "C"];

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function normalizarTelefone(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function arquivoExiste(caminho) {
  return fs.existsSync(caminho);
}

function criarBackupLocal(arquivo) {
  if (!arquivoExiste(arquivo)) return null;

  const pastaBackup = path.resolve(path.dirname(arquivo), "backups");
  fs.mkdirSync(pastaBackup, { recursive: true });

  const agora = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "")
    .replace("T", "-");
  const destino = path.join(pastaBackup, `leads-${agora}.xlsx`);

  fs.copyFileSync(arquivo, destino);
  return destino;
}

function acharLinhaVazia(sheet) {
  let linha = 2;

  while (linha <= sheet.rowCount + 1) {
    const empresa = sheet.getCell(`B${linha}`).value;

    if (!empresa) {
      return linha;
    }

    linha += 1;
  }

  return sheet.rowCount + 1;
}

function limparValor(valor) {
  if (valor === null || valor === undefined) return "";

  if (typeof valor === "object") {
    if (valor.text) return valor.text;
    if (valor.result) return valor.result;
    if (valor.richText) return valor.richText.map((item) => item.text).join("");
    if (valor.hyperlink && valor.text) return valor.text;
    return "";
  }

  return valor;
}

async function lerWorkbook() {
  if (!arquivoExiste(CONFIG.leadsFile)) {
    throw new Error(`Arquivo não encontrado: ${CONFIG.leadsFile}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(CONFIG.leadsFile);
  return workbook;
}

async function salvarWorkbook(workbook) {
  const backup = criarBackupLocal(CONFIG.leadsFile);
  await workbook.xlsx.writeFile(CONFIG.leadsFile);

  if (backup) {
    console.log(`Backup local criado: ${backup}`);
  }
}

function aplicarEstiloCabecalho(sheet) {
  const titulo = sheet.getRow(1);

  titulo.font = {
    bold: true,
    size: 14,
    color: { argb: "FFFFFF" },
  };

  titulo.alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  titulo.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "1F4E78" },
  };

  titulo.height = 25;
}

function aplicarValidacoes(sheet, ateLinha = 300) {
  for (let i = 2; i <= ateLinha; i += 1) {
    sheet.getCell(`A${i}`).dataValidation = {
      type: "list",
      allowBlank: false,
      formulae: [`"${PRIORIDADES.join(",")}"`],
    };

    sheet.getCell(`D${i}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${STATUS.join(", ")}"`],
    };
  }
}

async function criarPlanilha() {
  const workbook = new ExcelJS.Workbook();

  CONFIG.cidades.forEach((cidade) => {
    const sheet = workbook.addWorksheet(cidade);

    sheet.columns = [
      { header: "Prioridade", key: "prioridade", width: 15 },
      { header: "Empresa", key: "empresa", width: 30 },
      { header: "Contato", key: "contato", width: 20 },
      { header: "Status de Contato", key: "status", width: 30 },
      { header: "Observações", key: "observacoes", width: 40 },
    ];

    aplicarEstiloCabecalho(sheet);
    aplicarValidacoes(sheet);
  });

  await salvarWorkbook(workbook);
  console.log(`Planilha criada em: ${CONFIG.leadsFile}`);
}

async function copiarDados({
  origem = "Prospeccao_Arquitetos_Salvador_Com_Contatos.xlsx",
  abaOrigem = "Arquitetos_Salvador",
  abaDestino = "Salvador",
} = {}) {
  const planilhaAntiga = new ExcelJS.Workbook();
  await planilhaAntiga.xlsx.readFile(path.resolve(__dirname, origem));

  const planilhaNova = await lerWorkbook();
  const sheetOrigem = planilhaAntiga.getWorksheet(abaOrigem);
  const sheetDestino = planilhaNova.getWorksheet(abaDestino);

  if (!sheetOrigem) {
    throw new Error(`Aba "${abaOrigem}" não encontrada na planilha antiga.`);
  }

  if (!sheetDestino) {
    throw new Error(`Aba "${abaDestino}" não encontrada na planilha nova.`);
  }

  let linhaDestino = acharLinhaVazia(sheetDestino);

  sheetOrigem.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    sheetDestino.getCell(`A${linhaDestino}`).value = row.getCell(1).value;
    sheetDestino.getCell(`B${linhaDestino}`).value = row.getCell(2).value;
    sheetDestino.getCell(`C${linhaDestino}`).value = row.getCell(3).value;
    sheetDestino.getCell(`D${linhaDestino}`).value = row.getCell(5).value;
    sheetDestino.getCell(`E${linhaDestino}`).value = row.getCell(6).value;

    linhaDestino += 1;
  });

  await salvarWorkbook(planilhaNova);
  console.log("Dados copiados para a planilha nova.");
}

async function adicionarSubtitulo(cidade, subtitulo) {
  const workbook = await lerWorkbook();
  const sheet = workbook.getWorksheet(cidade);

  if (!sheet) {
    throw new Error(`Aba "${cidade}" não encontrada.`);
  }

  const linha = acharLinhaVazia(sheet);
  sheet.insertRow(linha, [subtitulo]);
  sheet.mergeCells(`A${linha}:E${linha}`);

  const linhaCategoria = sheet.getRow(linha);
  linhaCategoria.font = {
    bold: true,
    size: 14,
  };
  linhaCategoria.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "D9EAD3" },
  };
  linhaCategoria.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  await salvarWorkbook(workbook);
  console.log(`Subtítulo "${subtitulo}" adicionado em ${cidade}.`);
}

function validarContato(contato) {
  const erros = [];

  if (!CONFIG.cidades.includes(contato.cidade)) {
    erros.push(`cidade inválida: ${contato.cidade}`);
  }

  if (!PRIORIDADES.includes(contato.prioridade)) {
    erros.push(`prioridade inválida: ${contato.prioridade}`);
  }

  if (!contato.empresa) erros.push("empresa é obrigatória");
  if (!contato.contato) erros.push("contato é obrigatório");

  if (contato.status && !STATUS.includes(contato.status)) {
    erros.push(`status inválido: ${contato.status}`);
  }

  if (erros.length) {
    throw new Error(`Contato inválido: ${erros.join("; ")}`);
  }
}

async function adicionarContato(contatos) {
  const workbook = await lerWorkbook();
  const lista = Array.isArray(contatos) ? contatos : [contatos];

  for (const contato of lista) {
    validarContato(contato);

    const {
      cidade,
      prioridade,
      empresa,
      status = "Novo",
      observacoes = "",
    } = contato;
    const telefone = normalizarTelefone(contato.contato);
    const sheet = workbook.getWorksheet(cidade);
    const empresas = sheet
      .getColumn(2)
      .values.map(normalizarTexto)
      .filter(Boolean);

    if (empresas.includes(normalizarTexto(empresa))) {
      console.log(`${empresa} já cadastrada em ${cidade}.`);
      continue;
    }

    const novaLinha = acharLinhaVazia(sheet);

    sheet.getCell(`A${novaLinha}`).value = prioridade;
    sheet.getCell(`B${novaLinha}`).value = empresa;
    sheet.getCell(`D${novaLinha}`).value = status;
    sheet.getCell(`E${novaLinha}`).value = observacoes;

    const cell = sheet.getCell(`C${novaLinha}`);
    cell.value = {
      text: telefone,
      hyperlink: `https://api.whatsapp.com/send?phone=${telefone}`,
    };
    cell.font = {
      color: { argb: "0000FF" },
      underline: true,
    };

    console.log(`${empresa} adicionada em ${cidade}, linha ${novaLinha}.`);
  }

  await salvarWorkbook(workbook);
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
    throw new Error('O JSON precisa ser uma lista ou ter a chave "contatos" com uma lista.');
  }

  return contatos;
}

async function criarClienteGoogleSheets() {
  if (!arquivoExiste(CONFIG.credentialsFile)) {
    throw new Error(`Credencial do Google não encontrada: ${CONFIG.credentialsFile}`);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: CONFIG.credentialsFile,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({
    version: "v4",
    auth,
  });
}

async function sincronizarPlanilha() {
  const arquivo = await lerWorkbook();
  const sheets = await criarClienteGoogleSheets();

  for (const cidade of CONFIG.cidades) {
    const sheetLocal = arquivo.getWorksheet(cidade);

    if (!sheetLocal) {
      console.log(`Aba local ${cidade} não encontrada.`);
      continue;
    }

    const linhas = [];

    sheetLocal.eachRow((row) => {
      linhas.push([
        limparValor(row.getCell(1).value),
        limparValor(row.getCell(2).value),
        limparValor(row.getCell(3).value),
        limparValor(row.getCell(4).value),
        limparValor(row.getCell(5).value),
      ]);
    });

    if (!linhas.length) {
      console.log(`Aba ${cidade} vazia, sincronização ignorada.`);
      continue;
    }

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

async function listarLeads(filtros = {}) {
  const arquivo = await lerWorkbook();
  const cidadeFiltro = filtros.cidade || "";
  const statusFiltro = filtros.status || "";
  const busca = normalizarTexto(filtros.q || "");
  const leads = [];

  arquivo.eachSheet((worksheet) => {
    if (cidadeFiltro && worksheet.name !== cidadeFiltro) return;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const empresa = limparValor(row.getCell("B").value);
      const contato = limparValor(row.getCell("C").value);
      const status = limparValor(row.getCell("D").value);
      const lead = {
        id: `${worksheet.name}-${rowNumber}`,
        cidade: worksheet.name,
        linha: rowNumber,
        prioridade: limparValor(row.getCell("A").value),
        empresa,
        contato,
        status,
        observacoes: limparValor(row.getCell("E").value),
      };

      if (!empresa && !contato && !status) return;
      if (statusFiltro && status !== statusFiltro) return;

      if (busca) {
        const textoBusca = normalizarTexto(
          `${lead.cidade} ${lead.prioridade} ${lead.empresa} ${lead.contato} ${lead.status} ${lead.observacoes}`,
        );
        if (!textoBusca.includes(busca)) return;
      }

      leads.push(lead);
    });
  });

  return leads;
}

async function obterResultados() {
  const arquivo = await lerWorkbook();
  const resultados = {
    contatos: 0,
    catalogos: 0,
    followUps: 0,
    fechados: 0,
    perdidos: 0,
    porCidade: {},
  };

  arquivo.eachSheet((worksheet) => {
    const cidade = worksheet.name;
    resultados.porCidade[cidade] = {
      contatos: 0,
      catalogos: 0,
      followUps: 0,
      fechados: 0,
      perdidos: 0,
    };

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const status = limparValor(row.getCell("D").value);
      const parcial = resultados.porCidade[cidade];

      if (status === "Contato") {
        resultados.contatos += 1;
        parcial.contatos += 1;
      }
      if (status === "Catálogo") {
        resultados.catalogos += 1;
        resultados.contatos += 1;
        parcial.catalogos += 1;
        parcial.contatos += 1;
      }
      if (status === "Follow Up") {
        resultados.followUps += 1;
        resultados.catalogos += 1;
        resultados.contatos += 1;
        parcial.followUps += 1;
        parcial.catalogos += 1;
        parcial.contatos += 1;
      }
      if (status === "Fechado") {
        resultados.fechados += 1;
        parcial.fechados += 1;
      }
      if (status === "Perdido") {
        resultados.perdidos += 1;
        parcial.perdidos += 1;
      }
    });
  });

  return resultados;
}

async function consultarPlanilhaResultados() {
  const resultados = await obterResultados();

  console.log(`
Resultados:
  - Contatos: ${resultados.contatos};
  - Catálogos Enviados: ${resultados.catalogos};
  - Follow Ups Realizados: ${resultados.followUps};
  - Negócios Fechados: ${resultados.fechados};
  - Negócios Perdidos: ${resultados.perdidos};
`);

  console.log("Resultados por cidade:");
  for (const [cidade, parcial] of Object.entries(resultados.porCidade)) {
    console.log(
      `  - ${cidade}: ${parcial.contatos} contatos, ${parcial.catalogos} catálogos, ${parcial.followUps} follow ups, ${parcial.fechados} fechados, ${parcial.perdidos} perdidos`,
    );
  }
}

function mostrarAjuda() {
  console.log(`
Uso:
  node index.js
  node index.js resultados
  node index.js sincronizar
  node index.js criar-planilha
  node index.js copiar-dados
  node index.js adicionar-subtitulo "Brasília" "Espaços de Coworking"
  node index.js adicionar-contato '{"cidade":"Salvador","prioridade":"A","empresa":"Empresa X","contato":"71999999999","status":"Novo","observacoes":"Lead novo"}'
  node index.js adicionar-contatos-json ./contatos.json

Configuração opcional por ambiente:
  SPREADSHEET_ID=...
  GOOGLE_CREDENTIALS=./arquivo-google.json
  LEADS_FILE=./leads.xlsx
  CIDADES=Aracaju,Salvador,Brasília
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
    case "criar-planilha":
      await criarPlanilha();
      break;
    case "copiar-dados":
      await copiarDados();
      break;
    case "adicionar-subtitulo": {
      const [cidade, subtitulo] = args;
      if (!cidade || !subtitulo) {
        throw new Error('Informe cidade e subtítulo. Ex: node index.js adicionar-subtitulo "Brasília" "Espaços de Coworking"');
      }
      await adicionarSubtitulo(cidade, subtitulo);
      break;
    }
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
        throw new Error("Informe o caminho do arquivo JSON com a lista de contatos.");
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
  adicionarSubtitulo,
  consultarPlanilhaResultados,
  copiarDados,
  criarPlanilha,
  lerContatosJson,
  listarLeads,
  obterResultados,
  sincronizarPlanilha,
};
