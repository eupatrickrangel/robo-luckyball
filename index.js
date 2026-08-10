const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const fs = require('fs');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/'; 

async function iniciarRobo() {
  console.log('🤖 Iniciando scraper no Railway...');

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
  await page.setViewport({ width: 1280, height: 800 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log('🌐 Acessando URL do jogo...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Página carregada com sucesso!');

    // Aguarda 8 segundos para garantir carregamento de scripts internos
    await new Promise(r => setTimeout(r, 8000));

    // Salva print e HTML para diagnóstico caso precise
    await page.screenshot({ path: 'print_jogo.png' });
    const htmlContent = await page.content();
    console.log(`📄 Tamanho do HTML carregado: ${htmlContent.length} caracteres`);

  } catch (e) {
    console.error('❌ Erro ao carregar a página:', e.message);
  }

  // Loop de varredura
  setInterval(async () => {
    try {
      console.log('🔍 Varrendo elementos da tela...');

      const bolas = await page.evaluate(() => {
        // Tenta buscar por múltiplos seletores comuns de números em jogos de loteria/sorteio
        const seletores = '[class*="ball"], [class*="number"], [class*="numero"], [class*="sorteio"]';
        const elementos = document.querySelectorAll(seletores);
        
        if (!elementos || elementos.length === 0) return [];

        return Array.from(elementos)
          .map(el => parseInt(el.innerText.trim(), 10))
          .filter(n => !isNaN(n) && n >= 1 && n <= 60);
      });

      const bolasUnicas = [...new Set(bolas)];
      console.log(`📊 Números detectados:`, bolasUnicas);

      if (bolasUnicas.length > 0) {
        const payload = {
          bolas: bolasUnicas,
          horario: new Date().toISOString()
        };

        const resposta = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        console.log('🚀 Rodada enviada com sucesso! Status:', resposta.status);
      }

    } catch (err) {
      console.error('❌ Erro no loop:', err.message);
    }
  }, 10000);
}

iniciarRobo();