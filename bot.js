import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import crypto from 'crypto';

// Importación crucial con la nueva ruta
import { MANCY_CONFIG, SYSTEM_CONSTANTS } from './src/config/constants.js'; 

dotenv.config();

// =================================================================
// ========== LOGGER ESTRUCTURADO ==========
// =================================================================

class StructuredLogger {
    static log(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...metadata
        };
        
        const formatted = `[${level.toUpperCase()}] ${timestamp} - ${message}`;
        
        switch (level) {
            case 'error':
                console.error(formatted, metadata);
                break;
            case 'warn':
                console.warn(formatted, metadata);
                break;
            case 'info':
                console.log(formatted);
                break;
            case 'debug':
                if (process.env.DEBUG_MODE === 'true') {
                    console.debug(formatted, metadata);
                }
                break;
        }
        
        // Aquí podrías agregar envío a un servicio de logging externo
        return logEntry;
    }
    
    static info(message, metadata = {}) {
        return this.log('info', message, metadata);
    }
    
    static error(message, metadata = {}) {
        return this.log('error', message, metadata);
    }
    
    static warn(message, metadata = {}) {
        return this.log('warn', message, metadata);
    }
    
    static debug(message, metadata = {}) {
        return this.log('debug', message, metadata);
    }
}

// =================================================================
// ========== CLASE PRINCIPAL DEL BOT ==========
// =================================================================

class GroqDiscordBot {
    constructor(config = {}) {
        // Configuración
        this.config = {
            groqApiKey: config.groqApiKey || process.env.GROQ_API_KEY,
            discordToken: config.discordToken || process.env.DISCORD_TOKEN,
            allowedChannels: process.env.ALLOWED_CHANNELS?.split(',') || [],
            debugMode: process.env.DEBUG_MODE === 'true',
            ...config
        };
        
        // Validar configuraciones críticas
        this.validateConfig();
        
        // Estado
        this.state = {
            active: false,
            startingUp: false,
            startAttempts: 0,
            reconnectDelay: 5000, // Backoff inicial
            lastStartTime: null
        };
        
        // Modelo
        this.modelConfig = {
            name: 'llama-3.1-8b-instant',
            displayName: 'Llama 3.1 8B Instant',
            contextWindow: 131072,
            temperature: 0.7,
            maxTokens: 1024,
            apiTimeout: 30000,
            processingTimeout: 25000
        };
        
        // Caches
        this.messageCache = new Map();
        this.responseCache = new Map();
        this.userRateLimit = new Map();
        
        // Constantes
        this.CACHE_DURATION = 5000;
        this.CACHE_TTL = 300000; // 5 minutos para cache de respuestas
        this.USER_RATE_LIMIT = {
            maxRequests: 5,
            windowMs: 60000
        };
        
        // Clientes
        this.discordClient = null;
        this.groqClient = null;
        
        // Inicializar logger
        this.logger = StructuredLogger;
        
        // Iniciar limpieza periódica
        this.startCleanupIntervals();
    }
    
    // =================================================================
    // ========== VALIDACIÓN Y CONFIGURACIÓN ==========
    // =================================================================
    
    validateConfig() {
        const errors = [];
        
        if (!this.config.groqApiKey) {
            errors.push("GROQ_API_KEY no está definida");
        }
        
        if (!this.config.discordToken) {
            errors.push("DISCORD_TOKEN no está definida");
        }
        
        if (errors.length > 0) {
            this.logger.error("Configuración inválida:", { errors });
            throw new Error(`Configuración inválida: ${errors.join(', ')}`);
        }
        
        this.logger.info("Configuración validada correctamente");
    }
    
    // =================================================================
    // ========== LIMPIEZA PERIÓDICA ==========
    // =================================================================
    
    startCleanupIntervals() {
        // Limpiar caché de mensajes cada minuto
        setInterval(() => this.cleanMessageCache(), 60000);
        
        // Limpiar caché de respuestas cada 5 minutos
        setInterval(() => this.cleanResponseCache(), 300000);
        
        // Limpiar rate limits cada 2 minutos
        setInterval(() => this.cleanRateLimits(), 120000);
        
        this.logger.debug("Intervalos de limpieza iniciados");
    }
    
    cleanMessageCache() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, timestamp] of this.messageCache.entries()) {
            if (now - timestamp > this.CACHE_DURATION) {
                this.messageCache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0 && this.config.debugMode) {
            this.logger.debug(`Limpieza de caché de mensajes: ${cleaned} entradas eliminadas`);
        }
    }
    
    cleanResponseCache() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, data] of this.responseCache.entries()) {
            if (now > data.expiresAt) {
                this.responseCache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0 && this.config.debugMode) {
            this.logger.debug(`Limpieza de caché de respuestas: ${cleaned} entradas eliminadas`);
        }
    }
    
    cleanRateLimits() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [userId, timestamps] of this.userRateLimit.entries()) {
            const recent = timestamps.filter(time => 
                now - time < this.USER_RATE_LIMIT.windowMs
            );
            
            if (recent.length === 0) {
                this.userRateLimit.delete(userId);
                cleaned++;
            } else {
                this.userRateLimit.set(userId, recent);
            }
        }
        
        if (cleaned > 0 && this.config.debugMode) {
            this.logger.debug(`Limpieza de rate limits: ${cleaned} usuarios eliminados`);
        }
    }
    
    // =================================================================
    // ========== UTILIDADES ==========
    // =================================================================
    
    sanitizeUserInput(input) {
        if (typeof input !== 'string') return '';
        
        return input
            .substring(0, 1000) // Limitar longitud
            .replace(/[<>]/g, '') // Prevenir HTML/XML injection
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Eliminar caracteres de control
            .trim();
    }
    
    hashPrompt(prompt) {
        return crypto
            .createHash('md5')
            .update(prompt)
            .digest('hex');
    }
    
    checkRateLimit(userId) {
        const now = Date.now();
        const userTimestamps = this.userRateLimit.get(userId) || [];
        
        // Filtrar timestamps fuera de la ventana
        const recentRequests = userTimestamps.filter(time => 
            now - time < this.USER_RATE_LIMIT.windowMs
        );
        
        // Verificar si excede el límite
        if (recentRequests.length >= this.USER_RATE_LIMIT.maxRequests) {
            const oldest = recentRequests[0];
            const waitTime = Math.ceil((this.USER_RATE_LIMIT.windowMs - (now - oldest)) / 1000);
            return {
                allowed: false,
                waitTime,
                message: `Rate limit excedido. Espera ${waitTime} segundos.`
            };
        }
        
        // Agregar nueva solicitud
        recentRequests.push(now);
        this.userRateLimit.set(userId, recentRequests);
        
        return { allowed: true };
    }
    
    // =================================================================
    // ========== MANEJO DE JSON ==========
    // =================================================================
    
    extractJSONFromText(text) {
        if (!text) return null;
        
        // 1. Limpieza de markdown común y bloques de código
        let cleanedText = text
            .replace(/```json\s*/g, '')
            .replace(/```\s*$/g, '')
            .replace(/\s*(\{[\s\S]*\})\s*/, '$1')
            .trim();
        
        // 2. Intentar parsear el texto limpio
        try {
            return JSON.parse(cleanedText);
        } catch (e) {
            // 3. Buscar objeto JSON con regex
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e) {
                    this.logger.debug("Falló parseo de JSON con regex:", { error: e.message });
                }
            }
        }
        return null;
    }
    
    validateResponseStructure(response) {
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
    // ========== LLAMADA A GROQ ==========
    // =================================================================
    
    async getGroqResponse(systemPrompt, userPrompt, temperature = null, maxTokens = null) {
        // Verificar cache primero
        const cacheKey = this.hashPrompt(`${systemPrompt}${userPrompt}`);
        const cached = this.responseCache.get(cacheKey);
        
        if (cached && Date.now() < cached.expiresAt) {
            this.logger.info("Respuesta obtenida de caché");
            return cached.response;
        }
        
        const jsonSchema = MANCY_CONFIG.OUTPUT_SCHEMA;
        
        // System prompt optimizado
        const groqSystemPrompt = `${systemPrompt}\n\n
IMPORTANTE: Eres el modelo ${this.modelConfig.displayName}. 
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
            this.logger.info(`Usando modelo: ${this.modelConfig.displayName}`, {
                temperature: temperature || this.modelConfig.temperature,
                maxTokens: maxTokens || this.modelConfig.maxTokens
            });
            
            // Timeout para la llamada a la API
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout de API excedido (${this.modelConfig.apiTimeout / 1000}s)`)), 
                this.modelConfig.apiTimeout)
            );
            
            if (!this.groqClient) {
                this.groqClient = new Groq({ apiKey: this.config.groqApiKey });
            }
            
            const apiPromise = this.groqClient.chat.completions.create({
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
                model: this.modelConfig.name,
                temperature: temperature || this.modelConfig.temperature,
                max_tokens: maxTokens || this.modelConfig.maxTokens,
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
                this.logger.error("Contenido vacío recibido de Groq");
                return MANCY_CONFIG.FALLBACK_RESPONSE;
            }
            
            // Intentar extraer y validar JSON
            const parsedResponse = this.extractJSONFromText(rawContent);
            
            if (!parsedResponse) {
                this.logger.error("No se pudo extraer JSON válido.");
                return {
                    ...MANCY_CONFIG.FALLBACK_RESPONSE,
                    respuesta_discord: "⚠️ Error interno: El modelo no devolvió un JSON válido. Intenta de nuevo."
                };
            }
            
            // Validar estructura
            if (!this.validateResponseStructure(parsedResponse)) {
                this.logger.error("Estructura JSON inválida.");
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
            
            // Guardar en caché
            this.responseCache.set(cacheKey, {
                response: parsedResponse,
                expiresAt: Date.now() + this.CACHE_TTL
            });
            
            this.logger.info("Respuesta procesada correctamente");
            return parsedResponse;
            
        } catch (error) {
            this.logger.error("Error en getGroqResponse:", {
                error: error.message,
                userPrompt: userPrompt.substring(0, 100)
            });
            
            let userErrorMessage = "Lo siento, tengo un error desconocido. Inténtalo de nuevo.";
            
            if (error.message.includes("Timeout")) {
                userErrorMessage = "El servicio de IA tardó demasiado en responder. ¿Puedes reformular la pregunta?";
            } else if (error.message.includes("Respuesta de API vacía")) {
                userErrorMessage = "El modelo no generó contenido. Intenta con un prompt diferente.";
            } else if (error.message.includes("API key")) {
                userErrorMessage = "Error de configuración del servicio de IA.";
            }
            
            return {
                ...MANCY_CONFIG.FALLBACK_RESPONSE,
                respuesta_discord: userErrorMessage
            };
        }
    }
    
    // =================================================================
    // ========== MANEJO DE DISCORD ==========
    // =================================================================
    
    async handleDiscordMessage(message) {
        // Validaciones básicas
        if (message.author.bot) return;
        
        const isDirectMessage = message.channel.type === 1; 
        const isMention = message.mentions.users.has(this.discordClient.user.id);
        
        // Verificar si está en canales permitidos (si no es DM)
        if (!isDirectMessage && !isMention) {
            if (this.config.allowedChannels.length > 0 && 
                !this.config.allowedChannels.includes(message.channel.id)) {
                return;
            }
        }
        
        // Extraer mensaje del usuario
        let userMessage = message.content.replace(new RegExp(`<@!?${this.discordClient.user.id}>`), '').trim();
        if (!userMessage) {
            if (isMention || isDirectMessage) {
                await message.reply("¿Sí? ¿En qué puedo ayudarte?");
            }
            return;
        }
        
        // Sanitizar entrada
        userMessage = this.sanitizeUserInput(userMessage);
        
        // Verificar rate limit
        const rateLimitCheck = this.checkRateLimit(message.author.id);
        if (!rateLimitCheck.allowed) {
            await message.reply(rateLimitCheck.message);
            return;
        }
        
        // ** SOLUCIÓN DE DUPLICADOS **
        const cacheKey = message.id;
        
        // 1. Detección de duplicados
        if (this.messageCache.has(cacheKey)) {
            this.logger.warn(`Mensaje duplicado ignorado`, { messageId: cacheKey });
            return;
        }
        
        // 2. Bloqueo de procesamiento
        this.messageCache.set(cacheKey, Date.now());
        
        // Limpieza automática en caso de fallo
        const autoClearTimeout = setTimeout(() => {
            if (this.messageCache.has(cacheKey)) {
                this.messageCache.delete(cacheKey);
                this.logger.debug(`Bloqueo de mensaje expirado`, { messageId: cacheKey });
            }
        }, this.CACHE_DURATION);
        
        let typingInterval = null;
        
        try {
            // Configurar typing indicator
            await message.channel.sendTyping();
            typingInterval = this.setupTypingIndicator(message);
            
            this.logger.info(`Procesando mensaje`, {
                messageId: cacheKey,
                user: message.author.tag,
                channel: isDirectMessage ? 'DM' : message.channel.name
            });
            
            // Timeout para procesamiento completo
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout procesando después de ${this.modelConfig.processingTimeout / 1000}s`)), 
                this.modelConfig.processingTimeout)
            );
            
            const aiPromise = this.getGroqResponse(
                MANCY_CONFIG.IDENTITY, 
                userMessage, 
                this.modelConfig.temperature, 
                this.modelConfig.maxTokens
            );
            
            const mancyResponseObject = await Promise.race([aiPromise, timeoutPromise]);
            
            // Limpieza de recursos
            this.cleanupProcessingResources(typingInterval, autoClearTimeout);
            
            // Enviar respuesta
            await message.reply({
                content: mancyResponseObject.respuesta_discord,
                allowedMentions: { repliedUser: false }
            });
            
            this.logger.info(`Respuesta enviada`, { 
                messageId: cacheKey,
                responseLength: mancyResponseObject.respuesta_discord.length 
            });
            
        } catch (error) {
            // Limpieza de recursos en caso de fallo
            this.cleanupProcessingResources(typingInterval, autoClearTimeout);
            
            this.logger.error(`Error procesando mensaje`, {
                messageId: cacheKey,
                error: error.message,
                stack: error.stack
            });
            
            await this.sendErrorMessage(message, error);
            
        } finally {
            // 3. Liberación definitiva del bloqueo
            this.messageCache.delete(cacheKey);
        }
    }
    
    setupTypingIndicator(message) {
        return setInterval(() => {
            message.channel.sendTyping().catch(e => {
                this.logger.debug("Error en typing indicator:", { error: e.message });
                if (this.typingInterval) {
                    clearInterval(this.typingInterval);
                    this.typingInterval = null;
                }
            });
        }, 7000);
    }
    
    cleanupProcessingResources(typingInterval, timeout) {
        if (typingInterval) clearInterval(typingInterval);
        if (timeout) clearTimeout(timeout);
    }
    
    async sendErrorMessage(message, error) {
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
            this.logger.error("Error al enviar mensaje de error:", {
                originalError: error.message,
                replyError: replyError.message
            });
        }
    }
    
    // =================================================================
    // ========== INICIO Y CONEXIÓN ==========
    // =================================================================
    
    async initializeAndStartBot() {
        if (this.state.startingUp) {
            this.logger.warn("Ya hay un inicio en proceso");
            return;
        }
        
        // Destruir cliente existente
        if (this.discordClient) {
            this.discordClient.destroy();
            this.discordClient = null;
            this.state.active = false;
        }
        
        // Crear nuevo cliente
        this.discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds, 
                GatewayIntentBits.GuildMessages, 
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ]
        });
        
        this.logger.info(`Iniciando bot con modelo: ${this.modelConfig.displayName}`);
        
        await this.startDiscordBot();
    }
    
    async startDiscordBot() {
        if (this.state.startAttempts >= SYSTEM_CONSTANTS.MAX_START_ATTEMPTS) {
            this.logger.error("Máximo de intentos de inicio alcanzado. Abortando.");
            this.state.startingUp = false;
            return;
        }
        
        this.state.startingUp = true;
        this.state.startAttempts++;
        this.state.lastStartTime = Date.now();
        
        try {
            // Configurar eventos
            this.setupDiscordEvents();
            
            // Iniciar sesión
            await this.discordClient.login(this.config.discordToken);
            
            this.logger.info("Bot de Discord iniciado exitosamente");
            
        } catch (error) {
            this.logger.error(`Intento ${this.state.startAttempts} fallido al iniciar sesión`, {
                error: error.message,
                nextAttemptIn: `${this.state.reconnectDelay / 1000}s`
            });
            
            this.state.startingUp = false;
            
            // Backoff exponencial
            setTimeout(() => {
                this.state.reconnectDelay = Math.min(this.state.reconnectDelay * 2, 60000);
                this.startDiscordBot();
            }, this.state.reconnectDelay);
        }
    }
    
    setupDiscordEvents() {
        // Evento ready
        this.discordClient.once('ready', () => {
            this.logger.info(`Bot conectado como ${this.discordClient.user.tag}`, {
                guilds: this.discordClient.guilds.cache.size,
                model: this.modelConfig.displayName
            });
            
            this.state.active = true;
            this.state.startingUp = false;
            this.state.startAttempts = 0;
            this.state.reconnectDelay = 5000; // Resetear backoff
        });
        
        // Manejo de errores
        this.discordClient.on('error', (error) => {
            this.logger.error("Error en cliente de Discord:", { error: error.message });
            
            if (this.state.active) {
                this.state.active = false;
                setTimeout(() => this.initializeAndStartBot(), 10000);
            }
        });
        
        // Reconexión
        this.discordClient.on('disconnect', () => {
            this.logger.warn("Bot desconectado, intentando reconectar...");
            this.state.active = false;
            setTimeout(() => this.initializeAndStartBot(), 5000);
        });
        
        // Mensajes
        this.discordClient.on('messageCreate', (message) => {
            this.handleDiscordMessage(message).catch(error => {
                this.logger.error("Error no manejado en handleDiscordMessage:", {
                    error: error.message,
                    stack: error.stack
                });
            });
        });
    }
    
    // =================================================================
    // ========== API PÚBLICA ==========
    // =================================================================
    
    getBotStatus() {
        return {
            bot_active: this.state.active,
            starting_up: this.state.startingUp,
            model: this.modelConfig,
            version: MANCY_CONFIG.VERSION,
            uptime: this.state.active ? process.uptime() : 0,
            guilds: this.discordClient?.guilds?.cache?.size || 0,
            cache_sizes: {
                message_cache: this.messageCache.size,
                response_cache: this.responseCache.size,
                rate_limit_users: this.userRateLimit.size
            },
            start_attempts: this.state.startAttempts,
            reconnect_delay: this.state.reconnectDelay
        };
    }
    
    forceRestartBot() {
        this.logger.info("Reinicio forzado solicitado");
        this.state.startAttempts = 0;
        this.state.reconnectDelay = 5000;
        this.initializeAndStartBot();
    }
    
    async shutdown() {
        this.logger.info("Apagando bot...");
        
        this.state.active = false;
        this.state.startingUp = false;
        
        if (this.discordClient) {
            this.discordClient.destroy();
            this.discordClient = null;
        }
        
        // Limpiar caches
        this.messageCache.clear();
        this.responseCache.clear();
        this.userRateLimit.clear();
        
        this.logger.info("Bot apagado correctamente");
    }
}

// =================================================================
// ========== INSTANCIA GLOBAL Y EXPORTACIONES ==========
// =================================================================

// Crear instancia única (Singleton pattern)
let botInstance = null;

export function getBotInstance(config = {}) {
    if (!botInstance) {
        botInstance = new GroqDiscordBot(config);
    }
    return botInstance;
}

export function initializeAndStartBot() {
    const bot = getBotInstance();
    return bot.initializeAndStartBot();
}

export function getBotStatus() {
    const bot = getBotInstance();
    return bot.getBotStatus();
}

export function forceRestartBot() {
    const bot = getBotInstance();
    return bot.forceRestartBot();
}

export async function shutdownBot() {
    const bot = getBotInstance();
    await bot.shutdown();
    botInstance = null;
}

// Variables de estado (para compatibilidad)
export let botActive = false;
export let isStartingUp = false;

// Actualizar variables de estado cuando cambien
setInterval(() => {
    const bot = getBotInstance();
    if (bot) {
        botActive = bot.state.active;
        isStartingUp = bot.state.startingUp;
    }
}, 1000);

// Inicio automático si se ejecuta directamente
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeAndStartBot();
    
    // Manejo de señales para apagado elegante
    process.on('SIGINT', async () => {
        console.log('\nRecibido SIGINT. Apagando...');
        await shutdownBot();
        process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
        console.log('\nRecibido SIGTERM. Apagando...');
        await shutdownBot();
        process.exit(0);
    });
}
