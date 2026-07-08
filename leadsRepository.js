const pool = require("./db");
const { PRIORIDADES, STATUS } = require("./config");

// Normaliza texto para buscas e comparações sem sensibilidade a caixa.
function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

// Remove qualquer caractere que não seja número do telefone.
function normalizarTelefone(valor) {
  return String(valor || "").replace(/\D/g, "");
}

// Gera o link direto do WhatsApp a partir do telefone salvo.
function criarWhatsappUrl(valor) {
  const telefone = normalizarTelefone(valor);

  if (!telefone) {
    return "";
  }
  const telefoneComCodigoPais = telefone.startsWith("55")
    ? telefone
    : `55${telefone}`;

  return `https://wa.me/${telefoneComCodigoPais}`;
}

// Valida os campos obrigatórios e os valores aceitos no cadastro.
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

// Garante que o status informado existe na lista permitida.
function validarStatus(status) {
  if (!STATUS.includes(status)) {
    throw new Error(`status inválido: ${status}`);
  }
}

// Converte uma linha do banco para o formato usado pela aplicação.
function mapLead(row) {
  return {
    id: row.id,
    cidade: row.cidade,
    linha: row.id,
    prioridade: row.prioridade,
    empresa: row.empresa,
    contato: row.contato,
    whatsappUrl: criarWhatsappUrl(row.contato),
    status: row.status,
    observacoes: row.observacoes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const CAMPOS_RESULTADO = [
  "contatos",
  "reverContatos",
  "catalogos",
  "followUps",
  "fechados",
  "perdidos",
];

const STATUS_RESULTADOS = {
  Contato: ["contatos"],
  "Rever Contato": ["contatos", "reverContatos"],
  Catálogo: ["contatos", "reverContatos", "catalogos"],
  "Follow Up": ["contatos", "reverContatos", "catalogos", "followUps"],
  Fechado: ["fechados"],
  Perdido: ["perdidos"],
};

function criarTotaisResultado() {
  return CAMPOS_RESULTADO.reduce((acc, campo) => {
    acc[campo] = 0;
    return acc;
  }, {});
}

// Insere uma ou várias leads e separa as que foram ignoradas por duplicidade.
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

// Remove uma lead pelo id e devolve o registro excluído.
async function deletarLead(id) {
  const leadId = Number(id);

  if (!Number.isInteger(leadId) || leadId <= 0)
    throw new Error("ID da Lead é inválido");

  const result = await pool.query(
    `
      DELETE FROM leads
      WHERE id = $1
      RETURNING id, cidade, prioridade, empresa, contato, status, observacoes, created_at, updated_at
    
    `,
    [leadId],
  );
  if (!result.rows[0]) {
    throw new Error("Lead não encontrada");
  }

  return mapLead(result.rows[0]);
}

// Lista leads com filtros opcionais por cidade, status e busca textual.
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
  const result = await pool.query(
    `
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
  `,
    values,
  );

  return result.rows.map(mapLead);
}

// Consolida os totais por status e por cidade para o dashboard.
async function obterResultados() {
  const result = await pool.query(`
    SELECT cidade, status, COUNT(*)::int AS total
    FROM leads
    GROUP BY cidade, status
    ORDER BY cidade, status
  `);

  const resultados = {
    ...criarTotaisResultado(),
    porCidade: {},
  };

  for (const row of result.rows) {
    if (!resultados.porCidade[row.cidade]) {
      resultados.porCidade[row.cidade] = criarTotaisResultado();
    }

    const parcial = resultados.porCidade[row.cidade];
    const total = Number(row.total || 0);

    for (const campo of STATUS_RESULTADOS[row.status] || []) {
      resultados[campo] += total;
      parcial[campo] += total;
    }
  }

  return resultados;
}

// Atualiza apenas os campos enviados para uma lead existente.
async function atualizarLead(id, dados) {
  const leadId = Number(id);

  if (!Number.isInteger(leadId) || leadId <= 0) {
    throw new Error("id da lead inválido");
  }

  const updates = [];
  const values = [];
  if (dados.empresa !== undefined) {
    const empresa = String(dados.empresa || "").trim();

    if (!empresa) {
      throw new Error("Nome é obrigatório");
    }
    values.push(dados.empresa);
    updates.push(`empresa = $${values.length}`);
  }
  if (dados.status !== undefined) {
    validarStatus(dados.status);
    values.push(dados.status);
    updates.push(`status = $${values.length}`);
  }
  if (dados.contato !== undefined) {
    const telefone = normalizarTelefone(dados.contato);
    values.push(telefone);
    updates.push(`contato = $${values.length}`);
  }
  if (dados.observacoes !== undefined) {
    values.push(String(dados.observacoes || ""));
    updates.push(`observacoes = $${values.length}`);
  }

  if (!updates.length) {
    throw new Error("Informe ao menos um campo para atualizar");
  }

  values.push(leadId);
  const result = await pool.query(
    `
      UPDATE leads
      SET ${updates.join(", ")}
      WHERE id = $${values.length}
      RETURNING id, cidade, prioridade, empresa, contato, status, observacoes, created_at, updated_at
    `,
    values,
  );

  if (!result.rows[0]) {
    throw new Error("Lead não encontrada");
  }

  return mapLead(result.rows[0]);
}

module.exports = {
  adicionarContato,
  atualizarLead,
  listarLeads,
  normalizarTelefone,
  obterResultados,
  validarStatus,
  validarContato,
  deletarLead,
};
