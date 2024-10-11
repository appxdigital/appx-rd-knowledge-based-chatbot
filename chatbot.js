import {ChatOllama} from "@langchain/ollama";
import {PDFLoader} from "@langchain/community/document_loaders/fs/pdf";
import {RecursiveCharacterTextSplitter} from "langchain/text_splitter";
import {ChatPromptTemplate} from "@langchain/core/prompts";
import {RunnableSequence} from "@langchain/core/runnables";
import {StringOutputParser} from "@langchain/core/output_parsers";
import {createStuffDocumentsChain} from "langchain/chains/combine_documents";
import {DirectoryLoader} from "langchain/document_loaders/fs/directory";
import {FaissStore} from "@langchain/community/vectorstores/faiss";
import {OllamaEmbeddings} from "@langchain/ollama";
import fs from "fs";
import fsASync from "fs/promises";
import crypto from "crypto";
import {TextLoader} from "langchain/document_loaders/fs/text";

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
         model: "llama3.1:latest",
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
         chunkSize: 500,
         chunkOverlap: 100,
      });

      const splits = await textSplitter.splitDocuments(docs)

      const vectorStore = await FaissStore.fromDocuments(splits, embeddings);

      await vectorStore.save(hash);
   }
}

const runLLM = async (question) => {
   const embeddings = new OllamaEmbeddings({
      model: "llama3.1:latest"
   });

   const vectorStore = await FaissStore.load(hash, embeddings);
   const retriever = vectorStore.asRetriever();

   const promptLlama = ChatPromptTemplate.fromMessages([
      ["system", "You are an assistant for question-answering tasks. Use only the retrieved context to answer the question. If you don't know the answer, say that you don't know. Use three sentences maximum and keep the answer concise. Answer in Portuguese from Portugal"],
      ["human", "Question: {question} Context: {context} Answer:"]
   ]);

   const llamaModel = new ChatOllama({model: "llama3.1:latest"});

   const ragChain = await createStuffDocumentsChain({
      llm: llamaModel,
      prompt: promptLlama,
      outputParser: new StringOutputParser(),
   });

   const promptGemma2 = ChatPromptTemplate.fromMessages([
      ["system", "You are an assistant for text translation/correction. Rewrite the given text to Portuguese from Portugal. Don't describe what you rewrote."],
      ["human", "{text}"]
   ]);

   const gemma2Model = new ChatOllama({model: "gemma2:latest"});

   const llmChain = RunnableSequence.from([
      ragChain,
      (input) => {
         return {text: input}
      },
      promptGemma2,
      gemma2Model,
      new StringOutputParser()
   ])

   const answerStream = await llmChain.stream({
         context: await retriever.invoke(question),
         question,
      },
   );

   return answerStream;
}

export {indexDocuments, runLLM};
