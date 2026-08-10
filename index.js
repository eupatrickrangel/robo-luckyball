const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/'; 

async function iniciarRobo() {
  console.log('🤖 Iniciando scraper avançado no Railway...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--disable-software-rasterizer'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

  try {
    console.log('🌐 Acessando a página principal...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Página principal carregada!');
  } catch (e) {
    console.error('❌ Erro ao acessar URL:', e.message);
  }

  // Loop de varredura a cada 10 segundos
  setInterval(async () => {
    try {
      console.log('🔍 Varrendo frames e elementos da página...');

      // O Puppeteer vai vasculhar a página principal E dentro de todos os iframes do jogo
      const bolas = await page.evaluate(() => {
        let resultados = [];

        // Função para extrair números de um documento (seja a página ou iframe)
        const extrairDeDoc = (doc) => {
          // Busca por elementos que contenham números ou classes comuns de bolas de sorteio
          const nodes = doc.querySelectorAll('span, div, p, [class*="ball"], [class*="number"], [class*="numero"]');
          nodes.forEach(el => {
            const texto = el.innerText ? el.innerText.trim() : '';
            const num = parseInt(texto, 10);
            // Filtra apenas números válidos de sorteio (ex: 1 a 60)
            if (!isNaN(num) && num >= 1 && num <= 60 && texto.length <= 2) {
              resultados.push(num);
            }
          });
        };

        // Varre a página principal
        extrairDeDoc(document);

        // Varre todos os iframes embutidos na página
        const frames = document.querySelectorAll('iframe');
        frames.forEach(frame => {
          try {
            if (frame.contentDocument) {
              extrairDeDoc(frame.contentDocument);
            }
          } catch (err) {
            // Ignora iframes cross-origin restritos
          }
        });

        return [...new Set(resultados)];
      });

      console.log(`📊 Números encontrados na varredura:`, bolas);

      if (bolas.length > 0) {
        const payload = {
          bolas: bolas,
          horario: new Date().toISOString()
        };

        const resposta = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        console.log('🚀 Rodada enviada com sucesso para a API! Status:', resposta.status);
      } else {
        console.log('⚠️ Nenhum número localizado neste ciclo. Tentando novamente...');
      }

    } catch (err) {
      console.error('❌ Erro durante o ciclo de varredura:', err.message);
    }
  }, 10000);
}

iniciarRobo();