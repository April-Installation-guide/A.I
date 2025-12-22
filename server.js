// server.js - Servidor completo que ejecuta el bot de Discord
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 12100;
const server = createServer(app);

// ========== CONFIGURACIÓN WEBSOCKET ==========
const wss = new WebSocketServer({ 
    server: server,
    path: '/ws',
    clientTracking: true
});

const clients = new Set();

wss.on('connection', (ws, req) => {
    console.log('✅ Cliente WebSocket conectado desde:', req.socket.remoteAddress);
    clients.add(ws);
    
    // Enviar bienvenida
    ws.send(JSON.stringify({
        type: 'welcome',
        message: '✅ Conectado al servidor Mancy',
        timestamp: new Date().toISOString()
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('📨 Mensaje recibido:', data.type);
            
            if (data.type === 'ping') {
                ws.send(JSON.stringify({
                    type: 'pong',
                    timestamp: Date.now()
                }));
            } else if (data.type === 'get_status') {
                ws.send(JSON.stringify({
                    type: 'bot_status',
                    status: global.discordBot?.isReady ? 'online' : 'offline',
                    data: global.discordBot?.getBotStatus() || {},
                    timestamp: new Date().toISOString()
                }));
            }
        } catch (error) {
            console.error('Error procesando mensaje WS:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('🔌 Cliente WebSocket desconectado');
        clients.delete(ws);
    });
    
    ws.on('error', (error) => {
        console.error('❌ Error WebSocket:', error.message);
        clients.delete(ws);
    });
});

// Función para broadcast
function broadcast(data) {
    const message = JSON.stringify(data);
    let sent = 0;
    
    clients.forEach((client) => {
        if (client.readyState === 1) { // OPEN
            try {
                client.send(message);
                sent++;
            } catch (error) {
                console.error('Error enviando broadcast:', error);
                clients.delete(client);
            }
        } else {
            clients.delete(client);
        }
    });
    
    return sent;
}

// Heartbeat cada 30 segundos
setInterval(() => {
    broadcast({
        type: 'heartbeat',
        timestamp: Date.now(),
        clients: clients.size
    });
}, 30000);

// ========== CONFIGURACIÓN EXPRESS ==========
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(join(__dirname, 'public')));

// ========== RUTAS ==========
app.get('/', (req, res) => {
    const indexPath = join(__dirname, 'index.html');
    res.sendFile(indexPath);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        bot: global.discordBot?.isReady ? 'online' : 'offline'
    });
});

app.get('/api/status', (req, res) => {
    if (!global.discordBot) {
        return res.json({ 
            bot: false, 
            message: 'Bot no inicializado',
            status: 'offline'
        });
    }
    
    res.json({
        bot: true,
        status: global.discordBot.isReady ? 'online' : 'offline',
        ...global.discordBot.getBotStatus()
    });
});

app.get('/api/stats', (req, res) => {
    if (!global.discordBot) {
        return res.json({ error: 'Bot no disponible' });
    }
    
    res.json(global.discordBot.getBotStatus());
});

app.post('/api/control', async (req, res) => {
    const { action } = req.body;
    
    if (!['start', 'stop', 'restart'].includes(action)) {
        return res.status(400).json({ error: 'Acción no válida' });
    }
    
    try {
        let result;
        
        switch(action) {
            case 'start':
                if (global.discordBot && global.discordBot.isReady) {
                    result = { success: false, message: 'Bot ya está en línea' };
                } else {
                    await global.discordBot.start();
                    result = { success: true, message: 'Bot iniciado' };
                }
                break;
                
            case 'stop':
                if (!global.discordBot || !global.discordBot.isReady) {
                    result = { success: false, message: 'Bot no está en línea' };
                } else {
                    await global.discordBot.shutdown();
                    result = { success: true, message: 'Bot detenido' };
                }
                break;
                
            case 'restart':
                if (global.discordBot && global.discordBot.isReady) {
                    await global.discordBot.shutdown();
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
                await global.discordBot.start();
                result = { success: true, message: 'Bot reiniciado' };
                break;
        }
        
        // Broadcast del cambio de estado
        broadcast({
            type: 'bot_status',
            status: action === 'stop' ? 'offline' : 'online',
            message: result.message,
            timestamp: new Date().toISOString()
        });
        
        res.json(result);
        
    } catch (error) {
        console.error('Error en control:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/websocket-info', (req, res) => {
    res.json({
        status: 'operational',
        websocket: {
            enabled: true,
            path: '/ws',
            clients: clients.size,
            protocol: 'ws/wss',
            url: `ws://${req.get('host')}/ws`
        },
        server: {
            time: new Date().toISOString(),
            uptime: process.uptime(),
            port: PORT,
            nodeVersion: process.version
        }
    });
});

app.get('/panel', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Mancy Panel</title>
            <style>
                body { font-family: Arial; background: #111; color: white; padding: 20px; }
                h1 { color: #4CAF50; }
                .card { 
                    background: #222; 
                    padding: 15px; 
                    margin: 10px 0; 
                    border-radius: 8px;
                    border-left: 4px solid;
                }
                .success { border-left-color: #4CAF50; }
                .warning { border-left-color: #ff9800; }
                .danger { border-left-color: #f44336; }
            </style>
        </head>
        <body>
            <h1>🤖 Panel de Administración - Mancy Bot</h1>
            <div class="card ${process.env.DISCORD_BOT_TOKEN ? 'success' : 'danger'}">
                <h3>Discord Bot Token</h3>
                <p>${process.env.DISCORD_BOT_TOKEN ? '✅ Configurado' : '❌ NO configurado'}</p>
            </div>
            <div class="card ${process.env.GROQ_API_KEY ? 'success' : 'warning'}">
                <h3>Groq API Key</h3>
                <p>${process.env.GROQ_API_KEY ? '✅ Configurada' : '⚠️ Recomendada'}</p>
            </div>
            <div class="card success">
                <h3>Servidor Web</h3>
                <p>✅ Activo en puerto: ${PORT}</p>
                <p>🔌 WebSocket: ${clients.size} clientes conectados</p>
                <p><a href="/" style="color: #4CAF50;">Ir al Control Principal</a></p>
            </div>
        </body>
        </html>
    `);
});

// ========== INICIAR SERVIDOR ==========
server.listen(PORT, () => {
    console.log('✅ Servidor funcionando en puerto', PORT);
    console.log('🔗 URL Principal: http://localhost:' + PORT);
    console.log('📊 Panel Admin: http://localhost:' + PORT + '/panel');
    console.log('📡 API Status: http://localhost:' + PORT + '/api/status');
    console.log('🔌 WebSocket: ws://localhost:' + PORT + '/ws');
    
    console.log('\n🔍 Variables de entorno:');
    console.log('   DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? '✅ Presente' : '❌ Faltante');
    console.log('   GROQ_API_KEY:', process.env.GROQ_API_KEY ? '✅ Presente' : '❌ Faltante');
    console.log('   PORT:', PORT);
    
    // IMPORTANTE: Iniciar el bot DESPUÉS del servidor
    console.log('\n🤖 Iniciando bot de Discord...');
    import('./bot.js')
        .then(() => {
            console.log('✅ Módulo bot.js cargado');
            
            // El bot se auto-inicia en bot.js
            // Si no, descomentar esto:
            // if (global.discordBot) {
            //     global.discordBot.start();
            // }
        })
        .catch((error) => {
            console.error('❌ Error cargando bot.js:', error);
            
            // Broadcast del error
            broadcast({
                type: 'error',
                message: 'Error al iniciar el bot: ' + error.message,
                timestamp: new Date().toISOString()
            });
        });
});

// Exportar para usar en bot.js si es necesario
export { broadcast, clients };

// Manejo de errores
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM recibido, cerrando...');
    server.close(() => {
        console.log('✅ Servidor cerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT recibido, cerrando...');
    server.close(() => {
        console.log('✅ Servidor cerrado');
        process.exit(0);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});
