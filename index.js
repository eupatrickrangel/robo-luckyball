const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

const USER = process.env.BET_USER;
const PASS = process.env.BET_PASS;

async function iniciarRobo() {
  console.log('🤖 [APP SNIFFER] Conectando ao fluxo de dados da mesa...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    console.log('🌐 Acessando a mesa de apostas...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Tentativa automática de login se houver elementos visíveis
    const botoesLogin = await page.$$('button, a');
    for (const btn of botoesLogin) {
      const texto = await page.evaluate(el => el.innerText, btn);
      if (texto && (texto.toLowerCase().includes('entrar') || texto.toLowerCase().includes('login'))) {
        await btn.click().catch(() => {});
        break;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    const inputs = await page.$$('input');
    if (inputs.length >= 2 && USER && PASS) {
      console.log('✍️ Injetando credenciais de acesso...');
      await inputs[0].type(USER, { delay: 50 });
      if (inputs[1]) await inputs[1].type(PASS, { delay: 50 });
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
  } catch (e) {
    console.log('⚠️ Aviso no fluxo:', e.message);
  }

  // Injeta o gancho na raiz do documento para capturar qualquer WebSocket gerado
  await page.evaluateOnNewDocument(() => {
    const OrigWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = new OrigWebSocket(url, protocols);
      ws.addEventListener('message', function(event) {
        try {
          // Envia a mensagem do WebSocket capturada para o console do Node
          console.log('WS_EVENT_RAW:' + event.data);
        } catch (err) {}
      });
      return ws;
    };
  });

  // Expõe função para disparar os dados filtrados para a sua API do Render
  await page.exposeFunction('enviarParaAPIApp', async (dados) => {
    try {
      console.log('🎯 [ENVIANDO PARA SUA API DO RENDER]:', dados);
      await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bolas: dados.bolas || [],
          jackpots: dados.jackpots || [],
          horario: new Date().toISOString()
        })
      });
    } catch (err) {
      console.log('❌ Erro de conexão com a API:', err.message);
    }
  });

  // Ouve os logs do console do navegador injetados pelos iframes/páginas
  page.on('console', async (msg) => {
    const text = msg.text();
    if (text.startsWith('WS_EVENT_RAW:')) {
      const payload = text.replace('WS_EVENT_RAW:', '');
      
      try {
        const lower = payload.toLowerCase();
        const bolas = [];
        const jackpots = [];

        // Captura prêmios especiais solicitados
        if (lower.includes('major')) jackpots.push('MAJOR');
        if (lower.includes('grand')) jackpots.push('GRAND');
        if (lower.includes('mega')) jackpots.push('MEGA');

        // Extração de números válidos de bolas da mesa (1 a 100)
        const matches = payload.match(/\b([1-9][0-9]?|100)\b/g);
        if (matches) {
          matches.forEach(m => {
            const num = parseInt(m);
            if (num >= 1 && num <= 100 && !bolas.includes(num)) {
              bolas.push(num);
            }
          });
        }

        // Se houver dados válidos no pacote de rede, despacha para a API
        if (bolas.length > 0 || jackpots.length > 0) {
          await page.evaluate((b, j) => {
            window.enviarParaAPIApp({ bolas: b, jackpots: j });
          }, bolas, jackpots);
        }
      } catch (e) {}
    }
  });

  console.log('🚀 Sniffer WebSocket de alta performance rodando. Aguardando pacotes do jogo...');
}

iniciarRobo();
