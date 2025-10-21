/* Lightweight AI Advisor (rule-based demo) */
(function () {
    'use strict';
    // Expose on window for debugging/testing
    const STORAGE_KEY = 'd2c_ai_advisor_cache';
    const MAX_ITEMS = 6;

    function computeSignals(stocks) {
        // stocks: [{symbol, price, changesPercentage}]
        if (!Array.isArray(stocks)) return [];
        return stocks.slice(0, MAX_ITEMS).map(s => {
            const change = parseFloat(s.changesPercentage || 0);
            let signal = 'HOLD';
            let score = 0;
            if (change >= 2) { signal = 'BUY'; score = Math.min(100, Math.round(change * 10)); }
            else if (change <= -2) { signal = 'SELL'; score = Math.min(100, Math.round(Math.abs(change) * 10)); }
            else { signal = 'HOLD'; score = Math.round((2 - Math.abs(change)) * 10); }
            return { symbol: s.symbol || s.ticker || '--', price: s.price || s.latestPrice || 0, change, signal, score };
        });
    }

    function render(list) {
        const $container = $('#d2c_ai_advisor');
        if (!$container.length) return;
        $container.empty();
        list.forEach(item => {
            const badgeClass = item.signal === 'BUY' ? 'bg-success' : item.signal === 'SELL' ? 'bg-danger' : 'bg-secondary';
            const li = `<li class="d-flex justify-content-between align-items-center py-1">
                <div><strong>${item.symbol}</strong> — <small class="text-muted">${item.price ? '$' + Number(item.price).toFixed(2) : 'n/a'}</small></div>
                <div class="text-end"><span class="badge ${badgeClass} text-light">${item.signal}</span> <small class="text-muted">${item.score}</small></div>
            </li>`;
            $container.append(li);
        });
    }

    function saveCache(list) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), list })); } catch (e) {}
    }

    function loadCache() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed.list) ? parsed.list : [];
        } catch (e) { return []; }
    }

    // Performance history (rolling)
    const PERF_KEY = 'd2c_ai_perf_history';
    const PERF_LIMIT = 12;

    function loadPerf() {
        try { const raw = localStorage.getItem(PERF_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
    }

    function savePerf(arr) { try { localStorage.setItem(PERF_KEY, JSON.stringify(arr.slice(-PERF_LIMIT))); } catch (e) {} }

    function pushPerf(value) {
        const arr = loadPerf(); arr.push({ ts: Date.now(), v: value }); savePerf(arr); return arr;
    }

    // Public API: accept raw stock objects (same shape used by main.js)
    window.d2cAIAdvisor = {
        analyze: function (stocks) {
            const list = computeSignals(stocks || []);
            render(list);
            saveCache(list);
            // derive a simple performance metric: average score
            const avg = list.length ? Math.round(list.reduce((s, x) => s + (x.score || 0), 0) / list.length) : 0;
            const hist = pushPerf(avg);
            // update visible performance value if present
            try { $('#d2c_ai_performance_value').text(avg ? avg + '%' : '--'); $('#d2c_ai_performance_timestamp').text((new Date()).toLocaleTimeString()); } catch (e) {}
            // if advisor chart exists, push series update
            try {
                if (window.d2cAdvisorChart && typeof window.d2cAdvisorChart.updateSeries === 'function') {
                    const series = hist.map(h => h.v);
                    // keep categories short
                    window.d2cAdvisorChart.updateOptions({ xaxis: { categories: hist.map(h => new Date(h.ts).toLocaleTimeString()) } });
                    window.d2cAdvisorChart.updateSeries([{ name: 'Advisor Alpha', data: series }]);
                }
            } catch (e) {
                console.warn('Failed to update advisor chart', e);
            }

            return list;
        },
        hydrate: function () { render(loadCache()); }
    };

    // Hydrate on DOM ready and wire Clear History button
    $(function () {
        window.d2cAIAdvisor.hydrate();
        // show confirmation modal when user clicks Clear history
        $('#d2c_ai_clear_history').on('click', function () {
            var modal = new bootstrap.Modal(document.getElementById('d2cClearAIHistoryModal'));
            modal.show();
        });

        // perform clear when user confirms in modal
        $('#d2c_ai_clear_history_confirm').on('click', function () {
            try {
                // snapshot current state so we can offer an Undo
                var backup = { perf: loadPerf(), cache: loadCache() };
                // remove stored data
                localStorage.removeItem(PERF_KEY);
                localStorage.removeItem(STORAGE_KEY);
                // reset UI
                $('#d2c_ai_performance_value').text('--');
                $('#d2c_ai_performance_timestamp').text('Awaiting signal…');
                $('#d2c_ai_advisor').empty();
                // reset chart if present
                if (window.d2cAdvisorChart && typeof window.d2cAdvisorChart.updateSeries === 'function') {
                    window.d2cAdvisorChart.updateSeries([{ name: 'Advisor Alpha', data: [0,0,0,0,0,0] }]);
                    window.d2cAdvisorChart.updateOptions({ xaxis: { categories: ['--','--','--','--','--','--'] } });
                }
                // hide modal
                var modalEl = document.getElementById('d2cClearAIHistoryModal');
                var bsModal = bootstrap.Modal.getInstance(modalEl);
                if (bsModal) bsModal.hide();

                // store backup on window temporarily and offer Undo via toast
                try {
                    var backupId = 'd2c_ai_undo_btn_' + Date.now();
                    window._d2c_ai_history_backup = backup;
                    // show toast with inline Undo button (showToast allows HTML in message)
                    showToast('AI history cleared <button id="' + backupId + '" class="btn btn-sm btn-light ms-2">Undo</button>', 'AI Advisor', 'success', 8000);

                    // attach click handler for the undo button after a short delay (toast is appended asynchronously)
                    setTimeout(function () {
                        var btn = document.getElementById(backupId);
                        if (!btn) return;
                        btn.addEventListener('click', function (ev) {
                            ev.preventDefault();
                            try {
                                var b = window._d2c_ai_history_backup;
                                if (!b) return;
                                // restore perf and cache
                                try { savePerf(Array.isArray(b.perf) ? b.perf : []); } catch (e) {}
                                try { saveCache(Array.isArray(b.cache) ? b.cache : []); } catch (e) {}
                                // restore UI
                                try { render(loadCache()); } catch (e) {}
                                try { var hist = loadPerf(); if (window.d2cAdvisorChart && typeof window.d2cAdvisorChart.updateSeries === 'function') { window.d2cAdvisorChart.updateSeries([{ name: 'Advisor Alpha', data: hist.map(h=>h.v) }]); window.d2cAdvisorChart.updateOptions({ xaxis: { categories: hist.map(h=>new Date(h.ts).toLocaleTimeString()) } }); } } catch (e) {}
                                // update performance display if possible
                                try { var list = loadCache(); var avg = list.length ? Math.round(list.reduce(function(s,x){return s+(x.score||0);},0)/list.length) : 0; $('#d2c_ai_performance_value').text(avg ? avg + '%' : '--'); $('#d2c_ai_performance_timestamp').text((new Date()).toLocaleTimeString()); } catch (e) {}

                                // clear backup
                                window._d2c_ai_history_backup = null;
                                // notify
                                showToast('AI history restored', 'AI Advisor', 'info', 3000);
                            } catch (e) {
                                console.warn('Failed to restore AI history', e);
                                showToast('Unable to restore AI history', 'AI Advisor', 'danger');
                            }
                        });
                    }, 50);

                    // expire the backup after the toast timeout + small buffer
                    setTimeout(function () { try { window._d2c_ai_history_backup = null; } catch (e) {} }, 8600);
                } catch (e) {
                    // fallback: simple success toast
                    showToast('AI history cleared', 'AI Advisor', 'success');
                    window._d2c_ai_history_backup = null;
                }

            } catch (e) {
                console.warn('Failed to clear AI history', e);
                showToast('Unable to clear AI history', 'AI Advisor', 'danger');
            }
        });
    });

})();
