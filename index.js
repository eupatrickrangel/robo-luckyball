const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

const USER = process.env.BET_USER;
const PASS = process.env.BET_PASS;

async function iniciarRobo() {
  console.log('🤖 [ESTUDO - EXTRATOR DE ALTA PRECISÃO] Iniciando robô...');

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

    // Tratativa de login caso apareça na página principal
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

  console.log('🚀 Extrator ativo. Monitorando histórico e painel da mesa em tempo real...');

  // Controle para evitar enviar repetidamente o mesmo sorteio
  let ultimoEnvioStr = '';

  // Loop de varredura profunda em todos os frames e iframes da página a cada 3 segundos
  setInterval(async () => {
    try {
      const dadosMesa = await page.evaluate(() => {
        const resultado = {
          bolas: [],
          jackpots: []
        };

        // Função recursiva para varrer o documento principal e todos os iframes internos
        function varrerDocumento(doc) {
          if (!doc) return;

          // Procura por todos os elementos que possam conter texto de histórico ou números
          const elementos = doc.querySelectorAll('*');
          elementos.forEach(el => {
            // Analisa tanto o texto visível quanto atributos de estilo, aria-labels e classes
            const textos = [];
            if (el.innerText) textos.push(el.innerText.trim());
            if (el.getAttribute && el.getAttribute('aria-label')) textos.push(el.getAttribute('aria-label').trim());
            if (el.className && typeof el.className === 'string') textos.push(el.className);

            textos.forEach(txt => {
              const lower = txt.toLowerCase();

              // Detecção de Jackpots
              if (lower.includes('major') && !resultado.jackpots.includes('MAJOR')) resultado.jackpots.push('MAJOR');
              if (lower.includes('grand') && !resultado.jackpots.includes('GRAND')) resultado.jackpots.push('GRAND');
              if (lower.includes('mega') && !resultado.jackpots.includes('MEGA')) resultado.jackpots.push('MEGA');

              // Extração de números de 1 a 100
              const matches = txt.match(/\b([1-9][0-9]?|100)\b/g);
              if (matches) {
                matches.forEach(m => {
                  const num = parseInt(m);
                  // Filtra para garantir que está dentro do escopo da roleta/jogo (1 a 100)
                  if (num >= 1 && num <= 100 && !resultado.bolas.includes(num)) {
                    resultado.bolas.push(num);
                  }
                });
              }
            });
          });

          // Varre sub-iframes recursivamente se existirem
          const frames = doc.querySelectorAll('iframe');
          frames.forEach(iframe => {
            try {
              const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
              varrerDocumento(iframeDoc);
            } catch (err) {
              // Erros de CORS em iframes externos são esperados e ignorados com segurança
            }
          });
        }

        varrerDocumento(document);
        return resultado;
      });

      // Valida se encontrou dados relevantes
      if ((dadosMesa.bolas && dadosMesa.bolas.length > 0) || (dadosMesa.jackpots && dadosMesa.jackpots.length > 0)) {
        // Cria uma assinatura única para evitar spam idêntico consecutivo
        const assinatura = JSON.stringify(dadosMesa.bolas.sort()) + JSON.stringify(dadosMesa.jackpots.sort());

        if (assinatura !== ultimoEnvioStr) {
          ultimoEnvioStr = assinatura;
          console.log('🎯 [NOVO SORTEIO DETECTADO NA MESA]:', dadosMesa);

          // Dispara os dados capturados para a sua API no Render
          await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bolas: dadosMesa.bolas,
              jackpots: dadosMesa.jackpots,
              horario: new Date().toISOString()
            })
          });
        }
      } else {
        console.log('🔄 Monitorando mesa ao vivo (aguardando nova extração)...');
      }

    } catch (err) {
      // Mantém o loop de execução ativo em caso de oscilação da página
    }
  }, 3000);
}

iniciarRobo();
