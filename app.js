import {indexDocuments, runLLM} from './chatbot.js';
import express from 'express';

const app = express();
const port = 3000;
const keepAlive = process.argv[2] || '5m'

app.get('/', (req, res) => {
   res.send("Olá, aceda ao URL '/ask' para enviar a sua questão caso já tenha realizado todos os passos descritos no README.");
})

app.get('/ask', async (req, res) => {
   const question = req.query.question;

   if (!question) {
      return res.status(400).send('Questão vazia ou inválida.');
   }

   try {
      const answerStream = await runLLM(question);

      for await (const chunk of answerStream) {
            res.write(chunk);
      }

      res.end();
   } catch (error) {
      res.status(500).send(`Error: ${error.message}`);
   }
})

app.listen(port, async () => {
   await indexDocuments(keepAlive);
   console.log("Carregamento dos documentos concluída.");
})