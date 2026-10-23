require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Socket.io com CORS habilitado para o frontend Vite (porta 5173)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

// Middlewares
app.use(cors());
app.use(express.json());

// Disponibiliza o io para os controllers via req.app
app.set('io', io);

// Rota de health check
app.get('/status', (req, res) => {
  return res.json({
    projeto: 'CMMS FAETERJ - Sistema de Gestão de Manutenção Fabril',
    versao: '1.0.0',
    status: 'online',
    ambiente: process.env.NODE_ENV || 'development'
  });
});

// WebSocket: conexões em tempo real
io.on('connection', (socket) => {
  console.log(`[Socket.io] Cliente conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`[CMMS] Servidor rodando na porta ${PORT}`);
  console.log(`[CMMS] Socket.io aguardando conexões`);
  console.log(`[CMMS] Health check: http://localhost:${PORT}/status`);
});
