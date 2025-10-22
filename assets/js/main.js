"use strict";

// Function to toggle themes smoothly
function toggleTheme(isDark) {
	const themeClass = isDark ? "d2c_theme_dark" : "d2c_theme_light";

	$("body").addClass(themeClass);
	setTimeout(() => {
		$("body").removeClass(
			themeClass === "d2c_theme_dark"
				? "d2c_theme_light"
				: "d2c_theme_dark"
		);
	}, 500);
	localStorage.setItem("theme", themeClass);
}

const themePreference = localStorage.getItem("theme");
if (themePreference === "d2c_theme_dark") {
	toggleTheme(true);
	$("#d2c_theme_changer").prop("checked", true);
} else {
	toggleTheme(false);
	$("#d2c_theme_changer").prop("checked", false);
}

$("#d2c_theme_changer").change(function () {
	toggleTheme($(this).prop("checked"));
	localStorage.setItem("themeSwitch", $(this).prop("checked"));
	// Password visibility toggle (works for input-group-text[data-password] and button addons)
	$(document).on('click', '.input-group-text[data-password], button[id^="button-addon"]', function (e) {
		e.preventDefault();
		const $btn = $(this);
		const $group = $btn.closest('.input-group');
		let $input = $group.find('input').filter(function () {
			const t = $(this).attr('type');
			return t === 'password' || t === 'text';
		}).first();

		// Fallback: some templates use aria-describedby on the input pointing to the button id
		if (!$input || !$input.length) {
			const btnId = $btn.attr('id');
			if (btnId) {
				$input = $(`input[aria-describedby="${btnId}"]`).first();
			}
		}

		if (!$input || !$input.length) return;

		const isPassword = $input.attr('type') === 'password';
		try {
			$input.attr('type', isPassword ? 'text' : 'password');
		} catch (err) {
			// Some older browsers may not allow changing type; create replacement input as fallback
			const $newInput = $input.clone().attr('type', isPassword ? 'text' : 'password');
			$input.replaceWith($newInput);
			$input = $newInput;
		}

		const $icon = $btn.find('i');
		if ($icon.length) {
			// Keep any style prefix (fa, far, fas) and only toggle the specific icon classes
			$icon.toggleClass('fa-eye');
			$icon.toggleClass('fa-eye-slash');
		}

		if ($btn.is('[data-password]')) {
			$btn.attr('data-password', isPassword ? 'true' : 'false');
		}
	});

});

// Preloader
window.onload = function () {
	var $preloader = $(".preloader");
	$preloader.delay(800).fadeOut(200, function () {
		$(".d2c_wrapper").addClass("show");
	});
};
(() => {
	"use strict";
	const forms = document.querySelectorAll(".form-validation");

	Array.from(forms).forEach((form) => {
		form.addEventListener(
			"submit",
			(event) => {
				if (!form.checkValidity()) {
					event.preventDefault();
					event.stopPropagation();
				}

				form.classList.add("was-validated");
			},
			false
		);
	});
})();

// Lightweight interactions for new FinTech widgets
$(function () {
	const $ticker = $("#d2c_live_ticker");
	const $tickerTimestamp = $("#d2c_live_ticker_timestamp");
	const TICKER_STORAGE_KEY = "fintech_live_ticker_cache";
	const TICKER_STORAGE_TTL = 600000; // 10 minutes
	const LIVE_MARKET_ENDPOINT =
		"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=6&page=1&price_change_percentage=24h";
	const LIVE_REFRESH_MS = 20000;
	const priceFormatter = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 2,
	});

	const $stockTableBody = $("[data-stock-table-body]");
	const $stockTimestamp = $("#d2c_stock_timestamp");
	const $stockIndex = $("#d2c_stock_index");
	// Allow runtime configuration for stock API key and symbols.
	const D2C_CONFIG = window.d2cConfig || {};
	const STOCK_SYMBOLS = Array.isArray(D2C_CONFIG.stockSymbols) && D2C_CONFIG.stockSymbols.length ? D2C_CONFIG.stockSymbols : ["AAPL", "MSFT", "NVDA"];
	const STOCK_REFRESH_MS = D2C_CONFIG.stockRefreshMs || 30000;

	function getStockApiKey() {
		return D2C_CONFIG.stockApiKey || localStorage.getItem('FMP_API_KEY') || '';
	}

	function buildStockEndpoint() {
		const key = getStockApiKey();
		const syms = STOCK_SYMBOLS.join(',');
		// Use demo key if none provided — demo is rate-limited but works for development.
		return `https://financialmodelingprep.com/api/v3/quote/${syms}?apikey=${key || 'demo'}`;
	}
	const STOCK_STORAGE_KEY = "fintech_stock_cache";
	const STOCK_STORAGE_TTL = 600000; // 10 minutes
	const AI_HISTORY_KEY = "fintech_ai_performance_history";
	const AI_HISTORY_LIMIT = 12;
	const $aiPerformanceValue = $("#d2c_ai_performance_value");
	const $aiPerformanceTimestamp = $("#d2c_ai_performance_timestamp");

	async function fetchLiveMarketData() {
		if (!$ticker.length) {
			return;
		}
		try {
			if (!$ticker.data("isLoaded")) {
				$ticker.html('<span class="text-muted">Loading live market data…</span>');
			}
			const response = await fetch(LIVE_MARKET_ENDPOINT, {
				cache: "no-cache",
				headers: { accept: "application/json" },
			});
			if (!response.ok) {
				throw new Error(`Live market request failed with status ${response.status}`);
			}
			const assets = await response.json();
			if (!Array.isArray(assets) || !assets.length) {
				throw new Error("No market data returned");
			}
			renderTicker(assets.slice(0, 6));
			$ticker.data("isLoaded", true);
			if ($tickerTimestamp.length) {
				const now = new Date();
				$tickerTimestamp.text(`Updated ${now.toLocaleTimeString()}`);
			}
			cacheTickerData(assets);
		} catch (error) {
			console.error("Live market feed error", error);
			$ticker.removeData("isLoaded");
			if ($tickerTimestamp.length) {
				$tickerTimestamp.text("Demo data (retrying live feed…)");
			}
			injectFallbackTicker();
		}
	}

	function cacheTickerData(assets) {
		try {
			const payload = {
				timestamp: Date.now(),
				assets: assets.slice(0, 6),
			};
			localStorage.setItem(TICKER_STORAGE_KEY, JSON.stringify(payload));
		} catch (error) {
			console.warn("Unable to cache ticker data", error);
		}
	}

	function renderTicker(assets) {
		const fragment = document.createDocumentFragment();
		assets.forEach((asset) => {
			const symbol = (asset.symbol || asset.id || "N/A").toUpperCase();
			const price = parseFloat(asset.current_price ?? asset.priceUsd ?? "0");
			const change = parseFloat(
				asset.price_change_percentage_24h_in_currency ??
					asset.price_change_percentage_24h ??
					asset.changePercent24Hr ??
					"0"
			);
			const item = document.createElement("div");
			item.className = "d-flex align-items-center gap-2 ticker-item";
			item.innerHTML = `
				<span class="fw-semibold">${symbol}</span>
				<span class="${change >= 0 ? "text-success" : "text-danger"}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</span>
				<span class="text-muted">${priceFormatter.format(price)}</span>
			`;
			fragment.appendChild(item);
		});
		$ticker.empty().append(fragment);
		syncCryptoSimulatorFromAssets(assets);
		syncAiAdvisorFromAssets(assets);
		updateAiPerformanceMetrics(assets);
	}

	function injectFallbackTicker() {
		if (!$ticker.length) return;
		const demoAssets = [
			{ id: "apple", symbol: "AAPL", current_price: 224.18, price_change_percentage_24h: 1.12 },
			{ id: "nvidia", symbol: "NVDA", current_price: 1094.66, price_change_percentage_24h: -0.54 },
			{ id: "microsoft", symbol: "MSFT", current_price: 352.94, price_change_percentage_24h: 0.86 },
			{ id: "bitcoin", symbol: "BTC", current_price: 67540.0, price_change_percentage_24h: 2.48 },
			{ id: "ethereum", symbol: "ETH", current_price: 3482.0, price_change_percentage_24h: 1.73 },
			{ id: "solana", symbol: "SOL", current_price: 161.42, price_change_percentage_24h: 0.92 },
		];
		renderTicker(demoAssets);
	}

	// Small in-page toast helper (Bootstrap toast)
	function showToast(message, title = 'Notice', variant = 'info', timeout = 4000) {
		try {
			const id = `d2c_toast_${Date.now()}`;
			const container = document.getElementById('d2c_toast_container');
			if (!container) return;
			const toastEl = document.createElement('div');
			toastEl.className = 'toast align-items-center text-bg-' + (variant === 'info' ? 'secondary' : variant) + ' border-0';
			toastEl.role = 'alert';
			toastEl.ariaLive = 'assertive';
			toastEl.ariaAtomic = 'true';
			toastEl.id = id;
			toastEl.innerHTML = `
				<div class="d-flex">
					<div class="toast-body">${message}</div>
					<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
				</div>
			`;
			container.appendChild(toastEl);
			const bsToast = new bootstrap.Toast(toastEl, { delay: timeout });
			bsToast.show();
			// remove from DOM after hidden
			toastEl.addEventListener('hidden.bs.toast', () => {
				try { toastEl.remove(); } catch (e) {}
			});
		} catch (e) {
			console.warn('Unable to show toast', e);
		}
	}

	hydrateAiPerformanceHistory();

	window.addEventListener("d2cAdvisorChartReady", () => {
		const history = loadAiPerformanceHistory();
		renderAiPerformance(history);
	});

	if ($ticker.length) {
		hydrateTickerFromCache();
		fetchLiveMarketData();
		setInterval(fetchLiveMarketData, LIVE_REFRESH_MS);
		const $refreshButton = $("#d2c_live_ticker_refresh");
		if ($refreshButton.length) {
			$refreshButton.on("click", async function () {
				const originalText = $refreshButton.text();
				$refreshButton.prop("disabled", true).text("Refreshing…");
				await fetchLiveMarketData();
				$refreshButton.prop("disabled", false).text(originalText);
			});
		}
	}

	if ($stockTableBody.length) {
		hydrateStockTracker();
		fetchStockData();
		setInterval(fetchStockData, STOCK_REFRESH_MS);
		const $stockRefreshBtn = $("#d2c_stock_refresh");
		if ($stockRefreshBtn.length) {
			$stockRefreshBtn.on("click", async function () {
				const originalText = $stockRefreshBtn.text();
				$stockRefreshBtn.prop("disabled", true).text("Refreshing…");
				await fetchStockData();
				$stockRefreshBtn.prop("disabled", false).text(originalText);
			});
		}
	}

	function hydrateTickerFromCache() {
		try {
			const cache = localStorage.getItem(TICKER_STORAGE_KEY);
			if (!cache) {
				return;
			}
			const parsed = JSON.parse(cache);
			if (!parsed || !Array.isArray(parsed.assets)) {
				return;
			}
			if (Date.now() - parsed.timestamp > TICKER_STORAGE_TTL) {
				localStorage.removeItem(TICKER_STORAGE_KEY);
				return;
			}
			renderTicker(parsed.assets);
			if ($tickerTimestamp.length) {
				const stamp = new Date(parsed.timestamp);
				$tickerTimestamp.text(`Cached ${stamp.toLocaleTimeString()}`);
			}
			$ticker.data("isLoaded", true);
		} catch (error) {
			console.warn("Unable to hydrate ticker cache", error);
		}
	}

	function syncCryptoSimulatorFromAssets(assets) {
		const lookup = {};
		assets.forEach((asset) => {
			const id = (asset.id || asset.symbol || "").toString().toLowerCase();
			if (id) {
				lookup[id] = asset;
			}
		});

		$('[data-crypto-asset]').each(function () {
			const $card = $(this);
			const assetId = ($card.data('crypto-asset') || '').toString().toLowerCase();
			const asset = lookup[assetId];
			if (!asset) {
				return;
			}
			const price = parseFloat(asset.current_price ?? asset.priceUsd ?? 0);
			const change = parseFloat(
				asset.price_change_percentage_24h_in_currency ??
					asset.price_change_percentage_24h ??
					asset.changePercent24Hr ??
					0
			);
			const $price = $card.find('[data-crypto-price]');
			const $change = $card.find('[data-crypto-change]');
			$price.text(priceFormatter.format(price));
			$change
				.removeClass('text-success text-danger text-muted')
				.addClass(change >= 0 ? 'text-success' : 'text-danger')
				.text(`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`);
		});
	}
	$("[data-sim-scenario]").on("click", function () {
		const scenario = $(this).data("sim-scenario");
		const messages = {
			scalping: "Scalping session bootstrapped. Configure latency budget and execution bots in the right panel.",
			risk: "Risk offboarding playbook loaded. Review exposure matrix before proceeding.",
			compliance: "Compliance drill active. Follow the AML checklist to complete the walkthrough.",
		};
		showToast(messages[scenario] || "Scenario loaded.");
	});

	function syncAiAdvisorFromAssets(assets) {
		const $advisorList = $("[data-ai-advisor-list]");
		if (!$advisorList.length) {
			return;
		}
		const cryptoAssets = assets.filter((asset) => asset.symbol && ["btc", "eth", "sol", "ada", "xrp", "dot"].includes(asset.symbol.toLowerCase()));
		if (!cryptoAssets.length) {
			return;
		}
		const advisorEntries = $advisorList.find("li");
		advisorEntries.each(function (index) {
			const asset = cryptoAssets[index % cryptoAssets.length];
			const change = parseFloat(
				asset.price_change_percentage_24h_in_currency ??
					asset.price_change_percentage_24h ??
					asset.changePercent24Hr ??
					0
			);
			const sentiment = change >= 4 ? "Strong Buy" : change >= 0 ? "Watch" : change <= -4 ? "Reduce" : "Neutral";
			const sentimentClass = sentiment === "Strong Buy" ? "bg-success" : sentiment === "Reduce" ? "bg-danger" : sentiment === "Watch" ? "bg-warning text-dark" : "bg-secondary";
			const $item = $(this);
			$item.find("[data-ai-advisor-sentiment]")
				.removeClass("bg-success bg-danger bg-warning bg-secondary text-dark")
				.addClass(sentimentClass)
				.text(sentiment);
			const title = `${asset.name} (${asset.symbol.toUpperCase()})`;
			$item.find("[data-ai-advisor-title]").text(title);
			const rationale =
				change >= 4
					? `Momentum surge detected; targeting ${change.toFixed(1)}% upside with tightened stop.`
				: change >= 0
				? `Stable flow with ${change.toFixed(1)}% tailwind — monitor for breakout confirmation.`
				: change <= -4
				? `Downside pressure of ${change.toFixed(1)}%; scale down exposure and review hedge.`
				: `Range-bound action; maintain neutral positioning with automated guardrails.`;
			$item.find("[data-ai-advisor-note]").text(rationale);
		});
	}

	function updateAiPerformanceMetrics(assets) {
		const history = loadAiPerformanceHistory();
		const now = Date.now();
		const avgChange = computeAiAverageChange(assets);
		if (!Number.isFinite(avgChange)) {
			renderAiPerformance(history);
			return;
		}
		const last = history[history.length - 1];
		if (last && now - last.timestamp < 10000 && Math.abs(last.value - avgChange) < 0.05) {
			renderAiPerformance(history);
			return;
		}
		history.push({ timestamp: now, value: avgChange });
		while (history.length > AI_HISTORY_LIMIT) {
			history.shift();
		}
		saveAiPerformanceHistory(history);
		renderAiPerformance(history);
	}

	function computeAiAverageChange(assets) {
		if (!Array.isArray(assets) || !assets.length) {
			return NaN;
		}
		const tracked = assets.filter((asset) => asset.symbol && ["btc", "eth", "sol", "ada", "xrp", "dot", "bnb"].includes(asset.symbol.toLowerCase()));
		if (!tracked.length) {
			return NaN;
		}
		const total = tracked.reduce((sum, asset) => {
			const change = parseFloat(
				asset.price_change_percentage_24h_in_currency ??
					asset.price_change_percentage_24h ??
					asset.changePercent24Hr ??
					0
			);
			return sum + (Number.isFinite(change) ? change : 0);
		}, 0);
		return total / tracked.length;
	}

	function renderAiPerformance(history) {
		const latest = history[history.length - 1];
		if ($aiPerformanceValue.length) {
			if (latest) {
				$aiPerformanceValue
					.removeClass("text-primary text-muted")
					.text(`${latest.value >= 0 ? "+" : ""}${latest.value.toFixed(1)}%`)
					.toggleClass("text-success", latest.value >= 0)
					.toggleClass("text-danger", latest.value < 0);
			} else {
				$aiPerformanceValue
					.removeClass("text-success text-danger")
					.addClass("text-primary")
					.text("--");
			}
		}
		if ($aiPerformanceTimestamp.length) {
			if (latest) {
				const stamp = new Date(latest.timestamp);
				$aiPerformanceTimestamp.text(`Signal updated ${stamp.toLocaleTimeString()}`);
			} else {
				$aiPerformanceTimestamp.text("Awaiting signal…");
			}
		}
		if (window.d2cAdvisorChart && history.length) {
			const categories = history.map((point) => {
				const date = new Date(point.timestamp);
				return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			});
			const data = history.map((point) => Number(point.value.toFixed(2)));
			window.d2cAdvisorChart.updateOptions({ xaxis: { categories } });
			window.d2cAdvisorChart.updateSeries([{ name: "Advisor Alpha", data }]);
		}
	}

	function loadAiPerformanceHistory() {
		try {
			const cache = localStorage.getItem(AI_HISTORY_KEY);
			if (!cache) {
				return [];
			}
			const parsed = JSON.parse(cache);
			if (!Array.isArray(parsed)) {
				return [];
			}
			return parsed;
		} catch (error) {
			console.warn("Unable to load AI performance history", error);
			return [];
		}
	}

	function saveAiPerformanceHistory(history) {
		try {
			localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(history));
		} catch (error) {
			console.warn("Unable to save AI performance history", error);
		}
	}

	function hydrateAiPerformanceHistory() {
		const history = loadAiPerformanceHistory();
		renderAiPerformance(history);
	}

	async function fetchStockData() {
		if (!$stockTableBody.length) {
			return;
		}
			// Read runtime dev settings (persisted in localStorage by Dev Settings UI)
			const forceDemo = (window.d2cConfig && window.d2cConfig.stockUseMock) || localStorage.getItem('D2C_STOCK_FORCE_DEMO') === '1';
			const storedKey = localStorage.getItem('FMP_API_KEY') || '';
			if (forceDemo) {
				injectStockFallback();
				return;
			}
			const key = storedKey || getStockApiKey();
			if (!key) {
				// No API key found — use demo data to avoid external rate-limits and CORS during development.
				injectStockFallback();
				return;
			}

			// helper: perform fetch with limited retries (exponential backoff)
			async function fetchWithRetry(url, options, retries = 2, backoff = 500) {
				for (let attempt = 0; attempt <= retries; attempt++) {
					try {
						const res = await fetch(url, options);
						if (!res.ok) throw res;
						return res;
					} catch (err) {
						if (attempt === retries) throw err;
						await new Promise((r) => setTimeout(r, backoff * Math.pow(2, attempt)));
					}
				}
			}
		try {
			if (!$stockTableBody.data("isLoaded")) {
				$stockTableBody.html(
					'<tr><td colspan="4" class="text-muted">Loading live equity data…</td></tr>'
				);
			}
			const endpoint = buildStockEndpoint();
			if ($stockTableBody.data("isLoaded") !== true) {
				$stockTableBody.html('<tr><td colspan="4" class="text-muted">Loading live equity data…</td></tr>');
			}
			const response = await fetchWithRetry(endpoint, { cache: "no-cache", headers: { accept: "application/json" } }, 2, 600);
			if (!response.ok) {
				throw new Error(`Stock tracker request failed with status ${response.status}`);
			}
			const stocks = await response.json();
			if (!Array.isArray(stocks) || !stocks.length) {
				throw new Error("No stock data returned");
			}
			renderStockTracker(stocks.slice(0, 3));
			cacheStockTracker(stocks.slice(0, 3));
			$stockTableBody.data("isLoaded", true);
		} catch (error) {
			console.error("Stock tracker feed error", error);
			$stockTableBody.removeData("isLoaded");
			// Show friendly inline message before falling back
			$stockTableBody.html('<tr><td colspan="4" class="text-warning">Live feed failed — using demo data.</td></tr>');
			setTimeout(() => injectStockFallback(), 800);
		}
	}

	function renderStockTracker(stocks) {
		if (!$stockTableBody.length) {
			return;
		}
		// Build a lookup of previous cached prices for change-highlighting
		let previousLookup = {};
		try {
			const cacheRaw = localStorage.getItem(STOCK_STORAGE_KEY);
			if (cacheRaw) {
				const parsed = JSON.parse(cacheRaw);
				if (parsed && Array.isArray(parsed.stocks)) {
					parsed.stocks.forEach((s) => {
						const sym = (s.symbol || s.ticker || '').toString().toUpperCase();
						previousLookup[sym] = parseFloat(s.price ?? s.latestPrice ?? 0) || 0;
					});
				}
			}
		} catch (e) {
			console.warn('Unable to read previous stock cache for highlighting', e);
		}

		const rows = stocks
			.map((stock) => {
				const symbol = stock.symbol || stock.ticker || "--";
				const price = parseFloat(stock.price ?? stock.latestPrice ?? 0);
				const changePercent = parseFloat(
					stock.changesPercentage ?? stock.changePercent ?? stock.changePercent24Hr ?? 0
				);
				const dayLow = parseFloat(stock.dayLow ?? stock.low ?? price);
				const dayHigh = parseFloat(stock.dayHigh ?? stock.high ?? price);
				const changeClass = changePercent >= 0 ? "text-success" : "text-danger";
				const formattedChange = `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`;
				const formattedRange = `${priceFormatter.format(dayLow)} - ${priceFormatter.format(dayHigh)}`;
				// include data attribute for later per-symbol DOM updates
				return `
						<tr data-stock-symbol="${(symbol || '').toString().toUpperCase()}">
							<td class="fw-semibold">${symbol}</td>
							<td class="d2c_price_cell">${priceFormatter.format(price)}</td>
							<td class="d2c_change_cell ${changeClass}">${formattedChange}</td>
							<td>${formattedRange}</td>
						</tr>
				`;
			})
			.join("");
		$stockTableBody.html(rows);

		// Ensure each row has a sparkline cell (last column)
		$stockTableBody.find('tr[data-stock-symbol]').each(function () {
			const $row = $(this);
			if (!$row.find('.d2c_spark_cell').length) {
				$row.append('<td class="d2c_spark_cell" style="width:120px;"></td>');
			}
		});

		// Initialize mock sparklines (will be replaced by live data if available)
		initRowSparklines();
		// Attempt to populate live sparklines from FMP
		populateLiveSparklines(12);

		// After rendering rows, highlight per-symbol changes vs cached prices
		try {
			stocks.forEach((stock) => {
				const sym = (stock.symbol || stock.ticker || '').toString().toUpperCase();
				const price = parseFloat(stock.price ?? stock.latestPrice ?? 0) || 0;
				const prev = previousLookup[sym] || 0;
				const $row = $stockTableBody.find(`tr[data-stock-symbol="${sym}"]`);
				if ($row.length) {
					if (prev && price !== prev) {
						// brief row flash to indicate direction
						const added = price > prev ? 'table-success' : 'table-danger';
						$row.addClass(added);
						setTimeout(() => $row.removeClass(added), 1200);
					}
				}
			});
		} catch (e) {
			console.warn('Error while applying stock change highlights', e);
		}

		const averageChange =
			stocks.reduce((acc, stock) => {
				const change = parseFloat(
					stock.changesPercentage ?? stock.changePercent ?? stock.changePercent24Hr ?? 0
				);
				return acc + (isNaN(change) ? 0 : change);
			}, 0) / stocks.length;

		if ($stockIndex.length) {
			$stockIndex
				.removeClass("bg-success bg-danger text-success text-danger bg-opacity-10")
				.addClass(
					averageChange >= 0
						? "bg-success bg-opacity-10 text-success"
						: "bg-danger bg-opacity-10 text-danger"
				)
				.text(`${averageChange >= 0 ? "+" : ""}${averageChange.toFixed(2)}% avg`);
		}

		if ($stockTimestamp.length) {
			const now = new Date();
			$stockTimestamp.text(`Updated ${now.toLocaleTimeString()}`);
		}

		if (window.d2cStockChart) {
			const categories = stocks.map((stock) => stock.symbol || stock.ticker || "--");
			const prices = stocks.map((stock) => parseFloat(stock.price ?? stock.latestPrice ?? 0));
			window.d2cStockChart.updateOptions({
				xaxis: { categories },
			});
			window.d2cStockChart.updateSeries([
				{
					name: "Price",
					data: prices,
				},
			]);
		}

		// If the lightweight AI advisor is available, feed it the current stocks
		try {
			if (window.d2cAIAdvisor && typeof window.d2cAIAdvisor.analyze === 'function') {
				window.d2cAIAdvisor.analyze(stocks);
			}
		} catch (e) {
			console.warn('AI advisor analyze failed', e);
		}
	}

	function cacheStockTracker(stocks) {
		try {
			const payload = {
				timestamp: Date.now(),
				stocks,
			};
			localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(payload));
		} catch (error) {
			console.warn("Unable to cache stock tracker data", error);
		}
	}

	function hydrateStockTracker() {
		try {
			const cache = localStorage.getItem(STOCK_STORAGE_KEY);
			if (!cache) {
				return;
			}
			const parsed = JSON.parse(cache);
			if (!parsed || !Array.isArray(parsed.stocks)) {
				return;
			}
			if (Date.now() - parsed.timestamp > STOCK_STORAGE_TTL) {
				localStorage.removeItem(STOCK_STORAGE_KEY);
				return;
			}
			renderStockTracker(parsed.stocks);
			$stockTableBody.data("isLoaded", true);
			if ($stockTimestamp.length) {
				const stamp = new Date(parsed.timestamp);
				$stockTimestamp.text(`Cached ${stamp.toLocaleTimeString()}`);
			}
		} catch (error) {
			console.warn("Unable to hydrate stock tracker cache", error);
		}
	}

	function injectStockFallback() {
		const fallbackStocks = [
			{
				symbol: "AAPL",
				price: 224.18,
				changesPercentage: 1.12,
				dayLow: 221.9,
				dayHigh: 226.4,
			},
			{
				symbol: "MSFT",
				price: 352.94,
				changesPercentage: 0.86,
				dayLow: 349.1,
				dayHigh: 356.7,
			},
			{
				symbol: "NVDA",
				price: 1094.66,
				changesPercentage: -0.54,
				dayLow: 1080.0,
				dayHigh: 1120.0,
			},
		];
		renderStockTracker(fallbackStocks);
		if ($stockTimestamp.length) {
			$stockTimestamp.text("Demo data (retrying live feed…)");
		}
	}

	const $cryptoCards = $("#d2c_crypto_simulator .border");
	if ($cryptoCards.length) {
		$cryptoCards.on("click", function () {
			$cryptoCards.removeClass("border-primary shadow");
			$(this).addClass("border-primary shadow");
		});
	}

	$("[data-wallet-action]").on("click", function (event) {
		event.preventDefault();
		const action = $(this).data("wallet-action");
		// simple demo wallet persisted in localStorage
		const WAL_KEY = 'd2c_demo_wallet';
		function loadWallet(){ try{ return JSON.parse(localStorage.getItem(WAL_KEY)) || { balance: 5000 }; }catch(e){ return { balance:5000 }; } }
		function saveWallet(w){ try{ localStorage.setItem(WAL_KEY, JSON.stringify(w)); }catch(e){} }

		if (action === 'deposit' || action === 'withdraw' || action === 'transfer') {
			// open modal and populate fields
			try {
				const modalEl = document.getElementById('d2cWalletModal');
				const modal = new bootstrap.Modal(modalEl);
				document.getElementById('d2c_wallet_action').value = action;
				document.getElementById('d2c_wallet_amount').value = '';
				document.getElementById('d2c_wallet_recipient').value = '';
				document.getElementById('d2c_wallet_recipient_row').style.display = action === 'transfer' ? 'block' : 'none';
				modal.show();
			} catch (e) {
				// fallback to prompt if modal missing
				const amtStr = prompt(`Enter amount to ${action} (USD)`, '100');
				if (!amtStr) { showToast('Action cancelled', 'Wallet', 'info'); return; }
				const amt = parseFloat(amtStr);
				if (isNaN(amt) || amt <= 0) { showToast('Enter a valid amount', 'Wallet', 'warning'); return; }
				const w = loadWallet();
				if (action === 'deposit') { w.balance = (w.balance||0) + amt; saveWallet(w); showToast(`Deposited $${amt.toFixed(2)}`, 'Wallet', 'success'); }
				else if (action === 'withdraw') { if ((w.balance||0) < amt) { showToast('Insufficient balance', 'Wallet', 'danger'); } else { w.balance -= amt; saveWallet(w); showToast(`Withdrew $${amt.toFixed(2)}`, 'Wallet', 'success'); } }
				else if (action === 'transfer') { const dest = prompt('Enter recipient (demo)', 'External Account'); if (!dest) { showToast('Transfer cancelled', 'Wallet', 'info'); return; } if ((w.balance||0) < amt) { showToast('Insufficient balance', 'Wallet', 'danger'); } else { w.balance -= amt; saveWallet(w); showToast(`Transferred $${amt.toFixed(2)} to ${dest}`, 'Wallet', 'success'); } }
				try { document.querySelectorAll('.d2c_wallet_balance').forEach(el=>el.textContent = '$' + (loadWallet().balance||0).toFixed(2)); } catch(e){}
			}
			return;
		}

		const message =
			action === "sync"
				? "Wallet sync requested — connect to your core banking API to finalize."
				: "Card management opens in the mobile banking console.";
		console.info(message);
		showToast(message, 'Wallet', 'info', 5000);
	});

	$("a[href='#']").on("click", function (event) {
		if (this.dataset.walletAction) {
			return;
		}
		if (this.closest("#d2c_crypto_simulator")) {
			event.preventDefault();
			console.info("Crypto simulator training mode is a placeholder in this demo.");
			showToast('Crypto simulator training mode is a placeholder in this demo.', 'Simulator', 'warning', 4500);
		}
	});

	// Ensure preloader shows when internal navigation links are clicked.
	// This covers the case where the user clicks a link to the current page (e.g. Overview)
	// — in that case the browser won't reload automatically, so we force a reload to replay
	// the preloader lifecycle. For other internal navigations we show the preloader and allow
	// the navigation to proceed.
	$(document).on('click', 'a.sub-menu-link[href$=".html"]', function (e) {
		const $el = $(this);
		const href = $el.attr('href');
		if (!href || href === '#') return; // ignore toggles
		// ignore links that are collapse toggles (data-bs-toggle present)
		if ($el.attr('data-bs-toggle')) return;
		try {
			const targetUrl = new URL(href, window.location.href);
			const currentUrl = new URL(window.location.href);
			// show preloader UI
			$('.preloader').show();
			$('.d2c_wrapper').removeClass('show');
			// if link points to same document (same pathname + search), force reload so
			// the preloader lifecycle (window.onload) runs again
			if (targetUrl.pathname === currentUrl.pathname && targetUrl.search === currentUrl.search) {
				e.preventDefault();
				// small delay to ensure preloader is visible before reload
				setTimeout(function () { window.location.reload(); }, 50);
			}
			// otherwise let the browser navigate (preloader will be shown while navigating)
		} catch (err) {
			// best-effort fallback
			$('.preloader').show();
			$('.d2c_wrapper').removeClass('show');
		}
	});

	// --- Dev Settings handlers ---

	// Open Dev Modal
	$(document).on('click', '#d2c_dev_settings_toggle', function () {
		const modalEl = document.getElementById('d2cDevSettingsModal');
		const modal = new bootstrap.Modal(modalEl);
		// populate current values
		$('#d2c_fmp_api_key').val(localStorage.getItem('FMP_API_KEY') || '');
		$('#d2c_force_demo').prop('checked', localStorage.getItem('D2C_STOCK_FORCE_DEMO') === '1');
		modal.show();
	});

	// Wallet modal confirm handler (demo)
	$(document).on('click', '#d2c_wallet_submit', function () {
		try {
			const action = document.getElementById('d2c_wallet_action').value;
			const amt = parseFloat(document.getElementById('d2c_wallet_amount').value || 0);
			const recipient = document.getElementById('d2c_wallet_recipient').value || '';
			const WAL_KEY = 'd2c_demo_wallet';
			function loadWallet(){ try{ return JSON.parse(localStorage.getItem(WAL_KEY)) || { balance: 5000 }; }catch(e){ return { balance:5000 }; } }
			function saveWallet(w){ try{ localStorage.setItem(WAL_KEY, JSON.stringify(w)); }catch(e){} }

			if (!action) { showToast('No action specified', 'Wallet', 'warning'); return; }
			if (isNaN(amt) || amt <= 0) { showToast('Enter a valid amount', 'Wallet', 'warning'); return; }
			const w = loadWallet();
			if (action === 'deposit') { w.balance = (w.balance||0) + amt; saveWallet(w); showToast(`Deposited $${amt.toFixed(2)}`, 'Wallet', 'success'); }
			else if (action === 'withdraw') { if ((w.balance||0) < amt) { showToast('Insufficient balance', 'Wallet', 'danger'); } else { w.balance -= amt; saveWallet(w); showToast(`Withdrew $${amt.toFixed(2)}`, 'Wallet', 'success'); } }
			else if (action === 'transfer') { if (!recipient) { showToast('Enter recipient', 'Wallet', 'warning'); return; } if ((w.balance||0) < amt) { showToast('Insufficient balance', 'Wallet', 'danger'); } else { w.balance -= amt; saveWallet(w); showToast(`Transferred $${amt.toFixed(2)} to ${recipient}`, 'Wallet', 'success'); } }
			// update UI balance displays
			try { document.querySelectorAll('.d2c_wallet_balance').forEach(el=>el.textContent = '$' + (loadWallet().balance||0).toFixed(2)); } catch(e){}
			// hide modal
			try { var modalEl = document.getElementById('d2cWalletModal'); var bsModal = bootstrap.Modal.getInstance(modalEl); if (bsModal) bsModal.hide(); } catch (e) {}
		} catch (e) {
			console.warn('Wallet action failed', e);
			showToast('Wallet action failed', 'Wallet', 'danger');
		}
	});

	// Save Dev Settings
	$(document).on('click', '#d2c_save_dev_settings', function () {
		const key = $('#d2c_fmp_api_key').val().trim();
		const forceDemo = $('#d2c_force_demo').prop('checked');
		if (key) {
			localStorage.setItem('FMP_API_KEY', key);
		} else {
			localStorage.removeItem('FMP_API_KEY');
		}
		localStorage.setItem('D2C_STOCK_FORCE_DEMO', forceDemo ? '1' : '0');
		showToast('Dev settings saved. Click Refresh in the stock tracker to apply.', 'Dev Settings', 'success', 4500);
	});

	// Clear Dev Settings
	$(document).on('click', '#d2c_clear_dev_settings', function () {
		localStorage.removeItem('FMP_API_KEY');
		localStorage.removeItem('D2C_STOCK_FORCE_DEMO');
		$('#d2c_fmp_api_key').val('');
		$('#d2c_force_demo').prop('checked', false);
		showToast('Dev settings cleared.', 'Dev Settings', 'warning', 3500);
	});

	// Initialize tiny sparklines per stock row using ApexCharts
	function initRowSparklines() {
		try {
			// Each row could optionally have an inline sparkline container; create if missing
			$stockTableBody.find('tr[data-stock-symbol]').each(function () {
				const $row = $(this);
				// Avoid recreating
				if ($row.data('sparkline-initialized')) return;
				const symbol = $row.data('stock-symbol');
				// create a small cell for sparkline on the right if not present
				let $sparkCell = $row.find('.d2c_spark_cell');
				if (!$sparkCell.length) {
					$sparkCell = $('<td class="d2c_spark_cell" style="width:120px;"></td>');
					$row.append($sparkCell);
				}
				const sparkId = `spark_${symbol}_${Date.now()}`;
				const $sparkDiv = $(`<div id="${sparkId}" style="height:36px;"></div>`);
				$sparkCell.empty().append($sparkDiv);
				const options = {
					chart: { type: 'area', sparkline: { enabled: true }, height: 36 },
					series: [{ data: generateMockSparklineData() }],
					stroke: { curve: 'smooth', width: 2 },
					fill: { opacity: 0.2 },
					tooltip: { enabled: false },
					colors: ['#0d6efd'],
				};
				try {
					new ApexCharts(document.querySelector(`#${sparkId}`), options).render();
				} catch (e) {
					// ignore chart errors
				}
				$row.data('sparkline-initialized', true);
			});
		} catch (e) {
			console.warn('Unable to create row sparklines', e);
		}
	}

	function generateMockSparklineData(points = 12) {
		const now = Date.now();
		const data = [];
		let value = Math.random() * 10 + 100;
		for (let i = 0; i < points; i++) {
			value = value + (Math.random() - 0.5) * 2;
			data.push(parseFloat(value.toFixed(2)));
		}
		return data;
	}

	// --- FMP sparklines: live history fetching, caching and wiring ---
	const FMP_SPARK_TTL = 10 * 60 * 1000; // 10 minutes
	const FMP_SPARK_CACHE_KEY = (sym) => `fmp_spark_${sym}`;

	function buildFmpHistoryEndpoint(symbol, points = 12) {
		const key = getStockApiKey();
		// Use the historical-price-full endpoint that supports timeseries
		// Example: /historical-price-full/AAPL?timeseries=12&apikey=demo
		return `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?timeseries=${points}&apikey=${key || 'demo'}`;
	}

	async function fetchFmpHistory(symbol, points = 12) {
		// check cache
		try {
			const raw = localStorage.getItem(FMP_SPARK_CACHE_KEY(symbol));
			if (raw) {
				const parsed = JSON.parse(raw);
				if (Date.now() - parsed.timestamp < FMP_SPARK_TTL && Array.isArray(parsed.data) && parsed.data.length) {
					return parsed.data;
				}
			}
		} catch (e) {
			console.warn('FMP spark cache read error', e);
		}

		if (!getStockApiKey() && localStorage.getItem('D2C_STOCK_FORCE_DEMO') !== '1') {
			// no key and not forced demo — we'll still attempt endpoint with demo key, but be mindful
		}

			// Use local proxy (Vercel) to avoid exposing API key client-side
			const proxyEndpoint = `/api/fmp-history?symbol=${encodeURIComponent(symbol)}&points=${encodeURIComponent(points)}`;
			try {
				const resp = await fetchWithRetry(proxyEndpoint, { cache: 'no-cache', headers: { accept: 'application/json' } }, 2, 600);
				if (!resp.ok) throw new Error(`Proxy history status ${resp.status}`);
				const json = await resp.json();
				// Proxy returns { symbol, series: [numbers], demo }
				const series = (json && Array.isArray(json.series)) ? json.series.slice(0, points) : [];
				// cache
				try {
					localStorage.setItem(FMP_SPARK_CACHE_KEY(symbol), JSON.stringify({ timestamp: Date.now(), data: series }));
				} catch (e) { console.warn('Unable to cache FMP spark', e); }
				return series;
			} catch (e) {
				console.warn('Proxy history fetch failed for', symbol, e);
				// fall back to attempting the client-side direct call if someone left a key in localStorage (development)
				try {
					const directEndpoint = buildFmpHistoryEndpoint(symbol, points);
					const resp2 = await fetchWithRetry(directEndpoint, { cache: 'no-cache', headers: { accept: 'application/json' } }, 1, 600);
					if (resp2 && resp2.ok) {
						const json2 = await resp2.json();
						const list = (json2 && json2.historical && Array.isArray(json2.historical)) ? json2.historical : [];
						const s2 = list.slice(0, points).map((p) => parseFloat(p.close || p.price || 0)).reverse();
						try { localStorage.setItem(FMP_SPARK_CACHE_KEY(symbol), JSON.stringify({ timestamp: Date.now(), data: s2 })); } catch (e) {}
						return s2;
					}
				} catch (e2) {
					console.warn('Direct FMP fallback also failed for', symbol, e2);
				}
				throw e;
			}
	}

	async function populateLiveSparklines(points = 12) {
		if (!$stockTableBody.length) return;
		const rows = $stockTableBody.find('tr[data-stock-symbol]');
		const symbols = [];
		rows.each(function () { symbols.push($(this).data('stock-symbol')); });

		for (let i = 0; i < symbols.length; i++) {
			const sym = symbols[i];
			// stagger requests to avoid bursts
			await new Promise((r) => setTimeout(r, i * 200));
			(async (symbol) => {
				try {
					// if demo forced, skip live
					const forceDemo = localStorage.getItem('D2C_STOCK_FORCE_DEMO') === '1';
					if (forceDemo) {
						showToast(`Using demo data for ${symbol}`, 'Sparkline', 'warning', 3000);
						return;
					}

					const series = await fetchFmpHistory(symbol, points);
					if (!series || !series.length) {
						showToast(`Demo data for ${symbol}`, 'Sparkline', 'info', 2500);
						return;
					}
					// find the spark div and update chart
					const $row = $stockTableBody.find(`tr[data-stock-symbol="${symbol}"]`);
					const $spark = $row.find('.d2c_spark_cell div[id^="spark_"]');
					if ($spark.length) {
						const id = $spark.attr('id');
						try {
							// update via ApexCharts if chart instance exists
							const el = document.querySelector(`#${id}`);
							if (el && el._apexchart) {
								el._apexchart.updateSeries([{ data: series }]);
							} else {
								// render new
								new ApexCharts(el, { chart: { type: 'area', sparkline: { enabled: true }, height: 36 }, series: [{ data: series }], stroke: { curve: 'smooth', width: 2 }, fill: { opacity: 0.2 }, tooltip: { enabled: false }, colors: ['#0d6efd'] }).render();
							}
						} catch (e) {
							console.warn('Error updating sparkline', e);
						}
						showToast(`Live history loaded for ${symbol}`, 'Sparkline', 'success', 2200);
					}
				} catch (e) {
					// fallback: do nothing (mock sparkline already present)
					showToast(`Using demo data for ${symbol}`, 'Sparkline', 'warning', 2200);
				}
			})(sym);
		}
	}
});
