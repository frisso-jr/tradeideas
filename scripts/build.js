// scripts/build.js — versão 2 (design atualizado)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';

const { config, trades, mensal, stats } = JSON.parse(readFileSync('src/data.json', 'utf8'));
mkdirSync('dist', { recursive: true });
mkdirSync('dist/img/trades', { recursive: true });

// Copia assets
['style.css', 'app.js'].forEach(f => {
  const src = `src/assets/${f}`;
  if (existsSync(src)) copyFileSync(src, `dist/${f}`);
});

writeFileSync('dist/data.json', JSON.stringify({ config, trades, mensal, stats }, null, 2));

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtPct(val) {
  const n = parseFloat(val);
  if (isNaN(n) || val === '') return null;
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%';
}

function corCls(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return '';
  return n > 0 ? 'pos' : 'neg';
}

function statusCls(s) {
  const map = { Aberta: 's-aberta', Parcial: 's-parcial', Fechada: 's-fechada', Stopada: 's-stopada' };
  return map[s] || '';
}

function dirCls(d) {
  return d === 'Long' ? 'long' : 'short';
}

function dirIcon(d) {
  return d === 'Long'
    ? '<i class="ti ti-trending-up" aria-hidden="true"></i>'
    : '<i class="ti ti-trending-down" aria-hidden="true"></i>';
}

// Percentual de distância em relação à entrada
function dist(entrada, nivel, direcao) {
  const e = parseFloat(entrada), n = parseFloat(nivel);
  if (!e || !n) return '';
  const pct = direcao === 'Long' ? (n - e) / e : (e - n) / e;
  return (pct >= 0 ? '+' : '') + (pct * 100).toFixed(1) + '%';
}

// Largura da barra de R/R (máx 100%, satura em 4×)
function rrWidth(rr) {
  const n = parseFloat(rr);
  if (isNaN(n)) return 0;
  return Math.min(n / 4 * 100, 100).toFixed(0);
}

// ── Card HTML ─────────────────────────────────────────────────────────────────
function tradeCard(t, idx) {
  const resultado = fmtPct(t.resultado_pct);
  const resultadoHtml = resultado
    ? `<div class="result ${corCls(t.resultado_pct)}">${resultado}</div>`
    : `<div class="result nd">em aberto</div>`;

  const imgHtml = t.imagem_local
    ? `<img src="${t.imagem_local}" alt="Gráfico ${t.ativo} ${t.data_abertura}" loading="lazy">`
    : `<div class="img-placeholder"><i class="ti ti-chart-candle" aria-hidden="true"></i><span>Gráfico em breve · 1280×720px</span></div>`;

  const saidaBox = t.saida
    ? `<div class="level-box">
        <div class="level-lbl">Saída</div>
        <div class="level-val pos">${t.saida}</div>
        <div class="level-sub">${resultado || ''}</div>
       </div>`
    : `<div class="level-box">
        <div class="level-lbl">Alvo final</div>
        <div class="level-val pos">${t.alvo_final}</div>
        <div class="level-sub">${dist(t.entrada, t.alvo_final, t.direcao)}</div>
       </div>`;

  const rrHtml = t.risco_retorno
    ? `<div class="rr-wrap">
        <div class="rr-info">
          <div class="rr-lbl">Risco / retorno</div>
          <div class="rr-track">
            <div class="rr-fill" style="width:${rrWidth(t.risco_retorno)}%"></div>
          </div>
        </div>
        <div class="rr-number">${parseFloat(t.risco_retorno).toFixed(1)}×</div>
       </div>` : '';

  const captionHtml = t.imagem_local
    ? `<div class="chart-caption">
        <span class="chart-cap-l">${t.ativo} · ${t.timeframe}</span>
        <span class="chart-cap-r">${t.data_abertura}</span>
       </div>` : '';

  return `
<article class="card"
  id="card-${idx}"
  data-dir="${t.direcao.toLowerCase()}"
  data-status="${t.status.toLowerCase()}"
  data-tags="${t.tags.toLowerCase()}"
  data-ativo="${t.ativo.toLowerCase()}"
  data-entrada="${t.entrada}">

  <div class="card-collapsed" onclick="toggleCard('card-${idx}')">
    <div class="card-left">
      <div class="ticker">${t.ativo}</div>
      <span class="dir-badge ${dirCls(t.direcao)}">${dirIcon(t.direcao)} ${t.direcao}</span>
    </div>
    <div class="card-mid">
      <div class="card-status-row">
        <span class="status-badge ${statusCls(t.status)}">${t.status}</span>
        <span class="card-meta">${t.timeframe} · ${t.data_abertura}</span>
      </div>
      <p class="card-rat">${t.racional}</p>
      <p class="card-tags">${t.tags}</p>
    </div>
    <div class="card-right" id="right-${idx}">
      ${resultadoHtml}
      <div class="levels">stop ${t.stop}<br>alvo ${t.alvo_final}</div>
    </div>
  </div>

  <div class="card-expanded">
    <div class="exp-inner">
      <div class="levels-grid">
        <div class="level-box">
          <div class="level-lbl">Entrada</div>
          <div class="level-val">${t.entrada}</div>
          <div class="level-sub">preço médio</div>
        </div>
        <div class="level-box">
          <div class="level-lbl">Stop</div>
          <div class="level-val neg">${t.stop}</div>
          <div class="level-sub">${dist(t.entrada, t.stop, t.direcao)}</div>
        </div>
        <div class="level-box">
          <div class="level-lbl">Alvo parcial</div>
          <div class="level-val pos">${t.alvo_parcial}</div>
          <div class="level-sub">${dist(t.entrada, t.alvo_parcial, t.direcao)}</div>
        </div>
        ${saidaBox}
      </div>
      ${rrHtml}
      <div class="chart-wrap">
        ${imgHtml}
        ${captionHtml}
      </div>
    </div>
  </div>
</article>`;
}

// ── Barra de meses ────────────────────────────────────────────────────────────
function mesBar(m) {
  const ret = parseFloat(m.retorno_pct);
  if (isNaN(ret)) return '';
  const maxAbs = Math.max(...mensal.map(x => Math.abs(parseFloat(x.retorno_pct) || 0)), 0.01);
  const h = Math.round(Math.abs(ret) / maxAbs * 100);
  const cls = ret >= 0 ? 'pos' : 'neg';
  const fmt = (ret >= 0 ? '+' : '') + (ret * 100).toFixed(1) + '%';
  return `<div class="bw">
    <div class="bp ${cls}">${fmt}</div>
    <div class="b ${cls}" style="height:${h}%"></div>
    <div class="bm">${m.mes_nome.slice(0,3).toLowerCase()}</div>
  </div>`;
}

// ── Calendário mensal ─────────────────────────────────────────────────────────
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function calMes(nome, m) {
  if (!m) return `<div class="mc"><div class="mc-name">${nome}</div><div class="mc-val nd">—</div><div class="mc-bar"></div></div>`;
  const ret = parseFloat(m.retorno_pct);
  const maxAbs = Math.max(...mensal.map(x => Math.abs(parseFloat(x.retorno_pct) || 0)), 0.01);
  const w = Math.round(Math.abs(ret) / maxAbs * 100);
  const cls = ret >= 0 ? 'pos' : 'neg';
  const fmt = (ret >= 0 ? '+' : '') + (ret * 100).toFixed(1) + '%';
  return `<div class="mc">
    <div class="mc-name">${nome}</div>
    <div class="mc-val ${cls}">${fmt}</div>
    <div class="mc-bar ${cls}" style="width:${w}%"></div>
  </div>`;
}

// ── Head HTML compartilhado ───────────────────────────────────────────────────
function htmlHead(title) {
  const cor = config.cor_destaque || '#1D9E75';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${config.bio || ''}">
<meta name="theme-color" content="${cor}">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
</head>`;
}

// ── Topbar + nav compartilhados ───────────────────────────────────────────────
function topbarHtml(activePage) {
  const initials = (config.nome || 'TI').split(' ').map(w => w[0]).slice(0,2).join('');
  const acumulado = fmtPct(stats.retorno_acumulado / 100) || '—';
  const acumCls   = corCls(stats.retorno_acumulado / 100);
  const wr        = stats.win_rate ? (stats.win_rate * 100).toFixed(0) + '%' : '—';

  return `
<header class="topbar">
  <div class="profile">
    <div class="avatar">${initials}</div>
    <div>
      <div class="pname">${config.nome || 'Trade Ideas'}</div>
      <div class="pdesc">${config.estrategia || ''}</div>
    </div>
  </div>
  <div class="topstats">
    <div class="ts">
      <div class="ts-val ${acumCls}">${acumulado}</div>
      <div class="ts-lbl">acumulado</div>
    </div>
    <div class="ts">
      <div class="ts-val">${wr}</div>
      <div class="ts-lbl">win rate</div>
    </div>
    <div class="ts">
      <div class="ts-val">${stats.total_trades || 0}</div>
      <div class="ts-lbl">trades</div>
    </div>
  </div>
</header>
<nav class="nav">
  <a class="nav-item${activePage === 'trades' ? ' active' : ''}" href="index.html">Trade ideas</a>
  <a class="nav-item${activePage === 'performance' ? ' active' : ''}" href="performance.html">Performance</a>
</nav>`;
}

function footerHtml() {
  const year = new Date().getFullYear();
  const updated = new Date(stats.ultima_atualizacao).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `
<footer class="footer">
  <div>© ${year} ${config.nome || ''}</div>
  <div class="footer-links">
    ${config.twitter ? `<a href="https://twitter.com/${config.twitter.replace('@','')}" target="_blank" rel="noopener" aria-label="Twitter"><i class="ti ti-brand-x"></i></a>` : ''}
    ${config.telegram_canal ? `<a href="https://${config.telegram_canal}" target="_blank" rel="noopener" aria-label="Telegram"><i class="ti ti-brand-telegram"></i></a>` : ''}
    ${config.instagram ? `<a href="https://instagram.com/${config.instagram.replace('@','')}" target="_blank" rel="noopener" aria-label="Instagram"><i class="ti ti-brand-instagram"></i></a>` : ''}
  </div>
  <div>Atualizado: ${updated}</div>
</footer>`;
}

// ── index.html ────────────────────────────────────────────────────────────────
const webhookUrl = config.webhook_url || '';

const indexHtml = `${htmlHead(`${config.nome || 'Trade Ideas'} · Ideias de Trade`)}
<body data-webhook-url="${webhookUrl}">
${topbarHtml('trades')}
<main class="page">
  <div class="toolbar">
    <div class="filters">
      <button class="pill on" data-filter="todas">Todas</button>
      <button class="pill" data-filter="abertas">Abertas</button>
      <button class="pill" data-filter="fechadas">Fechadas</button>
      <button class="pill" data-filter="long">Long</button>
      <button class="pill" data-filter="short">Short</button>
    </div>
    <div class="toolbar-right">
      <input class="search" type="search" placeholder="Buscar ativo ou tag…" id="search" aria-label="Buscar trade">
      <span class="count" id="count">${trades.length} trades</span>
    </div>
  </div>

  <div class="subscribe-bar">
    <span>Receba as trade ideas por e-mail</span>
    <form class="sub-form" id="subForm" onsubmit="return false">
      <input type="email" placeholder="seu@email.com" required id="subEmail" aria-label="Seu e-mail">
      <button type="submit" onclick="inscrever()">Inscrever</button>
    </form>
  </div>

  <div class="feed" id="feed">
    ${trades.map((t, i) => tradeCard(t, i)).join('\n')}
  </div>

  <div class="pagination" id="pagination"></div>
</main>
${footerHtml()}
<script src="app.js"></script>
</body>
</html>`;

writeFileSync('dist/index.html', indexHtml);

// ── performance.html ──────────────────────────────────────────────────────────
const mesesCompletos = MESES.map((nome, i) => ({
  nome,
  dados: mensal.find(m => parseInt(m.mes) === i + 1) || null,
}));

const maxAbs = Math.max(...mensal.map(m => Math.abs(parseFloat(m.retorno_pct) || 0)), 0.01);

const barrasHtml = mensal.map(m => {
  const ret = parseFloat(m.retorno_pct);
  const h = Math.round(Math.abs(ret) / maxAbs * 100);
  const cls = ret >= 0 ? 'pos' : 'neg';
  const fmt = (ret >= 0 ? '+' : '') + (ret * 100).toFixed(1) + '%';
  return `<div class="bw"><div class="bp ${cls}">${fmt}</div><div class="b ${cls}" style="height:${h}%"></div><div class="bm">${m.mes_nome.slice(0,3).toLowerCase()}</div></div>`;
}).join('');

// KPIs
const melhorMes   = mensal.length ? Math.max(...mensal.map(m => parseFloat(m.retorno_pct) || 0)) : 0;
const maxDrawdown = mensal.length ? Math.min(...mensal.map(m => parseFloat(m.max_drawdown) || 0)) : 0;
const acumulado   = fmtPct(stats.retorno_acumulado / 100) || '—';
const wr          = stats.win_rate ? (stats.win_rate * 100).toFixed(0) + '%' : '—';

const ultimoMes = mensal[mensal.length - 1] || null;

const perfHtml = `${htmlHead(`Performance · ${config.nome || 'Trade Ideas'}`)}
<body>
${topbarHtml('performance')}
<main class="page">
  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-lbl">Retorno acumulado</div>
      <div class="kpi-val ${corCls(stats.retorno_acumulado / 100)}">${acumulado}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Win rate</div>
      <div class="kpi-val">${wr}</div>
      <div class="kpi-sub">${stats.total_trades} trades</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Melhor mês</div>
      <div class="kpi-val pos">${fmtPct(melhorMes) || '—'}</div>
    </div>
    <div class="kpi">
      <div class="kpi-lbl">Max drawdown</div>
      <div class="kpi-val neg">${fmtPct(maxDrawdown) || '—'}</div>
    </div>
  </div>

  <div class="chart-card">
    <div class="chart-head">Retorno mensal</div>
    <div class="bars">${barrasHtml || '<div style="color:var(--text-muted);font-size:12px;padding:16px">Nenhum dado mensal ainda</div>'}</div>
  </div>

  <div class="cal">
    ${mesesCompletos.map(({ nome, dados }) => calMes(nome, dados)).join('\n')}
  </div>

  ${ultimoMes && ultimoMes.notas ? `
  <div class="note-card">
    <div class="note-head">${ultimoMes.mes_nome} ${ultimoMes.ano} — notas do mês</div>
    <div class="note-body">${ultimoMes.notas}</div>
  </div>` : ''}
</main>
${footerHtml()}
<script src="app.js"></script>
</body>
</html>`;

writeFileSync('dist/performance.html', perfHtml);
console.log(`✓ index.html + performance.html gerados (${trades.length} trades · ${mensal.length} meses)`);
