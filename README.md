# 📊 Familia Feitoza - Dashboard Financeiro v2.0

Dashboard premium de finanças familiares com sincronização **bidirecional** com Google Sheets.

## ✨ Características

✅ **Dashboard Completo**
- Visão Geral com KPIs em tempo real
- Gestão de Cartões de Crédito
- Calendário Financeiro
- Planificador 50/30/20
- Contas Bancárias
- Portfolio de Investimentos
- Metas de Economia

✅ **Google Sheets Sync**
- Sincronização automática a cada 2 minutos
- Dados persistem remotamente
- Acesso de múltiplos dispositivos
- Backup automático no Google Drive

✅ **Design Premium**
- Black theme com laranja #f97316
- Glass morphism
- Responsive (mobile, tablet, desktop)
- Animations smooth com GSAP
- Charts com Chart.js

✅ **Arquitetura Modular**
- HTML, CSS, JS separados
- Pronto para Vercel
- Escalável para novos módulos
- localStorage como fallback

---

## 🚀 Quick Start (Desenvolvimento Local)

### 1. Clonar projeto
```bash
git clone https://github.com/seu-usuario/familia-feitoza.git
cd familia-feitoza
```

### 2. Rodar localmente
```bash
# Opção 1: Python 3
python3 -m http.server 3000

# Opção 2: Node.js
npx http-server -p 3000

# Opção 3: Live Server no VS Code
# Clique em "Go Live"
```

Abra: **http://localhost:3000**

---

## 🔗 Google Sheets Setup (Fundamental)

### A. Criar a Planilha

1. Vá para **https://sheets.new**
2. Dê um nome: "Familia Feitoza Data"
3. Copie o ID da URL:
   ```
   https://docs.google.com/spreadsheets/d/AQUI_É_O_ID/edit
   ```

### B. Criar o Apps Script

1. Na sua planilha, clique em **Extensões > Apps Script**
2. **Cole o código abaixo** no editor (substitua tudo):

```javascript
function doGet(e) {
  const action = e.parameter.action;
  const sheet = SpreadsheetApp.getActiveSheet();

  if (action === 'load') {
    return loadData(sheet);
  }
  
  return HtmlService.createHtmlOutput('OK');
}

function doPost(e) {
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  const data = params.data;
  const sheet = SpreadsheetApp.getActiveSheet();

  if (action === 'save') {
    saveData(sheet, data);
  }

  return ContentService
    .createTextOutput(JSON.stringify({status: 'ok'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function saveData(sheet, data) {
  sheet.clear();
  sheet.appendRow(['key', 'value']);
  sheet.appendRow(['data', JSON.stringify(data)]);
  sheet.appendRow(['lastSync', new Date().toISOString()]);
}

function loadData(sheet) {
  const range = sheet.getDataRange().getValues();
  
  for (let i = 1; i < range.length; i++) {
    if (range[i][0] === 'data') {
      const data = JSON.parse(range[i][1]);
      return ContentService
        .createTextOutput(JSON.stringify(data))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  return ContentService
    .createTextOutput(JSON.stringify({}))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Salve (Ctrl+S)
4. Clique em **Deploy** (canto superior direito)
5. Selecione **New Deployment**
6. Escolha tipo: **Web app**
7. Configure:
   - Execute as: Seu email
   - Who has access: Anyone
8. Clique **Deploy**
9. **Copie a URL do web app** (vai parecer com):
   ```
   https://script.google.com/macros/d/[ID]/usercript
   ```

### C. Conectar Dashboard ao Sheets

Edite `js/sheets-sync.js` e preencha:

```javascript
const SHEET_ID = "sua_id_aqui";
const SCRIPT_URL = "https://script.google.com/macros/d/[ID]/usercript";
```

**Pronto!** Agora o dashboard vai sincronizar automaticamente. 🎉

---

## 📤 Deploy no Vercel

### 1. Preparar GitHub

```bash
git add .
git commit -m "Initial commit: Familia Feitoza v2.0"
git push origin main
```

### 2. Deploy no Vercel

1. Vá para **https://vercel.com**
2. Clique em **New Project**
3. Selecione seu repositório do GitHub
4. Configure:
   - Framework: **Other (Static)**
   - Build Command: `echo 'Static site - no build needed'`
   - Output Directory: `.`
5. Clique **Deploy**

**Sua URL será algo como:** `https://familia-feitoza.vercel.app`

### 3. Variables de Ambiente (Opcional)

Se quiser guardar secrets no Vercel:
1. Project Settings > Environment Variables
2. Adicione:
   - `GOOGLE_SHEET_ID`: seu ID
   - `APPS_SCRIPT_URL`: sua URL do Apps Script

---

## 📱 Como Usar

### 1. **Onboarding**
- Na primeira vez, o dashboard mostra um wizard configuração
- Defina sua renda mensal e primeira meta

### 2. **Adicionar Dados**
- **Contas**: Cadastre suas contas bancárias (saldo inicial)
- **Cartões**: Registre seus cartões de crédito e limites
- **Investimentos**: Acompanhe ações, fundos, criptos
- **Metas**: Defina objetivos com prazo
- **Calendário**: Registre despesas e receitas futuras

### 3. **Acompanhar**
- **Dashboard**: Veja patrimônio total, receita/despesa mensal
- **Budget 50/30/20**: Distribua sua renda (necessidades, desejos, investimentos)
- **Charts**: Veja evolução e composição do seu patrimônio

### 4. **Sincronizar**
- Clique **"🔄 Sincronizar"** na sidebar
- Dados salvam automaticamente no Google Sheets a cada 2 minutos
- Acesse de qualquer dispositivo!

### 5. **Exportar**
- Clique **"⬇️ Exportar"** para baixar backup em JSON

---

## 🔄 Sincronização Automática

| Evento | Ação |
|--------|------|
| Abrir dashboard | Carrega dados do Sheets |
| A cada 2 min | Sincroniza automaticamente |
| Sair da página | Envia dados para Sheets |
| Clicar botão "Sincronizar" | Força sync manual |

---

## 📂 Estrutura do Projeto

```
familia-feitoza/
├── index.html              # Página principal
├── css/
│   └── styles.css         # Estilos premium (preto + laranja)
├── js/
│   ├── app.js             # Lógica principal (localStorage)
│   ├── sheets-sync.js     # Integração Google Sheets
│   └── modules.js         # Placeholder para extensões
├── vercel.json            # Config Vercel
├── package.json           # Metadados npm
├── .gitignore             # Git ignore
└── README.md              # Este arquivo
```

---

## 🎨 Customização

### Mudar Cores
Edite `css/styles.css`:
```css
:root {
  --orange: #f97316;      /* Cor primária */
  --bg: #09090b;          /* Fundo */
  --text: #fafafa;        /* Texto */
}
```

### Adicionar Novo Módulo
1. Adicione seção no `index.html`:
```html
<section id="sec-novo" class="sec">
  <!-- seu conteúdo -->
</section>
```

2. Adicione lógica em `js/app.js`:
```javascript
function renderNovo() {
  // sua lógica
}
```

3. Adicione link na sidebar:
```html
<div class="sb-item" onclick="goTo('novo')">
  <span class="sb-icon">🆕</span> Novo
</div>
```

---

## 🔒 Segurança

⚠️ **IMPORTANTE:**

- O Apps Script é público (qualquer um com a URL pode ver)
- Para máxima segurança, implemente autenticação no Apps Script
- Dados são salvos em texto plano no Sheets
- Para dados sensíveis, use criptografia

---

## 🐛 Troubleshooting

### "Sincronizar não funciona"
1. Verifique se `SHEET_ID` e `SCRIPT_URL` estão corretos
2. Abra console (F12) e procure por erros
3. Teste a URL do Apps Script no navegador
4. Verifique permissões do Sheets (deve ser "Qualquer um com acesso")

### "Dados não carregam"
1. Limpe o localStorage: `localStorage.clear()`
2. Recarregue a página
3. Verifique se há dados no Sheets

### "Deploy no Vercel falha"
1. Verifique se `.git` existe no projeto
2. Confirme que `index.html` está no raiz
3. Remova `node_modules/` antes de fazer push

---

## 📈 Roadmap Futuro

- [ ] Autenticação com Google (login)
- [ ] Gráficos mais avançados (previsões, tendências)
- [ ] Relatórios PDF automáticos
- [ ] Mobile app (React Native)
- [ ] Integração bancária automática
- [ ] AI insights (gastos anormais, economias recomendadas)
- [ ] Compartilhamento entre familiares
- [ ] Notificações push de limites

---

## 📞 Suporte

Dúvidas? Abra uma issue no GitHub ou envie um email.

---

**Made with ❤️ by Pablo Feitoza**

Família merece controle financeiro simples e poderoso. 💰
