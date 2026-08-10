const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const { createWorker } = require('tesseract.js');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

async function iniciarRoboLocal() {
  console.log('🤖 [ROBÔ LOCAL] Iniciando navegador visível na sua máquina...');

  const worker = await createWorker('por');

  // Abre o navegador visível para evitar bloqueios do cassino
  const browser = await puppeteer.launch({
    headless: false, // Deixa a janela visível para você acompanhar
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  try {
    console.log('🌐 Acessando a mesa de apostas...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log('⚠️ [ATENÇÃO]: Faça o login manualmente na janela do navegador que se abriu, caso seja necessário.');
    console.log('🚀 Assim que a mesa estiver aberta, o robô começará a ler a tela automaticamente.');

  } catch (e) {
    console.log('⚠️ Erro ao acessar:', e.message);
  }

  let ultimaAssinatura = '';

  // Loop de leitura visual da sua tela local
  setInterval(async () => {
    try {
      const screenshotBuffer = await page.screenshot({ type: 'png' });
      const ret = await worker.recognize(screenshotBuffer);
      const textoDetectado = ret.data.text || '';
      const lower = textoDetectado.toLowerCase();

      const bolas = [];
      const jackpots = [];

      if (lower.includes('major') || lower.includes('maior')) jackpots.push('MAJOR');
      if (lower.includes('grand') || lower.includes('grande')) jackpots.push('GRAND');
      if (lower.includes('mega')) jackpots.push('MEGA');

      const matches = textoDetectado.match(/\b([1-9][0-9]?|100)\b/g);
      if (matches) {
        matches.forEach(m => {
          const num = parseInt(m);
          if (num >= 1 && num <= 100 && !bolas.includes(num)) {
            bolas.push(num);
          }
        });
      }

      if (bolas.length > 0 || jackpots.length > 0) {
        const assinatura = JSON.stringify(bolas.sort()) + JSON.stringify(jackpots.sort());

        if (assinatura !== ultimaAssinatura) {
          ultimaAssinatura = assinatura;
          console.log('🎯 [SUCESSO - CAPTURADO NA SUA TELA] Bolas:', bolas, '| Jackpots:', jackpots);

          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bolas,
              jackpots,
              horario: new Date().toISOString()
            })
          }).catch(() => {});
        }
      } else {
        console.log('🔄 Lendo o painel da mesa local...');
      }

    } catch (err) {}
  }, 4000);
}

iniciarRoboLocal();
