const ExcelJS = require("exceljs");
const path = require("path");
const { CONFIG, PRIORIDADES, STATUS } = require("../config");

function limparValor(valor) {
  if (valor === null || valor === undefined) return "";

  if (typeof valor === "object") {
    if (valor.text) return valor.text;
    if (valor.result) return valor.result;
    if (valor.richText) return valor.richText.map((item) => item.text).join("");
    if (valor.hyperlink && valor.text) return valor.text;
    return "";
  }

  return String(valor).trim();
}

function normalizarTelefone(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function normalizarStatus(status) {
  const limpo = limparValor(status) || "Novo";
  return STATUS.includes(limpo) ? limpo : "Novo";
}

function normalizarPrioridade(prioridade) {
  const limpo = limparValor(prioridade).toUpperCase();
  return PRIORIDADES.includes(limpo) ? limpo : "C";
}

async function lerContatosDaPlanilha(arquivo = CONFIG.leadsFile) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.resolve(arquivo));

  const contatos = [];

  workbook.eachSheet((worksheet) => {
    const cidade = worksheet.name;

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const empresa = limparValor(row.getCell("B").value);
      const contato = normalizarTelefone(limparValor(row.getCell("C").value));
      const status = normalizarStatus(row.getCell("D").value);

      if (!empresa && !contato && !status) return;
      if (!empresa) return;
      if (!contato && limparValor(row.getCell("B").value) === limparValor(row.getCell("C").value)) {
        return;
      }

      contatos.push({
        cidade,
        prioridade: normalizarPrioridade(row.getCell("A").value),
        empresa,
        contato,
        status,
        observacoes: limparValor(row.getCell("E").value),
      });
    });
  });

  return contatos;
}

async function importarPlanilha({ arquivo = CONFIG.leadsFile, dryRun = false } = {}) {
  const contatos = await lerContatosDaPlanilha(arquivo);
  const porCidade = contatos.reduce((acc, contato) => {
    acc[contato.cidade] = (acc[contato.cidade] || 0) + 1;
    return acc;
  }, {});

  console.log(`Arquivo lido: ${path.resolve(arquivo)}`);
  console.log(`Contatos válidos encontrados: ${contatos.length}`);
  Object.entries(porCidade).forEach(([cidade, total]) => {
    console.log(`  - ${cidade}: ${total}`);
  });

  if (dryRun) {
    console.log("Dry run concluído: nada foi gravado no PostgreSQL.");
    return { contatos, inseridos: 0, duplicados: 0 };
  }

  const migrate = require("../migrate");
  const pool = require("../db");
  const { adicionarContato } = require("../leadsRepository");

  await migrate();
  const resultado = await adicionarContato(contatos);
  await pool.end();

  console.log(`Importação concluída.`);
  console.log(`Inseridos: ${resultado.inseridos.length}`);
  console.log(`Duplicados ignorados: ${resultado.duplicados.length}`);

  return {
    contatos,
    inseridos: resultado.inseridos.length,
    duplicados: resultado.duplicados.length,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const arquivoArg = args.find((arg) => !arg.startsWith("--"));

  importarPlanilha({ arquivo: arquivoArg || CONFIG.leadsFile, dryRun }).catch((error) => {
    console.error(`Erro ao importar planilha: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  importarPlanilha,
  lerContatosDaPlanilha,
};
