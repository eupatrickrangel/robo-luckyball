const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

const USER = process.env.BET_USER;
const PASS = process.env.BET_PASS;

async function iniciarRobo() {
  console.log('🤖 [ROBÔ AVANÇADO] Iniciando extração profunda de elementos...');

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
      console.log('✍️ Injetando credenciais de acesso...');
      await inputs[0].type(USER, { delay: 50 });
      if (inputs[1]) {
        await inputs[1].type(PASS, { delay: 50 });
      }
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 8000));
    }

  } catch (e) {
    console.log('⚠️ Aviso no fluxo de sessão:', e.message);
  }

  // Monitoramento contínuo buscando em todos os atributos e elementos possíveis
  setInterval(async () => {
    try {
      const dadosCapturados = await page.evaluate(() => {
        const resultado = {
          bolas: [],
          jackpots: []
        };

        // Varre absolutamente tudo na página (incluindo atributos de texto ocultos e aria-labels)
        const todosElementos = document.querySelectorAll('*');
        todosElementos.forEach(el => {
          // Coleta textos visíveis e atributos que possam guardar o número da bola
          const textosParaVerificar = [];
          if (el.innerText) textosParaVerificar.push(el.innerText.trim());
          if (el.getAttribute('aria-label')) textosParaVerificar.push(el.getAttribute('aria-label').trim());
          if (el.className && typeof el.className === 'string') textosParaVerificar.push(el.className);

          textosParaVerificar.forEach(txt => {
            const txtLower = txt.toLowerCase();

            // Jackpots
            if (txtLower.includes('major') && !resultado.jackpots.includes('MAJOR')) resultado.jackpots.push('MAJOR');
            if (txtLower.includes('grand') && !resultado.jackpots.includes('GRAND')) resultado.jackpots.push('GRAND');
            if (txtLower.includes('mega') && !resultado.jackpots.includes('MEGA')) resultado.jackpots.push('MEGA');

            // Extrai números isolados ou de classes (ex: ball-54, number_12)
            const matches = txt.match(/\d+/g);
            if (matches) {
              matches.forEach(m => {
                const num = parseInt(m);
                if (num >= 1 && num <= 100 && !resultado.bolas.includes(num)) {
                  resultado.bolas.push(num);
                }
              });
            }
          });
        });

        return resultado;
      });

      if ((dadosCapturados.bolas && dadosCapturados.bolas.length > 0) || (dadosCapturados.jackpots && dadosCapturados.jackpots.length > 0)) {
        console.log('🎯 Dados capturados com sucesso:', dadosCapturados);
        
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bolas: dadosCapturados.bolas,
            jackpots: dadosCapturados.jackpots,
            horario: new Date().toISOString()
          })
        });
      } else {
        console.log('🔄 Monitorando rodada ao vivo (analisando elementos)...');
      }
    } catch (err) {
      // Ignora pequenos erros de ciclo para manter rodando
    }
  }, 6000);
}

iniciarRobo();
