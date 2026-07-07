const state = {
  config: {
    cidades: [],
    prioridades: [],
    status: [],
  },
  leads: [],
  activeTab: "leadFormPanel",
  filters: {
    cidade: "",
    status: "",
    q: "",
  },
};

const metricsEl = document.querySelector("#metrics");
const leadsBody = document.querySelector("#leadsBody");
const leadsCards = document.querySelector("#leadsCards");
const leadCount = document.querySelector("#leadCount");
const statusText = document.querySelector("#statusText");
const cityFilter = document.querySelector("#cityFilter");
const statusFilter = document.querySelector("#statusFilter");
const searchInput = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const syncButton = document.querySelector("#syncButton");
const leadForm = document.querySelector("#leadForm");
const leadStatusForm = document.querySelector("#leadStatusForm");
const jsonImportForm = document.querySelector("#jsonImportForm");
const jsonFileInput = document.querySelector("#jsonFileInput");
const cidadeInput = document.querySelector("#cidadeInput");
const prioridadeInput = document.querySelector("#prioridadeInput");
const statusInput = document.querySelector("#statusInput");
const leadSelectInput = document.querySelector("#leadSelectInput");
const leadStatusInput = document.querySelector("#leadStatusInput");
const leadNomeInput = document.querySelector("#leadNomeInput");
const leadContatoInput = document.querySelector("#leadContatoInput");
const leadObservacoesInput = document.querySelector("#leadObservacoesInput");
const leadCurrentStatus = document.querySelector("#leadCurrentStatus");
const tabButtons = document.querySelectorAll(".tab-button");
const tabPanels = document.querySelectorAll(".tab-panel");
const toast = document.querySelector("#toast");

// Exibe uma notificação curta para feedback da interface.
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

// Remove uma lead pelo endpoint da API.
async function deleteLead(id) {
  return request(`/api/leads/${id}`, {
    method: "DELETE",
  });
}

// Faz requisições JSON e normaliza erros vindos do backend.
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

// Cria um elemento option para os selects da tela.
function option(value, label = value) {
  const el = document.createElement("option");
  el.value = value;
  el.textContent = label;
  return el;
}

// Preenche um select com os valores disponíveis.
function fillSelect(select, values, { allLabel } = {}) {
  select.replaceChildren();
  if (allLabel) {
    select.append(option("", allLabel));
  }
  values.forEach((value) => select.append(option(value)));
}

// Monta o seletor de leads usado no formulário de atualização.
function fillLeadSelect(leads) {
  const currentValue = leadSelectInput.value;
  leadSelectInput.replaceChildren(option("", "Selecione uma lead"));

  leads.forEach((lead) => {
    const label = `${lead.empresa || "Sem empresa"} - ${lead.cidade} (${lead.status || "Sem status"})`;
    leadSelectInput.append(option(String(lead.id), label));
  });

  if (leads.some((lead) => String(lead.id) === currentValue)) {
    leadSelectInput.value = currentValue;
  }

  syncSelectedLeadDetails();
}

// Recupera a lead atualmente escolhida no select.
function getSelectedLead() {
  const selectedId = Number(leadSelectInput.value);
  return state.leads.find((lead) => lead.id === selectedId) || null;
}

// Copia os dados da lead selecionada para o formulário lateral.
function syncSelectedLeadDetails() {
  const lead = getSelectedLead();

  if (!lead) {
    leadCurrentStatus.textContent =
      "Selecione uma lead para ver o status atual.";
    leadStatusInput.value = "Novo";
    leadObservacoesInput.value = "";
    leadContatoInput.value = "";
    leadNomeInput.value = "";
    return;
  }

  leadCurrentStatus.textContent = `Status atual: ${lead.status || "Sem status"} · ${lead.empresa} em ${lead.cidade}`;
  leadStatusInput.value = lead.status || "Novo";
  leadObservacoesInput.value = lead.observacoes || "";
  leadContatoInput.value = lead.contato || "";
  leadNomeInput.value = lead.empresa || "";
}

// Alterna entre as abas de cadastro e atualização.
function setActiveTab(tabId) {
  state.activeTab = tabId;

  tabButtons.forEach((button) => {
    const isActive = button.dataset.tabTarget === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.id === tabId;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

// Renderiza os cards de métricas do topo com dados do dashboard.
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

// Traduz a prioridade para a classe visual correspondente.
function priorityClass(prioridade) {
  return `priority priority-${String(prioridade || "").toLocaleLowerCase("pt-BR")}`;
}

// Garante um texto padrão quando o valor estiver vazio.
function textValue(value, fallback = "-") {
  return value ? String(value) : fallback;
}

// Cria o texto ou link clicável do contato da lead.
function createContatoNode(lead) {
  const contato = textValue(lead.contato);

  if (!lead.whatsappUrl) {
    return document.createTextNode(contato);
  }

  const link = document.createElement("a");
  link.href = lead.whatsappUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = contato;

  return link;
}

// Monta o card mobile de uma lead com seus principais dados.
function createLeadCard(lead) {
  const card = document.createElement("article");
  card.className = "lead-card";

  const header = document.createElement("div");
  header.className = "lead-card-header";

  const companyBlock = document.createElement("div");

  const company = document.createElement("strong");
  company.className = "lead-card-company";
  company.textContent = textValue(lead.empresa);

  const city = document.createElement("span");
  city.className = "lead-card-city";
  city.textContent = textValue(lead.cidade);

  companyBlock.append(company, city);

  const priority = document.createElement("span");
  priority.className = priorityClass(lead.prioridade);
  priority.textContent = textValue(lead.prioridade);

  header.append(companyBlock, priority);

  const meta = document.createElement("dl");
  meta.className = "lead-card-meta";

  const fields = [
    ["Contato", textValue(lead.contato)],
    ["Status", textValue(lead.status, "Sem status")],
    ["Observações", textValue(lead.observacoes)],
  ];

  fields.forEach(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");

    term.textContent = label;

    if (label === "Status") {
      const status = document.createElement("span");
      status.className = "status-pill";
      status.textContent = value;
      description.append(status);
    } else if (label === "Contato") {
      description.append(createContatoNode(lead));
    } else {
      description.textContent = value;
    }

    row.append(term, description);
    meta.append(row);
  });

  card.append(header, meta);
  return card;
}

// Atualiza a tabela, os cards e o seletor com a lista de leads.
function renderLeads(leads) {
  state.leads = leads;
  fillLeadSelect(leads);
  leadCount.textContent = `${leads.length} lead${leads.length === 1 ? "" : "s"} encontrado${leads.length === 1 ? "" : "s"}`;

  if (!leads.length) {
    leadsBody.innerHTML = `<tr><td class="empty-state" colspan="6">Nenhum lead encontrado</td></tr>`;
    leadsCards.innerHTML = `<p class="empty-state">Nenhum lead encontrado</p>`;
    return;
  }

  leadsCards.replaceChildren(...leads.map((lead) => createLeadCard(lead)));

  leadsBody.replaceChildren(
    ...leads.map((lead) => {
      const row = document.createElement("tr");
      const priorityCell = document.createElement("td");
      const priority = document.createElement("span");
      priority.className = priorityClass(lead.prioridade);
      priority.textContent = lead.prioridade || "-";
      priorityCell.append(priority);

      const empresaCell = document.createElement("td");
      empresaCell.textContent = textValue(lead.empresa);

      const cidadeCell = document.createElement("td");
      cidadeCell.textContent = textValue(lead.cidade);

      const contatoCell = document.createElement("td");
      contatoCell.append(createContatoNode(lead));

      const statusCell = document.createElement("td");
      const status = document.createElement("span");
      status.className = "status-pill";
      status.textContent = textValue(lead.status, "Sem status");
      statusCell.append(status);

      const observacoesCell = document.createElement("td");
      observacoesCell.textContent = lead.observacoes || "-";

      row.append(
        priorityCell,
        empresaCell,
        cidadeCell,
        contatoCell,
        statusCell,
        observacoesCell,
      );

      const actionsCell = document.createElement("td");
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "button ghost";
      deleteButton.textContent = "Excluir";

      deleteButton.addEventListener("click", async () => {
        const confirmed = window.confirm(`Excluir a lead ${lead.empresa}?`);
        if (!confirmed) return;

        deleteButton.disabled = true;
        try {
          await deleteLead(lead.id);
          await refreshAll();
          showToast("Lead excluída");
        } catch (error) {
          showToast(error.message);
        } finally {
          deleteButton.disabled = false;
        }
      });

      actionsCell.append(deleteButton);
      row.append(
        priorityCell,
        empresaCell,
        cidadeCell,
        contatoCell,
        statusCell,
        observacoesCell,
        actionsCell,
      );
      return row;
    }),
  );
}

// Busca e renderiza os indicadores do dashboard.
async function loadDashboard() {
  const dashboard = await request("/api/dashboard");
  renderMetrics(dashboard);
}

// Busca a lista de leads aplicando os filtros atuais.
async function loadLeads() {
  const params = new URLSearchParams();
  Object.entries(state.filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const data = await request(`/api/leads?${params.toString()}`);
  renderLeads(data.leads);
}

// Recarrega dashboard e leads em paralelo.
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

// Aciona a sincronização manual e atualiza a interface.
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

// Envia a atualização dos dados editáveis de uma lead.
async function updateLeadStatus(payload) {
  return request(`/api/leads/${payload.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: payload.status,
      observacoes: payload.observacoes,
      contato: payload.contato,
      empresa: payload.empresa,
    }),
  });
}

// Liga eventos de filtros, botões e formulários da tela.
function bindEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tabTarget);
    });
  });

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
  leadSelectInput.addEventListener("change", syncSelectedLeadDetails);

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

  leadStatusForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(leadStatusForm);
    const payload = Object.fromEntries(formData.entries());
    const submitButton = leadStatusForm.querySelector("button[type='submit']");

    submitButton.disabled = true;
    try {
      await updateLeadStatus(payload);
      await refreshAll();
      showToast("Lead atualizado");
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
      showToast(
        `${data.importados} contato${data.importados === 1 ? "" : "s"} processado${data.importados === 1 ? "" : "s"}`,
      );
    } catch (error) {
      showToast(error.message);
    } finally {
      submitButton.disabled = false;
    }
  });
}

// Carrega configurações iniciais e a primeira renderização da tela.
async function init() {
  try {
    state.config = await request("/api/config");

    fillSelect(cityFilter, state.config.cidades, { allLabel: "Todas" });
    fillSelect(statusFilter, state.config.status, { allLabel: "Todos" });
    fillSelect(cidadeInput, state.config.cidades);
    fillSelect(prioridadeInput, state.config.prioridades);
    fillSelect(statusInput, state.config.status);
    fillSelect(leadStatusInput, state.config.status);

    cidadeInput.value = state.config.cidades[0] || "";
    prioridadeInput.value = state.config.prioridades[0] || "";
    statusInput.value = "Novo";
    leadStatusInput.value = "Novo";

    bindEvents();
    setActiveTab(state.activeTab);
    await refreshAll();
  } catch (error) {
    showToast(error.message);
  }
}

init();
