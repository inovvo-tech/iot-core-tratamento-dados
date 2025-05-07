# Arquitetura da Solução IoT Core

## Diagrama de Arquitetura

Para visualizar o diagrama de arquitetura, você pode usar o PlantUML com os arquivos fornecidos:

1. Arquivo completo com ícones AWS: `architecture.puml`
2. Versão simplificada: `architecture-simple.puml`

### Como visualizar o diagrama

#### Opção 1: Usando o serviço online do PlantUML

1. Acesse [PlantUML Online Server](https://www.plantuml.com/plantuml/uml/)
2. Copie e cole o conteúdo do arquivo `.puml` desejado
3. O diagrama será renderizado automaticamente

#### Opção 2: Instalando o PlantUML localmente

```bash
# Ubuntu/Debian
sudo apt-get install plantuml

# Fedora
sudo dnf install plantuml

# macOS
brew install plantuml
```

Para gerar o diagrama:

```bash
plantuml docs/architecture.puml
# ou
plantuml docs/architecture-simple.puml
```

## Descrição da Arquitetura

### Componentes Principais

1. **Dispositivos IoT**
   - Enviam dados via protocolo MQTT para o tópico `devices/data`

2. **AWS IoT Core**
   - Recebe as mensagens MQTT dos dispositivos
   - Encaminha para processamento via regras IoT

3. **AWS IoT Rule**
   - Processa as mensagens recebidas
   - Adiciona campos: timestamp, ID único, status="pending", TTL (expirationTime)
   - Encaminha para armazenamento no DynamoDB

4. **Amazon DynamoDB**
   - Tabela principal com chave primária (id) e chave de ordenação (timestamp)
   - Índice secundário global (GSI) em status-timestamp para consultas eficientes
   - TTL configurado: 24h para mensagens processadas, 30 dias para pendentes

5. **Funções Lambda**
   - **getMessages**: Consulta mensagens pendentes usando o GSI
   - **ackMessages**: Atualiza o status das mensagens para "processed" e ajusta o TTL

6. **Amazon API Gateway**
   - Expõe endpoints REST para aplicações externas:
     - `GET /messages`: Lista mensagens pendentes (com paginação)
     - `POST /messages/ack`: Confirma processamento de mensagens

7. **Aplicações Externas**
   - Consomem os dados via API REST
   - Confirmam o processamento das mensagens

### Fluxo de Dados

1. Dispositivos publicam mensagens MQTT no tópico `devices/data`
2. IoT Core recebe e encaminha para a regra configurada
3. A regra enriquece a mensagem e salva no DynamoDB com status "pending"
4. Aplicações externas consultam mensagens pendentes via API Gateway
5. Após processamento, aplicações confirmam via endpoint de ACK
6. A função Lambda atualiza o status para "processed" e reduz o TTL
7. O DynamoDB remove automaticamente as mensagens expiradas
