const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    // Extrair IDs das mensagens do corpo da requisição
    const body = JSON.parse(event.body);
    const messageIds = body.messageIds;
    
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'messageIds é obrigatório e deve ser um array não vazio'
        })
      };
    }
    
    // Limitar o número de mensagens por requisição
    if (messageIds.length > 25) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Máximo de 25 messageIds por requisição'
        })
      };
    }
    
    // Timestamp atual em segundos
    const now = Math.floor(Date.now() / 1000);
    
    // TTL para mensagens processadas (24 horas = 86400 segundos)
    const processedTtl = now + 86400;
    
    // Atualizar cada mensagem em paralelo
    const updatePromises = messageIds.map(async (messageId) => {
      const params = {
        TableName: process.env.TABLE_NAME,
        Key: { id: messageId },
        UpdateExpression: 'SET #status = :status, expirationTime = :expTime',
        ExpressionAttributeNames: {
          '#status': 'status'
        },
        ExpressionAttributeValues: {
          ':status': 'processed',
          ':expTime': processedTtl
        },
        ReturnValues: 'UPDATED_NEW'
      };
      
      return dynamoDB.update(params).promise();
    });
    
    // Aguardar todas as atualizações
    await Promise.all(updatePromises);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `${messageIds.length} mensagens marcadas como processadas`,
        processedIds: messageIds
      })
    };
  } catch (error) {
    console.error('Erro ao confirmar processamento:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Erro ao processar a solicitação',
        error: error.message
      })
    };
  }
};
