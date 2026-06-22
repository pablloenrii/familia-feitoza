# Familia Feitoza — Dashboard Financeiro

## Visão geral
Dashboard financeiro pessoal da família Feitoza. Aplicação web estática (sem backend) com persistência via localStorage e sincronização com Google Sheets via Apps Script.

## Stack
- HTML + CSS + JS puro (sem framework)
- Chart.js 4.4.1 (gráficos)
- GSAP 3.12.2 (animações)
- Google Fonts — Inter

## Design
- Fundo: `#09090b` (quase preto)
- Cor principal: `#f97316` (laranja)
- Fonte: Inter
- Dark mode nativo

## Estrutura de arquivos
```
index.html          — estrutura completa da UI
css/styles.css      — todos os estilos
js/app.js           — lógica principal, db, render, eventos
js/sheets-sync.js   — sincronização com Google Sheets
js/modules.js       — módulos auxiliares
SETUP_GOOGLE_SHEETS.md — instruções de configuração do Sheets
```

## Banco de dados (localStorage)
```js
db = {
  accounts: [],     // contas bancárias
  cards: [],        // cartões de crédito
  calendar: [],     // eventos financeiros (receitas, despesas, metas)
  goals: [],        // metas de economia
  investments: [],  // investimentos
  income: 0,        // renda mensal
  budget: { needs, wants, invest },
  lastSync: null
}
```

### Estrutura de um evento do calendário
```js
{
  id, title, date, amount, type,  // type: "Receita" | "Despesa" | "Meta"
  category,                        // "Alimentação" | "Transporte" | "Moradia" | "Saúde" | "Lazer" | "Educação" | "Salário" | "Outros"
  recurring,                       // boolean — recorrente mensal
  parentId,                        // id do evento-template se for gerado automaticamente
  createdAt
}
```

## Seções do dashboard
| Rota (goTo) | Seção |
|---|---|
| `overview` | Visão Geral — KPIs, próximos eventos, metas, patrimônio, budget |
| `cards` | Cartões de Crédito |
| `calendar` | Calendário Financeiro |
| `budget` | Budget 50/30/20 |
| `accounts` | Contas Bancárias |
| `investments` | Investimentos |
| `goals` | Metas de Economia |

## Padrões de código
- Após qualquer alteração no `db`, sempre chamar `persist()` e `saveToSheets(db)`
- Após salvar, re-renderizar a seção atual e o insight correspondente
- Toast de confirmação: `showToast("✅ Mensagem")`
- Modais fecham com ESC ou clique fora do box
- Botão ✏️ edita, ✕ remove — ambos presentes em todos os itens

## Funções principais (app.js)
```
fmt(val)                    — formata como R$ BRL
fmtDate(date)               — formata data pt-BR
persist()                   — salva db no localStorage
load()                      — carrega db do localStorage
goTo(page)                  — navega entre seções
generateRecurring()         — cria instâncias mensais de eventos recorrentes
openFab() / saveFab()       — botão flutuante "+"
openEditModal(type, id)     — abre modal de edição
saveEdit()                  — salva edição
showToast(msg)              — toast verde temporário
renderInsight[Seção]()      — atualiza card de insights de cada seção
```

## Deploy
- **Repositório:** github.com/pablloenrii/familia-feitoza
- **Deploy:** familia-feitoza.vercel.app
- **Auto-deploy:** Vercel faz deploy automático a cada push na branch `main`

## Fluxo de trabalho
```bash
# Após editar arquivos:
git add .
git commit -m "feat/fix: descrição"
git push origin main
# Vercel faz o deploy automaticamente
```

## Sincronização Google Sheets
Configurada via Apps Script. Ver `SETUP_GOOGLE_SHEETS.md` para detalhes.
A função `syncWithSheets()` é chamada 2s após o carregamento e pode ser acionada manualmente pelo botão "Sincronizar" na sidebar.
