/**
 * TEST WEBSOCKET CONNECTION
 * Archivo de prueba para verificar la conexión WebSocket
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Configuración CORS muy permisiva para desarrollo
const io = new Server(server, {
  cors: {
    origin: "*", // Permitir cualquier origen en desarrollo
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware CORS
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Backend funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ Cliente conectado:', socket.id);
  
  socket.emit('connected', {
    socketId: socket.id,
    message: 'Conexión WebSocket establecida correctamente',
    timestamp: new Date().toISOString()
  });

  socket.on('test-message', (data) => {
    console.log('📨 Mensaje recibido:', data);
    socket.emit('test-response', {
      received: data,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Cliente desconectado:', socket.id, 'Razón:', reason);
  });

  socket.on('error', (error) => {
    console.error('🚨 Error en Socket.IO:', error);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`
🚀 SERVIDOR DE PRUEBA WEBSOCKET
📍 Puerto: ${PORT}
🌍 Entorno: ${process.env.NODE_ENV || 'development'}
⏰ Iniciado: ${new Date().toISOString()}

📋 Endpoints disponibles:
   GET  /api/test
   WS   /socket.io/

🔗 URLs de prueba:
   Frontend: http://localhost:3000
   Backend:  http://localhost:3001
   WebSocket: ws://localhost:3001/socket.io/
  `);
});

module.exports = app;

