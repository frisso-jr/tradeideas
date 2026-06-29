# Trade Ideas — Setup completo

## Arquivos deste projeto

```
trade-ideas/
├── .github/workflows/deploy.yml   ← GitHub Actions (build + deploy automático)
├── scripts/
│   ├── fetch-sheet.js             ← Busca dados do Google Sheets
│   └── build.js                   ← Gera o HTML estático
├── src/assets/
│   ├── style.css                  ← CSS do site
│   └── app.js                     ← JS do browser (filtros, cotações, inscrição)
├── apps-script/
│   └── Codigo.gs                  ← Cole no Google Apps Script da planilha
└── package.json
```

---

## 1. Planilha no Google Sheets

1. Importe o arquivo `trade-ideas-planilha.xlsx` no Google Drive
2. Abra-o como Google Sheets (Arquivo → Salvar como Google Sheets)
3. Anote o **ID da planilha** — está na URL: `docs.google.com/spreadsheets/d/SEU_ID_AQUI/edit`

---

## 2. Apps Script (notificações + webhook)

1. Na planilha, vá em **Extensões → Apps Script**
2. Apague o código padrão e cole o conteúdo de `apps-script/Codigo.gs`
3. Salve (Ctrl+S)
4. Configure as variáveis de ambiente em **Projeto → Propriedades do script**:

| Chave           | Valor                                      |
|-----------------|--------------------------------------------|
| GITHUB_TOKEN    | Token pessoal do GitHub (repo + workflow)  |
| GITHUB_REPO     | usuario/nome-do-repositorio                |
| TELEGRAM_TOKEN  | Token do bot (via @BotFather)              |
| TELEGRAM_CHAT   | ID do canal ou grupo (ex: -1001234567890)  |
| SENDGRID_KEY    | Chave da API do SendGrid                   |
| EMAIL_REMETENTE | email@seudominio.com                       |
| EMAIL_NOME      | Seu Nome                                   |

5. Publique como **Web App** (para receber inscrições do site):
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
   - Copie a URL gerada — você vai precisar dela no passo 6

6. Instale o trigger:
   - Em Gatilhos (ícone do relógio) → Adicionar gatilho
   - Função: `onEdit` | Origem: Da planilha | Tipo: Ao editar

---

## 3. Conta de serviço do Google (para o GitHub Actions)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto (ou use um existente)
3. Ative as APIs: **Google Sheets API** e **Google Drive API**
4. Crie uma **Conta de serviço** (IAM → Contas de serviço → Criar)
5. Gere uma chave JSON e copie o conteúdo completo
6. Na planilha, compartilhe com o e-mail da conta de serviço (apenas leitura)

---

## 4. Repositório GitHub

1. Crie um repositório no GitHub (pode ser público ou privado)
2. Faça upload de todos os arquivos deste projeto
3. Vá em **Settings → Secrets and variables → Actions** e adicione:

| Secret          | Valor                                |
|-----------------|--------------------------------------|
| SHEET_ID        | ID da planilha do Google Sheets      |
| GOOGLE_SA_KEY   | Conteúdo completo do JSON da conta de serviço |
| DOMINIO         | seudominio.com (sem https://)        |

4. Ative o **GitHub Pages**:
   - Settings → Pages → Source: `gh-pages` branch

---

## 5. Domínio próprio

1. Registre o domínio (Registro.br, Namecheap, etc.)
2. No painel DNS, adicione:
   ```
   CNAME  www   usuario.github.io
   A      @     185.199.108.153
   A      @     185.199.109.153
   A      @     185.199.110.153
   A      @     185.199.111.153
   ```
3. O GitHub Pages vai verificar automaticamente via o secret `DOMINIO`

---

## 6. URL do webhook no site

Após publicar o Apps Script como Web App (passo 2), coloque a URL no HTML:

No arquivo `scripts/build.js`, localize a tag `<body>` e adicione:
```html
<body data-webhook-url="SUA_URL_DO_APPS_SCRIPT">
```

---

## 7. Telegram — criar o bot e canal

1. Abra o Telegram e fale com **@BotFather**
2. `/newbot` → siga as instruções → copie o token
3. Crie um canal público ou grupo
4. Adicione o bot como administrador
5. Para obter o chat_id do canal: envie uma mensagem e acesse
   `https://api.telegram.org/botSEU_TOKEN/getUpdates`

---

## Fluxo após configurado

```
Você edita a planilha
    ↓
Apps Script detecta mudança de status
    ↓
Telegram → mensagem no canal
E-mail   → SendGrid dispara para lista de gratuitos
    ↓
GitHub Actions é disparado (repository_dispatch)
    ↓
fetch-sheet.js busca dados atualizados + baixa imagens do Drive
build.js gera index.html + performance.html
    ↓
GitHub Pages publica em ~90 segundos
    ↓
Site atualizado em seudominio.com
```

---

## Cotações ao vivo

O `app.js` busca automaticamente preços para trades abertas:
- **Ações BR**: via [Brapi](https://brapi.dev) (gratuito, sem chave)
- **Cripto**: via [CoinGecko](https://coingecko.com) (gratuito, sem chave)

Ativos suportados automaticamente: BTC, ETH, SOL, BNB
Para adicionar outros, edite o objeto `CRYPTO_IDS` em `src/assets/app.js`.

---

## Futuro — paywall (quando quiser ativar)

O código já prevê a estrutura. Quando quiser ativar:

1. No `build.js`, envolva os detalhes das trades abertas com a classe `locked`
2. No `style.css`, adicione o blur e o overlay de CTA
3. Conecte um webhook da Kiwify/Stripe que adiciona o e-mail na aba `subscribers` com `plano = premium`
4. No `app.js`, valide o token de sessão contra a lista de premium

A função `verificarAcesso(email)` no Apps Script já tem o gancho para isso.
