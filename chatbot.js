import {ChatOllama} from "@langchain/ollama";
import {PDFLoader} from "@langchain/community/document_loaders/fs/pdf";
import {RecursiveCharacterTextSplitter} from "langchain/text_splitter";
import {ChatPromptTemplate, MessagesPlaceholder} from "@langchain/core/prompts";
import {createStuffDocumentsChain} from "langchain/chains/combine_documents";
import {DirectoryLoader} from "langchain/document_loaders/fs/directory";
import {FaissStore} from "@langchain/community/vectorstores/faiss";
import {OllamaEmbeddings} from "@langchain/ollama";
import fs from "fs";
import fsASync from "fs/promises";
import crypto from "crypto";
import {TextLoader} from "langchain/document_loaders/fs/text";
import {createRetrievalChain} from "langchain/chains/retrieval";
import {ChatMessageHistory} from "@langchain/community/stores/message/in_memory";
import {RunnableSequence, RunnableWithMessageHistory} from "@langchain/core/runnables";
import {AIMessage, HumanMessage} from "@langchain/core/messages";
import {db} from './mysql/index.js';

let hash = "";

const createStoreHash = async () => {
   try {
      const files = await fsASync.readdir("documents");

      let buffers = [];

      if (files.length === 0) throw new Error("Tem de colocar documentos para carregar na pasta documents!");

      for (const file of files) {
         const data = await fsASync.readFile(`documents/${file}`);
         buffers.push(data);
      }

      const combinedBuffer = Buffer.concat(buffers);

      hash = crypto.createHash('md5').update(combinedBuffer).digest('hex');
   } catch (e) {
      console.error('Erro: ', e.message);
   }

   return hash;
}

const indexDocuments = async (keepAlive) => {
   const hash = await createStoreHash();

   if (!fs.existsSync(hash)) {
      const embeddings = new OllamaEmbeddings({
         model: "nomic-embed-text:latest",
         keepAlive
      });

      const loader = new DirectoryLoader(
         "documents",
         {
            ".pdf": (path) => new PDFLoader(path, {
               splitPages: false
            }),
            ".txt": (path) => new TextLoader(path)
         }
      );

      const docs = await loader.load();

      const textSplitter = new RecursiveCharacterTextSplitter({
         chunkSize: 800,
         chunkOverlap: 150,
      });

      const splits = await textSplitter.splitDocuments(docs)

      const vectorStore = await FaissStore.fromDocuments(splits, embeddings);

      await vectorStore.save(hash);
   }
}

const runLLM = async (question, id) => {
   const embeddings = new OllamaEmbeddings({
      model: "nomic-embed-text:latest"
   });

   const llama = new ChatOllama({model: "llama3.1:latest"});

   const llamaPrompt = ChatPromptTemplate.fromMessages([
      ["system", "You are an assistant for question-answering tasks. Use only the retrieved context to answer the question. If you don't know the answer, say that you don't know and ask to reformulate the question or ask again. Use three sentences maximum and keep the answer concise. AppX is a company and should be addressed in the third person. Questions that mention AppX should be regarded as questions about it and nothing else.  \\n\\n Context: {context}"],
      new MessagesPlaceholder("chat_history"),
      ["human", "Question: {input}"],
   ]);

   const vectorStore = await FaissStore.load(hash, embeddings);
   const retriever = vectorStore.asRetriever();

   const questionAnswerChain = await createStuffDocumentsChain({
      llm: llama,
      prompt: llamaPrompt
   });

   const ragChain = await createRetrievalChain({
      retriever: retriever,
      combineDocsChain: questionAnswerChain,
   });

   const messageHistory = new ChatMessageHistory();
   const config = {configurable: {sessionId: id}};

   const history = await db("messages").where({
      session_id: id
   }).orderBy('id');

   for (const message of history) {
      if (message.type === "ai") {
         await messageHistory.addMessage(new AIMessage(message.content));
      } else {
         await messageHistory.addMessage(new HumanMessage(message.content));
      }
   }

   const withHistory = new RunnableWithMessageHistory({
      runnable: ragChain,
      historyMessagesKey: "chat_history",
      inputMessagesKey: "input",
      config,
      getMessageHistory: (_sessionId) => messageHistory
   });

   const llmChain = RunnableSequence.from([
      (input) => {
         return {input: input.question};
      },
      withHistory,
      (output) => {
         return output.answer;
      },
   ]);

   const answerStream = await llmChain.stream({
         question,
      },
   );

   return answerStream;
}

export {indexDocuments, runLLM};