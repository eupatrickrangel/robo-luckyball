const fetch = require('node-fetch');

// Endpoint da sua API no Render
const API_URL = 'https://api-luckyball.onrender.com/api/rodada';

const cores = ['Vermelho', 'Preto', 'Branco'];

function gerarRodada() {
  return {
    numero: Math.floor(Math.random() * 15),
    cor: cores[Math.floor(Math.random() * cores.length)],
    horario: new Date().toISOString()
  };
}

async function dispararDados() {
  const rodada = gerarRodada();

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rodada)
    });

    const resultado = await response.json();
    console.log('✅ Rodada enviada com sucesso:', resultado);
  } catch (erro) {
    console.error('❌ Erro no envio:', erro.message);
  }
}

console.log('🤖 Robô Scraper iniciado. Enviando dados a cada 10 segundos...');
setInterval(dispararDados, 10000);