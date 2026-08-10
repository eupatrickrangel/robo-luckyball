const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

async function iniciarRobo() {
  console.log('🤖 Iniciando scraper na mesa ao vivo...');

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
    console.log('🌐 Acessando a mesa específica do jogo...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Mesa carregada com sucesso!');

    // Aguarda 10 segundos para o stream de vídeo e os painéis de números se conectarem
    await new Promise(r => setTimeout(r, 10000));

  } catch (e) {
    console.error('❌ Erro ao carregar a mesa:', e.message);
  }

  // Loop de varredura a cada 10 segundos
  setInterval(async () => {
    try {
      console.log('🔍 Varrendo painel da mesa ao vivo...');

      const bolas = await page.evaluate(() => {
        let resultados = [];

        const extrairDeDoc = (doc) => {
          // Busca elementos de texto que representam os números sorteados na interface do jogo
          const nodes = doc.querySelectorAll('span, div, p, [class*="ball"], [class*="number"], [class*="cell"]');
          nodes.forEach(el => {
            const texto = el.innerText ? el.innerText.trim() : '';
            const num = parseInt(texto, 10);
            // Números da roleta/bingo costumam variar de 1 a 100 dependendo da variante
            if (!isNaN(num) && num >= 1 && num <= 100 && texto.length <= 2) {
              resultados.push(num);
            }
          });
        };

        // Varre a página principal
        extrairDeDoc(document);

        // Varre o iframe do provedor do cassino ao vivo
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

      console.log(`📊 Números detectados na mesa:`, bolas);

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

        console.log('🚀 Rodada enviada para a API com sucesso! Status:', resposta.status);
      } else {
        console.log('⚠️ Nenhum número visível neste ciclo. Aguardando próximo sorteio...');
      }

    } catch (err) {
      console.error('❌ Erro no loop de varredura:', err.message);
    }
  }, 10000);
}

iniciarRobo();