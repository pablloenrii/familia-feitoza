// ============================================================
// FAMILIA FEITOZA — CONSTANTS
// Todas as constantes e configurações da aplicação.
// ============================================================

'use strict';

// ---------- Storage ----------
const STORAGE_KEY = 'familia_feitoza_db';

// ---------- Categorias ----------
const CATEGORIES = [
  { value: 'Alimentação',  icon: '🍔', color: '#f97316' },
  { value: 'Transporte',   icon: '🚗', color: '#3b82f6' },
  { value: 'Moradia',      icon: '🏠', color: '#8b5cf6' },
  { value: 'Saúde',        icon: '💊', color: '#22c55e' },
  { value: 'Lazer',        icon: '🎮', color: '#ec4899' },
  { value: 'Educação',     icon: '📚', color: '#06b6d4' },
  { value: 'Salário',      icon: '💼', color: '#84cc16' },
  { value: 'Investimento', icon: '📈', color: '#f59e0b' },
  { value: 'Outros',       icon: '📦', color: '#6b7280' },
];

// ---------- Tipos de evento ----------
const EVENT_TYPES = ['Despesa', 'Receita', 'Meta'];

// ---------- Tipos de conta ----------
const ACCOUNT_TYPES = ['Corrente', 'Poupança', 'Digital', 'Investimento', 'Outro'];

// ---------- Cores para gráficos ----------
const CHART_COLORS = [
  '#f97316', '#3b82f6', '#8b5cf6', '#22c55e', '#ec4899',
  '#06b6d4', '#84cc16', '#f59e0b', '#6b7280', '#ef4444',
];

// ---------- Configurações de sincronização ----------
const SYNC_INTERVAL_MS   = 120_000;  // 2 minutos
const DEBOUNCE_DELAY_MS  = 300;
const THROTTLE_DELAY_MS  = 500;
const TOAST_DURATION_MS  = 3000;
const MAX_RETRIES        = 2;

// ---------- Budget 50/30/20 (defaults) ----------
const DEFAULT_BUDGET = { needs: 50, wants: 30, invest: 20 };

// ---------- DB padrão ----------
const DEFAULT_DB = {
  accounts:    [],
  cards:       [],
  calendar:    [],
  goals:       [],
  investments: [],
  income:      0,
  budget:      { ...DEFAULT_BUDGET },
  lastSync:    null,
};

// ---------- Atalhos de teclado ----------
const KEYBOARD_SHORTCUTS = {
  'n':     'Novo evento (FAB)',
  'Escape':'Fechar modal',
  '1':     'Ir para Visão Geral',
  '2':     'Ir para Cartões',
  '3':     'Ir para Calendário',
  '4':     'Ir para Budget',
  '5':     'Ir para Contas',
  '6':     'Ir para Investimentos',
  '7':     'Ir para Metas',
  '/':     'Buscar no Calendário',
};

// ---------- Meses em português ----------
const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ---------- Filtros do calendário ----------
const CAL_FILTERS = [
  { value: 'all',       label: 'Todos'          },
  { value: 'today',     label: 'Hoje'           },
  { value: 'week',      label: 'Esta semana'    },
  { value: 'upcoming',  label: 'Próx. 7 dias'  },
  { value: 'overdue',   label: 'Atrasados'      },
  { value: 'Receita',   label: 'Receitas'       },
  { value: 'Despesa',   label: 'Despesas'       },
  { value: 'Meta',      label: 'Metas'          },
  { value: 'recurring', label: 'Recorrentes'    },
];
