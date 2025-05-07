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

// Gerar dados de exemplo
function generateSampleData() {
  return {
    deviceId: `device-${Math.floor(Math.random() * 10) + 1}`,
    temperature: (Math.random() * 30 + 10).toFixed(1),
    humidity: (Math.random() * 60 + 30).toFixed(1),
    pressure: (Math.random() * 10 + 1000).toFixed(1),
    battery: Math.floor(Math.random() * 100),
    messageId: uuidv4(),
    readingTime: new Date().toISOString()
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
