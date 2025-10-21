/* Demo Cybersecurity Alerts (client-only mock SIEM)
   - Generates random alerts (severity, message, timestamp)
   - Persists alerts and acknowledged/dismissed state to localStorage
   - Provides acknowledge/dismiss actions and bulk controls
*/
(function(){
    'use strict';
    const KEY = 'd2c_cyber_alerts';
    const MAX = 20;

    function sampleMessages(){
        return [
            'Suspicious login from new IP',
            'Multiple failed MFA attempts',
            'Unusual outbound traffic spike',
            'Possible credential stuffing activity',
            'New device enrolled for admin account',
            'Anomalous process execution on finance server',
            'Data exfiltration pattern detected',
            'TLS certificate expired on gateway',
            'High number of 401 responses on API',
            'Privileged role granted outside change window'
        ];
    }

    function load(){ try{ const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; } }
    function save(arr){ try{ localStorage.setItem(KEY, JSON.stringify(arr.slice(0,MAX))); }catch(e){} }

    function genAlert(){
        const msgs = sampleMessages();
        const sevRoll = Math.random();
        const severity = sevRoll > 0.85 ? 'Critical' : sevRoll > 0.6 ? 'High' : sevRoll > 0.3 ? 'Medium' : 'Low';
        const id = 'ca_' + Date.now() + '_' + Math.floor(Math.random()*1000);
        const text = msgs[Math.floor(Math.random()*msgs.length)];
        return { id, severity, text, ts: Date.now(), ack: false, dismissed: false };
    }

    // current UI state
    let _ca_filter = 'all';
    let _ca_showHistory = false;

    function render(){
        const root = document.getElementById('d2c_cyber_alerts');
        if (!root) return;
        let alerts = load();
        if (!_ca_showHistory) alerts = alerts.filter(a=>!a.dismissed);
        if (_ca_filter !== 'all') alerts = alerts.filter(a=>a.severity === _ca_filter);
        root.innerHTML = '';
        if (!alerts.length){ root.innerHTML = '<p class="text-muted">No alerts</p>'; return; }
        const ul = document.createElement('ul'); ul.className='list-unstyled mb-0';
        alerts.forEach(a=>{
            const li = document.createElement('li'); li.className='border rounded p-2 mb-2 d-flex justify-content-between align-items-start';
            li.tabIndex = 0; // make focusable
            li.setAttribute('role','button');
            li.dataset.alertId = a.id;
            const left = document.createElement('div');
            left.innerHTML = `<div><strong class="me-2">${a.severity}</strong><small class="text-muted">${new Date(a.ts).toLocaleString()}</small></div><div class="mt-1">${a.text}</div>`;
            const badgeClass = a.severity === 'Critical' ? 'ca-badge-critical' : a.severity === 'High' ? 'ca-badge-high' : a.severity === 'Medium' ? 'ca-badge-medium' : 'ca-badge-low';
            const badge = document.createElement('span'); badge.className = 'ca-badge ' + badgeClass; badge.textContent = a.severity;
            left.prepend(badge);

            const actions = document.createElement('div'); actions.className='text-end';
            const ackBtn = document.createElement('button'); ackBtn.className = 'btn btn-sm ' + (a.ack? 'btn-outline-success' : 'btn-outline-warning'); ackBtn.textContent = a.ack? 'Acknowledged':'Acknowledge';
            ackBtn.setAttribute('aria-label', a.ack? 'Unacknowledge alert' : 'Acknowledge alert');
            ackBtn.addEventListener('click', function(ev){ ev.stopPropagation(); toggleAck(a.id); });
            const dismissBtn = document.createElement('button'); dismissBtn.className='btn btn-sm btn-outline-danger ms-2'; dismissBtn.textContent='Dismiss';
            dismissBtn.setAttribute('aria-label','Dismiss alert');
            dismissBtn.addEventListener('click', function(ev){ ev.stopPropagation(); dismiss(a.id); });
            actions.appendChild(ackBtn); actions.appendChild(dismissBtn);
            li.appendChild(left); li.appendChild(actions);
            // open detail modal on click/keyboard
            li.addEventListener('click', function(){ openDetailModal(a.id); });
            li.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetailModal(a.id); } });
            ul.appendChild(li);
        });
        root.appendChild(ul);
        // keep notification menu in sync with active alerts
        try{ updateNotificationMenu(); }catch(e){}
        try{ applyPulseOnCritical(); }catch(e){}
    }

    // sync alerts into the top-right notifications dropdown and update bell badge
    function updateNotificationMenu(){
        try{
            const bell = document.querySelector('a[aria-label="Open notifications"]');
            if (!bell) return;
            // the small badge span inside the bell anchor
            const badgeSpan = bell.querySelector('span');
            const menu = bell.parentElement ? bell.parentElement.querySelector('.dropdown-list.dropdown-menu') : null;
            const alerts = load().filter(a=>!a.dismissed);
            const count = alerts.length;
            if (badgeSpan){
                // show numeric badge when there are alerts
                badgeSpan.classList.remove('bg-secondary');
                badgeSpan.classList.add(count? 'bg-danger':'bg-secondary');
                badgeSpan.setAttribute('aria-hidden','false');
                badgeSpan.textContent = count? String(count) : '';
                badgeSpan.style.minWidth = '1.25rem';
                badgeSpan.style.height = '1.25rem';
                badgeSpan.style.display = 'inline-block';
                badgeSpan.style.lineHeight = '1.25rem';
                badgeSpan.style.textAlign = 'center';
                badgeSpan.style.color = '#fff';
                badgeSpan.style.fontSize = '0.65rem';
                badgeSpan.style.borderRadius = '50%';
            }
            if (!menu) return;
            // remove previously injected cyber alert items (we mark them with data-ca-injected)
            Array.from(menu.querySelectorAll('[data-ca-injected]')).forEach(n=>n.remove());
            if (!alerts.length) return;
            // insert top 3 active alerts at the top of the dropdown (after header)
            const frag = document.createDocumentFragment();
            alerts.slice(0,3).forEach(a=>{
                const link = document.createElement('a');
                link.className = 'dropdown-item d-flex align-items-center';
                link.href = '#';
                link.dataset.caInjected = '1';
                link.dataset.alertId = a.id;
                const time = new Date(a.ts).toLocaleTimeString();
                link.innerHTML = `<div class="text-truncate d-block"><p class="mb-0"><small class="text-muted">${time}</small></p><h6 class="mb-0">${a.text}</h6></div>`;
                link.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); try{ openDetailModal(this.dataset.alertId); }catch(e){} });
                frag.appendChild(link);
            });
            // add a divider and "View all security alerts" link
            const divider = document.createElement('hr'); divider.className='dropdown-divider'; divider.dataset.caInjected = '1';
            const viewAll = document.createElement('a');
            viewAll.className = 'dropdown-item text-center small text-gray-500 py-2';
            viewAll.href = './pages/elements/notification.html';
            viewAll.textContent = 'View all security alerts';
            viewAll.dataset.caInjected = '1';
            frag.appendChild(divider);
            frag.appendChild(viewAll);
            // find header and insert after it
            const header = menu.querySelector('.dropdown-header');
            if (header) header.parentNode.insertBefore(frag, header.nextSibling);
            else menu.insertBefore(frag, menu.firstChild);
        }catch(e){ /* fail silently */ }
    }

    // apply a short pulse animation to the bell anchor when a Critical alert is present
    function applyPulseOnCritical(){
        try{
            const bell = document.querySelector('a[aria-label="Open notifications"]');
            if (!bell) return;
            const hasCritical = load().some(a=>!a.dismissed && a.severity === 'Critical');
            if (hasCritical) bell.classList.add('d2c-bell-pulse'); else bell.classList.remove('d2c-bell-pulse');
        }catch(e){}
    }

    function announce(text){
        try{
            let container = document.getElementById('d2c_ca_live_region');
            if (!container){ container = document.createElement('div'); container.id = 'd2c_ca_live_region'; container.className='visually-hidden'; container.setAttribute('aria-live','polite'); document.body.appendChild(container); }
            container.textContent = text;
            // clear after a short delay
            setTimeout(()=>{ try{ container.textContent = ''; }catch(e){} }, 3000);
        }catch(e){}
    }

        function renderHistory(){
            _ca_showHistory = true; render();
        }

        function renderActive(){
            _ca_showHistory = false; render();
        }

    function toggleAck(id){
        const arr = load();
        const idx = arr.findIndex(x=>x.id===id); if (idx===-1) return;
        arr[idx].ack = !arr[idx].ack; save(arr); render();
        showToast(arr[idx].ack? 'Alert acknowledged' : 'Alert unacknowledged', 'Cyber Alerts', 'info', 2500);
    }

    function dismiss(id){
        const arr = load();
        const idx = arr.findIndex(x=>x.id===id); if (idx===-1) return;
        arr[idx].dismissed = true; save(arr); render();
        showToast('Alert dismissed', 'Cyber Alerts', 'info', 2500);
    }

    // bulk ack
    function ackAll(){ const arr = load(); arr.forEach(a=>{ if(!a.dismissed) a.ack=true; }); save(arr); render(); showToast('All alerts acknowledged', 'Cyber Alerts', 'success', 2200); }
    function clearDismissed(){ let arr=load(); arr = arr.filter(a=>!a.dismissed); save(arr); render(); showToast('Cleared dismissed alerts', 'Cyber Alerts', 'info', 1800); }

    // seed and periodic generator
    function seed(){ const arr = load(); if (!arr.length){ for (let i=0;i<3;i++) arr.push(genAlert()); save(arr); } }

    // open detail modal and populate
    function openDetailModal(id){
        const arr = load(); const a = arr.find(x=>x.id===id); if (!a) return;
        const body = document.getElementById('d2c_alert_detail_body');
        if (body) {
            body.innerHTML = `<p><strong>Severity:</strong> ${a.severity}</p><p><strong>Time:</strong> ${new Date(a.ts).toLocaleString()}</p><p><strong>Alert:</strong> ${a.text}</p><p><small class="text-muted">ID: ${a.id}</small></p>`;
        }
                        // set dataset for modal buttons
        const ackBtn = document.getElementById('d2c_alert_detail_ack');
        const disBtn = document.getElementById('d2c_alert_detail_dismiss');
        if (ackBtn) { ackBtn.dataset.alertId = id; }
        if (disBtn) { disBtn.dataset.alertId = id; }
                try { const modalEl = document.getElementById('d2cAlertDetailModal');
                            // set aria-describedby to the detail body id
                            const body = document.getElementById('d2c_alert_detail_body'); if (body) { body.id = 'd2c_alert_detail_body'; modalEl.setAttribute('aria-describedby', 'd2c_alert_detail_body'); }
                            const modal = new bootstrap.Modal(modalEl); modal.show(); } catch(e){}
    }

    // modal button handlers
    document.addEventListener('DOMContentLoaded', function(){
        const ackBtn = document.getElementById('d2c_alert_detail_ack');
        const disBtn = document.getElementById('d2c_alert_detail_dismiss');
    if (ackBtn) ackBtn.addEventListener('click', function(){ const id = this.dataset.alertId; if (id) { toggleAck(id); var modalEl = document.getElementById('d2cAlertDetailModal'); var bs = bootstrap.Modal.getInstance(modalEl); if (bs) bs.hide(); } });
    if (disBtn) disBtn.addEventListener('click', function(){ const id = this.dataset.alertId; if (id) { dismiss(id); var modalEl = document.getElementById('d2cAlertDetailModal'); var bs = bootstrap.Modal.getInstance(modalEl); if (bs) bs.hide(); } });
    });

    // expose helper for tests
    window.d2cCyberAlerts = { seed, genAlert, load };

    // wire UI controls
    document.addEventListener('DOMContentLoaded', function(){
        seed(); render();
        try{ updateNotificationMenu(); }catch(e){}
        try{ applyPulseOnCritical(); }catch(e){}
    // periodic new alert (demo) every 45-90s randomly
    setInterval(function(){ if (Math.random() < 0.45) { const a = genAlert(); const arr = load(); arr.unshift(a); save(arr); render(); try{ updateNotificationMenu(); }catch(e){}; try{ applyPulseOnCritical(); }catch(e){}; showToast('New security alert', 'Cyber Alerts', 'warning', 2400); announce('New security alert: ' + a.severity + ' — ' + a.text); } }, 45000 + Math.floor(Math.random()*45000));
        const ackAllBtn = document.getElementById('d2c_ca_ack_all'); if (ackAllBtn) ackAllBtn.addEventListener('click', ackAll);
        const clearBtn = document.getElementById('d2c_ca_clear_dismissed'); if (clearBtn) clearBtn.addEventListener('click', clearDismissed);
        const filter = document.getElementById('d2c_ca_filter'); if (filter) filter.addEventListener('change', function(){ _ca_filter = this.value; render(); });
        const histToggle = document.getElementById('d2c_ca_history_toggle'); if (histToggle) histToggle.addEventListener('click', function(){ _ca_showHistory = !_ca_showHistory; this.setAttribute('aria-pressed', _ca_showHistory? 'true':'false'); render(); });
    });
})();
