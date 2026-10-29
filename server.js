const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 1e6
});
const PORT = process.env.PORT || 3000;
const rooms = new Map();
const MAX_PLAYERS = 8;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));

function cleanName(value) {
  return String(value || 'NEON').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 14) || 'NEON';
}
function cleanColor(value) {
  const s = String(value || '#00f5ff');
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : '#00f5ff';
}
function roomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); }
  while (rooms.has(code));
  return code;
}
function roomPlayers(room) {
  return [...room.players.entries()].map(([id, p]) => ({ id, name: p.name, snake: p.snake }));
}
function emitPlayers(code) {
  const room = rooms.get(code);
  if (room) io.to(code).emit('players', roomPlayers(room));
}
function validCode(v) { return /^[A-Z0-9]{5}$/.test(String(v || '').toUpperCase()); }

io.on('connection', socket => {
  socket.on('create-room', (payload = {}) => {
    // Avoid leaving a stale room if a client creates another room in the same session.
    leaveCurrentRoom(socket);
    const code = roomCode();
    const room = {
      code,
      hostId: socket.id,
      worldSize: [2400, 3600, 5200].includes(Number(payload.worldSize)) ? Number(payload.worldSize) : 3600,
      config: {
        botCount: Math.max(5, Math.min(35, Number(payload.botCount) || 18)),
        difficulty: ['chill', 'normal', 'wild'].includes(payload.difficulty) ? payload.difficulty : 'normal',
        powerRate: ['few', 'normal', 'many'].includes(payload.powerRate) ? payload.powerRate : 'normal'
      },
      players: new Map(),
      worldState: null,
      createdAt: Date.now()
    };
    room.players.set(socket.id, { name: cleanName(payload.name), color: cleanColor(payload.color), snake: null });
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room-created', { code, worldSize: room.worldSize, config: room.config });
    emitPlayers(code);
  });

  socket.on('join-room', (payload = {}) => {
    const code = String(payload.code || '').trim().toUpperCase();
    if (!validCode(code)) return socket.emit('room-error', { message: 'Room codes are 5 letters/numbers.' });
    const room = rooms.get(code);
    if (!room) return socket.emit('room-error', { message: 'Room not found. Ask the host to create a new room.' });
    if (room.players.size >= MAX_PLAYERS) return socket.emit('room-error', { message: 'Room is full (maximum 8 players).' });
    leaveCurrentRoom(socket);
    room.players.set(socket.id, { name: cleanName(payload.name), color: cleanColor(payload.color), snake: null });
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('room-joined', { code, worldSize: room.worldSize, config: room.config, worldState: room.worldState });
    socket.to(code).emit('player-joined', { id: socket.id, name: cleanName(payload.name) });
    emitPlayers(code);
  });

  socket.on('player-update', payload => {
    if (!payload || typeof payload !== 'object') return;
    const code = String(payload.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room || socket.data.roomCode !== code || !room.players.has(socket.id)) return;
    const s = payload.snake;
    if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.angle)) return;
    const body = Array.isArray(s.body) ? s.body.slice(0, 1200).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y)).map(p => ({ x: p.x, y: p.y })) : [];
    const safeSnake = {
      x: Math.max(0, Math.min(room.worldSize, s.x)), y: Math.max(0, Math.min(room.worldSize, s.y)),
      angle: s.angle, color: cleanColor(s.color), name: cleanName(s.name),
      size: Math.max(5, Math.min(500, Number(s.size) || 8)), body, shield: Math.max(0, Math.min(10, Number(s.shield) || 0))
    };
    room.players.get(socket.id).snake = safeSnake;
    socket.to(code).emit('player-update', { id: socket.id, snake: safeSnake });
  });

  socket.on('collect-food', payload => {
    if (!payload || !Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
    const code = String(payload.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room || socket.data.roomCode !== code || !room.players.has(socket.id)) return;
    const event = { x: Math.max(0, Math.min(room.worldSize, payload.x)), y: Math.max(0, Math.min(room.worldSize, payload.y)), kind: payload.kind === 'power' ? 'power' : 'food' };
    io.to(code).emit('food-collected', event);
  });

  socket.on('world-state', payload => {
    if (!payload || typeof payload !== 'object') return;
    const code = String(payload.code || '').toUpperCase();
    const room = rooms.get(code);
    if (!room || socket.data.roomCode !== code || room.hostId !== socket.id) return;
    const safeArray = (arr, max) => Array.isArray(arr) ? arr.slice(0, max).filter(o => o && Number.isFinite(o.x) && Number.isFinite(o.y)).map(o => ({
      x: Math.max(0, Math.min(room.worldSize, o.x)), y: Math.max(0, Math.min(room.worldSize, o.y)),
      ...(Number.isFinite(o.r) ? { r: Math.max(1, Math.min(20, o.r)) } : {}),
      ...(typeof o.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(o.color) ? { color: o.color } : {}),
      ...(typeof o.type === 'string' && ['gold', 'speed', 'shield'].includes(o.type) ? { type: o.type } : {}),
      ...(Number.isFinite(o.value) ? { value: o.value } : {})
    })) : [];
    room.worldState = { foods: safeArray(payload.foods, 1200), powers: safeArray(payload.powers, 100), updatedAt: Date.now() };
    socket.to(code).emit('world-state', room.worldState);
  });

  socket.on('disconnect', () => leaveCurrentRoom(socket));
  socket.on('leave-room', () => leaveCurrentRoom(socket));
});

function leaveCurrentRoom(socket) {
  const code = socket.data.roomCode;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  delete socket.data.roomCode;
  if (!room) return;
  const old = room.players.get(socket.id);
  room.players.delete(socket.id);
  if (room.players.size === 0) {
    rooms.delete(code);
    return;
  }
  if (room.hostId === socket.id) { room.hostId = room.players.keys().next().value; io.to(code).emit('host-changed', { id: room.hostId, isHost: false }); io.to(room.hostId).emit('host-changed', { id: room.hostId, isHost: true }); }
  io.to(code).emit('player-left', { id: socket.id, name: old ? old.name : 'Player' });
  emitPlayers(code);
}

server.listen(PORT, '0.0.0.0', () => console.log(`Neon Wilds online server listening on ${PORT}`));
