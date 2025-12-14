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
// ========== CONFIGURACIÓN DE MODELOS ==========
// =================================================================

// Lista de modelos disponibles en Groq (priorizando Llama 3.1)
const AVAILABLE_MODELS = {
    // Llama 3.1 (recomendado - más reciente y potente)
    'llama-3.1-70b-versatile': {
        name: 'llama-3.1-70b-versatile',
        displayName: 'Llama 3.1 70B Versatile',
        contextWindow: 131072,
        description: 'Modelo Llama 3.1 de 70B parámetros, muy versátil'
    },
    'llama-3.1-8b-instant': {
        name: 'llama-3.1-8b-instant',
        displayName: 'Llama 3.1 8B Instant',
        contextWindow: 131072,
        description: 'Modelo Llama 3.1 de 8B parámetros, rápido'
    },
    'llama3-70b-8192': {
        name: 'llama3-70b-8192',
        displayName: 'Llama 3 70B',
        contextWindow: 8192,
        description: 'Modelo Llama 3 de 70B parámetros'
    },
    'llama3-8b-8192': {
        name: 'llama3-8b-8192',
        displayName: 'Llama 3 8B',
        contextWindow: 8192,
        description: 'Modelo Llama 3 de 8B parámetros, rápido'
    },
    // Mixtral (modelo anterior)
    'mixtral-8x7b-32768': {
        name: 'mixtral-8x7b-32768',
        displayName: 'Mixtral 8x7B',
        contextWindow: 32768,
        description: 'Modelo Mixtral de expertos'
    }
};

// Selección del modelo (puedes cambiarlo aquí)
const SELECTED_MODEL = AVAILABLE_MODELS['llama-3.1-70b-versatile']; // Cambiado a Llama 3.1
const MODEL_TEMPERATURE = 0.7; // Ajustable según necesidad
const MODEL_MAX_TOKENS = 1024; // Máximo de tokens por respuesta

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
    
    // Validar longitud máxima para Discord
    if (response.respuesta_discord.length > 2000) {
        response.respuesta_discord = response.respuesta_discord.substring(0, 1997) + "...";
    }
    
    return true;
}

/**
 * Función para listar modelos disponibles (útil para debugging)
 */
export async function listAvailableModels() {
    try {
        // Nota: Groq no tiene endpoint público para listar modelos
        // pero podemos intentar usar uno para verificar disponibilidad
        console.log("📋 Modelos configurados disponibles:");
        console.log("======================================");
        
        Object.values(AVAILABLE_MODELS).forEach((model, index) => {
            const isSelected = model.name === SELECTED_MODEL.name;
            console.log(`${isSelected ? '✅' : '  '} ${index + 1}. ${model.displayName}`);
            console.log(`     ID: ${model.name}`);
            console.log(`     Contexto: ${model.contextWindow} tokens`);
            console.log(`     Descripción: ${model.description}`);
            console.log(`     ${isSelected ? '← ACTUALMENTE SELECCIONADO' : ''}`);
            console.log();
        });
        
        return {
            selected: SELECTED_MODEL,
            available: AVAILABLE_MODELS,
            count: Object.keys(AVAILABLE_MODELS).length
        };
    } catch (error) {
        console.error("❌ Error listando modelos:", error);
        return null;
    }
}

// =================================================================
// ========== LLAMADA A GROQ MEJORADA CON LLAMA 3.1 ==========
// =================================================================

async function getGroqResponse(systemPrompt, userPrompt, temperature, maxTokens) {
    const jsonSchema = MANCY_CONFIG.OUTPUT_SCHEMA;
    
    // System prompt optimizado para Llama 3.1
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
        console.log(`🤖 Usando modelo: ${SELECTED_MODEL.displayName} (${SELECTED_MODEL.name})`);
        
        // Timeout para la llamada a la API
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout de API excedido (30s) con modelo ${SELECTED_MODEL.name}`)), 30000)
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
            model: SELECTED_MODEL.name, // Usamos el modelo seleccionado
            temperature: temperature || MODEL_TEMPERATURE,
            max_tokens: maxTokens || MODEL_MAX_TOKENS,
            response_format: { type: "json_object" },  // Forzar modo JSON
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

        // DEBUG: Log para ver qué está recibiendo
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG_MODEL === 'true') {
            console.log(`📥 Raw content (primeros 300 chars):`, rawContent.substring(0, 300));
            console.log(`📊 Longitud: ${rawContent.length} caracteres`);
        }

        // Intentar extraer y validar JSON
        const parsedResponse = extractJSONFromText(rawContent);
        
        if (!parsedResponse) {
            console.error("❌ No se pudo extraer JSON válido del modelo");
            console.log("📄 Contenido recibido (inicio):", rawContent.substring(0, 500));
            return MANCY_CONFIG.FALLBACK_RESPONSE;
        }

        // Validar estructura
        if (!validateResponseStructure(parsedResponse)) {
            console.error("❌ Estructura JSON inválida del modelo:", Object.keys(parsedResponse));
            return MANCY_CONFIG.FALLBACK_RESPONSE;
        }

        // Sanitizar respuesta para Discord
        parsedResponse.respuesta_discord = parsedResponse.respuesta_discord
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remover caracteres de control
            .replace(/\s+/g, ' ') // Normalizar espacios
            .trim();

        // Asegurar que no esté vacío
        if (!parsedResponse.respuesta_discord || parsedResponse.respuesta_discord.length === 0) {
            parsedResponse.respuesta_discord = MANCY_CONFIG.FALLBACK_RESPONSE.respuesta_discord;
        }

        console.log(`✅ Respuesta procesada correctamente (${parsedResponse.respuesta_discord.length} chars)`);
        return parsedResponse;

    } catch (error) {
        console.error("❌ Error en getGroqResponse:", {
            message: error.message,
            model: SELECTED_MODEL.name,
            type: error.constructor.name
        });
        
        // Intentar con un modelo alternativo si el principal falla
        if (error.message.includes('model') || error.message.includes('not found')) {
            console.log("🔄 Intentando con modelo alternativo...");
            // Podrías implementar lógica de fallback a otro modelo aquí
        }
        
        return {
            ...MANCY_CONFIG.FALLBACK_RESPONSE,
            respuesta_discord: `Error del modelo ${SELECTED_MODEL.displayName}: ${error.message}. Inténtalo de nuevo.`
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
    
    // Mostrar información del modelo al iniciar
    console.log(`🚀 Iniciando bot con modelo: ${SELECTED_MODEL.displayName}`);
    console.log(`   ID: ${SELECTED_MODEL.name}`);
    console.log(`   Context Window: ${SELECTED_MODEL.contextWindow} tokens`);
    
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
            console.log(`======================================`);
            console.log(`🤖 Bot de Discord conectado como ${discordClient.user.tag}`);
            console.log(`📊 Modelo: ${SELECTED_MODEL.displayName}`);
            console.log(`🌐 Servidores: ${discordClient.guilds.cache.size}`);
            console.log(`🚀 Estado: LISTO`);
            console.log(`======================================`);
            
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
        
        // 2. Agregar contexto básico
        const enhancedPrompt = `${userMessage}\n\nContexto: ${isDirectMessage ? 'Mensaje directo' : 'Mencionado en canal público'}. Usuario: ${message.author.username}`;
        
        console.log(`📨 Procesando mensaje de ${message.author.tag}: "${userMessage.substring(0, 100)}..."`);
        
        // 3. Llamar a la IA con timeout
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout procesando con ${SELECTED_MODEL.displayName}`)), 25000)
        );
        
        const aiPromise = getGroqResponse(
            systemPrompt, 
            enhancedPrompt, 
            MODEL_TEMPERATURE, 
            MODEL_MAX_TOKENS
        );
        
        const mancyResponseObject = await Promise.race([aiPromise, timeoutPromise]);
        
        // 4. Enviar respuesta
        await message.reply({
            content: mancyResponseObject.respuesta_discord,
            allowedMentions: { repliedUser: false }
        });

        console.log(`✅ Respuesta enviada a ${message.author.tag}`);

    } catch (error) {
        console.error(`❌ Error procesando mensaje de ${message.author.tag}:`, error.message);
        
        // Respuesta de error amigable
        const errorResponses = [
            `¡Ups! Mi cerebro (${SELECTED_MODEL.displayName}) se ha atascado. ¿Podrías intentarlo de nuevo?`,
            `Error de procesamiento en ${SELECTED_MODEL.displayName}. Reiniciando sinapsis...`,
            `Parece que hay interferencia en mi matriz de pensamiento. Intenta de nuevo.`,
            `¡Vaya! Mi modelo ${SELECTED_MODEL.displayName} necesita un momento. ¿Repites?`
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
        model: SELECTED_MODEL,
        capabilities: MANCY_CONFIG.CAPABILITIES,
        version: MANCY_CONFIG.VERSION,
        uptime: botActive ? process.uptime() : 0,
        guilds: discordClient?.guilds?.cache?.size || 0,
        memory_usage: process.memoryUsage(),
        cache_size: messageCache.size
    };
}

export function forceRestartBot() {
    console.log("🔄 Reinicio forzado solicitado...");
    startAttempts = 0;
    initializeAndStartBot();
}

export function changeModel(modelKey) {
    if (AVAILABLE_MODELS[modelKey]) {
        console.log(`🔄 Cambiando modelo de ${SELECTED_MODEL.name} a ${AVAILABLE_MODELS[modelKey].name}`);
        SELECTED_MODEL = AVAILABLE_MODELS[modelKey];
        return { success: true, newModel: SELECTED_MODEL };
    } else {
        console.error(`❌ Modelo no disponible: ${modelKey}`);
        return { success: false, available: Object.keys(AAVAILABLE_MODELS) };
    }
}

export function getMessageQueue() {
    return {
        queue_length: messageQueue.length,
        processing: processingMessage,
        cache_size: messageCache.size
    };
}

// Función para probar el modelo
export async function testModelConnection() {
    try {
        console.log("🧪 Probando conexión con modelo...");
        const testPrompt = "Responde con un JSON simple: {\"test\": \"ok\"}";
        const response = await getGroqResponse("Eres un asistente útil.", testPrompt, 0.1, 50);
        console.log("✅ Conexión exitosa con modelo:", response);
        return { success: true, response };
    } catch (error) {
        console.error("❌ Error probando modelo:", error);
        return { success: false, error: error.message };
    }
}

// Inicio automático si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeAndStartBot();
    
    // Opcional: Probar conexión al iniciar
    setTimeout(async () => {
        if (botActive) {
            await testModelConnection();
        }
    }, 5000);
}
