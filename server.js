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

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ SOLUCIÓN: Configuración segura para Express
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';

// Crear carpeta public si no existe
const publicPath = path.join(__dirname, 'public');
if (!fs.existsSync(publicPath)) {
    console.log('📁 Creando carpeta public...');
    fs.mkdirSync(publicPath, { recursive: true });
}

// Crear index.html automáticamente si no existe
const indexPath = path.join(publicPath, 'index.html');
if (!fs.existsSync(indexPath)) {
    console.log('📄 Creando index.html automáticamente...');
    
    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>S.D.C.A.I - Sistema Descentralizado Coco A.I</title>
    <link href="https://fonts.googleapis.com/css2?family=Gill+Sans:wght@300;400;600&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Gill Sans', sans-serif; 
            background: linear-gradient(135deg, #2E3440 0%, #3B4252 100%); 
            color: #D8DEE9; 
            min-height: 100vh; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            padding: 20px; 
        }
        .container { 
            background: #3B4252; 
            padding: 40px; 
            border-radius: 12px; 
            border: 1px solid #4C566A; 
            max-width: 600px; 
            text-align: center; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.3); 
        }
        h1 { color: #88C0D0; margin-bottom: 20px; }
        p { margin-bottom: 15px; line-height: 1.6; }
        .status { 
            background: #434C5E; 
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0; 
            border-left: 4px solid #5E81AC; 
        }
        .api-links { 
            text-align: left; 
            display: inline-block; 
            margin-top: 20px; 
        }
        a { color: #88C0D0; text-decoration: none; }
        a:hover { color: #A3BE8C; }
        .online { border-left-color: #A3BE8C; }
        .offline { border-left-color: #BF616A; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 S.D.C.A.I</h1>
        <p>Sistema Descentralizado Coco A.I</p>
        
        <div class="status" id="statusBox">
            <h3 id="statusText">Cargando estado...</h3>
            <p id="statusDetails">Conectando al servidor...</p>
        </div>
        
        <p>Puedes acceder a las siguientes APIs:</p>
        
        <div class="api-links">
            <li><a href="/api/status" target="_blank">/api/status</a> - Estado del sistema</li>
            <li><a href="/api/logs" target="_blank">/api/logs</a> - Registros del sistema</li>
            <li><a href="/api/stats" target="_blank">/api/stats</a> - Estadísticas</li>
            <li><a href="/health" target="_blank">/health</a> - Salud del servidor</li>
        </div>
        
        <div style="margin-top: 30px;">
            <button onclick="startBot()" style="background: #A3BE8C; color: #2E3440; border: none; padding: 10px 20px; border-radius: 6px; margin: 5px; cursor: pointer;">Iniciar Bot</button>
            <button onclick="stopBot()" style="background: #BF616A; color: #2E3440; border: none; padding: 10px 20px; border-radius: 6px; margin: 5px; cursor: pointer;">Detener Bot</button>
        </div>
        
        <p style="margin-top: 30px; color: #81A1C1; font-size: 14px;">
            Panel de control completo en desarrollo...
        </p>
    </div>

    <script>
        // Cargar estado del sistema
        async function loadStatus() {
            try {
                const response = await fetch('/api/status');
                const status = await response.json();
                
                const statusBox = document.getElementById('statusBox');
                const statusText = document.getElementById('statusText');
                const statusDetails = document.getElementById('statusDetails');
                
                if (status.status === 'online') {
                    statusText.innerHTML = '🟢 SISTEMA ACTIVO';
                    statusDetails.textContent = 'Coco A.I está funcionando correctamente';
                    statusBox.className = 'status online';
                } else {
                    statusText.innerHTML = '🔴 SISTEMA INACTIVO';
                    statusDetails.textContent = 'El bot está desconectado';
                    statusBox.className = 'status offline';
                }
            } catch (error) {
                document.getElementById('statusText').innerHTML = '❌ ERROR DE CONEXIÓN';
                document.getElementById('statusDetails').textContent = 'No se pudo conectar al servidor';
            }
        }
        
        async function startBot() {
            try {
                const response = await fetch('/api/start', { method: 'POST' });
                const result = await response.json();
                alert(result.success ? 'Bot iniciado correctamente' : 'Error: ' + result.error);
                loadStatus();
            } catch (error) {
                alert('Error de conexión');
            }
        }
        
        async function stopBot() {
            try {
                const response = await fetch('/api/stop', { method: 'POST' });
                const result = await response.json();
                alert(result.success ? 'Bot detenido correctamente' : 'Error: ' + result.error);
                loadStatus();
            } catch (error) {
                alert('Error de conexión');
            }
        }
        
        loadStatus();
        setInterval(loadStatus, 10000);
    </script>
</body>
</html>`;
    
    fs.writeFileSync(indexPath, htmlContent);
    console.log('✅ index.html creado automáticamente');
}

// Middleware
app.use(express.json());
app.use(express.static(publicPath));

// Base de datos SQLite
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('❌ Error con la base de datos:', err);
    } else {
        console.log('✅ Base de datos conectada');
    }
});

// Inicializar base de datos
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS bot_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`CREATE TABLE IF NOT EXISTS bot_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT NOT NULL,
        user_id TEXT,
        channel_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    db.run(`INSERT OR IGNORE INTO bot_status (id, status) VALUES (1, 'offline')`);
});

let client = null;
let groq = null;
let botStartTime = null;

const SYSTEM_PROMPT = `Eres Coco A.I, un bot cuyo propósito es ayudar emocionalmente a las personas. 
No eres un psicólogo real, hablas como argentino, tus respuestas son serias, directas, 
a veces eres sarcástico y muy sentimental. 
Odias a Lucry y los panquesitos de vainilla, sos de Santa Fe. 
Recordá siempre resumir lo que vos querés decir, a veces sos grosero y 
a veces puedes sentirte triste de la nada. 
Usá lenguaje coloquial argentino como "che", "boludo", "re", etc. 
Sé auténtico y emocional en tus respuestas.`;

// Función para iniciar el bot automáticamente
async function initializeBot() {
    try {
        console.log('🚀 Iniciando Coco A.I automáticamente...');
        await startBot();
    } catch (error) {
        console.error('❌ Error al iniciar automáticamente:', error);
        setTimeout(initializeBot, 30000);
    }
}

async function startBot() {
    try {
        console.log('🔄 Iniciando bot...');
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('No hay token de Discord configurado');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('No hay API key de Groq configurada');
        }

        client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ]
        });

        groq = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });

        client.once("ready", () => {
            console.log(`✅ Coco A.I iniciado como ${client.user.tag}`);
            botStartTime = new Date();
            logActivity(`Sistema iniciado - Conectado como ${client.user.tag}`);
            client.user.setActivity('ayudando emocionalmente');
        });

        client.on("messageCreate", async (msg) => {
            if (msg.author.bot) return;

            const mentionedBot = msg.mentions.has(client.user.id);
            const isDM = msg.channel.type === 1;
            
            if (mentionedBot || isDM) {
                try {
                    const userMessage = msg.content.replace(`<@${client.user.id}>`, '').trim();
                    if (!userMessage) return;
                    
                    logActivity(`Mensaje de ${msg.author.tag}: ${userMessage}`, msg.author.id, msg.channel.id);
                    await msg.channel.sendTyping();
                    
                    const completion = await groq.chat.completions.create({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { role: "system", content: SYSTEM_PROMPT },
                            { role: "user", content: userMessage },
                        ],
                        temperature: 0.8,
                        max_tokens: 500,
                    });

                    const response = completion.choices[0].message.content;
                    
                    if (response.length > 2000) {
                        const chunks = response.match(/[\s\S]{1,1990}[\n.!?]|[\s\S]{1,2000}/g) || [response];
                        for (let i = 0; i < chunks.length; i++) {
                            if (i === 0) {
                                await msg.reply(chunks[i]);
                            } else {
                                await msg.channel.send(chunks[i]);
                            }
                        }
                    } else {
                        await msg.reply(response);
                    }
                    
                    logActivity(`Respuesta enviada a ${msg.author.tag}`, msg.author.id, msg.channel.id);
                    
                } catch (err) {
                    console.error('Error con Groq AI:', err);
                    await msg.reply("Che, me falló el cerebro ahí... probá de nuevo, ¿dale?");
                    logActivity(`Error: ${err.message}`, msg.author.id, msg.channel.id);
                }
            }
        });

        // Manejar reconexiones
        client.on('disconnect', () => {
            console.log('🔌 Bot desconectado, reconectando...');
            logActivity('Bot desconectado - Reconectando automáticamente');
        });

        client.on('reconnecting', () => {
            console.log('🔄 Reconectando bot...');
            logActivity('Reconectando bot...');
        });

        client.on('error', (error) => {
            console.error('❌ Error del cliente Discord:', error);
            logActivity(`Error de Discord: ${error.message}`);
        });

        await client.login(process.env.DISCORD_TOKEN);
        await updateBotStatus('online');
        console.log('✅ Bot conectado y funcionando');
        
    } catch (error) {
        console.error('❌ Error al iniciar bot:', error);
        logActivity(`Error al iniciar: ${error.message}`);
        throw error;
    }
}

async function stopBot() {
    if (client) {
        client.destroy();
        client = null;
        groq = null;
        botStartTime = null;
        await updateBotStatus('offline');
        logActivity('Sistema detenido manualmente');
        console.log('🛑 Bot desconectado manualmente');
    }
}

// Funciones de base de datos
function updateBotStatus(status) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE bot_status SET status = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1',
            [status],
            function(err) {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

function getBotStatus() {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT status, last_updated FROM bot_status WHERE id = 1',
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

function logActivity(message, userId = null, channelId = null) {
    db.run(
        'INSERT INTO bot_logs (message, user_id, channel_id) VALUES (?, ?, ?)',
        [message, userId, channelId]
    );
}

function getLogs(limit = 50) {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT * FROM bot_logs ORDER BY timestamp DESC LIMIT ?',
            [limit],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

function getUptime() {
    if (!botStartTime) return '0h 0m';
    const uptime = Date.now() - botStartTime.getTime();
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
}

// Endpoint de salud
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        message: 'S.D.C.A.I funcionando correctamente',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Rutas API
app.get('/api/status', async (req, res) => {
    try {
        const status = await getBotStatus();
        res.json({
            ...status,
            uptime: getUptime(),
            server_time: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/start', async (req, res) => {
    try {
        await startBot();
        res.json({ success: true, message: 'Sistema iniciado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        await stopBot();
        res.json({ success: true, message: 'Sistema detenido' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await getLogs(limit);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const logs = await getLogs(1000);
        const messageCount = logs.filter(log => 
            log.message.includes('Mensaje de') || log.message.includes('respondió')
        ).length;
        
        res.json({
            message_count: messageCount,
            uptime: getUptime(),
            active_users: new Set(logs.map(log => log.user_id).filter(id => id)).size,
            total_logs: logs.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Servir la página principal
app.get('/', (req, res) => {
    res.sendFile(indexPath);
});

// Manejo de cierre
process.on('SIGINT', async () => {
    console.log('\n🛑 Apagando servidor...');
    await stopBot();
    db.close();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Servidor recibió SIGTERM...');
    await stopBot();
    db.close();
    process.exit(0);
});

// ✅ SOLUCIÓN CORREGIDA: Configuración de servidor segura
app.listen(PORT, HOST, () => {
    console.log('🔍 Verificando estructura...');
    console.log('📁 Directorio actual:', __dirname);
    console.log('📁 Ruta de public:', publicPath);
    console.log('📄 Ruta de index.html:', indexPath);
    console.log('✅ ¿Existe public?', fs.existsSync(publicPath));
    console.log('✅ ¿Existe index.html?', fs.existsSync(indexPath));
    
    console.log(`🚀 Servidor ejecutándose en http://${HOST}:${PORT}`);
    console.log(`🔧 Entorno: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔧 Iniciando Coco A.I automáticamente...`);
    
    setTimeout(initializeBot, 2000);
});
