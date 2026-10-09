/* =========================================================
   js/date-picker.js - Custom Date Picker (Day / Month / Year)
   Bilingual (Sinhala + English), Mobile Sheet & Desktop Modal
   ========================================================= */

(function(){
  function pad2(n){ return String(n).padStart(2, '0'); }

  function formatLocalDate(d){
    if(!(d instanceof Date) || isNaN(d)) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseInputDate(val){
    if(!val) return { mode: 'day', date: new Date() };
    if(val instanceof Date && !isNaN(val)) return { mode: 'day', date: val };

    const str = String(val).trim();
    const parts = str.split('-');
    if(parts.length === 3){
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d);
      return { mode: 'day', date: isNaN(dt) ? new Date() : dt };
    } else if(parts.length === 2){
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      return { mode: 'month', date: { year: y, month: m } };
    } else if(parts.length === 1 && /^\d{4}$/.test(parts[0])){
      const y = parseInt(parts[0], 10);
      return { mode: 'year', date: { year: y } };
    }
    return { mode: 'day', date: new Date() };
  }

  const DatePicker = {
    mode: 'day',
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(), // 0-11
    selected: null, // Date | {year, month} | {year}
    targetKey: null,
    onConfirm: null,
    minDate: null,
    maxDate: null,

    // Month names (Sinhala + English)
    months: [
      { si: 'ජනවාරි', en: 'January' },
      { si: 'පෙබරවාරි', en: 'February' },
      { si: 'මාර්තු', en: 'March' },
      { si: 'අප්‍රේල්', en: 'April' },
      { si: 'මැයි', en: 'May' },
      { si: 'ජූනි', en: 'June' },
      { si: 'ජූලි', en: 'July' },
      { si: 'අගෝස්තු', en: 'August' },
      { si: 'සැප්තැම්බර්', en: 'September' },
      { si: 'ඔක්තෝබර්', en: 'October' },
      { si: 'නොවැම්බර්', en: 'November' },
      { si: 'දෙසැම්බර්', en: 'December' }
    ],

    weekdays: ['ඉරි', 'සඳු', 'අඟ', 'බදා', 'බ්‍රහ', 'සිකු', 'සෙන'],

    ensureDOM(){
      if(document.getElementById('datePickerSheet')) return;

      const host = document.createElement('div');
      host.id = 'datePickerSlot';
      host.innerHTML = `
        <div class="date-picker-backdrop" id="datePickerBackdrop" onclick="closeDatePicker()"></div>
        <div class="date-picker-sheet" id="datePickerSheet" role="dialog" aria-modal="true" aria-label="Date Picker">
          <div class="dp-drag-handle"></div>
          <div class="dp-header">
            <h3>📅 දිනය තෝරන්න <small>Select Date</small></h3>
            <button type="button" class="dp-close" onclick="closeDatePicker()" aria-label="Close">✕</button>
          </div>
          <div class="dp-mode-tabs">
            <button type="button" class="dp-mode-tab active" data-mode="day" onclick="dpSetMode('day')">
              <span>📅</span>
              <span>දිනය</span>
              <small>Day</small>
            </button>
            <button type="button" class="dp-mode-tab" data-mode="month" onclick="dpSetMode('month')">
              <span>📆</span>
              <span>මාසය</span>
              <small>Month</small>
            </button>
            <button type="button" class="dp-mode-tab" data-mode="year" onclick="dpSetMode('year')">
              <span>🗓️</span>
              <span>වර්ෂය</span>
              <small>Year</small>
            </button>
          </div>
          <div class="dp-nav">
            <button type="button" class="dp-nav-btn" onclick="dpPrev()" aria-label="Previous">◀</button>
            <div class="dp-nav-title" id="dpNavTitle">October 2026</div>
            <button type="button" class="dp-nav-btn" onclick="dpNext()" aria-label="Next">▶</button>
          </div>
          <div class="dp-content" id="dpContent"></div>
          <div class="dp-presets">
            <button type="button" onclick="dpQuickSelect('today')">📅 අද</button>
            <button type="button" onclick="dpQuickSelect('yesterday')">⏪ ඊයේ</button>
            <button type="button" onclick="dpQuickSelect('thisWeek')">📆 මෙම සතිය</button>
            <button type="button" onclick="dpQuickSelect('thisMonth')">🗓️ මෙම මාසය</button>
            <button type="button" onclick="dpQuickSelect('thisYear')">📊 මෙම වර්ෂය</button>
          </div>
          <div class="dp-footer">
            <button type="button" class="btn" onclick="closeDatePicker()">අවලංගු</button>
            <button type="button" class="btn btn-primary" onclick="dpConfirm()">✅ තෝරන්න</button>
          </div>
        </div>`;
      document.body.appendChild(host);
    },

    open(targetKey, options = {}){
      this.ensureDOM();

      this.targetKey = targetKey;
      this.onConfirm = options.onConfirm || null;
      this.minDate = options.minDate ? new Date(options.minDate) : null;
      this.maxDate = options.maxDate ? new Date(options.maxDate) : null;

      const parsed = parseInputDate(options.value);
      this.mode = options.mode || parsed.mode || 'day';
      this.selected = parsed.date;

      let refDate = new Date();
      if(this.selected instanceof Date && !isNaN(this.selected)){
        refDate = this.selected;
      } else if(this.selected && typeof this.selected.year === 'number'){
        refDate = new Date(this.selected.year, this.selected.month || 0, 1);
      }
      this.viewYear = refDate.getFullYear();
      this.viewMonth = refDate.getMonth();

      // Open UI
      const backdrop = document.getElementById('datePickerBackdrop');
      const sheet = document.getElementById('datePickerSheet');
      if(backdrop) backdrop.classList.add('open');
      if(sheet) sheet.classList.add('open');
      document.body.style.overflow = 'hidden';

      // Update mode tabs
      document.querySelectorAll('.dp-mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === this.mode);
      });

      this.render();
    },

    close(){
      const backdrop = document.getElementById('datePickerBackdrop');
      const sheet = document.getElementById('datePickerSheet');
      if(backdrop) backdrop.classList.remove('open');
      if(sheet) sheet.classList.remove('open');
      document.body.style.overflow = '';
    },

    setMode(mode){
      this.mode = mode;
      document.querySelectorAll('.dp-mode-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.mode === mode);
      });
      this.render();
    },

    prev(){
      if(this.mode === 'day'){
        this.viewMonth--;
        if(this.viewMonth < 0){
          this.viewMonth = 11;
          this.viewYear--;
        }
      } else if(this.mode === 'month'){
        this.viewYear--;
      } else if(this.mode === 'year'){
        this.viewYear -= 10;
      }
      this.render();
    },

    next(){
      if(this.mode === 'day'){
        this.viewMonth++;
        if(this.viewMonth > 11){
          this.viewMonth = 0;
          this.viewYear++;
        }
      } else if(this.mode === 'month'){
        this.viewYear++;
      } else if(this.mode === 'year'){
        this.viewYear += 10;
      }
      this.render();
    },

    render(){
      const titleEl = document.getElementById('dpNavTitle');
      const contentEl = document.getElementById('dpContent');
      if(!titleEl || !contentEl) return;

      if(this.mode === 'day'){
        const monthMeta = this.months[this.viewMonth] || { si: '', en: '' };
        titleEl.textContent = `${monthMeta.si} (${monthMeta.en}) ${this.viewYear}`;
        contentEl.innerHTML = this.renderDayGrid();
      } else if(this.mode === 'month'){
        titleEl.textContent = `${this.viewYear}`;
        contentEl.innerHTML = this.renderMonthGrid();
      } else if(this.mode === 'year'){
        const start = Math.floor(this.viewYear / 10) * 10;
        titleEl.textContent = `${start} — ${start + 9}`;
        contentEl.innerHTML = this.renderYearGrid();
      }
    },

    renderDayGrid(){
      const year = this.viewYear;
      const month = this.viewMonth;
      const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInPrevMonth = new Date(year, month, 0).getDate();
      const todayStr = formatLocalDate(new Date());
      const selectedStr = (this.selected instanceof Date) ? formatLocalDate(this.selected) : null;

      let html = '<div class="dp-weekdays">';
      this.weekdays.forEach(d => { html += `<span>${d}</span>`; });
      html += '</div><div class="dp-days">';

      // Previous month trailing days
      for(let i = firstDay - 1; i >= 0; i--){
        const dayNum = daysInPrevMonth - i;
        html += `<button type="button" class="dp-day other-month" disabled>${dayNum}</button>`;
      }

      // Current month days
      for(let d = 1; d <= daysInMonth; d++){
        const dateObj = new Date(year, month, d);
        const dateStr = formatLocalDate(dateObj);
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedStr;

        let isDisabled = false;
        if(this.minDate && dateObj < this.minDate) isDisabled = true;
        if(this.maxDate && dateObj > this.maxDate) isDisabled = true;

        const cls = [
          'dp-day',
          isToday ? 'today' : '',
          isSelected ? 'selected' : ''
        ].filter(Boolean).join(' ');

        html += `<button type="button" class="${cls}" ${isDisabled ? 'disabled' : ''} onclick="dpPickDay(${year}, ${month}, ${d})">${d}</button>`;
      }

      // Next month leading days
      const totalCells = firstDay + daysInMonth;
      const remaining = (7 - (totalCells % 7)) % 7;
      for(let d = 1; d <= remaining; d++){
        html += `<button type="button" class="dp-day other-month" disabled>${d}</button>`;
      }

      html += '</div>';
      return html;
    },

    renderMonthGrid(){
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const selectedYear = (this.selected instanceof Date) ? this.selected.getFullYear() : this.selected?.year;
      const selectedMonth = (this.selected instanceof Date) ? this.selected.getMonth() : this.selected?.month;

      let html = '<div class="dp-months">';
      this.months.forEach((m, idx) => {
        const isCurrent = (this.viewYear === currentYear && idx === currentMonth);
        const isSelected = (this.viewYear === selectedYear && idx === selectedMonth);
        const cls = [
          'dp-month',
          isCurrent ? 'current' : '',
          isSelected ? 'selected' : ''
        ].filter(Boolean).join(' ');

        html += `<button type="button" class="${cls}" onclick="dpPickMonth(${this.viewYear}, ${idx})">
          ${m.si}<small>${m.en}</small>
        </button>`;
      });
      html += '</div>';
      return html;
    },

    renderYearGrid(){
      const start = Math.floor(this.viewYear / 10) * 10;
      const currentYear = new Date().getFullYear();
      const selectedYear = (this.selected instanceof Date) ? this.selected.getFullYear() : this.selected?.year;

      let html = '<div class="dp-years">';
      for(let i = 0; i < 10; i++){
        const y = start + i;
        const isCurrent = (y === currentYear);
        const isSelected = (y === selectedYear);
        const cls = [
          'dp-year',
          isCurrent ? 'current' : '',
          isSelected ? 'selected' : ''
        ].filter(Boolean).join(' ');

        html += `<button type="button" class="${cls}" onclick="dpPickYear(${y})">${y}</button>`;
      }
      html += '</div>';
      return html;
    },

    // Selection handlers
    pickDay(year, month, day){
      this.selected = new Date(year, month, day);
      this.render();
    },

    pickMonth(year, month){
      this.selected = { year, month };
      this.render();
    },

    pickYear(year){
      this.selected = { year };
      this.render();
    },

    quickSelect(type){
      const today = new Date();
      let from, to;

      switch(type){
        case 'today':
          from = new Date(today);
          to = new Date(today);
          this.mode = 'day';
          this.selected = from;
          this.viewYear = from.getFullYear();
          this.viewMonth = from.getMonth();
          break;
        case 'yesterday':
          from = new Date(today);
          from.setDate(today.getDate() - 1);
          to = new Date(from);
          this.mode = 'day';
          this.selected = from;
          this.viewYear = from.getFullYear();
          this.viewMonth = from.getMonth();
          break;
        case 'thisWeek':
          from = new Date(today);
          from.setDate(today.getDate() - today.getDay());
          to = new Date(today);
          this.mode = 'day';
          this.selected = to;
          this.viewYear = to.getFullYear();
          this.viewMonth = to.getMonth();
          break;
        case 'thisMonth':
          from = new Date(today.getFullYear(), today.getMonth(), 1);
          to = new Date(today);
          this.mode = 'month';
          this.selected = { year: today.getFullYear(), month: today.getMonth() };
          this.viewYear = today.getFullYear();
          this.viewMonth = today.getMonth();
          break;
        case 'thisYear':
          from = new Date(today.getFullYear(), 0, 1);
          to = new Date(today);
          this.mode = 'year';
          this.selected = { year: today.getFullYear() };
          this.viewYear = today.getFullYear();
          break;
        default:
          from = to = today;
      }

      this.confirmWithRange(from, to);
    },

    confirm(){
      if(!this.selected){
        if(typeof window.toast === 'function') window.toast('කරුණාකර දිනයක් තෝරන්න', 'err');
        return;
      }

      let result = '';
      if(this.mode === 'day'){
        if(this.selected instanceof Date){
          result = formatLocalDate(this.selected);
        } else {
          result = formatLocalDate(new Date(this.selected.year, this.selected.month || 0, 1));
        }
      } else if(this.mode === 'month'){
        if(this.selected instanceof Date){
          result = `${this.selected.getFullYear()}-${pad2(this.selected.getMonth() + 1)}`;
        } else {
          result = `${this.selected.year}-${pad2((this.selected.month || 0) + 1)}`;
        }
      } else if(this.mode === 'year'){
        if(this.selected instanceof Date){
          result = `${this.selected.getFullYear()}`;
        } else {
          result = `${this.selected.year}`;
        }
      }

      if(this.onConfirm){
        this.onConfirm(result);
      } else if(this.targetKey){
        const cap = this.targetKey.charAt(0).toUpperCase() + this.targetKey.slice(1);
        const labelEl = document.getElementById('date' + cap + 'Label');
        if(labelEl) labelEl.textContent = result;
      }

      this.close();
    },

    confirmWithRange(from, to){
      const fromStr = formatLocalDate(from);
      const toStr = formatLocalDate(to);

      if(this.onConfirm){
        this.onConfirm(fromStr, toStr);
      } else if(this.targetKey){
        const cap = this.targetKey.charAt(0).toUpperCase() + this.targetKey.slice(1);
        const labelEl = document.getElementById('date' + cap + 'Label');
        if(labelEl) labelEl.textContent = fromStr;
      }

      this.close();
    }
  };

  // Keyboard accessibility
  document.addEventListener('keydown', function(e){
    const sheet = document.getElementById('datePickerSheet');
    if(!sheet || !sheet.classList.contains('open')) return;

    if(e.key === 'Escape'){
      e.preventDefault();
      DatePicker.close();
    } else if(e.key === 'Enter' && e.target && !e.target.matches('button, input, select')){
      e.preventDefault();
      DatePicker.confirm();
    }
  });

  window.DatePicker = DatePicker;

  window.openDatePicker = function(targetKey, options){
    DatePicker.open(targetKey, options);
  };

  window.closeDatePicker = function(){
    DatePicker.close();
  };

  window.dpSetMode = function(mode){ DatePicker.setMode(mode); };
  window.dpPrev = function(){ DatePicker.prev(); };
  window.dpNext = function(){ DatePicker.next(); };
  window.dpPickDay = function(y, m, d){ DatePicker.pickDay(y, m, d); };
  window.dpPickMonth = function(y, m){ DatePicker.pickMonth(y, m); };
  window.dpPickYear = function(y){ DatePicker.pickYear(y); };
  window.dpQuickSelect = function(t){ DatePicker.quickSelect(t); };
  window.dpConfirm = function(){ DatePicker.confirm(); };
})();
