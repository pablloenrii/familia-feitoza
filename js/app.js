// ========== DATABASE ==========
let db = {
  accounts: [],
  cards: [],
  calendar: [],
  goals: [],
  investments: [],
  income: 0,
  budget: { needs: 0, wants: 0, invest: 0 },
  lastSync: null
};

const STORAGE_KEY = "familia_feitoza_db";
const MAX_ONB_STEPS = 4;
let onbStep = 1;

// ========== FORMATTING ==========
function fmt(val) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0
  }).format(val || 0);
}

function fmtDate(date) {
  return new Date(date).toLocaleDateString("pt-BR");
}

// ========== PERSISTENCE ==========
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function load() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      db = JSON.parse(saved);
    } catch (e) {
      console.error("Erro ao carregar dados", e);
    }
  }
}

// ========== NAVIGATION ==========
function goTo(page) {
  // Esconder todas as seções
  document.querySelectorAll(".sec").forEach(s => s.classList.remove("on"));
  document.querySelectorAll(".sb-item").forEach(s => s.classList.remove("on"));

  // Mostrar seção desejada
  const sec = document.getElementById(`sec-${page}`);
  if (sec) {
    sec.classList.add("on");
  }

  // Marcar item nav como ativo
  const item = document.querySelector(`.sb-item[onclick*="'${page}'"]`);
  if (item) {
    item.classList.add("on");
  }

  // Renderizar conteúdo
  if (page === "cards") renderCards();
  if (page === "accounts") renderAccounts();
  if (page === "calendar") renderCalendar();
  if (page === "investments") renderInvestments();
  if (page === "goals") renderGoals();
  if (page === "budget") updateBudget();
  if (page === "overview") renderOverview();
}

// ========== OVERVIEW ==========
function renderOverview() {
  // Total patrimônio
  const totalAccounts = (db.accounts || []).reduce((a, c) => a + (c.balance || 0), 0);
  const totalInvestments = (db.investments || []).reduce((a, c) => a + (c.current || 0), 0);
  const netWorth = totalAccounts + totalInvestments;

  document.getElementById("total-net").textContent = fmt(netWorth);

  // Receita e despesas do mês
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const monthlyIncome = (db.calendar || [])
    .filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && e.type === "Receita";
    })
    .reduce((a, e) => a + (e.amount || 0), 0);

  const monthlyExpenses = (db.calendar || [])
    .filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && e.type === "Despesa";
    })
    .reduce((a, e) => a + (e.amount || 0), 0);

  document.getElementById("monthly-income").textContent = fmt(monthlyIncome || db.income);
  document.getElementById("monthly-expenses").textContent = fmt(monthlyExpenses);
  document.getElementById("monthly-balance").textContent = fmt((monthlyIncome || db.income) - monthlyExpenses);

  // Próximas despesas
  renderUpcomingExpenses();

  // Charts
  renderOverviewCharts();
}

function renderUpcomingExpenses() {
  const container = document.getElementById("upcoming-expenses");
  const upcoming = (db.calendar || [])
    .filter(e => new Date(e.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  if (!upcoming.length) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text4)">Sem despesas próximas</div>`;
    return;
  }

  container.innerHTML = upcoming
    .map(
      e => `
    <div class="row">
      <div>
        <div style="font-weight:600;font-size:13px">${e.title}</div>
        <div style="font-size:11px;color:var(--text4)">${fmtDate(e.date)}</div>
      </div>
      <div style="font-weight:700;color:${e.type === "Despesa" ? "var(--red)" : "var(--green)"}">${fmt(e.amount)}</div>
    </div>
  `
    )
    .join("");
}

function renderOverviewCharts() {
  // Gráfico de evolução (últimos 6 meses)
  const chartCtx = document.getElementById("chart-evolution");
  if (chartCtx && chartCtx.chart) chartCtx.chart.destroy();

  const months = [];
  const balances = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString("pt-BR", { month: "short" }));
    balances.push(Math.random() * 10000); // Simulado por agora
  }

  if (chartCtx) {
    chartCtx.chart = new Chart(chartCtx, {
      type: "line",
      data: {
        labels: months,
        datasets: [
          {
            label: "Saldo",
            data: balances,
            borderColor: "#f97316",
            backgroundColor: "rgba(249, 115, 22, 0.1)",
            tension: 0.4,
            fill: true,
            pointBackgroundColor: "#f97316",
            pointBorderColor: "#fff"
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "var(--text4)" }
          },
          x: {
            grid: { display: false },
            ticks: { color: "var(--text4)" }
          }
        }
      }
    });
  }

  // Gráfico de composição (pizza)
  const compCtx = document.getElementById("chart-composition");
  if (compCtx && compCtx.chart) compCtx.chart.destroy();

  const totalAccounts = (db.accounts || []).reduce((a, c) => a + (c.balance || 0), 0);
  const totalInvestments = (db.investments || []).reduce((a, c) => a + (c.current || 0), 0);

  if (compCtx) {
    compCtx.chart = new Chart(compCtx, {
      type: "doughnut",
      data: {
        labels: ["Contas Bancárias", "Investimentos"],
        datasets: [
          {
            data: [totalAccounts, totalInvestments],
            backgroundColor: ["#3b82f6", "#f97316"],
            borderColor: "#111113",
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "var(--text)" }
          }
        }
      }
    });
  }
}

// ========== CARTÕES DE CRÉDITO ==========
function addCard() {
  const name = document.getElementById("card-name").value.trim();
  const limit = parseFloat(document.getElementById("card-limit").value) || 0;
  const bank = document.getElementById("card-bank").value.trim();
  const color = document.getElementById("card-color").value || "#f97316";

  if (!name || limit <= 0) return alert("Preencha nome e limite");

  if (!db.cards) db.cards = [];
  db.cards.push({
    id: Date.now(),
    name,
    limit,
    bank,
    color,
    used: 0,
    dueDate: new Date().getDate() + 10,
    createdAt: new Date().toISOString()
  });

  document.getElementById("card-name").value = "";
  document.getElementById("card-limit").value = "";
  document.getElementById("card-bank").value = "";

  persist();
  saveToSheets(db);
  renderCards();
}

function renderCards() {
  const grid = document.getElementById("cards-grid");
  if (!grid) return;

  if (!db.cards || !db.cards.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">💳</div><div class="empty-text">Cadastre seu primeiro cartão acima</div></div>`;
    return;
  }

  grid.innerHTML = db.cards
    .map(c => {
      const percent = Math.min(100, (c.used / c.limit) * 100);
      const color = percent > 80 ? "var(--red)" : percent > 50 ? "var(--amber)" : "var(--green)";

      return `
      <div class="card-item" style="border-left:4px solid ${c.color}">
        <div class="card-header">
          <div>
            <div class="card-name">${c.name}</div>
            <div class="card-bank">${c.bank}</div>
          </div>
          <button class="btn-d" onclick="removeCard(${c.id})">✕</button>
        </div>
        <div class="card-limit">
          <div class="card-limit-label">Limite usado</div>
          <div class="card-limit-bar">
            <div class="prog">
              <div class="pf" style="width:${percent}%;background:${color}"></div>
            </div>
          </div>
          <div style="font-size:11px;margin-top:8px;display:flex;justify-content:space-between">
            <span style="color:var(--text4)">${fmt(c.used)} de ${fmt(c.limit)}</span>
            <span style="color:${color};font-weight:700">${percent.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function removeCard(id) {
  if (!confirm("Remover cartão?")) return;
  db.cards = (db.cards || []).filter(c => c.id !== id);
  persist();
  renderCards();
}

// ========== CALENDÁRIO ==========
function addCalendarEvent() {
  const title = document.getElementById("evt-title").value.trim();
  const date = document.getElementById("evt-date").value;
  const amount = parseFloat(document.getElementById("evt-amount").value) || 0;
  const type = document.getElementById("evt-type").value;

  if (!title || !date || amount <= 0) return alert("Preencha todos os campos");

  if (!db.calendar) db.calendar = [];
  db.calendar.push({
    id: Date.now(),
    title,
    date,
    amount,
    type,
    createdAt: new Date().toISOString()
  });

  document.getElementById("evt-title").value = "";
  document.getElementById("evt-date").value = "";
  document.getElementById("evt-amount").value = "";

  persist();
  saveToSheets(db);
  renderCalendar();
}

function renderCalendar() {
  const container = document.getElementById("calendar-view");
  if (!container) return;

  if (!db.calendar || !db.calendar.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-text">Nenhum evento adicionado</div></div>`;
    return;
  }

  const sorted = [...db.calendar].sort((a, b) => new Date(a.date) - new Date(b.date));

  container.innerHTML = sorted
    .map(e => {
      const icon = e.type === "Despesa" ? "💸" : e.type === "Receita" ? "💰" : "🎯";
      const color = e.type === "Despesa" ? "var(--red)" : e.type === "Receita" ? "var(--green)" : "var(--orange)";

      return `
      <div class="row">
        <div style="display:flex;gap:12px;align-items:center">
          <span style="font-size:18px">${icon}</span>
          <div>
            <div style="font-weight:600">${e.title}</div>
            <div style="font-size:11px;color:var(--text4)">${fmtDate(e.date)}</div>
          </div>
        </div>
        <div>
          <div style="font-weight:700;color:${color};margin-bottom:4px">${fmt(e.amount)}</div>
          <button class="btn-d" onclick="removeCalendarEvent(${e.id})">✕</button>
        </div>
      </div>
    `;
    })
    .join("");
}

function removeCalendarEvent(id) {
  db.calendar = (db.calendar || []).filter(e => e.id !== id);
  persist();
  renderCalendar();
}

// ========== CONTAS BANCÁRIAS ==========
function addAccount() {
  const name = document.getElementById("a-name").value.trim();
  const type = document.getElementById("a-type").value;
  const balance = parseFloat(document.getElementById("a-balance").value) || 0;
  const bank = document.getElementById("a-bank").value.trim();
  const color = document.getElementById("a-color").value;

  if (!name) return alert("Informe o nome da conta");

  if (!db.accounts) db.accounts = [];
  db.accounts.push({
    id: Date.now(),
    name,
    type,
    balance,
    bank,
    color,
    createdAt: new Date().toISOString()
  });

  document.getElementById("a-name").value = "";
  document.getElementById("a-balance").value = "";
  document.getElementById("a-bank").value = "";

  persist();
  saveToSheets(db);
  renderAccounts();
}

function removeAccount(id) {
  if (!confirm("Remover esta conta?")) return;
  db.accounts = (db.accounts || []).filter(a => a.id !== id);
  persist();
  renderAccounts();
}

function adjustBalance(id) {
  const acc = db.accounts.find(a => a.id === id);
  if (!acc) return;
  const newBalance = prompt(`Novo saldo de "${acc.name}":`, acc.balance);
  if (newBalance === null) return;
  const val = parseFloat(newBalance);
  if (isNaN(val)) return alert("Valor inválido");
  acc.balance = val;
  persist();
  renderAccounts();
}

function renderAccounts() {
  const grid = document.getElementById("accounts-grid");
  if (!grid) return;

  if (!db.accounts || !db.accounts.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🏦</div><div class="empty-text">Cadastre sua primeira conta</div></div>`;
    document.getElementById("total-patrimony").textContent = fmt(0);
    return;
  }

  const total = db.accounts.reduce((a, c) => a + (c.balance || 0), 0);
  document.getElementById("total-patrimony").textContent = fmt(total);

  const typeLabels = {
    checking: "Conta Corrente",
    savings: "Poupança",
    investment: "Investimento",
    wallet: "Carteira"
  };
  const typeIcons = { checking: "🏦", savings: "🐷", investment: "📈", wallet: "👛" };

  grid.innerHTML = db.accounts
    .map(a => {
      return `
      <div class="card-item" style="border-left:4px solid ${a.color}">
        <div style="font-size:28px;margin-bottom:8px">${typeIcons[a.type] || "🏦"}</div>
        <div class="card-bank">${a.bank || "Banco"}</div>
        <div class="card-name">${a.name}</div>
        <div class="card-bank" style="margin-bottom:12px">${typeLabels[a.type] || a.type}</div>
        <div style="font-size:18px;font-weight:800;color:${a.balance >= 0 ? "var(--green)" : "var(--red)"};margin-bottom:12px">${fmt(a.balance)}</div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
          <button class="btn-s" onclick="adjustBalance(${a.id})">💰 Ajustar</button>
          <button class="btn-d" onclick="removeAccount(${a.id})">✕</button>
        </div>
      </div>
    `;
    })
    .join("");
}

// ========== INVESTIMENTOS ==========
function addInvestment() {
  const name = document.getElementById("inv-name").value.trim();
  const type = document.getElementById("inv-type").value;
  const initial = parseFloat(document.getElementById("inv-initial").value) || 0;
  const current = parseFloat(document.getElementById("inv-current").value) || 0;

  if (!name || initial <= 0 || current <= 0) return alert("Preencha todos os campos");

  if (!db.investments) db.investments = [];
  db.investments.push({
    id: Date.now(),
    name,
    type,
    initial,
    current,
    createdAt: new Date().toISOString()
  });

  document.getElementById("inv-name").value = "";
  document.getElementById("inv-initial").value = "";
  document.getElementById("inv-current").value = "";

  persist();
  saveToSheets(db);
  renderInvestments();
}

function renderInvestments() {
  const grid = document.getElementById("investments-grid");
  if (!grid) return;

  if (!db.investments || !db.investments.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📈</div><div class="empty-text">Cadastre seu primeiro investimento</div></div>`;
    return;
  }

  grid.innerHTML = db.investments
    .map(inv => {
      const gain = inv.current - inv.initial;
      const gainPercent = ((gain / inv.initial) * 100).toFixed(1);
      const gainColor = gain >= 0 ? "var(--green)" : "var(--red)";

      return `
      <div class="inv-card">
        <div class="inv-header">
          <div>
            <div class="inv-name">${inv.name}</div>
            <div class="inv-type">${inv.type}</div>
          </div>
        </div>
        <div class="inv-values">
          <div class="inv-value-box">
            <div class="inv-value-label">Investido</div>
            <div class="inv-value">${fmt(inv.initial)}</div>
          </div>
          <div class="inv-value-box">
            <div class="inv-value-label">Atual</div>
            <div class="inv-value">${fmt(inv.current)}</div>
          </div>
        </div>
        <div class="inv-return" style="background:${gain >= 0 ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)"}; color:${gainColor}">
          ${gain >= 0 ? "+" : ""}${fmt(gain)} (${gainPercent}%)
        </div>
        <button class="btn-d" style="width:100%;margin-top:12px" onclick="removeInvestment(${inv.id})">Remover</button>
      </div>
    `;
    })
    .join("");
}

function removeInvestment(id) {
  if (!confirm("Remover investimento?")) return;
  db.investments = (db.investments || []).filter(i => i.id !== id);
  persist();
  renderInvestments();
}

// ========== METAS ==========
function addGoal() {
  const name = document.getElementById("goal-name").value.trim();
  const target = parseFloat(document.getElementById("goal-target").value) || 0;
  const current = parseFloat(document.getElementById("goal-current").value) || 0;
  const deadline = document.getElementById("goal-deadline").value;

  if (!name || target <= 0) return alert("Preencha nome e valor alvo");

  if (!db.goals) db.goals = [];
  db.goals.push({
    id: Date.now(),
    name,
    target,
    current,
    deadline,
    createdAt: new Date().toISOString()
  });

  document.getElementById("goal-name").value = "";
  document.getElementById("goal-target").value = "";
  document.getElementById("goal-current").value = "";
  document.getElementById("goal-deadline").value = "";

  persist();
  saveToSheets(db);
  renderGoals();
}

function renderGoals() {
  const grid = document.getElementById("goals-grid");
  if (!grid) return;

  if (!db.goals || !db.goals.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🎯</div><div class="empty-text">Defina sua primeira meta</div></div>`;
    return;
  }

  grid.innerHTML = db.goals
    .map(g => {
      const percent = Math.min(100, (g.current / g.target) * 100);
      const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

      return `
      <div class="goal-card">
        <div class="goal-header">
          <div class="goal-name">${g.name}</div>
          ${g.deadline ? `<div class="goal-deadline">${daysLeft} dias</div>` : ""}
        </div>
        <div class="goal-progress">
          <div class="goal-percent">${percent.toFixed(0)}% concluído</div>
          <div class="prog">
            <div class="pf" style="width:${percent}%;background:var(--orange)"></div>
          </div>
        </div>
        <div class="goal-values">
          <div><span class="goal-value">${fmt(g.current)}</span> de <span class="goal-value">${fmt(g.target)}</span></div>
          <button class="btn-d" onclick="removeGoal(${g.id})">✕</button>
        </div>
      </div>
    `;
    })
    .join("");
}

function removeGoal(id) {
  if (!confirm("Remover meta?")) return;
  db.goals = (db.goals || []).filter(g => g.id !== id);
  persist();
  renderGoals();
}

// ========== BUDGET 50/30/20 ==========
function updateBudget() {
  const income = parseFloat(document.getElementById("income-amount").value) || 0;
  db.income = income;

  const needs = income * 0.5;
  const wants = income * 0.3;
  const invest = income * 0.2;

  db.budget = { needs, wants, invest };

  document.getElementById("budget-needs").textContent = fmt(needs);
  document.getElementById("budget-wants").textContent = fmt(wants);
  document.getElementById("budget-invest").textContent = fmt(invest);

  document.getElementById("bar-needs").style.width = "100%";
  document.getElementById("bar-wants").style.width = "100%";
  document.getElementById("bar-invest").style.width = "100%";

  const summary = document.getElementById("budget-summary");
  if (summary) {
    summary.innerHTML = `
      <div class="row">
        <span>Necessidades (50%)</span>
        <span style="color:var(--blue)">${fmt(needs)}</span>
      </div>
      <div class="row">
        <span>Desejos (30%)</span>
        <span style="color:var(--orange)">${fmt(wants)}</span>
      </div>
      <div class="row">
        <span>Investimentos (20%)</span>
        <span style="color:var(--green)">${fmt(invest)}</span>
      </div>
    `;
  }

  persist();
  saveToSheets(db);
}

// ========== ONBOARDING ==========
function checkOnboarding() {
  const isFirstTime = !localStorage.getItem("familia_feitoza_init");
  const seenOnb = localStorage.getItem("familia_feitoza_onb_seen");

  if (isFirstTime && !seenOnb) {
    document.getElementById("onb-modal").style.display = "flex";
    onbStep = 1;
    updateOnbStep();
  }

  localStorage.setItem("familia_feitoza_init", "1");
}

function updateOnbStep() {
  document.querySelectorAll(".onb-step").forEach(s => s.classList.remove("on"));
  document.querySelector(`.onb-step[data-step="${onbStep}"]`).classList.add("on");
  document.getElementById("onb-progress-bar").style.width = (onbStep / MAX_ONB_STEPS) * 100 + "%";
}

function nextOnboarding() {
  if (onbStep === 2) {
    const income = parseFloat(document.getElementById("onb-income").value);
    if (income > 0) {
      db.income = income;
    }
  }
  if (onbStep === 3) {
    const goalName = document.getElementById("onb-goal-name").value.trim();
    const goalTarget = parseFloat(document.getElementById("onb-goal-target").value);
    if (goalName && goalTarget > 0) {
      db.goals.push({
        id: Date.now(),
        name: goalName,
        target: goalTarget,
        current: 0,
        deadline: ""
      });
    }
  }
  if (onbStep < MAX_ONB_STEPS) {
    onbStep++;
    updateOnbStep();
  }
}

function finishOnboarding() {
  localStorage.setItem("familia_feitoza_onb_seen", "1");
  document.getElementById("onb-modal").style.display = "none";
  persist();
  renderOverview();
  goTo("overview");
}

function toggleTheme() {
  document.body.style.filter = document.body.style.filter === "invert(1)" ? "" : "invert(1)";
}

function exportData() {
  const dataStr = JSON.stringify(db, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `familia-feitoza-${new Date().getTime()}.json`;
  a.click();
}

// ========== INIT ==========
function init() {
  load();
  renderOverview();
  goTo("overview");
  updateBudget();

  // Verificar se há dados do Google Sheets para sincronizar
  setTimeout(() => {
    syncWithSheets();
  }, 2000);
}

// ========== STARTUP ==========
document.addEventListener("DOMContentLoaded", () => {
  init();
  checkOnboarding();
});
