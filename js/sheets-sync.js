// ========== GOOGLE SHEETS SYNC (CORRIGIDO) ==========

const SHEET_ID = "1ABC123DEF456"; 
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzUQXQFTa9xfvA_5uDYUpRsjpbVtkTp7-_5AqY-h4QFvctcjff7kN5SICL4inQ5f_cuJg/exec";

let hasLoadedFromSheets = false;
let _lastPushHash = "";

// ========== CARREGAR DO SHEETS NA ABERTURA ==========
async function loadSheetDataOnce() {
  if (hasLoadedFromSheets) return; // Já carregou, não faz de novo
  if (!SHEET_ID || !SCRIPT_URL) return;

  try {
    console.log("⏳ Carregando dados do Google Sheets na abertura...");
    const sheetData = await loadFromSheets();
    
    if (sheetData && Object.keys(sheetData).length > 0) {
      // Mesclar: dados do Sheets são "base", mas localStorage pode ter coisas mais novas
      db = { ...sheetData, ...db }; // localStorage sobrescreve Sheets (dados locais são prioridade)
      persist();
      console.log("✅ Dados do Sheets carregados (primeira vez)");
    }
  } catch (error) {
    console.error("Erro ao carregar do Sheets:", error);
  }
  
  hasLoadedFromSheets = true;
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
  if (!SCRIPT_URL) return false;

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      body: JSON.stringify({
        action: "save",
        data: data
      })
    });

    if (response.ok) {
      console.log("✅ Dados salvos no Google Sheets");
      return true;
    }
  } catch (error) {
    console.warn("⚠️ Erro ao salvar no Sheets:", error);
  }
  return false;
}

// ========== ATUALIZAR DO SHEETS (botão manual) ==========
async function refreshFromSheets() {
  if (!SCRIPT_URL) {
    alert("Google Sheets não configurado");
    return;
  }

  try {
    updateSyncStatus("🔄 Atualizando...", false);
    const sheetData = await loadFromSheets();
    
    if (sheetData && Object.keys(sheetData).length > 0) {
      mergeSheetData(sheetData);
      persist();
      console.log("✅ Dados atualizados do Sheets");
      updateSyncStatus("✅ Atualizado", true);
      
      renderOverview();
      renderAccounts();
      renderCalendar();
      renderCards();
      renderGoals();
      renderInvestments();
    } else {
      updateSyncStatus("✅ Atualizado", true);
    }
  } catch (error) {
    console.error("Erro ao atualizar:", error);
    updateSyncStatus("⚠️ Erro", false);
  }
}

// ========== MESCLAR DADOS DO SHEETS ==========
function mergeSheetData(sheetData) {
  const arrayFields = ['accounts', 'cards', 'calendar', 'goals', 'investments'];

  arrayFields.forEach(field => {
    if (!sheetData[field]) return;
    const sheetItems = sheetData[field];
    const localItems = db[field] || [];

    const localMap = new Map(localItems.map(item => [item.id, item]));
    const merged = [];

    sheetItems.forEach(sheetItem => {
      const localItem = localMap.get(sheetItem.id);
      if (localItem) {
        const sheetTime = new Date(sheetItem.createdAt || 0).getTime();
        const localTime = new Date(localItem.createdAt || 0).getTime();
        merged.push(localTime >= sheetTime ? localItem : sheetItem);
        localMap.delete(sheetItem.id);
      } else {
        merged.push(sheetItem);
      }
    });

    localMap.forEach(item => merged.push(item));
    db[field] = merged;
  });

  if (sheetData.income !== undefined) db.income = sheetData.income;
  if (sheetData.budget) db.budget = sheetData.budget;
}

// ========== SYNC AUTOMÁTICO (APENAS ENVIAR) ==========
function getDataHash(data) {
  try {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return String(hash);
  } catch (_) { return ""; }
}

async function pushToSheets() {
  if (!SCRIPT_URL) return;

  const currentHash = getDataHash(db);
  if (currentHash === _lastPushHash) return;

  try {
    await saveToSheets(db);
    _lastPushHash = currentHash;
    updateSyncStatus("✅ Sincronizado", true);
  } catch (error) {
    console.error("Erro no push automático:", error);
    updateSyncStatus("⚠️ Erro", false);
  }
}

// ========== ATUALIZAR STATUS ==========
function updateSyncStatus(status, synced) {
  const badge = document.getElementById("sync-status");
  if (badge) {
    badge.textContent = status;
    badge.classList.remove('sync-badge--syncing');
    if (status.includes('🔄')) {
      badge.classList.add('sync-badge--syncing');
      badge.style.borderColor = '';
      badge.style.color = '';
    } else if (synced) {
      badge.style.borderColor = "var(--green)";
      badge.style.color = "var(--green)";
    } else {
      badge.style.borderColor = "var(--text4)";
      badge.style.color = "var(--text4)";
    }
  }
}

// ========== AUTO-PUSH A CADA 2 MINUTOS (só envia, nunca sobrescreve) ==========
setInterval(() => {
  pushToSheets();
}, 120000);

// ========== AUTO-PUSH AO SAIR DO DASHBOARD ==========
window.addEventListener("beforeunload", () => {
  persistFlush();
  if (SCRIPT_URL) {
    const payload = JSON.stringify({ action: "save", data: db });
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon(SCRIPT_URL, blob);
  }
});
