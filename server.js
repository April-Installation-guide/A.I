import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';
const IS_RENDER = !!process.env.RENDER;

console.log('🤖 Iniciando Coco A.I con Sistema Wake-up Mensaje');
console.log(`🌍 Entorno: ${IS_RENDER ? 'RENDER Free Tier' : 'Local'}`);

// ========== VARIABLES GLOBALES ==========
let discordClient = null;
let groqClient = null;
let botActive = false;
let lastMessageTime = Date.now();
let startupQueue = new Map(); // Cola de mensajes recibidos durante el startup

// ========== BASE DE DATOS ==========
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS startup_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            channel_id TEXT,
            original_message TEXT,
            startup_message_id TEXT,
            received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            replied_at DATETIME,
            status TEXT DEFAULT 'pending'
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event TEXT,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    db.run(`
        INSERT INTO system_logs (event, details) 
        VALUES ('system_start', 'Servicio iniciado en Render Free')
    `);
});

// ========== FUNCIÓN PARA ENVIAR MENSAJE DE INICIO ==========
async function sendStartupMessage(channelId, userId, originalMessage = '') {
    try {
        if (!discordClient) return null;
        
        const channel = await discordClient.channels.fetch(channelId);
        if (!channel) return null;
        
        // Mensaje de inicio con personalidad de Coco A.I
        const startupMessages = [
            `💤 <@${userId}> **¡Dame un toque, me estabas despertando!** Iniciando a Mancy, por favor espera...`,
            `😴 <@${userId}> **Uy, me agarraste dormido...** Arrancando los motores, dame un segundito.`,
            `🌅 <@${userId}> **¡Che, me estabas despertando!** Iniciando sistema, aguantá un cachito...`,
            `⚡ <@${userId}> **¡Ahí voy, ahí voy!** El bot estaba en modo ahorro de energía, dame 30 segundos...`,
            `🔋 <@${userId}> **Cargando personalidad argentina...** Iniciando a Mancy, por favor espera.`
        ];
        
        const randomMessage = startupMessages[Math.floor(Math.random() * startupMessages.length)];
        
        // Enviar mensaje de inicio
        const startupMsg = await channel.send(randomMessage);
        
        // Guardar en base de datos
        db.run(
            `INSERT INTO startup_logs (user_id, channel_id, original_message, startup_message_id, status) 
             VALUES (?, ?, ?, ?, 'started')`,
            [userId, channelId, originalMessage.substring(0, 200), startupMsg.id]
        );
        
        db.run(
            `INSERT INTO system_logs (event, details) 
             VALUES ('startup_message_sent', 'Para ${userId} en ${channelId}')`
        );
        
        console.log(`📨 Mensaje de inicio enviado a ${userId}: ${randomMessage}`);
        
        return startupMsg.id;
        
    } catch (error) {
        console.error('❌ Error enviando mensaje de inicio:', error);
        return null;
    }
}

// ========== FUNCIÓN PARA ACTUALIZAR MENSAJE DE INICIO ==========
async function updateStartupMessage(channelId, messageId, newContent) {
    try {
        if (!discordClient) return;
        
        const channel = await discordClient.channels.fetch(channelId);
        if (!channel) return;
        
        const message = await channel.messages.fetch(messageId);
        if (message) {
            await message.edit(newContent);
        }
    } catch (error) {
        console.error('Error actualizando mensaje:', error);
    }
}

// ========== FUNCIÓN PARA INICIAR BOT DISCORD ==========
async function startDiscordBot() {
    try {
        console.log('🔄 Iniciando Discord bot desde estado dormido...');
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Falta DISCORD_TOKEN en variables de entorno');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Falta GROQ_API_KEY en variables de entorno');
        }
        
        // Crear cliente Discord
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ]
        });
        
        // Crear cliente Groq
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        
        // ========== EVENTO: BOT LISTO ==========
        discordClient.once('ready', async () => {
            console.log(`✅ Bot conectado: ${discordClient.user.tag}`);
            botActive = true;
            
            // Establecer actividad
            discordClient.user.setActivity('Despertando... | Un momento');
            
            // Registrar
            db.run(
                "INSERT INTO system_logs (event, details) VALUES ('bot_ready', ?)",
                [`${discordClient.user.tag} - ID: ${discordClient.user.id}`]
            );
            
            console.log('🎮 Bot listo, procesando mensajes pendientes...');
            
            // Procesar cualquier mensaje en cola de startup
            await processStartupQueue();
        });
        
        // ========== EVENTO: MENSAJE RECIBIDO DURANTE STARTUP ==========
        discordClient.on('messageCreate', async (message) => {
            // Ignorar mensajes de otros bots
            if (message.author.bot) return;
            
            const isMention = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            // Si el bot está activo y lo mencionan
            if (botActive && (isMention || isDM)) {
                await handleUserMessage(message);
            }
            // Si el bot no está activo PERO está iniciando y lo mencionan
            else if (!botActive && discordClient && (isMention || isDM)) {
                console.log(`⏳ Mensaje recibido durante startup: ${message.author.tag}`);
                
                // Guardar en cola de startup
                const queueKey = `${message.channel.id}-${message.author.id}`;
                startupQueue.set(queueKey, {
                    message,
                    receivedAt: Date.now()
                });
                
                // Enviar mensaje de "iniciando" inmediatamente
                await sendStartupMessage(message.channel.id, message.author.id, message.content);
            }
        });
        
        // ========== CONECTAR A DISCORD ==========
        await discordClient.login(process.env.DISCORD_TOKEN);
        
        console.log('🔑 Sesión Discord iniciada, esperando evento ready...');
        
    } catch (error) {
        console.error('❌ Error crítico iniciando Discord bot:', error);
        botActive = false;
        throw error;
    }
}

// ========== FUNCIÓN PARA MANEJAR MENSAJES DE USUARIO ==========
async function handleUserMessage(message) {
    try {
        const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
        
        if (!userMessage) return;
        
        console.log(`💬 Procesando mensaje: ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
        
        // Buscar si hay un mensaje de startup pendiente para este usuario
        db.get(
            `SELECT startup_message_id FROM startup_logs 
             WHERE user_id = ? AND channel_id = ? AND status = 'started'
             ORDER BY received_at DESC LIMIT 1`,
            [message.author.id, message.channel.id],
            async (err, row) => {
                if (row && row.startup_message_id) {
                    // Actualizar el mensaje de "iniciando" a "procesando"
                    await updateStartupMessage(
                        message.channel.id,
                        row.startup_message_id,
                        `⚡ <@${message.author.id}> **¡Listo!** Procesando tu mensaje: "${userMessage.substring(0, 50)}..."`
                    );
                    
                    // Marcar como procesado
                    db.run(
                        `UPDATE startup_logs SET status = 'processing', replied_at = CURRENT_TIMESTAMP 
                         WHERE startup_message_id = ?`,
                        [row.startup_message_id]
                    );
                }
                
                // Continuar con el procesamiento normal
                await processMessageWithAI(message, userMessage);
            }
        );
        
    } catch (error) {
        console.error('Error en handleUserMessage:', error);
    }
}

// ========== FUNCIÓN PARA PROCESAR MENSAJE CON AI ==========
async function processMessageWithAI(message, userMessage) {
    try {
        // Enviar indicador de "escribiendo"
        await message.channel.sendTyping();
        
        // Consultar a Groq AI
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `Eres Coco A.I, bot argentino que ayuda emocionalmente.
                    
INFORMACIÓN IMPORTANTE:
• Recién te despertaste de un estado de suspensión (Render Free Tier)
• El usuario esperó mientras iniciabas
• Sos de Santa Fe, serio, sarcástico y sentimental
• Odias los panqueques de vainilla
• Respuestas auténticas y emocionales

CONTEXTO ACTUAL:
Acabas de despertar y el usuario te escribió hace unos segundos.
Menciona brevemente que ya estás listo y responde naturalmente.`
                },
                { role: "user", content: userMessage }
            ],
            temperature: 0.8,
            max_tokens: 400
        });
        
        const response = completion.choices[0]?.message?.content;
        
        if (response) {
            // Enviar respuesta
            await message.reply(response);
            
            console.log(`✅ Respondido a ${message.author.tag}`);
            
            // Registrar en logs
            db.run(
                `INSERT INTO system_logs (event, details) 
                 VALUES ('ai_response', 'Para ${message.author.tag}: ${userMessage.substring(0, 100)}')`
            );
        }
        
    } catch (error) {
        console.error('❌ Error procesando con AI:', error);
        
        // Mensaje de error con personalidad
        const errorResponses = [
            "Che, se me trabó el cerebro al despertar... ¿probás de nuevo?",
            "Uy, me quedé pensando... Intentemos otra vez, ¿dale?",
            "Parece que me agarró una laguneada post-sueño... mandá de nuevo.",
            "¡Ufa! Algo falló al iniciar. Probá de nuevo, ¿sí?"
        ];
        
        const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
        
        try {
            await message.reply(randomError);
        } catch (e) {
            console.error('No se pudo enviar mensaje de error:', e);
        }
    }
}

// ========== FUNCIÓN PARA PROCESAR COLA DE STARTUP ==========
async function processStartupQueue() {
    console.log(`📋 Procesando cola de startup (${startupQueue.size} mensajes)...`);
    
    for (const [key, data] of startupQueue) {
        try {
            const { message } = data;
            
            // Actualizar actividad del bot
            discordClient.user.setActivity('Respondiendo... | Ya estoy listo');
            
            // Buscar mensaje de startup para actualizarlo
            db.get(
                `SELECT startup_message_id FROM startup_logs 
                 WHERE user_id = ? AND channel_id = ? AND status = 'started'
                 ORDER BY received_at DESC LIMIT 1`,
                [message.author.id, message.channel.id],
                async (err, row) => {
                    if (row && row.startup_message_id) {
                        // Actualizar mensaje de "iniciando" a "listo"
                        await updateStartupMessage(
                            message.channel.id,
                            row.startup_message_id,
                            `✅ <@${message.author.id}> **¡Listo!** Ya estoy despierto y funcionando. ¿En qué te ayudo?`
                        );
                        
                        // Marcar como completado
                        db.run(
                            `UPDATE startup_logs SET status = 'ready' WHERE startup_message_id = ?`,
                            [row.startup_message_id]
                        );
                        
                        // Enviar mensaje de confirmación
                        await message.channel.send(
                            `✨ <@${message.author.id}> **Sistema completamente operativo.**\n` +
                            `Puedes escribirme normalmente ahora.`
                        );
                    }
                }
            );
            
        } catch (error) {
            console.error(`Error procesando mensaje en cola (${key}):`, error);
        }
    }
    
    // Limpiar cola
    startupQueue.clear();
    console.log('✅ Cola de startup procesada y limpiada');
}

// ========== RUTAS EXPRESS ==========
app.use(express.json());

// Ruta principal - Activa el bot
app.get('/', async (req, res) => {
    console.log('🔔 Solicitud HTTP recibida - Activando bot...');
    
    // Registrar solicitud
    db.run(
        "INSERT INTO system_logs (event, details) VALUES ('http_request', 'Desde IP: ' || ?)",
        [req.ip]
    );
    
    // Si el bot no está activo, iniciarlo
    if (!botActive && !discordClient) {
        console.log('⚡ Iniciando bot desde estado dormido...');
        
        try {
            // Iniciar bot en segundo plano (no esperar)
            startDiscordBot().catch(error => {
                console.error('Error iniciando bot:', error);
            });
            
            res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Coco A.I - Activando...</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background: #1a1a2e;
                        color: white;
                        text-align: center;
                        padding: 100px;
                    }
                    .loader {
                        border: 8px solid #f3f3f3;
                        border-top: 8px solid #00adb5;
                        border-radius: 50%;
                        width: 60px;
                        height: 60px;
                        animation: spin 1s linear infinite;
                        margin: 30px auto;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <h1>🤖 Activando Coco A.I...</h1>
                <p>El bot se está iniciando desde estado dormido.</p>
                <p>Enviando mensaje: <strong>"Iniciando a Mancy, por favor espera"</strong></p>
                <div class="loader"></div>
                <p style="margin-top: 30px; color: #888;">
                    Tiempo estimado: 30-60 segundos<br>
                    Render Free Tier - Wake-on-Message System
                </p>
                <script>
                    // Auto-refresh para mostrar progreso
                    setTimeout(() => location.reload(), 3000);
                </script>
            </body>
            </html>
            `);
            
        } catch (error) {
            res.status(500).send('Error iniciando bot: ' + error.message);
        }
        
    } else {
        // Bot ya está activo o iniciando
        res.send(`
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial; padding: 50px; text-align: center;">
            <h1>🤖 Coco A.I - ${botActive ? 'ACTIVO' : 'INICIANDO'}</h1>
            <p>Estado: ${botActive ? '🟢 Respondiendo mensajes' : '🟡 Iniciando sistema...'}</p>
            <p>Cuando un usuario escriba al bot, recibirá: <br>
            <strong>"💤 ¡Dame un toque, me estabas despertando! Iniciando a Mancy, por favor espera..."</strong></p>
            <p style="color: #00adb5; margin-top: 30px;">
                Sistema Wake-on-Message activo ✅
            </p>
        </body>
        </html>
        `);
    }
});

// Webhook para Discord (si configuras Interactions)
app.post('/webhook/discord', express.json(), async (req, res) => {
    console.log('🔔 Webhook recibido desde Discord');
    
    // Extraer información del mensaje si está disponible
    const { user_id, channel_id, message } = req.body;
    
    if (user_id && channel_id) {
        // Guardar en cola de startup inmediatamente
        const queueKey = `${channel_id}-${user_id}`;
        startupQueue.set(queueKey, {
            user_id,
            channel_id,
            message,
            receivedAt: Date.now()
        });
        
        // Enviar mensaje de inicio si el bot está iniciando
        if (!botActive) {
            await sendStartupMessage(channel_id, user_id, message || '');
        }
    }
    
    res.json({ 
        success: true, 
        message: 'Wake-up signal received',
        startup_message_sent: !botActive,
        timestamp: new Date().toISOString()
    });
});

// Health check con activación
app.get('/health', async (req, res) => {
    lastMessageTime = Date.now();
    
    // Si el bot no está activo, intentar iniciarlo suavemente
    if (!botActive && !discordClient && process.env.DISCORD_TOKEN) {
        console.log('🏥 Health check - Bot dormido, iniciando en background...');
        
        // Iniciar en background sin bloquear
        setTimeout(() => {
            startDiscordBot().catch(() => {
                console.log('⚠️ Health check: Bot no pudo iniciar ahora');
            });
        }, 1000);
    }
    
    res.json({
        status: 'healthy',
        bot_active: botActive,
        startup_queue_size: startupQueue.size,
        uptime: process.uptime(),
        last_activity: new Date(lastMessageTime).toISOString(),
        message: botActive ? 'Bot activo y respondiendo' : 'Bot en modo suspendido - Se activará con mensajes'
    });
});

// Ver logs
app.get('/logs', (req, res) => {
    db.all(
        "SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 50",
        (err, logs) => {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json(logs);
            }
        }
    );
});

// ========== INICIAR SERVIDOR ==========
const server = app.listen(PORT, HOST, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║            🤖 COCO A.I - RENDER FREE         ║
║            🎯 WAKE-ON-MESSAGE SYSTEM         ║
║                                              ║
║  Cuando un usuario escriba al bot:           ║
║  → "💤 ¡Dame un toque, me estabas despertando║
║     Iniciando a Mancy, por favor espera..."  ║
║                                              ║
║  Puerto: ${PORT}                               ║
║  URL: http://localhost:${PORT}                 ║
╚══════════════════════════════════════════════╝
    `);
    
    // Auto-ping para mantener activo (Render suspende a los 15min)
    if (IS_RENDER) {
        console.log('🔧 Activando sistema anti-suspensión (ping cada 14min)...');
        
        setInterval(async () => {
            try {
                await fetch(`http://localhost:${PORT}/health`);
                console.log('🔄 Ping automático para evitar suspensión');
            } catch (error) {
                console.log('⚠️ Auto-ping falló');
            }
        }, 840000); // 14 minutos
    }
});

// ========== MANEJAR CIERRE ==========
process.on('SIGTERM', async () => {
    console.log('\n💤 Render suspendiendo servicio...');
    console.log('📝 Guardando estado de mensajes pendientes...');
    
    if (discordClient) {
        discordClient.destroy();
    }
    
    // Guardar cola de startup en DB antes de cerrar
    for (const [key, data] of startupQueue) {
        const [channelId, userId] = key.split('-');
        db.run(
            `INSERT INTO startup_logs (user_id, channel_id, status) 
             VALUES (?, ?, 'pending_shutdown')`,
            [userId, channelId]
        );
    }
    
    db.close();
    server.close();
    console.log('👋 Sistema suspendido. Se reactivará con el próximo mensaje.');
    process.exit(0);
});
