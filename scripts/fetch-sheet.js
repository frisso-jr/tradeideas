// scripts/fetch-sheet.js
// Busca as abas trades, mensal e config e salva em src/data.json

import { google } from 'googleapis';
import { writeFileSync, mkdirSync } from 'fs';

const SHEET_ID = process.env.SHEET_ID;
const SA_KEY   = JSON.parse(process.env.GOOGLE_SA_KEY);

const auth = new google.auth.GoogleAuth({
  credentials: SA_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly',
           'https://www.googleapis.com/auth/drive.readonly'],
});

async function fetchSheet(sheets, range) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });
  return res.data.values || [];
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const [headers, ...data] = rows;
  return data.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']))
  );
}

async function downloadDriveImage(drive, fileUrl) {
  // Extrai o file ID do link do Drive
  const match = fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const fileId = match[1];
  try {
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data);
  } catch {
    return null;
  }
}

async function main() {
  const client  = await auth.getClient();
  const sheets  = google.sheets({ version: 'v4', auth: client });
  const drive   = google.drive({ version: 'v3', auth: client });

  const [tradesRaw, mensalRaw, configRaw, subsRaw] = await Promise.all([
    fetchSheet(sheets, 'trades!A:P'),
    fetchSheet(sheets, 'mensal!A:H'),
    fetchSheet(sheets, 'config!A:B'),
    fetchSheet(sheets, 'subscribers!A:H'),
  ]);

  const trades  = rowsToObjects(tradesRaw);
  const mensal  = rowsToObjects(mensalRaw);
  const configArr = rowsToObjects(configRaw);
  const config  = Object.fromEntries(configArr.map(r => [r.chave, r.valor]));
  const subCount = rowsToObjects(subsRaw).filter(r => r.status === 'ativo').length;

  // Baixar imagens do Drive e salvar localmente
  mkdirSync('dist/img/trades', { recursive: true });

  for (const trade of trades) {
    if (!trade.imagem_url) continue;
    const buf = await downloadDriveImage(drive, trade.imagem_url);
    if (buf) {
      const slug = `${trade.ativo}_${trade.data_abertura.replace(/\//g, '-')}`.toLowerCase();
      const path = `dist/img/trades/${slug}.jpg`;
      writeFileSync(path, buf);
      trade.imagem_local = `/img/trades/${slug}.jpg`;
    }
  }

  // Calcular métricas globais
  const fechadas  = trades.filter(t => ['Fechada','Stopada'].includes(t.status));
  const vencedoras = fechadas.filter(t => parseFloat(t.resultado_pct) > 0);
  const acumulado  = mensal.reduce((s, m) => s + parseFloat(m.retorno_pct || 0), 0);

  const stats = {
    total_trades:  trades.length,
    abertas:       trades.filter(t => t.status === 'Aberta' || t.status === 'Parcial').length,
    win_rate:      fechadas.length ? vencedoras.length / fechadas.length : 0,
    retorno_acumulado: acumulado,
    subscribers:   subCount,
    ultima_atualizacao: new Date().toISOString(),
  };

  mkdirSync('src', { recursive: true });
  writeFileSync('src/data.json', JSON.stringify({ config, trades, mensal, stats }, null, 2));
  console.log(`✓ ${trades.length} trades · ${mensal.length} meses · dados salvos`);
}

main().catch(e => { console.error(e); process.exit(1); });
