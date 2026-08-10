const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const { createWorker } = require('tesseract.js');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

const USER = process.env.BET_USER;
const PASS = process.env.BET_PASS;

async function iniciarRobo() {
  console.log('🤖 [ROBÔ COMPLETO - VISÃO OCR] Inicializando sistema de captura...');

  // Inicializa o motor de OCR otimizado para português/inglês
  const worker = await createWorker('por');

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

    // Tratativa automática de login caso seja solicitada
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
      if (inputs[1]) await inputs[1].type(PASS, { delay: 50 });
      await page.keyboard.press('Enter');
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
  } catch (e) {
    console.log('⚠️ Aviso no fluxo de login:', e.message);
  }

  console.log('🚀 Sistema de monitoramento visual ativado com sucesso. Aguardando rodadas...');
  let ultimaAssinatura = '';

  // Loop de varredura visual a cada 4 segundos
  setInterval(async () => {
    try {
      // Captura a tela atual do jogo (enxerga Canvas e logos estilizados como o MEGA)
      const screenshotBuffer = await page.screenshot({ type: 'png' });

      // Extrai todo o texto visível na imagem usando OCR
      const ret = await worker.recognize(screenshotBuffer);
      const textoDetectado = ret.data.text || '';
      const lower = textoDetectado.toLowerCase();

      const bolas = [];
      const jackpots = [];

      // Detecção de prêmios especiais e jackpots
      if (lower.includes('major') || lower.includes('maior')) jackpots.push('MAJOR');
      if (lower.includes('grand') || lower.includes('grande')) jackpots.push('GRAND');
      if (lower.includes('mega')) jackpots.push('MEGA');

      // Extração de números válidos da mesa (1 a 100)
      const matches = textoDetectado.match(/\b([1-9][0-9]?|100)\b/g);
      if (matches) {
        matches.forEach(m => {
          const num = parseInt(m);
          if (num >= 1 && num <= 100 && !bolas.includes(num)) {
            bolas.push(num);
          }
        });
      }

      // Se encontrar dados válidos, empacota e envia para a API do seu app
      if (bolas.length > 0 || jackpots.length > 0) {
        const assinatura = JSON.stringify(bolas.sort()) + JSON.stringify(jackpots.sort());

        if (assinatura !== ultimaAssinatura) {
          ultimaAssinatura = assinatura;
          console.log('🎯 [EVENTO CAPTURADO NA MESA] Bolas:', bolas, '| Jackpots:', jackpots);

          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bolas,
              jackpots,
              horario: new Date().toISOString()
            })
          }).catch(err => console.log('❌ Erro ao enviar para API:', err.message));
        }
      } else {
        console.log('🔄 Monitorando mesa ao vivo...');
      }

    } catch (err) {
      // Mantém o loop rodando mesmo se houver instabilidade momentânea na página
    }
  }, 4000);
}

iniciarRobo();
