/* =========================================================
   js/pages/settings.js - System Settings, Users & Cloud Backup
   ========================================================= */

function pgSettings(){
  const tab = state.settingsTab;
  const db = window.DB || {};

  return `
  <div class="settings-page">
  <div class="card">
    <div class="card-h">
      <h3>🛠️ සැකසුම්<small>Settings</small></h3>
      <div class="settings-tabs" style="display:flex;gap:7px">
        <button class="btn btn-sm ${tab==='shop'?'btn-primary':''}" onclick="state.settingsTab='shop';render()">🏪 සාප්පු තොරතුරු</button>
        ${state.user.role==='superadmin'?`<button class="btn btn-sm ${tab==='users'?'btn-primary':''}" onclick="state.settingsTab='users';render()">👤 පරිශීලකයන්</button>`:''}
        <button class="btn btn-sm ${tab==='hardware'?'btn-primary':''}" onclick="state.settingsTab='hardware';render()">🖨️ Hardware & Printer</button>
        <button class="btn btn-sm ${tab==='backup'?'btn-primary':''}" onclick="state.settingsTab='backup';render()">💾 දත්ත Backup</button>
      </div>
    </div>

    <!-- 🚀 App Version & Cloudflare Live Update Card -->
    <div class="card" style="margin-top:14px;background:#111c30;border:1px solid var(--line);border-radius:12px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:14.5px;font-weight:700;display:flex;align-items:center;gap:8px;margin-bottom:3px">
            🚀 පද්ධති සංස්කරණය: <code style="color:#38bdf8;font-size:13px">v2.5.9</code>
            <span class="pill ok" style="font-size:11px">Cloudflare Live</span>
          </div>
          <small style="color:var(--muted);font-size:12px;display:block">Mobile දුරකථනයේ හෝ පරිගණකයේ අලුත්ම Features නොපෙනේ නම්, පැරණි Cache ඉවත් කර නවතම අනුවාදය ලබාගන්න.</small>
        </div>
        <button class="btn btn-primary btn-sm" onclick="forceUpdateApp()" style="display:flex;align-items:center;gap:6px;font-weight:700;padding:8px 14px">
          🔄 යෙදුම යාවත්කාලීන කරන්න (Update App)
        </button>
      </div>
    </div>

    ${tab==='shop' ? (state.user?.role === 'cashier' ? `
    <div style="margin-top:14px;padding:20px;text-align:center;color:var(--muted)">
      🔒 සාප්පු තොරතුරු වෙනස් කිරීමට ඔබට අවසර නැත (Restricted)
    </div>` : (() => {
      const curShop = state.activeShop || db.shop || {};
      return `
    <div class="grid2" style="margin-top:14px">
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">
          සාප්පුවේ නම / Shop Name
          ${state.user?.role !== 'superadmin' ? '<span style="color:#fcd34d;font-size:10.5px;margin-left:4px">🔒 (Super Admin Only)</span>' : ''}
        </label>
        <input id="setShopName" value="${esc(curShop.name || '')}"
               ${state.user?.role === 'superadmin' ? '' : 'readonly disabled title="Super Admin පමණක් වෙනස් කළ හැක" style="opacity:0.75;cursor:not-allowed;background:#141f33"'}>
      </div>
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">දුරකථන අංකය / Phone</label>
        <input id="setShopPhone" value="${esc(curShop.phone || '')}">
      </div>
    </div>
    <div style="margin-top:14px">
      <label style="font-size:12px;color:var(--muted);font-weight:600">ලිපිනය / Address</label>
      <input id="setShopAddr" value="${esc(curShop.address || curShop.addr || '')}">
    </div>
    <div class="grid2" style="margin-top:14px">
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">බදු ප්‍රතිශතය / Tax Rate (%)</label>
        <input id="setShopTax" type="number" min="0" max="100" value="${curShop.tax||0}">
      </div>
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">බිල්පත් පතුලේ පාඨය / Footer Note</label>
        <input id="setShopFooter" value="${esc(curShop.footer || curShop.footerEn || '')}">
      </div>
    </div>
    <div style="margin-top:18px;display:flex;justify-content:flex-end">
      <button class="btn btn-primary" onclick="saveShopSettings()">💾 සැකසුම් සුරකින්න</button>
    </div>`;
    })()) : ''}

    ${tab==='users' ? `
    <div style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <b>පද්ධති පරිශීලක ලැයිස්තුව (${db.users?.length || 0})</b>
        <button class="btn btn-primary btn-sm" onclick="editUser()">+ නව පරිශීලකයෙක්</button>
      </div>
      <div class="tbl-wrap">
      <table class="users-table">
        <thead><tr><th>නම</th><th>පරිශීලක නාමය</th><th>තනතුර</th><th>තත්ත්වය</th><th></th></tr></thead>
        <tbody>
        ${(db.users||[]).map(u=>{
          const uidVal = u.authUid || u.id;
          const curUid = state.user ? (state.user.authUid || state.user.id) : '';
          return `<tr>
          <td data-label="නම"><b>${esc(u.name)}</b></td>
          <td data-label="පරිශීලක නාමය"><code>${esc(u.username)}</code></td>
          <td data-label="තනතුර"><span class="badge ${u.role}">${ROLE_EN[u.role]||u.role}</span></td>
          <td data-label="තත්ත්වය"><span class="pill ${u.active?'ok':'bad'}">${u.active?'ක්‍රියාකාරී':'අක්‍රිය'}</span></td>
          <td data-label="" style="white-space:nowrap">
            <button class="btn btn-sm" onclick="editUser('${uidVal}')">✏️</button>
            ${uidVal!==curUid?`<button class="btn btn-sm btn-red" onclick="delUser('${uidVal}')">🗑️</button>`:''}
          </td></tr>`;
        }).join('')}
        </tbody>
      </table>
      </div>
    </div>` : ''}

    ${tab==='backup' ? `
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:14px">
      <div class="card" style="background:#111c30">
        <h4 style="margin-bottom:6px">📥 Backup දත්ත බාගත කරන්න</h4>
        <p style="color:var(--muted);font-size:12px;margin-bottom:12px">පද්ධතියේ සියලුම භාණ්ඩ, OEM අංක, පාරිභෝගික ණය, සහ විකුණුම් වාර්තා JSON ගොනුවක් ලෙස බාගත කරගන්න.</p>
        <button class="btn btn-blue btn-sm" onclick="downloadBackup()">💾 JSON Backup එක බාගත කරන්න</button>
      </div>

      <div class="card" style="background:#111c30">
        <h4 style="margin-bottom:6px">📤 දත්ත නැවත ඇතුලත් කරන්න (Restore)</h4>
        <p style="color:var(--muted);font-size:12px;margin-bottom:12px">මීට පෙර සුරකින ලද JSON Backup ගොනුවක් තෝරා පද්ධතිය යාවත්කාලීන කරන්න.</p>
        <input type="file" id="backupFile" accept=".json" style="max-width:320px;margin-bottom:10px">
        <br>
        <button class="btn btn-green btn-sm" onclick="restoreBackup()">📂 Backup එකෙන් යථා තත්ත්වයට පත් කරන්න</button>
      </div>

      <div class="card" style="background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3)">
        <h4 style="margin-bottom:6px;color:#fca5a5">⚠️ ආරම්භක තත්ත්වයට පත් කරන්න (Reset to Default)</h4>
        <p style="color:var(--muted);font-size:12px;margin-bottom:12px">මෙමඟින් සියලුම වත්මන් දත්ත ඉවත් කර ආරම්භක දත්ත නැවත පිහිටුවනු ඇත.</p>
        <button class="btn btn-red btn-sm" onclick="resetToDemo()">🔄 Reset Data</button>
      </div>
    </div>` : ''}

    ${tab==='hardware' ? (() => {
      const isConnected = Boolean(window.Printer && window.Printer.isConnected);
      const printerName = (window.Printer && window.Printer.printerName) || localStorage.getItem('pos.printer.name') || 'Bluetooth Thermal Printer';
      const paperWidth = (window.Printer && window.Printer.paperWidth) || localStorage.getItem('pos.printerWidth') || '58';
      const autoPrint = (window.Printer && window.Printer.autoPrint) ?? (localStorage.getItem('pos.printer.autoprint') !== 'false');
      const autoDrawer = (window.Printer && window.Printer.autoDrawer) ?? (localStorage.getItem('pos.printer.autodrawer') !== 'false');

      return `
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:16px">
        <!-- 1. Bluetooth Thermal Printer Section -->
        <div class="card" style="background:#111c30;border:1px solid var(--line);border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
            <div>
              <h4 style="margin:0 0 4px 0;font-size:15px;display:flex;align-items:center;gap:8px">
                🖨️ Bluetooth Thermal Printer (ESC/POS)
                <span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:12px;background:${isConnected ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.15)'};color:${isConnected ? '#34d399' : '#94a3b8'}">
                  <span style="width:7px;height:7px;border-radius:50%;background:${isConnected ? '#10b981' : '#64748b'}"></span>
                  ${isConnected ? ('සම්බන්ධයි: ' + esc(printerName)) : 'සම්බන්ධ කර නොමැත (Disconnected)'}
                </span>
              </h4>
              <p style="color:var(--muted);font-size:12px;margin:0">58mm හෝ 80mm බ්ලූටූත් රිසිට්පත් මුද්‍රණ යන්ත්‍ර Web Bluetooth මඟින් සම්බන්ධ කරන්න.</p>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${isConnected ? `
                <button class="btn btn-sm btn-green" onclick="testPrintHardware()">🖨️ Test Print</button>
                <button class="btn btn-sm" onclick="kickCashDrawer()">💵 Open Drawer</button>
                <button class="btn btn-sm btn-red" onclick="disconnectHardwarePrinter()">🔌 Disconnect</button>
              ` : `
                <button class="btn btn-primary btn-sm" onclick="connectHardwarePrinter()">🔵 Connect Printer</button>
              `}
            </div>
          </div>

          <!-- Configuration Controls -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:14px;background:rgba(15,23,42,0.6);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,0.06)">
            <div>
              <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">කඩදාසි ප්‍රමාණය / Paper Width</label>
              <select id="hwPaperWidth" onchange="setHwPaperWidth(this.value)" style="width:100%">
                <option value="58" ${paperWidth === '58' ? 'selected' : ''}>58mm (2-inch Mobile / Portable)</option>
                <option value="80" ${paperWidth === '80' ? 'selected' : ''}>80mm (3-inch Standard POS)</option>
              </select>
            </div>

            <div style="display:flex;flex-direction:column;justify-content:center;gap:8px">
              <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;user-select:none">
                <input type="checkbox" id="hwAutoPrint" ${autoPrint ? 'checked' : ''} onchange="setHwAutoPrint(this.checked)" style="width:16px;height:16px">
                <span>ස්වයංක්‍රීය Print (Auto-Print on checkout)</span>
              </label>

              <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer;user-select:none">
                <input type="checkbox" id="hwAutoDrawer" ${autoDrawer ? 'checked' : ''} onchange="setHwAutoDrawer(this.checked)" style="width:16px;height:16px">
                <span>මුදල් ලාච්චුව විවෘත කරන්න (Auto-open Cash Drawer)</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 2. Camera Barcode Scanner Section -->
        <div class="card" style="background:#111c30;border:1px solid var(--line);border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <h4 style="margin:0 0 4px 0;font-size:15px">📷 Phone Camera Barcode Scanner</h4>
              <p style="color:var(--muted);font-size:12px;margin:0">ස්මාර්ට්ෆෝන් කැමරාවෙන් හෝ වෙබ්කැමරාවෙන් භාණ්ඩ Barcode / QR ස්කෑන් කිරීම.</p>
              <small style="color:#38bdf8;font-size:11px">සහය දක්වන කේත: EAN-13, EAN-8, Code-128, Code-39, UPC-A, UPC-E, QR Code</small>
            </div>
            <div>
              <button class="btn btn-blue btn-sm" onclick="if(window.BarcodeScanner) BarcodeScanner.open(); else toast('Scanner සූදානම් නැත','warn');">
                📷 Scanner එක පරීක්ෂා කරන්න (Test Camera)
              </button>
            </div>
          </div>
        </div>

        <!-- 3. Barcode Label Generator Section -->
        <div class="card" style="background:#111c30;border:1px solid var(--line);border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <h4 style="margin:0 0 4px 0;font-size:15px">🏷️ Barcode Labels Printing (ලේබල් මුද්‍රණය)</h4>
              <p style="color:var(--muted);font-size:12px;margin:0">භාණ්ඩ හෝ GRN සඳහා Thermal Stickers / ලේබල් මුද්‍රණය කිරීමට ලේබල් අංශය විවෘත කරන්න.</p>
            </div>
            <div>
              <button class="btn btn-primary btn-sm" onclick="go('labels')">
                🏷️ Barcode ලේබල් පිටුවට යන්න
              </button>
            </div>
          </div>
        </div>
      </div>
      `;
    })() : ''}

  </div>
  </div>`;
}

async function saveShopSettings(){
  if(state.user?.role === 'cashier'){
    toast('ඔබට සාප්පු සැකසුම් වෙනස් කිරීමට අවසර නැත', 'err');
    return;
  }
  const db = window.DB || {};
  if(!db.shop) db.shop = {};

  const shopId = state.user?.shopId || state.activeShopId || (state.activeShop && state.activeShop.id);
  if(!shopId){
    toast('සාප්පුව හඳුනාගත නොහැක', 'err');
    return;
  }

  const nameInput = $('#setShopName')?.value.trim();
  const phone = $('#setShopPhone')?.value.trim() || '';
  const addr = $('#setShopAddr')?.value.trim() || '';
  const tax = Math.max(0, parseFloat($('#setShopTax')?.value) || 0);
  const footer = $('#setShopFooter')?.value.trim() || '';

  // Prevent name edit by admin: only superadmin can edit name
  const existingName = state.activeShop?.name || db.shop?.name || '';
  const name = (state.user?.role === 'superadmin' && nameInput) ? nameInput : existingName;

  const data = {
    name,
    phone,
    address: addr,
    addr: addr,
    tax,
    footer,
    footerEn: footer
  };

  // Save to Firestore shops collection
  if(window.FB && window.FB.fbSet){
    const baseShop = (db.shops || []).find(s => s.id === shopId) || state.activeShop || {};
    await window.FB.fbSet(window.FB.COL.shops, shopId, {
      ...baseShop,
      ...data,
      id: shopId
    });
  }
  // Also save settings/shop doc for backward compatibility
  if(window.FB && window.FB.fbSet){
    await window.FB.fbSet(window.FB.COL.settings, 'shop', data);
  }

  // Update local state
  if(state.activeShop){
    Object.assign(state.activeShop, data);
    db.shop = state.activeShop;
  } else {
    db.shop = { ...(db.shop || {}), ...data };
    state.activeShop = db.shop;
  }

  if(db.shops){
    const sObj = db.shops.find(s => s.id === shopId);
    if(sObj) Object.assign(sObj, data);
  }

  if(typeof saveDB === 'function') saveDB();
  if(typeof updateBrandName === 'function') updateBrandName();
  if(typeof updateTopBarShopSwitcher === 'function') updateTopBarShopSwitcher();

  toast('සැකසුම් සුරකින ලදී ✅');
  render();
}

function editUser(id){
  if(typeof openEditUserModal === 'function' && typeof openAddUserModal === 'function'){
    if(id) return openEditUserModal(id);
    return openAddUserModal();
  }
  const db = window.DB || {};
  const u = id ? (db.users||[]).find(x => x.id === id || x.authUid === id) : { name:'', username:'', password:'', role:'cashier', active:true };

  openModal(id ? '✏️ පරිශීලකයා සංස්කරණය' : '➕ නව පරිශීලකයෙක්', 'User Profile',
  `<div class="grid2">
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">සම්පූර්ණ නම *</label>
       <input id="uFullName" value="${esc(u.name)}"></div>
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">පරිශීලක නාමය / Username *</label>
       <input id="uUsername" value="${esc(u.username)}"></div>
   </div>
   <div class="grid2" style="margin-top:12px">
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">මුරපදය / Password *</label>
       <input id="uPass" type="password" value="${esc(u.password)}" placeholder="••••"></div>
     <div><label style="font-size:11.5px;color:var(--muted);font-weight:600">තනතුර / Role</label>
       <select id="uRoleSelect">
         <option value="cashier" ${u.role==='cashier'?'selected':''}>💵 කැෂියර් (Cashier)</option>
         <option value="admin" ${u.role==='admin'?'selected':''}>🛡️ පරිපාලක (Admin)</option>
         <option value="superadmin" ${u.role==='superadmin'?'selected':''}>👑 සුපිරි පරිපාලක (Super Admin)</option>
       </select></div>
   </div>
   <div style="margin-top:12px">
     <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;cursor:pointer">
       <input type="checkbox" id="uActive" ${u.active?'checked':''} style="width:auto"> ක්‍රියාකාරී ගිණුමකි (Active)
     </label>
   </div>`,
  `<button class="btn" onclick="closeModal()">අවලංගු</button>
   <button class="btn btn-primary" onclick="saveUser('${id||''}')">💾 සුරකින්න</button>`);
}

async function saveUser(id){
  const name = $('#uFullName')?.value.trim();
  const username = $('#uUsername')?.value.trim();
  const password = $('#uPass')?.value;
  const role = $('#uRoleSelect')?.value;
  const active = $('#uActive')?.checked;

  if(!name || !username || !password){ toast('සියලු තොරතුරු ඇතුලත් කරන්න','err'); return; }

  const db = window.DB || {};
  if(!db.users) db.users = [];

  const existing = db.users.find(x => x.username === username && x.id !== id && x.authUid !== id);
  if(existing){ toast('මෙම username එක දැනටමත් භාවිතයේ පවතී','err'); return; }

  if(id){
    const u = db.users.find(x => x.id === id || x.authUid === id);
    if(u){
      let finalPass = u.password;
      if(password && password !== u.password){
        finalPass = window.Security ? await window.Security.hashPassword(password) : password;
      }
      Object.assign(u, {name, username, password: finalPass, role, active});
      const uid = u.authUid || u.id;
      if(window.FB && window.FB.fbSet) await window.FB.fbSet(window.FB.COL.users, uid, u);
    }
  } else {
    const newId = uid('U');
    const finalPass = window.Security ? await window.Security.hashPassword(password) : password;
    const newUser = { id: newId, name, username, password: finalPass, role, active };
    db.users.push(newUser);
    const targetId = newUser.authUid || newUser.id;
    if(window.FB && window.FB.fbSet) await window.FB.fbSet(window.FB.COL.users, targetId, newUser);
  }

  if(typeof saveDB === 'function') saveDB();
  closeModal();
  render();
  toast('පරිශීලක තොරතුරු සුරකින ලදී ✅');
}

async function delUser(id){
  if(!confirm('මෙම පරිශීලකයා මකා දැමීමට අවශ්‍යද?')) return;
  const db = window.DB || {};
  const target = (db.users || []).find(x => x.id === id || x.authUid === id);
  const targetId = target ? (target.authUid || target.id) : id;
  db.users = (db.users || []).filter(x => x.id !== id && x.authUid !== id);

  if(window.FB && window.FB.fbDelete){
    await window.FB.fbDelete(window.FB.COL.users, targetId);
  }
  if(typeof saveDB === 'function') saveDB();

  render();
  toast('පරිශීලකයා මකා දමන ලදී');
}

function downloadBackup(){
  const db = window.DB || {};
  const blob = new Blob([JSON.stringify(db, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `autoparts_pos_backup_${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup එක බාගත විය ✅');
}

function restoreBackup(){
  const file = $('#backupFile')?.files[0];
  if(!file){ toast('කරුණාකර JSON Backup ගොනුවක් තෝරන්න','err'); return; }
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if(!data.products || !data.users){ toast('වලංගු නොවන Backup ගොනුවකි','err'); return; }
      if(window.DB){
        Object.assign(window.DB, data);
        if(typeof saveDB === 'function') saveDB();
      }
      toast('දත්ත සාර්ථකව ප්‍රතිස්ථාපනය කළා ✅');
      render();
    } catch(err){
      toast('ගොනුව කියවීමේ දෝෂයක්','err');
    }
  };
  reader.readAsText(file);
}

function resetToDemo(){
  if(!confirm('ඔබට සියලු දත්ත ඉවත් කර ආරම්භක තත්ත්වයට පත් කිරීමට අවශ්‍ය බව සහතිකද?')) return;
  localStorage.removeItem('autoparts_pos_db');
  location.reload();
}

async function connectHardwarePrinter(){
  if(!window.Printer){
    toast('Printer module load වී නොමැත', 'err');
    return;
  }
  const ok = await window.Printer.connect();
  if(ok && typeof render === 'function') render();
}

async function disconnectHardwarePrinter(){
  if(!window.Printer) return;
  await window.Printer.disconnect();
  if(typeof render === 'function') render();
}

async function testPrintHardware(){
  if(!window.Printer || !window.Printer.isConnected){
    toast('කරුණාකර පළමුව Bluetooth Printer එක සම්බන්ධ කරන්න', 'warn');
    return;
  }
  await window.Printer.testPrint();
}

async function kickCashDrawer(){
  if(!window.Printer || !window.Printer.isConnected){
    toast('කරුණාකර පළමුව Bluetooth Printer එක සම්බන්ධ කරන්න', 'warn');
    return;
  }
  const ok = await window.Printer.openCashDrawer();
  if(ok) toast('💵 Cash Drawer විවෘත කරන ලදී!', 'ok');
}

function setHwPaperWidth(val){
  localStorage.setItem('pos.printerWidth', val);
  toast(`ප්‍රමාණය ${val}mm ලෙස සුරකින ලදී`, 'ok');
}

function setHwAutoPrint(val){
  localStorage.setItem('pos.printer.autoprint', val ? 'true' : 'false');
  toast(val ? 'ස්වයංක්‍රීය Print ක්‍රියාත්මකයි' : 'ස්වයංක්‍රීය Print අක්‍රියයි', 'ok');
}

function setHwAutoDrawer(val){
  localStorage.setItem('pos.printer.autodrawer', val ? 'true' : 'false');
  toast(val ? 'ස්වයංක්‍රීය Drawer kick ක්‍රියාත්මකයි' : 'ස්වයංක්‍රීය Drawer kick අක්‍රියයි', 'ok');
}

window.pgSettings = pgSettings;
window.saveShopSettings = saveShopSettings;
window.saveShop = saveShopSettings;
window.editUser = editUser;
window.saveUser = saveUser;
window.delUser = delUser;
window.downloadBackup = downloadBackup;
window.exportDatabaseBackup = downloadBackup;
window.restoreBackup = restoreBackup;
window.resetToDemo = resetToDemo;
window.connectHardwarePrinter = connectHardwarePrinter;
window.disconnectHardwarePrinter = disconnectHardwarePrinter;
window.testPrintHardware = testPrintHardware;
window.kickCashDrawer = kickCashDrawer;
window.setHwPaperWidth = setHwPaperWidth;
window.setHwAutoPrint = setHwAutoPrint;
window.setHwAutoDrawer = setHwAutoDrawer;
