const pool = require("./db");
const { PRIORIDADES, STATUS } = require("./config");

function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function normalizarTelefone(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function validarContato(contato) {
  const erros = [];

  if (!contato.cidade) erros.push("cidade é obrigatória");
  if (!PRIORIDADES.includes(contato.prioridade)) {
    erros.push(`prioridade inválida: ${contato.prioridade}`);
  }
  if (!contato.empresa) erros.push("empresa é obrigatória");

  if (contato.status && !STATUS.includes(contato.status)) {
    erros.push(`status inválido: ${contato.status}`);
  }

  if (erros.length) {
    throw new Error(`Contato inválido: ${erros.join("; ")}`);
  }
}

function mapLead(row) {
  return {
    id: row.id,
    cidade: row.cidade,
    linha: row.id,
    prioridade: row.prioridade,
    empresa: row.empresa,
    contato: row.contato,
    status: row.status,
    observacoes: row.observacoes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function adicionarContato(contatos) {
  const lista = Array.isArray(contatos) ? contatos : [contatos];
  const inseridos = [];
  const duplicados = [];

  for (const contato of lista) {
    validarContato(contato);

    const telefone = normalizarTelefone(contato.contato);
    const result = await pool.query(
      `
        INSERT INTO leads (
          cidade,
          prioridade,
          empresa,
          contato,
          status,
          observacoes
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        RETURNING *
      `,
      [
        contato.cidade.trim(),
        contato.prioridade,
        contato.empresa.trim(),
        telefone,
        contato.status || "Novo",
        contato.observacoes || "",
      ],
    );

    if (result.rows[0]) {
      inseridos.push(mapLead(result.rows[0]));
      console.log(`${contato.empresa} adicionada em ${contato.cidade}.`);
    } else {
      duplicados.push(contato);
      console.log(`${contato.empresa} já cadastrada em ${contato.cidade}.`);
    }
  }

  return { inseridos, duplicados };
}

async function listarLeads(filtros = {}) {
  const conditions = [];
  const values = [];

  if (filtros.cidade) {
    values.push(filtros.cidade);
    conditions.push(`cidade = $${values.length}`);
  }

  if (filtros.status) {
    values.push(filtros.status);
    conditions.push(`status = $${values.length}`);
  }

  if (filtros.q) {
    values.push(`%${normalizarTexto(filtros.q)}%`);
    const index = values.length;
    conditions.push(`(
      LOWER(cidade) LIKE $${index}
      OR LOWER(empresa) LIKE $${index}
      OR LOWER(contato) LIKE $${index}
      OR LOWER(status) LIKE $${index}
      OR LOWER(COALESCE(observacoes, '')) LIKE $${index}
    )`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query(`
    SELECT
      id,
      cidade,
      prioridade,
      empresa,
      contato,
      status,
      observacoes,
      created_at,
      updated_at
    FROM leads
    ${where}
    ORDER BY cidade, empresa, id
  `, values);

  return result.rows.map(mapLead);
}

async function obterResultados() {
  const result = await pool.query(`
    SELECT cidade, status, COUNT(*)::int AS total
    FROM leads
    GROUP BY cidade, status
    ORDER BY cidade, status
  `);

  const resultados = {
    contatos: 0,
    catalogos: 0,
    followUps: 0,
    fechados: 0,
    perdidos: 0,
    porCidade: {},
  };

  for (const row of result.rows) {
    if (!resultados.porCidade[row.cidade]) {
      resultados.porCidade[row.cidade] = {
        contatos: 0,
        catalogos: 0,
        followUps: 0,
        fechados: 0,
        perdidos: 0,
      };
    }

    const parcial = resultados.porCidade[row.cidade];
    const total = Number(row.total || 0);

    if (row.status === "Contato") {
      resultados.contatos += total;
      parcial.contatos += total;
    }
    if (row.status === "Catálogo") {
      resultados.catalogos += total;
      resultados.contatos += total;
      parcial.catalogos += total;
      parcial.contatos += total;
    }
    if (row.status === "Follow Up") {
      resultados.followUps += total;
      resultados.catalogos += total;
      resultados.contatos += total;
      parcial.followUps += total;
      parcial.catalogos += total;
      parcial.contatos += total;
    }
    if (row.status === "Fechado") {
      resultados.fechados += total;
      parcial.fechados += total;
    }
    if (row.status === "Perdido") {
      resultados.perdidos += total;
      parcial.perdidos += total;
    }
  }

  return resultados;
}

module.exports = {
  adicionarContato,
  listarLeads,
  normalizarTelefone,
  obterResultados,
  validarContato,
};
