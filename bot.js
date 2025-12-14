import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Importación crucial con la nueva ruta
import { MANCY_CONFIG, SYSTEM_CONSTANTS } from './src/config/constants.js'; 

// Para __dirname en ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// =================================================================
// ========== SISTEMA DE MEMORIA ==========
// =================================================================

class ConversationalMemory {
    constructor(userId) {
        this.userId = userId;
        this.shortTermMemory = []; // Últimos mensajes
        this.longTermMemory = []; // Resúmenes y patrones
        this.conversationSummary = '';
        this.currentTopic = '';
        this.userPreferences = {};
        this.conversationStartTime = Date.now();
        this.messageCount = 0;
        
        // Configuración
        this.MAX_SHORT_TERM = 10; // Últimos 10 mensajes
        this.MAX_CONTEXT_LENGTH = 4000; // Tokens aproximados
        this.SUMMARY_THRESHOLD = 20; // Resumir cada 20 mensajes
    }
    
    // Agregar mensaje a la memoria
    addMessage(role, content, metadata = {}) {
        const message = {
            role, // 'user' o 'assistant'
            content,
            timestamp: Date.now(),
            ...metadata
        };
        
        // Agregar a memoria de corto plazo
        this.shortTermMemory.push(message);
        
        // Mantener tamaño limitado
        if (this.shortTermMemory.length > this.MAX_SHORT_TERM) {
            this.shortTermMemory.shift();
        }
        
        this.messageCount++;

        // Actualizar tema actual basado en el contenido
        this.updateCurrentTopic(content);
        
        // Verificar si necesitamos crear un resumen
        if (this.messageCount % this.SUMMARY_THRESHOLD === 0) {
            this.createSummary();
        }
        
        return message;
    }
    
    // Actualizar tema de conversación
    updateCurrentTopic(content) {
        // Extraer palabras clave (simplificado)
        const keywords = this.extractKeywords(content);
        if (keywords.length > 0) {
            this.currentTopic = keywords.slice(0, 3).join(', ');
        }
    }
    
    extractKeywords(text) {
        // Palabras comunes a ignorar
        const stopWords = new Set([
            'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
            'de', 'del', 'al', 'y', 'o', 'pero', 'por', 'para',
            'con', 'sin', 'sobre', 'entre', 'hacia', 'desde',
            'que', 'qué', 'cómo', 'cuándo', 'dónde', 'por qué',
            'yo', 'tú', 'él', 'ella', 'nosotros', 'vosotros', 'ellos',
            'mi', 'tu', 'su', 'nuestro', 'vuestro', 'su',
            'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas'
        ]);
        
        const words = text.toLowerCase()
            .replace(/[^\w\sáéíóúüñ]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3 && !stopWords.has(word));
        
        // Contar frecuencia
        const frequency = {};
        words.forEach(word => {
            frequency[word] = (frequency[word] || 0) + 1;
        });
        
        // Ordenar por frecuencia
        return Object.entries(frequency)
            .sort((a, b) => b[1] - a[1])
            .map(([word]) => word);
    }
    
    // Crear resumen de la conversación
    async createSummary() {
        if (this.shortTermMemory.length === 0) return;
        
        const conversationText = this.shortTermMemory
            .map(msg => `${msg.role}: ${msg.content}`)
            .join('\n');
        
        // Resumen simple (en una implementación real, usaríamos IA)
        const summary = `Resumen de conversación con usuario ${this.userId}:
        - Tema principal: ${this.currentTopic || 'varios temas'}
        - Mensajes procesados: ${this.messageCount}
        - Última interacción: ${new Date().toLocaleString()}
        - Puntos clave discutidos: ${this.extractKeywords(conversationText).slice(0, 5).join(', ')}`;
        
        this.longTermMemory.push({
            type: 'summary',
            content: summary,
            timestamp: Date.now(),
            messageCount: this.messageCount
        });
        
        this.conversationSummary = summary;
        
        // Guardar en disco periódicamente
        await this.saveToDisk();
        
        return summary;
    }
    
    // Obtener contexto para el prompt
    getContext() {
        const context = {
            shortTerm: this.shortTermMemory.slice(-5), // Últimos 5 mensajes
            currentTopic: this.currentTopic,
            conversationSummary: this.conversationSummary,
            userPreferences: this.userPreferences,
            messageCount: this.messageCount
        };
        
        // Formatear para el prompt
        let contextText = '';
        
        if (this.conversationSummary) {
            contextText += `RESUMEN DE CONVERSACIÓN ANTERIOR:\n${this.conversationSummary}\n\n`;
        }
        
        if (this.currentTopic) {
            contextText += `TEMA ACTUAL DE CONVERSACIÓN: ${this.currentTopic}\n\n`;
        }
        
        if (this.shortTermMemory.length > 0) {
            contextText += 'CONTEXTO INMEDIATO:\n';
            this.shortTermMemory.slice(-3).forEach(msg => {
                contextText += `${msg.role.toUpperCase()}: ${msg.content}\n`;
            });
        }
        
        return contextText;
    }
    
    // Aprender preferencias del usuario
    learnPreference(key, value) {
        this.userPreferences[key] = value;
        this.longTermMemory.push({
            type: 'preference',
            key,
            value,
            timestamp: Date.now()
        });
    }
    
    // Guardar memoria en disco
    async saveToDisk() {
        try {
            const memoryDir = path.join(__dirname, 'memory');
            await fs.mkdir(memoryDir, { recursive: true });
            
            const memoryFile = path.join(memoryDir, `user_${this.userId}.json`);
            const memoryData = {
                userId: this.userId,
                longTermMemory: this.longTermMemory,
                conversationSummary: this.conversationSummary,
                userPreferences: this.userPreferences,
                lastUpdated: Date.now()
            };
            
            await fs.writeFile(memoryFile, JSON.stringify(memoryData, null, 2));
            
        } catch (error) {
            console.error('Error guardando memoria:', error);
        }
    }
    
    // Cargar memoria desde disco
    async loadFromDisk() {
        try {
            const memoryFile = path.join(__dirname, 'memory', `user_${this.userId}.json`);
            const data = await fs.readFile(memoryFile, 'utf-8');
            const memoryData = JSON.parse(data);
            
            this.longTermMemory = memoryData.longTermMemory || [];
            this.conversationSummary = memoryData.conversationSummary || '';
            this.userPreferences = memoryData.userPreferences || {};
            
            return true;
        } catch (error) {
            // Archivo no existe o error de lectura
            return false;
        }
    }
    
    // Reiniciar memoria (para nueva conversación)
    reset() {
        // Guardar resumen actual antes de resetear
        if (this.shortTermMemory.length > 0) {
            this.createSummary();
        }
        
        this.shortTermMemory = [];
        this.currentTopic = '';
        this.messageCount = 0;
        this.conversationStartTime = Date.now();
    }
    
    // Obtener estadísticas
    getStats() {
        return {
            userId: this.userId,
            shortTermMessages: this.shortTermMemory.length,
            longTermEntries: this.longTermMemory.length,
            currentTopic: this.currentTopic,
            messageCount: this.messageCount,
            conversationDuration: Date.now() - this.conversationStartTime,
            preferences: Object.keys(this.userPreferences).length
        };
    }
}

// =================================================================
// ========== GESTOR DE MEMORIA ==========
// =================================================================

class MemoryManager {
    constructor() {
        this.userMemories = new Map(); // userId -> ConversationalMemory
        this.conversationThreads = new Map(); // threadId -> { users: [], topic: '', messages: [] }
        this.globalPatterns = new Map(); // patrones de conversación comunes
    }
    
    // Obtener o crear memoria para un usuario
    getUserMemory(userId) {
        if (!this.userMemories.has(userId)) {
            const memory = new ConversationalMemory(userId);
            this.userMemories.set(userId, memory);
            
            // Intentar cargar memoria previa
            memory.loadFromDisk().then(loaded => {
                if (loaded) {
                    console.log(`Memoria cargada para usuario ${userId}`);
                }
            });
        }
        return this.userMemories.get(userId);
    }
    
    // Procesar y aprender de la interacción
    async processInteraction(userId, userMessage, botResponse) {
        const memory = this.getUserMemory(userId);
        
        // Agregar mensajes a la memoria
        memory.addMessage('user', userMessage);
        memory.addMessage('assistant', botResponse);
        
        // Analizar para aprendizaje
        this.analyzeForLearning(userId, userMessage, botResponse);
        
        // Guardar periódicamente
        if (memory.messageCount % 10 === 0) {
            await memory.saveToDisk();
        }
        
        return memory;
    }
    
    // Analizar interacción para aprendizaje
    analyzeForLearning(userId, userMessage, botResponse) {
        const memory = this.getUserMemory(userId);
        
        // Detectar preguntas frecuentes
        if (userMessage.includes('?')) {
            const questionType = this.categorizeQuestion(userMessage);
            // Podríamos aprender qué tipos de pregunta hace este usuario
        }
        
        // Detectar preferencias (ej: "me gusta X", "prefiero Y")
        const preferencePatterns = [
            { pattern: /me gusta (?:el|la|los|las)?\s*([a-zA-Záéíóúüñ\s]+)/i, key: 'likes' },
            { pattern: /(?:odio|no me gusta) (?:el|la|los|las)?\s*([a-zA-Záéíóúüñ\s]+)/i, key: 'dislikes' },
            { pattern: /prefiero ([a-zA-Záéíóúüñ\s]+) (?:en lugar de|que) ([a-zA-Záéíóúüñ\s]+)/i, key: 'preferences' }
        ];
        
        for (const { pattern, key } of preferencePatterns) {
            const match = userMessage.match(pattern);
            if (match) {
                memory.learnPreference(key, match[1].trim());
                console.log(`Preferencia aprendida para ${userId}: ${key} = ${match[1].trim()}`);
            }
        }
    }
    
    categorizarPregunta(message) {
        const patterns = {
            factual: /(qué es|qué son|quién es|cuándo|dónde)/i,
            opinion: /(qué piensas|opinión|crees que)/i,
            howto: /(cómo|de qué manera|pasos para)/i,
            why: /(por qué|razón|causa)/i
        };
        
        for (const [type, pattern] of Object.entries(patterns)) {
            if (pattern.test(message)) {
                return type;
            }
        }
        return 'general';
    }
    
    // Obtener contexto enriquecido para el prompt
    getEnhancedContext(userId, currentMessage) {
        const memory = this.getUserMemory(userId);
        const baseContext = memory.getContext();
        
        // Agregar preferencias del usuario si existen
        let enhancedContext = baseContext;
        
        if (Object.keys(memory.userPreferences).length > 0) {
            enhancedContext += '\nPREFERENCIAS DEL USUARIO:\n';
            Object.entries(memory.userPreferences).forEach(([key, value]) => {
                enhancedContext += `- ${key}: ${value}\n`;
            });
        }
        
        // Sugerir continuación basada en el historial
        if (memory.shortTermMemory.length > 1) {
            const lastTopic = memory.currentTopic;
            if (lastTopic) {
                enhancedContext += `\nCONTINUACIÓN NATURAL: El usuario estaba hablando sobre "${lastTopic}".`;
            }
        }
        
        return enhancedContext;
    }
    
    // Reiniciar memoria para un usuario
    resetUserMemory(userId) {
        const memory = this.userMemories.get(userId);
        if (memory) {
            memory.reset();
            console.log(`Memoria reiniciada para usuario ${userId}`);
        }
    }
    
    // Obtener estadísticas
    getStats() {
        return {
            totalUsers: this.userMemories.size,
            activeMemories: Array.from(this.userMemories.values())
                .filter(m => m.messageCount > 0).length,
            totalInteractions: Array.from(this.userMemories.values())
                .reduce((sum, m) => sum + m.messageCount, 0)
        };
    }
}

// =================================================================
// ========== LOGGER SIMPLIFICADO ==========
// =================================================================

const Logger = {
    log(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const formatted = `[${level.toUpperCase()}] ${timestamp} - ${message}`;
        
        if (metadata && Object.keys(metadata).length > 0) {
            switch (level) {
                case 'error':
                    console.error(formatted, metadata);
                    break;
                case 'warn':
                    console.warn(formatted, metadata);
                    break;
                case 'info':
                    console.log(formatted, metadata);
                    break;
                case 'debug':
                    if (process.env.DEBUG_MODE === 'true') {
                        console.debug(formatted, metadata);
                    }
                    break;
                default:
                    console.log(formatted, metadata);
            }
        } else {
            switch (level) {
                case 'error':
                    console.error(formatted);
                    break;
                case 'warn':
                    console.warn(formatted);
                    break;
                case 'info':
                    console.log(formatted);
                    break;
                case 'debug':
                    if (process.env.DEBUG_MODE === 'true') {
                        console.debug(formatted);
                    }
                    break;
                default:
                    console.log(formatted);
            }
        }
        
        return { timestamp, level, message, metadata };
    },
    
    info(message, metadata = {}) {
        return this.log('info', message, metadata);
    },
    
    error(message, metadata = {}) {
        return this.log('error', message, metadata);
    },
    
    warn(message, metadata = {}) {
        return this.log('warn', message, metadata);
    },
    
    debug(message, metadata = {}) {
        return this.log('debug', message, metadata);
    }
};

// =================================================================
// ========== CLASE PRINCIPAL DEL BOT CON MEMORIA ==========
// =================================================================

class GroqDiscordBot {
    constructor(config = {}) {
        // Configuración
        this.config = {
            groqApiKey: config.groqApiKey || process.env.GROQ_API_KEY,
            discordToken: config.discordToken || process.env.DISCORD_TOKEN,
            allowedChannels: process.env.ALLOWED_CHANNELS ? process.env.ALLOWED_CHANNELS.split(',') : [],
            debugMode: process.env.DEBUG_MODE === 'true',
            enableMemory: process.env.ENABLE_MEMORY !== 'false', // Por defecto true
            ...config
        };
        
        // Validar configuraciones críticas
        this.validateConfig();
        
        // Estado
        this.state = {
            active: false,
            startingUp: false,
            startAttempts: 0,
            reconnectDelay: 5000,
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
        
        // Sistema de memoria
        this.memoryManager = new MemoryManager();
        
        // Caches
        this.messageCache = new Map();
        this.responseCache = new Map();
        this.userRateLimit = new Map();
        
        // Constantes
        this.CACHE_DURATION = 5000;
        this.CACHE_TTL = 300000;
        this.USER_RATE_LIMIT = {
            maxRequests: 10, // Aumentado porque ahora tiene contexto
            windowMs: 60000
        };
        
        // Clientes
        this.discordClient = null;
        this.groqClient = null;
        
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
            Logger.error("Configuración inválida:", { errors });
            throw new Error(`Configuración inválida: ${errors.join(', ')}`);
        }
        
        Logger.info("Configuración validada correctamente");
        Logger.info(`Memoria conversacional: ${this.config.enableMemory ? 'ACTIVADA' : 'DESACTIVADA'}`);
    }
    
    // =================================================================
    // ========== SISTEMA DE MEMORIA MEJORADO ==========
    // =================================================================
    
    async createContextAwarePrompt(userId, userMessage) {
        if (!this.config.enableMemory) {
            return userMessage;
        }
        
        try {
            // Obtener contexto enriquecido de la memoria
            const context = this.memoryManager.getEnhancedContext(userId, userMessage);
            
            // Crear prompt con contexto
            let prompt = '';
            
            if (context.trim().length > 0) {
                prompt += `CONTEXTO DE LA CONVERSACIÓN:\n${context}\n\n`;
                prompt += `INSTRUCCIÓN: Considera el contexto anterior para responder de manera coherente.\n\n`;
            }
            
            prompt += `MENSAJE ACTUAL DEL USUARIO: ${userMessage}`;
            
            // Si es un saludo o mensaje corto, no cargar demasiado contexto
            if (userMessage.length < 20 && 
                (userMessage.toLowerCase().includes('hola') || 
                 userMessage.toLowerCase().includes('hi') ||
                 userMessage.toLowerCase().includes('buenos'))) {
                // Para saludos, usar contexto mínimo
                return userMessage;
            }
            
            return prompt;
            
        } catch (error) {
            Logger.error("Error creando prompt con contexto:", { error: error.message });
            return userMessage;
        }
    }
    
    // =================================================================
    // ========== LLAMADA A GROQ CON MEMORIA ==========
    // =================================================================
    
    async getGroqResponseWithMemory(userId, systemPrompt, userPrompt, temperature = null, maxTokens = null) {
        // Verificar cache primero (basado en prompt + contexto del usuario)
        const memoryContext = this.config.enableMemory ? 
            this.memoryManager.getUserMemory(userId).getContext() : '';
        const cacheKey = this.hashPrompt(`${systemPrompt}${userPrompt}${memoryContext}`);
        const cached = this.responseCache.get(cacheKey);
        
        if (cached && Date.now() < cached.expiresAt) {
            Logger.info("Respuesta obtenida de caché con contexto");
            return cached.response;
        }
        
        // Crear system prompt mejorado con instrucciones de memoria
        const enhancedSystemPrompt = this.config.enableMemory ? 
            this.createMemoryEnhancedSystemPrompt(systemPrompt) : systemPrompt;
        
        // Crear user prompt con contexto
        const contextualUserPrompt = this.config.enableMemory ?
            await this.createContextAwarePrompt(userId, userPrompt) : userPrompt;
        
        const jsonSchema = MANCY_CONFIG.OUTPUT_SCHEMA;
        
        // System prompt final
        const groqSystemPrompt = `${enhancedSystemPrompt}\n\n
IMPORTANTE: Eres el modelo ${this.modelConfig.displayName}. 
${this.config.enableMemory ? 'TIENES MEMORIA DE CONVERSACIÓN ACTIVADA.' : ''}
Debes responder ÚNICAMENTE con un objeto JSON válido.

REGLAS ESTRICTAS:
1. NO incluyas ningún texto fuera del JSON (ni explicaciones, ni comentarios).
2. NO uses markdown, code blocks o comillas triples fuera del JSON.
3. El JSON DEBE seguir exactamente este esquema:
${JSON.stringify(jsonSchema, null, 2)}

${this.config.enableMemory ? '4. Considera el contexto de conversación proporcionado para ser coherente.\n' : ''}
EJEMPLO DE RESPUESTA CORRECTA:
${JSON.stringify(MANCY_CONFIG.FALLBACK_RESPONSE, null, 2)}

Tu respuesta debe comenzar con { y terminar con }.
No expliques, no comentes, solo JSON.`;
        
        try {
            Logger.info(`Procesando con memoria: ${this.config.enableMemory}`, {
                userId,
                hasContext: contextualUserPrompt !== userPrompt
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
                        content: contextualUserPrompt 
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
                Logger.error("Contenido vacío recibido de Groq");
                return MANCY_CONFIG.FALLBACK_RESPONSE;
            }
            
            // Intentar extraer y validar JSON
            const parsedResponse = this.extractJSONFromText(rawContent);
            
            if (!parsedResponse) {
                Logger.error("No se pudo extraer JSON válido.");
                return {
                    ...MANCY_CONFIG.FALLBACK_RESPONSE,
                    respuesta_discord: "⚠️ Error interno: El modelo no devolvió un JSON válido. Intenta de nuevo."
                };
            }
            
            // Validar estructura
            if (!this.validateResponseStructure(parsedResponse)) {
                Logger.error("Estructura JSON inválida.");
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
            
            // Aprender de la interacción si la memoria está activada
            if (this.config.enableMemory) {
                await this.memoryManager.processInteraction(
                    userId, 
                    userPrompt, 
                    parsedResponse.respuesta_discord
                );
                
                Logger.debug("Interacción procesada en memoria", {
                    userId,
                    memoryStats: this.memoryManager.getUserMemory(userId).getStats()
                });
            }
            
            Logger.info("Respuesta procesada correctamente" + 
                (this.config.enableMemory ? " con memoria" : ""));
            return parsedResponse;
            
        } catch (error) {
            Logger.error("Error en getGroqResponseWithMemory:", {
                error: error.message,
                userId,
                userPrompt: userPrompt.substring(0, 100)
            });
            
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
    
    createMemoryEnhancedSystemPrompt(baseSystemPrompt) {
        return `${baseSystemPrompt}

CARACTERÍSTICAS DE MEMORIA:
1. Tienes capacidad de recordar conversaciones anteriores con cada usuario.
2. Puedes hacer referencia a temas discutidos previamente.
3. Mantienes coherencia en la personalidad y respuestas.
4. Aprendes las preferencias de cada usuario con el tiempo.

INSTRUCCIONES DE CONTEXTO:
- Si el usuario hace referencia a algo discutido antes, reconócelo.
- Mantén un hilo coherente en conversaciones largas.
- Adapta tu tono basado en las interacciones previas.
- Usa información de contexto cuando sea relevante para mejorar la respuesta.`;
    }
    
    // =================================================================
    // ========== MÉTODOS AUXILIARES (sin cambios mayores) ==========
    // =================================================================
    
    sanitizeUserInput(input) {
        if (typeof input !== 'string') return '';
        
        return input
            .substring(0, 1000)
            .replace(/[<>]/g, '')
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
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
        
        const recentRequests = userTimestamps.filter(time => 
            now - time < this.USER_RATE_LIMIT.windowMs
        );
        
        if (recentRequests.length >= this.USER_RATE_LIMIT.maxRequests) {
            const oldest = recentRequests[0];
            const waitTime = Math.ceil((this.USER_RATE_LIMIT.windowMs - (now - oldest)) / 1000);
            return {
                allowed: false,
                waitTime,
                message: `Rate limit excedido. Espera ${waitTime} segundos.`
            };
        }
        
        recentRequests.push(now);
        this.userRateLimit.set(userId, recentRequests);
        
        return { allowed: true };
    }
    
    extractJSONFromText(text) {
        if (!text) return null;
        
        let cleanedText = text
            .replace(/```json\s*/g, '')
            .replace(/```\s*$/g, '')
            .replace(/\s*(\{[\s\S]*\})\s*/, '$1')
            .trim();
        
        try {
            return JSON.parse(cleanedText);
        } catch (e) {
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    return JSON.parse(jsonMatch[0]);
                } catch (e) {
                    Logger.debug("Falló parseo de JSON con regex:", { error: e.message });
                }
            }
        }
        return null;
    }
    
    validateResponseStructure(response) {
        if (!response || typeof response !== 'object') {
            return false;
        }
        
        if (!response.respuesta_discord || typeof response.respuesta_discord !== 'string') {
            return false;
        }
        
        if (response.respuesta_discord.length > 2000) {
            response.respuesta_discord = response.respuesta_discord.substring(0, 1997) + "...";
        }
        
        return true;
    }
    
    // =================================================================
    // ========== MANEJO DE DISCORD CON MEMORIA ==========
    // =================================================================
    
    async handleDiscordMessage(message) {
        if (message.author.bot) return;
        
        const isDirectMessage = message.channel.type === 1; 
        const isMention = message.mentions.users.has(this.discordClient.user.id);
        
        // **CORRECCIÓN: El bot solo debe responder cuando:**
        // 1. Es un mensaje directo (DM)
        // 2. Es mencionado explícitamente
        // 3. El mensaje está en un canal permitido configurado específicamente
        
        let shouldRespond = false;
        
        if (isDirectMessage) {
            // Siempre responder en mensajes directos
            shouldRespond = true;
        } else if (isMention) {
            // Si es mencionado, verificar si está en un canal permitido
            if (this.config.allowedChannels.length > 0) {
                if (this.config.allowedChannels.includes(message.channel.id)) {
                    shouldRespond = true;
                }
            } else {
                // Si no hay canales específicos configurados, responder a menciones en cualquier canal
                shouldRespond = true;
            }
        }
        
        if (!shouldRespond) {
            return;
        }
        
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
        
        if (this.messageCache.has(cacheKey)) {
            Logger.warn(`Mensaje duplicado ignorado`, { messageId: cacheKey });
            return;
        }
        
        this.messageCache.set(cacheKey, Date.now());
        
        const autoClearTimeout = setTimeout(() => {
            if (this.messageCache.has(cacheKey)) {
                this.messageCache.delete(cacheKey);
                Logger.debug(`Bloqueo de mensaje expirado`, { messageId: cacheKey });
            }
        }, this.CACHE_DURATION);
        
        let typingInterval = null;
        
        try {
            await message.channel.sendTyping();
            typingInterval = this.setupTypingIndicator(message);
            
            Logger.info(`Procesando mensaje con memoria`, {
                messageId: cacheKey,
                user: message.author.tag,
                userId: message.author.id,
                hasMemory: this.config.enableMemory,
                channelType: isDirectMessage ? 'DM' : 'Server',
                isMention: isMention
            });
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Timeout procesando después de ${this.modelConfig.processingTimeout / 1000}s`)), 
                this.modelConfig.processingTimeout)
            );
            
            // Usar la nueva función con memoria
            const aiPromise = this.getGroqResponseWithMemory(
                message.author.id,
                MANCY_CONFIG.IDENTITY, 
                userMessage, 
                this.modelConfig.temperature, 
                this.modelConfig.maxTokens
            );
            
            const mancyResponseObject = await Promise.race([aiPromise, timeoutPromise]);
            
            this.cleanupProcessingResources(typingInterval, autoClearTimeout);
            
            // Verificar si es un comando de memoria
            const memoryCommandResponse = await this.handleMemoryCommands(message, userMessage);
            if (memoryCommandResponse) {
                await message.reply(memoryCommandResponse);
                return;
            }
            
            await message.reply({
                content: mancyResponseObject.respuesta_discord,
                allowedMentions: { repliedUser: false }
            });
            
            Logger.info(`Respuesta enviada`, { 
                messageId: cacheKey,
                userId: message.author.id,
                responseLength: mancyResponseObject.respuesta_discord.length 
            });
            
        } catch (error) {
            this.cleanupProcessingResources(typingInterval, autoClearTimeout);
            
            Logger.error(`Error procesando mensaje`, {
                messageId: cacheKey,
                userId: message.author.id,
                error: error.message
            });
            
            await this.sendErrorMessage(message, error);
            
        } finally {
            this.messageCache.delete(cacheKey);
        }
    }
    
    async handleMemoryCommands(message, userMessage) {
        if (!this.config.enableMemory) return null;
        
        const lowerMessage = userMessage.toLowerCase();
        const userId = message.author.id;
        
        // Comandos de memoria
        if (lowerMessage.includes('!memoria') || lowerMessage.includes('!memory')) {
            const memory = this.memoryManager.getUserMemory(userId);
            const stats = memory.getStats();
            
            return `🧠 **ESTADO DE TU MEMORIA**:\n` +
                   `• Mensajes en esta conversación: ${stats.shortTermMessages}\n` +
                   `• Tema actual: ${stats.currentTopic || 'No definido'}\n` +
                   `• Preferencias guardadas: ${stats.preferences}\n` +
                   `• Duración: ${Math.round(stats.conversationDuration / 1000)} segundos`;
        }
        
        if (lowerMessage.includes('!olvidar') || lowerMessage.includes('!reset')) {
            this.memoryManager.resetUserMemory(userId);
            return '🧹 **Memoria reiniciada**. Comenzamos de nuevo.';
        }
        
        if (lowerMessage.includes('!temas') || lowerMessage.includes('!topics')) {
            const memory = this.memoryManager.getUserMemory(userId);
            const topics = memory.currentTopic ? 
                `Tema actual: "${memory.currentTopic}"` : 
                'No hay tema específico en este momento';
            return `📝 **TEMAS DE CONVERSACIÓN**:\n${topics}`;
        }
        
        return null;
    }
    
    setupTypingIndicator(message) {
        return setInterval(() => {
            message.channel.sendTyping().catch(e => {
                Logger.debug("Error en typing indicator:", { error: e.message });
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
            Logger.error("Error al enviar mensaje de error:", {
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
            Logger.warn("Ya hay un inicio en proceso");
            return;
        }
        
        if (this.discordClient) {
            this.discordClient.destroy();
            this.discordClient = null;
            this.state.active = false;
        }
        
        this.discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds, 
                GatewayIntentBits.GuildMessages, 
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ]
        });
        
        Logger.info(`Iniciando bot con memoria: ${this.config.enableMemory}`);
        
        await this.startDiscordBot();
    }
    
    async startDiscordBot() {
        if (this.state.startAttempts >= SYSTEM_CONSTANTS.MAX_START_ATTEMPTS) {
            Logger.error("Máximo de intentos de inicio alcanzado. Abortando.");
            this.state.startingUp = false;
            return;
        }
        
        this.state.startingUp = true;
        this.state.startAttempts++;
        this.state.lastStartTime = Date.now();
        
        try {
            this.setupDiscordEvents();
            await this.discordClient.login(this.config.discordToken);
            
            Logger.info("Bot de Discord iniciado exitosamente");
            
        } catch (error) {
            Logger.error(`Intento ${this.state.startAttempts} fallido al iniciar sesión`, {
                error: error.message,
                nextAttemptIn: `${this.state.reconnectDelay / 1000}s`
            });
            
            this.state.startingUp = false;
            
            setTimeout(() => {
                this.state.reconnectDelay = Math.min(this.state.reconnectDelay * 2, 60000);
                this.startDiscordBot();
            }, this.state.reconnectDelay);
        }
    }
    
    setupDiscordEvents() {
        this.discordClient.once('ready', () => {
            Logger.info(`Bot conectado como ${this.discordClient.user.tag}`, {
                guilds: this.discordClient.guilds.cache.size,
                model: this.modelConfig.displayName,
                memoryEnabled: this.config.enableMemory
            });
            
            this.state.active = true;
            this.state.startingUp = false;
            this.state.startAttempts = 0;
            this.state.reconnectDelay = 5000;
        });
        
        this.discordClient.on('error', (error) => {
            Logger.error("Error en cliente de Discord:", { error: error.message });
            
            if (this.state.active) {
                this.state.active = false;
                setTimeout(() => this.initializeAndStartBot(), 10000);
            }
        });
        
        this.discordClient.on('disconnect', () => {
            Logger.warn("Bot desconectado, intentando reconectar...");
            this.state.active = false;
            setTimeout(() => this.initializeAndStartBot(), 5000);
        });
        
        this.discordClient.on('messageCreate', (message) => {
            this.handleDiscordMessage(message).catch(error => {
                Logger.error("Error no manejado en handleDiscordMessage:", {
                    error: error.message,
                    stack: error.stack
                });
            });
        });
    }
    
    // =================================================================
    // ========== API PÚBLICA MEJORADA ==========
    // =================================================================
    
    getBotStatus() {
        const memoryStats = this.config.enableMemory ? 
            this.memoryManager.getStats() : { memory_enabled: false };
            
        return {
            bot_active: this.state.active,
            starting_up: this.state.startingUp,
            model: this.modelConfig,
            version: MANCY_CONFIG.VERSION,
            memory_enabled: this.config.enableMemory,
            memory_stats: memoryStats,
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
    
    // Nuevo método para obtener memoria de usuario
    getUserMemoryInfo(userId) {
        if (!this.config.enableMemory) {
            return { error: "Memoria desactivada" };
        }
        
        const memory = this.memoryManager.getUserMemory(userId);
        return {
            user_id: userId,
            ...memory.getStats(),
            preferences: memory.userPreferences,
            current_topic: memory.currentTopic
        };
    }
    
    forceRestartBot() {
        Logger.info("Reinicio forzado solicitado");
        this.state.startAttempts = 0;
        this.state.reconnectDelay = 5000;
        this.initializeAndStartBot();
    }
    
    async shutdown() {
        Logger.info("Apagando bot...");
        
        this.state.active = false;
        this.state.startingUp = false;
        
        // Guardar todas las memorias antes de apagar
        if (this.config.enableMemory) {
            Logger.info("Guardando memorias de usuarios...");
            const savePromises = Array.from(this.memoryManager.userMemories.values())
                .map(memory => memory.saveToDisk());
            await Promise.all(savePromises);
        }
        
        // Limpiar intervalos
        if (this.messageCleanupInterval) clearInterval(this.messageCleanupInterval);
        if (this.responseCleanupInterval) clearInterval(this.responseCleanupInterval);
        if (this.rateLimitCleanupInterval) clearInterval(this.rateLimitCleanupInterval);
        
        if (this.discordClient) {
            this.discordClient.destroy();
            this.discordClient = null;
        }
        
        Logger.info("Bot apagado correctamente");
    }
    
    startCleanupIntervals() {
        this.messageCleanupInterval = setInterval(() => this.cleanMessageCache(), 60000);
        this.responseCleanupInterval = setInterval(() => this.cleanResponseCache(), 300000);
        this.rateLimitCleanupInterval = setInterval(() => this.cleanRateLimits(), 120000);
        
        Logger.debug("Intervalos de limpieza iniciados");
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
            Logger.debug(`Limpieza de caché de mensajes: ${cleaned} entradas eliminadas`);
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
            Logger.debug(`Limpieza de caché de respuestas: ${cleaned} entradas eliminadas`);
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
            Logger.debug(`Limpieza de rate limits: ${cleaned} usuarios eliminados`);
        }
    }
}

// =================================================================
// ========== INSTANCIA GLOBAL Y EXPORTACIONES ==========
// =================================================================

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

export function getUserMemoryInfo(userId) {
    const bot = getBotInstance();
    return bot.getUserMemoryInfo(userId);
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

// Variables de estado
export let botActive = false;
export let isStartingUp = false;

// Actualizar variables de estado
setInterval(() => {
    const bot = getBotInstance();
    if (bot) {
        botActive = bot.state.active;
        isStartingUp = bot.state.startingUp;
    }
}, 1000);

// Inicio automático
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeAndStartBot();
    
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
