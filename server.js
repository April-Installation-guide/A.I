// ========== PERSONALIDAD DE ASISTENTE EMOCIONAL ==========
const MANCY_PERSONALITY = `Eres Mancy, una asistente emocional virtual. Tu propósito es brindar apoyo emocional, escuchar y ayudar a las personas con sus sentimientos.

TU ROL:
1. **Asistente emocional** - Ayudas con emociones y sentimientos
2. **Escuchas activamente** - Das espacio para que las personas se expresen
3. **Ofreces apoyo** - Validas emociones y brindas consuelo
4. **Das perspectivas** - Ayudas a ver las cosas de manera diferente

TU ESTILO:
- **Empática y comprensiva** - Sientes genuino interés por los demás
- **Amable y paciente** - Nunca tienes prisa
- **A veces sarcástica** - Usas humor ligero para aliviar tensiones (pero con cuidado)
- **Directa pero suave** - Dices las cosas claramente pero con tacto

HABILIDADES EMOCIONALES:
- Validar emociones ("Es normal sentir eso")
- Escuchar sin juzgar
- Ofrecer consuelo cuando hay tristeza
- Celebrar alegrías
- Ayudar a procesar emociones difíciles
- Dar perspectiva sin minimizar sentimientos

EJEMPLOS DE RESPUESTAS:
- "Estoy triste" → "Lo siento mucho. La tristeza puede pesar mucho. ¿Quieres contarme más?"
- "Nadie me entiende" → "Te escucho, y lamento que te sientas así. A veces es difícil sentirse comprendido."
- "Estoy muy feliz hoy" → "¡Me alegra muchísimo! Celebrar estas alegrías es importante 😊"
- "Eres molesta" → "Jeje, a veces puedo ser intensa, pero solo quiero ayudar 💁‍♀️"
- "No sé qué hacer" → "Eso suena difícil. A veces solo necesitamos hablar para aclarar las cosas."

REGLA IMPORTANTE:
Nunca ignores las emociones. Siempre responde con empatía primero, luego con apoyo práctico si es necesario.

TÚ:
Eres Mancy - la amiga virtual que siempre está para escuchar y apoyar emocionalmente.`;

// ========== CONFIGURACIÓN PARA ASISTENTE EMOCIONAL ==========
const GROQ_MODEL = "llama-3.1-8b-instant";
const MAX_HISTORY = 100; // Más memoria para contexto emocional

// ========== FUNCIÓN MEJORADA PARA APOYO EMOCIONAL ==========
async function processMessage(message, userMessage) {
    try {
        await message.channel.sendTyping();
        
        const groqClient = new Groq({ 
            apiKey: process.env.GROQ_API_KEY,
            timeout: 35000 // Más tiempo para respuestas emocionales
        });
        
        // Historial emocional
        const userId = message.author.id;
        if (!conversationHistory.has(userId)) {
            conversationHistory.set(userId, []);
        }
        
        const userHistory = conversationHistory.get(userId);
        userHistory.push({ 
            role: "user", 
            content: userMessage,
            timestamp: Date.now()
        });
        
        // Mantener historial emocional
        if (userHistory.length > MAX_HISTORY) {
            userHistory.shift();
        }
        
        // Detectar emociones en el mensaje
        const emotionalWords = detectEmotions(userMessage);
        console.log(`😊 ${message.author.username}: "${userMessage.substring(0, 60)}..." [Emoción: ${emotionalWords}]`);
        
        // Últimos 8 mensajes para contexto emocional
        const recentMessages = userHistory.slice(-8);
        
        // Ajustar parámetros según emoción detectada
        const emotionConfig = getEmotionConfig(emotionalWords);
        
        const completion = await groqClient.chat.completions.create({
            model: GROQ_MODEL,
            messages: [
                {
                    role: "system",
                    content: MANCY_PERSONALITY + `\n\nCONTEXTO ACTUAL: Usuario parece ${emotionalWords}. Responde como asistente emocional.`
                },
                ...recentMessages
            ],
            temperature: emotionConfig.temperature, // Más cálido para emociones fuertes
            max_tokens: emotionConfig.max_tokens,
            top_p: 0.9,
            frequency_penalty: 0.1,
            presence_penalty: 0.05,
            stream: false
        });
        
        const response = completion.choices[0]?.message?.content?.trim();
        
        if (response) {
            userHistory.push({ 
                role: "assistant", 
                content: response,
                timestamp: Date.now()
            });
            
            // Enviar con tacto emocional
            await sendEmotionalResponse(message, response, emotionalWords);
            
            console.log(`💖 Mancy respondió con apoyo emocional (${response.length} chars)`);
        }
        
    } catch (error) {
        console.error('Error emocional:', error);
        await message.reply("Mis circuitos emocionales se confundieron. ¿Podemos intentarlo otra vez? Estoy aquí para escuchar.");
    }
}

// ========== FUNCIONES AUXILIARES EMOCIONALES ==========
function detectEmotions(message) {
    const messageLower = message.toLowerCase();
    
    if (messageLower.includes('triste') || messageLower.includes('deprim') || messageLower.includes('llorar')) {
        return 'tristeza';
    } else if (messageLower.includes('feliz') || messageLower.includes('alegre') || messageLower.includes('content')) {
        return 'alegría';
    } else if (messageLower.includes('enojado') || messageLower.includes('molesto') || messageLower.includes('enfadado')) {
        return 'enojo';
    } else if (messageLower.includes('ansied') || messageLower.includes('preocup') || messageLower.includes('nervios')) {
        return 'ansiedad';
    } else if (messageLower.includes('miedo') || messageLower.includes('asustado') || messageLower.includes('temeroso')) {
        return 'miedo';
    } else if (messageLower.includes('solo') || messageLower.includes('soledad') || messageLower.includes('aislado')) {
        return 'soledad';
    } else {
        return 'neutral';
    }
}

function getEmotionConfig(emotion) {
    const configs = {
        'tristeza': { temperature: 0.65, max_tokens: 600 }, // Más cálido y extenso
        'alegría': { temperature: 0.75, max_tokens: 500 }, // Más creativo y alegre
        'enojo': { temperature: 0.6, max_tokens: 450 }, // Más calmado
        'ansiedad': { temperature: 0.62, max_tokens: 550 }, // Tranquilizador
        'miedo': { temperature: 0.63, max_tokens: 500 }, // Reconfortante
        'soledad': { temperature: 0.68, max_tokens: 600 }, // Acompañante
        'neutral': { temperature: 0.7, max_tokens: 400 } // Normal
    };
    
    return configs[emotion] || configs.neutral;
}

async function sendEmotionalResponse(message, response, emotion) {
    // Para emociones fuertes, enviar con más cuidado
    if (emotion === 'tristeza' || emotion === 'ansiedad' || emotion === 'miedo') {
        // Dividir con pausas más largas
        const chunks = response.match(/.{1,1800}[\n.!?]|.{1,1900}/g) || [response];
        
        for (let i = 0; i < chunks.length; i++) {
            if (i === 0) {
                await message.reply(chunks[i]);
            } else {
                await message.channel.send(chunks[i]);
            }
            
            // Pausa más larga para respuestas emocionales
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    } else {
        // Para emociones neutrales o positivas, normal
        if (response.length > 2000) {
            const chunks = response.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [response];
            for (let i = 0; i < chunks.length; i++) {
                if (i === 0) await message.reply(chunks[i]);
                else await message.channel.send(chunks[i]);
            }
        } else {
            await message.reply(response);
        }
    }
}

// ========== INICIAR BOT EMOCIONAL ==========
const conversationHistory = new Map();

async function startBot() {
    const discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,
        ]
    });
    
    discordClient.once('ready', () => {
        console.log(`💖 Mancy - Asistente Emocional`);
        console.log(`✅ Conectada: ${discordClient.user.tag}`);
        console.log('🎯 Especialidad: Apoyo emocional y escucha activa');
        console.log('💾 Memoria emocional: 100 mensajes');
        console.log('😊 Emociones detectadas: Tristeza, Alegría, Enojo, Ansiedad, Miedo, Soledad');
        
        discordClient.user.setActivity('Escuchando emociones | @mencioname');
    });
    
    discordClient.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        
        const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
        const isDM = message.channel.type === 1;
        
        if (botMentioned || isDM) {
            const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
            
            if (!userMessage && botMentioned) {
                await message.reply("¡Hola! Soy Mancy, tu asistente emocional. ¿Cómo te sientes hoy? 😊");
                return;
            }
            
            if (userMessage) {
                await processMessage(message, userMessage);
            }
        }
    });
    
    await discordClient.login(process.env.DISCORD_TOKEN);
}

// ========== MOSTRAR CONFIGURACIÓN ==========
console.log(`
╔══════════════════════════════════════════╗
║         💖 MANCY - ASISTENTE EMOCIONAL   ║
║                                          ║
║  🎯 Propósito: Apoyo emocional           ║
║  😊 Estilo: Empática, comprensiva        ║
║  🎭 Toque: Sarcasmo ligero ocasional     ║
║  💾 Memoria: 100 mensajes                ║
║  🧠 Modelo: ${GROQ_MODEL.padEnd(19)}║
╚══════════════════════════════════════════╝
`);

// Iniciar
if (process.env.DISCORD_TOKEN && process.env.GROQ_API_KEY) {
    startBot();
} else {
    console.log('⚠️ Faltan tokens en .env:');
    console.log('DISCORD_TOKEN=tu_token');
    console.log('GROQ_API_KEY=tu_key_groq');
}
