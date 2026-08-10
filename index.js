const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/'; 

async function iniciarRobo() {
  console.log('🤖 Iniciando scraper com auto-clique no Railway...');

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
    console.log('🌐 Acessando a página principal...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Página principal carregada!');

    // Aguarda 5 segundos para os elementos iniciais aparecerem
    await new Promise(r => setTimeout(r, 5000));

    // Tenta clicar em qualquer botão de "Entrar", "Jogar" ou no centro da tela para destravar o jogo
    console.log('🖱️ Simulando clique inicial na tela...');
    await page.mouse.click(683, 384); // Clica no centro da tela
    await new Promise(r => setTimeout(r, 5000));

  } catch (e) {
    console.error('❌ Erro na preparação inicial:', e.message);
  }

  // Loop de varredura a cada 10 segundos
  setInterval(async () => {
    try {
      console.log('🔍 Varrendo frames e elementos...');

      const bolas = await page.evaluate(() => {
        let resultados = [];

        const extrairDeDoc = (doc) => {
          // Busca por todos os elementos de texto curto que pareçam números de 1 a 60
          const nodes = doc.querySelectorAll('span, div, p, strong, b');
          nodes.forEach(el => {
            const texto = el.innerText ? el.innerText.trim() : '';
            const num = parseInt(texto, 10);
            if (!isNaN(num) && num >= 1 && num <= 60 && texto.length <= 2) {
              resultados.push(num);
            }
          });
        };

        extrairDeDoc(document);

        const frames = document.querySelectorAll('iframe');
        frames.forEach(frame => {
          try {
            if (frame.contentDocument) {
              extrairDeDoc(frame.contentDocument);
            }
          } catch (err) {}
        });

        return [...new Set(resultados)];
      });

      console.log(`📊 Números detectados:`, bolas);

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

        console.log('🚀 Rodada enviada com sucesso! Status:', resposta.status);
      } else {
        console.log('⚠️ Nenhum número localizado neste ciclo.');
      }

    } catch (err) {
      console.error('❌ Erro no loop de varredura:', err.message);
    }
  }, 10000);
}

iniciarRobo();