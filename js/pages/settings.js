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
      <div class="settings-tabs" style="display:flex;gap:7px;flex-wrap:wrap">
        <button class="btn btn-sm ${tab==='shop'?'btn-primary':''}" onclick="state.settingsTab='shop';render()">🏪 සාප්පු තොරතුරු</button>
        ${state.user.role==='superadmin'?`<button class="btn btn-sm ${tab==='users'?'btn-primary':''}" onclick="state.settingsTab='users';render()">👤 පරිශීලකයන්</button>`:''}
        <button class="btn btn-sm ${tab==='hardware'?'btn-primary':''}" onclick="state.settingsTab='hardware';render()">🖨️ Hardware & Printer</button>
        <button class="btn btn-sm ${tab==='backup'?'btn-primary':''}" onclick="state.settingsTab='backup';render()">💾 දත්ත Backup</button>
        ${state.user?.role==='superadmin'?`<button class="btn btn-sm ${tab==='maintenance'?'btn-primary':''}" onclick="state.settingsTab='maintenance';render()">🛠️ Maintenance (නඩත්තුව)</button>`:''}
      </div>
    </div>

    <!-- 🚀 App Version & Cloudflare Live Update Card -->
    <div class="card" style="margin-top:14px;background:#111c30;border:1px solid var(--line);border-radius:12px;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:14.5px;font-weight:700;display:flex;align-items:center;gap:8px;margin-bottom:3px">
            🚀 පද්ධති සංස්කරණය: <code style="color:#38bdf8;font-size:13px">v2.6.7</code>
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

    ${tab==='backup' ? (() => {
      const lastBackupIso = localStorage.getItem('pos.lastBackup');
      let lastBackupText = 'තවමත් Backup ගෙන නොමැත (Never)';
      if(lastBackupIso){
        try {
          const d = new Date(lastBackupIso);
          lastBackupText = d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        } catch(_) { lastBackupText = lastBackupIso; }
      }
      const autoBackupEnabled = localStorage.getItem('pos.autoBackup') !== 'false';
      const autoBackupTime = localStorage.getItem('pos.autoBackupTime') || '16:00';
      const folderName = localStorage.getItem('pos.backupFolderName') || 'POS System';
      const folderGranted = localStorage.getItem('pos.backupFolderGranted') === 'true';
      const isDesktopFsSupported = typeof window.showDirectoryPicker === 'function';

      return `
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:14px">
        
        <!-- Status Card -->
        <div class="card" style="background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line)">
            <div>
              <h4 style="margin:0;font-size:16px;color:var(--txt)">💾 දත්ත සුරැකීම සහ ප්‍රතිස්ථාපනය</h4>
              <small style="color:var(--muted)">Data Backup & System Disaster Recovery (Phase 8)</small>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span class="pill ${autoBackupEnabled ? 'ok' : 'warn'}" style="font-size:11.5px;padding:4px 10px">
                Daily 4:00 PM: ${autoBackupEnabled ? '🟢 සක්‍රීයයි (16:00)' : '⚪ අක්‍රීයයි'}
              </span>
              <span class="pill" style="font-size:11.5px;padding:4px 10px;background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3)">
                🏬 ${esc(state.activeShop?.name || 'Shop')}
              </span>
            </div>
          </div>

          <div class="grid2" style="gap:12px;margin-bottom:6px">
            <div>
              <span style="font-size:12px;color:var(--muted);display:block">අවසන් වරට Backup ගත් දිනය:</span>
              <b style="font-size:14px;color:var(--primary)">${esc(lastBackupText)}</b>
            </div>
            <div>
              <span style="font-size:12px;color:var(--muted);display:block">සුරැකෙන ස්ථානය (Location):</span>
              <b style="font-size:14px;color:#34d399">${isDesktopFsSupported && folderGranted ? '📁 Documents / ' + esc(folderName) : '📁 Downloads / POS_System'}</b>
            </div>
          </div>
        </div>

        <!-- Auto-Backup 4:00 PM Scheduler & Folder Permission Card -->
        <div class="card" style="background:#111c30;border:1px solid rgba(59,130,246,0.35);border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08)">
            <div>
              <h4 style="margin:0 0 4px;font-size:15px;color:#93c5fd;display:flex;align-items:center;gap:8px">
                📅 දිනපතා සවස 4:00 ට ස්වයංක්‍රීය Backup (Daily 4:00 PM Auto-Backup)
                <span class="pill ${autoBackupEnabled ? 'ok' : 'muted'}" style="font-size:11px;padding:2px 8px">
                  ${autoBackupEnabled ? 'ක්‍රියාත්මකයි' : 'අක්‍රියයි'}
                </span>
              </h4>
              <p style="margin:0;font-size:12px;color:var(--muted)">
                සෑම දිනකම සවස 4:00 ට (${esc(autoBackupTime)}) වත්මන් සාප්පුවේ දත්ත ස්වයංක්‍රීයව ආරක්ෂිත ෆෝල්ඩරයට (Documents / POS System / ${esc(state.activeShop?.name || 'Shop')}) සුරකියි.
              </p>
            </div>
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.05);padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1)">
              <input type="checkbox" id="autoBackupCheckbox" ${autoBackupEnabled ? 'checked' : ''} onchange="toggleAutoBackup(this.checked)" style="width:18px;height:18px;accent-color:var(--primary)">
              <span>ස්වයංක්‍රීයයි</span>
            </label>
          </div>

          <!-- Target Folder / Permission Section -->
          <div style="background:rgba(15,23,42,0.7);padding:12px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
              <div>
                <b style="font-size:13px;color:var(--txt);display:flex;align-items:center;gap:6px">
                  📁 සුරැකෙන ෆෝල්ඩරය (Backup Storage Location):
                  ${isDesktopFsSupported && folderGranted ? '<span style="color:#34d399;font-size:12px">● සෘජු ලිවීම සක්‍රීයයි ✅</span>' : ''}
                </b>
                <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">
                  ${isDesktopFsSupported ? (
                    folderGranted 
                      ? `ස්ථානය: Documents / <b style="color:#60a5fa">${esc(folderName)}</b> / <b style="color:#34d399">${esc(state.activeShop?.name || 'Shop')}</b> (ෆෝල්ඩර අවසරය ලබා දී ඇත)`
                      : `ස්ථානය: <span style="color:#fbbf24">තවම ෆෝල්ඩරයක් තෝරා නැත</span> (Documents තුළ 'POS System' තෝරා අවසර ලබා දෙන්න)`
                  ) : `ස්ථානය: <b style="color:#60a5fa">Downloads / POS_System</b> (Mobile බ්‍රවුසරය සඳහා ස්වයංක්‍රීයව Downloads සහ In-App Vault හි සුරැකේ)`}
                </p>
              </div>

              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                ${isDesktopFsSupported ? `
                  <button class="btn btn-blue btn-sm" onclick="selectBackupFolder()" style="font-weight:600;padding:6px 14px;font-size:12px;display:flex;align-items:center;gap:6px">
                    📁 ${folderGranted ? 'ෆෝල්ඩරය වෙනස් කරන්න' : 'ෆෝල්ඩරය තෝරා අවසර දෙන්න'}
                  </button>
                ` : `
                  <span class="pill" style="font-size:11px;background:rgba(100,116,139,0.2);color:#94a3b8">📱 Mobile Auto-Save</span>
                `}
                <button class="btn btn-muted btn-sm" onclick="triggerTestAutoBackup()" style="font-weight:600;padding:6px 14px;font-size:12px;display:flex;align-items:center;gap:6px" title="4:00 PM වන තෙක් නොසිට දැන්ම Backup එක සුරැකෙන අයුරු පරීක්ෂා කරන්න">
                  ⚡ දැන්ම පරීක්ෂා කරන්න (Test Now)
                </button>
              </div>
            </div>
          </div>

          <!-- Schedule Time & Shop Isolation Notice -->
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--muted)">
            <div style="display:flex;align-items:center;gap:8px">
              <span>⏰ වේලාව:</span>
              <input type="time" value="${esc(autoBackupTime)}" onchange="updateAutoBackupTime(this.value)" style="background:var(--panel);border:1px solid var(--line);color:var(--txt);padding:3px 8px;border-radius:6px;font-size:12px">
              <span style="color:#6ee7b7">(පෙරනිමි: සවස 04:00 PM)</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;color:#93c5fd">
              🛡️ <b>Shop Isolation:</b> '${esc(state.activeShop?.name || 'Active Shop')}' සාප්පුවට පමණක් අදාළව ගොනු වෙන්ව සුරැකේ (අනෙක් සාප්පු මිශ්‍ර නොවේ).
            </div>
          </div>
        </div>

        <!-- 1-Click Export Card -->
        <div class="card" style="background:#111c30;border:1px solid var(--line);border-radius:12px;padding:16px">
          <h4 style="margin:0 0 6px;color:#93c5fd;font-size:15px">⬇️ 1-Click සම්පූර්ණ දත්ත Backup එකක් බාගත කරන්න (Manual Backup)</h4>
          <p style="color:var(--muted);font-size:12px;margin:0 0 14px">
            භාණ්ඩ, තොග, ගනුදෙනුකරුවන්, සැපයුම්කරුවන්, විකුණුම්, GRN, චෙක්පත්, Part Interchange හා Scrap තොග ඇතුළු සියලුම දත්ත එකවර ආරක්ෂිත JSON ගොනුවක් ලෙස බාගත කරගන්න.
          </p>
          <button class="btn btn-blue btn-sm" onclick="exportFullBackup()" style="font-weight:700;padding:8px 16px;font-size:13px;display:flex;align-items:center;gap:6px">
            💾 සම්පූර්ණ Backup බාගන්න (Download JSON)
          </button>
        </div>

        <!-- 1-Click Restore Card -->
        <div class="card" style="background:#111c30;border:1px solid var(--line);border-radius:12px;padding:16px">
          <h4 style="margin:0 0 6px;color:#6ee7b7;font-size:15px">⬆️ Backup ගොනුවකින් දත්ත ප්‍රතිස්ථාපනය කරන්න (Restore JSON)</h4>
          <p style="color:var(--muted);font-size:12px;margin:0 0 14px">
            මීට පෙර බාගත කරන ලද JSON Backup ගොනුවක් තෝරා පද්ධතියේ සියලුම දත්ත (භාණ්ඩ, විකුණුම්, GRN, සැපයුම්කරුවන් ආදී සියල්ල) නැවත පිහිටුවන්න.
          </p>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <input type="file" id="backupFileInput" accept=".json" style="padding:7px;background:var(--panel);border:1px solid var(--line);border-radius:8px;font-size:12px;color:var(--txt)">
            <button class="btn btn-green btn-sm" id="btnRestoreBackup" onclick="handleImportBackupClick()" style="font-weight:700;padding:8px 18px;font-size:13px;display:flex;align-items:center;gap:6px">
              📂 ප්‍රතිස්ථාපනය කරන්න (Restore)
            </button>
          </div>
        </div>

      </div>`;
    })() : ''}

    ${tab==='maintenance' ? (() => {
      if(state.user?.role !== 'superadmin'){
        return `
        <div class="card" style="margin-top:14px;padding:40px;text-align:center">
          <div style="font-size:36px;margin-bottom:10px">🔒</div>
          <b style="font-size:16px;color:#f87171">ප්‍රවේශය අවහිර කර ඇත (Access Denied)</b>
          <p style="color:var(--muted);font-size:12.5px;margin-top:6px">
            පද්ධති නඩත්තුව සහ දත්ත පිරිසිදු කිරීමේ මෙවලම් සුපිරි පරිපාලක (Super Admin) සඳහා පමණක් සීමා කර ඇත.
          </p>
        </div>`;
      }

      return `
      <div style="margin-top:14px;display:flex;flex-direction:column;gap:16px">
        <!-- Data Clearing & Maintenance Options (Strict Super Admin Only) -->
        <div class="card" style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(239,68,68,0.2)">
            <div>
              <h4 style="margin:0 0 4px;color:#fca5a5;font-size:15px">🛠️ පද්ධති නඩත්තුව සහ දත්ත පිරිසිදු කිරීම (Super Admin Only)</h4>
              <p style="color:var(--muted);font-size:12px;margin:0">
                පරීක්ෂණ ගනුදෙනු මකා දැමීම, සාප්පුව ආරම්භක තත්ත්වයට පත් කිරීම හෝ සේවාදායකයාට විකිණීමට සූදානම් කිරීම සඳහා පහත විකල්ප භාවිතා කරන්න.
              </p>
            </div>
            <span class="pill" style="background:rgba(59,130,246,0.15);color:#93c5fd;border:1px solid rgba(59,130,246,0.3);font-size:12px;padding:4px 10px;font-weight:600">
              🏬 වත්මන් සාප්පුව: ${esc(state.activeShop?.name || 'Default Shop')} (${esc(state.activeShopId || 'SHOP-001')})
            </span>
          </div>

          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:12px;color:#6ee7b7;display:flex;align-items:center;gap:6px">
            🛡️ <b>සාප්පු හුදකලා බව (Strict Shop Isolation):</b> මෙම සාප්පුවේ දත්ත Clear කළද අනෙකුත් සාප්පු වල දත්ත (Other Shops) කිසිවිටෙකත් මකා නොදැමේ.
          </div>

          <div style="display:flex;flex-direction:column;gap:12px">
            <!-- 1. Clear Transactions only -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;background:rgba(15,23,42,0.6);padding:12px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.06)">
              <div>
                <b style="font-size:13.5px;color:#f87171">1. ගනුදෙනු දත්ත පමණක් ඉවත් කරන්න (Clear Sales & Transactions)</b>
                <p style="margin:3px 0 0;font-size:11.5px;color:var(--muted)">
                  සියලු විකුණුම් (Sales), GRN, Return, Shifts, Petty Cash, චෙක්පත් හා ණය ශේෂයන් 0 බවට පත් කරයි. <span style="color:#6ee7b7;font-weight:600">භාණ්ඩ තොගය (Products) සුරැකේ.</span>
                </p>
              </div>
              <button class="btn btn-red btn-sm" onclick="clearTransactions()" style="font-weight:700;padding:7px 16px">
                🗑️ ගනුදෙනු Clear කරන්න
              </button>
            </div>

            <!-- 2. Reset to Default Demo -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;background:rgba(15,23,42,0.6);padding:12px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.06)">
              <div>
                <b style="font-size:13.5px;color:#fbbf24">2. ආරම්භක Demo තත්ත්වයට පත් කරන්න (Reset to Default Demo)</b>
                <p style="margin:3px 0 0;font-size:11.5px;color:var(--muted)">
                  භාණ්ඩ සහ සියලු දත්ත ආරම්භක Demo තත්ත්වයට සකසා local cache ඉවත් කරයි.
                </p>
              </div>
              <button class="btn btn-muted btn-sm" onclick="resetToDemo()" style="font-weight:600;padding:7px 16px">
                🔄 Demo Reset
              </button>
            </div>

            <!-- 3. Wipe Local Storage Cache -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;background:rgba(15,23,42,0.6);padding:12px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.06)">
              <div>
                <b style="font-size:13.5px;color:var(--txt)">3. මෙම සාප්පුවේ Local Cache ඉවත් කරන්න (Wipe This Shop Cache)</b>
                <p style="margin:3px 0 0;font-size:11.5px;color:var(--muted)">
                  වත්මන් සාප්පුවේ browser cache ඉවත් කර Cloud වෙතින් නැවුම් දත්ත ලබා ගනී. <span style="color:#6ee7b7;font-weight:600">අනෙකුත් සාප්පු වල cache සුරැකේ.</span>
                </p>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <button class="btn btn-muted btn-sm" onclick="wipeLocalCache()" style="font-weight:600;padding:7px 16px">
                  🧹 Wipe Shop Cache
                </button>
                <button class="btn btn-sm" onclick="wipeAllLocalCache()" style="background:transparent;border:1px solid rgba(255,255,255,0.15);color:var(--muted);font-size:11px;padding:6px 10px" title="සියලු සාප්පු වල cache එකවර මකා දමන්න">
                  🌐 All Shops
                </button>
              </div>
            </div>

            <!-- 4. Prepare for Selling / Production Clean Slate -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;background:rgba(16,185,129,0.08);padding:14px 16px;border-radius:8px;border:1px solid rgba(16,185,129,0.25)">
              <div>
                <b style="font-size:14px;color:#34d399">4. 🏭 සේවාදායකයාට විකිණීමට සූදානම් කිරීම (Prepare for Selling / Production Reset)</b>
                <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">
                  නව සේවාදායකයෙකුට පද්ධතිය භාරදීමට පෙර සියලු පරීක්ෂණ දත්ත (Test Data) ඉවත් කර සාප්පුව 100% පිරිසිදු තත්ත්වයට (Pristine 0 State) පත් කරයි.
                </p>
              </div>
              <button class="btn btn-primary btn-sm" onclick="openProductionResetModal()" style="font-weight:700;padding:8px 18px;background:#059669;border-color:#059669">
                🏭 විකිණීමට සූදානම් කරන්න
              </button>
            </div>
          </div>
        </div>

      </div>`;
    })() : ''}

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
         ${state.user?.role === 'superadmin' ? `
         <option value="admin" ${u.role==='admin'?'selected':''}>🛡️ පරිපාලක (Admin)</option>
         <option value="superadmin" ${u.role==='superadmin'?'selected':''}>👑 සුපිරි පරිපාලක (Super Admin)</option>` : ''}
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
  const username = $('#uUsername')?.value.trim().toLowerCase();
  const password = $('#uPass')?.value;
  const role = $('#uRoleSelect')?.value || 'cashier';
  const active = $('#uActive')?.checked;

  if(!name || !username || !password){ toast('සියලු තොරතුරු ඇතුලත් කරන්න','err'); return; }

  const btn = document.querySelector('button[onclick*="saveUser"]');
  if(btn){
    btn.disabled = true;
    btn.textContent = 'සුරකිමින් පවතී... ⏳';
  }

  if(state.user?.role !== 'superadmin' && (role === 'superadmin' || role === 'admin')){
    toast('ඔබට පරිපාලක (Admin) හෝ සුපිරි පරිපාලක ගිණුම් සෑදීමට අවසර නැත', 'err');
    if(btn){ btn.disabled = false; btn.textContent = '💾 සුරකින්න'; }
    return;
  }

  const db = window.DB || {};
  if(!db.users) db.users = [];

  const existing = db.users.find(x => x.username && x.username.toLowerCase() === username && x.id !== id && x.authUid !== id);
  if(existing){ 
    toast('මෙම username එක දැනටමත් භාවිතයේ පවතී','err'); 
    if(btn){ btn.disabled = false; btn.textContent = '💾 සුරකින්න'; }
    return; 
  }

  const targetShopId = (typeof currentShopId === 'function' && currentShopId()) 
    || state.user?.shopId 
    || state.activeShopId 
    || (state.activeShop && state.activeShop.id) 
    || 'SHOP-001';

  let perms = (typeof getDefaultPermissionsForRole === 'function')
    ? getDefaultPermissionsForRole(role)
    : ['billing', 'dashboard', 'pos', 'customers', 'lowstock', 'profile'];

  if(state.user?.role !== 'superadmin'){
    const myPerms = Array.isArray(state.user?.permissions) ? state.user.permissions : (typeof getDefaultPermissionsForRole === 'function' ? getDefaultPermissionsForRole(state.user?.role) : []);
    perms = perms.filter(p => myPerms.includes(p));
  }

  try {
    if(id){
      const u = db.users.find(x => x.id === id || x.authUid === id);
      if(u){
        let finalPass = u.password;
        if(password && password !== u.password){
          finalPass = window.Security ? await window.Security.hashPassword(password) : password;
        }
        Object.assign(u, { name, username, password: finalPass, role, active: Boolean(active) });
        if(!u.shopId && targetShopId) u.shopId = targetShopId;
        if(!u.permissions) u.permissions = perms;
        const uid = u.authUid || u.id;
        if(window.FB && window.FB.fbSet){
          window.FB.fbSet(window.FB.COL.users, uid, u).catch(e => console.warn(e));
        }
      }
    } else {
      const email = username.includes('@') ? username : `${username}@autoparts.local`;
      const finalPass = window.Security ? await window.Security.hashPassword(password) : password;

      const userData = {
        name,
        username,
        password: finalPass,
        role,
        shopId: targetShopId,
        active: Boolean(active),
        permissions: perms
      };

      if(window.FB && typeof window.FB.createUser === 'function'){
        const res = await window.FB.createUser(email, password, userData);
        if(!res.ok){
          toast('❌ පරිශීලකයා සෑදීම අසාර්ථක විය: ' + (res.error?.message || 'Error'), 'err');
          if(btn){ btn.disabled = false; btn.textContent = '💾 සුරකින්න'; }
          return;
        }
        const created = res.user || { id: res.uid, authUid: res.uid, ...userData };
        const exIdx = db.users.findIndex(x => x.id === res.uid || x.authUid === res.uid);
        if(exIdx >= 0) db.users[exIdx] = created;
        else db.users.push(created);
      } else {
        const newId = uid('U');
        const newUser = { id: newId, ...userData };
        db.users.push(newUser);
        const targetId = newUser.authUid || newUser.id;
        if(window.FB && window.FB.fbSet){
          window.FB.fbSet(window.FB.COL.users, targetId, newUser).catch(e => console.warn(e));
        }
      }
    }

    if(typeof saveDB === 'function') saveDB();
    toast('පරිශීලක තොරතුරු සුරකින ලදී ✅');
  } catch(err){
    console.error('Error saving user:', err);
    toast('දෝෂයක් සිදු විය: ' + (err.message || 'Error'), 'err');
  } finally {
    closeModal();
    render();
  }
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

async function exportFullBackup(){
  if(window.BackupService && typeof window.BackupService.performBackup === 'function'){
    await window.BackupService.performBackup({ isAuto: false, forceDownload: true });
    render();
    return;
  }

  const db = window.DB || {};
  const shopId = (typeof currentShopId === 'function' && currentShopId()) || state.user?.shopId || state.activeShopId || 'SHOP-001';
  const shopName = state.activeShop?.name || db.shop?.name || 'AutoParts Shop';
  
  const backupData = {
    version: '2.6.7',
    phase: 8,
    timestamp: new Date().toISOString(),
    shopId: shopId,
    shopName: shopName,
    collections: {
      shops: db.shops || [],
      users: db.users || [],
      products: db.products || [],
      customers: db.customers || [],
      suppliers: db.suppliers || [],
      sales: db.sales || [],
      grns: db.grns || [],
      returns: db.returns || [],
      shifts: db.shifts || [],
      cashMoves: db.cashMoves || [],
      payments: db.payments || [],
      dailySummary: db.dailySummary || [],
      supplierPayments: db.supplierPayments || [],
      interchanges: db.interchanges || [],
      scrapInventory: db.scrapInventory || [],
      counters: db.counters || []
    },
    // Top-level mirrors for backwards compatibility
    shops: db.shops || [],
    users: db.users || [],
    products: db.products || [],
    customers: db.customers || [],
    suppliers: db.suppliers || [],
    sales: db.sales || [],
    grns: db.grns || [],
    returns: db.returns || [],
    shifts: db.shifts || [],
    cashMoves: db.cashMoves || [],
    payments: db.payments || [],
    dailySummary: db.dailySummary || [],
    supplierPayments: db.supplierPayments || [],
    interchanges: db.interchanges || [],
    scrapInventory: db.scrapInventory || [],
    counters: db.counters || []
  };

  localStorage.setItem('pos.lastBackup', new Date().toISOString());

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const shopSlug = shopName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  a.href = url;
  a.download = `autoparts_pos_${shopSlug}_backup_${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('සම්පූර්ණ Backup ගොනුව සාර්ථකව බාගත විය (16 Collections) ✅', 'ok');
  render();
}

function handleImportBackupClick(){
  const fileInput = $('#backupFileInput');
  const file = fileInput?.files?.[0];
  if(!file){
    toast('කරුණාකර පළමුව වලංගු JSON Backup ගොනුවක් තෝරන්න', 'warn');
    return;
  }
  importBackup(file);
}

async function importBackup(file){
  if(!file){
    toast('කරුණාකර JSON Backup ගොනුවක් තෝරන්න', 'err');
    return;
  }

  if(!confirm('අවධානයයි: මෙම Backup ගොනුවෙන් දත්ත ප්‍රතිස්ථාපනය කිරීමෙන් පද්ධතියේ දැනට පවතින දත්ත යාවත්කාලීන වේ. ඔබට ඉදිරියට යාමට අවශ්‍ය බව තහවුරුද?')){
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if(!data || typeof data !== 'object'){
        throw new Error('වලංගු නොවන JSON දත්තයකි');
      }

      const source = data.collections || data;
      if(!source.products && !source.users && !source.sales && !source.customers){
        toast('වලංගු නොවන Backup ගොනුවකි (අවශ්‍ය දත්ත මොඩියුල නොමැත)', 'err');
        return;
      }

      // Legacy key compatibility
      if(!source.cashMoves && Array.isArray(source.cashMovements)) source.cashMoves = source.cashMovements;
      if(!source.payments && Array.isArray(source.creditPayments)) source.payments = source.creditPayments;

      const db = window.DB || {};
      const shopId = (typeof currentShopId === 'function' && currentShopId()) || state.user?.shopId || state.activeShopId || data.shopId || 'SHOP-001';

      const arrayKeys = [
        'shops', 'users', 'products', 'customers', 'suppliers',
        'sales', 'grns', 'returns', 'shifts', 'cashMoves',
        'payments', 'dailySummary', 'supplierPayments',
        'interchanges', 'scrapInventory'
      ];

      let restoredCount = 0;
      arrayKeys.forEach(k => {
        if(Array.isArray(source[k])){
          // Strictly stamp current shopId on every restored entity
          db[k] = source[k].map(item => ({
            ...item,
            shopId: item.shopId || shopId
          }));
          restoredCount += db[k].length;
        }
      });

      // Counters handling (object or array)
      if(source.counters && typeof source.counters === 'object'){
        db.counters = source.counters;
      }
      if(data.shop && typeof data.shop === 'object'){
        db.shop = data.shop;
      }

      // 1. Immediately persist to localStorage for current shopId and merge preserving other shops
      const dataToPersist = {
        products: db.products || [],
        customers: db.customers || [],
        suppliers: db.suppliers || [],
        sales: db.sales || [],
        grns: db.grns || [],
        returns: db.returns || [],
        shifts: db.shifts || [],
        cashMoves: db.cashMoves || [],
        payments: db.payments || [],
        supplierPayments: db.supplierPayments || [],
        interchanges: db.interchanges || [],
        scrapInventory: db.scrapInventory || [],
        users: db.users || [],
        shops: db.shops || [],
        counters: db.counters || { invoice: 1, grn: 1, ret: 1, shift: 1, payment: 1, shop: 1 },
        shop: db.shop || {},
        savedAt: Date.now(),
        shopId: shopId
      };

      try {
        // Dedicated shop cache
        localStorage.setItem('pos.localDB.' + shopId, JSON.stringify(dataToPersist));

        // Merge into global cache PRESERVING other shops
        let globalDb = {};
        try {
          const raw = localStorage.getItem('autoparts_pos_db');
          if(raw) globalDb = JSON.parse(raw);
        } catch(e){}
        const mergeCol = (key, currentList) => {
          const others = (globalDb[key] || []).filter(item => item && item.shopId && item.shopId !== shopId);
          return [...others, ...(currentList || [])];
        };
        globalDb.products = mergeCol('products', db.products);
        globalDb.customers = mergeCol('customers', db.customers);
        globalDb.suppliers = mergeCol('suppliers', db.suppliers);
        globalDb.sales = mergeCol('sales', db.sales);
        globalDb.grns = mergeCol('grns', db.grns);
        globalDb.returns = mergeCol('returns', db.returns);
        globalDb.shifts = mergeCol('shifts', db.shifts);
        globalDb.cashMoves = mergeCol('cashMoves', db.cashMoves);
        globalDb.payments = mergeCol('payments', db.payments);
        globalDb.supplierPayments = mergeCol('supplierPayments', db.supplierPayments);
        globalDb.interchanges = mergeCol('interchanges', db.interchanges);
        globalDb.scrapInventory = mergeCol('scrapInventory', db.scrapInventory);
        if(db.counters) globalDb.counters = { ...(globalDb.counters || {}), ...db.counters };
        globalDb.savedAt = Date.now();
        localStorage.setItem('autoparts_pos_db', JSON.stringify(globalDb));

        if(typeof db._persistLocalNow === 'function') db._persistLocalNow();
      } catch(saveErr){
        console.warn('Local persist error during restore:', saveErr);
      }

      // 2. If online and Firebase is connected, sync restored data to Firestore
      if(window.FB && window.FB.fbSet && navigator.onLine){
        toast('Firestore දත්ත ගබඩාවට යාවත්කාලීන කරමින් පවතී... ⏳');
        try {
          const syncMap = [
            { key: 'products', col: window.FB.COL.products },
            { key: 'customers', col: window.FB.COL.customers },
            { key: 'suppliers', col: window.FB.COL.suppliers },
            { key: 'sales', col: window.FB.COL.sales },
            { key: 'grns', col: window.FB.COL.grns },
            { key: 'returns', col: window.FB.COL.returns },
            { key: 'shifts', col: window.FB.COL.shifts },
            { key: 'cashMoves', col: window.FB.COL.cashMovements || 'cashMovements' },
            { key: 'payments', col: window.FB.COL.creditPayments || 'creditPayments' },
            { key: 'supplierPayments', col: window.FB.COL.supplierPayments || 'supplierPayments' },
            { key: 'interchanges', col: window.FB.COL.interchanges || 'interchanges' },
            { key: 'scrapInventory', col: window.FB.COL.scrapInventory || 'scrapInventory' }
          ];

          for(const sm of syncMap){
            if(Array.isArray(db[sm.key]) && sm.col){
              for(const item of db[sm.key]){
                if(item && item.id){
                  item.shopId = item.shopId || shopId;
                  try {
                    await window.FB.fbSet(sm.col, item.id, item);
                  } catch(e){}
                }
              }
            }
          }
        } catch(syncErr){
          console.warn('Firestore restore sync warning:', syncErr);
        }
      }

      toast(`'${shopId}' දත්ත සාර්ථකව ප්‍රතිස්ථාපනය කරන ලදී! (${restoredCount} items) ✅`, 'ok');
      setTimeout(() => {
        location.reload();
      }, 1500);

    } catch(err){
      console.error(err);
      toast('Backup ගොනුව කියවීමේ දෝෂයක්: ' + (err.message || 'JSON Invalid'), 'err');
    }
  };
  reader.readAsText(file);
}

async function clearTransactions(){
  if(window.state?.user?.role !== 'superadmin'){
    toast('මෙම ක්‍රියාව සඳහා සුපිරි පරිපාලක (Super Admin) අවසරය අවශ්‍ය වේ!', 'err');
    return;
  }
  const shopId = (typeof currentShopId === 'function' && currentShopId()) || state.user?.shopId || state.activeShopId || 'SHOP-001';
  const shopName = state.activeShop?.name || 'Default Shop';

  if(!confirm(`අවධානයයි: '${shopName}' (${shopId}) සාප්පුවේ විකුණුම් බිල්පත් (Sales), GRN, Return, Shifts, Petty Cash, චෙක්පත් සහ පාරිභෝගික ණය ශේෂයන් පමණක් 0 බවට පත්වේ.\n\n🛡️ අනෙකුත් සාප්පු වල දත්ත (Other Shops) කිසිවිටෙකත් මකා නොදැමේ.\n\n(භාණ්ඩ තොගය සහ සැපයුම්කරුවන් සුරැකේ)\n\nඔබට ඉදිරියට යාමට අවශ්‍ය බව තහවුරුද?`)){
    return;
  }

  await executeProductionReset(false);
}

function openProductionResetModal(){
  if(window.state?.user?.role !== 'superadmin'){
    toast('මෙම ක්‍රියාව සඳහා සුපිරි පරිපාලක (Super Admin) අවසරය අවශ්‍ය වේ!', 'err');
    return;
  }
  const shopId = (typeof currentShopId === 'function' && currentShopId()) || state.user?.shopId || state.activeShopId || 'SHOP-001';
  const shopName = state.activeShop?.name || shopId;

  openModal(
    '🏭 සේවාදායකයාට විකිණීමට සූදානම් කිරීම',
    'Prepare POS for Client Delivery / Clean Slate',
    `<div style="display:flex;flex-direction:column;gap:14px">
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);padding:12px 14px;border-radius:8px">
        <div style="font-size:13.5px;font-weight:700;color:#34d399;margin-bottom:4px">
          🏪 වත්මන් සාප්පුව: ${esc(shopName)} (<code>${esc(shopId)}</code>)
        </div>
        <div style="font-size:12px;color:var(--muted);line-height:1.5">
          නව සේවාදායකයෙකුට POS පද්ධතිය භාරදීමට පෙර සියලු පරීක්ෂණ දත්ත (Test Data) ඉවත් කර පිරිසිදු ආරම්භයක් ලබා දීමට මෙය භාවිතා කරන්න.
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px">
        <label style="border:1px solid var(--line);padding:12px;border-radius:8px;cursor:pointer;display:flex;gap:10px;align-items:flex-start;background:rgba(15,23,42,0.4)">
          <input type="radio" name="resetMode" value="full" checked style="margin-top:3px">
          <div>
            <b style="font-size:13.5px;color:#f87171">🧹 සම්පූර්ණ 0 Reset (100% Clean Slate — Recommended for Selling)</b>
            <div style="font-size:11.5px;color:var(--muted);margin-top:3px">
              සියලු පරීක්ෂණ භාණ්ඩ (Products = 0), පාරිභෝගිකයින් (Customers = 0), සැපයුම්කරුවන් (Suppliers = 0), විකුණුම් (Sales = 0), GRN (0), Shifts (0) ඉවත් කර සාප්පුව සම්පූර්ණයෙන්ම හිස් කරයි. කවුන්ටර 1 ට සකසයි (INV-0001).
            </div>
          </div>
        </label>

        <label style="border:1px solid var(--line);padding:12px;border-radius:8px;cursor:pointer;display:flex;gap:10px;align-items:flex-start;background:rgba(15,23,42,0.4)">
          <input type="radio" name="resetMode" value="transactions" style="margin-top:3px">
          <div>
            <b style="font-size:13.5px;color:#fbbf24">🧾 පරීක්ෂණ බිල්පත් සහ ගනුදෙනු පමණක් 0 කරන්න (Clear Test Invoices Only)</b>
            <div style="font-size:11.5px;color:var(--muted);margin-top:3px">
              දැනට ඇතුළත් කර ඇති භාණ්ඩ තොගය (Inventory) සහ සැපයුම්කරුවන් සුරැකේ. පරීක්ෂා කිරීමට දැමූ බිල්පත්, GRN, Shifts, Petty Cash සහ ණය ශේෂයන් පමණක් 0 බවට පත් කරයි.
            </div>
          </div>
        </label>
      </div>

      <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:10px 12px;border-radius:8px;font-size:11.5px;color:#fca5a5">
        ⚠️ <b>අවධානයයි:</b> මෙම ක්‍රියාවලිය ආපසු හැරවිය නොහැක. අනෙකුත් සාප්පු වල දත්ත (Other Shops) සුරැකේ.
      </div>
    </div>`,
    `<button class="btn" onclick="closeModal()">අවලංගු (Cancel)</button>
     <button class="btn btn-red" id="btnConfirmReset" onclick="submitProductionReset()">🚀 තහවුරු කර පිරිසිදු කරන්න (Execute Clean Slate)</button>`
  );
}

async function submitProductionReset(){
  if(window.state?.user?.role !== 'superadmin'){
    toast('මෙම ක්‍රියාව සඳහා සුපිරි පරිපාලක (Super Admin) අවසරය අවශ්‍ය වේ!', 'err');
    return;
  }
  const isFull = document.querySelector('input[name="resetMode"]:checked')?.value === 'full';
  const btn = $('#btnConfirmReset');
  if(btn){
    btn.disabled = true;
    btn.textContent = 'පිරිසිදු කරමින් පවතී... ⏳';
  }
  await executeProductionReset(isFull);
}

async function executeProductionReset(wipeInventory = true){
  if(window.state?.user?.role !== 'superadmin'){
    toast('මෙම ක්‍රියාව සඳහා සුපිරි පරිපාලක (Super Admin) අවසරය අවශ්‍ය වේ!', 'err');
    return;
  }
  const shopId = (typeof currentShopId === 'function' && currentShopId()) || state.user?.shopId || state.activeShopId || 'SHOP-001';
  const shopName = state.activeShop?.name || shopId;
  const db = window.DB || {};

  // 1. Stop all snapshot listeners immediately to avoid resurrection
  if(typeof window.stopAllListeners === 'function') window.stopAllListeners();

  // 2. Clear in-memory DB arrays for current shop
  db.sales = [];
  db.grns = [];
  db.returns = [];
  db.shifts = [];
  db.cashMoves = [];
  db.payments = [];
  db.supplierPayments = [];
  db.dailySummary = [];
  db.counters = { ...(db.counters || {}), invoice: 1, grn: 1, ret: 1, shift: 1, payment: 1 };

  if(wipeInventory){
    db.products = [];
    db.customers = [];
    db.suppliers = [];
    db.interchanges = [];
    db.scrapInventory = [];
  } else if(Array.isArray(db.customers)){
    db.customers.forEach(c => {
      if(!c.shopId || c.shopId === shopId){
        c.balance = 0;
        c.totalSpent = 0;
      }
    });
  }

  // 3. Clear local storage caches
  try {
    localStorage.removeItem('pos.activeShift');
    localStorage.removeItem('pos.grnDraft.' + shopId);
    localStorage.removeItem('pos.grnDraft');

    // Dedicated shop cache
    const cleanShopCache = {
      products: db.products || [],
      customers: db.customers || [],
      suppliers: db.suppliers || [],
      sales: [],
      grns: [],
      returns: [],
      shifts: [],
      cashMoves: [],
      payments: [],
      supplierPayments: [],
      interchanges: db.interchanges || [],
      scrapInventory: db.scrapInventory || [],
      users: db.users || [],
      shops: db.shops || [],
      counters: db.counters,
      shop: db.shop || {},
      savedAt: Date.now(),
      shopId: shopId
    };
    localStorage.setItem('pos.localDB.' + shopId, JSON.stringify(cleanShopCache));

    // Strip this shop's wiped records from autoparts_pos_db
    const raw = localStorage.getItem('autoparts_pos_db');
    if(raw){
      const globalDb = JSON.parse(raw);
      const keepOthers = key => (globalDb[key] || []).filter(item => item && item.shopId && item.shopId !== shopId);
      globalDb.sales = keepOthers('sales');
      globalDb.grns = keepOthers('grns');
      globalDb.returns = keepOthers('returns');
      globalDb.shifts = keepOthers('shifts');
      globalDb.cashMoves = keepOthers('cashMoves');
      globalDb.payments = keepOthers('payments');
      globalDb.supplierPayments = keepOthers('supplierPayments');
      globalDb.dailySummary = keepOthers('dailySummary');
      if(wipeInventory){
        globalDb.products = keepOthers('products');
        globalDb.customers = keepOthers('customers');
        globalDb.suppliers = keepOthers('suppliers');
        globalDb.interchanges = keepOthers('interchanges');
        globalDb.scrapInventory = keepOthers('scrapInventory');
      }
      globalDb.savedAt = Date.now();
      localStorage.setItem('autoparts_pos_db', JSON.stringify(globalDb));
    }
  } catch(e){
    console.warn('Local reset persist warning:', e);
  }

  // 4. Remote Firestore deletion
  if(window.FB && navigator.onLine){
    toast('Cloud දත්ත පිරිසිදු කරමින් පවතී... ⏳');
    try {
      const colsToWipe = [
        window.FB.COL.sales,
        window.FB.COL.grns,
        window.FB.COL.returns,
        window.FB.COL.shifts,
        window.FB.COL.cashMovements || 'cashMovements',
        window.FB.COL.creditPayments || 'creditPayments',
        window.FB.COL.supplierPayments || 'supplierPayments'
      ];

      if(wipeInventory){
        colsToWipe.push(
          window.FB.COL.products,
          window.FB.COL.customers,
          window.FB.COL.suppliers,
          window.FB.COL.interchanges || 'interchanges',
          window.FB.COL.scrapInventory || 'scrapInventory'
        );
      }

      const mods = window.FB._getModules ? window.FB._getModules() : null;
      const fsDb = window.FB._getDb ? window.FB._getDb() : null;
      let deleteTasks = [];

      if(mods?.fsMod && fsDb){
        const { collection, getDocs, query, where } = mods.fsMod;
        for(const colName of colsToWipe){
          try {
            const snap = await getDocs(query(collection(fsDb, colName), where('shopId', '==', shopId)));
            snap.docs.forEach(d => deleteTasks.push({ col: colName, id: d.id }));
          } catch(e){}
        }
      }

      // Execute in concurrent batches of 15
      for(let i = 0; i < deleteTasks.length; i += 15){
        const chunk = deleteTasks.slice(i, i + 15);
        await Promise.allSettled(chunk.map(t => window.FB.fbDelete(t.col, t.id)));
      }

      // If inventory kept, update customer balances in Firestore
      if(!wipeInventory && Array.isArray(db.customers) && window.FB.COL.customers){
        for(const c of db.customers){
          if(c && c.id && (!c.shopId || c.shopId === shopId)){
            try { await window.FB.fbSet(window.FB.COL.customers, c.id, c); } catch(_){}
          }
        }
      }
    } catch(syncErr){
      console.warn('Firestore reset error:', syncErr);
    }
  }

  closeModal();
  toast(`'${shopName}' සාර්ථකව පිරිසිදු කර සූදානම් කරන ලදී! ✅`, 'ok');
  setTimeout(() => {
    location.reload();
  }, 1000);
}

function resetToDemo(){
  if(window.state?.user?.role !== 'superadmin'){
    toast('මෙම ක්‍රියාව සඳහා සුපිරි පරිපාලක (Super Admin) අවසරය අවශ්‍ය වේ!', 'err');
    return;
  }
  const shopId = (typeof currentShopId === 'function' && currentShopId()) || state.user?.shopId || state.activeShopId || 'SHOP-001';
  const shopName = state.activeShop?.name || shopId;

  if(!confirm(`අවධානයයි: '${shopName}' (${shopId}) සාප්පුවේ දත්ත පමණක් ආරම්භක Demo තත්ත්වයට පත් කිරීමට අවශ්‍ය බව සහතිකද?\n\n🛡️ අනෙකුත් සාප්පු වල දත්ත (Other Shops) කිසිවිටෙකත් මකා නොදැමේ.`)) return;

  // 1. Remove only this shop's dedicated cache and drafts
  localStorage.removeItem('pos.localDB.' + shopId);
  localStorage.removeItem('pos.grnDraft.' + shopId);
  localStorage.removeItem('pos.grnDraft');
  localStorage.removeItem('pos.activeShift');

  // 2. Prepare fresh demo items stamped with current shopId
  const stampShop = (list) => (list ? JSON.parse(JSON.stringify(list)) : []).map(x => ({ ...x, shopId: shopId }));

  if(window.DB){
    DB.sales = [];
    DB.grns = [];
    DB.returns = [];
    DB.shifts = [];
    DB.cashMoves = [];
    DB.payments = [];
    DB.supplierPayments = [];
    DB.dailySummary = [];
    DB.products = stampShop(window.INITIAL_PRODUCTS);
    DB.customers = stampShop(window.INITIAL_CUSTOMERS);
    DB.suppliers = stampShop(window.INITIAL_SUPPLIERS);
    DB.interchanges = stampShop(window.INITIAL_INTERCHANGES);
    DB.scrapInventory = stampShop(window.INITIAL_SCRAP);
    DB.counters = { invoice: 1, grn: 1, ret: 1, shift: 1, payment: 1, shop: 1 };
  }

  // 3. Update autoparts_pos_db while preserving all other shops
  try {
    let globalDb = {};
    const raw = localStorage.getItem('autoparts_pos_db');
    if(raw) globalDb = JSON.parse(raw);

    const mergeCol = (key, currentList) => {
      const others = (globalDb[key] || []).filter(item => item && item.shopId && item.shopId !== shopId);
      return [...others, ...(currentList || [])];
    };

    globalDb.products = mergeCol('products', DB.products);
    globalDb.customers = mergeCol('customers', DB.customers);
    globalDb.suppliers = mergeCol('suppliers', DB.suppliers);
    globalDb.sales = mergeCol('sales', DB.sales);
    globalDb.grns = mergeCol('grns', DB.grns);
    globalDb.returns = mergeCol('returns', DB.returns);
    globalDb.shifts = mergeCol('shifts', DB.shifts);
    globalDb.cashMoves = mergeCol('cashMoves', DB.cashMoves);
    globalDb.payments = mergeCol('payments', DB.payments);
    globalDb.supplierPayments = mergeCol('supplierPayments', DB.supplierPayments);
    globalDb.interchanges = mergeCol('interchanges', DB.interchanges);
    globalDb.scrapInventory = mergeCol('scrapInventory', DB.scrapInventory);
    globalDb.savedAt = Date.now();
    localStorage.setItem('autoparts_pos_db', JSON.stringify(globalDb));

    // Save current shop's dedicated cache
    localStorage.setItem('pos.localDB.' + shopId, JSON.stringify({
      products: DB.products,
      customers: DB.customers,
      suppliers: DB.suppliers,
      sales: DB.sales,
      grns: DB.grns,
      returns: DB.returns,
      shifts: DB.shifts,
      cashMoves: DB.cashMoves,
      payments: DB.payments,
      supplierPayments: DB.supplierPayments,
      interchanges: DB.interchanges,
      scrapInventory: DB.scrapInventory,
      users: DB.users || [],
      shops: DB.shops || [],
      counters: DB.counters,
      shop: DB.shop || {},
      savedAt: Date.now(),
      shopId: shopId
    }));
  } catch(e){
    console.warn('Demo reset persist error:', e);
  }

  toast(`'${shopName}' Demo තත්ත්වයට සකසන ලදී (අනෙකුත් සාප්පු සුරැකිව ඇත) ✅`, 'ok');
  setTimeout(() => {
    location.reload();
  }, 1000);
}

function wipeLocalCache(){
  if(window.state?.user?.role !== 'superadmin'){
    toast('මෙම ක්‍රියාව සඳහා සුපිරි පරිපාලක (Super Admin) අවසරය අවශ්‍ය වේ!', 'err');
    return;
  }
  const shopId = (typeof currentShopId === 'function' && currentShopId()) || state.user?.shopId || state.activeShopId || 'SHOP-001';
  const shopName = state.activeShop?.name || shopId;

  if(!confirm(`අවධානයයි: '${shopName}' (${shopId}) සාප්පුවේ බ්‍රවුසර් Local Cache පමණක් ඉවත් කිරීමට අවශ්‍ය බව සහතිකද?\n\n🛡️ අනෙකුත් සාප්පු වල Cache (Other Shops) සුරැකේ.\n\n(Cloud දත්ත වලට හානියක් නොවේ, Page Reload කළ පසු නැවත Cloud වෙතින් මෙම සාප්පුවේ දත්ත පැමිණේ)`)) return;

  // Remove dedicated cache for current shop only
  localStorage.removeItem('pos.localDB.' + shopId);
  localStorage.removeItem('pos.grnDraft.' + shopId);
  localStorage.removeItem('pos.grnDraft');
  localStorage.removeItem('pos.activeShift');

  // Strip this shop's data from autoparts_pos_db while preserving other shops
  try {
    const raw = localStorage.getItem('autoparts_pos_db');
    if(raw){
      const globalDb = JSON.parse(raw);
      const keepOtherShops = (key) => (globalDb[key] || []).filter(item => item && item.shopId && item.shopId !== shopId);
      globalDb.products = keepOtherShops('products');
      globalDb.customers = keepOtherShops('customers');
      globalDb.suppliers = keepOtherShops('suppliers');
      globalDb.sales = keepOtherShops('sales');
      globalDb.grns = keepOtherShops('grns');
      globalDb.returns = keepOtherShops('returns');
      globalDb.shifts = keepOtherShops('shifts');
      globalDb.cashMoves = keepOtherShops('cashMoves');
      globalDb.payments = keepOtherShops('payments');
      globalDb.supplierPayments = keepOtherShops('supplierPayments');
      globalDb.interchanges = keepOtherShops('interchanges');
      globalDb.scrapInventory = keepOtherShops('scrapInventory');
      localStorage.setItem('autoparts_pos_db', JSON.stringify(globalDb));
    }
  } catch(e){}

  toast(`'${shopName}' Local Cache සාර්ථකව මකා දමන ලදී (අනෙකුත් සාප්පු සුරැකිව ඇත) ✅`, 'ok');
  setTimeout(() => {
    location.reload();
  }, 1000);
}

function wipeAllLocalCache(){
  if(window.state?.user?.role !== 'superadmin'){
    toast('මෙම ක්‍රියාව සඳහා සුපිරි පරිපාලක (Super Admin) අවසරය අවශ්‍ය වේ!', 'err');
    return;
  }
  if(!confirm('අවධානයයි: මෙම බ්‍රවුසරයේ ඇති සියලුම සාප්පු වල (All Shops) Local Storage දත්ත හා Cache සම්පූර්ණයෙන්ම මකා දැමීමට අවශ්‍ය බව සහතිකද?')) return;

  const keysToRemove = [];
  for(let i = 0; i < localStorage.length; i++){
    const k = localStorage.key(i);
    if(k && (k.startsWith('pos.') || k.startsWith('autoparts_'))){
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));

  toast('සියලුම Local Cache සාර්ථකව මකා දමන ලදී ✅', 'ok');
  setTimeout(() => {
    location.reload();
  }, 1000);
}

function toggleAutoBackup(enabled){
  localStorage.setItem('pos.autoBackup', enabled ? 'true' : 'false');
  toast(enabled ? 'දිනපතා සවස 4:00 Auto-backup සක්‍රීය කරන ලදී ✅' : 'Auto-backup අක්‍රිය කරන ලදී', 'ok');
  render();
}

async function selectBackupFolder(){
  if(window.BackupService && typeof window.BackupService.selectBackupFolder === 'function'){
    await window.BackupService.selectBackupFolder();
    render();
  } else {
    toast('BackupService module load වී නොමැත', 'err');
  }
}

async function triggerTestAutoBackup(){
  if(window.BackupService && typeof window.BackupService.performBackup === 'function'){
    toast('ස්වයංක්‍රීය Backup ක්‍රියාවලිය පරීක්ෂා කරමින් පවතී... ⏳');
    await window.BackupService.performBackup({ isAuto: true });
    render();
  } else {
    toast('BackupService module load වී නොමැත', 'err');
  }
}

function updateAutoBackupTime(val){
  if(val){
    localStorage.setItem('pos.autoBackupTime', val);
    toast(`ස්වයංක්‍රීය Backup වේලාව ${val} ලෙස යාවත්කාලීන විය ✅`, 'ok');
  }
}

function downloadBackup(){
  exportFullBackup();
}

function restoreBackup(){
  handleImportBackupClick();
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
window.exportFullBackup = exportFullBackup;
window.importBackup = importBackup;
window.handleImportBackupClick = handleImportBackupClick;
window.toggleAutoBackup = toggleAutoBackup;
window.resetToDemo = resetToDemo;
window.clearTransactions = clearTransactions;
window.clearData = clearTransactions;
window.wipeLocalCache = wipeLocalCache;
window.connectHardwarePrinter = connectHardwarePrinter;
window.disconnectHardwarePrinter = disconnectHardwarePrinter;
window.testPrintHardware = testPrintHardware;
window.kickCashDrawer = kickCashDrawer;
window.setHwPaperWidth = setHwPaperWidth;
window.setHwAutoPrint = setHwAutoPrint;
window.selectBackupFolder = selectBackupFolder;
window.triggerTestAutoBackup = triggerTestAutoBackup;
window.updateAutoBackupTime = updateAutoBackupTime;
window.setHwAutoDrawer = setHwAutoDrawer;
window.openProductionResetModal = openProductionResetModal;
window.submitProductionReset = submitProductionReset;
window.executeProductionReset = executeProductionReset;
window.cleanProductionReset = openProductionResetModal;
