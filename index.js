const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

const USER = process.env.BET_USER;
const PASS = process.env.BET_PASS;

async function iniciarRobo() {
  console.log('🤖 [ESTUDO - SNIFFER MULTI-FRAME] Iniciando rastreamento de alta profundidade...');

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

  // Função centralizada para processar e enviar os dados capturados
  async function processarDadoBruto(conteudo) {
    try {
      const lower = conteudo.toLowerCase();
      const bolas = [];
      const jackpots = [];

      if (lower.includes('major')) jackpots.push('MAJOR');
      if (lower.includes('grand')) jackpots.push('GRAND');
      if (lower.includes('mega')) jackpots.push('MEGA');

      // Extrai números válidos do sorteio
      const matches = conteudo.match(/\b([1-9][0-9]?|100)\b/g);
      if (matches) {
        matches.forEach(m => {
          const num = parseInt(m);
          if (num >= 1 && num <= 100 && !bolas.includes(num)) {
            bolas.push(num);
          }
        });
      }

      if (bolas.length > 0 || jackpots.length > 0) {
        console.log('🎯 [DADOS EXTRAÍDOS COM SUCESSO] Bolas:', bolas, '| Jackpots:', jackpots);
        
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bolas,
            jackpots,
            horario: new Date().toISOString()
          })
        }).catch(() => {});
      }
    } catch (e) {}
  }

  // Intercepta requisições de rede HTTP da página principal e sub-iframes
  page.on('response', async (res) => {
    try {
      if (res.headers()['content-type'] && res.headers()['content-type'].includes('application/json')) {
        const json = await res.json().catch(() => null);
        if (json) {
          await processarDadoBruto(JSON.stringify(json));
        }
      }
    } catch (e) {}
  });

  try {
    console.log('🌐 Acessando a mesa de apostas...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Tratativa de login caso apareça na página principal
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

  // Injeta o gancho de WebSocket em todos os quadros (inclusive iframes do jogo)
  await page.evaluateOnNewDocument(() => {
    const OrigWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = new OrigWS(url, protocols);
      ws.addEventListener('message', function(event) {
        try {
          console.log('WS_DATA_SNIFF:' + event.data);
        } catch (err) {}
      });
      return ws;
    };
  });

  // Função para anexar o listener de console em todos os frames existentes e futuros
  const monitorarFrame = (frame) => {
    frame.on('console', async (msg) => {
      const text = msg.text();
      if (text.startsWith('WS_DATA_SNIFF:')) {
        const payload = text.replace('WS_DATA_SNIFF:', '');
        await processarDadoBruto(payload);
      }
    });
  };

  page.on('frameattached', frame => monitorarFrame(frame));
  page.frames().forEach(frame => monitorarFrame(frame));

  // Injetar script de WebSocket listener nos iframes já carregados
  setInterval(async () => {
    try {
      const frames = page.frames();
      for (const fr of frames) {
        await fr.evaluate(() => {
          if (!window.__ws_hooked) {
            window.__ws_hooked = true;
            const OrigWS = window.WebSocket;
            window.WebSocket = function(url, protocols) {
              const ws = new OrigWS(url, protocols);
              ws.addEventListener('message', function(event) {
                console.log('WS_DATA_SNIFF:' + event.data);
              });
              return ws;
            };
          }
        }).catch(() => {});
      }
    } catch (e) {}
  }, 5000);

  console.log('🚀 Sniffer multi-frame e WebSocket ativado com sucesso. Aguardando eventos da mesa...');
}

iniciarRobo();
