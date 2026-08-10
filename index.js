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
    console.error('❌ Erro fatal ao abrir o navegador:', e.message);
    return;
  }

  const page = await browser.newPage();

  // Define um User-Agent real para evitar bloqueios básicos de bot
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log('🌐 Acessando URL do jogo...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Página carregada com sucesso!');
  } catch (e) {
    console.error('❌ Erro ao carregar a URL:', e.message);
  }

  // Loop de varredura a cada 10 segundos
  setInterval(async () => {
    try {
      console.log('🔍 Procurando bolas na tela...');
      
      // Tenta extrair os dados e logar o que encontrou
      const bolas = await page.evaluate(() => {
        const elementos = document.querySelectorAll('[class*="ball__number"]');
        if (!elementos || elementos.length === 0) return [];

        return Array.from(elementos)
          .map(el => parseInt(el.innerText.trim(), 10))
          .filter(n => !isNaN(n));
      });

      console.log(`📊 Bolas encontradas no momento:`, bolas);

      if (bolas.length > 0) {
        const payload = {
          bolas: [...new Set(bolas)],
          horario: new Date().toISOString()
        };

        const resposta = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        console.log('🚀 Rodada enviada para a API! Status:', resposta.status);
      } else {
        console.log('⚠️ Nenhum número válido mapeado nesta varredura. Verificando novamente em breve...');
      }

    } catch (err) {
      console.error('❌ Erro dentro do loop de varredura:', err.message);
    }
  }, 10000);
}

iniciarRobo();