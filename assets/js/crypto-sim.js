/* Simple Crypto Exchange Simulator (client-only, localStorage-backed) */
(function () {
    'use strict';
    const BAL_KEY = 'd2c_crypto_balances';
    const ORD_KEY = 'd2c_crypto_orders';

    function defaults() {
        return { USD: 10000, BTC: 0.25, ETH: 2 };
    }

    function getBalances() {
        try { const raw = localStorage.getItem(BAL_KEY); return raw ? JSON.parse(raw) : defaults(); } catch (e) { return defaults(); }
    }

    function saveBalances(b) { try { localStorage.setItem(BAL_KEY, JSON.stringify(b)); } catch (e) {} }

    function getOrders() { try { const raw = localStorage.getItem(ORD_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; } }

    function saveOrders(list) { try { localStorage.setItem(ORD_KEY, JSON.stringify(list)); } catch (e) {} }

    function placeOrder(side, symbol, size, price) {
        const balances = getBalances();
        const orders = getOrders();
        const cost = size * price;
        if (side === 'BUY') {
            if ((balances.USD || 0) < cost) { return { ok: false, reason: 'Insufficient USD balance' }; }
            balances.USD -= cost; balances[symbol] = (balances[symbol] || 0) + Number(size);
        } else {
            if ((balances[symbol] || 0) < size) { return { ok: false, reason: `Insufficient ${symbol} balance` }; }
            balances[symbol] -= size; balances.USD = (balances.USD || 0) + cost;
        }
        const order = { id: 'o_' + Date.now(), side, symbol, size, price, when: new Date().toISOString() };
        orders.unshift(order);
        saveBalances(balances); saveOrders(orders.slice(0, 50));
        return { ok: true, order, balances };
    }

    // Simple UI binder: Look for #d2c_crypto_simulator area and wire demo form inside
    function renderWidget() {
        const $root = $('#d2c_crypto_simulator');
        if (!$root.length) return;
        const balances = getBalances();
        const orders = getOrders();
        // derive a tiny mock order book from recent orders
        const bids = orders.filter(o=>o.side==='BUY').slice(0,3).map(o=>({price:o.price,size:o.size}));
        const asks = orders.filter(o=>o.side==='SELL').slice(0,3).map(o=>({price:o.price,size:o.size}));
        const bookHtml = `<div class="d-flex justify-content-between mb-2"><div><small class="text-muted">Bids</small><ul class="mb-0">${bids.length?bids.map(b=>`<li>$${Number(b.price).toFixed(2)} × ${b.size}</li>`).join(''):'<li class="text-muted">—</li>'}</ul></div><div><small class="text-muted">Asks</small><ul class="mb-0">${asks.length?asks.map(a=>`<li>$${Number(a.price).toFixed(2)} × ${a.size}</li>`).join(''):'<li class="text-muted">—</li>'}</ul></div></div>`;
        const balancesHtml = `<ul class="list-unstyled mb-2"><li>USD: $${Number(balances.USD||0).toFixed(2)}</li><li>BTC: ${Number(balances.BTC||0).toFixed(6)}</li><li>ETH: ${Number(balances.ETH||0).toFixed(6)}</li></ul>`;
        const ordersHtml = orders.length ? orders.slice(0,6).map(o=>`<li>${o.when.split('T')[0]} ${o.side} ${o.size} ${o.symbol} @ $${Number(o.price).toFixed(2)}</li>`).join('') : '<li class="text-muted">No trades yet</li>';
    const html = `<div class="p-3"><h5>Balances</h5>${balancesHtml}${bookHtml}<hr/><h5>Place Order (demo)</h5>
            <div class="d-flex gap-2 mb-2"><select id="d2c_cs_side" class="form-select form-select-sm" aria-label="Order side"><option value="BUY">BUY</option><option value="SELL">SELL</option></select>
            <select id="d2c_cs_symbol" class="form-select form-select-sm" aria-label="Order symbol"><option>BTC</option><option>ETH</option></select>
            <input id="d2c_cs_size" type="number" step="0.0001" class="form-control form-control-sm" placeholder="size" aria-label="Order size" /></div>
            <div class="input-group mb-2"><input id="d2c_cs_price" class="form-control form-control-sm" placeholder="price (USD)" aria-label="Order price" /><button id="d2c_cs_market" class="btn btn-sm btn-outline-secondary" aria-label="Set market price">Market</button></div>
            <div class="d-flex gap-2"><button id="d2c_cs_place" class="btn btn-sm btn-primary">Place Order</button><button id="d2c_cs_reset" class="btn btn-sm btn-outline-secondary">Reset Demo</button></div>
            <hr/><h5>Recent Trades</h5><ul class="mb-0">${ordersHtml}</ul></div>`;
        $root.html(html);

        $('#d2c_cs_place').on('click', function () {
            const side = $('#d2c_cs_side').val();
            const symbol = $('#d2c_cs_symbol').val();
            const size = parseFloat($('#d2c_cs_size').val()) || 0;
            const price = parseFloat($('#d2c_cs_price').val()) || 0;
            if (!size || !price) { showToast('Enter size and price', 'Simulator', 'warning'); return; }
            const res = placeOrder(side, symbol, size, price);
            if (!res.ok) { showToast(res.reason || 'Order failed', 'Simulator', 'danger'); }
            else { showToast('Order placed (demo)', 'Simulator', 'success'); }
            renderWidget();
        });

        $('#d2c_cs_market').on('click', function () {
            // quick-set market price to a simple midpoint of last orders or a heuristic
            const lastBuy = orders.find(o=>o.side==='BUY');
            const lastSell = orders.find(o=>o.side==='SELL');
            let price = 0;
            if (lastBuy && lastSell) price = (lastBuy.price + lastSell.price) / 2;
            else if (lastBuy) price = lastBuy.price;
            else if (lastSell) price = lastSell.price;
            if (!price) price = symbolDefaultPrice($('#d2c_cs_symbol').val());
            $('#d2c_cs_price').val(Number(price).toFixed(2));
            showToast('Market price set', 'Simulator', 'info', 1800);
        });

        $('#d2c_cs_reset').on('click', function () { localStorage.removeItem(BAL_KEY); localStorage.removeItem(ORD_KEY); renderWidget(); showToast('Demo reset', 'Simulator', 'info'); });
    }

    // rely on global showToast defined in main.js
    window.d2cCryptoSim = { placeOrder, getBalances, getOrders, renderWidget };

    $(function () { renderWidget(); });

})();
