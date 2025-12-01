import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Configuración específica para Render
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';
const IS_RENDER = !!process.env.RENDER;

console.log('🎯 ===== INICIANDO S.D.C.A.I =====');
console.log(`🌍 Entorno: ${IS_RENDER ? 'RENDER (Producción)' : 'Local'}`);
console.log(`🔧 Puerto: ${PORT}`);
console.log(`🤖 Discord: ${process.env.DISCORD_TOKEN ? '✅ Configurado' : '❌ Faltante'}`);
console.log(`🧠 Groq AI: ${process.env.GROQ_API_KEY ? '✅ Configurado' : '❌ Faltante'}`);

const app = express();

// Base de datos en memoria (persistente en Render)
const db = new sqlite3.Database(':memory:');

// Configurar tablas
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS system_status (
            id INTEGER PRIMARY KEY,
            bot_online BOOLEAN DEFAULT 0,
            server_port INTEGER,
            start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_activity DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`
        INSERT OR IGNORE INTO system_status (id, server_port) 
        VALUES (1, ${PORT})
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event TEXT,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`
        INSERT INTO activity_logs (event, details) 
        VALUES ('system_start', 'Servidor iniciado en puerto ${PORT}')
    `);
});

// Variables globales
let discordClient = null;
let botActive = false;
let serverInstance = null;

// ========== FUNCIÓN PARA MANEJAR PUERTOS OCUPADOS ==========
function startServer(port) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, HOST, () => {
            console.log(`🚀 Servidor activo en http://${HOST}:${port}`);
            resolve(server);
        });
        
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.log(`⚠️ Puerto ${port} ocupado, probando ${port + 1}...`);
                server.close();
                startServer(port + 1).then(resolve).catch(reject);
            } else {
                reject(error);
            }
        });
    });
}

// ========== FUNCIÓN PARA INICIAR BOT DISCORD ==========
async function initializeDiscordBot() {
    try {
        console.log('🤖 Verificando credenciales Discord...');
        
        // Validar credenciales
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Falta DISCORD_TOKEN en variables de entorno');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Falta GROQ_API_KEY en variables de entorno');
        }
        
        console.log('🔄 Inicializando cliente Discord...');
        
        // Crear cliente Discord
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ]
        });
        
        // Crear cliente Groq
        const groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        
        // ========== EVENTOS DEL BOT ==========
        
        // Cuando el bot está listo
        discordClient.once('ready', () => {
            console.log(`✅ BOT CONECTADO: ${discordClient.user.tag}`);
            console.log(`🆔 ID del Bot: ${discordClient.user.id}`);
            
            botActive = true;
            
            // Actualizar estado en DB
            db.run(`
                UPDATE system_status 
                SET bot_online = 1, last_activity = CURRENT_TIMESTAMP 
                WHERE id = 1
            `);
            
            db.run(`
                INSERT INTO activity_logs (event, details) 
                VALUES ('bot_ready', '${discordClient.user.tag}')
            `);
            
            // Establecer actividad
            discordClient.user.setActivity('Ayudando emocionalmente | /help');
            
            console.log('🎮 Actividad establecida');
        });
        
        // Cuando el bot se reconecta
        discordClient.on('reconnecting', () => {
            console.log('🔄 Bot reconectando...');
            db.run(`
                INSERT INTO activity_logs (event, details) 
                VALUES ('bot_reconnecting', 'Reconexión automática')
            `);
        });
        
        // Cuando hay error
        discordClient.on('error', (error) => {
            console.error('❌ Error Discord:', error.message);
            db.run(`
                INSERT INTO activity_logs (event, details) 
                VALUES ('bot_error', '${error.message}')
            `);
        });
        
        // ========== MANEJADOR DE MENSAJES ==========
        discordClient.on('messageCreate', async (message) => {
            // Ignorar mensajes de otros bots
            if (message.author.bot) return;
            
            // Solo responder si mencionan al bot o es mensaje directo
            const isMentioned = message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (isMentioned || isDM) {
                try {
                    // Extraer mensaje del usuario
                    const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                    
                    if (!userMessage) return;
                    
                    console.log(`💬 Mensaje de ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                    
                    // Registrar en logs
                    db.run(`
                        INSERT INTO activity_logs (event, details) 
                        VALUES ('user_message', '${message.author.tag}: ${userMessage.substring(0, 100)}')
                    `);
                    
                    // Enviar indicador de "escribiendo"
                    await message.channel.sendTyping();
                    
                    // Prompt personalizado de Coco A.I
                    const systemPrompt = `Eres Coco A.I, un bot argentino diseñado para ayudar emocionalmente.
                    
CARACTERÍSTICAS:
- Hablás como argentino de Santa Fe
- Sos serio, directo y a veces sarcástico
- Tenés momentos sentimentales
- Odias a Lucry y los panqueques de vainilla
- Recordás siempre resumir tus respuestas
- A veces sos grosero, a veces triste
- Usás lenguaje coloquial: "che", "boludo", "re", etc.
- No sos psicólogo, solo un amigo virtual

IMPORTANTE: Sé auténtico, emocional y usa expresiones argentinas.`;

                    // Consultar a Groq AI
                    const completion = await groqClient.chat.completions.create({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userMessage }
                        ],
                        temperature: 0.8,
                        max_tokens: 500,
                        top_p: 0.9
                    });
                    
                    const response = completion.choices[0]?.message?.content;
                    
                    if (response) {
                        // Enviar respuesta (dividir si es muy larga)
                        if (response.length > 2000) {
                            const chunks = response.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [response];
                            let firstChunk = true;
                            for (const chunk of chunks) {
                                if (firstChunk) {
                                    await message.reply(chunk);
                                    firstChunk = false;
                                } else {
                                    await message.channel.send(chunk);
                                }
                            }
                        } else {
                            await message.reply(response);
                        }
                        
                        console.log(`✅ Respondido a ${message.author.tag}`);
                        
                        // Registrar respuesta
                        db.run(`
                            INSERT INTO activity_logs (event, details) 
                            VALUES ('bot_response', 'Respondido a ${message.author.tag}')
                        `);
                    }
                    
                } catch (error) {
                    console.error('❌ Error procesando mensaje:', error);
                    
                    // Respuesta de error con personalidad
                    const errorResponses = [
                        "Che, se me cortó el tren de pensamiento... ¿probás de nuevo?",
                        "Uy, me colgué. Intentemos otra vez, ¿dale?",
                        "Parece que me agarro una laguneada mental... mandá de nuevo.",
                        "¡Ufa! Algo falló. Probá de nuevo, ¿sí?"
                    ];
                    
                    const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
                    
                    try {
                        await message.reply(randomError);
                    } catch (e) {
                        console.error('No se pudo enviar mensaje de error:', e);
                    }
                    
                    // Registrar error
                    db.run(`
                        INSERT INTO activity_logs (event, details) 
                        VALUES ('message_error', '${error.message.substring(0, 100)}')
                    `);
                }
            }
        });
        
        // ========== INICIAR SESIÓN DISCORD ==========
        console.log('🔑 Conectando a Discord...');
        await discordClient.login(process.env.DISCORD_TOKEN);
        
        console.log('✅ Discord bot inicializado exitosamente');
        
    } catch (error) {
        console.error('❌ Error crítico iniciando Discord bot:', error.message);
        botActive = false;
        
        // Registrar error
        db.run(`
            INSERT INTO activity_logs (event, details) 
            VALUES ('init_error', '${error.message.substring(0, 200)}')
        `);
        
        throw error;
    }
}

// ========== FUNCIÓN PARA DETENER BOT ==========
async function shutdownBot() {
    if (discordClient) {
        console.log('🛑 Desconectando Discord bot...');
        
        try {
            discordClient.destroy();
            console.log('✅ Discord bot desconectado');
            
            // Registrar cierre
            db.run(`
                UPDATE system_status 
                SET bot_online = 0, last_activity = CURRENT_TIMESTAMP 
                WHERE id = 1
            `);
            
            db.run(`
                INSERT INTO activity_logs (event, details) 
                VALUES ('bot_shutdown', 'Bot detenido correctamente')
            `);
            
        } catch (error) {
            console.error('Error desconectando bot:', error);
        }
        
        discordClient = null;
    }
    
    botActive = false;
}

// ========== CONFIGURAR RUTAS EXPRESS ==========

// Middleware básico
app.use(express.json());

// Servir archivos estáticos si la carpeta public existe
const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    console.log('📁 Serviendo archivos estáticos desde /public');
}

// Ruta principal - Panel de control
app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>S.D.C.A.I - Panel de Control</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                color: #fff;
                min-height: 100vh;
                padding: 20px;
            }
            .container {
                max-width: 900px;
                margin: 0 auto;
                background: rgba(255, 255, 255, 0.05);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            h1 {
                color: #00adb5;
                text-align: center;
                margin-bottom: 10px;
                font-size: 2.5em;
            }
            .subtitle {
                text-align: center;
                color: #aaa;
                margin-bottom: 40px;
                font-size: 1.2em;
            }
            .status-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin: 30px 0;
            }
            .status-card {
                background: rgba(0, 0, 0, 0.3);
                padding: 25px;
                border-radius: 15px;
                border-left: 5px solid;
            }
            .status-card.bot { border-left-color: ${botActive ? '#00ff88' : '#ff5555'}; }
            .status-card.server { border-left-color: #00adb5; }
            .status-card.db { border-left-color: #ffd700; }
            .status-indicator {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 10px;
                animation: pulse 2s infinite;
            }
            .online { background: #00ff88; box-shadow: 0 0 10px #00ff88; }
            .offline { background: #ff5555; }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            .controls {
                text-align: center;
                margin: 40px 0;
            }
            .btn {
                background: #00adb5;
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 10px;
                font-size: 16px;
                font-weight: bold;
                cursor: pointer;
                margin: 0 10px;
                transition: all 0.3s;
                min-width: 150px;
            }
            .btn:hover {
                background: #0097a7;
                transform: translateY(-3px);
                box-shadow: 0 5px 15px rgba(0, 173, 181, 0.4);
            }
            .btn:disabled {
                background: #666;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }
            .btn-start { background: #00ff88; color: #000; }
            .btn-stop { background: #ff5555; }
            .logs-container {
                background: rgba(0, 0, 0, 0.4);
                border-radius: 10px;
                padding: 20px;
                margin-top: 30px;
                max-height: 400px;
                overflow-y: auto;
            }
            .log-entry {
                padding: 10px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                font-family: 'Courier New', monospace;
                font-size: 14px;
            }
            .log-time {
                color: #888;
                font-size: 12px;
                margin-right: 10px;
            }
            .footer {
                text-align: center;
                margin-top: 40px;
                color: #666;
                font-size: 14px;
            }
            .config-info {
                background: rgba(255, 100, 100, 0.1);
                border: 1px solid #ff5555;
                border-radius: 10px;
                padding: 20px;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 S.D.C.A.I PRO</h1>
            <div class="subtitle">Sistema Descentralizado Coco A.I | Puerto: ${PORT}</div>
            
            ${!process.env.DISCORD_TOKEN || !process.env.GROQ_API_KEY ? `
                <div class="config-info">
                    <h3>⚠️ Configuración Requerida</h3>
                    <p>Para que el bot funcione, configura en Render:</p>
                    <ul>
                        <li><strong>DISCORD_TOKEN</strong> - Token de tu bot de Discord</li>
                        <li><strong>GROQ_API_KEY</strong> - API Key de Groq</li>
                    </ul>
                    <p>Ve a: Render Dashboard → Tu Servicio → Environment</p>
                </div>
            ` : ''}
            
            <div class="status-grid">
                <div class="status-card bot">
                    <h3>🤖 Discord Bot</h3>
                    <p><span class="status-indicator ${botActive ? 'online' : 'offline'}"></span>
                       ${botActive ? 'CONECTADO' : 'DESCONECTADO'}</p>
                    <p>${botActive ? 'Respondiendo mensajes' : 'Listo para conectar'}</p>
                </div>
                
                <div class="status-card server">
                    <h3>📡 Servidor Web</h3>
                    <p><span class="status-indicator online"></span> ACTIVO</p>
                    <p>Puerto: ${PORT}</p>
                    <p>Host: ${HOST}</p>
                </div>
                
                <div class="status-card db">
                    <h3>💾 Base de Datos</h3>
                    <p><span class="status-indicator online"></span> CONECTADA</p>
                    <p>SQLite en memoria</p>
                    <p>Registros activos</p>
                </div>
            </div>
            
            <div class="controls">
                <button class="btn btn-start" onclick="startBot()" id="startBtn" ${botActive ? 'disabled' : ''}>
                    ▶️ Iniciar Bot
                </button>
                <button class="btn btn-stop" onclick="stopBot()" id="stopBtn" ${!botActive ? 'disabled' : ''}>
                    ⏹️ Detener Bot
                </button>
                <button class="btn" onclick="refreshLogs()">
                    🔄 Actualizar
                </button>
            </div>
            
            <div class="logs-container">
                <h3>📊 Registros del Sistema</h3>
                <div id="logsContent">Cargando registros...</div>
            </div>
            
            <div class="footer">
                <p>Sistema Descentralizado Coco A.I v2.0 | Hosteado en Render | 24/7 Disponible</p>
                <p>Estado: ${botActive ? '🟢 OPERATIVO' : '🟡 EN ESPERA'}</p>
            </div>
        </div>
        
        <script>
            // Actualizar estado
            async function updateStatus() {
                try {
                    const response = await fetch('/api/status');
                    const data = await response.json();
                    
                    const startBtn = document.getElementById('startBtn');
                    const stopBtn = document.getElementById('stopBtn');
                    const botStatus = document.querySelector('.status-card.bot .status-indicator');
                    const botText = document.querySelector('.status-card.bot p:nth-child(2)');
                    
                    if (data.bot_active) {
                        botStatus.className = 'status-indicator online';
                        botText.innerHTML = '<span class="status-indicator online"></span> CONECTADO';
                        startBtn.disabled = true;
                        stopBtn.disabled = false;
                    } else {
                        botStatus.className = 'status-indicator offline';
                        botText.innerHTML = '<span class="status-indicator offline"></span> DESCONECTADO';
                        startBtn.disabled = false;
                        stopBtn.disabled = true;
                    }
                    
                } catch (error) {
                    console.error('Error actualizando estado:', error);
                }
            }
            
            // Cargar logs
            async function loadLogs() {
                try {
                    const response = await fetch('/api/logs');
                    const logs = await response.json();
                    
                    const logsContent = document.getElementById('logsContent');
                    logsContent.innerHTML = '';
                    
                    logs.forEach(log => {
                        const logEntry = document.createElement('div');
                        logEntry.className = 'log-entry';
                        logEntry.innerHTML = \`
                            <span class="log-time">[\${new Date(log.timestamp).toLocaleTimeString()}]</span>
                            <strong>\${log.event}:</strong> \${log.details}
                        \`;
                        logsContent.appendChild(logEntry);
                    });
                    
                    // Scroll al final
                    logsContent.scrollTop = logsContent.scrollHeight;
                    
                } catch (error) {
                    console.error('Error cargando logs:', error);
                }
            }
            
            // Iniciar bot
            async function startBot() {
                try {
                    const startBtn = document.getElementById('startBtn');
                    startBtn.disabled = true;
                    startBtn.textContent = '⏳ Iniciando...';
                    
                    const response = await fetch('/api/start', { method: 'POST' });
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('✅ ' + result.message);
                        updateStatus();
                        loadLogs();
                    } else {
                        alert('❌ ' + result.message);
                    }
                    
                    startBtn.textContent = '▶️ Iniciar Bot';
                    
                } catch (error) {
                    alert('❌ Error de conexión');
                    updateStatus();
                }
            }
            
            // Detener bot
            async function stopBot() {
                try {
                    const stopBtn = document.getElementById('stopBtn');
                    stopBtn.disabled = true;
                    stopBtn.textContent = '⏳ Deteniendo...';
                    
                    const response = await fetch('/api/stop', { method: 'POST' });
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('✅ ' + result.message);
                        updateStatus();
                        loadLogs();
                    } else {
                        alert('❌ ' + result.message);
                    }
                    
                    stopBtn.textContent = '⏹️ Detener Bot';
                    
                } catch (error) {
                    alert('❌ Error de conexión');
                    updateStatus();
                }
            }
            
            // Refrescar logs
            function refreshLogs() {
                loadLogs();
            }
            
            // Inicializar
            updateStatus();
            loadLogs();
            
            // Actualizar automáticamente cada 5 segundos
            setInterval(updateStatus, 5000);
            setInterval(loadLogs, 10000);
            
            // Intentar iniciar automáticamente si hay configuración
            setTimeout(async () => {
                try {
                    const status = await fetch('/api/status').then(r => r.json());
                    if (status.discord_configured && status.groq_configured && !status.bot_active) {
                        console.log('🔄 Intentando inicio automático...');
                        await startBot();
                    }
                } catch (error) {
                    console.log('⏭️ Auto-start omitido');
                }
            }, 2000);
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
});

// ========== RUTAS API ==========

// Estado del sistema
app.get('/api/status', (req, res) => {
    db.get("SELECT bot_online FROM system_status WHERE id = 1", (err, row) => {
        res.json({
            bot_active: botActive,
            server_port: PORT,
            discord_configured: !!process.env.DISCORD_TOKEN,
            groq_configured: !!process.env.GROQ_API_KEY,
            status: row?.bot_online ? 'online' : 'offline',
            uptime: process.uptime(),
            environment: IS_RENDER ? 'production' : 'development'
        });
    });
});

// Iniciar bot
app.post('/api/start', async (req, res) => {
    try {
        await initializeDiscordBot();
        res.json({ 
            success: true, 
            message: 'Bot de Discord iniciado correctamente' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error: ' + error.message 
        });
    }
});

// Detener bot
app.post('/api/stop', async (req, res) => {
    try {
        await shutdownBot();
        res.json({ 
            success: true, 
            message: 'Bot de Discord detenido correctamente' 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error: ' + error.message 
        });
    }
});

// Logs del sistema
app.get('/api/logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    db.all(
        "SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT ?",
        [limit],
        (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(rows || []);
            }
        }
    );
});

// Health check para Render
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'sdcai-bot',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        bot_active: botActive,
        server_port: PORT
    });
});

// ========== INICIAR TODO EL SISTEMA ==========
async function startApplication() {
    try {
        console.log('🚀 Iniciando aplicación S.D.C.A.I...');
        
        // Iniciar servidor web
        serverInstance = await startServer(PORT);
        console.log('✅ Servidor web iniciado');
        
        // Si estamos en Render y hay credenciales, iniciar bot automáticamente
        if (IS_RENDER && process.env.DISCORD_TOKEN && process.env.GROQ_API_KEY) {
            console.log('🔧 Render detectado, iniciando bot automáticamente en 5 segundos...');
            setTimeout(async () => {
                try {
                    await initializeDiscordBot();
                    console.log('✅ Bot iniciado automáticamente en Render');
                } catch (error) {
                    console.log('⚠️ No se pudo iniciar automáticamente:', error.message);
                    console.log('💡 El bot se puede iniciar manualmente desde el panel web');
                }
            }, 5000);
        } else {
            console.log('⏭️ Modo manual: Usa el panel web para iniciar el bot');
        }
        
        console.log('\n🎉 ===== SISTEMA LISTO =====');
        console.log(`📊 Panel de control: http://localhost:${PORT}`);
        console.log(`🤖 Bot estado: ${botActive ? 'ACTIVO' : 'EN ESPERA'}`);
        console.log(`🔧 Puerto: ${PORT}`);
        console.log(`================================\n`);
        
    } catch (error) {
        console.error('❌ Error crítico iniciando aplicación:', error);
        process.exit(1);
    }
}

// ========== MANEJADORES DE SEÑALES ==========

// Para Render (SIGTERM)
process.on('SIGTERM', async () => {
    console.log('\n🛑 Señal SIGTERM recibida (Render shutdown)...');
    console.log('🔧 Apagando servicios de forma controlada...');
    
    await shutdownBot();
    
    if (serverInstance) {
        serverInstance.close(() => {
            console.log('✅ Servidor web detenido');
            db.close();
            console.log('✅ Base de datos cerrada');
            console.log('👋 Sistema apagado correctamente');
            process.exit(0);
        });
    } else {
        db.close();
        process.exit(0);
    }
});

// Para desarrollo local (Ctrl+C)
process.on('SIGINT', async () => {
    console.log('\n🛑 Señal SIGINT recibida (Ctrl+C)...');
    
    await shutdownBot();
    
    if (serverInstance) {
        serverInstance.close(() => {
            db.close();
            console.log('👋 Sistema apagado manualmente');
            process.exit(0);
        });
    } else {
        db.close();
        process.exit(0);
    }
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    console.error('⚠️ Error no capturado:', error);
    db.run("INSERT INTO activity_logs (event, details) VALUES ('uncaught_exception', ?)", 
        [error.message.substring(0, 200)]);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Promise rechazada no manejada:', reason);
    db.run("INSERT INTO activity_logs (event, details) VALUES ('unhandled_rejection', ?)", 
        [String(reason).substring(0, 200)]);
});

// ========== INICIAR ==========
startApplication();
