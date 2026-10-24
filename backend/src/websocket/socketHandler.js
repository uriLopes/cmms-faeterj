/**
 * Gerenciador de Eventos em Tempo Real do Barramento WebSocket (Socket.io)
 *
 * Salas de Transmissão:
 * - 'cockpit_pcm': Recebe todos os chamados da fábrica
 * - 'linha_<id>': Recebe chamados específicos de uma linha (Team Leader e Operadores)
 * - 'tecnico_<id>': Notificações individuais de OS atribuída ao técnico
 */
function setupSocketIO(io) {
  io.on('connection', (socket) => {
    console.log(`[WebSocket] Cliente conectado: ${socket.id}`);

    // Entrada em salas especializadas
    socket.on('entrar_sala', (sala) => {
      socket.join(sala);
      console.log(`[WebSocket] Cliente ${socket.id} entrou na sala '${sala}'`);
    });

    socket.on('sair_sala', (sala) => {
      socket.leave(sala);
      console.log(`[WebSocket] Cliente ${socket.id} saiu da sala '${sala}'`);
    });

    // Ping para telemetria e teste de conexão
    socket.on('ping_telemetria', (data) => {
      socket.emit('pong_telemetria', {
        recebido: data,
        servidor_hora: new Date().toISOString()
      });
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Cliente desconectado: ${socket.id}`);
    });
  });
}

module.exports = setupSocketIO;
