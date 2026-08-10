const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

const USER = process.env.BET_USER;
const PASS = process.env.BET_PASS;

async function iniciarRobo() {
  console.log('🤖 [EXTRATOR DIRETO DE HISTÓRICO] Iniciando...');

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
    console.log('⚠️ Aviso no login:', e.message);
  }

  console.log('🚀 Varredura contínua de histórico ativada.');
  let ultimaAssinatura = '';

  setInterval(async () => {
    try {
      // Varre o documento principal e todos os iframes internos buscando nós de texto de histórico
      const dadosExtraidos = await page.evaluate(() => {
        const resultado = { bolas: [], jackpots: [] };

        function inspecionarDoc(doc) {
          if (!doc) return;

          // Busca elementos comuns de histórico, lista de bolas e painéis de jackpots
          const elementos = doc.querySelectorAll('li, div, span, [class*="history"], [class*="ball"], [class*="number"], [class*="jackpot"], [class*="win"]');
          elementos.forEach(el => {
            const texto = (el.innerText || el.getAttribute('aria-label') || '').trim();
            if (!texto) return;

            const lower = texto.toLowerCase();
            if (lower.includes('major') && !resultado.jackpots.includes('MAJOR')) resultado.jackpots.push('MAJOR');
            if (lower.includes('grand') && !resultado.jackpots.includes('GRAND')) resultado.jackpots.push('GRAND');
            if (lower.includes('mega') && !resultado.jackpots.includes('MEGA')) resultado.jackpots.push('MEGA');

            // Captura números do histórico (1 a 100)
            const numeros = texto.match(/\b([1-9][0-9]?|100)\b/g);
            if (numeros) {
              numeros.forEach(n => {
                const numVal = parseInt(n);
                if (numVal >= 1 && numVal <= 100 && !resultado.bolas.includes(numVal)) {
                  resultado.bolas.push(numVal);
                }
              });
            }
          });

          // Varre iframes internos
          const frames = doc.querySelectorAll('iframe');
          frames.forEach(fr => {
            try {
              inspecionarDoc(fr.contentDocument || fr.contentWindow.document);
            } catch (err) {}
          });
        }

        inspecionarDoc(document);
        return resultado;
      });

      if (dadosExtraidos.bolas.length > 0 || dadosExtraidos.jackpots.length > 0) {
        const assinaturaAtual = JSON.stringify(dadosExtraidos.bolas) + JSON.stringify(dadosExtraidos.jackpots);

        if (assinaturaAtual !== ultimaAssinatura) {
          ultimaAssinatura = assinaturaAtual;
          console.log('🎯 [DADOS CAPTURADOS DA MESA]:', dadosExtraidos);

          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bolas: dadosExtraidos.bolas,
              jackpots: dadosExtraidos.jackpots,
              horario: new Date().toISOString()
            })
          });
        }
      } else {
        console.log('🔄 Aguardando sorteio na mesa...');
      }
    } catch (err) {}
  }, 4000);
}

iniciarRobo();
