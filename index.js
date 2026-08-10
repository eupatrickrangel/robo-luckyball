const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/'; 

async function iniciarRobo() {
  console.log('🤖 Iniciando scraper do Lucky Ball...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto(GAME_URL, { waitUntil: 'networkidle2' });

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
      console.error('❌ Erro:', err.message);
    }
  }, 10000);
}

iniciarRobo();