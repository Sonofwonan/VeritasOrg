import express from 'express';
import { registerRoutes } from '../server/routes';
import { createServer } from 'http';

const app = express();
app.use(express.json());

const httpServer = createServer(app);

export default async (req: any, res: any) => {
  await registerRoutes(httpServer, app);
  
  // Route to the handler
  if (req.method === 'GET' && req.url === '/api/health') {
    return res.status(200).json({ status: 'ok' });
  }
  
  // Delegate to Express
  app(req, res);
};
