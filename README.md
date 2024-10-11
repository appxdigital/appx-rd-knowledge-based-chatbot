# Retrieval-Augmented Generation (RAG) Chatbot

Este projeto é fruto da investigação sobre a utilização de Large Language Models (LLM’s) na criação de um chatbot simples capaz de responder a questões sobre documentos carregados em runtime.

O chatbot utiliza duas LLM’s:
 - Llama 3.1 (desenvolvida pela Meta) com 8 biliões de parâmetros
 - Gemma2 (desenvolvida pela Google) com 9 biliões de parâmetros 

## Porquê duas LLM’s?

Inicialmente o objetivo era utilizar apenas o Gemma2 para carregar os documentos e responder ás questões submetidas, pois revelou uma ótima aptidão linguística em Português de Portugal. No entanto, utilizando um documento com cerca de 6000 palavras, o Gemma2 não conseguiu reter a informação total do mesmo, não conseguindo responder a perguntas relativas ao início do documento.
Tal deve-se ao facto do modelo ter uma janela de contexto relativamente baixa para esta aplicação (8k tokens).

Para colmatar esta limitação, realizaram-se testes com o modelo Llama 3.1, que tem uma janela de contexto bastante mais elevada que o Gemma2 (128k tokens). No entanto, mesmo dando indicações para o modelo responder em Português de Portugal, por vezes a resposta contém gramática/termos em Português do Brasil.

Logo, foi tomada a decisão de utilizar o Llama 3.1 para ler o documento e responder às questões colocadas pelo utilizador e o Gemma2 para reescrever a resposta em Português de Portugal, tirando assim partido dos pontos fortes de cada modelo.

## Setup

Para correr este projeto é necessário introduzir os documentos que o modelo irá carregar e adicionar ao seu conhecimento. Estes documentos devem ser colocados na pasta `documents` e podem ser ficheiros de texto (`.txt`) ou PDF (`.pdf`).

Após introduzir os documentos, é necessário iniciar o servidor. Tal pode ser  feito executando `node app.js` no terminal no root do projeto ou através de um IDE. O servidor estará à espera de pedidos no porto 3000.

### Endpoints

`GET /`

- Respostas:
	- 200:  Apresenta a seguinte mensagem “Olá, envie a sua questão para o endpoint  '/ask' caso já tenha efetuado todos os passos descritos no README."

`GET /ask`

Este endpoint envia uma pergunta para o modelo e retorna a resposta no formato de stream. A resposta é enviada em blocos para o cliente.

Parâmetros:
 - `question`
 	- Tipo: `string`
 	- Exemplo: `/ask?question="De que cor é o Sol?"`

Respostas:
 - 200: A resposta é enviada em blocos à medida que o modelo gera a resposta.
 - 400: Quando o parâmetro `question` está em falta ou vazio.
 - 500: Quando o servidor encontra um erro durante a geração da resposta à pergunta realizada pelo cliente.
