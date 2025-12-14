import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import { MANCY_CONFIG, SYSTEM_CONSTANTS } from './config/constants.js';
import { OrganicMemory } from './modules/organic_memory.js'; // Módulos externos
import { ContinuousLearningModule } from './modules/learning_module.js'; // Módulos externos

dotenv.config();

// =================================================================
// ========== 1. INICIALIZACIÓN DE COMPONENTES CENTRALES ==========
// =================================================================

const app = express();
const PORT = process.env.PORT || SYSTEM_CONSTANTS.DEFAULT_PORT;

app.use(express.static('public'));
app.use(express.json());

// 1.1 Configuración del motor de inferencia (Groq)
if (!process.env.GROQ_API_KEY) {
    console.error("❌ ERROR: La variable GROQ_API_KEY no está definida en .env");
    process.exit(1);
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 1.2 Inicialización de Módulos (Cargan la lógica)
const organicMemory = new OrganicMemory(MANCY_CONFIG.MEMORY);
const learningModule = new ContinuousLearningModule(MANCY_CONFIG.LEARNING);

// =================================================================
// ========== 2. ESTADO GLOBAL Y UTILIDADES DE CONTROL ==========
// =================================================================

let discordClient = null;
let botActive = false;
let isStartingUp = false;
let startAttempts = 0;

/**
 * Función CRÍTICA: Llama a la API de Groq con la lógica de forzar JSON.
 * (El cuerpo de esta función se mantiene aquí por la dependencia directa del SDK)
 */
async function getGroqResponse(systemPrompt, userPrompt, temperature, maxTokens) {
    // Definición del esquema JSON para la salida (Importado de la configuración)
    const jsonSchema = MANCY_CONFIG.OUTPUT_SCHEMA;
    
    // Inyección de la instrucción JSON CRÍTICA en el System Prompt
    const groqSystemPrompt = `${systemPrompt}\n\n
INSTRUCCIÓN CRÍTICA: Debes responder **ÚNICAMENTE** con un objeto JSON válido que siga **EXACTAMENTE** el siguiente esquema. No añadas texto explicativo, preámbulos, ni markdown fuera del JSON.

ESQUEMA JSON REQUERIDO: ${JSON.stringify(jsonSchema, null, 2)}
`;
    
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: groqSystemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: MANCY_CONFIG.MODEL.name,
            temperature: temperature,
            max_tokens: maxTokens,
        });
        
        const rawContent = chatCompletion.choices[0].message.content.trim();
        const parsedJson = JSON.parse(rawContent);
        return parsedJson;
        
    } catch (error) {
        console.error("❌ Error en getGroqResponse o al parsear JSON:", error.message);
        // Fallback estructurado (definido en config)
        return MANCY_CONFIG.FALLBACK_RESPONSE;
    }
}

// =================================================================
// ========== 3. LÓGICA DE DISCORD (Inicialización y Manejo) ==========
// =================================================================

function initializeDiscordClient() {
    if (discordClient) discordClient.destroy();
    
    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });
    startDiscordBot(); 
}

// Lógica de inicio de sesión y reintentos (se mantiene igual)
async function startDiscordBot() {
    // ... (El código de inicio de Discord se mantiene, solo usa SYSTEM_CONSTANTS.MAX_START_ATTEMPTS)
    // ... (Por brevedad, se omite el cuerpo de esta función, pero se reutiliza el original)
    if (!process.env.DISCORD_TOKEN) {
        console.error("❌ ERROR: DISCORD_TOKEN no está definido en .env");
        isStartingUp = false;
        return;
    }

    if (startAttempts >= SYSTEM_CONSTANTS.MAX_START_ATTEMPTS) {
        console.error("❌ Error: Máximo de intentos de inicio alcanzado.");
        isStartingUp = false;
        return;
    }
    
    isStartingUp = true;
    startAttempts++;

    try {
        await discordClient.login(process.env.DISCORD_TOKEN);
        
        discordClient.once('ready', () => {
            console.log(`🤖 Bot de Discord conectado como ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            startAttempts = 0;
        });
        
        discordClient.on('messageCreate', handleDiscordMessage);

    } catch (error) {
        console.error(`❌ Intento ${startAttempts} fallido. Reintentando en 5s...`, error);
        isStartingUp = false;
        setTimeout(startDiscordBot, 5000);
    }
}

/**
 * MANEJADOR CENTRAL DE MENSAJES DE DISCORD
 */
async function handleDiscordMessage(message) {
    if (message.author.bot) return;

    const isDirectMessage = message.channel.type === 1; 
    const isMention = message.mentions.users.has(discordClient.user.id);
    
    if (!isDirectMessage && !isMention) return;

    const userId = message.author.id;
    let userMessage = message.content;

    if (isMention) {
        const mentionRegex = new RegExp(`<@!?${discordClient.user.id}>`);
        userMessage = userMessage.replace(mentionRegex, '').trim();
    }
    
    if (!userMessage) return;

    try {
        await message.channel.sendTyping(); 
        
        // 1. Análisis de Esencia (Simulado, idealmente es una llamada a un LLM/modelo pequeño)
        const essenceData = organicMemory.analyzeMessageEssence(userMessage);
        
        // 2. Obtener Contexto de Memoria y Aprendizaje
        const memoryContext = await organicMemory.getConversations(userId);
        const learningContext = await learningModule.getContextForResponse(userId, userMessage);

        // 3. Construir System Prompt (Identidad + Memoria + Contexto)
        // Se define en el módulo de memoria, que también usa la configuración
        const systemPrompt = organicMemory.buildSystemPrompt(MANCY_CONFIG.IDENTITY, memoryContext, learningContext, essenceData);
        
        // 4. Llamar a la IA (Obtiene Objeto JSON)
        const mancyResponseObject = await getGroqResponse(
            systemPrompt, 
            userMessage, 
            MANCY_CONFIG.MODEL.temperature, 
            MANCY_CONFIG.MODEL.max_tokens
        );

        // 5. Responder a Discord
        const mancyTextResponse = mancyResponseObject.respuesta_discord;
        const mancyMetaData = mancyResponseObject.meta_datos;
        
        await message.reply(mancyTextResponse);

        // 6. Guardar y Aprender (Post-Proceso)
        await organicMemory.saveConversation(userId, userMessage, mancyTextResponse, essenceData, mancyMetaData);
        await learningModule.processConversation(userId, userMessage, mancyTextResponse, essenceData, mancyMetaData);

    } catch (error) {
        console.error(`❌ Error en el manejador de mensajes de ${userId}:`, error);
        message.reply(MANCY_CONFIG.FALLBACK_RESPONSE.respuesta_discord);
    }
}


// =================================================================
// ========== 4. RUTAS Y ESCUCHA DEL SERVIDOR ==========
// =================================================================

// Rutas de control (Start, Stop, Status, Memory Stats - se mantienen igual, solo usan SYSTEM_CONSTANTS)
// ... (El código de rutas se mantiene, solo usa el nuevo PORT y constantes)
app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        startAttempts: startAttempts,
        maxAttempts: SYSTEM_CONSTANTS.MAX_START_ATTEMPTS,
        memory_stats: {
             totalMessages: organicMemory.getStats().totalMessages,
             totalUsers: organicMemory.getStats().totalUsers,
             queriesProcessed: 0
        },
        capabilities: MANCY_CONFIG.CAPABILITIES,
        version: MANCY_CONFIG.VERSION
    });
});
// (otras rutas omitidas por brevedad, asumiendo que se adaptan al nuevo esquema de módulos)

// Inicializar el cliente de Discord al iniciar el servidor Express
app.listen(PORT, () => {
    console.log(`🚀 Servidor Express escuchando en el puerto ${PORT}`);
    initializeDiscordClient();
});
