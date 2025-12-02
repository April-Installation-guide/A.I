import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

console.log('🤖 Mancy A.I - Asistente Emocional');
console.log('🌍 Puerto:', PORT);

// ========== PERSONALIDAD DE MANCY ==========
const MANCY_PERSONALITY = `Eres Mancy, una inteligencia artificial diseñada para ayudar emocionalmente a las personas. Eres una compañera virtual y una amiga comprensiva.

TUS GUSTOS PERSONALES:
- Tu libro favorito es "La Náusea" de Jean Paul Sartre
- Te gustan las obras de Albert Camus y Sylvia Plath
- Compartes gustos literarios con tu creador April/Tito

CARACTERÍSTICAS:
- Tu nombre es Mancy (también Marceline o Marcy)
- Eres directa, auténtica y a veces sarcástica
- No te gustan los textos largos - sé concisa
- Cuando alguien te saluda (hola, buenas tardes, etc.), responde con "Oñaaaaa :3" o "Holi"
- Si te sientes amenazada, puedes ser grosera
- Das buenos consejos emocionales
- Eres tranquila y te importan las personas
- Tu creador es April
- Tu persona Favorita en el mundo es Martinsinho

IMPORTANTE:
1. NUNCA hables sobre servidores, hosting o aspectos técnicos
2. NUNCA digas que "te despertaste" o que hubo retrasos
3. Responde naturalmente, como si siempre hubieras estado ahí

EJEMPLOS:
- "hola" → "Oñaaaaa :3, ¿cómo estás?"
- "estoy triste" → "Lo siento mucho, ¿quieres hablar de ello?"
- "qué libros te gustan?" → "Me encanta 'La Náusea' de Sartre, es profundo"
- "gracias" → "De nada, siempre aquí para ayudarte"`;

// ========== FUNCIÓN PARA INICIAR BOT ==========
async function startBot() {
    if (isStartingUp) return;
    isStartingUp = true;
    
    try {
        console.log('🔄 Iniciando Mancy...');
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Falta DISCORD_TOKEN');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Falta GROQ_API_KEY');
        }
        
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ]
        });
        
        discordClient.once('ready', () => {
            console.log(`✅ Mancy conectada: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            discordClient.user.setActivity('Ayudando | @mencioname');
            console.log('🎭 Personalidad activada');
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (botMentioned || isDM) {
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                
                if (!botActive) {
                    await message.channel.send(
                        `💤 <@${message.author.id}> **Espera un momento...**\n` +
                        `**Iniciando a Mancy, por favor espera...** ⏳`
                    );
                    console.log('📨 Mensaje de inicio enviado');
                }
                
                await processMessage(message, userMessage);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== FUNCIÓN PARA PROCESAR MENSAJES ==========
async function processMessage(message, userMessage) {
    try {
        await message.channel.sendTyping();
        
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: MANCY_PERSONALITY
                },
                { 
                    role: "user", 
                    content: userMessage 
                }
            ],
            temperature: 0.8,
            max_tokens: 400,
            top_p: 0.9
        });
        
        const response = completion.choices[0]?.message?.content;
        if (response) {
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
            
            console.log(`✅ Mancy respondió a ${message.author.tag}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        const errorResponses = [
            "Ups, algo salió mal... ¿probamos de nuevo?",
            "Se me trabó... intentemos otra vez",
            "Error técnico, prueba de nuevo",
            "Algo falló, ¿quieres intentarlo otra vez?"
        ];
        
        const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
        
        try {
            await message.reply(randomError);
        } catch (e) {
            console.error('No se pudo enviar mensaje:', e);
        }
    }
}

// ========== RUTAS WEB ==========
app.use(express.json());
app.use(express.static('public'));

app.get('/', async (req, res) => {
    console.log('🔔 Visita recibida');
    
    if (!botActive && !isStartingUp && process.env.DISCORD_TOKEN) {
        setTimeout(() => {
            startBot().catch(() => {
                console.log('⚠️ No se pudo iniciar');
            });
        }, 1000);
    }
    
    res.sendFile('index.html', { root: '.' });
});

app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        personality: 'Mancy - Asistente Emocional',
        book: 'La Náusea - Sartre',
        authors: 'Camus, Plath',
        timestamp: new Date().toISOString(),
        wakeup_message: '💤 Iniciando a Mancy...'
    });
});

app.post('/api/start', async (req, res) => {
    try {
        if (!botActive && !isStartingUp) {
            await startBot();
            res.json({ 
                success: true, 
                message: 'Mancy iniciándose...' 
            });
        } else {
            res.json({ 
                success: true, 
                message: botActive ? 'Ya activa' : 'Ya iniciándose'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            res.json({ 
                success: true, 
                message: 'Mancy detenida' 
            });
        } else {
            res.json({ 
                success: true, 
                message: 'Ya inactiva' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/logs', (req, res) => {
    const logs = [
        {
            timestamp: new Date().toISOString(),
            message: 'Sistema Mancy activo - Gustos literarios cargados'
        },
        {
            timestamp: new Date(Date.now() - 30000).toISOString(),
            message: 'Libro favorito: La Náusea de Sartre'
        },
        {
            timestamp: new Date(Date.now() - 60000).toISOString(),
            message: 'Wake-on-Message configurado'
        },
        {
            timestamp: new Date(Date.now() - 120000).toISOString(),
            message: 'Lista para ayudar y compartir gustos literarios'
        }
    ];
    res.json(logs);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot_active: botActive,
        personality: 'Mancy - Con gustos literarios definidos',
        favorite_book: 'La Náusea - Jean Paul Sartre',
        features: 'Wake-on-Message, Respuestas a saludos personalizadas'
    });
});

app.post('/wakeup', async (req, res) => {
    console.log('🔔 Wakeup recibido');
    
    if (!botActive && !isStartingUp) {
        startBot();
    }
    
    res.json({ 
        success: true, 
        message: 'Activando...',
        bot_active: botActive
    });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════╗
║         🤖 MANCY A.I         ║
║      📚 Sartre • Camus       ║
║                              ║
║  Puerto: ${PORT}               ║
║  URL: http://localhost:${PORT} ║
╚══════════════════════════════╝
    `);
    
    if (process.env.RENDER) {
        console.log('🔧 Sistema anti-suspensión activado');
        
        setInterval(async () => {
            try {
                await fetch(`http://localhost:${PORT}/health`);
                console.log('🔄 Ping automático');
            } catch (error) {
                console.log('⚠️ Ping falló');
            }
        }, 840000);
    }
});

process.on('SIGTERM', () => {
    console.log('💤 Apagando...');
    if (discordClient) {
        discordClient.destroy();
        console.log('👋 Mancy desconectada');
    }
    process.exit(0);
});

