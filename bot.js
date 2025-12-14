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
// ========== CONFIGURACIÓN DE MODELO ==========
// =================================================================

// Modelo seleccionado: llama-3.1-8b-instant
const SELECTED_MODEL = {
    name: 'llama-3.1-8b-instant',
    displayName: 'Llama 3.1 8B Instant',
    contextWindow: 131072,
    description: 'Modelo Llama 3.1 de 8B parámetros, rápido y eficiente'
};

const MODEL_TEMPERATURE = 0.7;
const MODEL_MAX_TOKENS = 1024;

// =================================================================
// ========== FUNCIONES AUXILIARES ==========
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
    
    // Validar longitud máxima para Discord
    if (response.respuesta_discord.length > 2000) {
        response.respuesta_discord = response.respuesta_discord.substring(0, 1997) + "...";
    }
    
    return true;
}

// =================================================================
// ========== LLAMADA A GROQ CON LLAMA 3.1 8B INSTANT ==========
// =================================================================

async function getGroqResponse(systemPrompt, userPrompt, temperature, maxTokens) {
    const jsonSchema = MANCY_CONFIG.OUTPUT_SCHEMA;
    
    // System prompt optimizado para Llama 3.1 8B Instant
    const groqSystemPrompt = `${systemPrompt}\n\n
IMPORTANTE: Eres el modelo ${SELECTED_MODEL.displayName}. 
Debes responder ÚNICAMENTE con un objeto JSON válido.

REGLAS ESTRICTAS:
1. NO incluyas ningún texto fuera del JSON
2. NO uses markdown, code blocks o comillas triples
3. El JSON DEBE seguir exactamente este esquema:
${JSON.stringify(jsonSchema, null, 2)}

EJEMPLO DE RESPUESTA CORRECTA:
${JSON.stringify(MANCY_CONFIG.FALLBACK_RESPONSE, null, 2)}

Tu respuesta debe comenzar con { y terminar con }.
No expliques, no comentes, solo JSON.`;

    try {
        console.log(`🤖 Usando modelo: ${SELECTED_MODEL.displayName}`);
        
        // Timeout para la llamada a la API
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout de API excedido (30s)`)), 30000)
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
            model: SELECTED_MODEL.name, // Usando llama-3.1-8b-instant
            temperature: temperature || MODEL_TEMPERATURE,
            max_tokens: maxTokens || MODEL_MAX_TOKENS,
            response_format: { type: "json_object" },
            stream: false
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

        // DEBUG: Log para debugging
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
            console.log(`📥 Raw content recibido:`, rawContent.substring(0, 300));
        }

        // Intentar extraer y validar JSON
        const parsedResponse = extractJSONFromText(rawContent);
        
        if (!parsedResponse) {
            console.error("❌ No se pudo extraer JSON válido");
            return MANCY_CONFIG.FALLBACK_RESPONSE;
        }

        // Validar estructura
        if (!validateResponseStructure(parsedResponse)) {
            console.error("❌ Estructura JSON inválida");
            return MANCY_CONFIG.FALLBACK_RESPONSE;
        }

        // Sanitizar respuesta para Discord
        parsedResponse.respuesta_discord = parsedResponse.respuesta_discord
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Asegurar que no esté vacío
        if (!parsedResponse.respuesta_discord || parsedResponse.respuesta_discord.length === 0) {
            parsedResponse.respuesta_discord = MANCY_CONFIG.FALLBACK_RESPONSE.respuesta_discord;
        }

        console.log(`✅ Respuesta procesada correctamente`);
        return parsedResponse;

    } catch (error) {
        console.error("❌ Error en getGroqResponse:", error.message);
        
        return {
            ...MANCY_CONFIG.FALLBACK_RESPONSE,
            respuesta_discord: `Error del modelo: ${error.message}. Inténtalo de nuevo.`
        };
    }
}

// =================================================================
// ========== LÓGICA DE INICIO DEL BOT ==========
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
    
    // Mostrar información del modelo al iniciar
    console.log(`🚀 Iniciando bot con modelo: ${SELECTED_MODEL.displayName}`);
    
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
            console.log(`📊 Modelo: ${SELECTED_MODEL.displayName}`);
            console.log(`🚀 Estado: LISTO`);
            
            botActive = true;
            isStartingUp = false;
            startAttempts = 0;
        });
        
        // Manejo de errores
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
        console.error(`❌ Intento ${startAttempts} fallido. Reintentando...`, error.message);
        isStartingUp = false;
        setTimeout(startDiscordBot, 5000);
    }
}

// =================================================================
// ========== MANEJADOR DE MENSAJES ==========
// =================================================================

async function handleDiscordMessage(message) {
    if (message.author.bot) return;
    
    const isDirectMessage = message.channel.type === 1; 
    const isMention = message.mentions.users.has(discordClient.user.id);
    
    if (!isDirectMessage && !isMention) return;
    
    let userMessage = message.content.replace(new RegExp(`<@!?${discordClient.user.id}>`), '').trim();
    if (!userMessage) {
        await message.reply("¿Sí? ¿En qué puedo ayudarte?");
        return;
    }
    
    // Cache para evitar duplicados
    const cacheKey = `${message.author.id}-${userMessage.substring(0, 50)}`;
    if (messageCache.has(cacheKey)) {
        console.log("⚠️ Mensaje duplicado detectado, ignorando...");
        return;
    }
    
    messageCache.set(cacheKey, true);
    setTimeout(() => messageCache.delete(cacheKey), CACHE_DURATION);
    
    try {
        await message.channel.sendTyping();
        
        const systemPrompt = MANCY_CONFIG.IDENTITY;
        
        console.log(`📨 Procesando mensaje de ${message.author.tag}`);
        
        // Timeout para procesamiento
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout procesando`)), 25000)
        );
        
        const aiPromise = getGroqResponse(
            systemPrompt, 
            userMessage, 
            MODEL_TEMPERATURE, 
            MODEL_MAX_TOKENS
        );
        
        const mancyResponseObject = await Promise.race([aiPromise, timeoutPromise]);
        
        await message.reply({
            content: mancyResponseObject.respuesta_discord,
            allowedMentions: { repliedUser: false }
        });

        console.log(`✅ Respuesta enviada a ${message.author.tag}`);

    } catch (error) {
        console.error(`❌ Error procesando mensaje:`, error.message);
        
        const errorResponses = [
            `¡Ups! Mi cerebro se ha atascado. ¿Podrías intentarlo de nuevo?`,
            `Error de procesamiento. Reiniciando...`,
            `Parece que hay interferencia. Intenta de nuevo.`,
            `¡Vaya! Necesito un momento. ¿Repites?`
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
// ========== UTILITIES ==========
// =================================================================

export function getBotStatus() {
    return {
        bot_active: botActive,
        starting_up: isStartingUp,
        model: SELECTED_MODEL,
        version: MANCY_CONFIG.VERSION,
        uptime: botActive ? process.uptime() : 0,
        guilds: discordClient?.guilds?.cache?.size || 0
    };
}

export function forceRestartBot() {
    console.log("🔄 Reinicio forzado solicitado...");
    startAttempts = 0;
    initializeAndStartBot();
}

// Inicio automático
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeAndStartBot();
}
