const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const LOGIN_URL = 'https://www.1pra1.bet.br/login'; 
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

const USER = process.env.BET_USER;
const PASS = process.env.BET_PASS;

async function iniciarRobo() {
  console.log('🤖 [LOGIN AUTOMÁTICO] Iniciando robô...');

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
    if (!USER || !PASS) {
      console.error('❌ ERRO CRÍTICO: As variáveis BET_USER ou BET_PASS não foram encontradas no Railway!');
    }

    console.log('🔐 Acessando página de login...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('✍️ Preenchendo credenciais de acesso...');
    await page.waitForSelector('input[type="email"], input[name="email"], input[id*="email"]', { timeout: 10000 });
    
    await page.type('input[type="email"], input[name="email"], input[id*="email"]', USER, { delay: 100 });
    await page.type('input[type="password"], input[name="password"], input[id*="password"]', PASS, { delay: 100 });

    await page.keyboard.press('Enter');
    console.log('🚀 Login submetido, aguardando autenticação...');
    
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('🌐 Entrando na mesa de apostas ao vivo...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Sessão logada com sucesso!');

  } catch (e) {
    console.error('❌ Erro durante o processo de login:', e.message);
  }

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
        console.log('🎯 Números capturados na mesa logada:', numeros);
        await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bolas: numeros, horario: new Date().toISOString() })
        });
      } else {
        console.log('🔄 Monitorando rodada ao vivo...');
      }
    } catch (err) {
      // Mantém o loop ativo sem travar
    }
  }, 10000);
}

iniciarRobo();
