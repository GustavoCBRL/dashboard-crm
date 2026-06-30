const state = {
  config: {
    cidades: [],
    prioridades: [],
    status: [],
  },
  filters: {
    cidade: "",
    status: "",
    q: "",
  },
};

const metricsEl = document.querySelector("#metrics");
const leadsBody = document.querySelector("#leadsBody");
const leadCount = document.querySelector("#leadCount");
const statusText = document.querySelector("#statusText");
const cityFilter = document.querySelector("#cityFilter");
const statusFilter = document.querySelector("#statusFilter");
const searchInput = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const syncButton = document.querySelector("#syncButton");
const leadForm = document.querySelector("#leadForm");
const jsonImportForm = document.querySelector("#jsonImportForm");
const jsonFileInput = document.querySelector("#jsonFileInput");
const cidadeInput = document.querySelector("#cidadeInput");
const prioridadeInput = document.querySelector("#prioridadeInput");
const statusInput = document.querySelector("#statusInput");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Erro na requisição");
  }

  return data;
}

function option(value, label = value) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = label;
  return el;
}

function fillSelect(select, values, { allLabel } = {}) {
  select.replaceChildren();
  if (allLabel) {
    select.append(option("", allLabel));
  }
  values.forEach((value) => select.append(option(value)));
}

function renderMetrics(dashboard) {
  const resultados = dashboard.resultados;
  const items = [
    ["Leads", dashboard.totalLeads, "teal"],
    ["Contatos", resultados.contatos, "teal"],
    ["Catálogos", resultados.catalogos, "gold"],
    ["Follow ups", resultados.followUps, "gold"],
    ["Fechados", resultados.fechados, "green"],
    ["Perdidos", resultados.perdidos, "red"],
  ];

  metricsEl.replaceChildren(
    ...items.map(([label, value, tone]) => {
      const card = document.createElement("article");
      card.className = "metric";
      card.dataset.tone = tone;
      card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      return card;
    }),
  );

  const date = new Date(dashboard.ultimaAtualizacao);
  statusText.textContent = `Atualizado às ${date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function priorityClass(prioridade) {
  return `priority priority-${String(prioridade || "").toLocaleLowerCase("pt-BR")}`;
}

function renderLeads(leads) {
  leadCount.textContent = `${leads.length} lead${leads.length === 1 ? "" : "s"} encontrado${leads.length === 1 ? "" : "s"}`;

  if (!leads.length) {
    leadsBody.innerHTML = `<tr><td class="empty-state" colspan="6">Nenhum lead encontrado</td></tr>`;
    return;
  }

  leadsBody.replaceChildren(
    ...leads.map((lead) => {
      const row = document.createElement("tr");
      const priorityCell = document.createElement("td");
      const priority = document.createElement("span");
      priority.className = priorityClass(lead.prioridade);
      priority.textContent = lead.prioridade || "-";
      priorityCell.append(priority);

      const empresaCell = document.createElement("td");
      empresaCell.textContent = lead.empresa || "-";

      const cidadeCell = document.createElement("td");
      cidadeCell.textContent = lead.cidade;

      const contatoCell = document.createElement("td");
      contatoCell.textContent = lead.contato || "-";

      const statusCell = document.createElement("td");
      const status = document.createElement("span");
      status.className = "status-pill";
      status.textContent = lead.status || "Sem status";
      statusCell.append(status);

      const observacoesCell = document.createElement("td");
      observacoesCell.textContent = lead.observacoes || "";

      row.append(
        priorityCell,
        empresaCell,
        cidadeCell,
        contatoCell,
        statusCell,
        observacoesCell,
      );
      return row;
    }),
  );
}

async function loadDashboard() {
  const dashboard = await request("/api/dashboard");
  renderMetrics(dashboard);
}

async function loadLeads() {
  const params = new URLSearchParams();
  Object.entries(state.filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const data = await request(`/api/leads?${params.toString()}`);
  renderLeads(data.leads);
}

async function refreshAll() {
  refreshButton.disabled = true;
  try {
    await Promise.all([loadDashboard(), loadLeads()]);
  } catch (error) {
    showToast(error.message);
  } finally {
    refreshButton.disabled = false;
  }
}

async function syncSheets() {
  syncButton.disabled = true;
  syncButton.textContent = "Sincronizando";
  try {
    await request("/api/sync", { method: "POST" });
    await refreshAll();
    showToast("Google Sheets sincronizado");
  } catch (error) {
    showToast(error.message);
  } finally {
    syncButton.disabled = false;
    syncButton.textContent = "Sincronizar";
  }
}

function bindEvents() {
  cityFilter.addEventListener("change", () => {
    state.filters.cidade = cityFilter.value;
    loadLeads().catch((error) => showToast(error.message));
  });

  statusFilter.addEventListener("change", () => {
    state.filters.status = statusFilter.value;
    loadLeads().catch((error) => showToast(error.message));
  });

  searchInput.addEventListener("input", () => {
    state.filters.q = searchInput.value.trim();
    window.clearTimeout(searchInput.timeout);
    searchInput.timeout = window.setTimeout(() => {
      loadLeads().catch((error) => showToast(error.message));
    }, 180);
  });

  refreshButton.addEventListener("click", refreshAll);
  syncButton.addEventListener("click", syncSheets);

  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(leadForm);
    const payload = Object.fromEntries(formData.entries());
    const submitButton = leadForm.querySelector("button[type='submit']");

    submitButton.disabled = true;
    try {
      await request("/api/leads", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      leadForm.reset();
      cidadeInput.value = state.config.cidades[0] || "";
      prioridadeInput.value = state.config.prioridades[0] || "";
      statusInput.value = "Novo";
      await refreshAll();
      showToast("Lead salvo na planilha local");
    } catch (error) {
      showToast(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });

  jsonImportForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = jsonImportForm.querySelector("button[type='submit']");
    const file = jsonFileInput.files[0];

    if (!file) {
      showToast("Selecione um arquivo JSON");
      return;
    }

    submitButton.disabled = true;
    try {
      const content = await file.text();
      const payload = JSON.parse(content);
      const data = await request("/api/leads/import-json", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      jsonImportForm.reset();
      await refreshAll();
      showToast(`${data.importados} contato${data.importados === 1 ? "" : "s"} processado${data.importados === 1 ? "" : "s"}`);
    } catch (error) {
      showToast(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function init() {
  try {
    state.config = await request("/api/config");

    fillSelect(cityFilter, state.config.cidades, { allLabel: "Todas" });
    fillSelect(statusFilter, state.config.status, { allLabel: "Todos" });
    fillSelect(cidadeInput, state.config.cidades);
    fillSelect(prioridadeInput, state.config.prioridades);
    fillSelect(statusInput, state.config.status);

    cidadeInput.value = state.config.cidades[0] || "";
    prioridadeInput.value = state.config.prioridades[0] || "";
    statusInput.value = "Novo";

    bindEvents();
    await refreshAll();
  } catch (error) {
    showToast(error.message);
  }
}

init();
