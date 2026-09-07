// ============================================================
// FAMILIA FEITOZA — APP.JS
// Staff-level refactor: event delegation, XSS-safe, modular.
// Todas as funcionalidades preservadas + melhorias SaaS Premium.
// ============================================================
'use strict';

// ============================================================
// 1. ESTADO GLOBAL
// ============================================================
let db = deepClone(DEFAULT_DB);

const STATE = {
  page:        'overview',
  // Estado do calendário
  calMonth:    new Date().getMonth(),
  calYear:     new Date().getFullYear(),
  calFilter:   'all',
  calSearch:   '',
  // Estado da visão geral (mês selecionado)
  ovMonth:     new Date().getMonth(),
  ovYear:      new Date().getFullYear(),
  onbStep:     0,
  editType:    null,
  editId:      null,
  confirmCb:   null,
  syncing:     false,
};

// ============================================================
// 2. PERSISTÊNCIA
// ============================================================
let _persistScheduled = false;

function persist() {
  if (_persistScheduled) return;
  _persistScheduled = true;
  requestAnimationFrame(() => {
    _persistScheduled = false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      showToast('⚠️ Erro ao salvar: storage cheio.', 'error');
      console.error('[FF] persist error:', e);
    }
  });
}

function persistFlush() {
  _persistScheduled = false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('[FF] persistFlush error:', e);
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      db = { ...deepClone(DEFAULT_DB), ...parsed };
    }
  } catch (e) {
    console.error('[FF] load error:', e);
    db = deepClone(DEFAULT_DB);
    showToast('⚠️ DB corrompido, usando padrão.', 'error');
  }
}

function saveAll() {
  persist();
  try { saveToSheets(db); } catch (_) {}
}

// ============================================================
// 3. NAVEGAÇÃO
// ============================================================
function goTo(page) {
  STATE.page = page;

  document.querySelectorAll('.sb-item').forEach(el => {
    const isActive = el.dataset.page === page;
    el.classList.toggle('on', isActive);
    el.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  document.querySelectorAll('.sec').forEach(el => {
    el.classList.toggle('on', el.id === `sec-${page}`);
  });

  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-overlay')?.classList.remove('show');

  const skeletonMap = {
    overview:    '<div class="kpi-grid"><div class="skeleton skeleton--kpi"></div><div class="skeleton skeleton--kpi"></div><div class="skeleton skeleton--kpi"></div><div class="skeleton skeleton--kpi"></div></div>',
    cards:       '<div class="skeleton skeleton--card"></div>',
    calendar:    '<div class="skeleton skeleton--row"></div><div class="skeleton skeleton--row"></div><div class="skeleton skeleton--row"></div>',
    budget:      '<div class="skeleton skeleton--chart"></div>',
    accounts:    '<div class="skeleton skeleton--card"></div>',
    investments: '<div class="skeleton skeleton--card"></div>',
    goals:       '<div class="skeleton skeleton--card"></div>',
  };

  const skeletonTargets = {
    overview:    'overview-kpis',
    cards:       'cards-list',
    calendar:    'calendar-list',
    budget:      null,
    accounts:    'accounts-list',
    investments: 'investments-list',
    goals:       'goals-list',
  };

  const skelTarget = skeletonTargets[page];
  if (skelTarget && skeletonMap[page]) {
    const skelEl = document.getElementById(skelTarget);
    if (skelEl) skelEl.innerHTML = skeletonMap[page];
  }

  const renders = {
    overview:    renderOverview,
    cards:       () => { renderCards(); renderInsightCards(); },
    calendar:    () => { renderCalendar(); renderInsightCalendar(); renderChartCalendar(); },
    budget:      () => { renderBudgetVisual(); renderInsightBudget(); },
    accounts:    () => { renderAccounts(); renderTransfers(); renderInsightAccounts(); renderChartAccounts(); },
    investments: () => { renderInvestments(); renderInsightInvestments(); renderChartInvestments(); },
    goals:       () => { renderGoals(); renderInsightGoals(); },
  };
  if (renders[page]) renders[page]();

  document.getElementById(`sec-${page}`)?.focus();
}

// ============================================================
// 4. OVERVIEW
// ============================================================
function renderOverview() {
  const label = document.getElementById('ov-month-label');
  if (label) label.textContent = fmtMonth(STATE.ovMonth, STATE.ovYear);
  renderAlerts();
  renderKPIs();
  renderUpcomingExpenses();
  renderOverviewGoals();
  renderOverviewBudget();
  renderOverviewComparison();
  renderInsightOverview();
  renderChartPatrimonio();
}

function ovPrevMonth() {
  STATE.ovMonth--;
  if (STATE.ovMonth < 0) { STATE.ovMonth = 11; STATE.ovYear--; }
  renderOverview();
}

function ovNextMonth() {
  STATE.ovMonth++;
  if (STATE.ovMonth > 11) { STATE.ovMonth = 0; STATE.ovYear++; }
  renderOverview();
}

function renderKPIs() {
  const month = STATE.ovMonth;
  const year  = STATE.ovYear;
  const now   = new Date();

  const monthEvents = db.calendar.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const totalReceitas = monthEvents.filter(e => e.type === 'Receita').reduce((a, e) => a + Number(e.amount || 0), 0);
  const totalDespesas = monthEvents.filter(e => e.type === 'Despesa').reduce((a, e) => a + Number(e.amount || 0), 0);
  const saldoMes      = totalReceitas - totalDespesas;
  const patrimonio    = db.accounts.reduce((a, acc) => a + Number(acc.balance || 0), 0)
                      + db.investments.reduce((a, inv) => a + Number(inv.current || 0), 0);

  // Dias passados: só faz sentido para o mês atual
  const isCurrentMonth = month === now.getMonth() && year === now.getFullYear();
  const diasPassados   = isCurrentMonth ? now.getDate() : new Date(year, month + 1, 0).getDate();
  const gastoDiario    = diasPassados > 0 ? totalDespesas / diasPassados : 0;
  const diasMes        = new Date(year, month + 1, 0).getDate();
  const projecao       = isCurrentMonth ? gastoDiario * diasMes : totalDespesas;

  const catMap = {};
  monthEvents.filter(e => e.type === 'Despesa').forEach(e => {
    catMap[e.category || 'Outros'] = (catMap[e.category || 'Outros'] || 0) + Number(e.amount || 0);
  });
  const maiorCat = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0];

  // Sparkline data: last 6 months saldo and patrimônio
  const sparkSaldo = [];
  const sparkPatrimonio = [];
  for (let i = 5; i >= 0; i--) {
    const sm = new Date(year, month - i, 1);
    const smMonth = sm.getMonth();
    const smYear = sm.getFullYear();
    const smEvents = db.calendar.filter(e => {
      if (!e.date) return false;
      const d = new Date(e.date + 'T00:00:00');
      return d.getMonth() === smMonth && d.getFullYear() === smYear;
    });
    const smRec = smEvents.filter(e => e.type === 'Receita').reduce((a, e) => a + Number(e.amount || 0), 0);
    const smDes = smEvents.filter(e => e.type === 'Despesa').reduce((a, e) => a + Number(e.amount || 0), 0);
    sparkSaldo.push(smRec - smDes);
    sparkPatrimonio.push(
      db.accounts.reduce((a, acc) => a + Number(acc.balance || 0), 0) +
      db.investments.reduce((a, inv) => a + Number(inv.current || 0), 0)
    );
  }

  const kpis = [
    { label: 'Saldo do Mês',            value: fmt(saldoMes),      icon: '💵', color: saldoMes >= 0 ? 'green' : 'red', sub: saldoMes >= 0 ? 'Positivo' : 'Negativo', hero: true, sparkId: 'spark-saldo', sparkData: sparkSaldo, sparkColor: saldoMes >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'Patrimônio Líquido',      value: fmt(patrimonio),    icon: '🏛️', color: 'blue',   sub: 'Contas + Investimentos', hero: true, sparkId: 'spark-patrimonio', sparkData: sparkPatrimonio, sparkColor: '#3b82f6' },
    { label: 'Receitas do Mês',         value: fmt(totalReceitas), icon: '📥', color: 'green',  sub: 'Entradas' },
    { label: 'Despesas do Mês',         value: fmt(totalDespesas), icon: '📤', color: 'red',    sub: 'Saídas' },
    { label: 'Gasto Médio Diário',      value: fmt(gastoDiario),   icon: '📅', color: 'orange', sub: isCurrentMonth ? `Baseado em ${diasPassados} dias` : `Média do mês` },
    { label: isCurrentMonth ? 'Projeção Fim do Mês' : 'Total de Despesas', value: fmt(projecao), icon: '🔮', color: projecao > (db.income || 0) * 1.1 ? 'red' : 'green', sub: isCurrentMonth ? `Projeção para ${diasMes} dias` : MONTHS_PT[month] },
    { label: 'Renda Mensal',            value: fmt(db.income),     icon: '💼', color: 'purple', sub: 'Configurada no budget' },
    { label: 'Maior Categoria de Gasto',value: maiorCat ? `${catIcon(maiorCat[0])} ${maiorCat[0]}` : '—', icon: '🔝', color: 'orange', sub: maiorCat ? fmt(maiorCat[1]) : 'Sem despesas' },
  ];

  const el = document.getElementById('overview-kpis');
  if (!el) return;
  el.innerHTML = kpis.map(k => `
    <div class="kpi-card kpi-card--${esc(k.color)} ${k.hero ? 'kpi-card--hero' : ''}" role="figure" aria-label="${esc(k.label)}: ${esc(k.value)}" title="${esc(k.label)}: ${esc(k.value)} — ${esc(k.sub)}">
      <div class="kpi-icon" aria-hidden="true">${k.icon}</div>
      <div class="kpi-body">
        <div class="kpi-label">${esc(k.label)}</div>
        <div class="kpi-value">${esc(k.value)}</div>
        <div class="kpi-sub">${esc(k.sub)}</div>
      </div>
      ${k.hero ? `<canvas class="kpi-sparkline" id="${k.sparkId}" width="100" height="36" aria-hidden="true"></canvas>` : ''}
    </div>
  `).join('');

  // Render sparklines
  if (typeof Chart !== 'undefined') {
    kpis.filter(k => k.hero && k.sparkId).forEach(k => {
      const canvas = document.getElementById(k.sparkId);
      if (!canvas) return;
      new Chart(canvas, {
        type: 'line',
        data: {
          labels: ['',''],
          datasets: [{
            data: k.sparkData,
            borderColor: k.sparkColor,
            borderWidth: 2,
            fill: true,
            backgroundColor: k.sparkColor + '18',
            pointRadius: 0,
            tension: 0.4,
          }]
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
          animation: { duration: 600 },
        }
      });
    });
  }

  if (typeof gsap !== 'undefined') {
    gsap.from('.kpi-card', { opacity: 0, y: 16, stagger: 0.06, duration: 0.4, ease: 'power2.out' });
  }
}

function renderUpcomingExpenses() {
  const el = document.getElementById('upcoming-list');
  if (!el) return;
  const today = todayStr();
  const items = db.calendar
    .filter(e => e.date >= today && isWithinDays(e.date, 14))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-illustration empty-illustration--calendar"></div><p class="empty-title">Nenhum vencimento nos próximos 14 dias</p><p class="empty-desc">Adicione receitas ou despesas para acompanhar seus compromissos.</p></div>';
    return;
  }
  el.innerHTML = items.map(e => `
    <div class="upcoming-item">
      <span class="type-dot type-dot--${esc(e.type)}" aria-hidden="true"></span>
      <div class="upcoming-info">
        <span class="upcoming-title">${esc(e.title)}</span>
        <span class="upcoming-date muted">${fmtDate(e.date)}</span>
      </div>
      <span class="upcoming-amount ${e.type === 'Receita' ? 'positive' : ''}">${fmt(e.amount)}</span>
    </div>
  `).join('');
}

function renderOverviewGoals() {
  const el = document.getElementById('overview-goals');
  if (!el) return;
  const goals = db.goals.slice(0, 4);
  if (!goals.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-illustration empty-illustration--goal"></div><p class="empty-title">Nenhuma meta cadastrada</p><p class="empty-desc">Defina metas de economia para alcançar seus objetivos.</p></div>';
    return;
  }
  el.innerHTML = goals.map(g => {
    const p = pct(Number(g.saved), Number(g.target));
    return `
      <div class="mini-goal">
        <div class="mini-goal-header">
          <span>${esc(g.name)}</span>
          <span class="mini-goal-pct">${p.toFixed(0)}%</span>
        </div>
        <div class="progress-bar" role="progressbar" aria-valuenow="${p.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill" style="width:${p}%"></div>
        </div>
        <div class="mini-goal-values"><span>${fmt(g.saved)}</span><span>${fmt(g.target)}</span></div>
      </div>
    `;
  }).join('');
}

function renderOverviewBudget() {
  const el = document.getElementById('overview-budget');
  if (!el) return;
  const inc = Number(db.income) || 0;
  const { needs, wants, invest } = db.budget;
  const buckets = [
    { label: 'Necessidades', pct: needs,  color: 'green',  amount: inc * needs  / 100 },
    { label: 'Desejos',      pct: wants,  color: 'orange', amount: inc * wants  / 100 },
    { label: 'Investimentos',pct: invest, color: 'blue',   amount: inc * invest / 100 },
  ];
  el.innerHTML = buckets.map(b => `
    <div class="budget-bucket">
      <div class="budget-bucket-header">
        <span>${esc(b.label)}</span>
        <span>${b.pct}% · ${fmt(b.amount)}</span>
      </div>
      <div class="progress-bar" role="progressbar" aria-valuenow="${b.pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-fill progress-fill--${esc(b.color)}" style="width:${b.pct}%"></div>
      </div>
    </div>
  `).join('');
}

function getMonthTotals(month, year) {
  const events = db.calendar.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const receitas = events.filter(e => e.type === 'Receita').reduce((a, e) => a + Number(e.amount || 0), 0);
  const despesas = events.filter(e => e.type === 'Despesa').reduce((a, e) => a + Number(e.amount || 0), 0);
  return { receitas, despesas, saldo: receitas - despesas };
}

function renderOverviewComparison() {
  const el = document.getElementById('overview-comparison');
  if (!el) return;

  const curMonth = STATE.ovMonth;
  const curYear  = STATE.ovYear;
  let prevMonth = curMonth - 1;
  let prevYear  = curYear;
  if (prevMonth < 0) { prevMonth = 11; prevYear--; }

  const cur  = getMonthTotals(curMonth, curYear);
  const prev = getMonthTotals(prevMonth, prevYear);

  function pctChange(curVal, prevVal) {
    if (prevVal === 0) return curVal > 0 ? '+∞' : '0%';
    const change = ((curVal - prevVal) / Math.abs(prevVal)) * 100;
    return `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`;
  }
  function arrow(curVal, prevVal) {
    return curVal > prevVal ? '↑' : curVal < prevVal ? '↓' : '→';
  }
  function changeColor(curVal, prevVal, invert) {
    const up = curVal > prevVal;
    if (invert) return up ? 'var(--red)' : 'var(--green)';
    return up ? 'var(--green)' : 'var(--red)';
  }

  const rows = [
    { label: 'Receitas',  cur: cur.receitas,  prev: prev.receitas,  invert: false },
    { label: 'Despesas',  cur: cur.despesas,  prev: prev.despesas,  invert: true },
    { label: 'Saldo',     cur: cur.saldo,     prev: prev.saldo,     invert: false },
  ];

  el.innerHTML = `
    <div class="comparison-header">
      <span class="muted">${MONTHS_PT[prevMonth]} ${prevYear}</span>
      <span class="muted">→</span>
      <span class="muted">${MONTHS_PT[curMonth]} ${curYear}</span>
    </div>
    ${rows.map(r => `
      <div class="comparison-row">
        <span class="comparison-label">${r.label}</span>
        <span class="comparison-prev">${fmt(r.prev)}</span>
        <span class="comparison-arrow" style="color:${changeColor(r.cur, r.prev, r.invert)}">${arrow(r.cur, r.prev)}</span>
        <span class="comparison-cur">${fmt(r.cur)}</span>
        <span class="comparison-pct" style="color:${changeColor(r.cur, r.prev, r.invert)}">${pctChange(r.cur, r.prev)}</span>
      </div>
    `).join('')}
  `;
}

// ============================================================
// 5. ALERTAS
// ============================================================
function renderAlerts() {
  const el = document.getElementById('alerts-container');
  if (!el) return;
  const alerts = [];
  const today  = todayStr();
  const income = Number(db.income) || 0;

  db.cards.forEach(c => {
    const usedPct = pct(Number(c.used || 0), Number(c.limit || 1));
    if (usedPct >= 80) alerts.push({ type: 'warning', msg: `💳 ${esc(c.name)}: ${usedPct.toFixed(0)}% do limite utilizado` });
  });

  db.goals.forEach(g => {
    if (g.deadline && g.deadline < today && Number(g.saved) < Number(g.target)) {
      alerts.push({ type: 'error', msg: `🎯 Meta "${esc(g.name)}" está atrasada` });
    }
  });

  if (income > 0) {
    const monthDespesas = db.calendar
      .filter(e => {
        if (e.type !== 'Despesa' || !e.date) return false;
        const d = new Date(e.date + 'T00:00:00');
        return d.getMonth() === STATE.ovMonth && d.getFullYear() === STATE.ovYear;
      })
      .reduce((a, e) => a + Number(e.amount || 0), 0);
    if (monthDespesas > income * 0.5) {
      alerts.push({ type: 'warning', msg: `📤 Despesas de ${MONTHS_PT[STATE.ovMonth]} (${fmt(monthDespesas)}) ultrapassam 50% da renda` });
    }
  }

  el.innerHTML = alerts.map(a => `
    <div class="alert alert--${esc(a.type)}" role="alert">${a.msg}</div>
  `).join('');
}

// ============================================================
// 6. CARTÕES
// ============================================================
function addCard() {
  const name  = document.getElementById('card-name')?.value.trim();
  const limit = Number(document.getElementById('card-limit')?.value) || 0;
  const used  = Number(document.getElementById('card-used')?.value)  || 0;
  const due   = Number(document.getElementById('card-due')?.value)   || 0;

  if (!name)    { showToast('❌ Informe o nome do cartão', 'error'); return; }
  if (limit <= 0){ showToast('❌ Informe um limite válido', 'error'); return; }

  db.cards.push({ id: uid(), name, limit, used, due, createdAt: new Date().toISOString() });
  saveAll();
  renderCards();
  renderInsightCards();
  clearForm(['card-name', 'card-limit', 'card-used', 'card-due']);
  showToast('✅ Cartão adicionado!');
}

function removeCard(id) {
  const card = db.cards.find(c => c.id === id);
  showConfirm(`Remover o cartão "${card?.name || 'este cartão'}"?`, () => {
    db.cards = db.cards.filter(c => c.id !== id);
    saveAll();
    renderCards();
    renderInsightCards();
    showToast('🗑️ Cartão removido.');
  });
}

function renderCards() {
  const el = document.getElementById('cards-list');
  if (!el) return;
  if (!db.cards.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-illustration empty-illustration--card"></div><p class="empty-title">Nenhum cartão cadastrado</p><p class="empty-desc">Adicione seus cartões para controlar limites e gastos.</p></div>';
    return;
  }
  el.innerHTML = db.cards.map(c => {
    const usedPct = pct(Number(c.used || 0), Number(c.limit || 1));
    const statusClass = usedPct >= 80 ? 'danger' : usedPct >= 50 ? 'warning' : 'ok';
    return `
      <div class="card-item" role="listitem" aria-label="Cartão ${esc(c.name)}">
        <div class="card-chip" aria-hidden="true"></div>
        <div class="card-item-header">
          <div>
            <div class="card-item-name">${esc(c.name)}</div>
            <div class="card-item-due muted">Vence dia ${esc(String(c.due || '—'))}</div>
          </div>
          <div class="item-actions">
            <button class="btn-edit" data-action="edit" data-type="card" data-id="${c.id}" aria-label="Editar ${esc(c.name)}">✏️</button>
            <button class="btn-remove" data-action="remove-card" data-id="${c.id}" aria-label="Remover ${esc(c.name)}">✕</button>
          </div>
        </div>
        <div class="card-item-amounts">
          <span>${fmt(c.used || 0)} <span class="muted">/ ${fmt(c.limit || 0)}</span></span>
          <span class="pct-badge pct-badge--${statusClass}">${usedPct.toFixed(0)}%</span>
        </div>
        <div class="progress-bar" role="progressbar" aria-valuenow="${usedPct.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill progress-fill--${statusClass}" style="width:${usedPct}%"></div>
        </div>
      </div>
    `;
  }).join('');
  if (typeof gsap !== 'undefined') gsap.from('#cards-list .card-item', { opacity: 0, y: 12, stagger: 0.05, duration: 0.35 });
}

function renderInsightCards() {
  const el = document.getElementById('insight-cards');
  if (!el) return;
  if (!db.cards.length) { el.innerHTML = '<span class="insight-empty">Cadastre cartões para ver insights</span>'; return; }
  const totalLimit = db.cards.reduce((a, c) => a + Number(c.limit || 0), 0);
  const totalUsed  = db.cards.reduce((a, c) => a + Number(c.used  || 0), 0);
  const danger     = db.cards.filter(c => pct(Number(c.used || 0), Number(c.limit || 1)) >= 80).length;
  el.innerHTML = insightHTML([
    { label: 'Cartões',           value: String(db.cards.length), sub: 'ativos' },
    { label: 'Limite Total',      value: fmt(totalLimit),         sub: 'soma de todos' },
    { label: 'Gasto Total',       value: fmt(totalUsed),          sub: `${pct(totalUsed, totalLimit).toFixed(0)}% do limite` },
    { label: 'Disponível',        value: fmt(totalLimit - totalUsed), sub: 'restante' },
    ...(danger > 0 ? [{ label: '⚠️ Atenção', value: String(danger), sub: 'cartão(s) acima de 80%' }] : []),
  ]);
}

// ============================================================
// 7. CALENDÁRIO
// ============================================================
function addCalendarEvent() {
  const title     = document.getElementById('evt-title')?.value.trim();
  const amount    = Number(document.getElementById('evt-amount')?.value) || 0;
  const type      = document.getElementById('evt-type')?.value;
  const category  = document.getElementById('evt-category')?.value || 'Outros';
  const date      = document.getElementById('evt-date')?.value;
  const recurring = document.getElementById('evt-recurring')?.checked || false;
  const installmentTotal = Number(document.getElementById('evt-installment-total')?.value) || 1;
  const installmentIndex = Number(document.getElementById('evt-installment-index')?.value) || 1;

  const errors = validateEvent({ title, date, amount, type });
  if (errors.length) { showToast(`❌ ${errors[0]}`, 'error'); return; }

  const evt = {
    id: uid(), title, amount, type, category, date, recurring,
    installmentTotal: Math.max(1, installmentTotal),
    installmentIndex: Math.max(1, Math.min(installmentIndex, installmentTotal)),
    parentId: null, createdAt: new Date().toISOString(),
  };
  db.calendar.push(evt);

  if (recurring) {
    generateRecurringFor(evt);
  } else if (installmentTotal > 1) {
    generateInstallmentFuture(evt);
  }

  saveAll();
  renderCalendar();
  renderInsightCalendar();
  renderChartCalendar();
  clearForm(['evt-title', 'evt-amount', 'evt-type', 'evt-category', 'evt-date', 'evt-recurring']);
  const instTotalEl = document.getElementById('evt-installment-total');
  const instIndexEl = document.getElementById('evt-installment-index');
  if (instTotalEl) instTotalEl.value = '1';
  if (instIndexEl) instIndexEl.value = '1';
  showToast('✅ Evento adicionado!');
}

function removeCalendarEvent(id) {
  const evt = db.calendar.find(e => e.id === id);
  showConfirm(`Remover "${evt?.title || 'este evento'}"?`, () => {
    db.calendar = db.calendar.filter(e => e.id !== id);
    saveAll();
    renderCalendar();
    renderInsightCalendar();
    renderChartCalendar();
    showToast('🗑️ Evento removido.');
  });
}

function togglePaid(id) {
  const evt = db.calendar.find(e => e.id === id);
  if (!evt) return;
  evt.paid = !evt.paid;
  saveAll();
  renderCalendar();
  renderInsightCalendar();
  showToast(evt.paid ? '✅ Marcado como pago' : '⏳ Marcado como pendente');
}

function renderCalendar() {
  const el = document.getElementById('calendar-list');
  if (!el) return;

  const monthLabel = document.getElementById('cal-month-label');
  if (monthLabel) monthLabel.textContent = fmtMonth(STATE.calMonth, STATE.calYear);

  populateCategorySelect('evt-category');

  let events = db.calendar.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date + 'T00:00:00');
    return d.getMonth() === STATE.calMonth && d.getFullYear() === STATE.calYear;
  });

  const today  = todayStr();
  const filter = STATE.calFilter;
  if (filter === 'today')    events = events.filter(e => isToday(e.date));
  else if (filter === 'week')    events = events.filter(e => isThisWeek(e.date));
  else if (filter === 'upcoming') events = events.filter(e => !isPast(e.date) && isWithinDays(e.date, 7));
  else if (filter === 'overdue')  events = events.filter(e => isPast(e.date) && e.type === 'Despesa');
  else if (['Receita','Despesa','Meta'].includes(filter)) events = events.filter(e => e.type === filter);
  else if (filter === 'recurring') events = events.filter(e => e.recurring || e.parentId);
  else if (filter === 'paid')     events = events.filter(e => e.paid);
  else if (filter === 'pending')  events = events.filter(e => !e.paid);
  else if (filter.startsWith('cat:')) events = events.filter(e => e.category === filter.slice(4));

  if (STATE.calSearch) {
    const q = STATE.calSearch.toLowerCase();
    events = events.filter(e => (e.title || '').toLowerCase().includes(q) || (e.category || '').toLowerCase().includes(q));
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  if (!events.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-illustration empty-illustration--calendar"></div><p class="empty-title">Nenhum evento encontrado</p><p class="empty-desc">Clique em "+" para adicionar sua primeira receita ou despesa.</p></div>';
    return;
  }

  el.innerHTML = events.map(e => {
    const overdue = e.type === 'Despesa' && isPast(e.date) && !isToday(e.date) && !e.paid;
    return `
      <div class="evt-item evt-item--${esc(e.type)} ${overdue ? 'evt-item--overdue' : ''} ${e.paid ? 'evt-item--paid' : ''}" role="listitem">
        <div class="evt-item-left">
          <span class="type-dot type-dot--${esc(e.type)}" aria-hidden="true"></span>
          <div class="evt-item-info">
            <div class="evt-item-title">
              ${esc(e.title)}
              ${(e.recurring || e.parentId) ? '<span class="recurring-badge" title="Recorrente">🔄</span>' : ''}
              ${e.installmentTotal > 1 ? `<span class="recurring-badge" title="Parcela ${e.installmentIndex}/${e.installmentTotal}">${e.installmentIndex}/${e.installmentTotal}</span>` : ''}
            </div>
            <div class="evt-item-meta">
              <span class="cat-badge" style="--cat-color:${catColor(e.category)};">${catIcon(e.category)} ${esc(e.category || 'Outros')}</span>
              <span class="muted">${fmtDate(e.date)}</span>
              ${overdue ? '<span class="overdue-badge">Atrasado</span>' : ''}
              ${e.paid ? '<span class="overdue-badge" style="background:var(--green-bg);color:var(--green)">Pago</span>' : ''}
            </div>
          </div>
        </div>
        <div class="evt-item-right">
          <span class="evt-amount ${e.type === 'Receita' ? 'positive' : ''}">${fmt(e.amount)}</span>
          <div class="item-actions" style="opacity:1">
            <button class="btn-edit" data-action="toggle-paid" data-id="${e.id}" aria-label="${e.paid ? 'Marcar como pendente' : 'Marcar como pago'}" title="${e.paid ? 'Marcar como pendente' : 'Marcar como pago'}">${e.paid ? '⏳' : '✅'}</button>
            <button class="btn-edit" data-action="edit" data-type="calendar" data-id="${e.id}" aria-label="Editar ${esc(e.title)}">✏️</button>
            <button class="btn-remove" data-action="remove-calendar" data-id="${e.id}" aria-label="Remover ${esc(e.title)}">✕</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (typeof gsap !== 'undefined') gsap.from('#calendar-list .evt-item', { opacity: 0, y: 10, stagger: 0.04, duration: 0.3 });
}

function renderCalFilters() {
  const el = document.getElementById('cal-filters');
  if (!el) return;
  const calFiltersHTML = CAL_FILTERS.map(f => `
    <button class="filter-btn ${STATE.calFilter === f.value ? 'active' : ''}"
            data-action="cal-filter" data-filter="${esc(f.value)}"
            aria-pressed="${STATE.calFilter === f.value}">
      ${esc(f.label)}
    </button>
  `).join('');

  // Category filters (dynamic)
  const calCategories = [...new Set(db.calendar.map(e => e.category).filter(Boolean))];
  const catFiltersHTML = calCategories.length ? `
    <div class="filter-divider" aria-hidden="true"></div>
    ${calCategories.map(cat => `
      <button class="filter-btn filter-btn--cat ${STATE.calFilter === `cat:${cat}` ? 'active' : ''}"
              data-action="cal-filter" data-filter="cat:${esc(cat)}"
              aria-pressed="${STATE.calFilter === `cat:${cat}`}">
        ${catIcon(cat)} ${esc(cat)}
      </button>
    `).join('')}
  ` : '';

  el.innerHTML = calFiltersHTML + catFiltersHTML;
}

function calPrevMonth() {
  STATE.calMonth--;
  if (STATE.calMonth < 0) { STATE.calMonth = 11; STATE.calYear--; }
  renderCalendar();
  renderInsightCalendar();
  renderChartCalendar();
}

function calNextMonth() {
  STATE.calMonth++;
  if (STATE.calMonth > 11) { STATE.calMonth = 0; STATE.calYear++; }
  renderCalendar();
  renderInsightCalendar();
  renderChartCalendar();
}

function renderInsightCalendar() {
  const el = document.getElementById('insight-calendar');
  if (!el) return;
  const events = db.calendar.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date + 'T00:00:00');
    return d.getMonth() === STATE.calMonth && d.getFullYear() === STATE.calYear;
  });
  const receitas = events.filter(e => e.type === 'Receita').reduce((a, e) => a + Number(e.amount || 0), 0);
  const despesas = events.filter(e => e.type === 'Despesa').reduce((a, e) => a + Number(e.amount || 0), 0);
  const saldo    = receitas - despesas;
  const recorr   = events.filter(e => e.recurring || e.parentId).length;
  const pagas    = events.filter(e => e.type === 'Despesa' && e.paid).reduce((a, e) => a + Number(e.amount || 0), 0);
  const pendentes = despesas - pagas;
  el.innerHTML = insightHTML([
    { label: 'Receitas',    value: fmt(receitas),         sub: `${events.filter(e => e.type === 'Receita').length} eventos` },
    { label: 'Despesas',    value: fmt(despesas),         sub: `${events.filter(e => e.type === 'Despesa').length} eventos` },
    { label: 'Saldo',       value: fmt(saldo),            sub: saldo >= 0 ? 'Positivo ✅' : 'Negativo ⚠️' },
    { label: 'Pagas',       value: fmt(pagas),            sub: 'despesas quitadas' },
    { label: 'Pendentes',   value: fmt(pendentes),        sub: 'aguardando pagamento' },
    { label: 'Recorrentes', value: String(recorr),        sub: 'automáticos' },
  ]);
}

// ============================================================
// 8. CONTAS
// ============================================================
function addAccount() {
  const name    = document.getElementById('acc-name')?.value.trim();
  const type    = document.getElementById('acc-type')?.value || 'Corrente';
  const balance = Number(document.getElementById('acc-balance')?.value) || 0;

  if (!name) { showToast('❌ Informe o nome do banco', 'error'); return; }

  db.accounts.push({ id: uid(), name, type, balance, createdAt: new Date().toISOString() });
  saveAll();
  renderAccounts();
  renderInsightAccounts();
  renderChartAccounts();
  clearForm(['acc-name', 'acc-type', 'acc-balance']);
  showToast('✅ Conta adicionada!');
}

function removeAccount(id) {
  const acc = db.accounts.find(a => a.id === id);
  showConfirm(`Remover a conta "${acc?.name || 'esta conta'}"?`, () => {
    db.accounts = db.accounts.filter(a => a.id !== id);
    saveAll();
    renderAccounts();
    renderInsightAccounts();
    renderChartAccounts();
    showToast('🗑️ Conta removida.');
  });
}

function renderAccounts() {
  const el = document.getElementById('accounts-list');
  if (!el) return;
  if (!db.accounts.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-illustration empty-illustration--account"></div><p class="empty-title">Nenhuma conta cadastrada</p><p class="empty-desc">Comece cadastrando sua conta principal para controlar seu patrimônio.</p></div>';
    return;
  }
  el.innerHTML = db.accounts.map(a => `
    <div class="acc-card" role="listitem" aria-label="Conta ${esc(a.name)}">
      <div class="acc-card-header">
        <div>
          <div class="acc-card-name">${esc(a.name)}</div>
          <div class="muted">${esc(a.type || 'Corrente')}</div>
        </div>
        <div class="item-actions">
          <button class="btn-edit" data-action="edit" data-type="account" data-id="${a.id}" aria-label="Editar ${esc(a.name)}">✏️</button>
          <button class="btn-remove" data-action="remove-account" data-id="${a.id}" aria-label="Remover ${esc(a.name)}">✕</button>
        </div>
      </div>
      <div class="acc-card-balance">${fmt(a.balance)}</div>
    </div>
  `).join('');
  if (typeof gsap !== 'undefined') gsap.from('#accounts-list .acc-card', { opacity: 0, y: 12, stagger: 0.05, duration: 0.35 });
}

function renderInsightAccounts() {
  const el = document.getElementById('insight-accounts');
  if (!el) return;
  if (!db.accounts.length) { el.innerHTML = '<span class="insight-empty">Cadastre contas para ver insights</span>'; return; }
  const total = db.accounts.reduce((a, acc) => a + Number(acc.balance || 0), 0);
  const maior = db.accounts.reduce((a, b) => Number(b.balance) > Number(a.balance) ? b : a, db.accounts[0]);
  el.innerHTML = insightHTML([
    { label: 'Total em Contas', value: fmt(total),                                    sub: `${db.accounts.length} contas` },
    { label: 'Maior Saldo',     value: fmt(maior?.balance || 0),                      sub: esc(maior?.name || '—') },
    { label: 'Média por Conta', value: fmt(total / db.accounts.length),               sub: 'média simples' },
    { label: 'Contas Neg.',     value: String(db.accounts.filter(a => Number(a.balance) < 0).length), sub: 'saldo negativo' },
  ]);
}

// ============================================================
// 8b. TRANSFERÊNCIAS
// ============================================================
function populateTransferSelects() {
  const fromSel = document.getElementById('tf-from');
  const toSel   = document.getElementById('tf-to');
  if (!fromSel || !toSel) return;
  const opts = db.accounts.map(a => `<option value="${a.id}">${esc(a.name)} (${fmt(a.balance)})</option>`).join('');
  const placeholder = '<option value="">Selecione...</option>';
  fromSel.innerHTML = placeholder + opts;
  toSel.innerHTML   = placeholder + opts;
}

function addTransfer() {
  const fromId = document.getElementById('tf-from')?.value;
  const toId   = document.getElementById('tf-to')?.value;
  const amount = Number(document.getElementById('tf-amount')?.value) || 0;
  const date   = document.getElementById('tf-date')?.value;

  if (!fromId) { showToast('❌ Selecione a conta de origem', 'error'); return; }
  if (!toId)   { showToast('❌ Selecione a conta de destino', 'error'); return; }
  if (fromId === toId) { showToast('❌ Contas devem ser diferentes', 'error'); return; }
  if (amount <= 0) { showToast('❌ Informe um valor válido', 'error'); return; }
  if (!date) { showToast('❌ Informe a data', 'error'); return; }

  const fromAcc = db.accounts.find(a => a.id === Number(fromId));
  const toAcc   = db.accounts.find(a => a.id === Number(toId));
  if (!fromAcc || !toAcc) { showToast('❌ Conta não encontrada', 'error'); return; }

  fromAcc.balance = Number(fromAcc.balance) - amount;
  toAcc.balance   = Number(toAcc.balance) + amount;

  db.transfers.push({
    id: uid(), fromId: Number(fromId), toId: Number(toId),
    fromName: fromAcc.name, toName: toAcc.name,
    amount, date, createdAt: new Date().toISOString(),
  });

  saveAll();
  renderAccounts();
  renderTransfers();
  renderInsightAccounts();
  renderChartAccounts();
  renderChartPatrimonio();
  clearForm(['tf-from', 'tf-to', 'tf-amount', 'tf-date']);
  showToast(`✅ Transferência de ${fmt(amount)} realizada!`);
}

function removeTransfer(id) {
  const tf = db.transfers.find(t => t.id === id);
  showConfirm(`Reverter transferência de ${fmt(tf?.amount || 0)}?`, () => {
    if (tf) {
      const fromAcc = db.accounts.find(a => a.id === tf.fromId);
      const toAcc   = db.accounts.find(a => a.id === tf.toId);
      if (fromAcc) fromAcc.balance = Number(fromAcc.balance) + tf.amount;
      if (toAcc)   toAcc.balance   = Number(toAcc.balance) - tf.amount;
    }
    db.transfers = db.transfers.filter(t => t.id !== id);
    saveAll();
    renderAccounts();
    renderTransfers();
    renderInsightAccounts();
    renderChartAccounts();
    renderChartPatrimonio();
    showToast('🗑️ Transferência revertida.');
  });
}

function renderTransfers() {
  const el = document.getElementById('transfers-list');
  if (!el) return;
  const items = db.transfers.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 10);
  if (!items.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-illustration empty-illustration--transfer"></div><p class="empty-title">Nenhuma transferência recente</p><p class="empty-desc">Transfira valores entre suas contas para manter tudo organizado.</p></div>';
    return;
  }
  el.innerHTML = items.map(t => `
    <div class="evt-item" role="listitem">
      <div class="evt-item-left">
        <span class="type-dot" style="background:var(--blue)" aria-hidden="true"></span>
        <div class="evt-item-info">
          <div class="evt-item-title">${esc(t.fromName)} → ${esc(t.toName)}</div>
          <div class="evt-item-meta">
            <span class="muted">${fmtDate(t.date)}</span>
          </div>
        </div>
      </div>
      <div class="evt-item-right">
        <span class="evt-amount" style="color:var(--blue)">${fmt(t.amount)}</span>
        <div class="item-actions" style="opacity:1">
          <button class="btn-remove" data-action="remove-transfer" data-id="${t.id}" aria-label="Reverter transferência">✕</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// 9. INVESTIMENTOS
// ============================================================
function addInvestment() {
  const name    = document.getElementById('inv-name')?.value.trim();
  const type    = document.getElementById('inv-type')?.value.trim() || 'Outros';
  const initial = Number(document.getElementById('inv-initial')?.value) || 0;
  const current = Number(document.getElementById('inv-current')?.value) || 0;

  if (!name)     { showToast('❌ Informe o nome do investimento', 'error'); return; }
  if (initial <= 0){ showToast('❌ Informe o valor inicial', 'error'); return; }

  db.investments.push({ id: uid(), name, type, initial, current, createdAt: new Date().toISOString() });
  saveAll();
  renderInvestments();
  renderInsightInvestments();
  renderChartInvestments();
  clearForm(['inv-name', 'inv-type', 'inv-initial', 'inv-current']);
  showToast('✅ Investimento adicionado!');
}

function removeInvestment(id) {
  const inv = db.investments.find(i => i.id === id);
  showConfirm(`Remover "${inv?.name || 'este investimento'}"?`, () => {
    db.investments = db.investments.filter(i => i.id !== id);
    saveAll();
    renderInvestments();
    renderInsightInvestments();
    renderChartInvestments();
    showToast('🗑️ Investimento removido.');
  });
}

function renderInvestments() {
  const el = document.getElementById('investments-list');
  if (!el) return;
  if (!db.investments.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-illustration empty-illustration--investment"></div><p class="empty-title">Nenhum investimento cadastrado</p><p class="empty-desc">Registre seus investimentos para acompanhar a rentabilidade.</p></div>';
    return;
  }
  el.innerHTML = db.investments.map(inv => {
    const gain    = Number(inv.current) - Number(inv.initial);
    const gainPct = Number(inv.initial) > 0 ? (gain / Number(inv.initial)) * 100 : 0;
    const isGain  = gain >= 0;
    return `
      <div class="inv-card" role="listitem" aria-label="Investimento: ${esc(inv.name)}">
        <div class="inv-card-header">
          <div>
            <div class="inv-card-name">${esc(inv.name)}</div>
            <div class="muted">${esc(inv.type || 'Outros')}</div>
          </div>
          <div class="item-actions">
            <button class="btn-edit" data-action="edit" data-type="investment" data-id="${inv.id}" aria-label="Editar ${esc(inv.name)}">✏️</button>
            <button class="btn-remove" data-action="remove-investment" data-id="${inv.id}" aria-label="Remover ${esc(inv.name)}">✕</button>
          </div>
        </div>
        <div class="inv-card-body">
          <div><div class="muted inv-label">Inicial</div><div class="inv-value">${fmt(inv.initial)}</div></div>
          <div><div class="muted inv-label">Atual</div><div class="inv-value">${fmt(inv.current)}</div></div>
          <div><div class="muted inv-label">Rendimento</div>
               <div class="inv-value ${isGain ? 'positive' : 'negative'}">${isGain ? '+' : ''}${gainPct.toFixed(2)}%</div></div>
        </div>
      </div>
    `;
  }).join('');
  if (typeof gsap !== 'undefined') gsap.from('#investments-list .inv-card', { opacity: 0, y: 12, stagger: 0.05, duration: 0.35 });
}

function renderInsightInvestments() {
  const el = document.getElementById('insight-investments');
  if (!el) return;
  if (!db.investments.length) { el.innerHTML = '<span class="insight-empty">Cadastre investimentos para ver insights</span>'; return; }
  const totalInitial = db.investments.reduce((a, i) => a + Number(i.initial || 0), 0);
  const totalCurrent = db.investments.reduce((a, i) => a + Number(i.current || 0), 0);
  const totalGain    = totalCurrent - totalInitial;
  const gainPct      = totalInitial > 0 ? (totalGain / totalInitial) * 100 : 0;
  el.innerHTML = insightHTML([
    { label: 'Total Investido', value: fmt(totalInitial),             sub: 'valor inicial' },
    { label: 'Valor Atual',     value: fmt(totalCurrent),             sub: 'valor de mercado' },
    { label: 'Rendimento',      value: `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(2)}%`, sub: fmt(totalGain) },
    { label: 'Ativos',          value: String(db.investments.length), sub: 'investimentos' },
  ]);
}

// ============================================================
// 10. METAS
// ============================================================
function addGoal() {
  const name     = document.getElementById('goal-name')?.value.trim();
  const target   = Number(document.getElementById('goal-target')?.value) || 0;
  const saved    = Number(document.getElementById('goal-saved')?.value)  || 0;
  const deadline = document.getElementById('goal-deadline')?.value       || null;

  if (!name)    { showToast('❌ Informe o nome da meta', 'error'); return; }
  if (target <= 0){ showToast('❌ Informe um valor alvo válido', 'error'); return; }

  db.goals.push({ id: uid(), name, target, saved, deadline, createdAt: new Date().toISOString() });
  saveAll();
  renderGoals();
  renderInsightGoals();
  clearForm(['goal-name', 'goal-target', 'goal-saved', 'goal-deadline']);
  showToast('✅ Meta adicionada!');
}

function removeGoal(id) {
  const goal = db.goals.find(g => g.id === id);
  showConfirm(`Remover a meta "${goal?.name || 'esta meta'}"?`, () => {
    db.goals = db.goals.filter(g => g.id !== id);
    saveAll();
    renderGoals();
    renderInsightGoals();
    showToast('🗑️ Meta removida.');
  });
}

function renderGoals() {
  const el = document.getElementById('goals-list');
  if (!el) return;
  if (!db.goals.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-illustration empty-illustration--goal"></div><p class="empty-title">Nenhuma meta cadastrada</p><p class="empty-desc">Defina metas de economia para alcançar seus objetivos.</p></div>';
    return;
  }
  const today = todayStr();
  el.innerHTML = db.goals.map(g => {
    const p        = pct(Number(g.saved), Number(g.target));
    const overdue  = g.deadline && g.deadline < today && Number(g.saved) < Number(g.target);
    const complete = Number(g.saved) >= Number(g.target);
    return `
      <div class="goal-card ${complete ? 'goal-card--done' : ''} ${overdue ? 'goal-card--overdue' : ''}" role="listitem">
        <div class="goal-card-header">
          <div>
            <div class="goal-card-name">${esc(g.name)} ${complete ? '✅' : ''}</div>
            ${g.deadline ? `<div class="muted">${overdue ? '⚠️ ' : ''}Prazo: ${fmtDate(g.deadline)}</div>` : ''}
          </div>
          <div class="item-actions">
            <button class="btn-edit" data-action="edit" data-type="goal" data-id="${g.id}" aria-label="Editar ${esc(g.name)}">✏️</button>
            <button class="btn-remove" data-action="remove-goal" data-id="${g.id}" aria-label="Remover ${esc(g.name)}">✕</button>
          </div>
        </div>
        <div class="goal-progress-row">
          <span>${fmt(g.saved)} <span class="muted">/ ${fmt(g.target)}</span></span>
          <span>${p.toFixed(0)}%</span>
        </div>
        <div class="progress-bar" role="progressbar" aria-valuenow="${p.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-fill ${complete ? 'progress-fill--green' : ''}" style="width:${p}%"></div>
        </div>
      </div>
    `;
  }).join('');
  if (typeof gsap !== 'undefined') gsap.from('#goals-list .goal-card', { opacity: 0, y: 12, stagger: 0.05, duration: 0.35 });
}

function renderInsightGoals() {
  const el = document.getElementById('insight-goals');
  if (!el) return;
  if (!db.goals.length) { el.innerHTML = '<span class="insight-empty">Cadastre metas para ver insights</span>'; return; }
  const today       = todayStr();
  const complete    = db.goals.filter(g => Number(g.saved) >= Number(g.target)).length;
  const overdue     = db.goals.filter(g => g.deadline && g.deadline < today && Number(g.saved) < Number(g.target)).length;
  const totalTarget = db.goals.reduce((a, g) => a + Number(g.target || 0), 0);
  const totalSaved  = db.goals.reduce((a, g) => a + Number(g.saved  || 0), 0);
  el.innerHTML = insightHTML([
    { label: 'Total de Metas',  value: String(db.goals.length), sub: 'cadastradas' },
    { label: 'Concluídas',      value: String(complete),        sub: `${pct(complete, db.goals.length).toFixed(0)}% do total` },
    { label: 'Valor Alvo',      value: fmt(totalTarget),        sub: 'soma de todas' },
    { label: 'Economizado',     value: fmt(totalSaved),         sub: `${pct(totalSaved, totalTarget).toFixed(0)}% do objetivo` },
    ...(overdue > 0 ? [{ label: '⚠️ Atrasadas', value: String(overdue), sub: 'com prazo vencido' }] : []),
  ]);
}

// ============================================================
// 11. BUDGET
// ============================================================
function updateBudget() {
  const incVal = document.getElementById('budget-income')?.value;
  const nVal = document.getElementById('budget-needs')?.value;
  const wVal = document.getElementById('budget-wants')?.value;
  const iVal = document.getElementById('budget-invest')?.value;
  const income = incVal !== '' && incVal !== undefined ? Number(incVal) : db.income;
  const needs  = nVal  !== '' && nVal  !== undefined ? Number(nVal)  : db.budget.needs;
  const wants  = wVal  !== '' && wVal  !== undefined ? Number(wVal)  : db.budget.wants;
  const invest = iVal  !== '' && iVal  !== undefined ? Number(iVal)  : db.budget.invest;
  const total  = needs + wants + invest;

  if (total !== 100) { showToast(`❌ Percentuais devem somar 100% (atual: ${total}%)`, 'error'); return; }

  db.income = income;
  db.budget = { needs, wants, invest };
  saveAll();
  renderBudgetVisual();
  renderInsightBudget();
  renderOverview();
  showToast('✅ Budget atualizado!');
}

function renderBudgetVisual() {
  const el = document.getElementById('budget-visual');
  if (!el) return;

  const incEl = document.getElementById('budget-income');
  if (incEl && !incEl.value) incEl.value = db.income || '';
  const needsEl = document.getElementById('budget-needs');
  if (needsEl && !needsEl.value) needsEl.value = db.budget.needs;
  const wantsEl = document.getElementById('budget-wants');
  if (wantsEl && !wantsEl.value) wantsEl.value = db.budget.wants;
  const investEl = document.getElementById('budget-invest');
  if (investEl && !investEl.value) investEl.value = db.budget.invest;

  const inc = Number(db.income) || 0;
  const { needs, wants, invest } = db.budget;
  const buckets = [
    { label: '🏠 Necessidades', pct: needs,  planned: inc * needs  / 100, color: 'green' },
    { label: '🎮 Desejos',      pct: wants,  planned: inc * wants  / 100, color: 'orange' },
    { label: '📈 Investimentos',pct: invest, planned: inc * invest / 100, color: 'blue' },
  ];

  el.innerHTML = buckets.map(b => `
    <div class="card budget-card">
      <div class="budget-card-header">
        <span class="budget-card-label">${b.label}</span>
        <span class="budget-card-pct">${b.pct}%</span>
      </div>
      <div class="budget-card-amount">${fmt(b.planned)}<span class="muted"> / mês</span></div>
      <div class="progress-bar" role="progressbar" aria-valuenow="${b.pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="progress-fill progress-fill--${esc(b.color)}" style="width:${b.pct}%"></div>
      </div>
      <div class="muted budget-card-footer">Renda mensal: ${fmt(inc)}</div>
    </div>
  `).join('');
}

function renderInsightBudget() {
  const el = document.getElementById('insight-budget');
  if (!el) return;
  const inc = Number(db.income) || 0;
  if (!inc) { el.innerHTML = '<span class="insight-empty">Configure sua renda para ver insights</span>'; return; }
  const { needs, wants, invest } = db.budget;
  const total = needs + wants + invest;
  el.innerHTML = insightHTML([
    { label: 'Renda Mensal',   value: fmt(inc),                                     sub: 'configurada' },
    { label: 'Necessidades',   value: `${needs}% · ${fmt(inc * needs  / 100)}`,     sub: 'planejado' },
    { label: 'Desejos',        value: `${wants}% · ${fmt(inc * wants  / 100)}`,     sub: 'planejado' },
    { label: 'Investimentos',  value: `${invest}% · ${fmt(inc * invest / 100)}`,    sub: 'planejado' },
    { label: 'Soma dos %',     value: `${total}%`,                                  sub: total === 100 ? '✅ Correto' : '⚠️ Deve ser 100%' },
  ]);
}

function renderInsightOverview() {
  const el = document.getElementById('insight-overview');
  if (!el) return;
  const month = STATE.ovMonth;
  const year  = STATE.ovYear;
  const monthEvents = db.calendar.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const receitas   = monthEvents.filter(e => e.type === 'Receita').reduce((a, e) => a + Number(e.amount), 0);
  const despesas   = monthEvents.filter(e => e.type === 'Despesa').reduce((a, e) => a + Number(e.amount), 0);
  const taxa       = receitas > 0 ? pct(receitas - despesas, receitas) : 0;
  const patrimonio = db.accounts.reduce((a, acc) => a + Number(acc.balance || 0), 0)
                   + db.investments.reduce((a, inv) => a + Number(inv.current || 0), 0);
  el.innerHTML = insightHTML([
    { label: 'Taxa de Poupança',  value: `${taxa.toFixed(1)}%`,              sub: '(receitas − despesas) / receitas' },
    { label: 'Patrimônio Total',  value: fmt(patrimonio),                     sub: 'contas + investimentos' },
    { label: 'Eventos no Mês',    value: String(monthEvents.length),          sub: `${MONTHS_PT[month]} ${year}` },
    { label: 'Metas em Andamento',value: String(db.goals.filter(g => Number(g.saved) < Number(g.target)).length), sub: 'ativas' },
    { label: 'Cartões Ativos',    value: String(db.cards.length),             sub: 'cadastrados' },
    { label: 'Contas Bancárias',  value: String(db.accounts.length),          sub: 'cadastradas' },
  ]);
}

// ============================================================
// 12. GRÁFICOS
// ============================================================
function updateOrCreateChart(canvas, config) {
  if (canvas._chartInstance) {
    const chart = canvas._chartInstance;
    chart.data = config.data;
    if (config.options) {
      chart.options = config.options;
    }
    chart.update('none');
    return chart;
  }
  canvas._chartInstance = new Chart(canvas, config);
  return canvas._chartInstance;
}

function renderChartCalendar() {
  const canvas = document.getElementById('chart-category');
  if (!canvas) return;

  const events = db.calendar.filter(e => {
    if (e.type !== 'Despesa' || !e.date) return false;
    const d = new Date(e.date + 'T00:00:00');
    return d.getMonth() === STATE.calMonth && d.getFullYear() === STATE.calYear;
  });

  const catMap = {};
  events.forEach(e => { catMap[e.category || 'Outros'] = (catMap[e.category || 'Outros'] || 0) + Number(e.amount || 0); });
  const labels = Object.keys(catMap);
  const data   = Object.values(catMap);

  if (!labels.length) {
    if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }
    showChartEmpty(canvas, 'Sem despesas neste mês');
    return;
  }
  hideChartEmpty(canvas);

  updateOrCreateChart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: labels.map(l => catColor(l)), borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'right', labels: { color: '#a1a1aa', font: { family: 'Inter', size: 12 }, boxWidth: 12, padding: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}` } },
      },
    },
  });
}

function renderChartAccounts() {
  const canvas = document.getElementById('chart-accounts');
  if (!canvas) return;
  if (!db.accounts.length) {
    if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }
    showChartEmpty(canvas, 'Cadastre contas para ver o gráfico');
    return;
  }
  hideChartEmpty(canvas);

  updateOrCreateChart(canvas, {
    type: 'bar',
    data: {
      labels: db.accounts.map(a => a.name),
      datasets: [{ label: 'Saldo', data: db.accounts.map(a => Number(a.balance)),
        backgroundColor: db.accounts.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderRadius: 6, borderSkipped: false }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } } },
      scales: {
        x: { ticks: { color: '#a1a1aa', font: { family: 'Inter' } }, grid: { display: false } },
        y: { ticks: { color: '#a1a1aa', font: { family: 'Inter' }, callback: v => fmt(v) }, grid: { color: '#27272a' } },
      },
    },
  });
}

function renderChartInvestments() {
  const canvas = document.getElementById('chart-investments');
  if (!canvas) return;
  if (!db.investments.length) {
    if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }
    showChartEmpty(canvas, 'Cadastre investimentos para ver o gráfico');
    return;
  }
  hideChartEmpty(canvas);

  updateOrCreateChart(canvas, {
    type: 'bar',
    data: {
      labels: db.investments.map(i => i.name),
      datasets: [
        { label: 'Inicial', data: db.investments.map(i => Number(i.initial)), backgroundColor: '#3b82f6', borderRadius: 6 },
        { label: 'Atual',   data: db.investments.map(i => Number(i.current)), backgroundColor: '#f97316', borderRadius: 6 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { labels: { color: '#a1a1aa', font: { family: 'Inter', size: 12 } } },
                 tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } } },
      scales: {
        x: { ticks: { color: '#a1a1aa', font: { family: 'Inter' } }, grid: { display: false } },
        y: { ticks: { color: '#a1a1aa', font: { family: 'Inter' }, callback: v => fmt(v) }, grid: { color: '#27272a' } },
      },
    },
  });
}

function renderChartPatrimonio() {
  const canvas = document.getElementById('chart-patrimonio');
  if (!canvas) return;

  const contas  = db.accounts.reduce((a, acc) => a + Number(acc.balance || 0), 0);
  const invests = db.investments.reduce((a, inv) => a + Number(inv.current || 0), 0);
  const cartoes = db.cards.reduce((a, c) => a + Number(c.used || 0), 0);
  const ativos  = contas + invests;

  if (ativos === 0 && cartoes === 0) {
    if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }
    showChartEmpty(canvas, 'Cadastre contas ou investimentos para ver o patrimônio');
    return;
  }
  hideChartEmpty(canvas);

  const labels = ['Ativos', 'Passivos'];
  const data   = [Math.max(ativos, 0), Math.max(cartoes, 0)];
  const colors = ['#22c55e', '#ef4444'];

  updateOrCreateChart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderRadius: 6, borderSkipped: false }],
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.x)}` } },
      },
      scales: {
        x: { ticks: { color: '#a1a1aa', font: { family: 'Inter' }, callback: v => fmt(v) }, grid: { color: '#27272a' } },
        y: { ticks: { color: '#a1a1aa', font: { family: 'Inter', weight: 600 } }, grid: { display: false } },
      },
    },
  });
}

// ============================================================
// 13. FAB
// ============================================================
function openFab() {
  const modal = document.getElementById('fab-modal');
  if (!modal) return;
  const dateInput = document.getElementById('fab-date');
  if (dateInput && !dateInput.value) dateInput.value = todayStr();
  populateCategorySelect('fab-category');
  showModal(modal);
  document.getElementById('fab-title')?.focus();
}

function closeFab() {
  const modal = document.getElementById('fab-modal');
  if (modal) hideModal(modal);
}

function saveFab() {
  const title     = document.getElementById('fab-title')?.value.trim();
  const amount    = Number(document.getElementById('fab-amount')?.value) || 0;
  const type      = document.getElementById('fab-type')?.value;
  const category  = document.getElementById('fab-category')?.value || 'Outros';
  const date      = document.getElementById('fab-date')?.value;
  const recurring = document.getElementById('fab-recurring')?.checked || false;
  const installmentTotal = Number(document.getElementById('fab-installments')?.value) || 1;

  const errors = validateEvent({ title, date, amount, type });
  if (errors.length) { showToast(`❌ ${errors[0]}`, 'error'); return; }

  const evt = {
    id: uid(), title, amount, type, category, date, recurring,
    installmentTotal: Math.max(1, installmentTotal),
    installmentIndex: 1,
    parentId: null, createdAt: new Date().toISOString(),
  };
  db.calendar.push(evt);
  if (recurring) {
    generateRecurringFor(evt);
  } else if (installmentTotal > 1) {
    generateInstallmentFuture(evt);
  }
  saveAll();
  closeFab();
  clearForm(['fab-title', 'fab-amount', 'fab-type', 'fab-category', 'fab-date', 'fab-recurring']);
  const instEl = document.getElementById('fab-installments');
  if (instEl) instEl.value = '1';
  if (STATE.page === 'calendar') { renderCalendar(); renderInsightCalendar(); renderChartCalendar(); }
  if (STATE.page === 'overview') renderOverview();
  showToast('✅ Registro adicionado!');
}

// ============================================================
// 14. MODAL EDIÇÃO
// ============================================================
function openEditModal(type, id) {
  STATE.editType = type;
  STATE.editId   = id;
  const modal = document.getElementById('edit-modal');
  const body  = document.getElementById('edit-modal-body');
  if (!modal || !body) return;

  let html = '';

  if (type === 'calendar') {
    const e = db.calendar.find(x => x.id === id);
    if (!e) return;
    const catOptions = CATEGORIES.map(c =>
      `<option value="${esc(c.value)}" ${e.category === c.value ? 'selected' : ''}>${c.icon} ${esc(c.value)}</option>`
    ).join('');
    html = `<div class="form-grid">
      <div class="field-group field-group--full"><label class="field-label">Título</label><input id="edit-title" class="input" value="${esc(e.title)}"></div>
      <div class="field-group"><label class="field-label">Valor (R$)</label><input id="edit-amount" class="input" type="number" value="${Number(e.amount)}" min="0" step="0.01"></div>
      <div class="field-group"><label class="field-label">Tipo</label><select id="edit-type" class="input">${EVENT_TYPES.map(t => `<option ${e.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="field-group"><label class="field-label">Categoria</label><select id="edit-category" class="input">${catOptions}</select></div>
      <div class="field-group"><label class="field-label">Data</label><input id="edit-date" class="input" type="date" value="${esc(e.date)}"></div>
      <div class="field-group field-group--full"><label class="toggle-label"><input id="edit-recurring" type="checkbox" ${e.recurring ? 'checked' : ''}><span class="toggle-track"></span><span>Recorrente mensal</span></label></div>
      <div class="field-group"><label class="field-label">Parcela</label><input id="edit-installment-index" class="input" type="number" value="${e.installmentIndex || 1}" min="1" max="${e.installmentTotal || 60}"></div>
      <div class="field-group"><label class="field-label">Total de parcelas</label><input id="edit-installment-total" class="input" type="number" value="${e.installmentTotal || 1}" min="1" max="60"></div>
    </div>`;
  } else if (type === 'card') {
    const c = db.cards.find(x => x.id === id);
    if (!c) return;
    html = `<div class="form-grid">
      <div class="field-group"><label class="field-label">Nome</label><input id="edit-name" class="input" value="${esc(c.name)}"></div>
      <div class="field-group"><label class="field-label">Limite (R$)</label><input id="edit-limit" class="input" type="number" value="${Number(c.limit)}" min="0" step="0.01"></div>
      <div class="field-group"><label class="field-label">Gasto atual (R$)</label><input id="edit-used" class="input" type="number" value="${Number(c.used || 0)}" min="0" step="0.01"></div>
      <div class="field-group"><label class="field-label">Vencimento (dia)</label><input id="edit-due" class="input" type="number" value="${Number(c.due || 0)}" min="1" max="31"></div>
    </div>`;
  } else if (type === 'account') {
    const a = db.accounts.find(x => x.id === id);
    if (!a) return;
    html = `<div class="form-grid">
      <div class="field-group"><label class="field-label">Nome</label><input id="edit-name" class="input" value="${esc(a.name)}"></div>
      <div class="field-group"><label class="field-label">Tipo</label><select id="edit-type" class="input">${ACCOUNT_TYPES.map(t => `<option ${a.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="field-group field-group--full"><label class="field-label">Saldo (R$)</label><input id="edit-balance" class="input" type="number" value="${Number(a.balance)}" step="0.01"></div>
    </div>`;
  } else if (type === 'investment') {
    const inv = db.investments.find(x => x.id === id);
    if (!inv) return;
    html = `<div class="form-grid">
      <div class="field-group"><label class="field-label">Nome</label><input id="edit-name" class="input" value="${esc(inv.name)}"></div>
      <div class="field-group"><label class="field-label">Tipo</label><input id="edit-inv-type" class="input" value="${esc(inv.type || '')}"></div>
      <div class="field-group"><label class="field-label">Valor inicial (R$)</label><input id="edit-initial" class="input" type="number" value="${Number(inv.initial)}" min="0" step="0.01"></div>
      <div class="field-group"><label class="field-label">Valor atual (R$)</label><input id="edit-current" class="input" type="number" value="${Number(inv.current)}" min="0" step="0.01"></div>
    </div>`;
  } else if (type === 'goal') {
    const g = db.goals.find(x => x.id === id);
    if (!g) return;
    html = `<div class="form-grid">
      <div class="field-group"><label class="field-label">Nome</label><input id="edit-name" class="input" value="${esc(g.name)}"></div>
      <div class="field-group"><label class="field-label">Valor alvo (R$)</label><input id="edit-target" class="input" type="number" value="${Number(g.target)}" min="0" step="0.01"></div>
      <div class="field-group"><label class="field-label">Economizado (R$)</label><input id="edit-saved" class="input" type="number" value="${Number(g.saved || 0)}" min="0" step="0.01"></div>
      <div class="field-group"><label class="field-label">Prazo</label><input id="edit-deadline" class="input" type="date" value="${esc(g.deadline || '')}"></div>
    </div>`;
  }

  body.innerHTML = html;
  showModal(modal);
  body.querySelector('.input')?.focus();
}

function saveEdit() {
  const { editType: type, editId: id } = STATE;
  if (!type || !id) return;

  if (type === 'calendar') {
    const evt = db.calendar.find(e => e.id === id);
    if (!evt) return;
    evt.title     = document.getElementById('edit-title')?.value.trim()     || evt.title;
    evt.amount    = Number(document.getElementById('edit-amount')?.value)    || evt.amount;
    evt.type      = document.getElementById('edit-type')?.value             || evt.type;
    evt.category  = document.getElementById('edit-category')?.value         || evt.category;
    evt.date      = document.getElementById('edit-date')?.value             || evt.date;
    evt.recurring = document.getElementById('edit-recurring')?.checked      || false;
    const instIdx = document.getElementById('edit-installment-index')?.value;
    const instTot = document.getElementById('edit-installment-total')?.value;
    if (instIdx !== undefined && instIdx !== '') evt.installmentIndex = Number(instIdx);
    if (instTot !== undefined && instTot !== '') evt.installmentTotal = Number(instTot);
  } else if (type === 'card') {
    const card = db.cards.find(c => c.id === id);
    if (!card) return;
    card.name  = document.getElementById('edit-name')?.value.trim() || card.name;
    const limitVal = document.getElementById('edit-limit')?.value;
    card.limit = limitVal !== '' && limitVal !== undefined ? Number(limitVal) : card.limit;
    const usedVal = document.getElementById('edit-used')?.value;
    card.used  = usedVal !== '' && usedVal !== undefined ? Number(usedVal) : card.used;
    const dueVal = document.getElementById('edit-due')?.value;
    card.due   = dueVal !== '' && dueVal !== undefined ? Number(dueVal) : card.due;
  } else if (type === 'account') {
    const acc = db.accounts.find(a => a.id === id);
    if (!acc) return;
    acc.name    = document.getElementById('edit-name')?.value.trim()    || acc.name;
    acc.type    = document.getElementById('edit-type')?.value           || acc.type;
    const balVal = document.getElementById('edit-balance')?.value;
    acc.balance = balVal !== '' && balVal !== undefined ? Number(balVal) : acc.balance;
  } else if (type === 'investment') {
    const inv = db.investments.find(i => i.id === id);
    if (!inv) return;
    inv.name    = document.getElementById('edit-name')?.value.trim()     || inv.name;
    inv.type    = document.getElementById('edit-inv-type')?.value.trim() || inv.type;
    const initVal = document.getElementById('edit-initial')?.value;
    inv.initial = initVal !== '' && initVal !== undefined ? Number(initVal) : inv.initial;
    const currVal = document.getElementById('edit-current')?.value;
    inv.current = currVal !== '' && currVal !== undefined ? Number(currVal) : inv.current;
  } else if (type === 'goal') {
    const goal = db.goals.find(g => g.id === id);
    if (!goal) return;
    goal.name     = document.getElementById('edit-name')?.value.trim()    || goal.name;
    const tgtVal = document.getElementById('edit-target')?.value;
    goal.target   = tgtVal !== '' && tgtVal !== undefined ? Number(tgtVal) : goal.target;
    const savVal = document.getElementById('edit-saved')?.value;
    goal.saved    = savVal !== '' && savVal !== undefined ? Number(savVal) : goal.saved;
    goal.deadline = document.getElementById('edit-deadline')?.value       || null;
  }

  saveAll();
  closeEditModal();
  goTo(STATE.page);
  showToast('✅ Atualizado com sucesso!');
}

function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  if (modal) hideModal(modal);
  STATE.editType = null;
  STATE.editId   = null;
}

// ============================================================
// 15. MODAL CONFIRMAÇÃO
// ============================================================
function showConfirm(message, onConfirm) {
  const modal = document.getElementById('confirm-modal');
  const desc  = document.getElementById('confirm-desc');
  if (!modal || !desc) { onConfirm(); return; }
  desc.textContent = message;
  STATE.confirmCb  = onConfirm;
  showModal(modal);
  document.getElementById('confirm-ok')?.focus();
}

// ============================================================
// 16. MODAL ATALHOS
// ============================================================
function showShortcutsModal() {
  const modal = document.getElementById('shortcuts-modal');
  const body  = document.getElementById('shortcuts-body');
  if (!modal || !body) return;
  body.innerHTML = `<div class="shortcuts-grid">${Object.entries(KEYBOARD_SHORTCUTS).map(([key, desc]) => `
    <div class="shortcut-row"><kbd class="kbd">${esc(key)}</kbd><span>${esc(desc)}</span></div>
  `).join('')}</div>`;
  showModal(modal);
}

// ============================================================
// 17. ONBOARDING
// ============================================================
const ONB_STEPS = [
  { title: '👋 Bem-vindo!',         body: 'Este é o Dashboard Financeiro da Familia Feitoza. Gerencie receitas, despesas, metas e investimentos em um só lugar.' },
  { title: '📅 Calendário',         body: 'Cadastre receitas e despesas no Calendário. Eventos marcados como recorrentes são gerados automaticamente todo mês.' },
  { title: '🎯 Metas',             body: 'Defina metas de economia e acompanhe o progresso. O dashboard alerta quando uma meta está atrasada.' },
  { title: '🔄 Sincronização',     body: 'Seus dados ficam salvos localmente e podem ser sincronizados com Google Sheets. Clique em "Sincronizar" na sidebar.' },
];

let onbStep = 0;

function checkOnboarding() {
  if (localStorage.getItem('ff_onboarded')) return;
  updateOnbStep();
  const modal = document.getElementById('onb-modal');
  if (modal) showModal(modal);
}

function updateOnbStep() {
  const wrap = document.getElementById('onb-step-wrap');
  if (!wrap) return;
  const step = ONB_STEPS[onbStep];
  if (!step) return;
  wrap.innerHTML = `
    <h3>${esc(step.title)}</h3>
    <p style="color:var(--text2);line-height:1.6;margin:12px 0 20px">${esc(step.body)}</p>
    <div class="onb-dots">${ONB_STEPS.map((_, i) => `<span class="onb-dot ${i === onbStep ? 'active' : ''}"></span>`).join('')}</div>`;
  const nextBtn = document.getElementById('onb-next-btn');
  if (nextBtn) nextBtn.textContent = onbStep < ONB_STEPS.length - 1 ? 'Próximo →' : 'Começar 🚀';
}

function nextOnboarding() {
  onbStep++;
  if (onbStep >= ONB_STEPS.length) { finishOnboarding(); return; }
  updateOnbStep();
}

function finishOnboarding() {
  localStorage.setItem('ff_onboarded', '1');
  const modal = document.getElementById('onb-modal');
  if (modal) hideModal(modal);
}

// ============================================================
// 18. RECURRING
// ============================================================
function generateRecurring() {
  const now   = new Date();
  const month = now.getMonth();
  const year  = now.getFullYear();
  db.calendar.forEach(evt => {
    if (!evt.recurring || evt.parentId) return;
    generateRecurringFor(evt, month, year);
  });
}

function generateRecurringFor(template, targetMonth, targetYear) {
  if (targetMonth === undefined) targetMonth = STATE.calMonth;
  if (targetYear  === undefined) targetYear  = STATE.calYear;

  const exists = db.calendar.some(e =>
    e.parentId === template.id && e.date &&
    new Date(e.date + 'T00:00:00').getMonth()    === targetMonth &&
    new Date(e.date + 'T00:00:00').getFullYear() === targetYear
  );
  if (exists) return;

  const [,, day] = (template.date || '').split('-');
  const diasDoMes = new Date(targetYear, targetMonth + 1, 0).getDate();
  const dia = Math.min(Number(day) || 1, diasDoMes);
  const newDate  = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  db.calendar.push({
    id: uid(), title: template.title, amount: template.amount,
    type: template.type, category: template.category, date: newDate,
    recurring: false, parentId: template.id,
    installmentTotal: template.installmentTotal || 1,
    installmentIndex: template.installmentIndex || 1,
    createdAt: new Date().toISOString(),
  });
}

function generateInstallmentFuture(template) {
  const total = template.installmentTotal || 1;
  if (total <= 1) return;

  const [y, m, d] = (template.date || '').split('-').map(Number);
  for (let i = template.installmentIndex + 1; i <= total; i++) {
    const futureMonth = m - 1 + (i - template.installmentIndex);
    const futureYear  = y + Math.floor(futureMonth / 12);
    const futureMonthIdx = ((futureMonth % 12) + 12) % 12;
    const diasDoMes = new Date(futureYear, futureMonthIdx + 1, 0).getDate();
    const dia = Math.min(d || 1, diasDoMes);
    const newDate = `${futureYear}-${String(futureMonthIdx + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

    const exists = db.calendar.some(e =>
      e.parentId === template.id &&
      e.installmentIndex === i
    );
    if (exists) continue;

    db.calendar.push({
      id: uid(), title: template.title, amount: template.amount,
      type: template.type, category: template.category, date: newDate,
      recurring: false, parentId: template.id,
      installmentTotal: total, installmentIndex: i,
      createdAt: new Date().toISOString(),
    });
  }
}

// ============================================================
// 19. EXPORT / IMPORT
// ============================================================
function exportData() {
  const json = JSON.stringify(db, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `familia-feitoza-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇️ Dados exportados!');
}

function importData() {
  document.getElementById('import-file-input')?.click();
}

function handleImportFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      db = { ...deepClone(DEFAULT_DB), ...parsed };
      saveAll();
      goTo(STATE.page);
      showToast('✅ Dados importados!');
    } catch (_) {
      showToast('❌ Arquivo JSON inválido.', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ============================================================
// 20. TOAST
// ============================================================
function showToast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = msg;
  toast.setAttribute('role', 'status');
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, TOAST_DURATION_MS);
}

// ============================================================
// 21. UI HELPERS
// ============================================================
function showModal(modal) {
  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('show'));
  document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
  modal.classList.remove('show');
  document.body.style.overflow = '';
  setTimeout(() => { modal.hidden = true; }, 250);
}

function clearForm(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = false;
    else el.value = '';
  });
}

function populateCategorySelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione...</option>' +
    CATEGORIES.map(c => `<option value="${esc(c.value)}">${c.icon} ${esc(c.value)}</option>`).join('');
}

function showChartEmpty(canvas, msg) {
  canvas.style.display = 'none';
  const wrap = canvas.parentElement;
  if (!wrap) return;
  let placeholder = wrap.querySelector('.chart-empty');
  if (!placeholder) {
    placeholder = document.createElement('div');
    placeholder.className = 'chart-empty';
    wrap.appendChild(placeholder);
  }
  placeholder.textContent = msg;
  placeholder.style.display = '';
}

function hideChartEmpty(canvas) {
  canvas.style.display = '';
  const wrap = canvas.parentElement;
  if (!wrap) return;
  const placeholder = wrap.querySelector('.chart-empty');
  if (placeholder) placeholder.style.display = 'none';
}

function insightHTML(items) {
  return items.map(i => `
    <div class="insight-item">
      <div class="insight-value">${esc(String(i.value))}</div>
      <div class="insight-label">${esc(i.label)}</div>
      ${i.sub ? `<div class="insight-sub">${esc(i.sub)}</div>` : ''}
    </div>
  `).join('');
}

function toggleCollapsible(bodyId) {
  const body   = document.getElementById(bodyId);
  const header = document.querySelector(`[data-toggle="${bodyId}"]`);
  if (!body || !header) return;
  const isOpen = !body.hidden;
  if (isOpen) {
    body.hidden = true;
  } else {
    body.removeAttribute('hidden');
  }
  header.setAttribute('aria-expanded', String(!isOpen));
  const arrow = header.querySelector('.collapsible-arrow');
  if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
}

// ============================================================
// 22. TEMA
// ============================================================
function toggleTheme() {
  const isDark = document.body.dataset.theme === 'dark';
  document.body.dataset.theme = isDark ? 'light' : 'dark';
  const btn = document.querySelector('[data-action="toggle-theme"]');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
  localStorage.setItem('ff_theme', document.body.dataset.theme);
}

function loadTheme() {
  const saved = localStorage.getItem('ff_theme');
  if (saved) document.body.dataset.theme = saved;
}

// ============================================================
// 23. DELEGAÇÃO DE EVENTOS
// ============================================================
function setupEventDelegation() {
  document.addEventListener('click', e => {
    const target = e.target.closest('[data-action], [data-page], [data-toggle]');
    if (!target) return;

    const action = target.dataset.action;
    const page   = target.dataset.page;
    const toggle = target.dataset.toggle;
    const id     = target.dataset.id ? Number(target.dataset.id) : null;
    const type   = target.dataset.type;
    const filter = target.dataset.filter;

    if (page)   { goTo(page); return; }
    if (toggle) { toggleCollapsible(toggle); return; }

    switch (action) {
      case 'toggle-theme':      toggleTheme(); break;
      case 'shortcuts':         showShortcutsModal(); break;
      case 'close-shortcuts':   hideModal(document.getElementById('shortcuts-modal')); break;
      case 'open-fab':          openFab(); break;
      case 'close-fab':         closeFab(); break;
      case 'save-fab':          saveFab(); break;
      case 'edit':              openEditModal(type, id); break;
      case 'save-edit':         saveEdit(); break;
      case 'close-edit':        closeEditModal(); break;
      case 'next-onboarding':   nextOnboarding(); break;
      case 'finish-onboarding': finishOnboarding(); break;
      case 'ov-prev':           ovPrevMonth(); break;
      case 'ov-next':           ovNextMonth(); break;
      case 'cal-prev':          calPrevMonth(); break;
      case 'cal-next':          calNextMonth(); break;
      case 'cal-filter':        STATE.calFilter = filter; renderCalFilters(); renderCalendar(); break;
      case 'add-calendar-event':addCalendarEvent(); break;
      case 'remove-calendar':   removeCalendarEvent(id); break;
      case 'toggle-paid':       togglePaid(id); break;
      case 'open-add-event':    toggleCollapsible('cal-form-body'); break;
      case 'add-card':          addCard(); break;
      case 'remove-card':       removeCard(id); break;
      case 'open-add-card':     toggleCollapsible('card-form-body'); break;
      case 'add-account':       addAccount(); break;
      case 'remove-account':    removeAccount(id); break;
      case 'open-add-account':  toggleCollapsible('account-form-body'); break;
      case 'add-transfer':      addTransfer(); break;
      case 'remove-transfer':   removeTransfer(id); break;
      case 'open-add-transfer': toggleCollapsible('transfer-form-body'); populateTransferSelects(); break;
      case 'add-investment':    addInvestment(); break;
      case 'remove-investment': removeInvestment(id); break;
      case 'open-add-investment':toggleCollapsible('invest-form-body'); break;
      case 'add-goal':          addGoal(); break;
      case 'remove-goal':       removeGoal(id); break;
      case 'open-add-goal':     toggleCollapsible('goal-form-body'); break;
      case 'update-budget':     updateBudget(); break;
      case 'export':            exportData(); break;
      case 'import':            importData(); break;
      case 'sync':              syncManual(); break;
    }
  });

  // Fechar modais pelo overlay
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target !== overlay) return;
      if (overlay.id === 'fab-modal')      closeFab();
      else if (overlay.id === 'edit-modal')     closeEditModal();
      else if (overlay.id === 'confirm-modal')  { hideModal(overlay); STATE.confirmCb = null; }
      else                                      hideModal(overlay);
    });
  });

  // Confirm modal buttons
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    STATE.confirmCb?.();
    hideModal(document.getElementById('confirm-modal'));
    STATE.confirmCb = null;
  });
  document.getElementById('confirm-cancel')?.addEventListener('click', () => {
    hideModal(document.getElementById('confirm-modal'));
    STATE.confirmCb = null;
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    const inInput = document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);

    if (e.key === 'Escape') {
      closeFab(); closeEditModal();
      hideModal(document.getElementById('confirm-modal'));
      hideModal(document.getElementById('shortcuts-modal'));
      return;
    }
    if (inInput) return;

    const pages = { '1': 'overview', '2': 'cards', '3': 'calendar', '4': 'budget', '5': 'accounts', '6': 'investments', '7': 'goals' };
    if (pages[e.key]) { e.preventDefault(); goTo(pages[e.key]); return; }
    if (e.key === 'n') { e.preventDefault(); openFab(); return; }
    if (e.key === 't') { e.preventDefault(); document.querySelector('[data-action="toggle-theme"]')?.click(); return; }
    if (e.key === 's') { e.preventDefault(); syncWithSheets(); return; }
    if (e.key === 'e') { e.preventDefault(); exportData(); return; }
    if (e.key === '?' || e.key === '/') { e.preventDefault(); showShortcutsModal(); return; }
  });

  // Calendar search (debounced)
  const calSearch = document.getElementById('cal-search');
  if (calSearch) {
    calSearch.addEventListener('input', debounce(ev => {
      STATE.calSearch = ev.target.value.trim();
      renderCalendar();
    }, DEBOUNCE_DELAY_MS));
  }

  // Import file
  document.getElementById('import-file-input')?.addEventListener('change', handleImportFile);

  // Mobile sidebar
  const menuBtn      = document.getElementById('topbar-menu-btn');
  const sidebarEl    = document.getElementById('sidebar');
  const sidebarOv    = document.getElementById('sidebar-overlay');
  if (menuBtn && sidebarEl && sidebarOv) {
    menuBtn.addEventListener('click', () => {
      const isOpen = sidebarEl.classList.toggle('open');
      sidebarOv.classList.toggle('show', isOpen);
      menuBtn.setAttribute('aria-expanded', String(isOpen));
    });
    sidebarOv.addEventListener('click', () => {
      sidebarEl.classList.remove('open');
      sidebarOv.classList.remove('show');
      menuBtn.setAttribute('aria-expanded', 'false');
    });
  }

  // Collapsibles keyboard
  document.addEventListener('keydown', ev => {
    const tgt = ev.target.closest('[data-toggle]');
    if (tgt && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); toggleCollapsible(tgt.dataset.toggle); }
  });
}

// ============================================================
// 24. SYNC MANUAL
// ============================================================
async function syncManual() {
  if (STATE.syncing) return;
  STATE.syncing = true;
  updateSyncStatus('🔄 Sincronizando...', false);
  try {
    await refreshFromSheets();
    updateSyncStatus('✅ Sincronizado', true);
    showToast('✅ Sincronizado com Sheets!');
  } catch (_) {
    updateSyncStatus('⚠️ Erro', false);
    showToast('⚠️ Erro ao sincronizar', 'error');
  } finally {
    STATE.syncing = false;
  }
}

// ============================================================
// 25. INICIALIZAÇÃO
// ============================================================
function init() {
  loadTheme();
  load();
  generateRecurring();
  populateCategorySelect('fab-category');
  populateCategorySelect('evt-category');
  renderCalFilters();
  renderOverview();
  setupEventDelegation();
  goTo('overview');
  setTimeout(() => { try { pushToSheets(); } catch (_) {} }, 2000);
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  checkOnboarding();

  const topbar = document.querySelector('.topbar');
  if (topbar) {
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          topbar.classList.toggle('scrolled', window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
});
