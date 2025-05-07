const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient();
const dynamoDB = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  try {
    // Parâmetros de consulta opcionais
    const queryParams = event.queryStringParameters || {};
    const limit = parseInt(queryParams.limit) || 100;
    const lastEvaluatedKey = queryParams.nextToken ? JSON.parse(Buffer.from(queryParams.nextToken, 'base64').toString()) : undefined;
    
    // Consultar mensagens pendentes usando o índice status-timestamp
    const params = {
      TableName: process.env.TABLE_NAME,
      IndexName: 'status-timestamp-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'pending'
      },
      Limit: limit,
      ScanIndexForward: false, // Ordenar por timestamp decrescente (mais recentes primeiro)
      ExclusiveStartKey: lastEvaluatedKey
    };
    
    const result = await dynamoDB.send(new QueryCommand(params));
    
    // Preparar token de paginação se houver mais resultados
    let nextToken = undefined;
    if (result.LastEvaluatedKey) {
      nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: result.Items,
        nextToken: nextToken
      })
    };
  } catch (error) {
    console.error('Erro ao consultar mensagens:', error);
    
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
