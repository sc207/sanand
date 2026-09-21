(function (global) {
  'use strict';
  const { esc, attr, money, num, icon, fmtDate, fmtDateLong, progressBar } = UI;

  /* The audit log's action, shown as a mark so the feed can be scanned
     down the left edge rather than read line by line. */
  const ACTIVITY_ICON = {
    create: 'plus', update: 'edit', delete: 'trash',
    cancel: 'close', payment: 'rupee',
  };

  /* sk's KPI card shape, with a line icon in place of the old emoji. */
  function kpi(title, value, meta, iconName, tone) {
    return `
      <div class="stat-card">
        <div class="stat-card-info">
          <span class="stat-card-title">${esc(title)}</span>
          <span class="stat-card-value">${esc(value)}</span>
          <span class="mg-muted-xs">${esc(meta)}</span>
        </div>
        <div class="stat-card-icon-wrapper ${attr(tone)}">${icon(iconName)}</div>
      </div>`;
  }

  async function render(host) {
    const d = await API.dashboard();
    const s = d.stats;

    const who = API.currentUser().name || 'Administrator';

    host.innerHTML = `
      <div class="welcome-banner">
        <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
          <linearGradient id="flameGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#FFF6DC"/><stop offset="45%" stop-color="#E6C978"/>
            <stop offset="100%" stop-color="#E88535"/>
          </linearGradient>
          <linearGradient id="lampGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#E6C978"/><stop offset="100%" stop-color="#C96A20"/>
          </linearGradient>
        </defs></svg>

        <svg class="banner-mandala banner-mandala-left" viewBox="0 0 200 200" aria-hidden="true">
          <g fill="none" stroke="#C9A24A" stroke-width="1">
            <circle cx="0" cy="100" r="120"/><circle cx="0" cy="100" r="98"/>
            <circle cx="0" cy="100" r="76"/><circle cx="0" cy="100" r="54"/>
            <g stroke-width="1.1">
              <path d="M0 100 m40 0 a20 20 0 0 1 34 -14 a20 20 0 0 1 -34 42 z"/>
              <path d="M0 40 q60 20 70 60 q-50 -10 -70 -60 z"/>
              <path d="M0 160 q60 -20 70 -60 q-50 10 -70 60 z"/>
              <path d="M0 100 q80 -50 108 0 q-28 50 -108 0 z"/>
            </g>
          </g>
        </svg>
        <svg class="banner-mandala banner-mandala-right" viewBox="0 0 200 200" aria-hidden="true">
          <g fill="none" stroke="#C9A24A" stroke-width="1">
            <circle cx="200" cy="100" r="120"/><circle cx="200" cy="100" r="98"/>
            <circle cx="200" cy="100" r="76"/><circle cx="200" cy="100" r="54"/>
            <g stroke-width="1.1">
              <path d="M200 40 q-60 20 -70 60 q50 -10 70 -60 z"/>
              <path d="M200 160 q-60 -20 -70 -60 q50 10 70 60 z"/>
              <path d="M200 100 q-80 -50 -108 0 q28 50 108 0 z"/>
            </g>
          </g>
        </svg>

        <div class="hanging-diya-container diya-left">
          <div class="hanging-diya">
            <div class="diya-string"></div>
            <svg class="diya-lamp" viewBox="0 0 60 70">
              <ellipse cx="30" cy="14" rx="7" ry="9" fill="url(#flameGrad)"/>
              <path d="M8 30 Q30 26 52 30 Q46 52 30 56 Q14 52 8 30 Z" fill="url(#lampGrad)"/>
              <path d="M4 30 Q30 22 56 30 Q30 38 4 30 Z" fill="#E6C978"/>
              <path d="M18 56 Q30 66 42 56" fill="none" stroke="#C9A24A" stroke-width="2"/>
            </svg>
          </div>
          <div class="hanging-diya" style="animation-delay:-2.2s">
            <div class="diya-string" style="height:64px"></div>
            <svg class="diya-lamp" viewBox="0 0 60 70" style="width:30px">
              <ellipse cx="30" cy="14" rx="6" ry="8" fill="url(#flameGrad)"/>
              <path d="M8 30 Q30 26 52 30 Q46 52 30 56 Q14 52 8 30 Z" fill="url(#lampGrad)"/>
              <path d="M4 30 Q30 22 56 30 Q30 38 4 30 Z" fill="#E6C978"/>
            </svg>
          </div>
        </div>
        <div class="hanging-diya-container diya-right">
          <div class="hanging-diya" style="animation-delay:-1.4s">
            <div class="diya-string" style="height:58px"></div>
            <svg class="diya-lamp" viewBox="0 0 60 70" style="width:30px">
              <ellipse cx="30" cy="14" rx="6" ry="8" fill="url(#flameGrad)"/>
              <path d="M8 30 Q30 26 52 30 Q46 52 30 56 Q14 52 8 30 Z" fill="url(#lampGrad)"/>
              <path d="M4 30 Q30 22 56 30 Q30 38 4 30 Z" fill="#E6C978"/>
            </svg>
          </div>
          <div class="hanging-diya" style="animation-delay:-3.1s">
            <div class="diya-string" style="height:88px"></div>
            <svg class="diya-lamp" viewBox="0 0 60 70">
              <ellipse cx="30" cy="14" rx="7" ry="9" fill="url(#flameGrad)"/>
              <path d="M8 30 Q30 26 52 30 Q46 52 30 56 Q14 52 8 30 Z" fill="url(#lampGrad)"/>
              <path d="M4 30 Q30 22 56 30 Q30 38 4 30 Z" fill="#E6C978"/>
              <path d="M18 56 Q30 66 42 56" fill="none" stroke="#C9A24A" stroke-width="2"/>
            </svg>
          </div>
        </div>

        <div class="banner-text-area">
          <h1 class="banner-title banner-headline">જય શ્રી વિહત મેલડી ધામ</h1>
          <div class="banner-flourish" aria-hidden="true">
            <svg viewBox="0 0 220 16" preserveAspectRatio="xMidYMid meet">
              <g fill="none" stroke="#C9A24A" stroke-width="1.4">
                <path d="M2 8 H78"/><path d="M142 8 H218"/>
                <path d="M96 8 q7 -7 14 0 q7 7 14 0"/>
              </g>
              <circle cx="110" cy="8" r="2.4" fill="#C96A20"/>
              <circle cx="82" cy="8" r="1.6" fill="#C9A24A"/><circle cx="138" cy="8" r="1.6" fill="#C9A24A"/>
            </svg>
          </div>
          <div class="banner-tagline">મૂર્તિ પ્રાણ પ્રતિષ્ઠા મહોત્સવ</div>
          <div class="banner-khamma">ખમ્મા માડી, ખમ્મા</div>
          <div class="banner-welcome-chip">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Jay Mataji, <strong>${esc(who)}</strong></span>
            <span class="banner-chip-dot"></span>
            <span>${esc(fmtDateLong(d.today))}</span>
          </div>
        </div>

        <div class="banner-mandir-graphic">
          <img src="/assets/temple.png" alt="Shri Vihat Meldi Dham"
               onerror="this.closest('.banner-mandir-graphic').style.display='none'">
        </div>
      </div>

      <div class="quick-actions-section">
        <div class="section-title">Quick add</div>
        <div class="quick-actions-grid">
          <button class="action-tile" data-quick="sevarthi">
            <span class="action-tile-icon">${icon('seat')}</span>
            <span class="action-tile-label">Add Sevarthi</span></button>
          <button class="action-tile" data-quick="payment">
            <span class="action-tile-icon">${icon('rupee')}</span>
            <span class="action-tile-label">Add Payment</span></button>
          <button class="action-tile" data-quick="samaj">
            <span class="action-tile-icon">${icon('users')}</span>
            <span class="action-tile-label">Add Samaj</span></button>
          <button class="action-tile" data-quick="category">
            <span class="action-tile-icon">${icon('plus')}</span>
            <span class="action-tile-label">Devotee Category</span></button>
        </div>
      </div>

      <div class="stats-grid">
        ${kpi('Received', money(s.received), money(s.receivedToday) + ' today', 'wallet', 'icon-donation-bg')}
        ${kpi('Outstanding', money(s.outstanding), num(s.pending) + ' sevarthi pending', 'clock', 'icon-events-bg')}
        ${kpi('Sevarthi', num(s.sevarthi), num(s.devotees) + ' devotees registered', 'user-check', 'icon-devotees-bg')}
        ${kpi("Bapa's Support", money(s.bappaSupport), num(s.bappaSupported) + ' sevarthi supported', 'diya', 'icon-diya-bg')}
        ${s.excess > 0
          ? kpi('Excess', money(s.excess), 'given above commitment', 'trending-up', 'icon-donation-bg')
          : ''}
      </div>

      <div class="section-title">Mahotsav Progress</div>
      <div class="seva-grid">
      ${d.categories.map((c) => {
        const seatText = c.seats === null
          ? `${num(c.registered)} registered` +
            (c.not_decided ? ` · ${num(c.not_decided)} awaiting a capacity decision` : ' · open seating')
          : `${num(c.booked)} / ${num(c.seats)} patla booked`;
        return `
        <button class="card cat-card" data-cat="${attr(c.key)}">
          <div class="card-body">
            <div class="cat-top">
              <span class="cat-ico">${icon(c.icon)}</span>
              <span style="flex:1;min-width:0">
                <span class="cat-name">${esc(c.label)}</span>
                <span class="cat-meta" style="display:block">${esc(seatText)}</span>
              </span>
              ${icon('chevron-right', 'ico-sm')}
            </div>
            <div class="progress-row">
              <span>${esc(money(c.received))} received</span>
              <span>${c.target ? 'target ' + esc(money(c.target)) : ''}</span>
            </div>
            ${/* No target means nothing to measure against — a full bar
                  there would read as "done" when nobody set a goal. */
              c.target > 0 ? progressBar(c.received, c.target, true) : ''}
          </div>
        </button>`;
      }).join('')}
      </div>

      ${d.todaySlots.length ? `
        <div class="section-title">Today at the mandir</div>
        <div class="card"><div class="card-body" style="padding:0"><div class="list">
          ${d.todaySlots.map((t) => `
            <div class="row-item" style="cursor:default">
              <div class="row-main">
                <div class="row-title">${esc(t.pooja_name)}</div>
                <div class="row-sub">${t.capacity === null
                  ? esc(num(t.booked_count)) + ' sevarthi'
                  : esc(num(t.booked_count) + ' of ' + num(t.capacity) + ' patla booked')}</div>
              </div>
              ${t.capacity !== null && t.booked_count >= t.capacity
                ? '<span class="badge badge-cancelled">Full</span>'
                : '<span class="badge badge-confirmed">Open</span>'}
            </div>`).join('')}
        </div></div></div>` : ''}

      <div class="section-title">Recent activity</div>
      <div class="card"><div class="card-body" style="padding:0">
        ${d.recentActivity.length ? `<div class="list">${d.recentActivity.map((a) => `
          <div class="row-item" style="cursor:default">
            <span class="ledger-avatar" aria-hidden="true">${icon(ACTIVITY_ICON[a.action] || 'history')}</span>
            <div class="row-main">
              <div class="row-title" style="font-weight:500;white-space:normal">${esc(a.summary)}</div>
              <div class="row-sub">${esc(a.user_name)} · <span title="${attr(a.created_at)}">${esc(UI.ago(a.created_at))}</span></div>
            </div>
          </div>`).join('')}</div>`
          : UI.empty('No activity yet', 'Entries will appear here as you add them.', 'history')}
      </div></div>`;

    host.querySelectorAll('[data-quick]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.getAttribute('data-quick');
        if (k === 'sevarthi') Forms.addSevarthi();
        if (k === 'payment') Forms.addPayment();
        if (k === 'samaj') Forms.addLookupSheet('samaj', 'Add Samaj');
        if (k === 'category') Forms.addLookupSheet('devotee_category', 'Add Devotee Category');
      }));

    host.querySelectorAll('[data-cat]').forEach((b) =>
      b.addEventListener('click', () => navigate('mahotsav', b.getAttribute('data-cat'))));
  }

  global.Pages = global.Pages || {};
  global.Pages.dashboard = { render };
})(window);
