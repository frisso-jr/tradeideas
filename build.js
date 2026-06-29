// scripts/build.js
// Lê src/data.json e gera dist/index.html e dist/performance.html

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const { config, trades, mensal, stats } = JSON.parse(readFileSync('src/data.json', 'utf8'));
mkdirSync('dist', { recursive: true });

// Copia assets estáticos
if (existsSync('src/assets')) {
  const files = ['style.css', 'app.js', 'favicon.ico'];
  files.forEach(f => {
    const src = `src/assets/${f}`;
    if (existsSync(src)) copyFileSync(src, `dist/${f}`);
  });
}

// Salva data.json no dist para o JS do browser consumir
writeFileSync('dist/data.json', JSON.stringify({ config, trades, mensal, stats }, null, 2));

function pct(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%';
}

function cor(val) {
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return '';
  return n > 0 ? 'pos' : 'neg';
}

function badgeStatus(s) {
  const map = { Aberta: 'bopen', Parcial: 'bparcial', Fechada: 'bclosed', Stopada: 'bstop' };
  return `<span class="badge ${map[s] || ''}">${s}</span>`;
}

function tradeCard(t) {
  const imgTag = t.imagem_local
    ? `<img src="${t.imagem_local}" alt="Gráfico ${t.ativo}" loading="lazy">`
    : `<div class="img-placeholder"><i class="ti ti-chart-candle"></i><span>Gráfico em breve</span></div>`;

  const resultadoHtml = t.resultado_pct
    ? `<div class="result ${cor(t.resultado_pct)}">${pct(t.resultado_pct)}</div>`
    : `<div class="result nd">em aberto</div>`;

  const rrHtml = t.risco_retorno
    ? `<div class="det-rr"><div class="rr-label">Risco / retorno</div>
       <div class="rr-row"><div class="rr-track"><div class="rr-fill" style="width:${Math.min(parseFloat(t.risco_retorno)/4*100,100)}%"></div></div>
       <span class="rr-val">${parseFloat(t.risco_retorno).toFixed(1)}×</span></div></div>` : '';

  const saidaHtml = t.saida
    ? `<div class="det"><div class="det-lbl">Saída</div><div class="det-val">${t.saida}</div></div>`
    : '';

  return `
<article class="card" data-dir="${t.direcao.toLowerCase()}" data-status="${t.status.toLowerCase()}" data-tags="${t.tags}" data-ativo="${t.ativo}">
  <div class="card-top">
    <div class="card-asset">
      <div class="ticker">${t.ativo}</div>
      <span class="badge b${t.direcao.toLowerCase()}">${t.direcao}</span>
    </div>
    <div class="card-mid">
      <div class="card-badges">
        ${badgeStatus(t.status)}
        <span class="meta">${t.timeframe} · ${t.data_abertura}</span>
      </div>
      <p class="rational">${t.racional}</p>
      <p class="tags">${t.tags}</p>
    </div>
    <div class="card-right">
      ${resultadoHtml}
      <div class="levels">stop ${t.stop}<br>alvo ${t.alvo_final}</div>
    </div>
  </div>
  <div class="card-body">
    <div class="det-grid">
      <div class="det"><div class="det-lbl">Entrada</div><div class="det-val">${t.entrada}</div></div>
      <div class="det"><div class="det-lbl">Stop</div><div class="det-val neg">${t.stop}</div></div>
      <div class="det"><div class="det-lbl">Alvo parcial</div><div class="det-val pos">${t.alvo_parcial}</div></div>
      <div class="det"><div class="det-lbl">Alvo final</div><div class="det-val pos">${t.alvo_final}</div></div>
      ${saidaHtml}
    </div>
    ${rrHtml}
    <div class="chart-wrap">${imgTag}</div>
  </div>
</article>`;
}

function mesCard(m) {
  const ret = parseFloat(m.retorno_pct);
  const pctFmt = (ret >= 0 ? '+' : '') + (ret * 100).toFixed(1) + '%';
  const barW = Math.min(Math.abs(ret) * 100 / 0.10, 100).toFixed(0);
  const cls = ret >= 0 ? 'pos' : 'neg';
  return `
<div class="mc">
  <div class="mc-name">${m.mes_nome}</div>
  <div class="mc-val ${cls}">${pctFmt}</div>
  <div class="mc-bar ${cls}" style="width:${barW}%"></div>
</div>`;
}

// ── Template HTML principal ──────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${config.nome} · Trade Ideas</title>
<meta name="description" content="${config.bio}">
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
</head>
<body data-webhook-url="https://script.google.com/macros/s/AKfycbzCFqoXJKrlTM382I0-T1cYMlJa2TmajRc9gXPqaBYkEVEPeXbUQpVZcT7Fpy8Bb7gG_Q/exec">

<header class="topbar">
  <div class="profile">
    <div class="avatar">${config.nome.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
    <div>
      <div class="pname">${config.nome}</div>
      <div class="pdesc">${config.estrategia}</div>
    </div>
  </div>
  <div class="topstats">
    <div class="ts"><div class="ts-val ${cor(stats.retorno_acumulado/100)}">${pct(stats.retorno_acumulado/100)}</div><div class="ts-lbl">acumulado</div></div>
    <div class="ts"><div class="ts-val">${(stats.win_rate*100).toFixed(0)}%</div><div class="ts-lbl">win rate</div></div>
    <div class="ts"><div class="ts-val">${stats.total_trades}</div><div class="ts-lbl">trades</div></div>
  </div>
</header>

<nav class="nav">
  <a class="nav-item active" href="index.html">Trade ideas</a>
  <a class="nav-item" href="performance.html">Performance</a>
</nav>

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
      <input class="search" type="search" placeholder="Buscar ativo ou tag…" id="search">
      <span class="count" id="count">${trades.length} trades</span>
    </div>
  </div>

  <div class="subscribe-bar">
    <span>Receba as trade ideas por e-mail</span>
    <form class="sub-form" id="subForm">
      <input type="email" placeholder="seu@email.com" required id="subEmail">
      <button type="submit">Inscrever</button>
    </form>
  </div>

  <div class="feed" id="feed">
    ${trades.map(tradeCard).join('\n')}
  </div>

  <div class="pagination" id="pagination"></div>
</main>

<footer class="footer">
  <div>© ${new Date().getFullYear()} ${config.nome}</div>
  <div class="footer-links">
    ${config.twitter ? `<a href="https://twitter.com/${config.twitter.replace('@','')}" target="_blank" rel="noopener"><i class="ti ti-brand-x"></i></a>` : ''}
    ${config.telegram_canal ? `<a href="https://${config.telegram_canal}" target="_blank" rel="noopener"><i class="ti ti-brand-telegram"></i></a>` : ''}
    ${config.instagram ? `<a href="https://instagram.com/${config.instagram.replace('@','')}" target="_blank" rel="noopener"><i class="ti ti-brand-instagram"></i></a>` : ''}
  </div>
  <div class="updated">Atualizado: ${new Date(stats.ultima_atualizacao).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'})}</div>
</footer>

<script src="app.js"></script>
</body>
</html>`;

writeFileSync('dist/index.html', html);

// ── Página de performance ────────────────────────────────────────────────────
const mesesCompletos = Array.from({length:12}, (_,i) => {
  const m = mensal.find(x => parseInt(x.mes) === i+1);
  return m || { mes: i+1, mes_nome: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][i], retorno_pct: null };
});

const maxAbs = Math.max(...mensal.map(m => Math.abs(parseFloat(m.retorno_pct)||0)), 0.01);

const barras = mensal.map(m => {
  const ret = parseFloat(m.retorno_pct);
  const h   = Math.round(Math.abs(ret) / maxAbs * 100);
  const cls = ret >= 0 ? 'pos' : 'neg';
  const fmt = (ret >= 0 ? '+' : '') + (ret * 100).toFixed(1) + '%';
  return `<div class="bw"><div class="bp ${cls}">${fmt}</div><div class="b ${cls}" style="height:${h}%"></div><div class="bm">${m.mes_nome.slice(0,3).toLowerCase()}</div></div>`;
}).join('');

const ultimoMes = mensal[mensal.length - 1] || {};

const perfHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Performance · ${config.nome}</title>
<link rel="stylesheet" href="style.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">
</head>
<body>

<header class="topbar">
  <div class="profile">
    <div class="avatar">${config.nome.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
    <div>
      <div class="pname">${config.nome}</div>
      <div class="pdesc">${config.estrategia}</div>
    </div>
  </div>
  <div class="topstats">
    <div class="ts"><div class="ts-val ${cor(stats.retorno_acumulado/100)}">${pct(stats.retorno_acumulado/100)}</div><div class="ts-lbl">acumulado</div></div>
    <div class="ts"><div class="ts-val">${(stats.win_rate*100).toFixed(0)}%</div><div class="ts-lbl">win rate</div></div>
    <div class="ts"><div class="ts-val">${stats.total_trades}</div><div class="ts-lbl">trades</div></div>
  </div>
</header>

<nav class="nav">
  <a class="nav-item" href="index.html">Trade ideas</a>
  <a class="nav-item active" href="performance.html">Performance</a>
</nav>

<main class="page">
  <div class="kpi-row">
    <div class="kpi"><div class="kpi-lbl">Retorno acumulado</div><div class="kpi-val ${cor(stats.retorno_acumulado/100)}">${pct(stats.retorno_acumulado/100)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Win rate</div><div class="kpi-val">${(stats.win_rate*100).toFixed(0)}%</div><div class="kpi-sub">${stats.total_trades} trades</div></div>
    <div class="kpi"><div class="kpi-lbl">Melhor mês</div><div class="kpi-val pos">${pct(Math.max(...mensal.map(m=>parseFloat(m.retorno_pct)||0)))}</div></div>
    <div class="kpi"><div class="kpi-lbl">Max drawdown</div><div class="kpi-val neg">${pct(Math.min(...mensal.map(m=>parseFloat(m.max_drawdown)||0)))}</div></div>
  </div>

  <div class="chart-card">
    <div class="chart-head">Retorno mensal (%)</div>
    <div class="bars">${barras}</div>
  </div>

  <div class="cal">
    ${mesesCompletos.map(m => m.retorno_pct !== null ? mesCard(m) : `<div class="mc"><div class="mc-name">${m.mes_nome}</div><div class="mc-val nd">—</div><div class="mc-bar"></div></div>`).join('')}
  </div>

  ${ultimoMes.notas ? `
  <div class="note-card">
    <div class="note-head">${ultimoMes.mes_nome} ${ultimoMes.ano} — notas do mês</div>
    <div class="note-body">${ultimoMes.notas}</div>
  </div>` : ''}
</main>

<footer class="footer">
  <div>© ${new Date().getFullYear()} ${config.nome}</div>
  <div class="updated">Atualizado: ${new Date(stats.ultima_atualizacao).toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'})}</div>
</footer>

<script src="app.js"></script>
</body>
</html>`;

writeFileSync('dist/performance.html', perfHtml);
console.log('✓ dist/index.html e dist/performance.html gerados');
