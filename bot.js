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

// Cache para BLOQUEO de mensajes duplicados/reprocesamiento, usando message.id
const messageCache = new Map();
const CACHE_DURATION = 5000; // 5 segundos, tiempo máximo de bloqueo de un mensaje

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
const API_TIMEOUT = 30000; // 30 segundos
const PROCESSING_TIMEOUT = 25000; // 25 segundos para el manejo de mensajes completo

// =================================================================
// ========== FUNCIONES AUXILIARES ==========
// =================================================================

/**
 * Extrae JSON de un string que pueda contener texto adicional o markdown (ROBUSTO).
 */
function extractJSONFromText(text) {
    if (!text) return null;
    
    // 1. Limpieza de markdown común y bloques de código
    let cleanedText = text
        .replace(/```json\s*/g, '') // Eliminar ```json
        .replace(/```\s*$/g, '')    // Eliminar ``` al final
        .replace(/\s*(\{[\s\S]*\})\s*/, '$1') // Capturar y limpiar envoltorios de espacio
        .trim();

    // 2. Intentar parsear el texto limpio
    try {
        return JSON.parse(cleanedText);
    } catch (e) {
        // console.log("❌ Falló el primer intento de parseo. Buscando objeto:", e.message);
        
        // 3. Si falla, buscar la ocurrencia del objeto JSON
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                // Intentar parsear solo lo que parece ser el JSON
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                // console.log("❌ Falló el segundo intento de parseo con regex:", e.message);
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
1. NO incluyas ningún texto fuera del JSON (ni explicaciones, ni comentarios).
2. NO uses markdown, code blocks o comillas triples fuera del JSON.
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
            setTimeout(() => reject(new Error(`Timeout de API excedido (${API_TIMEOUT / 1000}s)`)), API_TIMEOUT)
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
            model: SELECTED_MODEL.name,
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

        // Intentar extraer y validar JSON
        const parsedResponse = extractJSONFromText(rawContent);
        
        if (!parsedResponse) {
            console.error("❌ No se pudo extraer JSON válido.");
            return {
                ...MANCY_CONFIG.FALLBACK_RESPONSE,
                respuesta_discord: "⚠️ Error interno: El modelo no devolvió un JSON válido. Intenta de nuevo."
            };
        }

        // Validar estructura
        if (!validateResponseStructure(parsedResponse)) {
            console.error("❌ Estructura JSON inválida.");
            return {
                ...MANCY_CONFIG.FALLBACK_RESPONSE,
                respuesta_discord: "⚠️ Error interno: El modelo devolvió un JSON con estructura incorrecta."
            };
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
        
        let userErrorMessage = "Lo siento, tengo un error desconocido. Inténtalo de nuevo.";
        
        if (error.message.includes("Timeout")) {
            userErrorMessage = "El servicio de IA tardó demasiado en responder. ¿Puedes reformular la pregunta?";
        } else if (error.message.includes("Respuesta de API vacía")) {
             userErrorMessage = "El modelo no generó contenido. Intenta con un prompt diferente.";
        }

        return {
            ...MANCY_CONFIG.FALLBACK_RESPONSE,
            respuesta_discord: userErrorMessage
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
        console.error("❌ Error: Máximo de intentos de inicio alcanzado. Abortando."); 
        isStartingUp = false; 
        return; 
    }
    
    isStartingUp = true;
    startAttempts++;

    try {
        // Manejar evento de login exitoso
        discordClient.once('ready', () => {
            console.log(`🤖 Bot de Discord conectado como ${discordClient.user.tag}`);
            console.log(`📊 Modelo: ${SELECTED_MODEL.displayName}`);
            console.log(`🚀 Estado: LISTO`);
            
            botActive = true;
            isStartingUp = false;
            startAttempts = 0; // Resetear intentos al tener éxito
        });
        
        // Manejo de errores
        discordClient.on('error', (error) => {
            console.error("❌ Error en cliente de Discord:", error);
            if (botActive) {
                botActive = false;
                // Intento de reconexión si hay un error en tiempo de ejecución
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

        await discordClient.login(process.env.DISCORD_TOKEN);

    } catch (error) {
        console.error(`❌ Intento ${startAttempts} fallido al loguear. Reintentando en 5s...`, error.message);
        isStartingUp = false;
        setTimeout(startDiscordBot, 5000);
    }
}

// =================================================================
// ========== MANEJADOR DE MENSAJES (CON BLOQUEO DE DUPLICADOS) ==========
// =================================================================

async function handleDiscordMessage(message) {
    if (message.author.bot) return;
    
    const isDirectMessage = message.channel.type === 1; 
    const isMention = message.mentions.users.has(discordClient.user.id);
    
    if (!isDirectMessage && !isMention) return;
    
    let userMessage = message.content.replace(new RegExp(`<@!?${discordClient.user.id}>`), '').trim();
    if (!userMessage) {
        if (isMention || isDirectMessage) {
             await message.reply("¿Sí? ¿En qué puedo ayudarte?");
        }
        return;
    }
    
    // ** SOLUCIÓN DE DUPLICADOS **
    const cacheKey = message.id; // Usamos el ID único del mensaje de Discord
    
    // 1. Detección de duplicados estricta 
    if (messageCache.has(cacheKey)) {
        console.log(`⚠️ Mensaje ID ${cacheKey} ya está siendo procesado o fue procesado recientemente, ignorando.`);
        return;
    }
    
    // 2. Bloqueo de procesamiento: Marcar como en proceso.
    messageCache.set(cacheKey, Date.now());
    
    // Limpieza automática (por si acaso el proceso falla y no se borra en finally)
    let autoClearTimeout = setTimeout(() => {
        if (messageCache.has(cacheKey)) {
            messageCache.delete(cacheKey);
            console.log(`🗑️ Bloqueo de mensaje ID ${cacheKey} expirado y liberado.`);
        }
    }, CACHE_DURATION); 

    let typingInterval = null; 

    try {
        // Inicializar 'Typing' y configurar el looper (Mejora de UX)
        await message.channel.sendTyping();
        typingInterval = setInterval(() => {
            message.channel.sendTyping().catch(e => {
                if (typingInterval) clearInterval(typingInterval);
            });
        }, 7000); 

        const systemPrompt = MANCY_CONFIG.IDENTITY;
        
        console.log(`📨 Procesando mensaje ID ${cacheKey} de ${message.author.tag}`);
        
        // Timeout para procesamiento completo
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout procesando después de ${PROCESSING_TIMEOUT / 1000}s`)), PROCESSING_TIMEOUT)
        );
        
        const aiPromise = getGroqResponse(
            systemPrompt, 
            userMessage, 
            MODEL_TEMPERATURE, 
            MODEL_MAX_TOKENS
        );
        
        const mancyResponseObject = await Promise.race([aiPromise, timeoutPromise]);
        
        // Limpieza de recursos
        if (typingInterval) clearInterval(typingInterval);
        clearTimeout(autoClearTimeout);
        
        await message.reply({
            content: mancyResponseObject.respuesta_discord,
            allowedMentions: { repliedUser: false }
        });

        console.log(`✅ Respuesta enviada para mensaje ID ${cacheKey}`);

    } catch (error) {
        // Limpieza de recursos en caso de fallo
        if (typingInterval) clearInterval(typingInterval);
        clearTimeout(autoClearTimeout);
        
        console.error(`❌ Error procesando mensaje ID ${cacheKey}:`, error.message);
        
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
    } finally {
        // 3. Liberación definitiva del bloqueo de la caché
        messageCache.delete(cacheKey); 
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
