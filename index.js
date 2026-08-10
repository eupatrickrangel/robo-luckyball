const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/'; 

async function iniciarRobo() {
  console.log('🤖 Iniciando scraper no Railway...');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--single-process'
      ]
    });
  } catch (e) {
    console.error('❌ Erro ao abrir o navegador:', e.message);
    return;
  }

  const page = await browser.newPage();

  // Otimização de memória
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    await page.goto(GAME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('✅ Conectado ao jogo!');
  } catch (e) {
    console.error('❌ Erro ao carregar URL:', e.message);
  }

  setInterval(async () => {
    try {
      const bolas = await page.evaluate(() => {
        const elementos = document.querySelectorAll('[class*="ball__number"]');
        if (!elementos || elementos.length === 0) return [];

        const lista = Array.from(elementos)
          .map(el => parseInt(el.innerText.trim(), 10))
          .filter(n => !isNaN(n) && n >= 1 && n <= 60);

        return [...new Set(lista)];
      });

      if (bolas.length > 0) {
        const payload = {
          bolas: bolas,
          horario: new Date().toISOString()
        };

        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        console.log('🚀 Rodada REAL enviada:', payload);
      }
    } catch (err) {
      console.error('❌ Erro na varredura:', err.message);
    }
  }, 10000);
}

iniciarRobo();