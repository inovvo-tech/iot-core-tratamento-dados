#!/usr/bin/env node

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Configuração da região
const region = process.env.AWS_REGION || 'us-east-1';
AWS.config.update({ region });

// Cliente IoT
const iotData = new AWS.IotData({
  endpoint: process.env.IOT_ENDPOINT // Você precisa definir o endpoint do IoT Core
});

// Gerar dados de exemplo com o formato especificado
function generateSampleData() {
  // Gerar um timestamp atual em segundos (formato Unix timestamp)
  const currentTimestamp = Math.floor(Date.now() / 1000);
  
  return {
    "ts": currentTimestamp,
    "values": {
      "MI1": parseFloat((Math.random() * 3 + 1).toFixed(2)),
      "MI2": parseFloat((Math.random() * 20 + 10).toFixed(1)),
      "MI3": parseFloat((Math.random() * 15 + 10).toFixed(1)),
      "MI4": parseFloat((Math.random() * 200 + 800).toFixed(1)),
      "MI5": parseFloat((Math.random() * 10 + 1).toFixed(1)),
      "MI6": parseFloat((Math.random() * 20 + 1000).toFixed(1)),
      "MI7": parseFloat((Math.random() * 10 + 25).toFixed(1)),
      "MI8": parseFloat((Math.random() * 20 + 70).toFixed(1)),
      "op": "vivo",
      "sq": Math.floor(Math.random() * 10) + 1
    }
  };
}

// Publicar mensagem
async function publishMessage(topic, message) {
  const params = {
    topic,
    payload: JSON.stringify(message),
    qos: 1
  };

  try {
    await iotData.publish(params).promise();
    console.log(`Mensagem publicada no tópico ${topic}:`);
    console.log(JSON.stringify(message, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao publicar mensagem:', error);
    return false;
  }
}

// Função principal
async function main() {
  if (!process.env.IOT_ENDPOINT) {
    console.error('Erro: Variável de ambiente IOT_ENDPOINT não definida');
    console.error('Execute: export IOT_ENDPOINT="xxxxxxx-ats.iot.REGION.amazonaws.com"');
    process.exit(1);
  }

  const numMessages = process.argv[2] ? parseInt(process.argv[2]) : 5;
  const topic = process.argv[3] || 'devices/data';
  
  console.log(`Publicando ${numMessages} mensagens no tópico ${topic}...`);
  
  for (let i = 0; i < numMessages; i++) {
    const message = generateSampleData();
    await publishMessage(topic, message);
    
    // Pequeno intervalo entre mensagens
    if (i < numMessages - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log('Publicação concluída!');
}

// Executar
main().catch(console.error);
