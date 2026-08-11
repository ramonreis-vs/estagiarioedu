import 'dotenv/config';
import express from 'express';
import { generatePlanning, sendChatMessage } from '../src/services/gemini.server';

const app = express();

// Middleware para JSON com limite aumentado para anexos (Base64)
app.use(express.json({ limit: '10mb' }));

// Endpoints da API
app.post('/api/generate-planning', async (req, res) => {
  try {
    const { toolId, input, refinement, previousOutput } = req.body;
    const result = await generatePlanning(toolId, input, refinement, previousOutput);
    res.json({ result });
  } catch (error: any) {
    console.error("Erro generate-planning:", error);
    res.status(500).send(error?.message || "Erro no servidor ao gerar planejamento");
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, memories } = req.body;
    const result = await sendChatMessage(messages, memories);
    res.json({ result });
  } catch (error: any) {
    console.error("Erro chat:", error);
    res.status(500).send(error?.message || "Erro no servidor ao responder chat");
  }
});

export default app;
