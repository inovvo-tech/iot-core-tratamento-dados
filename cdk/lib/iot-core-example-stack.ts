import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';

export class IotCoreExampleStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB table para persistência das mensagens
    const messagesTable = new dynamodb.Table(this, 'MessagesTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expirationTime', // TTL configurado
    });

    // Adicionar índice secundário global para consultas por status
    messagesTable.addGlobalSecondaryIndex({
      indexName: 'status-timestamp-index',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.NUMBER },
    });

    // Role para a regra IoT
    const iotRole = new iam.Role(this, 'IotRuleRole', {
      assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
    });

    // Permissão para escrever no DynamoDB
    messagesTable.grantWriteData(iotRole);
    
    // Criar grupo de logs para erros da regra IoT
    const iotErrorLogGroup = new logs.LogGroup(this, 'IotRuleErrorLogs', {
      logGroupName: '/aws/iot/rule/process_mqtt_messages_errors',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    
    // Adicionar permissão para o IoT Core escrever nos logs
    iotRole.addToPolicy(new iam.PolicyStatement({
      actions: ['logs:CreateLogStream', 'logs:PutLogEvents'],
      resources: [iotErrorLogGroup.logGroupArn],
    }));

    // Regra IoT para processar mensagens e adicionar timestamp
    const topicRule = new iot.CfnTopicRule(this, 'ProcessMqttMessages', {
      ruleName: 'process_mqtt_messages',
      topicRulePayload: {
        sql: "SELECT *, timestamp() as timestamp, topic() as topic, traceid() as id, timestamp() + 2592000 as expirationTime, 'pending' as status FROM 'mho/keeper/v1/+/SAA/EFM01/BRUTO/telemetry'",
        actions: [
          {
            dynamoDBv2: {
              putItem: {
                tableName: messagesTable.tableName,
              },
              roleArn: iotRole.roleArn,
            },
          },
        ],
        description: 'Processa mensagens MQTT e salva no DynamoDB com timestamp e TTL',
        errorAction: {
          cloudwatchLogs: {
            logGroupName: iotErrorLogGroup.logGroupName,
            roleArn: iotRole.roleArn,
          },
        },
      },
    });

    // Lambda para consultar mensagens pendentes
    const getMessagesLambda = new lambda.Function(this, 'GetMessagesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/getMessages')),
      environment: {
        TABLE_NAME: messagesTable.tableName,
      },
    });

    // Permissão para a Lambda ler do DynamoDB
    messagesTable.grantReadData(getMessagesLambda);

    // Lambda para confirmar processamento de mensagens
    const ackMessagesLambda = new lambda.Function(this, 'AckMessagesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/ackMessages')),
      environment: {
        TABLE_NAME: messagesTable.tableName,
      },
    });

    // Permissão para a Lambda atualizar o DynamoDB
    messagesTable.grantWriteData(ackMessagesLambda);

    // API Gateway para expor as Lambdas
    const api = new apigateway.RestApi(this, 'MessagesApi', {
      restApiName: 'Messages Service',
      description: 'API para consultar e confirmar processamento de mensagens MQTT',
    });

    // Recurso /messages para consultar mensagens pendentes
    const messages = api.root.addResource('messages');
    messages.addMethod('GET', new apigateway.LambdaIntegration(getMessagesLambda));

    // Recurso /messages/ack para confirmar processamento
    const ack = messages.addResource('ack');
    ack.addMethod('POST', new apigateway.LambdaIntegration(ackMessagesLambda));

    // Outputs
    new cdk.CfnOutput(this, 'TableName', {
      value: messagesTable.tableName,
      description: 'Nome da tabela DynamoDB',
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'URL da API para consultar e confirmar mensagens',
    });
    
    new cdk.CfnOutput(this, 'ErrorLogGroup', {
      value: iotErrorLogGroup.logGroupName,
      description: 'Grupo de logs para erros da regra IoT',
    });
  }
}
