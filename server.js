const express = require("express");
const path = require("path");
const {
  CONFIG,
  PRIORIDADES,
  STATUS,
  adicionarContato,
  atualizarLead,
  listarLeads,
  obterResultados,
  sincronizarPlanilha,
} = require("./index");
const { deletarLead } = require("./leadsRepository");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/config", (_req, res) => {
  res.json({
    cidades: CONFIG.cidades,
    prioridades: PRIORIDADES,
    status: STATUS,
  });
});

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const [resultados, leads] = await Promise.all([
      obterResultados(),
      listarLeads(),
    ]);

    res.json({
      resultados,
      totalLeads: leads.length,
      ultimaAtualizacao: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/leads", async (req, res, next) => {
  try {
    const leads = await listarLeads({
      cidade: req.query.cidade,
      status: req.query.status,
      q: req.query.q,
    });

    res.json({ leads });
  } catch (error) {
    next(error);
  }
});

app.post("/api/leads", async (req, res, next) => {
  try {
    await adicionarContato({
      cidade: req.body.cidade,
      prioridade: req.body.prioridade,
      empresa: req.body.empresa,
      contato: req.body.contato,
      status: req.body.status || "Novo",
      observacoes: req.body.observacoes || "",
    });

    const [resultados, leads] = await Promise.all([
      obterResultados(),
      listarLeads(),
    ]);

    res.status(201).json({
      ok: true,
      resultados,
      totalLeads: leads.length,
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/leads/:id", async (req, res, next) => {
  try {
    const lead = await atualizarLead(req.params.id, {
      status: req.body.status,
      observacoes: req.body.observacoes,
      contato: req.body.contato,
    });

    res.json({
      ok: true,
      lead,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/leads/import-json", async (req, res, next) => {
  try {
    const contatos = Array.isArray(req.body) ? req.body : req.body.contatos;

    if (!Array.isArray(contatos)) {
      throw new Error(
        'Envie uma lista JSON ou um objeto com a chave "contatos".',
      );
    }

    await adicionarContato(contatos);

    const [resultados, leads] = await Promise.all([
      obterResultados(),
      listarLeads(),
    ]);

    res.status(201).json({
      ok: true,
      importados: contatos.length,
      resultados,
      totalLeads: leads.length,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/sync", async (_req, res, next) => {
  try {
    await sincronizarPlanilha();
    res.json({
      ok: true,
      sincronizadoEm: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(400).json({
    ok: false,
    message: error.message || "Erro inesperado",
  });
});

app.listen(PORT, () => {
  console.log(`GUI disponível em http://localhost:${PORT}`);
});

app.delete("/api/leads/:id", async (req, res, next) => {
  try {
    const lead = await deletarLead(req.params.id);

    res.json({
      ok: true,
      lead,
    });
  } catch (error) {
    next(error);
  }
});
