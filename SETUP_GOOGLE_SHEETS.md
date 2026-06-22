# 🔗 Setup Google Sheets - Passo a Passo (5 minutos)

## ✅ Pré-requisito
Você precisa ter uma conta Google.

---

## 📋 Passo 1: Criar a Planilha

1. Abra **https://sheets.new**
2. Dê um nome: `Familia Feitoza Data`
3. Clique em **Ferramenta Adicional** (engrenagem) > **Configurações**
4. Mude para guia "Compartilhamento"
5. Clique em "Mudar permissões"
6. Selecione: **Qualquer pessoa com o link pode acessar**
7. Permissão: **Editor**

**Copie a URL da planilha.**

Da URL:
```
https://docs.google.com/spreadsheets/d/1ABC123DEF456/edit
                                         ↑ COPIE ISTO ↑
```

Seu **SHEET_ID** é: `1ABC123DEF456`

---

## ⚙️ Passo 2: Criar o Apps Script

1. Na sua planilha aberta, clique em **Extensões** (menu superior)
2. Clique em **Apps Script**
3. Uma aba nova vai abrir do editor do Apps Script
4. **Delete** o código padrão (a função `myFunction`)
5. **Cole exatamente este código:**

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

6. Clique em **Salvar** (Ctrl+S)
7. Uma janela pode pedir para autorizar. Clique em **Autorizar**

---

## 🚀 Passo 3: Deploy como Web App

1. No editor do Apps Script, clique em **Deploy** (canto superior direito)
2. Clique em **New Deployment** (ou + New)
3. Clique no ícone de engrenagem (⚙️) ao lado
4. Selecione **Web app**
5. Preencha:
   - **Execute as:** [Seu email Google]
   - **Who has access:** Anyone
6. Clique **Deploy**
7. Uma tela mostra a URL de seu web app. **COPIE-A:**

```
https://script.google.com/macros/d/AKfycby..../usercript
```

Seu **SCRIPT_URL** é tudo isso aí.

---

## 🔌 Passo 4: Conectar ao Dashboard

1. Volte ao arquivo `familia-feitoza` (seu projeto)
2. Abra o arquivo `js/sheets-sync.js`
3. Na linha 9 e 10, preencha:

```javascript
const SHEET_ID = "1ABC123DEF456";  // Cole o ID da planilha aqui
const SCRIPT_URL = "https://script.google.com/macros/d/AKfycby..../usercript";  // Cole a URL aqui
```

4. **Salve o arquivo**

---

## ✅ Testar Sincronização

1. Abra seu dashboard: `http://localhost:3000`
2. Adicione uma conta bancária (ex: "Minha Poupança", R$ 1000)
3. Clique no botão **"🔄 Sincronizar"** na sidebar
4. Espere 3-5 segundos
5. Vá para sua planilha Google Sheets e **recarregue (F5)**
6. Se vir uma linha com "data" e seus números, **funcionou!** ✅

---

## 🔄 Verificar Auto-Sync

- O dashboard sincroniza **automaticamente a cada 2 minutos**
- Você vê o status em cima: "✅ Sincronizado" ou "⏳ Local"
- Se desconectar da internet, usa localStorage (dados locais)
- Quando conectar novamente, sincroniza automaticamente

---

## 🚨 Se Não Funcionar

### Erro: "CORS error"
- A URL do Apps Script deve ser **pública**
- Verifique em **Extensões > Apps Script > Project Settings**
- Confirme que está deployada como "Web app"

### Erro: "Script URL not configured"
- Você não preencheu `SCRIPT_URL` em `sheets-sync.js`
- Verifique se copiou a URL completa

### Dados não aparecem no Sheets
- Clique em **F12** (console) e procure por erros vermelhos
- Verifique se há dados no dashboard (adicione algo)
- Clique em "Sincronizar" e aguarde

---

## 🎉 Pronto!

Seu dashboard agora está sincronizado com Google Sheets. 

✨ Seus dados estão salvos remotamente e acessíveis de qualquer dispositivo!

---

## 📱 Acessar de Outro Dispositivo

1. Deploy o dashboard no **Vercel** (veja README.md)
2. Abra a URL do Vercel em outro celular/computador
3. Os dados carregam automaticamente do Google Sheets
4. Edite em um dispositivo, sincroniza para todos!

---

**Dúvidas?** Mensagem no WhatsApp ou email. 💬
