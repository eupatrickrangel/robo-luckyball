const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

async function iniciarRoboLocal() {
  console.log('🤖 [ROBÔ LOCAL DEFINITIVO] Abrindo navegador na sua máquina...');

  // Abre o navegador visível (assim você faz o login e vê a mesa rodando)
  const browser = await puppeteer.launch({
    headless: false, 
    defaultViewport: null,
    args: ['--start-maximized', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('🌐 Acessando a mesa de apostas...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log('----------------------------------------------------');
    console.log('👉 FAÇA O LOGIN NA SUA CONTA MANUALMENTE NA TELA QUE ABRIU.');
    console.log('👉 Assim que a mesa carregar, o robô começará a capturar.');
    console.log('----------------------------------------------------');

  } catch (e) {
    console.log('⚠️ Erro de navegação:', e.message);
  }

  let ultimaAssinatura = '';

  // Varredura ultra-rápida direto no DOM interno da mesa
  setInterval(async () => {
    try {
      const dados = await page.evaluate(() => {
        const resultado = { bolas: [], jackpots: [] };

        function buscarEmDom(doc) {
          if (!doc) return;
          const elementos = doc.querySelectorAll('*');
          elementos.forEach(el => {
            const texto = (el.innerText || el.getAttribute('aria-label') || '').trim();
            if (!texto) return;

            const lower = texto.toLowerCase();
            if (lower.includes('major')) resultado.jackpots.push('MAJOR');
            if (lower.includes('grand')) resultado.jackpots.push('GRAND');
            if (lower.includes('mega')) resultado.jackpots.push('MEGA');

            const matches = texto.match(/\b([1-9][0-9]?|100)\b/g);
            if (matches) {
              matches.forEach(m => {
                const num = parseInt(m);
                if (num >= 1 && num <= 100 && !resultado.bolas.includes(num)) {
                  resultado.bolas.push(num);
                }
              });
            }
          });

          const iframes = doc.querySelectorAll('iframe');
          iframes.forEach(fr => {
            try {
              buscarEmDom(fr.contentDocument || fr.contentWindow.document);
            } catch (err) {}
          });
        }

        buscarEmDom(document);
        return resultado;
      });

      // Remove duplicadas dos jackpots
      dados.jackpots = [...new Set(dados.jackpots)];

      if (dados.bolas.length > 0 || dados.jackpots.length > 0) {
        const assinatura = JSON.stringify(dados.bolas.sort()) + JSON.stringify(dados.jackpots.sort());

        if (assinatura !== ultimaAssinatura) {
          ultimaAssinatura = assinatura;
          console.log('🎯 [DADOS CAPTURADOS] Bolas:', dados.bolas, '| Jackpots:', dados.jackpots);

          // Envia direto para a sua API no Render
          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bolas: dados.bolas,
              jackpots: dados.jackpots,
              horario: new Date().toISOString()
            })
          }).catch(() => {});
        }
      } else {
        console.log('🔄 Monitorando rodada ao vivo...');
      }

    } catch (err) {}
  }, 2500);
}

iniciarRoboLocal();
