const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

const USER = process.env.BET_USER;
const PASS = process.env.BET_PASS;

async function iniciarRobo() {
  console.log('🤖 [SNIFFER DE ESTUDO] Conectando ao motor do jogo...');

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

  // Intercepta respostas de rede HTTP/Fetch
  page.on('response', async (res) => {
    try {
      const url = res.url();
      if (res.headers()['content-type'] && res.headers()['content-type'].includes('application/json')) {
        const json = await res.json().catch(() => null);
        if (json) {
          const textoJson = JSON.stringify(json);
          // Filtra termos relevantes para estudo
          if (textoJson.includes('number') || textoJson.includes('ball') || textoJson.includes('major') || textoJson.includes('grand') || textoJson.includes('mega')) {
            console.log('📦 [HTTP JSON CAPTURADO]:', textoJson.substring(0, 300));
          }
        }
      }
    } catch (e) {}
  });

  try {
    console.log('🌐 Acessando a mesa de apostas...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

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
      console.log('✍️ Injetando credenciais...');
      await inputs[0].type(USER, { delay: 50 });
      if (inputs[1]) await inputs[1].type(PASS, { delay: 50 });
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
  } catch (e) {
    console.log('⚠️ Aviso no fluxo:', e.message);
  }

  // Interceptador avançado de WebSocket na raiz da página
  await page.evaluateOnNewDocument(() => {
    const OrigWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = new OrigWS(url, protocols);
      ws.addEventListener('message', function(event) {
        try {
          // Envia o pacote WebSocket bruto para os logs do Node.js
          console.log('WS_PACKET:' + event.data);
        } catch (err) {}
      });
      return ws;
    };
  });

  // Captura o log impresso pelo WebSocket da página
  page.on('console', async (msg) => {
    const text = msg.text();
    if (text.startsWith('WS_PACKET:')) {
      const conteudo = text.replace('WS_PACKET:', '');
      
      // Se a mensagem contiver termos de jogo, exibe nos logs para análise
      const lower = conteudo.toLowerCase();
      if (lower.includes('ball') || lower.includes('number') || lower.includes('result') || lower.includes('major') || lower.includes('grand') || lower.includes('mega')) {
        console.log('⚡ [WEBSOCKET AO VIVO]:', conteudo);

        // Dispara para a sua API se achar números ou jackpots
        const bolas = [];
        const jackpots = [];

        if (lower.includes('major')) jackpots.push('MAJOR');
        if (lower.includes('grand')) jackpots.push('GRAND');
        if (lower.includes('mega')) jackpots.push('MEGA');

        const matches = conteudo.match(/\b([1-9][0-9]?|100)\b/g);
        if (matches) {
          matches.forEach(m => {
            const num = parseInt(m);
            if (num >= 1 && num <= 100 && !bolas.includes(num)) bolas.push(num);
          });
        }

        if (bolas.length > 0 || jackpots.length > 0) {
          console.log('🎯 Disparando para API Render -> Bolas:', bolas, '| Jackpots:', jackpots);
          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bolas, jackpots, horario: new Date().toISOString() })
          }).catch(() => {});
        }
      }
    }
  });

  console.log('🚀 Monitoramento de pacotes WebSocket e HTTP em andamento...');
}

iniciarRobo();
