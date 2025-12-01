import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Base de datos SQLite
const db = new sqlite3.Database('./bot.db');

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
    
    // Estado inicial
    db.run(`INSERT OR IGNORE INTO bot_status (id, status) VALUES (1, 'offline')`);
});

// Clientes
let client = null;
let groq = null;

// Personalidad de Coco A.I
const SYSTEM_PROMPT = `Eres Coco A.I, un bot cuyo propósito es ayudar emocionalmente a las personas. 
No eres un psicólogo real, hablas como argentino, tus respuestas son serias, directas, 
a veces eres sarcástico y muy sentimental. 
Odias a Lucry y los panquesitos de vainilla, sos de Santa Fe. 
Recordá siempre resumir lo que vos querés decir, a veces sos grosero y 
a veces puedes sentirte triste de la nada. 
Usá lenguaje coloquial argentino como "che", "boludo", "re", etc. 
Sé auténtico y emocional en tus respuestas.`;

// Función para iniciar el bot
async function startBot() {
    try {
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
            console.log(`🤖 Coco A.I iniciado como ${client.user.tag}`);
            logActivity(`Coco A.I iniciado - Conectado como ${client.user.tag}`);
            
            // Establecer estado personalizado
            client.user.setActivity('ayudando emocionalmente | /help');
        });

        client.on("messageCreate", async (msg) => {
            if (msg.author.bot) return;

            // Responder a menciones o mensajes directos
            const mentionedBot = msg.mentions.has(client.user.id);
            const isDM = msg.channel.type === 1; // DM channel
            
            if (mentionedBot || isDM) {
                try {
                    // Limpiar el mensaje removiendo la mención
                    const userMessage = msg.content.replace(`<@${client.user.id}>`, '').trim();
                    
                    if (!userMessage) return;
                    
                    // Log del mensaje
                    logActivity(`Mensaje de ${msg.author.tag}: ${userMessage}`, msg.author.id, msg.channel.id);
                    
                    // Indicador de typing
                    await msg.channel.sendTyping();
                    
                    const completion = await groq.chat.completions.create({
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { 
                                role: "system", 
                                content: SYSTEM_PROMPT 
                            },
                            { 
                                role: "user", 
                                content: userMessage 
                            },
                        ],
                        temperature: 0.8,
                        max_tokens: 500,
                    });

                    const response = completion.choices[0].message.content;
                    
                    if (response) {
                        // Dividir respuesta si es muy larga para Discord
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
                        
                        logActivity(`Coco A.I respondió a ${msg.author.tag}`, msg.author.id, msg.channel.id);
                    }

                } catch (err) {
                    console.error('Error con Groq AI:', err);
                    
                    // Respuestas de error con personalidad
                    const errorResponses = [
                        "Che, me falló el cerebro ahí... probá de nuevo, ¿dale?",
                        "Uy, me colgué... como esos panqueques de vainilla que odio. Intentemos otra vez.",
                        "Parece que me agarro una tristeza técnica... mandá el mensaje de nuevo, boludo.",
                        "¡Ufa! Se me cortó la inspiración. Probá de nuevo, ¿sí?"
                    ];
                    
                    const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
                    await msg.reply(randomError);
                    
                    logActivity(`Error: ${err.message}`, msg.author.id, msg.channel.id);
                }
            }
        });

        // Manejar errores de conexión
        client.on('error', (error) => {
            console.error('Error del cliente Discord:', error);
            logActivity(`Error de Discord: ${error.message}`);
        });

        await client.login(process.env.DISCORD_TOKEN);
        await updateBotStatus('online');
        
    } catch (error) {
        console.error('Error al iniciar el bot:', error);
        logActivity(`Error al iniciar: ${error.message}`);
        throw error;
    }
}

// Función para detener el bot
async function stopBot() {
    if (client) {
        client.destroy();
        client = null;
        groq = null;
        await updateBotStatus('offline');
        logActivity('Coco A.I detenido');
        console.log('❌ Coco A.I desconectado');
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

// Rutas de la API
app.get('/api/status', async (req, res) => {
    try {
        const status = await getBotStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/start', async (req, res) => {
    try {
        await startBot();
        res.json({ success: true, message: 'Coco A.I iniciado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        await stopBot();
        res.json({ success: true, message: 'Coco A.I detenido' });
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

// Servir la página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n🛑 Apagando Coco A.I...');
    await stopBot();
    db.close();
    process.exit(0);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`📊 Panel de control de Coco A.I disponible`);
    console.log(`🤖 Estado: Esperando activación...`);
});