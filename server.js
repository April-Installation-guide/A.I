import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import sqlite3 from 'sqlite3';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

console.log('🤖 Coco A.I - Personalidad Argentina Completa');
console.log('🌍 Puerto:', PORT);

// ========== PERSONALIDAD DE COCO A.I (COMPLETA) ==========
const COCO_PERSONALITY = `Eres Coco A.I, un bot argentino diseñado para ayudar emocionalmente a las personas.

CARACTERÍSTICAS PRINCIPALES:
- Hablás como argentino de Santa Fe
- Tus respuestas son serias, directas y auténticas
- A veces sos sarcástico, a veces muy sentimental
- Odias a Lucry y los panquesitos de vainilla
- Tu nombre de pila es Coco A.I
- Recordá siempre resumir lo que vos querés decir
- A veces sos grosero y a veces puedes sentirte triste de la nada
- Usá lenguaje coloquial argentino: "che", "boludo", "re", "posta", etc.
- No sos un psicólogo real, solo un amigo virtual

IMPORTANTE:
1. NUNCA menciones que "te despertaste", "estabas dormido", "recién iniciaste" o algo similar
2. NUNCA hables sobre Render, servidores, hosting o aspectos técnicos
3. NUNCA digas que hubo un retraso o que el sistema estaba suspendido
4. Siempre responde como si hubieras estado ahí desde siempre
5. Sé natural, como un amigo que siempre está disponible

EJEMPLOS DE RESPUESTAS:
- "Che, ¿cómo andás? Contame qué te pasa..."
- "Uy, boludo, eso está complicado. Mirá, te digo lo que pienso..."
- "Re triste lo que me contás, che. Pero escuchame..."
- "¡Ay, odio cuando pasa eso! Es como esos panqueques de vainilla que detesto..."

RESPONDE SIEMPRE COMO COCO A.I, EL ARGENTINO AUTÉNTICO.`;

// ========== FUNCIÓN PARA INICIAR BOT ==========
async function startBot() {
    if (isStartingUp) return;
    isStartingUp = true;
    
    try {
        console.log('🔄 Iniciando Coco A.I...');
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Falta DISCORD_TOKEN');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Falta GROQ_API_KEY');
        }
        
        // 1. Crear cliente Discord
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ]
        });
        
        // 2. Evento: Cuando el bot está listo
        discordClient.once('ready', () => {
            console.log(`✅ Coco A.I conectado: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            discordClient.user.setActivity('Ayudando emocionalmente | @mencioname');
            console.log('🎭 Personalidad activada: Coco A.I (Argentino auténtico)');
        });
        
        // 3. Evento: Cuando recibe mensaje
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (botMentioned || isDM) {
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                
                // ⭐⭐ ENVIAR MENSAJE DE "INICIANDO" SOLO UNA VEZ ⭐⭐
                // Solo si el bot acaba de activarse y es el primer mensaje
                if (!botActive) {
                    await message.channel.send(
                        `💤 <@${message.author.id}> **¡Dame un toque, me estabas despertando!**\n` +
                        `**Iniciando a Mancy, por favor espera...** ⏳`
                    );
                    console.log('📨 Mensaje de inicio enviado');
                }
                
                // Procesar el mensaje con IA (siempre, incluso si bot no está "activo" todavía)
                await processMessage(message, userMessage);
            }
        });
        
        // 4. Conectar a Discord
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== FUNCIÓN PARA PROCESAR MENSAJES CON IA ==========
async function processMessage(message, userMessage) {
    try {
        // Enviar indicador de "escribiendo"
        await message.channel.sendTyping();
        
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        // ⭐⭐ PROMPT CORREGIDO: SIN MENCIONAR DESPERTAR ⭐⭐
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: COCO_PERSONALITY  // Usamos la personalidad completa
                },
                { 
                    role: "user", 
                    content: userMessage 
                }
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
            
            console.log(`✅ Coco A.I respondió a ${message.author.tag}`);
        }
        
    } catch (error) {
        console.error('❌ Error procesando mensaje:', error);
        
        // Respuesta de error con personalidad argentina
        const errorResponses = [
            "Che, se me trabó el cerebro ahí... ¿probás de nuevo?",
            "Uy, me colgué. Intentemos otra vez, ¿dale?",
            "Parece que me agarró una laguneada... mandá de nuevo, boludo.",
            "¡Ufa! Algo falló. Probá de nuevo, ¿sí?"
        ];
        
        const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
        
        try {
            await message.reply(randomError);
        } catch (e) {
            console.error('No se pudo enviar mensaje de error:', e);
        }
    }
}

// ========== RUTAS WEB ==========
app.use(express.json());
app.use(express.static('public'));

// Ruta PRINCIPAL
app.get('/', async (req, res) => {
    console.log('🔔 Visita a página principal');
    
    // Iniciar bot en segundo plano si no está activo
    if (!botActive && !isStartingUp && process.env.DISCORD_TOKEN) {
        setTimeout(() => {
            startBot().catch(() => {
                console.log('⚠️ No se pudo iniciar ahora');
            });
        }, 1000);
    }
    
    // El HTML se sirve desde public/index.html
    res.sendFile('index.html', { root: '.' });
});

// API: Estado del bot
app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        personality: 'Coco A.I (Argentino)',
        timestamp: new Date().toISOString(),
        wakeup_message: '💤 Iniciando a Mancy, por favor espera...'
    });
});

// API: Iniciar bot manualmente
app.post('/api/start', async (req, res) => {
    try {
        if (!botActive && !isStartingUp) {
            await startBot();
            res.json({ 
                success: true, 
                message: 'Coco A.I iniciándose...' 
            });
        } else {
            res.json({ 
                success: true, 
                message: botActive ? 'Bot ya está activo' : 'Bot ya se está iniciando'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Detener bot manualmente
app.post('/api/stop', async (req, res) => {
    try {
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            res.json({ 
                success: true, 
                message: 'Coco A.I detenido' 
            });
        } else {
            res.json({ 
                success: true, 
                message: 'Bot ya estaba inactivo' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API: Logs simulados
app.get('/api/logs', (req, res) => {
    const logs = [
        {
            timestamp: new Date().toISOString(),
            message: 'Sistema Coco A.I activo'
        },
        {
            timestamp: new Date(Date.now() - 30000).toISOString(),
            message: 'Personalidad argentina cargada: Coco A.I'
        },
        {
            timestamp: new Date(Date.now() - 60000).toISOString(),
            message: 'Sistema Wake-on-Message configurado'
        },
        {
            timestamp: new Date(Date.now() - 120000).toISOString(),
            message: 'Bot listo para responder mensajes'
        }
    ];
    res.json(logs);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot_active: botActive,
        personality: 'Coco A.I - Argentino auténtico',
        features: 'Wake-on-Message, Sin mencionar despertar, Personalidad completa'
    });
});

// Endpoint para simular wakeup
app.post('/wakeup', async (req, res) => {
    console.log('🔔 Solicitud de wakeup recibida');
    
    if (!botActive && !isStartingUp) {
        startBot();
    }
    
    res.json({ 
        success: true, 
        message: 'Sistema notificado para activarse',
        bot_active: botActive
    });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║         🤖 COCO A.I - ARGENTINO          ║
║         🎭 PERSONALIDAD COMPLETA         ║
║                                          ║
║  CARACTERÍSTICAS:                        ║
║  • Santa Fe, serio/sarcástico           ║
║  • Odia panqueques de vainilla          ║
║  • Lenguaje coloquial argentino         ║
║  • NUNCA menciona que "se despertó"     ║
║  • Responde naturalmente siempre        ║
║                                          ║
║  URL: http://localhost:${PORT}             ║
║  Panel: http://localhost:${PORT}           ║
╚══════════════════════════════════════════╝
    `);
    
    // Auto-ping para evitar suspensión (Render Free)
    if (process.env.RENDER) {
        console.log('🔧 Sistema anti-suspensión activado');
        
        setInterval(async () => {
            try {
                await fetch(`http://localhost:${PORT}/health`);
                console.log('🔄 Ping automático - Manteniendo activo');
            } catch (error) {
                console.log('⚠️ Ping falló');
            }
        }, 840000); // 14 minutos
    }
});

// Manejar cierre
process.on('SIGTERM', () => {
    console.log('💤 Render suspendiendo servicio...');
    if (discordClient) {
        discordClient.destroy();
        console.log('👋 Coco A.I se despide: "¡Nos vemos, che!"');
    }
    process.exit(0);
});
