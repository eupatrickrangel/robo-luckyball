const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

const USER = process.env.BET_USER;
const PASS = process.env.BET_PASS;

async function iniciarRobo() {
  console.log('🤖 [ROBÔ NETWORK SNIFFER] Iniciando interceptação de rede e dados...');

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

  // Intercepta todas as requisições de rede e respostas JSON do jogo em tempo real
  page.on('response', async (response) => {
    try {
      const url = response.url();
      // Monitora chamadas de API ou dados de estado do jogo
      if (response.headers()['content-type'] && response.headers()['content-type'].includes('application/json')) {
        const json = await response.json().catch(() => null);
        if (json) {
          analisarDadosDoJogo(json);
        }
      }
    } catch (e) {
      // Ignora erros de parsing em arquivos estáticos
    }
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
      console.log('✍️ Injetando credenciais de acesso...');
      await inputs[0].type(USER, { delay: 50 });
      if (inputs[1]) {
        await inputs[1].type(PASS, { delay: 50 });
      }
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 8000));
    }

  } catch (e) {
    console.log('⚠️ Aviso no fluxo:', e.message);
  }

  // Intercepta também mensagens trocadas via WebSocket dentro da página do jogo
  await page.evaluateOnNewDocument(() => {
    const OrigWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = new OrigWebSocket(url, protocols);
      ws.addEventListener('message', function(event) {
        try {
          // Dispara um evento customizado para o Puppeteer capturar o pacote WebSocket
          window.postMessage({ type: 'WS_DATA', data: event.data }, '*');
        } catch (err) {}
      });
      return ws;
    };
  });

  // Escuta os dados capturados pelo WebSocket injetado
  page.on('console', async (msg) => {
    const text = msg.text();
    if (text.startsWith('WS_SNIFF:')) {
      try {
        const payload = JSON.parse(text.replace('WS_SNIFF:', ''));
        analisarDadosDoJogo(payload);
      } catch (e) {}
    }
  });

  await page.exposeFunction('notificarAPI', async (dados) => {
    try {
      console.log('🎯 [DADOS CAPTURADOS VIA REDE]:', dados);
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
      console.log('❌ Erro ao enviar para API do Render:', err.message);
    }
  });

  // Injetando o ouvinte de mensagens do WebSocket na página
  await page.evaluate(() => {
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'WS_DATA') {
        console.log('WS_SNIFF:' + JSON.stringify(event.data.data));
      }
    });
  });

  console.log('🚀 Sniffer de rede ativo. Monitorando pacotes do jogo...');
  
  // Função auxiliar de análise de pacotes de dados
  function analisarDadosDoJogo(obj) {
    try {
      const str = JSON.stringify(obj);
      const bolasEncontradas = [];
      const jackpotsEncontrados = [];

      // Procura por jackpots no payload
      const strLower = str.toLowerCase();
      if (strLower.includes('major') && !jackpotsEncontrados.includes('MAJOR')) jackpotsEncontrados.push('MAJOR');
      if (strLower.includes('grand') && !jackpotsEncontrados.includes('GRAND')) jackpotsEncontrados.push('GRAND');
      if (strLower.includes('mega') && !jackpotsEncontrados.includes('MEGA')) jackpotsEncontrados.push('MEGA');

      // Procura por números válidos de bolas (1 a 100) dentro do JSON do jogo
      const matches = str.match(/\b([1-9][0-9]?|100)\b/g);
      if (matches) {
        matches.forEach(m => {
          const num = parseInt(m);
          if (num >= 1 && num <= 100 && !bolasEncontradas.includes(num)) {
            bolasEncontradas.push(num);
          }
        });
      }

      if (bolasEncontradas.length > 0 || jackpotsEncontrados.length > 0) {
        // Envia para a função exposta no Node
        page.evaluate((b, j) => {
          window.notificarAPI({ bolas: b, jackpots: j });
        }, bolasEncontradas, jackpotsEncontrados).catch(() => {});
      }
    } catch (e) {}
  }
}

iniciarRobo();
