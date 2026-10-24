require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const routes = require('./routes');
const setupSocketIO = require('./websocket/socketHandler');

const app = express();
const server = http.createServer(app);

// Socket.io com CORS habilitado para o frontend Vite (porta 5173)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});

// Inicializa o barramento de eventos do WebSocket
setupSocketIO(io);

// Middlewares essenciais
app.use(cors());
app.use(express.json());

// Injeta o io na aplicação para acesso nos controllers
app.set('io', io);

// Rotas da API REST sob o prefixo /api
app.use('/api', routes);

// Rota raiz de health check
app.get('/status', (req, res) => {
  return res.json({
    projeto: 'Corp.Vanguard - Industrial Maintenance Systems (CMMS FAETERJ)',
    versao: '1.0.0',
    status: 'online',
    banco: 'MySQL 8.0 conectado',
    ambiente: process.env.NODE_ENV || 'development'
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`[CMMS Backend] Servidor rodando na porta ${PORT}`);
  console.log(`[CMMS Backend] Barramento WebSocket ativo e aguardando conexões`);
  console.log(`[CMMS Backend] Rotas disponíveis em: http://localhost:${PORT}/api`);
});

module.exports = { app, server };
