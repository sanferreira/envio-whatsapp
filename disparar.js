const venom = require('venom-bot');
const fs = require('fs');
const path = require('path');

// Caminho do log
const logPath = path.join(__dirname, 'envios.json');

// Carrega histórico
let historico = [];
if (fs.existsSync(logPath)) {
  try {
    historico = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  } catch (erro) {
    console.error('❌ Erro ao ler o arquivo envios.json:', erro.message);
  }
}

// Função de delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Remove caracteres não numéricos e invisíveis
function limparNumero(numero) {
  return numero
    .replace(/[^\d]/g, '') // remove tudo que não for número
    .trim();
}

// Lê contatos.txt com separação por tab (\t)
const linhas = fs.readFileSync('contatos.txt', 'utf8').split('\n');

const contatos = linhas
  .map(linha => linha.trim())
  .filter(linha => linha.length > 0)
  .map(linha => {
    const [nome, numeroSujo] = linha.split('\t');
    const numero = limparNumero(numeroSujo || '');
    return { nome: nome.trim(), numero };
  })
  .filter(c => c.nome && c.numero); // evita entradas vazias

function gerarMensagem(nome) {
  return `Olá ${nome}, esta é uma mensagem automática enviada via WhatsApp. o San ama muito vocês ama muito vocês!`;
}

function contatosNaoEnviados() {
  const enviados = new Set(
    historico
      .filter(reg => reg.status === 'sucesso')
      .map(reg => reg.numero)
  );

  return contatos.filter(contato => !enviados.has(contato.numero));
}

venom
  .create({
    session: 'whatsapp-session', 
    browserArgs: ['--no-sandbox'], 
    })
  .then((client) => enviarMensagens(client))
  .catch((erro) => {
    console.error('Erro ao iniciar o Venom:', erro);
  });

async function enviarMensagens(client) {
  const listaParaEnvio = contatosNaoEnviados();

  console.log(`📨 Iniciando envio para ${listaParaEnvio.length} contatos...`);

  for (const contato of listaParaEnvio) {
    const mensagem = gerarMensagem(contato.nome);
    const registro = {
      nome: contato.nome,
      numero: contato.numero,
      mensagem,
      timestamp: new Date().toISOString()
    };

    try {
      await client.sendText(`${contato.numero}@c.us`, mensagem);
      registro.status = 'sucesso';
      console.log(`✅ Mensagem enviada para ${contato.nome}`);
    } catch (erro) {
      registro.status = 'erro';
      registro.erro = erro.message;
      console.error(`❌ Erro ao enviar para ${contato.nome}:`, erro.message);
    }

    historico.push(registro);
    fs.writeFileSync(logPath, JSON.stringify(historico, null, 2));

    await delay(5000); // 5 segundos
  }

  console.log("📄 Registro atualizado em envios.json");
  console.log("✅ Todos os envios finalizados.");
}
