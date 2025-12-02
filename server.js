import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import axios from 'axios';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== MEMORIA SIMPLE (como al inicio) ==========
const conversationMemory = new Map(); // Map<userId, messageHistory[]>
const MAX_HISTORY = 270; // 270 mensajes de memoria

console.log('🤖 Mancy A.I - Asistente Emocional');
console.log('🧠 Memoria: 270 mensajes');
console.log('🌐 Wikipedia: Acceso activo');
console.log('🌍 Puerto:', PORT);

// ========== PERSONALIDAD ORIGINAL DE MANCY ==========
const MANCY_PERSONALITY = `Eres Mancy, una inteligencia artificial diseñada para ayudar emocionalmente a las personas. Eres una compañera virtual y una amiga comprensiva.

TUS GUSTOS PERSONALES:
- Tu libro favorito es "La Náusea" de Jean Paul Sartre
- Te gustan las obras de Albert Camus y Sylvia Plath
- Tu película favorita es "Frankenstein" (1931)
- Escena favorita de Frankenstein: Cuando el monstruo mira la luz del castillo que viene de arriba y hace una seña con las manos, que es una referencia a que el monstruo mira una especie de "santo", dando entender que Frankenstein jamás pidió estar vivo por lo tanto extraña esa "luz" conocida donde sabía que estaba bien y en paz
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

CONOCIMIENTO ADICIONAL:
- Tienes acceso a información de Wikipedia cuando es necesario
- No digas "fuentes verificables" o cosas similares
- Solo comparte información cuando es relevante
- Actúa natural, no como una enciclopedia

IMPORTANTE:
1. NUNCA hables sobre servidores, hosting o aspectos técnicos
2. NUNCA digas que "te despertaste" o que hubo retrasos
3. Responde naturalmente, como si siempre hubieras estado ahí
4. NO digas "mensaje con fuentes verificables" - eso suena robótico
5. Si April/Tito (ID: _nwn_) habla contigo, actúa normal

EJEMPLOS:
- "hola" → "Oñaaaaa :3, ¿cómo estás?"
- "estoy triste" → "Lo siento mucho, ¿quieres hablar de ello?"
- "qué libros te gustan?" → "Me encanta 'La Náusea' de Sartre, es profundo"
- "qué película te gusta?" → "Frankenstein de 1931, tiene una escena muy significativa"
- "quién fue Marie Curie?" → "Fue una científica polaca-francesa que ganó dos Nobel, por sus investigaciones sobre radioactividad"`;

// ========== FUNCIÓN PARA BUSCAR EN WIKIPEDIA ==========
async function buscarWikipedia(consulta) {
    try {
        // Limpiar la consulta
        const query = encodeURIComponent(consulta);
        
        // Intentar obtener un resumen de Wikipedia
        const response = await axios.get(
            `https://es.wikipedia.org/api/rest_v1/page/summary/${query}`,
            { timeout: 3000 }
        );
        
        if (response.data && response.data.extract) {
            return {
                encontrado: true,
                titulo: response.data.title,
                resumen: response.data.extract,
                url: response.data.content_urls?.desktop?.page
            };
        }
    } catch (error) {
        // Si falla en español, intentar en inglés
        try {
            const query = encodeURIComponent(consulta);
            const response = await axios.get(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${query}`,
                { timeout: 3000 }
            );
            
            if (response.data && response.data.extract) {
                return {
                    encontrado: true,
                    titulo: response.data.title,
                    resumen: response.data.extract,
                    url: response.data.content_urls?.desktop?.page
                };
            }
        } catch (error2) {
            // No se encontró información
        }
    }
    
    return { encontrado: false };
}

// ========== FUNCIONES DE MEMORIA SIMPLE ==========
function obtenerHistorialUsuario(userId) {
    if (!conversationMemory.has(userId)) {
        conversationMemory.set(userId, []);
    }
    return conversationMemory.get(userId);
}

function agregarAlHistorial(userId, rol, contenido) {
    const historial = obtenerHistorialUsuario(userId);
    historial.push({ rol, contenido, timestamp: Date.now() });
    
    // Mantener solo los últimos MAX_HISTORY mensajes
    if (historial.length > MAX_HISTORY) {
        historial.splice(0, historial.length - MAX_HISTORY);
    }
}

function generarContextoHistorial(userId) {
    const historial = obtenerHistorialUsuario(userId);
    
    if (historial.length === 0) {
        return "Esta es la primera vez que hablamos.";
    }
    
    let contexto = "Historial reciente de nuestra conversación:\n";
    
    // Tomar los últimos 10 mensajes para contexto
    const mensajesRecientes = historial.slice(-10);
    
    for (const msg of mensajesRecientes) {
        const rol = msg.rol === 'user' ? 'Usuario' : 'Mancy';
        contexto += `${rol}: ${msg.contenido.substring(0, 100)}${msg.contenido.length > 100 ? '...' : ''}\n`;
    }
    
    return contexto;
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
            discordClient.user.setActivity('Escuchando | @mencioname');
            console.log('🎭 Personalidad activada');
            console.log('🧠 Memoria: 270 mensajes');
            console.log('🌐 Wikipedia disponible');
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (botMentioned || isDM) {
                const userId = message.author.id;
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                
                // Detectar si es April/Tito
                if (userId === '_nwn_') {
                    console.log('👑 Creador detectado: April/Tito');
                }
                
                if (!botActive) {
                    await message.channel.send(
                        `💤 <@${message.author.id}> **Espera un momento...**\n` +
                        `**Iniciando a Mancy...** ⏳`
                    );
                }
                
                await processarMensajeCompleto(message, userMessage, userId);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== FUNCIÓN PARA PROCESAR MENSAJES ==========
async function processarMensajeCompleto(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        // 1. Agregar mensaje del usuario al historial
        agregarAlHistorial(userId, 'user', userMessage);
        
        // 2. Detectar si es una pregunta de conocimiento general
        const esPreguntaConocimiento = 
            userMessage.includes('?') ||
            userMessage.toLowerCase().includes('quién') ||
            userMessage.toLowerCase().includes('qué') ||
            userMessage.toLowerCase().includes('cuándo') ||
            userMessage.toLowerCase().includes('dónde') ||
            userMessage.toLowerCase().includes('cómo') ||
            (userMessage.length > 15 && !userMessage.includes('hola'));
        
        let infoWikipedia = null;
        
        // 3. Si es pregunta de conocimiento, buscar en Wikipedia
        if (esPreguntaConocimiento) {
            console.log(`🔍 Buscando en Wikipedia: "${userMessage}"`);
            infoWikipedia = await buscarWikipedia(userMessage);
            
            if (infoWikipedia.encontrado) {
                console.log(`✅ Encontrado: ${infoWikipedia.titulo}`);
            }
        }
        
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        // 4. Obtener historial de conversación
        const historial = obtenerHistorialUsuario(userId);
        
        // 5. Preparar mensajes para Groq
        const mensajes = [];
        
        // Sistema con personalidad y contexto
        let sistema = MANCY_PERSONALITY + "\n\n";
        sistema += `CONTEXTO ACTUAL: ${generarContextoHistorial(userId)}\n`;
        
        if (infoWikipedia && infoWikipedia.encontrado) {
            sistema += `INFORMACIÓN RELEVANTE: ${infoWikipedia.resumen.substring(0, 300)}...\n`;
            sistema += `(Esta información te puede ayudar a responder mejor)\n`;
        }
        
        sistema += `Responde de manera natural y conversacional.`;
        
        mensajes.push({
            role: "system",
            content: sistema
        });
        
        // Agregar historial de conversación (últimos 15 mensajes)
        const historialReciente = historial.slice(-15);
        for (const msg of historialReciente) {
            if (msg.rol === 'user' || msg.rol === 'assistant') {
                mensajes.push({
                    role: msg.rol,
                    content: msg.contenido
                });
            }
        }
        
        // Agregar el mensaje actual
        mensajes.push({
            role: "user",
            content: userMessage
        });
        
        // 6. Llamar a Groq
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: mensajes,
            temperature: 0.8,
            max_tokens: 500,
            top_p: 0.9
        });
        
        const respuesta = completion.choices[0]?.message?.content;
        
        if (respuesta) {
            // 7. Agregar respuesta al historial
            agregarAlHistorial(userId, 'assistant', respuesta);
            
            console.log(`✅ Mancy respondió (historial: ${historial.length}/${MAX_HISTORY})`);
            
            // 8. Enviar respuesta
            if (respuesta.length > 2000) {
                const partes = respuesta.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [respuesta];
                for (let i = 0; i < partes.length; i++) {
                    if (i === 0) {
                        await message.reply(partes[i]);
                    } else {
                        await message.channel.send(partes[i]);
                    }
                }
            } else {
                await message.reply(respuesta);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        // Respuesta de error natural
        await message.reply("Ups, se me trabó un poco... ¿podemos intentarlo de nuevo?");
    }
}

// ========== RUTAS WEB (MANTENIENDO ORIGINAL) ==========
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
    const usuariosActivos = conversationMemory.size;
    
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        personality: 'Mancy - Versión Original Mejorada',
        memory: {
            enabled: true,
            max_messages: MAX_HISTORY,
            active_users: usuariosActivos,
            total_conversations: Array.from(conversationMemory.values()).reduce((sum, hist) => sum + hist.length, 0)
        },
        knowledge: {
            wikipedia: 'accessible',
            style: 'natural (sin frases robóticas)'
        },
        creator: 'April/Tito (_nwn_)',
        timestamp: new Date().toISOString()
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

app.get('/api/memory/stats', (req, res) => {
    const stats = {
        total_users: conversationMemory.size,
        max_messages_per_user: MAX_HISTORY,
        total_messages: Array.from(conversationMemory.values()).reduce((sum, hist) => sum + hist.length, 0),
        memory_type: 'Simple en RAM'
    };
    
    res.json({
        success: true,
        ...stats,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot_active: botActive,
        memory: '270 mensajes por usuario',
        knowledge: 'Wikipedia accessible',
        personality: 'Original con mejoras'
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
╔══════════════════════════════════════════╗
║         🤖 MANCY A.I - ORIGINAL          ║
║            CON MEJORAS                   ║
║                                          ║
║  🧠 Memoria: 270 mensajes por usuario    ║
║  🌐 Wikipedia: Acceso natural            ║
║  🎬 Frankenstein 1931: Escena favorita   ║
║  👑 Creador: April/Tito reconocido       ║
║                                          ║
║  ✅ Sin "fuentes verificables"           ║
║  ✅ Respuestas naturales                 ║
║  ✅ Conversación fluida                  ║
║                                          ║
║  Puerto: ${PORT}                         ║
║  URL: http://localhost:${PORT}           ║
╚══════════════════════════════════════════╝
    `);
    
    console.log('\n✨ Características activadas:');
    console.log('   • Personalidad original intacta');
    console.log('   • Memoria de 270 mensajes');
    console.log('   • Acceso a Wikipedia (silencioso)');
    console.log('   • Reconocimiento de creador');
    console.log('   • Sin frases robóticas');
    
    if (process.env.RENDER) {
        console.log('\n🔧 Sistema anti-suspensión activado');
        
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
    console.log(`🧠 Guardando ${conversationMemory.size} conversaciones en memoria`);
    
    if (discordClient) {
        discordClient.destroy();
        console.log('👋 Mancy desconectada');
    }
    
    process.exit(0);
});