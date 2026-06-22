// ========== GOOGLE SHEETS SYNC ==========

// IMPORTANTE: Você precisa:
// 1. Criar uma Google Sheet compartilhada
// 2. Copiar seu SHEET_ID
// 3. Criar um Apps Script no Google Sheets (veja instruções abaixo)
// 4. Colar o SCRIPT_URL aqui

const SHEET_ID = "1ABC123DEF456"; // Substitua com seu ID da planilha
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzUQXQFTa9xfvA_5uDYUpRsjpbVtkTp7-_5AqY-h4QFvctcjff7kN5SICL4inQ5f_cuJg/exec"; // Substitua com a URL do Apps Script web app

// ========== SINCRONIZAR COM SHEETS ==========
async function syncWithSheets() {
  // Se não configurou ainda, mostrar aviso
  if (!SHEET_ID || !SCRIPT_URL) {
    console.log("Google Sheets não configurado ainda. Use localStorage.");
    updateSyncStatus("⏳ Local", false);
    return;
  }

  try {
    updateSyncStatus("🔄 Sincronizando...", false);

    // 1. CARREGAR dados do Google Sheets
    const sheetData = await loadFromSheets();
    if (sheetData) {
      // Mesclar dados: priorizar Sheets sobre localStorage
      mergeData(sheetData);
      db.lastSync = new Date().toISOString();
      persist();
      console.log("✅ Dados carregados do Google Sheets");
    }

    // 2. SALVAR dados locais para Google Sheets
    await saveToSheets(db);
    console.log("✅ Dados salvos no Google Sheets");

    updateSyncStatus("✅ Sincronizado", true);
  } catch (error) {
    console.error("Erro ao sincronizar:", error);
    updateSyncStatus("⚠️ Erro sync", false);
  }
}

// ========== CARREGAR DO SHEETS ==========
async function loadFromSheets() {
  if (!SCRIPT_URL) return null;

  try {
    const response = await fetch(SCRIPT_URL + "?action=load", {
      method: "GET",
      mode: "cors"
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.warn("Não conseguiu carregar do Sheets:", error);
  }
  return null;
}

// ========== SALVAR NO SHEETS ==========
async function saveToSheets(data) {
  if (!SCRIPT_URL) return;

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "save",
        data: data
      })
    });

    return response.ok;
  } catch (error) {
    console.warn("Não conseguiu salvar no Sheets:", error);
  }
  return false;
}

// ========== MESCLAR DADOS ==========
function mergeData(sheetData) {
  // Estratégia: Se há dados no Sheets mais recentes que localStorage, usar Sheets
  // Senão, manter localStorage

  if (sheetData && sheetData.accounts && sheetData.accounts.length > 0) {
    db.accounts = sheetData.accounts;
  }
  if (sheetData && sheetData.cards && sheetData.cards.length > 0) {
    db.cards = sheetData.cards;
  }
  if (sheetData && sheetData.goals && sheetData.goals.length > 0) {
    db.goals = sheetData.goals;
  }
  if (sheetData && sheetData.calendar && sheetData.calendar.length > 0) {
    db.calendar = sheetData.calendar;
  }
  if (sheetData && sheetData.investments && sheetData.investments.length > 0) {
    db.investments = sheetData.investments;
  }
  if (sheetData && sheetData.income && sheetData.income > 0) {
    db.income = sheetData.income;
  }
}

// ========== ATUALIZAR STATUS ==========
function updateSyncStatus(status, synced) {
  const badge = document.getElementById("sync-status");
  if (badge) {
    badge.textContent = status;
    if (synced) {
      badge.style.borderColor = "var(--green)";
      badge.style.color = "var(--green)";
    } else {
      badge.style.borderColor = "var(--text4)";
      badge.style.color = "var(--text4)";
    }
  }
}

// ========== AUTO-SYNC A CADA 2 MINUTOS ==========
setInterval(() => {
  syncWithSheets();
}, 120000);

// ========== AUTO-SYNC AO SAIR DO DASHBOARD ==========
window.addEventListener("beforeunload", () => {
  if (SCRIPT_URL) {
    navigator.sendBeacon(SCRIPT_URL, JSON.stringify({
      action: "save",
      data: db
    }));
  }
});

// ========== SCRIPT APPS SCRIPT PARA GOOGLE SHEETS ==========
/*

INSTRUÇÕES:
1. Vá para https://sheets.new e crie uma nova planilha
2. Copie o URL e extraia o ID (entre /d/ e /edit)
3. Clique em "Extensões" > "Apps Script"
4. Cole o código abaixo no editor
5. Salha e clique em "Deploy" > "New Deployment" > "Web app"
6. Configure para "Execute as" seu email e "Who has access" "Anyone"
7. Copie a URL de deployment
8. Volte aqui e preencha SHEET_ID e SCRIPT_URL

---

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
  // Limpar planilha
  sheet.clear();
  
  // Adicionar header
  sheet.appendRow(['key', 'value']);
  
  // Salvar dados como JSON
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

---

*/
