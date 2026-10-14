/* =========================================================
   js/helpers.js - Utility Functions & DOM Helpers
   ========================================================= */

const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const uid = p => p + Math.random().toString(36).slice(2,7).toUpperCase();
const money = n => 'රු. ' + Number(n||0).toLocaleString('en-LK',{minimumFractionDigits:2,maximumFractionDigits:2});
const num = n => Number(n||0).toLocaleString('en-LK');
const today = () => new Date().toISOString().slice(0,10);
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad = (n,l=4) => String(n).padStart(l,'0');
const getProd = id => DB.products.find(p=>p.id===id);

function debounce(fn, wait = 250){
  let timer = null;
  return function(...args){
    if(timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, wait);
  };
}
window.debounce = debounce;

function toast(msg, type='ok'){
  const root = $('#toastRoot');
  if(!root) return;
  const d = document.createElement('div');
  d.className = 'toast ' + (type==='err'?'err':type==='warn'?'warn':'');
  d.textContent = msg;
  root.appendChild(d);
  setTimeout(()=>{
    d.style.opacity='0';
    d.style.transform='translateX(30px)';
    d.style.transition='.3s';
    setTimeout(()=>d.remove(), 300);
  }, 2600);
}

function openModal(title, sub, body, footer, wide){
  // Handle overloaded signatures: openModal(title, body, footer, wide) or openModal(title, body, footer)
  if(arguments.length === 3 && typeof footer === 'undefined'){
    footer = body;
    body = sub;
    sub = '';
  } else if(arguments.length === 4 && typeof wide === 'undefined' && typeof footer === 'boolean'){
    wide = footer;
    footer = body;
    body = sub;
    sub = '';
  } else if(arguments.length === 2 && typeof body === 'undefined'){
    body = sub;
    sub = '';
    footer = '';
  }

  const root = $('#modalRoot');
  if(!root) return;
  root.innerHTML = `
    <div class="modal-bg" onclick="if(event.target===this)closeModal()">
      <div class="modal ${wide?'wide':''}">
        <div class="modal-h">
          <h3>${title}${sub ? `<small>${sub}</small>` : ''}</h3>
          <button class="close-x" onclick="closeModal()">✕</button>
        </div>
        <div class="modal-b">${body || ''}</div>
        ${footer?`<div class="modal-f">${footer}</div>`:''}
      </div>
    </div>`;
}

function closeModal(){
  const root = $('#modalRoot');
  if(root) root.innerHTML = '';
}

/* =========================================================
   MR.Link Technology (Owner: Dimuthu) Contact Us System
   Configurable & Editable by Super Admin
   ========================================================= */
const DEFAULT_CONTACT_SETTINGS = {
  brandName: 'MR.Link Technology',
  ownerName: 'Dimuthu',
  ownerFullName: 'ඩිමුතු දිශාන් (Dimuthu Dishan)',
  phone: '077 000 0001',
  whatsapp: '+94 77 000 0001',
  email: 'info.dimuthudishan2002@gmail.com',
  tagline: 'Modern Automotive POS & Intelligent Software Solutions',
  waMessage: 'Hello MR.Link Technology, I need support for AutoParts POS',
  services: [
    'වාහන අමතර කොටස් POS පද්ධති සැකසුම් (System Setup & Support)',
    'ඔබේ ව්‍යාපාරයට ගැලපෙන නව Features නිර්මාණය කිරීම (Custom Modules)',
    'Barcode Scanners & 80mm/58mm Thermal Printers සම්බන්ධ කිරීම',
    'ආරක්ෂිත Cloud Database & දත්ත ආපසු ලබාගැනීම (Data Recovery)',
    'Password, Super Admin හෝ Cashier Lock ගැටළු විසඳීම (Access Recovery)'
  ]
};

function getContactSettings(){
  try {
    const raw = localStorage.getItem('pos.contactSettings');
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && typeof parsed === 'object'){
        const merged = Object.assign({}, DEFAULT_CONTACT_SETTINGS, parsed);
        if(!Array.isArray(merged.services) || merged.services.length === 0){
          merged.services = DEFAULT_CONTACT_SETTINGS.services.slice();
        }
        return merged;
      }
    }
  } catch(e){}
  return Object.assign({}, DEFAULT_CONTACT_SETTINGS);
}

function applyContactSettingsToDOM(){
  const c = getContactSettings();
  const lb = document.getElementById('loginBrandName');
  const lo = document.getElementById('loginOwnerName');
  const sb = document.getElementById('sidebarBrandName');
  const so = document.getElementById('sidebarOwnerName');
  const stb = document.getElementById('settingsBrandName');
  const sto = document.getElementById('settingsOwnerName');
  if(lb) lb.textContent = c.brandName;
  if(lo) lo.textContent = c.ownerName;
  if(sb) sb.textContent = c.brandName;
  if(so) so.textContent = c.ownerName;
  if(stb) stb.textContent = c.brandName;
  if(sto) sto.textContent = c.ownerName;
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', applyContactSettingsToDOM);
} else {
  setTimeout(applyContactSettingsToDOM, 50);
}

async function syncContactSettingsFromFirebase(){
  try {
    if(window.FB && typeof window.FB.fbGetDirect === 'function'){
      const remote = await window.FB.fbGetDirect(window.FB.COL.settings, 'contact_info');
      if(remote && typeof remote === 'object'){
        localStorage.setItem('pos.contactSettings', JSON.stringify(remote));
        applyContactSettingsToDOM();
        return remote;
      }
    }
  } catch(e){}
  return getContactSettings();
}

async function saveContactSettings(settings){
  const updated = Object.assign({}, DEFAULT_CONTACT_SETTINGS, settings);
  if(!Array.isArray(updated.services)){
    updated.services = DEFAULT_CONTACT_SETTINGS.services.slice();
  }
  try {
    localStorage.setItem('pos.contactSettings', JSON.stringify(updated));
  } catch(e){}

  applyContactSettingsToDOM();

  // Sync to Cloud Firestore if connected
  if(window.FB && typeof window.FB.fbSet === 'function'){
    try {
      await window.FB.fbSet(window.FB.COL.settings, 'contact_info', updated);
    } catch(err){
      console.warn('Could not sync contact settings to Firestore:', err.message);
    }
  }
  return updated;
}

function copyContactDetails(){
  const c = getContactSettings();
  const text = `${c.brandName} — ${c.tagline}\nOwner / Developer: ${c.ownerFullName || c.ownerName}\nදුරකථන / Phone: ${c.phone}\nWhatsApp: ${c.whatsapp}\nEmail: ${c.email}\nAutoParts POS Technical Support`;
  const setFeedback = () => {
    const icon = document.getElementById('copyBtnIcon');
    const txt = document.getElementById('copyBtnTxt');
    if(icon) icon.textContent = '✅';
    if(txt) txt.textContent = 'පිටපත් විය! (Copied)';
    setTimeout(() => {
      if(icon) icon.textContent = '📋';
      if(txt) txt.textContent = 'විස්තර පිටපත් කරන්න (Copy)';
    }, 2500);
    if(typeof toast === 'function') toast('සම්බන්ධතා විස්තර සාර්ථකව පිටපත් කරන ලදී! 📋', 'ok');
  };

  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(setFeedback).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }

  function fallbackCopy(str){
    const ta = document.createElement('textarea');
    ta.value = str;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      setFeedback();
    } catch(_){}
    document.body.removeChild(ta);
  }
}

function showContactUsModal(){
  const c = getContactSettings();
  const cleanWa = (c.whatsapp || '').replace(/[^0-9]/g, '');
  const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(c.waMessage || 'Hello MR.Link Technology, I need support for AutoParts POS')}`;
  const cleanPhone = (c.phone || '').replace(/[^0-9+]/g, '');
  const phoneUrl = `tel:${cleanPhone}`;
  const mailUrl = `mailto:${c.email}?subject=${encodeURIComponent(c.brandName + ' - AutoParts POS Support Inquiry')}`;
  const isSuper = window.state?.user?.role === 'superadmin';

  const bodyHtml = `
    <div class="contact-modal-body">
      <div class="contact-brand-header">
        <div class="contact-brand-logo">
          <span class="contact-spark">⚡</span>
        </div>
        <div class="contact-brand-title">${esc(c.brandName)}</div>
        <div class="contact-brand-sub">${esc(c.tagline)}</div>
        <div class="contact-owner-badge">
          <span class="owner-icon">👤</span> Owner & Lead Developer: <strong>${esc(c.ownerFullName || c.ownerName)}</strong>
        </div>
      </div>

      <div class="contact-actions-grid">
        <a href="${waUrl}" target="_blank" rel="noopener" class="contact-action-card wa-card">
          <div class="ca-icon">💬</div>
          <div class="ca-info">
            <span class="ca-label">WhatsApp (ක්ෂණික පණිවිඩ)</span>
            <b class="ca-val">${esc(c.whatsapp)}</b>
          </div>
          <span class="ca-arrow">➔</span>
        </a>

        <a href="${phoneUrl}" class="contact-action-card call-card">
          <div class="ca-icon">📞</div>
          <div class="ca-info">
            <span class="ca-label">දුරකථන ඇමතුම් (Direct Call)</span>
            <b class="ca-val">${esc(c.phone)}</b>
          </div>
          <span class="ca-arrow">➔</span>
        </a>

        <a href="${mailUrl}" class="contact-action-card mail-card">
          <div class="ca-icon">✉️</div>
          <div class="ca-info">
            <span class="ca-label">විද්‍යුත් තැපෑල (Email)</span>
            <b class="ca-val">${esc(c.email)}</b>
          </div>
          <span class="ca-arrow">➔</span>
        </a>
      </div>

      <div class="contact-services-box">
        <div class="cs-title">🛠️ අප ලබාදෙන තාක්ෂණික සහාය සහ සේවාවන්:</div>
        <ul class="cs-list">
          ${(c.services || []).map(s => `<li><span>✅</span> ${esc(s)}</li>`).join('')}
        </ul>
      </div>

      <div class="contact-system-meta">
        <span>🖥️ AutoParts POS System</span>
        <span>•</span>
        <span>Powered by ${esc(c.brandName)}</span>
        <span>•</span>
        <span>Owner: ${esc(c.ownerName)}</span>
      </div>
    </div>
  `;

  const footerHtml = `
    <div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:8px">
      <div>
        ${isSuper ? `
          <button type="button" class="btn btn-sm" onclick="openEditContactModal()" style="display:inline-flex;align-items:center;gap:6px;background:rgba(56,189,248,0.12);color:#38bdf8;border:1px solid rgba(56,189,248,0.3);font-weight:600;padding:6px 12px;border-radius:8px;cursor:pointer">
            ⚙️ විස්තර වෙනස් කරන්න (Edit)
          </button>
        ` : ''}
      </div>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn btn-secondary" onclick="copyContactDetails()" style="display:flex;align-items:center;gap:6px">
          <span id="copyBtnIcon">📋</span> <span id="copyBtnTxt">විස්තර පිටපත් කරන්න (Copy)</span>
        </button>
        <button type="button" class="btn btn-primary" onclick="closeModal()">
          හරි (Close)
        </button>
      </div>
    </div>
  `;

  if(typeof openModal === 'function'){
    openModal('📞 තාක්ෂණික සහාය සහ විමසීම්', 'Contact Us & Technical Support', bodyHtml, footerHtml);
  } else {
    alert(`${c.brandName}\nOwner: ${c.ownerName}\nදුරකථන: ${c.phone}\nEmail: ${c.email}`);
  }
}

function openEditContactModal(){
  if(window.state?.user?.role !== 'superadmin'){
    if(typeof toast === 'function') toast('🔒 මෙම විස්තර වෙනස් කළ හැක්කේ Super Admin හට පමණි.', 'warn');
    return;
  }
  const c = getContactSettings();
  const servicesText = (c.services || []).join('\n');

  const bodyHtml = `
    <form id="editContactForm" onsubmit="event.preventDefault();submitEditContactForm();" style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
      <div style="background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.25);border-radius:10px;padding:10px 14px;font-size:12px;color:#38bdf8">
        👑 <b>Super Admin සැකසුම්</b>: මෙහි ඇතුළත් කරන තොරතුරු Login පිටුව, Sidebar, Settings හා Contact Us Modal එක පුරාම සජීවීව ක්‍රියාත්මක වේ.
      </div>

      <div class="grid2" style="gap:10px">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
            ආයතනයේ / Provider නම (Brand Name)
          </label>
          <input id="editContactBrand" class="form-input" value="${esc(c.brandName)}" required placeholder="e.g. MR.Link Technology">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
            අයිතිකරුගේ කෙටි නම (Owner Short Name)
          </label>
          <input id="editContactOwner" class="form-input" value="${esc(c.ownerName)}" required placeholder="e.g. Dimuthu">
        </div>
      </div>

      <div class="grid2" style="gap:10px">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
            අයිතිකරුගේ සම්පූර්ණ නම (Owner Full Name)
          </label>
          <input id="editContactOwnerFull" class="form-input" value="${esc(c.ownerFullName)}" placeholder="e.g. ඩිමුතු දිශාන් (Dimuthu Dishan)">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
            දුරකථන අංකය (Direct Phone)
          </label>
          <input id="editContactPhone" class="form-input" value="${esc(c.phone)}" required placeholder="e.g. 077 000 0001">
        </div>
      </div>

      <div class="grid2" style="gap:10px">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
            WhatsApp අංකය (Country Code සමඟ)
          </label>
          <input id="editContactWhatsapp" class="form-input" value="${esc(c.whatsapp)}" required placeholder="e.g. +94 77 000 0001">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
            විද්‍යුත් තැපෑල (Support Email)
          </label>
          <input id="editContactEmail" type="email" class="form-input" value="${esc(c.email)}" required placeholder="e.g. info@domain.com">
        </div>
      </div>

      <div class="grid2" style="gap:10px">
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
            Tagline / කෙටි විස්තරය
          </label>
          <input id="editContactTagline" class="form-input" value="${esc(c.tagline)}" placeholder="e.g. Modern POS & Intelligent Software Solutions">
        </div>
        <div>
          <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
            පෙරනිමි WhatsApp පණිවිඩය (Default Greeting)
          </label>
          <input id="editContactWaMsg" class="form-input" value="${esc(c.waMessage)}" placeholder="e.g. Hello MR.Link Technology, I need support...">
        </div>
      </div>

      <div>
        <label style="font-size:12px;color:var(--muted);font-weight:600;display:block;margin-bottom:4px">
          ලබාදෙන තාක්ෂණික සේවාවන් (Services List - පේළියකට එකක් බැගින්)
        </label>
        <textarea id="editContactServices" rows="4" style="width:100%;font-family:inherit;font-size:12.5px;padding:8px 10px;background:#0f172a;color:var(--txt);border:1px solid var(--line);border-radius:8px;resize:vertical">${esc(servicesText)}</textarea>
      </div>
    </form>
  `;

  const footerHtml = `
    <div style="display:flex;justify-content:space-between;align-items:center;width:100%;flex-wrap:wrap;gap:8px">
      <button type="button" class="btn btn-secondary btn-sm" onclick="resetContactSettingsToDefaults()" style="color:#fcd34d">
        🔄 Defaults Restore කරන්න
      </button>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn" onclick="showContactUsModal()">
          ✕ අවලංගුයි
        </button>
        <button type="button" class="btn btn-primary" onclick="submitEditContactForm()">
          💾 සුරකින්න (Save Changes)
        </button>
      </div>
    </div>
  `;

  openModal('⚙️ තාක්ෂණික සහාය තොරතුරු සංස්කරණය', 'Super Admin Control · Edit Contact Us Details', bodyHtml, footerHtml, true);
}

async function submitEditContactForm(){
  const brand = document.getElementById('editContactBrand')?.value.trim();
  const owner = document.getElementById('editContactOwner')?.value.trim();
  const ownerFull = document.getElementById('editContactOwnerFull')?.value.trim();
  const phone = document.getElementById('editContactPhone')?.value.trim();
  const whatsapp = document.getElementById('editContactWhatsapp')?.value.trim();
  const email = document.getElementById('editContactEmail')?.value.trim();
  const tagline = document.getElementById('editContactTagline')?.value.trim();
  const waMsg = document.getElementById('editContactWaMsg')?.value.trim();
  const rawServices = document.getElementById('editContactServices')?.value || '';

  if(!brand || !owner || !phone || !whatsapp || !email){
    if(typeof toast === 'function') toast('කරුණාකර සියලුම අත්‍යවශ්‍ය තොරතුරු ඇතුළත් කරන්න.', 'err');
    return;
  }

  const services = rawServices
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const updated = {
    brandName: brand,
    ownerName: owner,
    ownerFullName: ownerFull || owner,
    phone,
    whatsapp,
    email,
    tagline: tagline || DEFAULT_CONTACT_SETTINGS.tagline,
    waMessage: waMsg || DEFAULT_CONTACT_SETTINGS.waMessage,
    services: services.length ? services : DEFAULT_CONTACT_SETTINGS.services
  };

  await saveContactSettings(updated);

  if(typeof toast === 'function') toast('✅ තාක්ෂණික සහාය තොරතුරු සාර්ථකව සුරකින ලදී!', 'ok');

  // Re-open updated Contact Us modal
  showContactUsModal();

  // If currently on settings page, refresh it
  if(window.state?.page === 'settings' && typeof render === 'function'){
    render();
  }
}

async function resetContactSettingsToDefaults(){
  if(!confirm('Contact Us තොරතුරු පෙරනිමි (Default) අගයන් වලට Reset කිරීමට අවශ්‍යද?')) return;
  await saveContactSettings(DEFAULT_CONTACT_SETTINGS);
  if(typeof toast === 'function') toast('🔄 පෙරනිමි තොරතුරු සාර්ථකව පිහිටුවන ලදී!', 'ok');
  showContactUsModal();
  if(window.state?.page === 'settings' && typeof render === 'function'){
    render();
  }
}

window.DEFAULT_CONTACT_SETTINGS = DEFAULT_CONTACT_SETTINGS;
window.getContactSettings = getContactSettings;
window.saveContactSettings = saveContactSettings;
window.applyContactSettingsToDOM = applyContactSettingsToDOM;
window.syncContactSettingsFromFirebase = syncContactSettingsFromFirebase;
window.openEditContactModal = openEditContactModal;
window.submitEditContactForm = submitEditContactForm;
window.resetContactSettingsToDefaults = resetContactSettingsToDefaults;
window.copyContactDetails = copyContactDetails;
window.showContactUsModal = showContactUsModal;
window.openContactModal   = showContactUsModal;

function updateClock(){
  const el = $('#clock');
  if(!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB');
}

function focusSearch(){
  const inp = $('#posSearch');
  if(inp){
    inp.focus();
    inp.select();
  }
}

function formatRelativeTime(input){
  if(!input) return '—';
  let d;
  if(input && typeof input.toDate === 'function') d = input.toDate();              // Firestore Timestamp instance
  else if(input && input.seconds !== undefined) d = new Date(input.seconds * 1000); // Firestore timestamp plain object { seconds, nanoseconds }
  else if(typeof input === 'string') d = new Date(input);
  else if(input instanceof Date) d = input;
  else if(typeof input === 'number') d = new Date(input);
  else return '—';
  
  if(isNaN(d.getTime())) return '—';
  
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);  // seconds
  
  if(diff < 60) return 'දැන්';
  if(diff < 3600) return Math.floor(diff/60) + ' මිනිත්තු කට පෙර';
  if(diff < 86400) return Math.floor(diff/3600) + ' පැය කට පෙර';
  if(diff < 604800) return Math.floor(diff/86400) + ' දින කට පෙර';
  
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' });
}
window.formatRelativeTime = formatRelativeTime;

function canEditCustomers(){
  const role = state.user?.role;
  return role === 'admin' || role === 'superadmin';
}

function canDeleteCustomers(){
  const role = state.user?.role;
  return role === 'superadmin' || role === 'admin';
}
window.canEditCustomers = canEditCustomers;
window.canDeleteCustomers = canDeleteCustomers;

/* Dynamic Shop Branding & Super Admin Switcher */
function updateBrandName(){
  const shop = window.state && window.state.activeShop;
  const brandName = document.getElementById('brandName');
  const brandSub = document.getElementById('brandSub');

  if(!shop){
    if(window.state && window.state.user && window.state.user.role === 'superadmin'){
      if(brandName){
        brandName.textContent = 'AutoParts POS · System';
        brandName.title = 'AutoParts POS · System';
      }
      if(brandSub){
        brandSub.textContent = 'ප්‍රධාන පාලන මැදිරිය';
        brandSub.title = 'ප්‍රධාන පාලන මැදිරිය';
      }
      document.title = 'AutoParts POS · System';
    } else {
      if(brandName){
        brandName.textContent = 'AutoParts POS';
        brandName.title = 'AutoParts POS';
      }
      if(brandSub){
        brandSub.textContent = 'වාහන අමතර කොටස්';
        brandSub.title = 'වාහන අමතර කොටස්';
      }
      document.title = 'AutoParts POS';
    }
    return;
  }

  const name = shop.name || 'POS';
  const sub = shop.address || shop.addr || 'වාහන අමතර කොටස්';

  if(brandName){
    brandName.textContent = name;
    brandName.title = name;
  }
  if(brandSub){
    brandSub.textContent = sub;
    brandSub.title = sub;
  }

  document.title = (shop.name || 'POS') + ' — POS';
}

function updateTopBarShopSwitcher(){
  const slot = document.getElementById('topbarShopSwitcherSlot');
  if(!slot) return;

  if(!window.state || !window.state.user || window.state.user.role !== 'superadmin'){
    slot.style.display = 'none';
    slot.innerHTML = '';
    return;
  }

  const db = window.DB || {};
  const shops = db.shops || [];
  if(!shops.length){
    slot.style.display = 'none';
    slot.innerHTML = '';
    return;
  }

  const currentId = window.state.activeShopId || (window.state.activeShop && window.state.activeShop.id) || shops[0].id;

  slot.style.display = 'inline-flex';
  slot.innerHTML = `
    <select id="superAdminShopSelect" class="shop-switcher-select" onchange="switchSuperAdminShop(this.value)" title="ශාඛාව / සාප්පුව තෝරන්න">
      ${shops.map(s => `
        <option value="${esc(s.id)}" ${s.id === currentId ? 'selected' : ''}>
          🏪 ${esc(s.name)}
        </option>
      `).join('')}
      <option value="__manage__">⚙️ Manage Shops →</option>
    </select>
  `;
}

async function switchSuperAdminShop(shopId){
  if(shopId === '__manage__'){
    if(typeof go === 'function') go('shops');
    updateTopBarShopSwitcher();
    return;
  }
  const db = window.DB || {};
  const shop = (db.shops || []).find(s => s.id === shopId);
  if(!shop) return;

  if(window.state){
    window.state.activeShopId = shopId;
    window.state.activeShop = shop;
    window.state.cart = [];
    window.state.held = [];
  }
  db.shop = shop;
  try {
    localStorage.setItem('pos.activeShopId', shopId);
  } catch(e){}

  // 1. Unsubscribe previous shop listeners
  if(typeof window.stopAllListeners === 'function') window.stopAllListeners();

  // 2. Clear in-memory DB arrays
  db.products  = [];
  db.customers = [];
  db.suppliers = [];
  db.sales     = [];
  db.grns      = [];
  db.returns   = [];
  db.shifts    = [];
  db.cashMoves = [];
  db.payments  = [];
  db.supplierPayments = [];
  db.interchanges = [];
  db.scrapInventory = [];

  // 3. Reload data for newly selected shop
  if(typeof db.loadAll === 'function'){
    await db.loadAll();
  }

  // 4. Restart page listeners
  if(typeof window.startPageListeners === 'function'){
    window.startPageListeners(window.state?.page || 'billing');
  }

  // 5. Update header branding & switcher
  updateBrandName();
  updateTopBarShopSwitcher();

  // 6. Check active shift and update indicator
  if(typeof updateShiftIndicator === 'function') updateShiftIndicator();

  // 7. Re-render UI
  if(typeof rerenderIfActive === 'function') rerenderIfActive();
  else if(typeof render === 'function') render();

  if(typeof toast === 'function') toast(`සාප්පුව මාරු කරන ලදී: ${shop.name} 🏪`);
}

window.updateBrandName = updateBrandName;
window.updateTopBarShopSwitcher = updateTopBarShopSwitcher;
window.switchShop = switchSuperAdminShop;
window.switchSuperAdminShop = switchSuperAdminShop;

/* =========================================================
   GRANULAR PERMISSION SYSTEM DEFINITIONS & HELPERS
   ========================================================= */
const PERMISSION_GROUPS = [
  { id: 'pos_sales', name: 'POS & Sales', si: 'විකුණුම් හා බිල්පත්', icon: '💰' },
  { id: 'inventory_stock', name: 'Inventory & Stock', si: 'බඩු තොග හා ගබඩාව', icon: '📦' },
  { id: 'financial_actions', name: 'Financial & Special Actions', si: 'මුදල් හා විශේෂ ක්‍රියාකාරකම්', icon: '💳' },
  { id: 'reports_shifts', name: 'Reports & Shifts', si: 'වාර්තා හා වැඩ මුර', icon: '📊' },
  { id: 'administration', name: 'System Administration', si: 'පද්ධති පරිපාලනය', icon: '⚙️' }
];

const PERMISSIONS = [
  // 1. POS & Sales
  { id: 'billing', group: 'pos_sales', name: 'POS Billing', si: 'POS බිල්පත් නිකුත් කිරීම', desc: 'නව බිල්පත් නිකුත් කිරීම හා Checkout කිරීම' },
  { id: 'dashboard', group: 'pos_sales', name: 'Dashboard', si: 'ප්‍රධාන උපකරණ පුවරුව', desc: 'විකුණුම් දළ විශ්ලේෂණය හා ඉක්මන් සංඛ්‍යාලේඛන' },
  { id: 'pos', group: 'pos_sales', name: 'POS Terminal', si: 'POS පර්යන්තය', desc: 'පූර්ණ POS විකුණුම් අතුරුමුහුණත භාවිතා කිරීම' },
  { id: 'customers', group: 'pos_sales', name: 'Customers', si: 'පාරිභෝගික කළමනාකරණය', desc: 'පාරිභෝගික තොරතුරු බැලීම හා එක් කිරීම' },
  { id: 'lowstock', group: 'pos_sales', name: 'Low Stock', si: 'අඩු තොග අනතුරු ඇඟවීම්', desc: 'තොග අවසන් වීමට ආසන්න භාණ්ඩ නිරීක්ෂණය' },

  // 2. Inventory & Stock
  { id: 'inventory', group: 'inventory_stock', name: 'Inventory', si: 'බඩු තොග කළමනාකරණය', desc: 'භාණ්ඩ නාමාවලිය හා තොග තොරතුරු බැලීම' },
  { id: 'grn', group: 'inventory_stock', name: 'GRN', si: 'GRN (භාණ්ඩ ලැබීම් සටහන්)', desc: 'නව තොග ඇතුළත් කිරීම හා සැපයුම්කරුවන්ගේ බිල්පත්' },
  { id: 'payables', group: 'inventory_stock', name: 'Supplier Payables', si: 'සැපයුම් ණය හා චෙක්පත්', desc: 'සැපයුම්කරුවන්ගේ හිඟ මුදල්, ගෙවීම් හා චෙක්පත් කළමනාකරණය' },
  { id: 'interchange', group: 'inventory_stock', name: 'Part Interchange', si: 'Part Interchange', desc: 'වාහන අමතර කොටස් ගැළපුම් සෙවීම හා කළමනාකරණය' },
  { id: 'scrap', group: 'inventory_stock', name: 'Scrap Inventory', si: 'Scrap බැටරි තොගය', desc: 'පරණ බැටරි (Core) භාරගැනීම හා තොග කළමනාකරණය' },
  { id: 'labels', group: 'inventory_stock', name: 'Barcode Labels', si: 'Barcode ලේබල් මුද්‍රණය', desc: 'භාණ්ඩ සඳහා Barcode හා මිල ලේබල් මුද්‍රණය කිරීම' },
  { id: 'serial-search', group: 'inventory_stock', name: 'Serial Search', si: 'සීරියල් අංක සෙවීම', desc: 'බැටරි/ටයර් සීරියල් අංක ලුහුබැඳීම' },
  { id: 'delete-product', group: 'inventory_stock', name: 'Delete Products', si: 'භාණ්ඩ ඉවත් කිරීම', desc: 'තොග නාමාවලියෙන් භාණ්ඩ සම්පූර්ණයෙන්ම මකා දැමීම' },

  // 3. Financial & Special Actions
  { id: 'returns', group: 'financial_actions', name: 'Returns', si: 'ආපසු භාරගැනීම් (Returns)', desc: 'භාණ්ඩ ආපසු භාරගැනීම් ඉල්ලීම් හා අනුමත කිරීම්' },
  { id: 'credit', group: 'financial_actions', name: 'Credit Payments', si: 'ණය පියවීම්', desc: 'පාරිභෝගික ණය මුදල් එකතු කිරීම හා පියවීම' },
  { id: 'discounts', group: 'financial_actions', name: 'Give Discounts', si: 'වට්ටම් ලබාදීම', desc: 'බිල්පතට අමතර වට්ටම් යෙදීම' },
  { id: 'price-override', group: 'financial_actions', name: 'Price Override', si: 'මිල වෙනස් කිරීම', desc: 'Checkout හිදී භාණ්ඩ විකුණුම් මිල තාවකාලිකව වෙනස් කිරීම' },
  { id: 'void-sale', group: 'financial_actions', name: 'Void Completed Sale', si: 'බිල්පත් අවලංගු කිරීම', desc: 'නිකුත් කළ බිල්පත් අවලංගු කිරීම' },

  // 4. Reports & Shifts
  { id: 'reports', group: 'reports_shifts', name: 'Reports', si: 'ව්‍යාපාරික වාර්තා', desc: 'විකුණුම්, ලාභ හා මූල්‍ය වාර්තා බැලීම' },
  { id: 'shifts', group: 'reports_shifts', name: 'Shift History', si: 'Shift ඉතිහාසය', desc: 'කැෂියර් වැඩමුර හා මුදල් ලාච්චු විස්තර බැලීම' },

  // 5. System Administration
  { id: 'staff', group: 'administration', name: 'Staff Control', si: 'කාර්ය මණ්ඩල පාලනය', desc: 'සේවක ගිණුම් සෑදීම, සංස්කරණය හා අගුළු දැමීම' },
  { id: 'shops', group: 'administration', name: 'Shop Management', si: 'ශාඛා කළමනාකරණය', desc: 'නව ශාඛා ලියාපදිංචි කිරීම (Super Admin Only)' },
  { id: 'settings', group: 'administration', name: 'Settings', si: 'පද්ධති සැකසුම්', desc: 'සාප්පු විස්තර හා මූලික සැකසුම් වෙනස් කිරීම' },
  { id: 'system-reset', group: 'administration', name: 'System Reset & Clean Slate', si: 'දත්ත පිරිසිදු කිරීම හා Clean Slate', desc: 'පද්ධතිය විකිණීමට සූදානම් කිරීම හා දත්ත Clear කිරීම (Super Admin Only)' },
  { id: 'profile', group: 'administration', name: 'My Profile', si: 'මගේ ගිණුම', desc: 'තමන්ගේ තොරතුරු හා මුරපදය වෙනස් කිරීම' }
];

const PERMISSION_PRESETS = {
  cashier: {
    name: 'Cashier Standard',
    si: 'කැෂියර් සම්මතය',
    icon: '💵',
    perms: ['billing', 'dashboard', 'customers', 'lowstock', 'profile', 'labels', 'interchange', 'scrap']
  },
  supervisor: {
    name: 'Supervisor',
    si: 'සුපරීක්ෂක',
    icon: '🛡️',
    perms: ['billing', 'dashboard', 'pos', 'customers', 'lowstock', 'returns', 'shifts', 'serial-search', 'profile', 'credit', 'discounts', 'void-sale', 'labels', 'interchange', 'scrap']
  },
  inventory_mgr: {
    name: 'Inventory Manager',
    si: 'තොග කළමනාකරු',
    icon: '📦',
    perms: ['dashboard', 'inventory', 'lowstock', 'grn', 'payables', 'interchange', 'scrap', 'labels', 'serial-search', 'delete-product', 'profile']
  },
  sales_mgr: {
    name: 'Sales Manager',
    si: 'විකුණුම් කළමනාකරු',
    icon: '📈',
    perms: ['billing', 'dashboard', 'pos', 'customers', 'reports', 'shifts', 'profile', 'credit', 'discounts', 'price-override', 'labels']
  },
  full: {
    name: 'Full Access (Admin)',
    si: 'සම්පූර්ණ ප්‍රවේශය (Admin)',
    icon: '⚡',
    perms: ['billing', 'dashboard', 'pos', 'inventory', 'customers', 'lowstock', 'grn', 'payables', 'interchange', 'scrap', 'labels', 'returns', 'serial-search', 'shifts', 'reports', 'settings', 'staff', 'profile', 'credit', 'discounts', 'price-override', 'void-sale', 'delete-product']
  }
};

function getDefaultPermissionsForRole(role){
  if(role === 'superadmin'){
    return PERMISSIONS.map(p => p.id);
  }
  if(role === 'admin'){
    return [...PERMISSION_PRESETS.full.perms];
  }
  return [...PERMISSION_PRESETS.cashier.perms];
}

function hasPermission(perm, user){
  const u = user || (window.state && window.state.user);
  if(!u) return false;
  if(u.role === 'superadmin') return true; // Super Admin has FULL access to everything
  // System reset and shops are strictly restricted to superadmin (unless explicitly permitted)
  if(perm === 'system-reset' || perm === 'shops'){
    if(u.role !== 'superadmin' && !(u.permissions && u.permissions.includes(perm))) return false;
  }
  if(u.role === 'admin'){
    if(u.permissions && Array.isArray(u.permissions)){
      return u.permissions.includes(perm);
    }
    return true; // Default admin has full standard access if permissions unconfigured
  }
  if(!u.permissions || !Array.isArray(u.permissions)) return false;
  return u.permissions.includes(perm);
}

function can(page, user){
  const u = user || (window.state && window.state.user);
  if(!u) return false;
  if(u.role === 'superadmin') return true;
  const navItem = (typeof NAV !== 'undefined' && Array.isArray(NAV)) ? NAV.find(n => n.id === page) : null;
  const permKey = (navItem && navItem.perm) ? navItem.perm : page;
  return hasPermission(permKey, u);
}

window.$ = $;
window.$$ = $$;
window.uid = uid;
window.money = money;
window.num = num;
window.today = today;
window.esc = esc;
window.pad = pad;
window.getProd = getProd;
window.toast = toast;
window.openModal = openModal;
window.closeModal = closeModal;
window.updateClock = updateClock;
window.focusSearch = focusSearch;
window.PERMISSION_GROUPS = PERMISSION_GROUPS;
window.PERMISSIONS = PERMISSIONS;
window.PERMISSION_PRESETS = PERMISSION_PRESETS;
window.getDefaultPermissionsForRole = getDefaultPermissionsForRole;
window.hasPermission = hasPermission;
window.can = can;

/* =========================================================
   MOBILE SIDEBAR DRAWER & BACKDROP HANDLERS
   ========================================================= */
function openMobileSidebar(){
  const sidebar = document.getElementById('sidebarSlot') 
               || document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  
  if(sidebar) sidebar.classList.add('open');
  if(backdrop) backdrop.classList.add('open');
  document.body.classList.add('sidebar-open');
  
  // Focus first menu item for accessibility
  setTimeout(() => {
    const firstItem = sidebar?.querySelector('.nav-item');
    if(firstItem) firstItem.focus();
  }, 350);
}

function closeMobileSidebar(){
  const sidebar = document.getElementById('sidebarSlot') 
               || document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  
  if(sidebar) sidebar.classList.remove('open');
  if(backdrop) backdrop.classList.remove('open');
  document.body.classList.remove('sidebar-open');
}

function toggleMobileSidebar(){
  const sidebar = document.getElementById('sidebarSlot') 
               || document.querySelector('.sidebar');
  if(!sidebar) return;
  if(sidebar.classList.contains('open')){
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
}

// Auto-close on window resize to desktop
window.addEventListener('resize', () => {
  if(window.innerWidth > 820){
    closeMobileSidebar();
  }
});

// Close on ESC key
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    const sidebar = document.getElementById('sidebarSlot') 
                 || document.querySelector('.sidebar');
    if(sidebar?.classList.contains('open')){
      closeMobileSidebar();
    }
  }
});

// Export globally
window.openMobileSidebar = openMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.toggleMobileSidebar = toggleMobileSidebar;

/* =========================================================
   CSV / EXCEL EXPORT HELPER (UTF-8 BOM FOR MICROSOFT EXCEL)
   ========================================================= */
function downloadCSV(filename, headers, rows){
  // Build CSV with BOM for Excel compatibility
  const bom = '\uFEFF';
  const csv = [
    headers.map(h => `"${String(h ?? '').replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => 
      row.map(cell => {
        const str = String(cell ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\r\n');
  
  const blob = new Blob([bom + csv], { 
    type: 'text/csv;charset=utf-8;' 
  });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
  
  if(typeof toast === 'function') toast('⬇️ ' + filename + ' බාගත විය', 'ok');
}

/* =========================================================
   UNIFIED PDF & PRINT REPORT GENERATOR (ALL TABS)
   ========================================================= */

function printReportHtml(htmlContent, title = 'Report', landscape = false){
  let frame = document.getElementById('reportPrintFrame');
  if(!frame){
    frame = document.createElement('iframe');
    frame.id = 'reportPrintFrame';
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
  }

  const frameDoc = frame.contentWindow.document;
  frameDoc.open();
  frameDoc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${esc(title)}</title>
      <style>
        @page {
          size: A4 ${landscape ? 'landscape' : 'portrait'};
          margin: 10mm;
        }
        * { box-sizing: border-box; }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: #111;
          background: #fff;
          margin: 0;
          padding: 8px;
          font-size: 11.5px;
          line-height: 1.4;
        }
        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .report-title {
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 3px 0;
        }
        .report-shop {
          font-size: 13.5px;
          font-weight: 700;
          color: #1e3a8a;
          margin: 0 0 2px 0;
        }
        .report-meta {
          font-size: 10.5px;
          color: #475569;
          text-align: right;
          line-height: 1.5;
        }
        .filter-banner {
          background: #f1f5f9;
          border-left: 3px solid #2563eb;
          padding: 6px 10px;
          font-size: 11px;
          color: #334155;
          margin-bottom: 12px;
          border-radius: 4px;
        }
        .kpi-row {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .kpi-box {
          flex: 1;
          min-width: 120px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 10px;
          background: #f8fafc;
        }
        .kpi-label {
          font-size: 10px;
          text-transform: uppercase;
          color: #64748b;
          font-weight: 600;
        }
        .kpi-val {
          font-size: 14px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 2px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          font-size: 11px;
        }
        th {
          background: #f1f5f9;
          color: #0f172a;
          font-weight: 700;
        }
        tr:nth-child(even) {
          background: #f8fafc;
        }
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .font-bold { font-weight: 700; }
        .footer-sigs {
          margin-top: 28px;
          display: flex;
          justify-content: space-between;
          padding-top: 18px;
        }
        .sig-col {
          text-align: center;
          width: 180px;
          border-top: 1px dashed #64748b;
          padding-top: 4px;
          font-size: 10.5px;
          color: #475569;
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `);
  frameDoc.close();

  setTimeout(() => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch(err){
      console.warn('Iframe print error, falling back to window.print:', err);
      window.print();
    }
  }, 350);
}

function openPdfReportModal(opts){
  const db = window.DB || {};
  const activeShop = (typeof state !== 'undefined' && state.activeShop) ? state.activeShop : (db.shops?.[0] || { name: 'Auto Parts Lanka', phone: '' });
  const shopName = opts.shopName || activeShop.name || 'Auto Parts Lanka';
  const shopPhone = activeShop.phone || '';
  const nowStr = new Date().toLocaleString('en-LK', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const operatorName = (window.state?.user?.name) || 'පරිපාලක';
  const opRole = (window.state?.user?.role) || 'Super Admin';

  const title = opts.title || 'වාර්තාව / Report';
  const subtitle = opts.subtitle || '';
  const filtersText = opts.filtersText || '';
  const summaryCards = opts.summaryCards || [];
  const columns = opts.columns || [];
  const rows = opts.rows || [];
  const alignments = opts.alignments || [];
  const landscape = Boolean(opts.landscape);
  const filename = opts.filename || (title.replace(/[^a-zA-Z0-9]/g, '_') + '_' + today() + '.csv');

  // Build the clean printable HTML
  const printableHtml = `
    <div class="report-header">
      <div>
        <div class="report-title">${esc(title)}</div>
        <div class="report-shop">🏪 ${esc(shopName)}</div>
        ${subtitle ? `<div style="font-size:11.5px;color:#475569;margin-top:2px">${esc(subtitle)}</div>` : ''}
      </div>
      <div class="report-meta">
        <div><b>දිනය:</b> ${nowStr}</div>
        <div><b>නිකුත් කළේ:</b> ${esc(operatorName)} (${esc(opRole)})</div>
        ${shopPhone ? `<div><b>Tel:</b> ${esc(shopPhone)}</div>` : ''}
        <div style="font-size:9.5px;color:#64748b;margin-top:2px">Powered by MR.Link Technology</div>
      </div>
    </div>

    ${filtersText ? `<div class="filter-banner">🔍 <b>පෙරහන් (Filters):</b> ${esc(filtersText)}</div>` : ''}

    ${summaryCards.length > 0 ? `
      <div class="kpi-row">
        ${summaryCards.map(c => `
          <div class="kpi-box">
            <div class="kpi-label">${esc(c.label)}</div>
            <div class="kpi-val">${esc(c.value)}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <table>
      <thead>
        <tr>
          ${columns.map((col, idx) => {
            const align = alignments[idx] || 'left';
            return `<th class="text-${align}">${esc(col)}</th>`;
          }).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.length > 0 ? rows.map(r => `
          <tr>
            ${r.map((cell, cIdx) => {
              const align = alignments[cIdx] || 'left';
              const isBold = cIdx === 0 || cIdx === 1;
              return `<td class="text-${align} ${isBold ? 'font-bold' : ''}">${cell}</td>`;
            }).join('')}
          </tr>
        `).join('') : `
          <tr><td colspan="${columns.length}" style="text-align:center;padding:16px;color:#64748b">දත්ත හමු නොවීය (No Records)</td></tr>
        `}
      </tbody>
    </table>

    <div class="footer-sigs">
      <div class="sig-col">
        <div>........................................</div>
        <b>සකස් කළේ (Prepared By)</b><br>
        <small>${esc(operatorName)}</small>
      </div>
      <div class="sig-col">
        <div>........................................</div>
        <b>පරීක්ෂා කළේ (Checked By)</b><br>
        <small>ගිණුම් අංශය / Accounts</small>
      </div>
      <div class="sig-col">
        <div>........................................</div>
        <b>අනුමත කළේ (Authorized By)</b><br>
        <small>පරිපාලක / Management</small>
      </div>
    </div>
  `;

  // Modal body preview
  const previewBody = `
    <div style="background:#0b1220;border:1px solid var(--line);border-radius:10px;padding:16px;max-height:68vh;overflow-y:auto">
      <div style="background:#ffffff;color:#0f172a;border-radius:8px;padding:20px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-family:'Inter',sans-serif">
        ${printableHtml}
      </div>
    </div>
  `;

  // Window references for action buttons
  window._activeReportPrintData = {
    html: printableHtml,
    title: title,
    landscape: landscape,
    filename: filename,
    columns: columns,
    rows: rows
  };

  const previewFooter = `
    <button type="button" class="btn" onclick="closeModal()">වසන්න (Close)</button>
    <button type="button" class="btn btn-secondary" onclick="exportActiveReportCSV()" style="display:flex;align-items:center;gap:6px">
      📥 Excel (CSV) බාගත
    </button>
    <button type="button" class="btn btn-primary" onclick="printActiveReportDocument()" style="display:flex;align-items:center;gap:6px;font-weight:700;padding:8px 18px;background:#2563eb;border-color:#2563eb">
      🖨️ PDF / මුද්‍රණය කරන්න (Print)
    </button>
  `;

  openModal('📊 වාර්තා පෙරදසුන (Report Preview)', title + (subtitle ? ` · ${subtitle}` : ''), previewBody, previewFooter, true);
}

function printActiveReportDocument(){
  if(window._activeReportPrintData){
    printReportHtml(window._activeReportPrintData.html, window._activeReportPrintData.title, window._activeReportPrintData.landscape);
  }
}

function exportActiveReportCSV(){
  if(window._activeReportPrintData){
    const d = window._activeReportPrintData;
    // Strip HTML tags from rows for clean CSV
    const cleanRows = (d.rows || []).map(r => 
      r.map(cell => String(cell || '').replace(/<[^>]*>/g, '').trim())
    );
    downloadCSV(d.filename, d.columns, cleanRows);
  }
}

window.printReportHtml = printReportHtml;
window.openPdfReportModal = openPdfReportModal;
window.printActiveReportDocument = printActiveReportDocument;
window.exportActiveReportCSV = exportActiveReportCSV;



