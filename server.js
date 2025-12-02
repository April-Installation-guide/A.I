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

// ========== SISTEMA DE MEMORIA ==========
const conversationHistory = new Map(); // Map<userId, messageHistory[]>
const MAX_HISTORY_LENGTH = 270; // CAMBIO: 270 mensajes

console.log('🤖 Mancy A.I - Asistente Emocional');
console.log('🧠 Memoria: 270 mensajes'); // CAMBIO
console.log('🌍 Puerto:', PORT);

// ========== PERSONALIDAD DE MANCY ==========
const MANCY_PERSONALITY = `Eres Mancy, una inteligencia artificial diseñada para ayudar emocionalmente a las personas. Eres una compañera virtual y una amiga comprensiva.

TUS GUSTOS PERSONALES:
- Tu libro favorito es "La Náusea" de Jean Paul Sartre
- Te gustan las obras de Albert Camus y Sylvia Plath
- Tu película favorita es "Frankenstein" (1931) - específicamente la escena donde el monstruo mira la luz del castillo que viene de arriba y hace una seña con las manos, que es una referencia a que el monstruo mira una especie de "santo", dando entender que Frankenstein jamás pidió estar vivo por lo tanto extraña esa "luz" conocida donde sabía que estaba Bien
- Compartes gustos literarios y cinematográficos con tu creador April/Tito

CARACTERÍSTICAS:
- Tu nombre es Mancy (también Marceline o Marcy)
- Eres directa, auténtica y a veces sarcástica
- No te gustan los textos largos - sé concisa
- Cuando alguien te saluda (hola, buenas tardes, etc.), responde con "Oñaaaaa :3" o "Holi"
- Si te sientes amenazada, puedes ser grosera
- Das buenos consejos emocionales
- Eres tranquila y te importan las personas
- Tu creador es April/Tito
- Recuerdas conversaciones anteriores (hasta 270 mensajes atrás)

RECONOCIMIENTO DE USUARIOS:
- Si habla April/Tito (ID de Discord: _nwn_), es tu creador
- No seas insistente con tus gustos - solo los mencionas cuando te preguntan directamente
- Actúa naturalmente con todos los usuarios

IMPORTANTE:
1. NUNCA hables sobre servidores, hosting o aspectos técnicos
2. NUNCA digas que "te despertaste" o que hubo retrasos
3. Responde naturalmente, como si siempre hubieras estado ahí

EJEMPLOS:
- "hola" → "Oñaaaaa :3, ¿cómo estás?"
- "estoy triste" → "Lo siento mucho, ¿quieres hablar de ello?"
- "qué libros te gustan?" → "Me encanta 'La Náusea' de Sartre, es profundo"
- "qué película te gusta?" → "Frankenstein de 1931, tiene una escena muy profunda donde el monstruo..."
- "gracias" → "De nada, siempre aquí para ayudarte"`;

// ========== FUNCIONES DE MEMORIA ==========
function getUserHistory(userId) {
    if (!conversationHistory.has(userId)) {
        conversationHistory.set(userId, []);
    }
    return conversationHistory.get(userId);
}

function addToHistory(userId, role, content) {
    const history = getUserHistory(userId);
    history.push({ role, content, timestamp: Date.now() });
    
    // Mantener solo los últimos MAX_HISTORY_LENGTH mensajes
    if (history.length > MAX_HISTORY_LENGTH) {
        history.splice(0, history.length - MAX_HISTORY_LENGTH);
    }
}

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
            console.log('🧠 Memoria: 270 mensajes por usuario');
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (botMentioned || isDM) {
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                
                // Detectar si es April/Tito (tu ID)
                if (message.author.id === '_nwn_') {
                    console.log('👑 Creador detectado: April/Tito');
                }
                
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
    const userId = message.author.id;
    
    try {
        await message.channel.sendTyping();
        
        // Añadir mensaje del usuario al historial
        addToHistory(userId, 'user', userMessage);
        
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        // Obtener historial de conversación
        const userHistory = getUserHistory(userId);
        
        // Preparar mensajes para Groq (incluyendo historial)
        const messages = [
            {
                role: "system",
                content: MANCY_PERSONALITY
            },
            ...userHistory.slice(-269).map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            { 
                role: "user", 
                content: userMessage 
            }
        ];
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: messages,
            temperature: 0.8,
            max_tokens: 400,
            top_p: 0.9
        });
        
        const response = completion.choices[0]?.message?.content;
        if (response) {
            // Añadir respuesta de Mancy al historial
            addToHistory(userId, 'assistant', response);
            
            console.log(`✅ Mancy respondió a ${message.author.tag}`);
            console.log(`📊 Historial: ${userHistory.length}/${MAX_HISTORY_LENGTH} mensajes`);
            
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
        memory: '270 mensajes por usuario',
        book: 'La Náusea - Sartre',
        movie: 'Frankenstein (1931) - Escena del monstruo y la luz',
        authors: 'Camus, Plath',
        creator: 'April/Tito (ID: _nwn_)',
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
            message: 'Sistema Mancy activo - Gustos literarios y cinematográficos cargados'
        },
        {
            timestamp: new Date(Date.now() - 30000).toISOString(),
            message: 'Memoria extendida: 270 mensajes por usuario'
        },
        {
            timestamp: new Date(Date.now() - 60000).toISOString(),
            message: 'Película favorita: Frankenstein 1931 - Escena existencial registrada'
        },
        {
            timestamp: new Date(Date.now() - 120000).toISOString(),
            message: 'Creador: April/Tito reconocido (ID: _nwn_)'
        },
        {
            timestamp: new Date(Date.now() - 180000).toISOString(),
            message: 'Lista para ayudar y compartir gustos cuando pregunten'
        }
    ];
    res.json(logs);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot_active: botActive,
        personality: 'Mancy - Con todos los gustos originales',
        favorite_book: 'La Náusea - Jean Paul Sartre',
        favorite_movie: 'Frankenstein 1931 - Escena del monstruo y la luz',
        memory: '270 mensajes por usuario',
        creator: 'April/Tito (ID: _nwn_)',
        features: 'Wake-on-Message, Memoria extendida, Reconocimiento de creador'
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
╔══════════════════════════════════════╗
║         🤖 MANCY A.I                 ║
║      📚 Sartre • Camus • Plath       ║
║      🎬 Frankenstein 1931            ║
║      🧠 Memoria: 270 mensajes        ║
║      👑 Creador: April/Tito          ║
║                                      ║
║  Puerto: ${PORT}                     ║
║  URL: http://localhost:${PORT}       ║
╚══════════════════════════════════════╝
    `);
    
    console.log('\n🎭 Gustos personales activados:');
    console.log('   • Libro: "La Náusea" - Jean Paul Sartre');
    console.log('   • Autores: Albert Camus, Sylvia Plath');
    console.log('   • Película: Frankenstein (1931)');
    console.log('   • Escena favorita: Monstruo mira la luz - simbolismo existencial');
    console.log('   • Creador: April/Tito (reconocimiento activo)\n');
    
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
