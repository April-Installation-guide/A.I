import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';

// Importación crucial con la nueva ruta
import { MANCY_CONFIG, SYSTEM_CONSTANTS } from './src/config/constants.js'; 

dotenv.config();

// =================================================================
// ========== ESTADO Y CONFIGURACIÓN ==========
// =================================================================

if (!process.env.GROQ_API_KEY) {
    console.error("❌ ERROR: La variable GROQ_API_KEY no está definida.");
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

let discordClient = null;
export let botActive = false;
export let isStartingUp = false;
let startAttempts = 0;
let messageQueue = [];
let processingMessage = false;

// Cache simple para evitar procesamiento duplicado
const messageCache = new Map();
const CACHE_DURATION = 5000; // 5 segundos

// =================================================================
// ========== FUNCIONES AUXILIARES MEJORADAS ==========
// =================================================================

/**
 * Extrae JSON de un string que pueda contener texto adicional
 */
function extractJSONFromText(text) {
    if (!text) return null;
    
    // Intentar parsear directamente
    try {
        return JSON.parse(text.trim());
    } catch {
        // Buscar objeto JSON en el texto
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch {
                // Intentar limpiar el JSON
                const cleaned = jsonMatch[0]
                    .replace(/```json\s*/g, '')
                    .replace(/```\s*/g, '')
                    .trim();
                try {
                    return JSON.parse(cleaned);
                } catch (e) {
                    console.log("❌ No se pudo limpiar el JSON:", e.message);
                }
            }
        }
    }
    return null;
}

/**
 * Valida que el JSON tenga la estructura esperada
 */
function validateResponseStructure(response) {
    if (!response || typeof response !== 'object') {
        return false;
    }
    
    // Verificar estructura básica esperada
    if (!response.respuesta_discord || typeof response.respuesta_discord !== 'string') {
        return false;
    }
    
    // Validar longitud máxima
    if (response.respuesta_discord.length > 2000) {
        response.respuesta_discord = response.respuesta_discord.substring(0, 1997) + "...";
    }
    
    return true;
}

// =================================================================
// ========== LLAMADA A GROQ MEJORADA ==========
// =================================================================

async function getGroqResponse(systemPrompt, userPrompt, temperature, maxTokens) {
    const jsonSchema = MANCY_CONFIG.OUTPUT_SCHEMA;
    
    // System prompt mejorado con instrucciones más claras
    const groqSystemPrompt = `${systemPrompt}\n\n
CRITICAL INSTRUCTION: You MUST respond ONLY with a valid JSON object.
DO NOT include any text outside the JSON.
DO NOT use markdown or code blocks.
The JSON MUST follow exactly this schema:
${JSON.stringify(jsonSchema, null, 2)}

Example of valid response:
${JSON.stringify(MANCY_CONFIG.FALLBACK_RESPONSE, null, 2)}

Remember: ONLY JSON, no explanations, no additional text.`;

    try {
        // Timeout para la llamada a la API
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout de API excedido")), 30000)
        );

        const apiPromise = groq.chat.completions.create({
            messages: [
                { 
                    role: "system", 
                    content: groqSystemPrompt 
                },
                { 
                    role: "user", 
                    content: userPrompt 
                }
            ],
            model: MANCY_CONFIG.MODEL.name,
            temperature: temperature,
            max_tokens: maxTokens,
            response_format: { type: "json_object" }  // Forzar modo JSON
        });

        // Ejecutar con timeout
        const chatCompletion = await Promise.race([apiPromise, timeoutPromise]);
        
        if (!chatCompletion.choices || !chatCompletion.choices[0]) {
            throw new Error("Respuesta de API vacía o inválida");
        }

        const rawContent = chatCompletion.choices[0].message?.content?.trim();
        
        if (!rawContent) {
            console.error("❌ Contenido vacío recibido de Groq");
            return MANCY_CONFIG.FALLBACK_RESPONSE;
        }

        // DEBUG: Log para ver qué está recibiendo (solo en desarrollo)
        if (process.env.NODE_ENV === 'development') {
            console.log("📥 Raw content recibido:", rawContent.substring(0, 200));
        }

        // Intentar extraer y validar JSON
        const parsedResponse = extractJSONFromText(rawContent);
        
        if (!parsedResponse) {
            console.error("❌ No se pudo extraer JSON válido:", rawContent.substring(0, 200));
            return MANCY_CONFIG.FALLBACK_RESPONSE;
        }

        // Validar estructura
        if (!validateResponseStructure(parsedResponse)) {
            console.error("❌ Estructura JSON inválida:", parsedResponse);
            return MANCY_CONFIG.FALLBACK_RESPONSE;
        }

        // Sanitizar respuesta para Discord
        parsedResponse.respuesta_discord = parsedResponse.respuesta_discord
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remover caracteres de control
            .trim();

        return parsedResponse;

    } catch (error) {
        console.error("❌ Error en getGroqResponse:", {
            message: error.message,
            type: error.constructor.name,
            stack: error.stack?.split('\n')[0]
        });
        
        // Intentar regenerar respuesta de fallback más específica
        return {
            ...MANCY_CONFIG.FALLBACK_RESPONSE,
            respuesta_discord: `¡Oh no! Parece que la red neuronal ha tropezado: ${error.message}. Inténtalo de nuevo, humano.`
        };
    }
}

// =================================================================
// ========== LÓGICA DE INICIO DEL BOT MEJORADA ==========
// =================================================================

export function initializeAndStartBot() {
    if (isStartingUp) {
        console.log("⚠️ Ya hay un inicio en proceso...");
        return;
    }

    if (discordClient) {
        discordClient.destroy();
        discordClient = null;
        botActive = false;
    }
    
    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds, 
            GatewayIntentBits.GuildMessages, 
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages
        ]
    });
    
    startDiscordBot(); 
}

async function startDiscordBot() {
    if (!process.env.DISCORD_TOKEN) { 
        console.error("❌ ERROR: DISCORD_TOKEN no está definido."); 
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
            console.log(`📊 Estado: ${discordClient.guilds.cache.size} servidores`);
            botActive = true;
            isStartingUp = false;
            startAttempts = 0;
        });
        
        // Manejo de errores de conexión
        discordClient.on('error', (error) => {
            console.error("❌ Error en cliente de Discord:", error);
            if (botActive) {
                botActive = false;
                setTimeout(initializeAndStartBot, 10000);
            }
        });
        
        // Reconexión automática
        discordClient.on('disconnect', () => {
            console.log("🔌 Bot desconectado, intentando reconectar...");
            botActive = false;
            setTimeout(initializeAndStartBot, 5000);
        });

        discordClient.on('messageCreate', handleDiscordMessage);

    } catch (error) {
        console.error(`❌ Intento ${startAttempts} fallido. Reintentando en 5s...`, error.message);
        isStartingUp = false;
        
        // Delay exponencial para reintentos
        const delay = Math.min(5000 * Math.pow(1.5, startAttempts - 1), 30000);
        setTimeout(startDiscordBot, delay);
    }
}

// =================================================================
// ========== MANEJADOR DE MENSAJES MEJORADO ==========
// =================================================================

async function handleDiscordMessage(message) {
    // Ignorar bots
    if (message.author.bot) return;
    
    // Verificar si es DM o mención
    const isDirectMessage = message.channel.type === 1; 
    const isMention = message.mentions.users.has(discordClient.user.id);
    
    if (!isDirectMessage && !isMention) return;
    
    // Limpiar mensaje
    let userMessage = message.content.replace(new RegExp(`<@!?${discordClient.user.id}>`), '').trim();
    if (!userMessage) {
        // Responder a mensajes vacíos
        await message.reply("¿Sí? ¿En qué puedo ayudarte?");
        return;
    }
    
    // Verificar caché para evitar procesamiento duplicado
    const cacheKey = `${message.author.id}-${userMessage.substring(0, 50)}`;
    if (messageCache.has(cacheKey)) {
        console.log("⚠️ Mensaje duplicado detectado, ignorando...");
        return;
    }
    
    messageCache.set(cacheKey, true);
    setTimeout(() => messageCache.delete(cacheKey), CACHE_DURATION);
    
    try {
        await message.channel.sendTyping();
        
        // 1. Usar identidad base como System Prompt
        const systemPrompt = MANCY_CONFIG.IDENTITY;
        
        // 2. Agregar contexto básico si está disponible
        const enhancedPrompt = `${userMessage}\n\nContexto: Mensaje en ${isDirectMessage ? 'mensaje directo' : 'canal público'}.`;
        
        // 3. Llamar a la IA con timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Timeout procesando mensaje")), 25000)
        );
        
        const aiPromise = getGroqResponse(
            systemPrompt, 
            enhancedPrompt, 
            MANCY_CONFIG.MODEL.temperature, 
            MANCY_CONFIG.MODEL.max_tokens
        );
        
        const mancyResponseObject = await Promise.race([aiPromise, timeoutPromise]);
        
        // 4. Enviar respuesta
        await message.reply({
            content: mancyResponseObject.respuesta_discord,
            allowedMentions: { repliedUser: false }
        });

    } catch (error) {
        console.error(`❌ Error procesando mensaje de ${message.author.tag}:`, error.message);
        
        // Respuesta de error amigable
        const errorResponses = [
            "¡Ups! Mi red neuronal se ha atascado. ¿Podrías intentarlo de nuevo?",
            "Error de procesamiento cognitivo. Reiniciando sinapsis...",
            "Parece que hay interferencia en mi matriz de pensamiento. Intenta de nuevo.",
            "¡Vaya! Mi cerebro digital necesita un momento. ¿Repites?"
        ];
        
        const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
        
        try {
            await message.reply(randomError);
        } catch (replyError) {
            console.error("❌ Error al enviar mensaje de error:", replyError.message);
        }
    }
}

// =================================================================
// ========== UTILITIES MEJORADAS ==========
// =================================================================

export function getBotStatus() {
    return {
        bot_active: botActive,
        starting_up: isStartingUp,
        startAttempts: startAttempts,
        maxAttempts: SYSTEM_CONSTANTS.MAX_START_ATTEMPTS,
        capabilities: MANCY_CONFIG.CAPABILITIES,
        version: MANCY_CONFIG.VERSION,
        uptime: botActive ? process.uptime() : 0,
        guilds: discordClient?.guilds?.cache?.size || 0,
        memory_usage: process.memoryUsage()
    };
}

export function forceRestartBot() {
    console.log("🔄 Reinicio forzado solicitado...");
    startAttempts = 0;
    initializeAndStartBot();
}

export function getMessageQueue() {
    return {
        queue_length: messageQueue.length,
        processing: processingMessage,
        cache_size: messageCache.size
    };
}

// Inicio automático si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeAndStartBot();
}
