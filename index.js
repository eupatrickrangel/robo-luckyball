const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

const API_URL = 'https://api-luckyball.onrender.com/api/rodada';
const GAME_URL = 'https://www.1pra1.bet.br/cassino-ao-vivo?act=prov%3APTSL&game=420019208&gn=Brazilian+Mega+Fire+Blaze+Lucky+Ball+Live'; 

async function iniciarRobo() {
  console.log('🤖 Iniciando scraper inteligente na mesa ao vivo...');

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

  // Monitora as requisições de rede que o jogo faz para pescar os números direto da fonte
  page.on('response', async (response) => {
    try {
      const url = response.url();
      // Procura por endpoints de API internos do provedor do jogo
      if (url.includes('api') || url.includes('game') || url.includes('data') || url.includes('result')) {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          const json = await response.json();
          
          // Procura por arrays de números dentro do JSON recebido pelo servidor do jogo
          JSON.stringify(json, (key, value) => {
            if (Array.isArray(value) && value.length > 0) {
              const numerosValidos = value.filter(n => typeof n === 'number' && n >= 1 && n <= 100);
              if (numerosValidos.length >= 3) {
                console.log('🎯 Dados capturados via requisição da API do jogo:', numerosValidos);
                
                // Envia para a sua API no Render
                fetch(API_URL, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ bolas: numerosValidos, horario: new Date().toISOString() })
                }).catch(() => {});
              }
            }
            return value;
          });
        }
      }
    } catch (err) {
      // Ignora erros de parsing de pacotes externos
    }
  });

  try {
    console.log('🌐 Conectando à mesa de apostas...');
    await page.goto(GAME_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('✅ Conexão estabelecida com sucesso!');
  } catch (e) {
    console.error('❌ Erro ao carregar a página:', e.message);
  }

  // Mantém o navegador rodando e escutando o tráfego indefinidamente
  setInterval(() => {
    console.log('🔄 Monitorando tráfego da mesa ao vivo...');
  }, 30000);
}

iniciarRobo();