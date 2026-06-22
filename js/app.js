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
  if (page === "cards") { renderCards(); renderInsightCards(); }
  if (page === "accounts") { renderAccounts(); renderInsightAccounts(); }
  if (page === "calendar") { renderCalendar(); renderInsightCalendar(); }
  if (page === "investments") { renderInvestments(); renderInsightInvestments(); }
  if (page === "goals") { renderGoals(); renderInsightGoals(); }
  if (page === "budget") { updateBudget(); renderInsightBudget(); }
  if (page === "overview") renderOverview();
}

// ========== OVERVIEW ==========
function renderOverview() {
  // Data e saudação
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Data formatada
  const dateEl = document.getElementById("hero-date");
  if (dateEl) {
    dateEl.textContent = today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  // Patrimônio total
  const totalAccounts = (db.accounts || []).reduce((a, c) => a + (c.balance || 0), 0);
  const totalInvestments = (db.investments || []).reduce((a, c) => a + (c.current || 0), 0);
  const netWorth = totalAccounts + totalInvestments;
  const totalNetEl = document.getElementById("total-net");
  if (totalNetEl) totalNetEl.textContent = fmt(netWorth);

  // Receita e despesas do mês
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

  const income = monthlyIncome || db.income || 0;
  const balance = income - monthlyExpenses;
  const balancePct = income > 0 ? Math.min(100, Math.round((balance / income) * 100)) : 0;

  // Atualizar KPIs
  const incomeEl = document.getElementById("monthly-income");
  if (incomeEl) incomeEl.textContent = fmt(income);

  const expensesEl = document.getElementById("monthly-expenses");
  if (expensesEl) expensesEl.textContent = fmt(monthlyExpenses);

  const balanceEl = document.getElementById("monthly-balance");
  if (balanceEl) {
    balanceEl.textContent = fmt(balance);
    balanceEl.style.color = balance >= 0 ? "var(--green)" : "var(--red)";
  }

  // Barra de saldo
  const balanceBar = document.getElementById("balance-bar");
  if (balanceBar) {
    balanceBar.style.width = Math.max(0, balancePct) + "%";
    balanceBar.style.background = balance >= 0 ? "var(--green)" : "var(--red)";
  }
  const balancePctEl = document.getElementById("balance-pct");
  if (balancePctEl) balancePctEl.textContent = balancePct + "% salvo";

  const balanceSub = document.getElementById("balance-sub");
  if (balanceSub) {
    balanceSub.textContent = balance >= 0
      ? `Você economizou ${fmt(balance)} este mês ✅`
      : `Deficit de ${fmt(Math.abs(balance))} este mês ⚠️`;
  }

  // Score de saúde financeira (0-100)
  let score = 0;
  if (income > 0) score += 20;
  if (balance > 0) score += 20;
  if (balancePct >= 20) score += 20;
  if ((db.goals || []).length > 0) score += 20;
  if (netWorth > 0) score += 20;

  const healthEl = document.getElementById("health-score");
  const healthLabel = document.getElementById("health-label");
  const healthBox = document.getElementById("health-score-box");
  if (healthEl) {
    healthEl.textContent = score;
    if (score >= 80) {
      healthEl.style.color = "var(--green)";
      if (healthLabel) healthLabel.textContent = "Excelente! 🚀";
      if (healthBox) healthBox.style.borderColor = "rgba(34,197,94,0.3)";
    } else if (score >= 60) {
      healthEl.style.color = "var(--amber)";
      if (healthLabel) healthLabel.textContent = "Bom! Continue 👍";
      if (healthBox) healthBox.style.borderColor = "rgba(245,158,11,0.3)";
    } else if (score >= 40) {
      healthEl.style.color = "var(--orange)";
      if (healthLabel) healthLabel.textContent = "Atenção ⚠️";
      if (healthBox) healthBox.style.borderColor = "rgba(249,115,22,0.3)";
    } else {
      healthEl.style.color = "var(--red)";
      if (healthLabel) healthLabel.textContent = "Precisa melhorar";
      if (healthBox) healthBox.style.borderColor = "rgba(239,68,68,0.3)";
    }
  }

  // Próximos eventos
  renderUpcomingExpenses();

  // Metas na overview
  renderOverviewGoals();

  // Budget na overview
  renderOverviewBudget();

  // Chart patrimônio
  renderOverviewCharts();
}

// ========== METAS NA OVERVIEW ==========
function renderOverviewGoals() {
  const container = document.getElementById("overview-goals");
  if (!container) return;

  const goals = db.goals || [];
  if (!goals.length) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text4);font-size:13px">Nenhuma meta cadastrada ainda</div>`;
    return;
  }

  container.innerHTML = goals.slice(0, 3).map(g => {
    const pct = Math.min(100, Math.round((g.current / g.target) * 100));
    const color = pct >= 80 ? "var(--green)" : pct >= 50 ? "var(--amber)" : "var(--orange)";
    return `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:13px;font-weight:600">${g.name}</span>
          <span style="font-size:12px;color:${color};font-weight:700">${pct}%</span>
        </div>
        <div style="height:6px;background:var(--surface3);border-radius:99px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:99px;transition:width 0.7s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-size:11px;color:var(--text4)">${fmt(g.current)}</span>
          <span style="font-size:11px;color:var(--text4)">${fmt(g.target)}</span>
        </div>
      </div>
    `;
  }).join("");
}

// ========== BUDGET NA OVERVIEW ==========
function renderOverviewBudget() {
  const container = document.getElementById("overview-budget");
  if (!container) return;

  const income = db.income || 0;
  if (income <= 0) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text4);font-size:13px">Configure sua renda no Budget 50/30/20</div>`;
    return;
  }

  const needs = income * 0.5;
  const wants = income * 0.3;
  const invest = income * 0.2;

  const items = [
    { label: "Necessidades (50%)", value: needs, color: "var(--blue)" },
    { label: "Desejos (30%)", value: wants, color: "var(--orange)" },
    { label: "Investimentos (20%)", value: invest, color: "var(--green)" },
  ];

  container.innerHTML = items.map(item => `
    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12px;color:var(--text3)">${item.label}</span>
        <span style="font-size:13px;font-weight:700;color:${item.color}">${fmt(item.value)}</span>
      </div>
      <div style="height:6px;background:var(--surface3);border-radius:99px;overflow:hidden">
        <div style="height:100%;width:100%;background:${item.color};border-radius:99px;opacity:0.7"></div>
      </div>
    </div>
  `).join("");
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
  // Gráfico de composição do patrimônio (doughnut)
  const compCtx = document.getElementById("chart-composition");
  if (compCtx && compCtx.chart) compCtx.chart.destroy();

  const totalAccounts = (db.accounts || []).reduce((a, c) => a + (c.balance || 0), 0);
  const totalInvestments = (db.investments || []).reduce((a, c) => a + (c.current || 0), 0);

  if (compCtx) {
    const hasData = totalAccounts > 0 || totalInvestments > 0;
    compCtx.chart = new Chart(compCtx, {
      type: "doughnut",
      data: {
        labels: ["Contas Bancárias", "Investimentos"],
        datasets: [{
          data: hasData ? [totalAccounts, totalInvestments] : [1, 0],
          backgroundColor: hasData ? ["#3b82f6", "#f97316"] : ["#333338", "#333338"],
          borderColor: "#111113",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: "65%",
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#a1a1aa", font: { size: 11 }, padding: 16 }
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
          <div style="display:flex;gap:4px">
            <button class="btn-edit" onclick="openEditModal('card',${c.id})">✏️</button>
            <button class="btn-d" onclick="removeCard(${c.id})">✕</button>
          </div>
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
  const category = document.getElementById("evt-category").value || "Outros";
  const recurring = document.getElementById("evt-recurring").checked;

  if (!title || !date || amount <= 0) return alert("Preencha todos os campos");

  if (!db.calendar) db.calendar = [];
  db.calendar.push({
    id: Date.now(),
    title,
    date,
    amount,
    type,
    category,
    recurring,
    createdAt: new Date().toISOString()
  });

  document.getElementById("evt-title").value = "";
  document.getElementById("evt-date").value = "";
  document.getElementById("evt-amount").value = "";
  document.getElementById("evt-recurring").checked = false;

  persist();
  saveToSheets(db);
  renderCalendar();
  renderInsightCalendar();
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
      const catBadge = e.category ? `<span class="cat-badge">${e.category}</span>` : "";
      const recBadge = e.recurring ? `<span style="color:var(--orange);font-size:10px;font-weight:700">🔄 recorrente</span>` : "";

      return `
      <div class="row">
        <div style="display:flex;gap:12px;align-items:center">
          <span style="font-size:18px">${icon}</span>
          <div>
            <div style="font-weight:600">${e.title}</div>
            <div style="font-size:11px;color:var(--text4);display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap">
              ${fmtDate(e.date)} ${catBadge} ${recBadge}
            </div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <div style="font-weight:700;color:${color}">${fmt(e.amount)}</div>
          <div style="display:flex;gap:4px">
            <button class="btn-edit" onclick="openEditModal('calendar',${e.id})">✏️</button>
            <button class="btn-d" onclick="removeCalendarEvent(${e.id})">✕</button>
          </div>
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
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:8px">
          <button class="btn-s" onclick="adjustBalance(${a.id})">💰 Ajustar</button>
          <button class="btn-edit" onclick="openEditModal('account',${a.id})">✏️</button>
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
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
          <button class="btn-edit full" onclick="openEditModal('investment',${inv.id})">✏️ Editar</button>
          <button class="btn-d" style="width:100%" onclick="removeInvestment(${inv.id})">Remover</button>
        </div>
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
          <div style="display:flex;gap:4px">
            <button class="btn-edit" onclick="openEditModal('goal',${g.id})">✏️</button>
            <button class="btn-d" onclick="removeGoal(${g.id})">✕</button>
          </div>
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

// ========== FLOATING ACTION BUTTON ==========
function openFab() {
  const modal = document.getElementById("fab-modal");
  modal.classList.add("open");
  // Preencher data de hoje
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("fab-date").value = today;
  document.getElementById("fab-title").focus();
}

function closeFab() {
  document.getElementById("fab-modal").classList.remove("open");
  document.getElementById("fab-title").value = "";
  document.getElementById("fab-amount").value = "";
  document.getElementById("fab-date").value = "";
}

function closeFabOnOverlay(e) {
  if (e.target === document.getElementById("fab-modal")) closeFab();
}

function saveFab() {
  const title = document.getElementById("fab-title").value.trim();
  const amount = parseFloat(document.getElementById("fab-amount").value) || 0;
  const type = document.getElementById("fab-type").value;
  const date = document.getElementById("fab-date").value;
  const category = document.getElementById("fab-category").value || "Outros";
  const recurring = document.getElementById("fab-recurring").checked;

  if (!title || amount <= 0 || !date) return;

  if (!db.calendar) db.calendar = [];
  db.calendar.push({
    id: Date.now(),
    title,
    date,
    amount,
    type,
    category,
    recurring,
    createdAt: new Date().toISOString()
  });

  persist();
  saveToSheets(db);
  closeFab();
  showToast("✅ Salvo!");

  // Atualiza a seção ativa se for calendário ou overview
  const calSec = document.getElementById("sec-calendar");
  if (calSec && calSec.classList.contains("on")) { renderCalendar(); renderInsightCalendar(); }
  const ovSec = document.getElementById("sec-overview");
  if (ovSec && ovSec.classList.contains("on")) renderOverview();
}

// ESC fecha modais
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeFab(); closeEditModal(); }
});

// ========== TOAST ==========
function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ========== INSIGHTS ==========
function insightHTML(items) {
  return `<div class="insight-strip">${items.map(i => `
    <div class="insight-item">
      <div class="insight-label">${i.label}</div>
      <div class="insight-value" style="color:${i.color || "var(--text)"}">${i.value}</div>
      ${i.sub ? `<div class="insight-sub">${i.sub}</div>` : ""}
    </div>`).join("")}</div>`;
}

function renderInsightCards() {
  const el = document.getElementById("insight-cards");
  if (!el) return;
  const cards = db.cards || [];
  if (!cards.length) { el.innerHTML = ""; return; }
  const totalLimit = cards.reduce((a, c) => a + (c.limit || 0), 0);
  const totalUsed = cards.reduce((a, c) => a + (c.used || 0), 0);
  const available = totalLimit - totalUsed;
  const pct = totalLimit > 0 ? ((totalUsed / totalLimit) * 100).toFixed(0) : 0;
  const color = pct > 80 ? "var(--red)" : pct > 50 ? "var(--amber)" : "var(--green)";
  el.innerHTML = insightHTML([
    { label: "Limite Total", value: fmt(totalLimit), color: "var(--text)" },
    { label: "Utilizado", value: fmt(totalUsed), color, sub: pct + "% do limite" },
    { label: "Disponível", value: fmt(available), color: "var(--green)" },
    { label: "Cartões", value: cards.length, sub: "cadastrados" }
  ]);
}

function renderInsightCalendar() {
  const el = document.getElementById("insight-calendar");
  if (!el) return;
  const today = new Date();
  const m = today.getMonth(), y = today.getFullYear();
  const events = db.calendar || [];
  const receitas = events.filter(e => { const d = new Date(e.date); return d.getMonth()===m && d.getFullYear()===y && e.type==="Receita"; }).reduce((a,e)=>a+(e.amount||0),0);
  const despesas = events.filter(e => { const d = new Date(e.date); return d.getMonth()===m && d.getFullYear()===y && e.type==="Despesa"; }).reduce((a,e)=>a+(e.amount||0),0);
  const saldo = receitas - despesas;
  // Categoria com maior gasto no mês
  const catMap = {};
  events.filter(e => { const d = new Date(e.date); return d.getMonth()===m && d.getFullYear()===y && e.type==="Despesa"; })
    .forEach(e => { const c = e.category || "Outros"; catMap[c] = (catMap[c]||0) + (e.amount||0); });
  const topCat = Object.entries(catMap).sort((a,b)=>b[1]-a[1])[0];
  el.innerHTML = insightHTML([
    { label: "Receitas do Mês", value: fmt(receitas), color: "var(--green)" },
    { label: "Despesas do Mês", value: fmt(despesas), color: "var(--red)" },
    { label: "Saldo do Mês", value: fmt(saldo), color: saldo >= 0 ? "var(--green)" : "var(--red)" },
    { label: "Eventos", value: events.length, sub: "no total" },
    ...(topCat ? [{ label: "Maior Gasto", value: topCat[0], sub: fmt(topCat[1]), color: "var(--amber)" }] : [])
  ]);
}

function renderInsightAccounts() {
  const el = document.getElementById("insight-accounts");
  if (!el) return;
  const accounts = db.accounts || [];
  if (!accounts.length) { el.innerHTML = ""; return; }
  const total = accounts.reduce((a, c) => a + (c.balance || 0), 0);
  const maior = accounts.reduce((a, c) => c.balance > a.balance ? c : a, accounts[0]);
  el.innerHTML = insightHTML([
    { label: "Patrimônio Total", value: fmt(total), color: "var(--orange)" },
    { label: "Maior Conta", value: maior.name, sub: fmt(maior.balance) },
    { label: "Contas", value: accounts.length, sub: "cadastradas" }
  ]);
}

function renderInsightInvestments() {
  const el = document.getElementById("insight-investments");
  if (!el) return;
  const invs = db.investments || [];
  if (!invs.length) { el.innerHTML = ""; return; }
  const totalInicial = invs.reduce((a, i) => a + (i.initial || 0), 0);
  const totalAtual = invs.reduce((a, i) => a + (i.current || 0), 0);
  const rentTotal = totalInicial > 0 ? (((totalAtual - totalInicial) / totalInicial) * 100).toFixed(1) : 0;
  const rentColor = totalAtual >= totalInicial ? "var(--green)" : "var(--red)";
  const melhor = invs.reduce((a, i) => {
    const ra = ((a.current - a.initial) / a.initial);
    const ri = ((i.current - i.initial) / i.initial);
    return ri > ra ? i : a;
  }, invs[0]);
  el.innerHTML = insightHTML([
    { label: "Total Investido", value: fmt(totalInicial), color: "var(--text)" },
    { label: "Valor Atual", value: fmt(totalAtual), color: rentColor },
    { label: "Rentabilidade", value: (totalAtual >= totalInicial ? "+" : "") + rentTotal + "%", color: rentColor },
    { label: "Melhor Ativo", value: melhor.name, sub: (((melhor.current - melhor.initial) / melhor.initial) * 100).toFixed(1) + "%" }
  ]);
}

function renderInsightGoals() {
  const el = document.getElementById("insight-goals");
  if (!el) return;
  const goals = db.goals || [];
  if (!goals.length) { el.innerHTML = ""; return; }
  const today = new Date();
  const noPrazo = goals.filter(g => !g.deadline || new Date(g.deadline) >= today).length;
  const atrasadas = goals.filter(g => g.deadline && new Date(g.deadline) < today && g.current < g.target).length;
  const concluidas = goals.filter(g => g.current >= g.target).length;
  el.innerHTML = insightHTML([
    { label: "Total de Metas", value: goals.length, color: "var(--text)" },
    { label: "No Prazo", value: noPrazo, color: "var(--green)" },
    { label: "Atrasadas", value: atrasadas, color: atrasadas > 0 ? "var(--red)" : "var(--green)" },
    { label: "Concluídas", value: concluidas, color: "var(--orange)" }
  ]);
}

function renderInsightBudget() {
  const el = document.getElementById("insight-budget");
  if (!el) return;
  const income = db.income || 0;
  if (!income) { el.innerHTML = ""; return; }
  const despesas = (db.calendar || [])
    .filter(e => { const d = new Date(e.date); return d.getMonth()===new Date().getMonth() && e.type==="Despesa"; })
    .reduce((a, e) => a + (e.amount || 0), 0);
  const needs = income * 0.5;
  const wants = income * 0.3;
  const invest = income * 0.2;
  const dentroNecessidades = despesas <= needs;
  const sobra = income - despesas;
  el.innerHTML = insightHTML([
    { label: "Renda Mensal", value: fmt(income), color: "var(--text)" },
    { label: "Necessidades (50%)", value: fmt(needs), color: "var(--blue)" },
    { label: "Desejos (30%)", value: fmt(wants), color: "var(--orange)" },
    { label: "Investimentos (20%)", value: fmt(invest), color: "var(--green)" },
    { label: "Saldo Livre", value: fmt(sobra), color: sobra >= 0 ? "var(--green)" : "var(--red)", sub: dentroNecessidades ? "✅ Dentro do 50%" : "⚠️ Acima do 50%" }
  ]);
}

// ========== EDIT MODAL ==========
const CATEGORIES = ["Alimentação","Transporte","Moradia","Saúde","Lazer","Educação","Salário","Outros"];

function openEditModal(type, id) {
  const modal = document.getElementById("edit-modal");
  modal.dataset.type = type;
  modal.dataset.id = id;
  const catOpts = CATEGORIES.map(c => `<option value="${c}">{CAT}</option>`).join("");

  let html = "";
  if (type === "calendar") {
    const item = (db.calendar || []).find(e => e.id === id);
    if (!item) return;
    document.getElementById("edit-modal-title").textContent = "Editar Evento";
    const typeOpts = ["Despesa","Receita","Meta"].map(t => `<option ${item.type===t?"selected":""}>${t}</option>`).join("");
    const cOpts = CATEGORIES.map(c => `<option value="${c}" ${item.category===c?"selected":""}>${c}</option>`).join("");
    html = `
      <input type="text" class="finp" id="e-title" value="${item.title}" placeholder="Título">
      <input type="number" class="finp" id="e-amount" value="${item.amount}" placeholder="Valor">
      <select class="finp" id="e-type">${typeOpts}</select>
      <select class="finp" id="e-category"><option value="">Categoria</option>${cOpts}</select>
      <input type="date" class="finp" id="e-date" value="${item.date}">
      <label class="toggle-label"><input type="checkbox" id="e-recurring" ${item.recurring?"checked":""}> 🔄 Recorrente mensal</label>`;
  } else if (type === "card") {
    const item = (db.cards || []).find(c => c.id === id);
    if (!item) return;
    document.getElementById("edit-modal-title").textContent = "Editar Cartão";
    html = `
      <input type="text" class="finp" id="e-name" value="${item.name}" placeholder="Nome">
      <input type="number" class="finp" id="e-limit" value="${item.limit}" placeholder="Limite (R$)">
      <input type="number" class="finp" id="e-used" value="${item.used}" placeholder="Utilizado (R$)">
      <input type="text" class="finp" id="e-bank" value="${item.bank}" placeholder="Banco">
      <input type="text" class="finp" id="e-color" value="${item.color}" placeholder="Cor (#f97316)">`;
  } else if (type === "account") {
    const item = (db.accounts || []).find(a => a.id === id);
    if (!item) return;
    document.getElementById("edit-modal-title").textContent = "Editar Conta";
    const tOpts = [["checking","Conta Corrente"],["savings","Poupança"],["investment","Investimento"],["wallet","Carteira"]]
      .map(([v,l]) => `<option value="${v}" ${item.type===v?"selected":""}>${l}</option>`).join("");
    html = `
      <input type="text" class="finp" id="e-name" value="${item.name}" placeholder="Nome">
      <input type="text" class="finp" id="e-bank" value="${item.bank}" placeholder="Banco">
      <input type="number" class="finp" id="e-balance" value="${item.balance}" placeholder="Saldo (R$)">
      <select class="finp" id="e-type">${tOpts}</select>`;
  } else if (type === "investment") {
    const item = (db.investments || []).find(i => i.id === id);
    if (!item) return;
    document.getElementById("edit-modal-title").textContent = "Editar Investimento";
    const tOpts = [["stock","Ação"],["fund","Fundo"],["crypto","Cripto"],["fixed","Renda Fixa"],["other","Outro"]]
      .map(([v,l]) => `<option value="${v}" ${item.type===v?"selected":""}>${l}</option>`).join("");
    html = `
      <input type="text" class="finp" id="e-name" value="${item.name}" placeholder="Nome">
      <select class="finp" id="e-type">${tOpts}</select>
      <input type="number" class="finp" id="e-initial" value="${item.initial}" placeholder="Valor inicial (R$)">
      <input type="number" class="finp" id="e-current" value="${item.current}" placeholder="Valor atual (R$)">`;
  } else if (type === "goal") {
    const item = (db.goals || []).find(g => g.id === id);
    if (!item) return;
    document.getElementById("edit-modal-title").textContent = "Editar Meta";
    html = `
      <input type="text" class="finp" id="e-name" value="${item.name}" placeholder="Nome da meta">
      <input type="number" class="finp" id="e-target" value="${item.target}" placeholder="Valor alvo (R$)">
      <input type="number" class="finp" id="e-current" value="${item.current}" placeholder="Valor atual (R$)">
      <input type="date" class="finp" id="e-deadline" value="${item.deadline || ""}">`;
  }

  document.getElementById("edit-modal-body").innerHTML = html;
  modal.classList.add("open");
}

function saveEdit() {
  const modal = document.getElementById("edit-modal");
  const type = modal.dataset.type;
  const id = parseFloat(modal.dataset.id);

  if (type === "calendar") {
    const item = (db.calendar || []).find(e => e.id === id);
    if (!item) return;
    item.title = document.getElementById("e-title").value.trim();
    item.amount = parseFloat(document.getElementById("e-amount").value) || 0;
    item.type = document.getElementById("e-type").value;
    item.category = document.getElementById("e-category").value;
    item.date = document.getElementById("e-date").value;
    item.recurring = document.getElementById("e-recurring").checked;
    persist(); saveToSheets(db); renderCalendar(); renderInsightCalendar();
  } else if (type === "card") {
    const item = (db.cards || []).find(c => c.id === id);
    if (!item) return;
    item.name = document.getElementById("e-name").value.trim();
    item.limit = parseFloat(document.getElementById("e-limit").value) || 0;
    item.used = parseFloat(document.getElementById("e-used").value) || 0;
    item.bank = document.getElementById("e-bank").value.trim();
    item.color = document.getElementById("e-color").value;
    persist(); saveToSheets(db); renderCards(); renderInsightCards();
  } else if (type === "account") {
    const item = (db.accounts || []).find(a => a.id === id);
    if (!item) return;
    item.name = document.getElementById("e-name").value.trim();
    item.bank = document.getElementById("e-bank").value.trim();
    item.balance = parseFloat(document.getElementById("e-balance").value) || 0;
    item.type = document.getElementById("e-type").value;
    persist(); saveToSheets(db); renderAccounts(); renderInsightAccounts();
  } else if (type === "investment") {
    const item = (db.investments || []).find(i => i.id === id);
    if (!item) return;
    item.name = document.getElementById("e-name").value.trim();
    item.type = document.getElementById("e-type").value;
    item.initial = parseFloat(document.getElementById("e-initial").value) || 0;
    item.current = parseFloat(document.getElementById("e-current").value) || 0;
    persist(); saveToSheets(db); renderInvestments(); renderInsightInvestments();
  } else if (type === "goal") {
    const item = (db.goals || []).find(g => g.id === id);
    if (!item) return;
    item.name = document.getElementById("e-name").value.trim();
    item.target = parseFloat(document.getElementById("e-target").value) || 0;
    item.current = parseFloat(document.getElementById("e-current").value) || 0;
    item.deadline = document.getElementById("e-deadline").value;
    persist(); saveToSheets(db); renderGoals(); renderInsightGoals();
  }

  closeEditModal();
  showToast("✅ Atualizado!");
}

function closeEditModal() {
  const modal = document.getElementById("edit-modal");
  if (modal) modal.classList.remove("open");
}

function closeEditOnOverlay(e) {
  if (e.target === document.getElementById("edit-modal")) closeEditModal();
}

// ========== TRANSAÇÕES RECORRENTES ==========
function generateRecurring() {
  const today = new Date();
  const m = today.getMonth(), y = today.getFullYear();
  const recurring = (db.calendar || []).filter(e => e.recurring && !e.parentId);
  let added = false;

  recurring.forEach(ev => {
    const origDate = new Date(ev.date);
    // Já está no mês corrente — não duplicar
    if (origDate.getMonth() === m && origDate.getFullYear() === y) return;
    // Já existe instância para este mês
    const exists = (db.calendar || []).some(x =>
      x.parentId === ev.id &&
      new Date(x.date).getMonth() === m &&
      new Date(x.date).getFullYear() === y
    );
    if (exists) return;
    // Criar instância
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(origDate.getDate(), lastDay);
    const newDate = new Date(y, m, day).toISOString().split("T")[0];
    db.calendar.push({
      id: Date.now() + Math.random(),
      title: ev.title,
      date: newDate,
      amount: ev.amount,
      type: ev.type,
      category: ev.category || "Outros",
      recurring: false,
      parentId: ev.id,
      createdAt: new Date().toISOString()
    });
    added = true;
  });

  if (added) persist();
}

// ========== INIT ==========
function init() {
  load();
  generateRecurring();
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
