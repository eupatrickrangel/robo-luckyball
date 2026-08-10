const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

const USER = process.env.BET_USER;
const PASS = process.env.BET_PASS;

async function iniciarRobo() {
  console.log('🤖 [LOGIN AUTOMÁTICO] Iniciando robô otimizado...');

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
    console.log('🌐 Acessando diretamente a mesa de apostas...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // Aguarda um instante para a página carregar elementos de interface
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Tenta achar e clicar em qualquer botão de login/entrar na tela do jogo se houver
    const botoesLogin = await page.$$('button, a');
    for (const btn of botoesLogin) {
      const texto = await page.evaluate(el => el.innerText, btn);
      if (texto && (texto.toLowerCase().includes('entrar') || texto.toLowerCase().includes('login'))) {
        await btn.click().catch(() => {});
        break;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Varre todos os campos de input da página para preencher as credenciais onde quer que elas estejam
    const inputs = await page.$$('input');
    if (inputs.length >= 2 && USER && PASS) {
      console.log('✍️ Injetando credenciais detectadas na interface...');
      await inputs[0].type(USER, { delay: 50 });
      if (inputs[1]) {
        await inputs[1].type(PASS, { delay: 50 });
      }
      await page.keyboard.press('Enter');
      console.log('🚀 Dados enviados, aguardando sincronização da sessão...');
      await new Promise(resolve => setTimeout(resolve, 8000));
    }

  } catch (e) {
    console.log('⚠️ Aviso no fluxo de sessão:', e.message);
  }

  // Monitoramento contínuo dos números da mesa
  setInterval(async () => {
    try {
      const numeros = await page.evaluate(() => {
        const elementos = document.querySelectorAll('.ball, .result-number, .history-item, [class*="number"], [class*="ball"]');
        const lista = [];
        elementos.forEach(el => {
          const txt = el.innerText.trim();
          const num = parseInt(txt);
          if (!isNaN(num) && num >= 1 && num <= 100 && !lista.includes(num)) {
            lista.push(num);
          }
        });
        return lista;
      });

      if (numeros && numeros.length > 0) {
        console.log('🎯 Números capturados:', numeros);
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bolas: numeros, horario: new Date().toISOString() })
        });
      } else {
        console.log('🔄 Monitorando rodada ao vivo...');
      }
    } catch (err) {
      // Mantém ativo
    }
  }, 10000);
}

iniciarRobo();
