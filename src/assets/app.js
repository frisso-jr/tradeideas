// app.js — roda no browser após o build estático

(function () {
  const PER_PAGE = 20;
  let cards       = [];
  let visible     = [];
  let currentPage = 1;
  let activeFilter = 'todas';
  let searchTerm   = '';

  // ── Cotações ao vivo ──────────────────────────────────────────────────────
  const BRAPI_URL    = 'https://brapi.dev/api/quote/';
  const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price';

  const CRYPTO_IDS = { BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin' };

  async function fetchPrecos(ativos) {
    const acoes  = ativos.filter(a => !CRYPTO_IDS[a]);
    const cryptos = ativos.filter(a => CRYPTO_IDS[a]);
    const precos  = {};

    if (acoes.length) {
      try {
        const r = await fetch(BRAPI_URL + acoes.join(',') + '?fundamental=false');
        const j = await r.json();
        (j.results || []).forEach(s => { precos[s.symbol] = s.regularMarketPrice; });
      } catch {}
    }

    if (cryptos.length) {
      try {
        const ids = cryptos.map(c => CRYPTO_IDS[c]).join(',');
        const r   = await fetch(`${COINGECKO_URL}?ids=${ids}&vs_currencies=brl,usd`);
        const j   = await r.json();
        cryptos.forEach(c => {
          const id  = CRYPTO_IDS[c];
          const val = j[id]?.brl || j[id]?.usd;
          if (val) precos[c] = val;
        });
      } catch {}
    }

    return precos;
  }

  async function atualizarPrecos() {
    const abertas = Array.from(document.querySelectorAll('.card[data-status="aberta"], .card[data-status="parcial"]'));
    if (!abertas.length) return;

    const ativos = [...new Set(abertas.map(c => c.dataset.ativo))];
    const precos = await fetchPrecos(ativos);

    abertas.forEach(card => {
      const ativo   = card.dataset.ativo;
      const preco   = precos[ativo];
      if (!preco) return;

      const entradaEl = card.querySelector('.det-val');
      const entrada   = parseFloat(card.querySelector('[data-entrada]')?.dataset.entrada);
      const dir       = card.dataset.dir;

      if (!entrada) return;

      const resultado = dir === 'long'
        ? (preco - entrada) / entrada
        : (entrada - preco) / entrada;

      const pctFmt = (resultado >= 0 ? '+' : '') + (resultado * 100).toFixed(1) + '%';
      const cls    = resultado >= 0 ? 'pos' : 'neg';

      let liveEl = card.querySelector('.live-price');
      if (!liveEl) {
        liveEl = document.createElement('div');
        liveEl.className = 'live-price';
        card.querySelector('.card-right')?.appendChild(liveEl);
      }
      liveEl.innerHTML = `<span class="live-dot"></span><span class="${cls}">${pctFmt}</span> agora`;
    });
  }

  // ── Filtros e busca ───────────────────────────────────────────────────────
  function aplicarFiltros() {
    visible = cards.filter(card => {
      const dir    = card.dataset.dir || '';
      const status = card.dataset.status || '';
      const tags   = (card.dataset.tags || '').toLowerCase();
      const ativo  = (card.dataset.ativo || '').toLowerCase();
      const term   = searchTerm.toLowerCase();

      const passaFiltro =
        activeFilter === 'todas'   ||
        (activeFilter === 'abertas'  && (status === 'aberta' || status === 'parcial')) ||
        (activeFilter === 'fechadas' && (status === 'fechada' || status === 'stopada')) ||
        activeFilter === dir;

      const passaBusca = !term || ativo.includes(term) || tags.includes(term);

      return passaFiltro && passaBusca;
    });

    currentPage = 1;
    renderPagina();
    atualizarContador();
  }

  function renderPagina() {
    const inicio = (currentPage - 1) * PER_PAGE;
    const fim    = inicio + PER_PAGE;

    cards.forEach(c => { c.style.display = 'none'; });
    visible.slice(inicio, fim).forEach(c => { c.style.display = ''; });

    renderPaginacao();
  }

  function renderPaginacao() {
    const total = Math.ceil(visible.length / PER_PAGE);
    const cont  = document.getElementById('pagination');
    if (!cont) return;

    if (total <= 1) { cont.innerHTML = ''; return; }

    const btns = [];
    for (let i = 1; i <= total; i++) {
      btns.push(`<button class="pg-btn${i === currentPage ? ' active' : ''}" data-page="${i}">${i}</button>`);
    }
    cont.innerHTML = btns.join('');

    cont.querySelectorAll('.pg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page);
        renderPagina();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function atualizarContador() {
    const el = document.getElementById('count');
    if (el) el.textContent = `${visible.length} trade${visible.length !== 1 ? 's' : ''}`;
  }

  // ── Accordion cards ───────────────────────────────────────────────────────
  function bindCards() {
    cards.forEach(card => {
      const top = card.querySelector('.card-top');
      if (!top) return;
      top.addEventListener('click', () => card.classList.toggle('open'));
    });
  }

  // ── Inscrição e-mail ──────────────────────────────────────────────────────
  function bindSubForm() {
    const form = document.getElementById('subForm');
    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('subEmail')?.value;
      if (!email) return;

      const btn = form.querySelector('button');
      btn.textContent = 'Enviando…';
      btn.disabled    = true;

      try {
        // Endpoint do Apps Script (Web App URL — configurar após deploy)
        const url = document.body.dataset.webhookUrl || '';
        if (url) {
          await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, canal: 'email', origem: 'site' }),
          });
        }
        form.innerHTML = '<span style="color:var(--green);font-size:13px">✓ Inscrição confirmada!</span>';
      } catch {
        btn.textContent = 'Tentar novamente';
        btn.disabled    = false;
      }
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    cards = Array.from(document.querySelectorAll('#feed .card'));
    visible = cards;

    // Filtros
    document.querySelectorAll('.pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.pill').forEach(p => p.classList.remove('on'));
        pill.classList.add('on');
        activeFilter = pill.dataset.filter || 'todas';
        aplicarFiltros();
      });
    });

    // Busca
    const searchEl = document.getElementById('search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        searchTerm = searchEl.value;
        aplicarFiltros();
      });
    }

    bindCards();
    bindSubForm();
    renderPagina();
    atualizarContador();

    // Busca cotações 30s após carregar (sem bloquear render)
    setTimeout(atualizarPrecos, 1500);
    setInterval(atualizarPrecos, 60_000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
