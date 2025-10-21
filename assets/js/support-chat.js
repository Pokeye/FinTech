(function(){
    'use strict';
    // Lightweight client-only chatbot: rule-based responses + local history
    const HISTORY_KEY = 'd2c_support_history_v1';
    const TICKET_KEY = 'd2c_support_tickets_v1';

    function loadHistory(){ try{ const raw = localStorage.getItem(HISTORY_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; } }
    function saveHistory(arr){ try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(arr.slice(-100))); }catch(e){} }

    function loadTickets(){ try{ const raw = localStorage.getItem(TICKET_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; } }
    function saveTickets(arr){ try{ localStorage.setItem(TICKET_KEY, JSON.stringify(arr.slice(-200))); }catch(e){} }

    function appendMessage(who, text){
        const root = document.getElementById('d2c_support_messages'); if (!root) return;
        const wrapper = document.createElement('div'); wrapper.className = who === 'user' ? 'chat-message-right mb-3' : 'chat-message-left mb-3';
    const img = document.createElement('div'); img.innerHTML = who === 'user' ? '<img src="https://bootdey.com/img/Content/avatar/avatar1.png" class="rounded-circle mr-1" width="40" height="40" alt="You">' : '<img src="../assets/images/logo/logo.svg" class="rounded-circle mr-1" width="40" height="40" alt="FinTech Assistant">';
        const msg = document.createElement('div'); msg.className = who === 'user' ? 'flex-shrink-1 p-2 me-3 bg-primary text-white rounded' : 'flex-shrink-1 p-2 ms-3 border rounded';
        msg.textContent = text;
        wrapper.appendChild(img);
        wrapper.appendChild(msg);
        root.appendChild(wrapper);
        // scroll to bottom
        try{ root.parentElement.scrollTop = root.parentElement.scrollHeight; }catch(e){}
    }

    function ruleBotReply(text){
        const t = (text||'').toLowerCase();
        if (!t.trim()) return "Can you provide more details about your issue?";
        if (t.includes('password') || t.includes('reset')) return 'To reset your password, go to Settings → Account → Reset Password. If you don\'t receive an email, check your spam folder.';
        if (t.includes('email') || t.includes('mail')) return 'If you cannot access email, try clearing cookies and ensure your account is active. Contact admin if the problem persists.';
        if (t.includes('payment') || t.includes('card')) return 'Payment issues are often caused by card authorization. Verify card details and try again. If failures persist, check the transactions log.';
        if (t.includes('slow') || t.includes('performance')) return 'For slow performance, close background tabs and restart the browser. If this continues, please provide a HAR file for analysis.';
        if (t.includes('security') || t.includes('alert') || t.includes('cyber')) return 'We have a security dashboard under Monitoring → Cybersecurity. If this is an incident, please open a high-priority ticket.';
        // fallback
        return "Thanks — I\'ve logged your question. A human agent will respond shortly. Meanwhile, try searching our Help docs for 'reset' or 'troubleshoot'.";
    }

    // Remote AI wrapper: attempts to call a local/relative proxy endpoint first.
    // Fallback behavior: returns null on failure so caller can use rule-based reply.
    async function remoteAiQuery(message, opts){
        opts = opts || {};
        // Default relative proxy endpoint; production: use server-side proxy to protect keys.
        const proxyUrl = opts.proxyUrl || '/api/support/ai';
        const apiKey = opts.apiKey || '';
        const payload = { message };

        // Try calling proxy endpoint with a short timeout.
        let controller, id;
        try{
            controller = new AbortController();
            id = setTimeout(()=> controller.abort(), 8000);
            const headers = { 'Content-Type': 'application/json' };
            // If an API key is provided, send it in a header; note: this exposes the key to the server only.
            if (apiKey) headers['x-api-key'] = apiKey;
            const res = await fetch(proxyUrl, { method: 'POST', body: JSON.stringify(payload), headers, signal: controller.signal });
            clearTimeout(id);
            if (!res.ok) return null;
            const data = await res.json();
            // Expect { reply: '...' } from the proxy by convention
            if (data && typeof data.reply === 'string') return data.reply;
            if (data && typeof data.choices === 'object' && data.choices[0] && data.choices[0].text) return data.choices[0].text;
            return null;
        }catch(e){
            try{ clearTimeout(id); }catch(e){}
            return null;
        }
    }

    async function sendUserMessage(text){
        appendMessage('user', text);
        const hist = loadHistory(); hist.push({who:'user',text,ts:Date.now()}); saveHistory(hist);
        // show typing indicator
        appendMessage('bot','Typing...');

        // attempt remote AI if enabled
        const toggle = document.getElementById('d2c_remote_ai_toggle');
        const apiKeyField = document.getElementById('d2c_remote_api_key');
        const useRemote = toggle && toggle.checked;
        const apiKey = apiKeyField ? apiKeyField.value.trim() : '';

        let reply = null;
        if (useRemote){
            reply = await remoteAiQuery(text, { apiKey, proxyUrl: '/api/support/ai' });
        }

        // remove the last bot Typing... node
        const root = document.getElementById('d2c_support_messages'); if (!root) return;
        const nodes = Array.from(root.querySelectorAll('.chat-message-left, .chat-message-right'));
        const last = nodes[nodes.length-1]; if (last && last.textContent && last.textContent.indexOf('Typing')>-1){ last.remove(); }

        if (!reply){
            // fallback to local rule-based bot
            reply = ruleBotReply(text);
        }

        appendMessage('bot', reply);
        const hist2 = loadHistory(); hist2.push({who:'bot',text:reply,ts:Date.now()}); saveHistory(hist2);
    }

    function restoreHistory(){
        const hist = loadHistory(); if (!hist || !hist.length) return;
        hist.forEach(m=> appendMessage(m.who, m.text));
    }

    // Small helper to show a bootstrap-like toast in the support page
    function showToast(message, opts){
        opts = opts || {};
        const target = document.getElementById('d2c_support_toast'); if (!target) return;
        const id = 'd2c_toast_' + Date.now();
        const el = document.createElement('div');
        el.id = id;
        el.className = 'toast align-items-center text-white bg-primary border-0 p-2';
        el.setAttribute('role','status');
        el.setAttribute('aria-live','polite');
        el.innerHTML = '<div class="d-flex"><div class="toast-body">'+(message||'')+'</div><button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button></div>';
        target.appendChild(el);
        // close handler
        el.querySelector('.btn-close').addEventListener('click', function(){ el.remove(); });
        // auto remove
        setTimeout(()=>{ try{ el.remove(); }catch(e){} }, opts.timeout || 5000);
    }

    // Request a human agent: create a local ticket, show toast, optionally POST to a backend if available.
    async function requestHumanAgent(){
        const hist = loadHistory();
        const lastUser = [...hist].reverse().find(m=> m.who === 'user');
        const description = lastUser ? lastUser.text : 'User requested human assistance';
        const ticket = { id: 'T-'+Date.now(), status: 'open', priority: 'normal', description, createdAt: Date.now() };
        const tickets = loadTickets(); tickets.push(ticket); saveTickets(tickets);
        showToast('Human agent requested — ticket ' + ticket.id + ' created.');
        appendMessage('bot', 'Thanks — a human agent has been requested. Your ticket id is ' + ticket.id + '.');

        // If there's a server endpoint configured, post the ticket there. Provide an escape hatch via global var.
        try{
            const endpoint = (window.D2C_SUPPORT_TICKET_ENDPOINT || '').toString();
            if (endpoint){
                // send ticket; if server returns a 'warning' (e.g., persistence disabled), show it to the user
                fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(ticket) })
                .then(async (r)=>{
                    try{
                        const j = await r.json().catch(()=>null);
                        if (j && j.warning){ showToast('Notice: ' + j.warning, { timeout: 8000 }); }
                    }catch(e){}
                }).catch(()=>{
                    // silently ignore network failures but inform user via toast
                    showToast('Unable to contact support server. Ticket saved locally.');
                });
            }
        }catch(e){}
    }

    document.addEventListener('DOMContentLoaded', function(){
        restoreHistory();
        const input = document.getElementById('chatBox');
        const btn = document.getElementById('d2c_support_send');
        const reqBtn = document.getElementById('d2c_request_human');
        if (!input || !btn) return;
        btn.addEventListener('click', function(){ const v = input.value.trim(); if (!v) return; sendUserMessage(v); input.value=''; input.focus(); });
        input.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); btn.click(); } });
        if (reqBtn){ reqBtn.addEventListener('click', function(){ // confirm simple flow
            // disable button briefly to prevent spam
            reqBtn.disabled = true; requestHumanAgent().finally(()=>{ setTimeout(()=> reqBtn.disabled = false, 1200); });
        }); }
    });

    // expose for debugging
    window.d2cSupportChat = { sendUserMessage, loadHistory, saveHistory, loadTickets, saveTickets, requestHumanAgent };
})();
