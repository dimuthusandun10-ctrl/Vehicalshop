/* =========================================================
   js/pages/shops.js - Super Admin Multi-Shop Management
   ========================================================= */

/* Compute metrics for a specific shop */
function getShopMetrics(shopId){
  const db = window.DB || {};
  const allUsers = db.users || [];
  const allSales = db.sales || [];

  const shopUsers = allUsers.filter(u => u.shopId === shopId && !u.deleted);
  const admin = shopUsers.find(u => u.role === 'admin');
  const cashiers = shopUsers.filter(u => u.role === 'cashier');
  const activeCashiers = cashiers.filter(u => u.active && !u.locked);
  const lockedCashiers = cashiers.filter(u => u.locked || !u.active);

  const shopUserNames = new Set(shopUsers.map(u => u.name));
  const shopUserIds = new Set(shopUsers.map(u => u.id));

  const todayStr = (typeof today === 'function') ? today() : new Date().toISOString().slice(0, 10);

  const shopSales = allSales.filter(s => {
    if(s.shopId && s.shopId === shopId) return true;
    if(shopUserNames.has(s.cashier) || (s.cashierId && shopUserIds.has(s.cashierId))) return true;
    return false;
  });

  const totalSalesAmount = shopSales.reduce((a, s) => a + Number(s.total || 0), 0);
  const todaySalesAmount = shopSales
    .filter(s => (s.date || '').slice(0, 10) === todayStr)
    .reduce((a, s) => a + Number(s.total || 0), 0);

  return {
    admin,
    totalCashiers: cashiers.length,
    activeCashiers: activeCashiers.length,
    lockedCashiers: lockedCashiers.length,
    totalSales: totalSalesAmount,
    todaySales: todaySalesAmount,
    salesCount: shopSales.length
  };
}

/* =========================================================
   MAIN VIEW: pgShops
   ========================================================= */
function pgShops(){
  if(!state.user || state.user.role !== 'superadmin'){
    return `
      <div class="card">
        <div class="empty">
          ⚠️ මෙම අංශයට පිවිසීමට Super Admin අවසර අවශ්‍යයි (Super Admin Only)
        </div>
      </div>`;
  }

  const db = window.DB || {};
  const shops = db.shops || [];

  return `
  <div class="shops-wrap">

    <!-- Top Action Banner -->
    <div class="card" style="margin-bottom:0">
      <div class="card-h" style="align-items:center">
        <div>
          <h3 style="font-size:18px">🏪 සාප්පු කළමනාකරණය · Shop Management</h3>
          <small style="color:var(--muted)">සියලු ශාඛා සහ සාප්පු ජාලය මෙතැනින් කළමනාකරණය කරන්න (${shops.length} සාප්පු)</small>
        </div>
        <div>
          <button class="btn btn-primary" onclick="openCreateShopModal()">
            ➕ නව සාප්පුවක් එකතු කරන්න (Add Shop)
          </button>
        </div>
      </div>
    </div>

    <!-- Shops Cards Grid -->
    <div class="shops-grid">
      ${shops.length ? shops.map(shop => {
        const m = getShopMetrics(shop.id);
        const hasAdmin = Boolean(m.admin);

        return `
        <div class="shop-card" id="card-${esc(shop.id)}">
          <div>
            <div class="shop-card-head">
              <div class="shop-title-area">
                <div class="shop-icon-box">🏪</div>
                <div>
                  <div class="shop-name">${esc(shop.name)}</div>
                  <span class="shop-id-pill">${esc(shop.id)}</span>
                </div>
              </div>
              <span class="pill ${shop.active !== false ? 'ok' : 'bad'}">
                ${shop.active !== false ? '🟢 සක්‍රීය (Active)' : '🔴 අක්‍රීය (Inactive)'}
              </span>
            </div>

            <!-- Shop Info Details -->
            <div class="shop-details" style="margin-top:12px">
              <div class="shop-detail-row">
                <span>📍</span>
                <span>${esc(shop.address || shop.addr || 'ලිපිනයක් නැත (No address)')}</span>
              </div>
              <div class="shop-detail-row">
                <span>☎️</span>
                <span>${esc(shop.phone || 'දුරකථනයක් නැත')}</span>
              </div>
              ${shop.email ? `
              <div class="shop-detail-row">
                <span>📧</span>
                <span>${esc(shop.email)}</span>
              </div>` : ''}
            </div>

            <!-- Admin Assignment Box -->
            <div style="margin-top:10px">
              ${hasAdmin ? `
                <div class="shop-admin-box assigned">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span>👤</span>
                    <span>Admin: <b>${esc(m.admin.name)}</b> <small style="color:var(--muted)">(@${esc(m.admin.username)})</small></span>
                  </div>
                  <button class="btn btn-sm" onclick="openAssignAdminModal('${shop.id}')" title="Admin මාරු කරන්න">🔄 මාරු</button>
                </div>
              ` : `
                <div class="shop-admin-box unassigned">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span>⚠️</span>
                    <span>Admin පත් කර නැත (No admin assigned)</span>
                  </div>
                  <button class="btn btn-sm btn-primary" onclick="openAssignAdminModal('${shop.id}')">➕ පත් කරන්න</button>
                </div>
              `}
            </div>

            <!-- Shop Metrics -->
            <div class="shop-metrics" style="margin-top:12px">
              <div class="shop-metric-pill">
                <small>👥 කැෂියර්වරු (Staff)</small>
                <b>${m.totalCashiers}</b>
                <div style="font-size:10px;color:var(--muted);margin-top:2px">
                  🟢 ${m.activeCashiers} · 🔴 ${m.lockedCashiers}
                </div>
              </div>
              <div class="shop-metric-pill">
                <small>📊 අද විකුණුම් (Today)</small>
                <b style="color:var(--primary)">${money(m.todaySales)}</b>
                <div style="font-size:10px;color:var(--muted);margin-top:2px">
                  මුළු: ${money(m.totalSales)}
                </div>
              </div>
            </div>
          </div>

          <!-- Actions Footer -->
          <div class="shop-actions-bar" style="margin-top:14px;border-top:1px solid var(--line);padding-top:12px">
            <button class="btn btn-sm" onclick="openEditShopModal('${shop.id}')" title="විස්තර සංස්කරණය">
              ✏️ Edit
            </button>
            <button class="btn btn-sm btn-primary" onclick="openManageShopStaffModal('${shop.id}')" title="කාර්ය මණ්ඩලය">
              👥 Manage Staff
            </button>
            <button class="btn btn-sm btn-red" onclick="deleteShop('${shop.id}')" title="සාප්පුව මකන්න" style="margin-left:auto">
              🗑️
            </button>
          </div>

        </div>`;
      }).join('') : `
        <div class="card" style="grid-column: 1 / -1">
          <div class="empty">
            කිසිදු සාප්පුවක් ලියාපදිංචි කර නැත.<br>
            <button class="btn btn-primary" style="margin-top:10px" onclick="openCreateShopModal()">
              ➕ ප්‍රථම සාප්පුව සාදන්න
            </button>
          </div>
        </div>
      `}
    </div>

  </div>`;
}

/* =========================================================
   CREATE SHOP MODAL
   ========================================================= */
function openCreateShopModal(){
  openModal(
    '➕ නව සාප්පුවක් සාදන්න',
    'Create New Shop (Tenant)',
    `<div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">සාප්පුවේ නම / Shop Name *</label>
        <input id="nsName" placeholder="Auto Parts Lanka - Kandy" style="margin-top:4px">
      </div>
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">ලිපිනය / Address *</label>
        <input id="nsAddress" placeholder="No. 45, Temple Street, Kandy" style="margin-top:4px">
      </div>
      <div class="grid2">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">දුරකථන අංකය / Phone</label>
          <input id="nsPhone" placeholder="081-223 4567" style="margin-top:4px">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">ඊමේල් / Email</label>
          <input id="nsEmail" placeholder="kandy@autoparts.lk" style="margin-top:4px">
        </div>
      </div>
      <div class="grid2">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">බදු ප්‍රතිශතය / Tax %</label>
          <input id="nsTax" type="number" value="0" min="0" max="100" style="margin-top:4px">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">බිල්පතේ පණිවිඩය / Receipt Footer</label>
          <input id="nsFooter" value="Thank you! Come again." style="margin-top:4px">
        </div>
      </div>
    </div>`,
    `<button class="btn" onclick="closeModal()">අවලංගු</button>
     <button class="btn btn-primary" onclick="submitCreateShop()">✅ සාප්පුව සාදන්න (Create)</button>`
  );
}

async function submitCreateShop(){
  const name = $('#nsName')?.value.trim();
  const address = $('#nsAddress')?.value.trim();
  const phone = $('#nsPhone')?.value.trim();
  const email = $('#nsEmail')?.value.trim();
  const tax = Number($('#nsTax')?.value || 0);
  const footerEn = $('#nsFooter')?.value.trim() || 'Thank you! Come again.';

  if(!name){
    toast('කරුණාකර සාප්පුවේ නම ඇතුළත් කරන්න', 'err');
    return;
  }

  const db = window.DB || {};
  if(!db.shops) db.shops = [];

  const nextNum = (db.counters.shop = (db.counters.shop || db.shops.length || 0) + 1);
  const shopId = 'SHOP-' + String(nextNum).padStart(3, '0');

  const newShop = {
    id: shopId,
    name,
    address,
    addr: address,
    phone,
    email,
    ownerId: state.user ? state.user.id : 'U1',
    createdAt: new Date().toISOString(),
    active: true,
    tax,
    footerEn
  };

  db.shops.push(newShop);

  if(window.FB && window.FB.fbSet){
    await window.FB.fbSet(window.FB.COL.shops, newShop.id, newShop);
  }
  if(typeof saveDB === 'function') saveDB();

  closeModal();
  toast(`නව සාප්පුව (${name}) සාර්ථකව නිර්මාණය විය! ✅`);

  /* Prompt to assign an Admin immediately */
  setTimeout(() => {
    openModal(
      '👤 Admin පත් කරන්නද?',
      'Assign Admin Now?',
      `<div style="text-align:center;padding:12px 0">
         <div style="font-size:44px;margin-bottom:10px">🏪</div>
         <div style="font-size:15px;font-weight:700;margin-bottom:6px">${esc(name)}</div>
         <p style="color:var(--muted);font-size:12.5px;line-height:1.6">
           මෙම නව සාප්පුව සඳහා කළමනාකාර පරිපාලකයෙකු (Admin) දැන්ම පත් කිරීමට කැමතිද?
         </p>
       </div>`,
      `<button class="btn" onclick="closeModal();render()">පසුව (Later)</button>
       <button class="btn btn-primary" onclick="closeModal();openAssignAdminModal('${shopId}')">👤 ඔව්, Admin පත් කරන්න</button>`
    );
  }, 250);

  render();
}

/* =========================================================
   ASSIGN ADMIN MODAL (SUPER ADMIN ONLY)
   ========================================================= */
function openAssignAdminModal(shopId){
  const db = window.DB || {};
  const shop = (db.shops || []).find(s => s.id === shopId);
  if(!shop) return;

  const currentAdmin = (db.users || []).find(u => u.shopId === shopId && u.role === 'admin' && !u.deleted);
  const unassignedAdmins = (db.users || []).filter(u => u.role === 'admin' && !u.deleted && u.shopId !== shopId);

  openModal(
    `👤 Admin පත් කරන්න`,
    `Assign Admin to ${shop.name}`,
    `<div style="display:flex;flex-direction:column;gap:14px">
      ${currentAdmin ? `
        <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);padding:10px 12px;border-radius:8px;font-size:12.5px;color:#93c5fd">
          වත්මන් Admin: <b>${esc(currentAdmin.name)}</b> (@${esc(currentAdmin.username)})
        </div>
      ` : ''}

      <!-- Selection Mode Tabs -->
      <div style="display:flex;gap:10px;margin-bottom:4px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600">
          <input type="radio" name="adminOpt" value="new" checked onchange="toggleAdminOpt('new')">
          ➕ නව Admin කෙනෙකු සාදන්න (Option A: Create New)
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px;font-weight:600">
          <input type="radio" name="adminOpt" value="existing" onchange="toggleAdminOpt('existing')">
          👥 පවතින පරිශීලකයෙක් (Option B: Existing)
        </label>
      </div>

      <!-- Option A: Form for New Admin -->
      <div id="boxNewAdmin" style="display:flex;flex-direction:column;gap:10px;background:#0f172a;padding:14px;border-radius:8px;border:1px solid var(--line)">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">නම / Full Name *</label>
          <input id="naName" placeholder="පරිපාලක නම" style="margin-top:4px">
        </div>
        <div class="grid2">
          <div>
            <label style="font-size:12px;color:var(--muted);font-weight:600">පරිශීලක නාමය / Username *</label>
            <input id="naUser" placeholder="admin_kandy" style="margin-top:4px">
          </div>
          <div>
            <label style="font-size:12px;color:var(--muted);font-weight:600">මුරපදය / Password *</label>
            <input id="naPass" value="1234" style="margin-top:4px">
          </div>
        </div>
        <div class="grid2">
          <div>
            <label style="font-size:12px;color:var(--muted);font-weight:600">දුරකථන / Phone</label>
            <input id="naPhone" placeholder="077-xxxxxxx" style="margin-top:4px">
          </div>
          <div>
            <label style="font-size:12px;color:var(--muted);font-weight:600">ඊමේල් / Email</label>
            <input id="naEmail" placeholder="admin@shop.lk" style="margin-top:4px">
          </div>
        </div>
      </div>

      <!-- Option B: Select Existing Admin -->
      <div id="boxExistingAdmin" style="display:none;flex-direction:column;gap:10px;background:#0f172a;padding:14px;border-radius:8px;border:1px solid var(--line)">
        <label style="font-size:12px;color:var(--muted);font-weight:600">පරිපාලකයෙකු තෝරන්න / Select Admin</label>
        <select id="selExistingAdmin" style="margin-top:4px">
          <option value="">-- Admin තෝරන්න --</option>
          ${unassignedAdmins.map(u => `
            <option value="${u.id}">${esc(u.name)} (@${esc(u.username)}) — ${u.shopId ? 'Shop: '+esc(u.shopId) : 'Unassigned'}</option>
          `).join('')}
        </select>
        ${!unassignedAdmins.length ? `
          <small style="color:var(--muted)">වෙනත් පරිපාලක ගිණුම් නොමැත. කරුණාකර Option A මඟින් නව Admin කෙනෙකු සාදන්න.</small>
        ` : ''}
      </div>

    </div>`,
    `<button class="btn" onclick="closeModal()">අවලංගු</button>
     <button class="btn btn-primary" onclick="submitAssignAdmin('${shopId}')">✅ පත් කරන්න (Assign Admin)</button>`
  );
}

function toggleAdminOpt(opt){
  const boxNew = $('#boxNewAdmin');
  const boxExist = $('#boxExistingAdmin');
  if(!boxNew || !boxExist) return;
  if(opt === 'new'){
    boxNew.style.display = 'flex';
    boxExist.style.display = 'none';
  } else {
    boxNew.style.display = 'none';
    boxExist.style.display = 'flex';
  }
}

async function submitAssignAdmin(shopId){
  const db = window.DB || {};
  const isNew = document.querySelector('input[name="adminOpt"]:checked')?.value === 'new';

  if(isNew){
    const name = $('#naName')?.value.trim();
    const username = $('#naUser')?.value.trim().toLowerCase();
    const password = $('#naPass')?.value.trim();
    const phone = $('#naPhone')?.value.trim();
    const email = $('#naEmail')?.value.trim();

    if(!name || !username || !password){
      toast('කරුණාකර නම, username සහ මුරපදය පුරවන්න (*)', 'err');
      return;
    }

    if((db.users || []).some(u => !u.deleted && u.username.toLowerCase() === username)){
      toast('මෙම username දැනටමත් භාවිතා කර ඇත', 'warn');
      return;
    }

    const newAdmin = {
      id: uid('U'),
      name,
      username,
      password,
      role: 'admin',
      shopId: shopId,
      active: true,
      locked: false,
      lockMessage: '',
      lockedBy: null,
      lockedAt: null,
      phone,
      email: email || `${username}@autoparts.lk`,
      createdAt: new Date().toISOString(),
      createdBy: state.user ? state.user.id : 'U1'
    };

    if(!db.users) db.users = [];
    db.users.push(newAdmin);

    if(window.FB && window.FB.fbSet){
      await window.FB.fbSet(window.FB.COL.users, newAdmin.id, newAdmin);
    }
  } else {
    const adminId = $('#selExistingAdmin')?.value;
    if(!adminId){
      toast('කරුණාකර Admin කෙනෙකු තෝරන්න', 'err');
      return;
    }

    const u = (db.users || []).find(x => x.id === adminId);
    if(u){
      u.shopId = shopId;
      if(window.FB && window.FB.fbUpdate){
        await window.FB.fbUpdate(window.FB.COL.users, u.id, { shopId: shopId });
      }
    }
  }

  if(typeof saveDB === 'function') saveDB();

  closeModal();
  toast('Admin සාර්ථකව පත් කරන ලදී! ✅');
  render();
}

/* =========================================================
   EDIT SHOP MODAL
   ========================================================= */
function openEditShopModal(shopId){
  const db = window.DB || {};
  const s = (db.shops || []).find(x => x.id === shopId);
  if(!s) return;

  openModal(
    `✏️ සාප්පු සංස්කරණය — ${esc(s.name)}`,
    'Edit Shop Details',
    `<div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">සාප්පුවේ නම / Name *</label>
        <input id="esName" value="${esc(s.name)}" style="margin-top:4px">
      </div>
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">ලිපිනය / Address</label>
        <input id="esAddress" value="${esc(s.address || s.addr || '')}" style="margin-top:4px">
      </div>
      <div class="grid2">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">දුරකථන / Phone</label>
          <input id="esPhone" value="${esc(s.phone || '')}" style="margin-top:4px">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">ඊමේල් / Email</label>
          <input id="esEmail" value="${esc(s.email || '')}" style="margin-top:4px">
        </div>
      </div>
      <div class="grid2">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">බදු % / Tax</label>
          <input id="esTax" type="number" value="${Number(s.tax || 0)}" min="0" max="100" style="margin-top:4px">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">තත්ත්වය / Status</label>
          <select id="esActive" style="margin-top:4px">
            <option value="true" ${s.active !== false ? 'selected' : ''}>🟢 සක්‍රීය (Active)</option>
            <option value="false" ${s.active === false ? 'selected' : ''}>🔴 අක්‍රීය (Inactive)</option>
          </select>
        </div>
      </div>
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">බිල්පතේ පණිවිඩය / Receipt Footer</label>
        <input id="esFooter" value="${esc(s.footerEn || s.footer || 'Thank you! Come again.')}" style="margin-top:4px">
      </div>
    </div>`,
    `<button class="btn" onclick="closeModal()">අවලංගු</button>
     <button class="btn btn-primary" onclick="submitEditShop('${s.id}')">💾 සුරකින්න (Save)</button>`
  );
}

async function submitEditShop(shopId){
  const name = $('#esName')?.value.trim();
  const address = $('#esAddress')?.value.trim();
  const phone = $('#esPhone')?.value.trim();
  const email = $('#esEmail')?.value.trim();
  const tax = Number($('#esTax')?.value || 0);
  const active = $('#esActive')?.value === 'true';
  const footerEn = $('#esFooter')?.value.trim();

  if(!name){ toast('කරුණාකර සාප්පුවේ නම ඇතුළත් කරන්න', 'err'); return; }

  const db = window.DB || {};
  const s = (db.shops || []).find(x => x.id === shopId);
  if(s){
    s.name = name;
    s.address = address;
    s.addr = address;
    s.phone = phone;
    s.email = email;
    s.tax = tax;
    s.active = active;
    s.footerEn = footerEn;

    if(window.FB && window.FB.fbUpdate){
      await window.FB.fbUpdate(window.FB.COL.shops, s.id, {
        name: s.name,
        address: s.address,
        addr: s.addr,
        phone: s.phone,
        email: s.email,
        tax: s.tax,
        active: s.active,
        footerEn: s.footerEn
      });
    }
    if(typeof saveDB === 'function') saveDB();
  }

  closeModal();
  toast('සාප්පුවේ විස්තර යාවත්කාලීන විය ✅');
  render();
}

/* =========================================================
   MANAGE SHOP STAFF MODAL (SUPER ADMIN)
   ========================================================= */
function openManageShopStaffModal(shopId){
  const db = window.DB || {};
  const shop = (db.shops || []).find(s => s.id === shopId);
  if(!shop) return;

  const staff = (db.users || []).filter(u => u.shopId === shopId && !u.deleted);

  openModal(
    `👥 කාර්ය මණ්ඩලය — ${esc(shop.name)}`,
    `Manage Staff (${staff.length} Members)`,
    `<div style="display:flex;flex-direction:column;gap:12px">

      <div style="display:flex;justify-content:space-between;align-items:center;background:#0f172a;padding:10px 14px;border-radius:8px;border:1px solid var(--line)">
        <div style="font-size:12.5px;color:var(--muted)">
          ශාඛාව: <b>${esc(shop.name)}</b> (<code>${esc(shop.id)}</code>)
        </div>
        <button class="btn btn-primary btn-sm" onclick="closeModal();openAddStaffForShopModal('${shop.id}')">
          ➕ නව සාමාජිකයෙක්
        </button>
      </div>

      <div class="tbl-wrap" style="max-height:360px">
        <table>
          <thead>
            <tr>
              <th>නම / Name</th>
              <th>Username</th>
              <th>භූමිකාව / Role</th>
              <th>තත්ත්වය / Status</th>
              <th style="text-align:right">ක්‍රියා / Actions</th>
            </tr>
          </thead>
          <tbody>
            ${staff.length ? staff.map(u => {
              const isLocked = Boolean(u.locked || !u.active);
              return `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="width:28px;height:28px;border-radius:6px;background:#1e293b;display:grid;place-items:center;font-weight:700;font-size:12px">
                      ${esc(u.name.charAt(0).toUpperCase())}
                    </div>
                    <div>
                      <b>${esc(u.name)}</b>
                      <div style="font-size:10.5px;color:var(--muted)">${esc(u.phone || '')}</div>
                    </div>
                  </div>
                </td>
                <td><code>${esc(u.username)}</code></td>
                <td><span class="badge ${u.role}">${ROLE_EN[u.role] || u.role}</span></td>
                <td>
                  <span class="pill ${isLocked ? 'bad' : 'ok'}" title="${isLocked ? esc(u.lockMessage || 'Locked') : 'Active'}">
                    ${isLocked ? '🔴 Locked' : '🟢 Active'}
                  </span>
                </td>
                <td style="text-align:right">
                  <div class="staff-actions" style="justify-content:flex-end">
                    <button class="btn btn-sm" onclick="closeModal();openResetPasswordModal('${u.id}')" title="Reset Password">🔑</button>
                    ${isLocked ? `
                      <button class="btn btn-sm btn-green" onclick="closeModal();unlockUser('${u.id}')" title="Unlock User">🔓</button>
                    ` : `
                      <button class="btn btn-sm btn-red" onclick="closeModal();openLockUserModal('${u.id}')" title="Lock User">🔒</button>
                    `}
                    ${u.role !== 'superadmin' ? `
                      <button class="btn btn-sm btn-red" onclick="closeModal();deleteUser('${u.id}')" title="Delete User">🗑️</button>
                    ` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('') : `
              <tr><td colspan="5" class="empty">මෙම සාප්පුවට කිසිදු කාර්ය මණ්ඩල සාමාජිකයෙකු නොමැත</td></tr>
            `}
          </tbody>
        </table>
      </div>

    </div>`,
    `<button class="btn btn-primary" style="width:100%" onclick="closeModal()">හරි (Close)</button>`,
    true
  );
}

function openAddStaffForShopModal(shopId){
  const db = window.DB || {};
  const shop = (db.shops || []).find(s => s.id === shopId);
  if(!shop) return;

  openModal(
    `➕ නව කාර්ය මණ්ඩල සාමාජිකයෙක්`,
    `Add Staff Member to ${shop.name}`,
    `<div style="display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600">නම / Name *</label>
        <input id="nssName" placeholder="නම ඇතුළත් කරන්න" style="margin-top:4px">
      </div>
      <div class="grid2">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">Username *</label>
          <input id="nssUser" placeholder="username" style="margin-top:4px">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">මුරපදය / Password *</label>
          <input id="nssPass" value="1234" style="margin-top:4px">
        </div>
      </div>
      <div class="grid2">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">භූමිකාව / Role</label>
          <select id="nssRole" style="margin-top:4px">
            <option value="cashier" selected>කැෂියර් (Cashier)</option>
            <option value="admin">පරිපාලක (Admin)</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600">දුරකථන / Phone</label>
          <input id="nssPhone" placeholder="077-xxxxxxx" style="margin-top:4px">
        </div>
      </div>
    </div>`,
    `<button class="btn" onclick="closeModal();openManageShopStaffModal('${shopId}')">අවලංගු</button>
     <button class="btn btn-primary" onclick="submitAddStaffForShop('${shopId}')">➕ සුරකින්න (Save)</button>`
  );
}

async function submitAddStaffForShop(shopId){
  const name = $('#nssName')?.value.trim();
  const username = $('#nssUser')?.value.trim().toLowerCase();
  const password = $('#nssPass')?.value.trim();
  const role = $('#nssRole')?.value || 'cashier';
  const phone = $('#nssPhone')?.value.trim();

  if(!name || !username || !password){
    toast('කරුණාකර සියලු අනිවාර්ය ක්ෂේත්‍ර පුරවන්න (*)', 'err');
    return;
  }

  const db = window.DB || {};
  if((db.users || []).some(u => !u.deleted && u.username.toLowerCase() === username)){
    toast('මෙම username දැනටමත් පවතී', 'warn');
    return;
  }

  const newUser = {
    id: uid('U'),
    name,
    username,
    password,
    role,
    shopId,
    active: true,
    locked: false,
    lockMessage: '',
    lockedBy: null,
    lockedAt: null,
    phone,
    email: `${username}@autoparts.lk`,
    createdAt: new Date().toISOString(),
    createdBy: state.user ? state.user.id : 'U1'
  };

  if(!db.users) db.users = [];
  db.users.push(newUser);

  if(window.FB && window.FB.fbSet){
    await window.FB.fbSet(window.FB.COL.users, newUser.id, newUser);
  }
  if(typeof saveDB === 'function') saveDB();

  closeModal();
  toast(`සාමාජිකයා (${name}) සාර්ථකව එකතු කළා ✅`);
  openManageShopStaffModal(shopId);
  render();
}

/* =========================================================
   DELETE SHOP
   ========================================================= */
function deleteShop(shopId){
  const db = window.DB || {};
  if((db.shops || []).length <= 1){
    toast('පද්ධතියේ අවසාන සාප්පුව මැකිය නොහැක (Cannot delete last shop)', 'err');
    return;
  }

  const shop = (db.shops || []).find(s => s.id === shopId);
  if(!shop) return;

  openModal(
    '⚠️ සාප්පුව මකා දැමීම තහවුරු කරන්න',
    'Confirm Shop Deletion',
    `<div style="text-align:center;padding:12px 0">
       <div style="font-size:44px;margin-bottom:10px">🗑️</div>
       <div style="font-size:16px;font-weight:700;color:var(--red);margin-bottom:6px">${esc(shop.name)}</div>
       <p style="color:var(--muted);font-size:12.5px;line-height:1.6">
         මෙම සාප්පුව මකා දැමීමෙන් පසු, එය නැවත ලබාගත නොහැක.<br>
         මෙම සාප්පුවට අදාළ කාර්ය මණ්ඩලය සහ විකුණුම් වාර්තා විසන්ධි වනු ඇත.<br>
         <b>මෙම ක්‍රියාව ස්ථිරවම කිරීමට අවශ්‍යද?</b>
       </p>
     </div>`,
    `<button class="btn" onclick="closeModal()">අවලංගු</button>
     <button class="btn btn-red" onclick="confirmDeleteShop('${shop.id}')">🗑️ ඔව්, මකන්න (Delete)</button>`
  );
}

async function confirmDeleteShop(shopId){
  const db = window.DB || {};
  const idx = (db.shops || []).findIndex(s => s.id === shopId);
  if(idx >= 0){
    const removed = db.shops.splice(idx, 1)[0];
    if(window.FB && window.FB.fbDelete){
      await window.FB.fbDelete(window.FB.COL.shops, shopId);
    }
    if(typeof saveDB === 'function') saveDB();
    toast(`සාප්පුව (${removed.name}) සාර්ථකව ඉවත් කළා ✅`);
  }
  closeModal();
  render();
}

/* Global exports */
window.pgShops = pgShops;
window.getShopMetrics = getShopMetrics;
window.openCreateShopModal = openCreateShopModal;
window.submitCreateShop = submitCreateShop;
window.openAssignAdminModal = openAssignAdminModal;
window.toggleAdminOpt = toggleAdminOpt;
window.submitAssignAdmin = submitAssignAdmin;
window.openEditShopModal = openEditShopModal;
window.submitEditShop = submitEditShop;
window.openManageShopStaffModal = openManageShopStaffModal;
window.openAddStaffForShopModal = openAddStaffForShopModal;
window.submitAddStaffForShop = submitAddStaffForShop;
window.deleteShop = deleteShop;
window.confirmDeleteShop = confirmDeleteShop;
