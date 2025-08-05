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

// Conta quantas vezes um número já recebeu mensagem
function vezesEnviado(numero) {
  return historico.filter(reg => reg.numero === numero).length;
}

// Gera a mensagem personalizada
function gerarMensagem(nome, tentativa) {
  const primeiroNome = nome.split(' ')[0];

  const hora = new Date().getHours();
  let saudacao;

  if (hora >= 5 && hora < 12) {
    saudacao = 'Bom dia';
  } else if (hora >= 12 && hora < 18) {
    saudacao = 'Boa tarde';
  } else {
    saudacao = 'Boa noite';
  }

    if (tentativa === 1) {
      return `${saudacao}, ${primeiroNome}, tudo bem?`;
    } else if(tentativa === 2) {
      return `${primeiroNome}?`;
    }else{
      return `??`;
    }
}

// Limite máximo de tentativas por contato
const MAX_TENTATIVAS = 3;

// Cria sessão e envia mensagens
venom
  .create({
    session: 'whatsapp-session',
    browserArgs: ['--no-sandbox'],
  })
  .then((client) => enviarMensagens(client))
  .catch((erro) => {
    console.error('Erro ao iniciar o Venom:', erro);
  });

// Envia as mensagens com delay e registro, com retry individual
async function enviarMensagens(client) {
  // Filtra contatos que ainda não chegaram ao limite de tentativas
  const listaParaEnvio = contatos.filter(contato => {
    const tentativas = historico.filter(reg => reg.numero === contato.numero).length;
    return tentativas < MAX_TENTATIVAS;
  });

  console.log(`📨 Iniciando envio para ${listaParaEnvio.length} contatos...`);

  for (const contato of listaParaEnvio) {
    let enviadoComSucesso = false;
    let tentativa = vezesEnviado(contato.numero) + 1;

    while (!enviadoComSucesso && tentativa <= MAX_TENTATIVAS) {
      const mensagem = gerarMensagem(contato.nome, tentativa);

      const registro = {
        nome: contato.nome,
        numero: contato.numero,
        tentativa,
        mensagem,
        timestamp: new Date().toISOString()
      };

      try {
        await client.sendText(`${contato.numero}@c.us`, mensagem);
        registro.status = 'sucesso';
        console.log(`✅ Mensagem enviada para ${contato.nome} (tentativa ${tentativa})`);
        enviadoComSucesso = true;
      } catch (erro) {
        registro.status = 'erro';
        registro.erro = erro.message;
        console.error(`❌ Erro ao enviar para ${contato.nome} (tentativa ${tentativa}):`, erro.message);
      }

      historico.push(registro);
      fs.writeFileSync(logPath, JSON.stringify(historico, null, 2));

      if (!enviadoComSucesso) {
        tentativa++;
        await delay(3000); // espera antes de tentar novamente
      }
    }

    // Atraso entre contatos, mesmo que tenha tido sucesso rápido
    await delay(3000);
  }

  console.log("📄 Registro atualizado em envios.json");
  console.log("✅ Todos os envios finalizados.");
}
