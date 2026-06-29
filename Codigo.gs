// ═══════════════════════════════════════════════════════════════
// TRADE IDEAS — Apps Script
// Cole este código em Extensões > Apps Script na sua planilha
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  GITHUB_TOKEN:    PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN'),
  GITHUB_REPO:     PropertiesService.getScriptProperties().getProperty('GITHUB_REPO'),   // "usuario/repositorio"
  TELEGRAM_TOKEN:  PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN'),
  TELEGRAM_CHAT:   PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT'),  // ID do canal/grupo
  SENDGRID_KEY:    PropertiesService.getScriptProperties().getProperty('SENDGRID_KEY'),
  EMAIL_REMETENTE: PropertiesService.getScriptProperties().getProperty('EMAIL_REMETENTE'),
  EMAIL_NOME:      PropertiesService.getScriptProperties().getProperty('EMAIL_NOME'),
};

// ── Trigger principal: disparado ao editar qualquer célula ───────────────────
function onEdit(e) {
  if (!e) return;
  const sheet = e.range.getSheet();
  const nome  = sheet.getName();

  if (nome === 'trades')      handleTradeEdit(e, sheet);
  if (nome === 'mensal')      handleMensalEdit(e, sheet);
  if (nome === 'subscribers') return; // sem ação automática
  if (nome === 'config')      triggerDeploy('config_atualizada');
}

// ── Edição na aba trades ─────────────────────────────────────────────────────
function handleTradeEdit(e, sheet) {
  const col    = e.range.getColumn();
  const row    = e.range.getRow();
  if (row < 2) return; // ignorar cabeçalho

  const COL_STATUS   = 11; // K
  const COL_NOTIFICAR = 15; // O

  const statusMudou   = col === COL_STATUS;
  const notificar     = sheet.getRange(row, COL_NOTIFICAR).getValue();

  if (!statusMudou) {
    // edição em outro campo: só deploy sem notificação
    triggerDeploy('trade_editada');
    return;
  }

  const dados = getTradeRow(sheet, row);

  if (notificar === 'Sim') {
    const msg = formatMensagemTrade(dados);
    notificarTelegram(msg);
    notificarEmail(dados);
  }

  triggerDeploy('status_alterado');
}

// ── Edição na aba mensal ─────────────────────────────────────────────────────
function handleMensalEdit(e, sheet) {
  const row = e.range.getRow();
  if (row < 2) return;

  const dados = getMensalRow(sheet, row);
  const msg   = formatMensagemMensal(dados);

  notificarTelegram(msg);
  notificarEmailLista(msg, 'Resultado mensal: ' + dados.mes_nome + ' ' + dados.ano);
  triggerDeploy('mes_fechado');
}

// ── Leitura de dados ─────────────────────────────────────────────────────────
function getTradeRow(sheet, row) {
  const v = sheet.getRange(row, 1, 1, 16).getValues()[0];
  return {
    data_abertura: Utilities.formatDate(new Date(v[0]), 'America/Sao_Paulo', 'dd/MM/yyyy'),
    ativo:         v[1],  direcao:      v[2],
    entrada:       v[3],  stop:         v[4],
    alvo_parcial:  v[5],  alvo_final:   v[6],
    saida:         v[7],  resultado_pct: v[8],
    risco_retorno: v[9],  status:       v[10],
    timeframe:     v[11], racional:     v[12],
    tags:          v[13], notificar:    v[14],
    imagem_url:    v[15],
  };
}

function getMensalRow(sheet, row) {
  const v = sheet.getRange(row, 1, 1, 8).getValues()[0];
  return {
    ano: v[0], mes: v[1], mes_nome: v[2],
    retorno_pct: v[3], num_trades: v[4],
    win_rate: v[5], max_drawdown: v[6], notas: v[7],
  };
}

// ── Formatação das mensagens ─────────────────────────────────────────────────
function formatMensagemTrade(d) {
  const emoji = { Long: '📈', Short: '📉' };
  const statusEmoji = {
    Aberta: '🔵', Parcial: '🟡', Fechada: '🟢', Stopada: '🔴'
  };
  const pct = d.resultado_pct ? (d.resultado_pct * 100).toFixed(1) + '%' : '—';
  const rr  = d.risco_retorno ? d.risco_retorno.toFixed(1) + '×' : '—';
  const site = 'https://' + getConfig('dominio');

  return [
    `${emoji[d.direcao] || '📊'} *${d.ativo}* — ${d.direcao}`,
    `${statusEmoji[d.status] || '⚪'} Status: *${d.status}*`,
    ``,
    `📅 ${d.data_abertura} · ${d.timeframe}`,
    `📥 Entrada: *${d.entrada}*`,
    `🛑 Stop: *${d.stop}*`,
    `🎯 Alvo parcial: *${d.alvo_parcial}*`,
    `🏁 Alvo final: *${d.alvo_final}*`,
    d.saida ? `📤 Saída: *${d.saida}* · ${pct}` : `📊 R/R: *${rr}*`,
    ``,
    `💬 ${d.racional}`,
    `🏷 ${d.tags}`,
    ``,
    `🔗 ${site}`,
  ].join('\n');
}

function formatMensagemMensal(d) {
  const ret  = (d.retorno_pct * 100).toFixed(1);
  const wr   = (d.win_rate * 100).toFixed(0);
  const dd   = (d.max_drawdown * 100).toFixed(1);
  const sinal = ret >= 0 ? '📈' : '📉';
  const site  = 'https://' + getConfig('dominio');

  return [
    `${sinal} *Resultado de ${d.mes_nome} ${d.ano}*`,
    ``,
    `📊 Retorno: *${ret >= 0 ? '+' : ''}${ret}%*`,
    `✅ Win rate: *${wr}%* (${d.num_trades} trades)`,
    `📉 Max drawdown: *${dd}%*`,
    ``,
    `💬 ${d.notas}`,
    ``,
    `🔗 ${site}/performance`,
  ].join('\n');
}

// ── Telegram ─────────────────────────────────────────────────────────────────
function notificarTelegram(texto) {
  if (!CONFIG.TELEGRAM_TOKEN || !CONFIG.TELEGRAM_CHAT) return;
  try {
    UrlFetchApp.fetch(
      `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`,
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id:    CONFIG.TELEGRAM_CHAT,
          text:       texto,
          parse_mode: 'Markdown',
        }),
      }
    );
  } catch (err) {
    console.error('Telegram error:', err);
  }
}

// ── E-mail via SendGrid ───────────────────────────────────────────────────────
function notificarEmail(dadosTrade) {
  const lista = getSubscribers('email');
  if (!lista.length) return;

  const site    = 'https://' + getConfig('dominio');
  const pct     = dadosTrade.resultado_pct
    ? (dadosTrade.resultado_pct * 100).toFixed(1) + '%' : '—';
  const assunto = `[Trade Idea] ${dadosTrade.ativo} ${dadosTrade.direcao} — ${dadosTrade.status}`;
  const corpo   = buildEmailHtml(dadosTrade, site, pct);

  sendEmail(lista, assunto, corpo);
}

function notificarEmailLista(textoPlano, assunto) {
  const lista = getSubscribers('email');
  if (!lista.length) return;
  const corpo = `<pre style="font-family:sans-serif;white-space:pre-wrap">${textoPlano}</pre>`;
  sendEmail(lista, assunto, corpo);
}

function sendEmail(destinatarios, assunto, html) {
  if (!CONFIG.SENDGRID_KEY) return;
  const payload = {
    personalizations: destinatarios.map(e => ({ to: [{ email: e }] })),
    from:    { email: CONFIG.EMAIL_REMETENTE, name: CONFIG.EMAIL_NOME },
    subject: assunto,
    content: [{ type: 'text/html', value: html }],
  };
  try {
    UrlFetchApp.fetch('https://api.sendgrid.com/v3/mail/send', {
      method:      'post',
      contentType: 'application/json',
      headers:     { Authorization: 'Bearer ' + CONFIG.SENDGRID_KEY },
      payload:     JSON.stringify(payload),
    });
  } catch (err) {
    console.error('SendGrid error:', err);
  }
}

function buildEmailHtml(d, site, pct) {
  const cor = getConfig('cor_destaque') || '#1D9E75';
  return `
<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#222">
<div style="border-left:4px solid ${cor};padding-left:16px;margin-bottom:20px">
  <h2 style="margin:0 0 4px">${d.ativo} — ${d.direcao}</h2>
  <span style="font-size:13px;color:#666">${d.timeframe} · ${d.data_abertura}</span>
</div>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px">
  <tr><td style="padding:6px 0;color:#666">Status</td><td style="padding:6px 0;font-weight:bold">${d.status}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Entrada</td><td style="padding:6px 0">${d.entrada}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Stop</td><td style="padding:6px 0">${d.stop}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Alvo parcial</td><td style="padding:6px 0">${d.alvo_parcial}</td></tr>
  <tr><td style="padding:6px 0;color:#666">Alvo final</td><td style="padding:6px 0">${d.alvo_final}</td></tr>
  ${d.saida ? `<tr><td style="padding:6px 0;color:#666">Resultado</td><td style="padding:6px 0;font-weight:bold;color:${parseFloat(pct)>=0?'#0F6E56':'#A32D2D'}">${pct}</td></tr>` : ''}
</table>
<p style="font-size:14px;color:#444;line-height:1.6;margin-bottom:20px">${d.racional}</p>
<a href="${site}" style="background:${cor};color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">Ver no site</a>
<p style="font-size:11px;color:#999;margin-top:24px">Você recebe este e-mail pois se inscreveu em ${site}.<br>
<a href="${site}/unsubscribe?email=EMAIL" style="color:#999">Cancelar inscrição</a></p>
</body></html>`;
}

// ── Subscribers ───────────────────────────────────────────────────────────────
function getSubscribers(canal) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('subscribers');
  if (!sheet) return [];
  const data  = sheet.getDataRange().getValues();
  return data.slice(1)
    .filter(r => r[4] === 'ativo' && (r[5] === canal || r[5] === 'ambos'))
    .map(r => r[0])
    .filter(Boolean);
}

// ── Config ────────────────────────────────────────────────────────────────────
function getConfig(chave) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('config');
  if (!sheet) return '';
  const data  = sheet.getDataRange().getValues();
  const row   = data.find(r => r[0] === chave);
  return row ? row[1] : '';
}

// ── GitHub dispatch (dispara o build do site) ─────────────────────────────────
function triggerDeploy(motivo) {
  if (!CONFIG.GITHUB_TOKEN || !CONFIG.GITHUB_REPO) return;
  try {
    UrlFetchApp.fetch(
      `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/dispatches`,
      {
        method:      'post',
        contentType: 'application/json',
        headers: {
          Authorization: 'token ' + CONFIG.GITHUB_TOKEN,
          Accept:        'application/vnd.github.v3+json',
        },
        payload: JSON.stringify({
          event_type:     'planilha_atualizada',
          client_payload: { motivo },
        }),
      }
    );
  } catch (err) {
    console.error('GitHub dispatch error:', err);
  }
}

// ── Inscrição via formulário do site (chamado por webhook) ────────────────────
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();
    const sub  = ss.getSheetByName('subscribers');
    sub.appendRow([
      body.email,
      body.nome || '',
      'gratuito',
      Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy'),
      'ativo',
      body.canal || 'email',
      body.telegram_id || '',
      'site',
    ]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, erro: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
