import express from 'express';
import 'dotenv/config';
import {indexDocuments, runLLM} from './chatbot.js';
import {db} from "./mysql/index.js";

const app = express();
const port = process.env.PORT;
const keepAlive = process.argv[2] || '5m'


app.get('/', (req, res) => {
   res.send("Olá, aceda ao URL '/ask' para enviar a sua questão caso já tenha realizado todos os passos descritos no README.");
})

app.get('/ask', async (req, res) => {
   const question = req.query.question;
   const id = req.query.id;

   if (!question) {
      return res.status(400).send('Questão vazia ou inválida.');
   }

   try {
      const answerStream = await runLLM(question, id);
      let answer = '';

      for await (const chunk of answerStream) {
         res.write(chunk);
         answer += chunk;
      }

      await db('messages').insert({
         session_id: id,
         content: question,
         type: 'human'
      })

      await db('messages').insert({
         session_id: id,
         content: answer,
         type: 'ai'
      })

      res.end();
   } catch (error) {
      res.status(500).send(`Error: ${error.message}`);
   }
})

app.listen(port, async () => {
   await indexDocuments(keepAlive);
   console.log("Carregamento dos documentos concluída.");
})