import 'dotenv/config';
import express from 'express';
import path from 'path';
import apiRouter from './api/index.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Usa as rotas da API centralizadas
  app.use(apiRouter);

  // Configuração do Vite/Estáticos
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
