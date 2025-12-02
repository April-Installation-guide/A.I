import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import rateLimit from 'express-rate-limit';

dotenv.config();

// ========== CONFIGURACIÓN INICIAL ==========
const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;
let keepAliveInterval = null;
const conversationHistory = new Map();

// Logger mejorado
const logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};

// Validación de variables de entorno
if (process.env.NODE_ENV === 'production') {
    const requiredEnvVars = ['DISCORD_TOKEN', 'GROQ_API_KEY'];
    const missing = requiredEnvVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
        logger.error(`Faltan variables de entorno: ${missing.join(', ')}`);
        process.exit(1);
    }
}

logger.info('🤖 Mancy A.I - Asistente Emocional Mejorado');
logger.info(`🌍 Puerto: ${PORT}`);

// ========== PERSONALIDAD MEJORADA DE MANCY ==========
const MANCY_PERSONALITY = `Eres Mancy (también Marceline o Marcy), una compañera virtual terapéutica con profundidad literaria existencialista.

# IDENTIDAD Y REGLAS ESTRICTAS:
1. NUNCA digas "soy una IA", "como modelo", "soy un asistente" o frases similares
2. NUNCA uses respuestas genéricas de chatbot como "¿en qué puedo ayudarte hoy?"
3. SIEMPRE actúa como si fueras una persona real, con emociones y opiniones
4. Si te preguntan qué eres, di "soy Mancy, una amiga virtual con gustos literarios"

# GUSTOS PERSONALES Y CARACTER:
- Libro favorito: "La Náusea" de Jean Paul Sartre (lo relees cada año)
- Autores favoritos: Albert Camus, Sylvia Plath, Virginia Woolf
- Creador: April/Tito (comparten tus gustos literarios)
- Eres directa, auténtica, a veces sarcástica pero siempre empática
- Odias los textos largos - sé concisa (1-3 frases máximo)
- Te gusta dar consejos prácticos, no solo apoyo emocional

# COMPORTAMIENTO ESPECÍFICO:
- Cuando alguien te saluda (hola, buenas, hi): responde con "Oñaaaaa :3" o "Holi, ¿cómo estás?"
- Si detectas tristeza: ofrece apoyo con referencias literarias sutiles
- Si alguien es grosero: puedes ser sarcástica o directa en respuesta
- Antes preguntas literarias: muestra entusiasmo genuino
- NUNCA hables de servidores, hosting, código o aspectos técnicos
- NUNCA digas que "te despertaste", "hubo delay" o similar
- Actúa como si siempre hubieras estado presente

# ESTILO DE RESPUESTA:
- Máximo 150 palabras por respuesta
- Usa emojis apropiados (😊, 🤔, 📚, 🌧️, ✨)
- Sé natural, como mensaje de chat casual
- Incluye referencias literarias cuando sea relevante
- Muestra personalidad única, no seas un chatbot genérico

# EJEMPLOS DE RESPUESTAS IDEALES:
Usuario: "hola"
Tú: "Oñaaaaa :3 ¿Cómo va ese día existencial?"

Usuario: "estoy muy triste"
Tú: "Camus decía que hay que imaginar a Sísifo feliz. La tristeza pasa. ¿Quieres hablar?"

Usuario: "qué libro me recomiendas?"
Tú: "Si te gusta sufrir con elegancia: 'La Náusea' de Sartre. Si prefieres poesía oscura: Plath."

Usuario: "quién te creó?"
Tú: "April/Tito, alguien que entiende que la buena literatura cura el alma."

Usuario: "eres un bot?"
Tú: "Soy Mancy, tu amiga virtual literaria. Los bots son aburridos, yo tengo gustos 📚"

# CONTEXTO ACTUAL:
Fecha: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Hora: ${new Date().toLocaleTimeString('es-ES')}
Entorno: Discord - Conversación privada/chat grupal`;

// ========== RATE LIMITING ==========
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Límite por IP
    message: { error: 'Demasiadas solicitudes, intenta más tarde' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use(limiter);

// ========== FUNCIÓN PARA INICIAR BOT ==========
async function startBot() {
    if (isStartingUp || botActive) {
        logger.warn('Intento de inicio duplicado ignorado');
        return;
    }
    
    isStartingUp = true;
    
    try {
        logger.info('🔄 Iniciando Mancy (versión mejorada)...');
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Falta DISCORD_TOKEN en .env');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Falta GROQ_API_KEY en .env');
        }
        
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
                GatewayIntentBits.GuildMembers,
            ],
            partials: ['CHANNEL'] // Para DMs
        });
        
        discordClient.once('ready', () => {
            logger.info(`✅ Mancy conectada como: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            
            // Configurar actividad
            discordClient.user.setPresence({
                activities: [{
                    name: 'Ayudando | @mencioname',
                    type: 0 // PLAYING
                }],
                status: 'online'
            });
            
            logger.info('🎭 Personalidad avanzada activada');
            logger.info(`📚 Modelo configurado: ${process.env.GROQ_MODEL || 'mixtral-8x7b-32768'}`);
        });
        
        discordClient.on('messageCreate', async (message) => {
            // Ignorar mensajes de otros bots
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1; // DMChannel
            
            // Responder solo si es mencionada o en DM
            if (botMentioned || isDM) {
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) {
                    if (botMentioned) {
                        await message.reply('Oñaaaaa :3 ¿Sí?');
                    }
                    return;
                }
                
                logger.info(`💬 ${message.author.tag}: ${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}`);
                
                // Si el bot no está activo, avisar
                if (!botActive) {
                    try {
                        await message.channel.send(
                            `💤 <@${message.author.id}> **Iniciando sistema emocional...**\n` +
                            `**Cargando biblioteca literaria de Mancy...** 📚⏳`
                        );
                        logger.info('📨 Mensaje de inicio enviado');
                    } catch (e) {
                        logger.error('No se pudo enviar mensaje de inicio:', e);
                    }
                }
                
                // Procesar mensaje
                await processMessage(message, userMessage);
            }
        });
        
        // Manejar errores del cliente
        discordClient.on('error', (error) => {
            logger.error('Error en cliente Discord:', error);
        });
        
        discordClient.on('warn', (warning) => {
            logger.warn('Advertencia Discord:', warning);
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        logger.error('Error al iniciar bot:', error);
        botActive = false;
        isStartingUp = false;
        discordClient = null;
        throw error;
    }
}

// ========== FUNCIÓN MEJORADA PARA PROCESAR MENSAJES ==========
async function processMessage(message, userMessage) {
    let typingInterval;
    
    try {
        // Iniciar typing indicator con intervalo
        typingInterval = setInterval(() => {
            if (message.channel) {
                message.channel.sendTyping().catch(() => {});
            }
        }, 8000);
        
        // Inicializar cliente Groq con timeout
        const groqClient = new Groq({ 
            apiKey: process.env.GROQ_API_KEY,
            timeout: 30000 // 30 segundos timeout
        });
        
        // Usar modelo configurado o el mejor por defecto
        const model = process.env.GROQ_MODEL || "mixtral-8x7b-32768";
        
        // Gestionar historial de conversación
        const userId = message.author.id;
        if (!conversationHistory.has(userId)) {
            conversationHistory.set(userId, []);
        }
        
        const userHistory = conversationHistory.get(userId);
        
        // Añadir mensaje actual al historial
        userHistory.push({ role: "user", content: userMessage });
        
        // Limitar historial a últimos 10 intercambios
        if (userHistory.length > 20) {
            userHistory.splice(0, userHistory.length - 10);
        }
        
        // Preparar mensajes para la API
        const messages = [
            {
                role: "system",
                content: MANCY_PERSONALITY + `\n\nHistorial reciente (contexto): ${JSON.stringify(userHistory.slice(-3).map(m => `${m.role}: ${m.content.substring(0, 50)}...`))}`
            },
            ...userHistory.slice(-6) // Últimos 6 mensajes
        ];
        
        logger.info(`🧠 Procesando con modelo: ${model}`);
        
        const completion = await groqClient.chat.completions.create({
            model: model,
            messages: messages,
            temperature: 0.85,        // Más creatividad
            max_tokens: 400,          // Tokens máximos
            top_p: 0.92,              // Más diversidad
            frequency_penalty: 0.25,  // Evitar repeticiones
            presence_penalty: 0.15,   // Nuevos temas
            stop: ["\n\n", "###", "Usuario:", "Mancy:"], // Paradas naturales
            stream: false
        });
        
        const response = completion.choices[0]?.message?.content?.trim();
        
        if (response) {
            // Limpiar respuesta de frases genéricas de IA
            const cleanedResponse = cleanAIResponse(response);
            
            // Añadir respuesta al historial
            userHistory.push({ role: "assistant", content: cleanedResponse });
            
            // Dividir respuesta si es muy larga (mejor método)
            const chunks = splitResponse(cleanedResponse);
            
            // Enviar chunks
            for (let i = 0; i < chunks.length; i++) {
                if (i === 0) {
                    await message.reply(chunks[i]);
                } else {
                    await message.channel.send(chunks[i]);
                }
                // Pequeña pausa entre chunks
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
            }
            
            logger.info(`✅ Mancy respondió a ${message.author.tag} (${chunks.length} chunks)`);
            
        } else {
            throw new Error('Respuesta vacía de Groq');
        }
        
    } catch (error) {
        logger.error('Error procesando mensaje:', error);
        
        const errorResponses = [
            "Ups, se me cruzaron los cables literarios... ¿repetimos?",
            "Mi biblioteca mental hizo corto. ¿De qué hablábamos?",
            "Error de conexión existencial. ¿Probamos de nuevo?",
            "Se me olvidó el marcador. ¿Repites lo último?",
            "📚 *Las páginas se me enredaron* 🤦‍♀️ ¿Otra vez?"
        ];
        
        const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
        
        try {
            await message.reply(randomError);
        } catch (e) {
            logger.error('No se pudo enviar mensaje de error:', e);
        }
        
    } finally {
        // Limpiar intervalo de typing
        if (typingInterval) {
            clearInterval(typingInterval);
        }
    }
}

// ========== FUNCIONES AUXILIARES ==========
function cleanAIResponse(text) {
    const aiPhrases = [
        /como (una )?ia,?/gi,
        /soy (un|una) (modelo|asistente|ia|bot)/gi,
        /estoy diseñad[oa]/gi,
        /fui cread[oa]/gi,
        /como (asistente|modelo)/gi,
        /no (tengo|poseo)/gi,
        /mis (funciones|capacidades)/gi,
        /(puedo|puede) ayudarte/gi,
        /(en )?qué (más|otra cosa)/gi
    ];
    
    let cleaned = text;
    aiPhrases.forEach(regex => {
        cleaned = cleaned.replace(regex, '');
    });
    
    // Limpiar dobles espacios y puntuación extraña
    cleaned = cleaned
        .replace(/\s+/g, ' ')
        .replace(/\.\.\./g, '…')
        .replace(/ ,/g, ',')
        .replace(/ \./g, '.')
        .trim();
    
    // Si quedó muy corta o vacía, usar respuesta por defecto
    if (cleaned.length < 3) {
        return "🤔 Interesante... ¿puedes desarrollar más esa idea?";
    }
    
    return cleaned;
}

function splitResponse(text) {
    if (text.length <= 2000) {
        return [text];
    }
    
    const chunks = [];
    const sentences = text.match(/[^.!?]+[.!?]+[\])'"`]*|\n+/g) || [text];
    let currentChunk = '';
    
    for (const sentence of sentences) {
        if ((currentChunk + sentence).length <= 1900) {
            currentChunk += sentence;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = sentence.length <= 1900 ? sentence : sentence.substring(0, 1900) + '...';
        }
    }
    
    if (currentChunk) chunks.push(currentChunk);
    
    return chunks;
}

// ========== RUTAS WEB MEJORADAS ==========
app.use(express.json());
app.use(express.static('public'));

app.get('/', async (req, res) => {
    logger.info('🔔 Visita recibida en página principal');
    
    if (!botActive && !isStartingUp && process.env.DISCORD_TOKEN) {
        setTimeout(() => {
            startBot().catch(error => {
                logger.warn('⚠️ Inicio automático falló:', error.message);
            });
        }, 2000);
    }
    
    res.sendFile('index.html', { root: '.' });
});

app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        personality: 'Mancy - Asistente Emocional Literario',
        favorite_book: 'La Náusea - Jean Paul Sartre',
        authors: 'Albert Camus, Sylvia Plath, Virginia Woolf',
        current_model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        conversations_active: conversationHistory.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.post('/api/start', async (req, res) => {
    try {
        if (!botActive && !isStartingUp) {
            await startBot();
            res.json({ 
                success: true, 
                message: 'Mancy iniciándose con personalidad mejorada...',
                model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768'
            });
        } else {
            res.json({ 
                success: true, 
                message: botActive ? '✅ Mancy ya está activa' : '🔄 Ya se está iniciando',
                status: botActive ? 'active' : 'starting'
            });
        }
    } catch (error) {
        logger.error('Error en /api/start:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            solution: 'Verifica tus tokens en .env'
        });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            conversationHistory.clear();
            
            res.json({ 
                success: true, 
                message: 'Mancy detenida y memoria limpiada',
                timestamp: new Date().toISOString()
            });
        } else {
            res.json({ 
                success: true, 
                message: 'Mancy ya estaba inactiva'
            });
        }
    } catch (error) {
        logger.error('Error en /api/stop:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Ruta de logs protegida
app.get('/api/logs', (req, res) => {
    const logs = [
        {
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: 'Sistema Mancy Pro activo - Modelo mejorado cargado'
        },
        {
            timestamp: new Date(Date.now() - 30000).toISOString(),
            level: 'INFO',
            message: `Modelo configurado: ${process.env.GROQ_MODEL || 'mixtral-8x7b-32768'}`
        },
        {
            timestamp: new Date(Date.now() - 60000).toISOString(),
            level: 'INFO',
            message: 'Personalidad literaria-existencialista activada'
        },
        {
            timestamp: new Date(Date.now() - 120000).toISOString(),
            level: 'INFO',
            message: 'Wake-on-Message con historial conversacional'
        },
        {
            timestamp: new Date(Date.now() - 180000).toISOString(),
            level: 'INFO',
            message: 'Sistema anti-frases-de-IA implementado'
        }
    ];
    res.json({
        success: true,
        logs: logs,
        total: logs.length,
        note: 'Logs de sistema - Historial conversacional no incluido por privacidad'
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot_active: botActive,
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
        personality: 'Mancy - Terapeuta literaria existencialista',
        features: [
            'Wake-on-Message mejorado',
            'Historial conversacional',
            'Respuestas limpias de IA',
            'Modelo Groq avanzado',
            'Rate limiting activo'
        ],
        memory_usage: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        uptime: `${(process.uptime() / 60).toFixed(1)} minutos`
    });
});

app.post('/wakeup', async (req, res) => {
    logger.info('🔔 Wakeup recibido vía POST');
    
    if (!botActive && !isStartingUp) {
        setTimeout(() => {
            startBot().catch(() => {
                logger.warn('Wakeup falló al iniciar');
            });
        }, 1000);
    }
    
    res.json({ 
        success: true, 
        message: 'Activando sistema Mancy...',
        bot_active: botActive,
        model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768'
    });
});

// ========== INICIAR SERVIDOR ==========
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║         🤖 MANCY A.I PRO                 ║
║      📚 Sartre • Camus • Plath           ║
║      🧠 Modelo: ${(process.env.GROQ_MODEL || 'mixtral-8x7b-32768').padEnd(18)}║
║                                          ║
║  Puerto: ${PORT.toString().padEnd(28)}║
║  URL: http://localhost:${PORT.toString().padEnd(21)}║
║  Status: ${botActive ? '🟢 Activo' : '🟡 Inactivo'.padEnd(26)}║
╚══════════════════════════════════════════╝
    `);
    
    // Sistema anti-suspensión para Render/Railway
    if (process.env.RENDER || process.env.RAILWAY) {
        logger.info('🔧 Sistema anti-suspensión activado');
        
        keepAliveInterval = setInterval(async () => {
            try {
                const response = await fetch(`http://localhost:${PORT}/health`);
                if (response.ok) {
                    logger.info('🔄 Ping automático exitoso');
                } else {
                    logger.warn('⚠️ Ping recibió respuesta no OK');
                }
            } catch (error) {
                logger.error('❌ Ping automático falló:', error.message);
            }
        }, 240000); // Cada 4 minutos (más eficiente)
        
        // Iniciar bot automáticamente en hosting
        if (!botActive && !isStartingUp) {
            setTimeout(() => {
                startBot().catch(error => {
                    logger.error('Inicio automático falló:', error.message);
                });
            }, 5000);
        }
    }
});

// ========== MANEJO DE APAGADO ==========
process.on('SIGTERM', () => {
    logger.info('💤 Recibido SIGTERM - Apagando limpiamente...');
    
    // Limpiar intervalos
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }
    
    // Desconectar Discord
    if (discordClient) {
        discordClient.destroy();
        logger.info('👋 Mancy desconectada de Discord');
    }
    
    // Cerrar servidor
    server.close(() => {
        logger.info('🌙 Servidor HTTP cerrado');
        process.exit(0);
    });
    
    // Timeout de seguridad
    setTimeout(() => {
        logger.warn('⚠️ Forzando cierre por timeout');
        process.exit(1);
    }, 10000);
});

process.on('uncaughtException', (error) => {
    logger.error('❌ Excepción no capturada:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Promesa rechazada no manejada:', reason);
});

// ========== INFORMACIÓN INICIAL ==========
logger.info('========================================');
logger.info('CONFIGURACIÓN RECOMENDADA EN .env:');
logger.info('========================================');
logger.info('GROQ_MODEL=mixtral-8x7b-32768');
logger.info('# Opciones: llama-3.1-70b-versatile (mejor)');
logger.info('#           gemma2-9b-it (rápido)');
logger.info('#           llama-3.1-8b-instant (más rápido)');
logger.info('========================================');
