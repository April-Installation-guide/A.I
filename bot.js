import { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } from 'discord.js';
import { Groq } from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Importar APIs de conocimiento - CORREGIDO: eliminar src/ extra
import { knowledgeIntegration } from './services/knowledge-integration.js';
import { freeAPIs } from './utils/free-apis.js';
import { apiCommands } from './commands/api-commands.js';
import { knowledgeCommands } from './commands/knowledge-commands.js';

// Configuración de entorno
import dotenv from 'dotenv';
dotenv.config();

// Constantes del sistema - CORREGIDO: eliminar src/ extra
import { SYSTEM_CONSTANTS } from './config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== SISTEMA DE LOGGING MEJORADO ==========
const logger = {
    info: (msg, data = {}) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, Object.keys(data).length > 0 ? data : ''),
    error: (msg, error = null) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, error ? error.stack || error.message : ''),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
    debug: (msg, data = {}) => {
        if (process.env.DEBUG_MODE === 'true') {
            console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`, data);
        }
    }
};

// ========== FUNCIÓN REPLACEMENT PARA jsonrepair MEJORADA ==========
function safeJsonParse(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        logger.warn('Error parsing JSON, attempting repair...');
        
        // Intentar reparar JSON común
        try {
            // Remover comentarios
            let repaired = jsonString.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
            
            // Corregir comillas simples
            repaired = repaired.replace(/'/g, '"');
            
            // Corregir trailing commas
            repaired = repaired.replace(/,\s*}/g, '}');
            repaired = repaired.replace(/,\s*]/g, ']');
            
            // Corregir nombres de propiedades sin comillas
            repaired = repaired.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
            
            // Validar que el JSON reparado no esté vacío
            const result = JSON.parse(repaired);
            if (Object.keys(result).length === 0 && jsonString.trim().length > 0) {
                throw new Error('JSON reparado está vacío');
            }
            return result;
        } catch (repairError) {
            logger.error('Could not repair JSON:', repairError);
            return {};
        }
    }
}

// ========== SISTEMA DE RATE LIMITING ==========
class RateLimiter {
    constructor() {
        this.userLimits = new Map();
        this.cooldownTime = 2000; // 2 segundos entre comandos
        this.maxRequests = 10; // 10 solicitudes
        this.timeWindow = 60000; // 1 minuto
    }
    
    check(userId) {
        const now = Date.now();
        
        if (!this.userLimits.has(userId)) {
            this.userLimits.set(userId, {
                count: 1,
                firstRequest: now,
                lastRequest: now,
                commands: []
            });
            return { allowed: true, remaining: this.maxRequests - 1 };
        }
        
        const userData = this.userLimits.get(userId);
        
        // Resetear contador si ha pasado el timeWindow
        if (now - userData.firstRequest > this.timeWindow) {
            userData.count = 1;
            userData.firstRequest = now;
            userData.commands = [];
        }
        
        // Verificar cooldown
        if (now - userData.lastRequest < this.cooldownTime) {
            return { 
                allowed: false, 
                remaining: this.maxRequests - userData.count,
                waitTime: this.cooldownTime - (now - userData.lastRequest)
            };
        }
        
        // Verificar límite de solicitudes
        if (userData.count >= this.maxRequests) {
            return { 
                allowed: false, 
                remaining: 0,
                resetTime: this.timeWindow - (now - userData.firstRequest)
            };
        }
        
        userData.count++;
        userData.lastRequest = now;
        userData.commands.push(now);
        
        return { 
            allowed: true, 
            remaining: this.maxRequests - userData.count
        };
    }
    
    getStats(userId) {
        if (!this.userLimits.has(userId)) {
            return null;
        }
        return this.userLimits.get(userId);
    }
    
    cleanup() {
        const now = Date.now();
        for (const [userId, data] of this.userLimits.entries()) {
            if (now - data.lastRequest > this.timeWindow * 2) {
                this.userLimits.delete(userId);
            }
        }
    }
}

// ========== SISTEMA DE DETECCIÓN NATIVA DE APIS MEJORADO ==========
class NativeAPIIntegration {
    constructor() {
        this.QUOTABLE_URL = 'https://api.quotable.io';
        this.WIKIPEDIA_URL = 'https://en.wikipedia.org/w/api.php';
        this.cache = new Map();
        this.cacheDuration = 300000; // 5 minutos
        
        // MEJORA: Configuración de caché por tipo
        this.cacheConfig = {
            quotes: 300000,    // 5 minutos
            wikipedia: 3600000, // 1 hora
            default: 300000    // 5 minutos
        };
        
        this.enabled = true;
        
        // Patrones para detectar solicitudes de frases
        this.quotePatterns = [
            /(dime|dame|quiero|necesito|podrías|puedes).*(frase|cita|palabra|motivaci[oó]n|inspiraci[oó]n|sabidur[ií]a)/i,
            /(frase|cita|motivaci[oó]n|inspiraci[oó]n).*(del d[ií]a|para m[ií]|aleatoria|random|filos[oó]fica|bonita)/i,
            /(alguien|alguien tiene|conoces|sabes).*(frase|cita).*(interesante|bonita|filos[oó]fica)/i,
            /(mot[ií]vame|an[ií]mame|al[eé]grame|insp[ií]rame)/i,
            /(palabras|reflexi[oó]n).*(sabias|profundas|inteligentes|hermosas)/i,
            /(vida|amor|[eé]xito|felicidad).*(frase|cita|dicho)/i
        ];
        
        // Patrones para detectar solicitudes de información
        this.infoPatterns = [
            /(qu[ée] es|qu[ií]en es|qu[ée] son|qu[ií]enes son)\s+([^?.!]+)/i,
            /(hablame|cu[eé]ntame|dime|sabes).*sobre\s+([^?.!]+)/i,
            /(informaci[oó]n|datos|historia|biograf[ií]a|definici[oó]n).*de\s+([^?.!]+)/i,
            /(explica|describe|define).*([^?.!]+)/i,
            /(c[oó]mo funciona|c[oó]mo se hace|c[oó]mo es).*([^?.!]+)/i,
            /(caracter[ií]sticas|elementos|partes).*de\s+([^?.!]+)/i
        ];
    }
    
    async detectAndFetch(message) {
        if (!this.enabled) return null;
        
        // MEJORA: Sanitizar entrada
        const sanitizedMessage = this.sanitizeInput(message);
        const lowerMessage = sanitizedMessage.toLowerCase();
        
        // Detectar si es solicitud de frase
        for (const pattern of this.quotePatterns) {
            if (pattern.test(lowerMessage)) {
                const filters = this.extractQuoteFilters(lowerMessage);
                const quote = await this.fetchQuote(filters);
                return quote ? {
                    type: 'quote',
                    data: quote,
                    detected: true,
                    source: 'Quotable API'
                } : null;
            }
        }
        
        // Detectar si es solicitud de información
        for (const pattern of this.infoPatterns) {
            const match = sanitizedMessage.match(pattern);
            if (match) {
                const topic = this.extractTopic(match);
                if (topic && topic.length > 2) {
                    const wikiData = await this.fetchWikipedia(topic);
                    return wikiData ? {
                        type: 'wikipedia',
                        data: wikiData,
                        detected: true,
                        topic: topic,
                        source: 'Wikipedia API'
                    } : null;
                }
            }
        }
        
        return { type: 'none', detected: false };
    }
    
    // NUEVO: Método para sanitizar entrada
    sanitizeInput(input) {
        if (typeof input !== 'string') return '';
        
        // Limitar longitud
        input = input.substring(0, 500);
        
        // Remover caracteres peligrosos (manteniendo acentos y puntuación normal)
        input = input.replace(/[<>\[\]{}|\\^`]/g, '');
        
        return input.trim();
    }
    
    extractQuoteFilters(message) {
        const filters = {};
        
        // Detectar tipo de frase solicitada
        if (message.includes('filosof') || message.includes('filosófico')) {
            filters.tags = 'philosophy';
        } else if (message.includes('amor') || message.includes('romántic')) {
            filters.tags = 'love';
        } else if (message.includes('motiv') || message.includes('éxito')) {
            filters.tags = 'motivational';
        } else if (message.includes('vida') || message.includes('existencial')) {
            filters.tags = 'life';
        } else if (message.includes('ciencia') || message.includes('científico')) {
            filters.tags = 'science';
        } else if (message.includes('humor') || message.includes('divertid')) {
            filters.tags = 'humor';
        }
        
        // Detectar longitud
        if (message.includes('corta') || message.includes('breve') || message.includes('pequeña')) {
            filters.maxLength = 100;
        } else if (message.includes('larga') || message.includes('extensa') || message.includes('completa')) {
            filters.minLength = 150;
        }
        
        // Detectar autor específico
        const authorMatches = message.match(/(de|por|del autor)\s+([a-záéíóúñ\s]+)/i);
        if (authorMatches && authorMatches[2]) {
            filters.author = authorMatches[2].trim();
        }
        
        return filters;
    }
    
    extractTopic(match) {
        let topic = match[2] || match[3] || '';
        
        // Limpiar el tema
        topic = topic.replace(/\b(por favor|gracias|puedes|podrías|dime|dame|un|una|el|la|los|las|sobre|acerca de|qué es|quién es)\b/gi, '')
                    .trim()
                    .replace(/[?¿!¡.,;:]+$/g, '');
        
        // Sanitizar tema
        topic = this.sanitizeInput(topic);
        
        return topic.length > 2 ? topic : null;
    }
    
    async fetchQuote(filters = {}) {
        const cacheKey = `quote_${JSON.stringify(filters)}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            logger.debug('Cache hit for quote', { filters });
            return cached;
        }
        
        try {
            const params = new URLSearchParams();
            params.append('limit', '1');
            
            if (filters.tags) params.append('tags', filters.tags);
            if (filters.author) params.append('author', filters.author);
            if (filters.maxLength) params.append('maxLength', filters.maxLength);
            if (filters.minLength) params.append('minLength', filters.minLength);
            
            logger.debug('Fetching quote from API', { params: params.toString() });
            
            const response = await axios.get(`${this.QUOTABLE_URL}/quotes/random?${params}`, {
                timeout: 10000, // MEJORA: Aumentado a 10 segundos
                headers: { 
                    'User-Agent': 'MancyBot/NativeIntegration',
                    'Accept': 'application/json'
                }
            });
            
            if (response.data && response.data.length > 0) {
                const quote = {
                    content: response.data[0].content,
                    author: response.data[0].author,
                    length: response.data[0].length,
                    tags: response.data[0].tags || [],
                    source: 'Quotable API',
                    fetchedAt: new Date().toISOString()
                };
                
                this.setCached(cacheKey, quote, 'quotes');
                logger.info('Quote fetched successfully', { author: quote.author });
                return quote;
            }
        } catch (error) {
            logger.error('Error fetching quote:', error);
            
            // Intentar con parámetros más simples si falla
            if (Object.keys(filters).length > 0) {
                logger.debug('Retrying without filters');
                return this.fetchQuote({});
            }
        }
        
        return null;
    }
    
    async fetchWikipedia(topic) {
        const cacheKey = `wiki_${topic.toLowerCase()}`;
        const cached = this.getCached(cacheKey);
        if (cached) {
            logger.debug('Cache hit for Wikipedia', { topic });
            return cached;
        }
        
        try {
            // Buscar página
            const searchParams = new URLSearchParams({
                action: 'query',
                list: 'search',
                srsearch: topic,
                format: 'json',
                utf8: 1,
                srlimit: 3
            });
            
            logger.debug('Searching Wikipedia', { topic });
            
            const searchResponse = await axios.get(`${this.WIKIPEDIA_URL}?${searchParams}`, {
                timeout: 15000, // MEJORA: Aumentado a 15 segundos
                headers: { 
                    'User-Agent': 'MancyBot/NativeIntegration',
                    'Accept': 'application/json'
                }
            });
            
            const searchData = searchResponse.data;
            
            if (!searchData.query || searchData.query.search.length === 0) {
                logger.debug('No Wikipedia results found', { topic });
                return null;
            }
            
            const pageTitle = searchData.query.search[0].title;
            
            // Obtener contenido
            const contentParams = new URLSearchParams({
                action: 'query',
                prop: 'extracts|info',
                exintro: 1,
                explaintext: 1,
                titles: pageTitle,
                format: 'json',
                formatversion: 2,
                inprop: 'url',
                exchars: 1200
            });
            
            const contentResponse = await axios.get(`${this.WIKIPEDIA_URL}?${contentParams}`, {
                timeout: 15000
            });
            
            const pageData = contentResponse.data.query.pages[0];
            
            if (!pageData.extract) {
                logger.debug('No extract available for page', { pageTitle });
                return null;
            }
            
            const info = {
                title: pageData.title,
                summary: pageData.extract,
                url: pageData.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
                source: 'Wikipedia API',
                searchScore: searchData.query.search[0].score,
                fetchedAt: new Date().toISOString()
            };
            
            this.setCached(cacheKey, info, 'wikipedia');
            logger.info('Wikipedia info fetched successfully', { title: info.title });
            return info;
            
        } catch (error) {
            logger.error('Error fetching Wikipedia:', error);
            return null;
        }
    }
    
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached) {
            const duration = this.cacheConfig[cached.type] || this.cacheConfig.default;
            if (Date.now() - cached.timestamp < duration) {
                return cached.data;
            } else {
                // Eliminar del caché si expiró
                this.cache.delete(key);
            }
        }
        return null;
    }
    
    setCached(key, data, type = 'default') {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now(),
            type: type
        });
        
        // Limitar tamaño del caché
        if (this.cache.size > 1000) {
            const oldestKey = Array.from(this.cache.keys())[0];
            this.cache.delete(oldestKey);
        }
    }
    
    clearCache() {
        this.cache.clear();
        logger.info('Cache cleared');
    }
    
    getStats() {
        return {
            cacheSize: this.cache.size,
            enabled: this.enabled,
            cacheConfig: this.cacheConfig
        };
    }
}

// Clase principal del bot
class DiscordBot {
    constructor() {
        // Inicializar cliente de Discord
        this.client = new Client({
            intents: [
                Intents.FLAGS.GUILDS,
                Intents.FLAGS.GUILD_MESSAGES,
                Intents.FLAGS.MESSAGE_CONTENT
            ],
            // MEJORA: Configuración adicional para estabilidad
            retryLimit: 3,
            failIfNotExists: false,
            presence: {
                status: 'online'
            }
        });

        // Inicializar cliente Groq
        this.groq = new Groq({ 
            apiKey: process.env.GROQ_API_KEY,
            timeout: 30000,
            maxRetries: 2
        });

        // Configuración
        this.prefix = process.env.BOT_PREFIX || '!';
        this.adminIds = (process.env.ADMIN_IDS || '').split(',');
        this.enableMemory = process.env.ENABLE_MEMORY !== 'false';
        this.enableKnowledge = process.env.ENABLE_KNOWLEDGE_INTEGRATION !== 'false';
        
        // MEJORA: Rate limiter
        this.rateLimiter = new RateLimiter();
        
        // Almacenamiento de memoria por usuario
        this.userMemories = new Map();
        this.userConversations = new Map();
        
        // Estado del bot
        this.isReady = false;
        this.startTime = new Date();
        this.messageCount = 0;
        this.commandCount = 0;
        
        // NUEVO: Sistema de integración nativa de APIs
        this.nativeAPIs = new NativeAPIIntegration();
        this.nativeAPICalls = { quotes: 0, wikipedia: 0 };
        
        // MEJORA: Configuración de reconexión
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // MEJORA: Temporizador para limpieza periódica
        this.cleanupInterval = setInterval(() => {
            this.rateLimiter.cleanup();
            this.cleanupOldMemories();
        }, 300000); // Cada 5 minutos
        
        // Cargar memorias existentes
        this.loadMemories();
        
        // Configurar manejadores de eventos
        this.setupEventHandlers();
        
        // Configurar health check
        this.setupHealthCheck();
    }

    // ========== CONFIGURACIÓN DE HEALTH CHECK ==========
    setupHealthCheck() {
        setInterval(() => {
            this.healthCheck();
        }, 30000); // Cada 30 segundos
    }

    healthCheck() {
        if (!this.client.isReady() && this.isReady) {
            logger.warn('Bot lost connection, attempting to reconnect...');
            this.reconnect();
        }
        
        // Verificar uso de memoria
        const used = process.memoryUsage();
        if (used.heapUsed / used.heapTotal > 0.8) {
            logger.warn('High memory usage detected', {
                heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`
            });
            this.forceCleanup();
        }
    }

    // ========== SISTEMA DE RECONEXIÓN ==========
    async reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnect attempts reached, shutting down...');
            await this.shutdown();
            return;
        }

        this.reconnectAttempts++;
        logger.info(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
        
        try {
            await this.client.login(process.env.DISCORD_BOT_TOKEN);
            this.reconnectAttempts = 0;
            logger.info('Reconnected successfully');
        } catch (error) {
            logger.error('Reconnection failed:', error);
            
            // Esperar antes de reintentar (backoff exponencial)
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            setTimeout(() => this.reconnect(), delay);
        }
    }

    // ========== CONFIGURACIÓN DE EVENTOS ==========
    setupEventHandlers() {
        this.client.once('ready', () => this.onReady());
        this.client.on('messageCreate', (message) => this.onMessage(message));
        this.client.on('error', (error) => this.onError(error));
        this.client.on('warn', (warning) => this.onWarning(warning));
        this.client.on('disconnect', () => this.onDisconnect());
        this.client.on('reconnecting', () => logger.info('Reconnecting to Discord...'));
        this.client.on('resume', () => logger.info('Connection resumed'));
    }

    // ========== MANEJADOR DE INICIO ==========
    async onReady() {
        console.log(`🤖 ${this.client.user.tag} está en línea!`);
        console.log(`📚 Memoria: ${this.enableMemory ? 'ACTIVADA' : 'DESACTIVADA'}`);
        console.log(`🧠 Conocimiento: ${this.enableKnowledge ? 'ACTIVADO' : 'DESACTIVADO'}`);
        console.log(`🔧 Prefijo: ${this.prefix}`);
        console.log(`👥 Servidores: ${this.client.guilds.cache.size}`);
        console.log(`🌐 APIs Nativas: Quotable & Wikipedia integradas`);
        
        // Establecer estado personalizado
        this.client.user.setPresence({
            activities: [{
                name: `${this.prefix}ayuda | ${this.client.guilds.cache.size} servidores`,
                type: 'LISTENING'
            }],
            status: 'online'
        });

        this.isReady = true;
        this.reconnectAttempts = 0;
        
        logger.info('Bot started successfully', {
            guilds: this.client.guilds.cache.size,
            prefix: this.prefix,
            memoryEnabled: this.enableMemory,
            knowledgeEnabled: this.enableKnowledge
        });
    }

    // ========== MANEJADOR DE DESCONEXIÓN ==========
    onDisconnect() {
        logger.warn('Disconnected from Discord');
        this.isReady = false;
    }

    // ========== MANEJADOR DE MENSAJES ==========
    async onMessage(message) {
        // Ignorar mensajes de bots
        if (message.author.bot) return;

        // MEJORA: Sanitizar entrada
        const sanitizedContent = this.sanitizeMessageContent(message.content);
        if (!sanitizedContent) {
            logger.debug('Message filtered (empty after sanitization)', { userId: message.author.id });
            return;
        }

        // Actualizar contenido del mensaje con versión sanitizada
        message.content = sanitizedContent;

        // MEJORA: Rate limiting
        const rateLimit = this.rateLimiter.check(message.author.id);
        if (!rateLimit.allowed) {
            logger.debug('Rate limit exceeded', { 
                userId: message.author.id, 
                username: message.author.tag,
                remaining: rateLimit.remaining
            });
            
            if (rateLimit.waitTime) {
                await message.reply(`⏳ Por favor espera ${Math.ceil(rateLimit.waitTime / 1000)} segundos antes de enviar otro mensaje.`);
            } else if (rateLimit.resetTime) {
                await message.reply(`🚫 Has excedido el límite de mensajes. Intenta nuevamente en ${Math.ceil(rateLimit.resetTime / 1000)} segundos.`);
            }
            return;
        }

        // Contador de mensajes
        this.messageCount++;

        // Verificar si es un comando
        if (message.content.startsWith(this.prefix)) {
            await this.handleCommand(message);
        } else {
            await this.handleConversation(message);
        }
    }

    // ========== SANITIZACIÓN DE MENSAJES ==========
    sanitizeMessageContent(content) {
        if (typeof content !== 'string') return '';
        
        // Limitar longitud máxima
        content = content.substring(0, 2000);
        
        // Remover caracteres potencialmente peligrosos
        content = content.replace(/[<>\[\]{}|\\^`]/g, '');
        
        // Trim y validar
        content = content.trim();
        
        return content.length > 0 ? content : null;
    }

    // ========== MANEJO DE COMANDOS ==========
    async handleCommand(message) {
        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        this.commandCount++;

        logger.info(`Command received`, { 
            command, 
            userId: message.author.id, 
            username: message.author.tag,
            args: args.length > 0 ? args : 'none'
        });

        // ========== COMANDOS DE AYUDA ==========
        if (command === 'ayuda' || command === 'help') {
            const embed = new MessageEmbed()
                .setTitle('🤖 Comandos de Mancy')
                .setDescription(`Prefijo: \`${this.prefix}\``)
                .setColor('#0099ff')
                .addField('🧠 Memoria', 
                    '`memoria` - Ver tu memoria\n' +
                    '`olvidar` - Olvidar tema específico\n' +
                    '`temas` - Ver temas guardados\n' +
                    '`reiniciar` - Reiniciar tu memoria', false)
                .addField('🧪 Conocimiento Nativo', 
                    '**¡Habla conmigo naturalmente!**\n' +
                    '• "Dime una frase motivadora"\n' +
                    '• "¿Qué es la inteligencia artificial?"\n' +
                    '• "Necesito una cita filosófica"\n' +
                    '• "Háblame sobre la historia de Roma"\n' +
                    '• "Una frase sobre el amor"\n' +
                    '• "Define la mecánica cuántica"\n\n' +
                    'Buscaré automáticamente en Quotable y Wikipedia', false)
                .addField('📚 Búsquedas Directas', 
                    '`wiki [tema]` - Buscar en Wikipedia\n' +
                    '`libros [título]` - Buscar libros\n' +
                    '`definir [palabra]` - Definición\n' +
                    '`filosofo [nombre]` - Información de filósofo\n' +
                    '`historia [DD/MM]` - Eventos históricos\n' +
                    '`doc [término]` - Documentación técnica', false)
                .addField('💬 Citas y Frases', 
                    '`frase` - Frase aleatoria\n' +
                    '`frase tags=filosofía` - Frase por tema\n' +
                    '`frase author=Einstein` - Frase por autor\n' +
                    '`frase limit=3` - Múltiples frases', false)
                .addField('🌤️ Utilidades', 
                    '`clima [ciudad]` - Clima actual\n' +
                    '`convertir [cant] [de] [a]` - Conversor\n' +
                    '`chiste` - Chiste aleatorio\n' +
                    '`pais [nombre]` - Info de país\n' +
                    '`anime [nombre]` - Info de anime', false)
                .addField('⚙️ Administración', 
                    '`conocimiento estado` - Estado del sistema\n' +
                    '`conocimiento activar/desactivar` - Control\n' +
                    '`estadisticas` - Estadísticas del bot\n' +
                    '`ping` - Latencia del bot\n' +
                    '`apinativo` - Control APIs nativas', false)
                .setFooter(`Versión ${SYSTEM_CONSTANTS.VERSION || '2.0.0'} • Habla naturalmente conmigo`)
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });
            return;
        }

        // ========== NUEVO: COMANDO CONTROL APIS NATIVAS ==========
        if (command === 'apinativo' || command === 'nativo') {
            if (!args[0]) {
                const stats = this.nativeAPIs.getStats();
                const embed = new MessageEmbed()
                    .setTitle('🌐 Control de APIs Nativas')
                    .setColor('#9B59B6')
                    .setDescription('Sistema de integración automática de Quotable y Wikipedia')
                    .addField('🔧 Estado', this.nativeAPIs.enabled ? '✅ ACTIVADO' : '❌ DESACTIVADO', true)
                    .addField('💾 Cache', `${stats.cacheSize} items`, true)
                    .addField('📊 Uso', 
                        `Frases: ${this.nativeAPICalls.quotes}\n` +
                        `Wikipedia: ${this.nativeAPICalls.wikipedia}`, false)
                    .addField('🔄 Comandos', 
                        '`!apinativo on/off` - Activar/desactivar\n' +
                        '`!apinativo clear` - Limpiar caché\n' +
                        '`!apinativo stats` - Ver estadísticas', false)
                    .setFooter('Las APIs se usan automáticamente en conversaciones')
                    .setTimestamp();
                
                await message.channel.send({ embeds: [embed] });
                return;
            }
            
            const subcommand = args[0].toLowerCase();
            
            if (subcommand === 'on' || subcommand === 'activar') {
                this.nativeAPIs.enabled = true;
                await message.reply('✅ **APIs nativas ACTIVADAS.** Ahora buscaré frases e información automáticamente cuando me hables.');
                return;
            }
            
            if (subcommand === 'off' || subcommand === 'desactivar') {
                this.nativeAPIs.enabled = false;
                await message.reply('✅ **APIs nativas DESACTIVADAS.** Solo usaré mi conocimiento general.');
                return;
            }
            
            if (subcommand === 'clear' || subcommand === 'limpiar') {
                this.nativeAPIs.clearCache();
                await message.reply('✅ **Caché de APIs limpiado.**');
                return;
            }
            
            if (subcommand === 'stats' || subcommand === 'estadisticas') {
                const stats = this.nativeAPIs.getStats();
                const embed = new MessageEmbed()
                    .setTitle('📊 Estadísticas APIs Nativas')
                    .setColor('#3498DB')
                    .addField('🌐 Quotable API', `Llamadas: ${this.nativeAPICalls.quotes}`, true)
                    .addField('📚 Wikipedia API', `Llamadas: ${this.nativeAPICalls.wikipedia}`, true)
                    .addField('💾 Caché', `${stats.cacheSize} items`, true)
                    .addField('🔧 Estado', stats.enabled ? '✅ Activado' : '❌ Desactivado', true)
                    .setFooter('Total mensajes procesados: ' + this.messageCount)
                    .setTimestamp();
                
                await message.channel.send({ embeds: [embed] });
                return;
            }
            
            await message.reply('❌ Comando no reconocido. Usa `!apinativo` para ver opciones.');
            return;
        }

        // ========== COMANDOS DE MEMORIA ==========
        if (command === 'memoria') {
            const memory = this.getUserMemory(message.author.id);
            const embed = new MessageEmbed()
                .setTitle(`🧠 Memoria de ${message.author.username}`)
                .setColor('#9B59B6')
                .setDescription(`Total de interacciones: ${memory.length}`)
                .setFooter('Últimas 5 interacciones:')
                .setTimestamp();

            const recent = memory.slice(-5);
            recent.forEach((item, index) => {
                const content = item.content.length > 100 
                    ? item.content.substring(0, 100) + '...' 
                    : item.content;
                
                embed.addField(
                    `${index + 1}. ${item.role === 'user' ? '🗣️ Tú' : '🤖 Mancy'}`,
                    `**${new Date(item.timestamp).toLocaleTimeString()}**\n${content}`,
                    false
                );
            });

            if (memory.length > 5) {
                embed.addField('📊 Estadísticas', 
                    `Total: ${memory.length} mensajes\n` +
                    `Temas: ${this.extractTopics(memory).length}\n` +
                    `Desde: ${new Date(memory[0]?.timestamp).toLocaleDateString()}`,
                    true
                );
            }

            await message.channel.send({ embeds: [embed] });
            return;
        }

        if (command === 'olvidar') {
            const topic = args.join(' ');
            if (!topic) {
                await message.reply('❌ Uso: `!olvidar [tema]`\nEjemplo: `!olvidar programación`');
                return;
            }

            // MEJORA: Sanitizar tema
            const sanitizedTopic = this.sanitizeMessageContent(topic);
            const removed = this.removeTopicFromMemory(message.author.id, sanitizedTopic);
            if (removed > 0) {
                await message.reply(`✅ Olvidé ${removed} mensajes relacionados con "${sanitizedTopic}"`);
            } else {
                await message.reply(`ℹ️ No encontré mensajes sobre "${sanitizedTopic}" en tu memoria`);
            }
            return;
        }

        if (command === 'temas') {
            const memory = this.getUserMemory(message.author.id);
            const topics = this.extractTopics(memory);
            
            const embed = new MessageEmbed()
                .setTitle(`📚 Temas de conversación con ${message.author.username}`)
                .setColor('#3498DB')
                .setFooter(`Total temas: ${topics.length}`)
                .setTimestamp();

            if (topics.length === 0) {
                embed.setDescription('Aún no hay temas guardados en tu memoria.');
            } else {
                const chunkSize = 10;
                for (let i = 0; i < topics.length; i += chunkSize) {
                    const chunk = topics.slice(i, i + chunkSize);
                    embed.addField(
                        `Temas ${i + 1}-${i + chunk.length}`,
                        chunk.map(t => `• ${t}`).join('\n'),
                        false
                    );
                }
            }

            await message.channel.send({ embeds: [embed] });
            return;
        }

        if (command === 'reiniciar') {
            this.userMemories.delete(message.author.id);
            this.saveMemories();
            await message.reply('✅ Tu memoria ha sido reiniciada completamente.');
            return;
        }

        // ========== COMANDOS DE CONOCIMIENTO DIRECTO ==========
        if (command === 'wiki' || command === 'wikipedia') {
            await knowledgeCommands.wikipedia(message, args);
            return;
        }

        if (command === 'libros' || command === 'books') {
            await knowledgeCommands.libros(message, args);
            return;
        }

        if (command === 'definir' || command === 'definicion') {
            await knowledgeCommands.definir(message, args);
            return;
        }

        if (command === 'filosofo' || command === 'philosopher') {
            await knowledgeCommands.filosofo(message, args);
            return;
        }

        if (command === 'historia' || command === 'history') {
            await knowledgeCommands.historia(message, args);
            return;
        }

        if (command === 'doc' || command === 'documentacion') {
            await knowledgeCommands.documentacion(message, args);
            return;
        }

        // ========== COMANDOS DE APIS GRATUITAS ==========
        if (command === 'clima' || command === 'weather') {
            await apiCommands.clima(message, args);
            return;
        }

        if (command === 'convertir' || command === 'convert') {
            await apiCommands.convertir(message, args);
            return;
        }

        if (command === 'chiste' || command === 'joke') {
            await apiCommands.chiste(message, args);
            return;
        }

        if (command === 'pais' || command === 'country') {
            await apiCommands.pais(message, args);
            return;
        }

        if (command === 'anime') {
            await apiCommands.anime(message, args);
            return;
        }

        // ========== COMANDOS DE ADMINISTRACIÓN ==========
        if (command === 'conocimiento') {
            if (args[0] === 'estado') {
                const stats = knowledgeIntegration.getStats();
                const embed = new MessageEmbed()
                    .setTitle('🧠 Estado del Sistema de Conocimiento')
                    .setColor('#0099ff')
                    .addField('🔧 Estado', stats.enabled ? '✅ ACTIVADO' : '❌ DESACTIVADO', true)
                    .addField('📊 Total consultas', stats.totalQueries.toString(), true)
                    .addField('🧠 Búsquedas', stats.knowledgeFetches.toString(), true)
                    .addField('💾 Cache hits', stats.cacheHits.toString(), true)
                    .addField('📈 Tasa cache', stats.cacheHitRate, true)
                    .addField('⚡ Tiempo promedio', `${stats.avgResponseTime}ms`, true)
                    .addField('✅ Éxitos', stats.successfulFetches.toString(), true)
                    .addField('❌ Fallos', stats.failedFetches.toString(), true)
                    .addField('🗃️ Tamaño cache', `${stats.cacheSize} items`, true)
                    .setFooter('Sistema de Conocimiento Integrado • Mancy')
                    .setTimestamp();
                
                await message.channel.send({ embeds: [embed] });
                return;
            }
            
            if (args[0] === 'activar') {
                knowledgeIntegration.setEnabled(true);
                this.enableKnowledge = true;
                await message.reply('✅ Sistema de conocimiento **activado**. Ahora buscaré información automáticamente.');
                return;
            }
            
            if (args[0] === 'desactivar') {
                knowledgeIntegration.setEnabled(false);
                this.enableKnowledge = false;
                await message.reply('✅ Sistema de conocimiento **desactivado**. Usaré solo mi conocimiento general.');
                return;
            }
            
            if (args[0] === 'limpiar') {
                await message.reply('🔄 La caché se limpia automáticamente. No es necesario limpiarla manualmente.');
                return;
            }
            
            // Mostrar ayuda de conocimiento
            const embed = new MessageEmbed()
                .setTitle('🧠 Comandos de Conocimiento')
                .setColor('#0099ff')
                .setDescription('Control del sistema de conocimiento integrado')
                .addField('📊 Estado', '`!conocimiento estado` - Ver estadísticas del sistema', false)
                .addField('🔧 Control', '`!conocimiento activar` - Activar búsqueda automática\n`!conocimiento desactivar` - Desactivar búsqueda automática', false)
                .addField('ℹ️ Información', 'El sistema detecta automáticamente cuando necesitas información y busca en fuentes confiables.', false)
                .setFooter('El conocimiento se integra naturalmente en conversaciones')
                .setTimestamp();
            
            await message.channel.send({ embeds: [embed] });
            return;
        }

        if (command === 'estadisticas' || command === 'stats') {
            const uptime = Date.now() - this.startTime;
            const days = Math.floor(uptime / (1000 * 60 * 60 * 24));
            const hours = Math.floor((uptime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
            
            // MEJORA: Obtener estadísticas del rate limiter
            const rateLimiterStats = this.rateLimiter.getStats(message.author.id);
            
            const embed = new MessageEmbed()
                .setTitle('📊 Estadísticas de Mancy')
                .setColor('#2ECC71')
                .addField('⏰ Tiempo activo', `${days}d ${hours}h ${minutes}m`, true)
                .addField('📨 Mensajes procesados', this.messageCount.toString(), true)
                .addField('🛠️ Comandos ejecutados', this.commandCount.toString(), true)
                .addField('👥 Usuarios con memoria', this.userMemories.size.toString(), true)
                .addField('🤖 Servidores', this.client.guilds.cache.size.toString(), true)
                .addField('🧠 Memoria', this.enableMemory ? '✅ Activada' : '❌ Desactivada', true)
                .addField('📚 Conocimiento', this.enableKnowledge ? '✅ Integrado' : '❌ Desactivado', true)
                .addField('🌐 APIs Nativas', 
                    `Quotable: ${this.nativeAPICalls.quotes}\n` +
                    `Wikipedia: ${this.nativeAPICalls.wikipedia}`, true)
                .addField('🔧 Versión', SYSTEM_CONSTANTS.VERSION || '2.0.0', true);
            
            if (rateLimiterStats) {
                embed.addField('⏱️ Rate Limit', 
                    `Comandos/min: ${rateLimiterStats.count}\n` +
                    `Primera solicitud: ${new Date(rateLimiterStats.firstRequest).toLocaleTimeString()}`,
                    true);
            }
            
            embed.setFooter(`PID: ${process.pid} • Iniciado: ${this.startTime.toLocaleString()}`)
                .setTimestamp();
            
            await message.channel.send({ embeds: [embed] });
            return;
        }

        if (command === 'ping') {
            const start = Date.now();
            const msg = await message.channel.send('🏓 Pinging...');
            const latency = Date.now() - start;
            const apiLatency = Math.round(this.client.ws.ping);
            
            await msg.edit(`🏓 Pong!\n🤖 Bot Latency: ${latency}ms\n📡 API Latency: ${apiLatency}ms`);
            return;
        }

        // ========== COMANDOS DE ADMINISTRADOR ==========
        if (this.adminIds.includes(message.author.id)) {
            if (command === 'shutdown' || command === 'apagar') {
                if (!this.adminIds.includes(message.author.id)) {
                    await message.reply('❌ No tienes permisos para usar este comando.');
                    return;
                }
                
                await message.reply('🔄 Apagando bot...');
                logger.info('Shutdown requested by admin', { admin: message.author.tag });
                setTimeout(() => {
                    process.exit(0);
                }, 2000);
                return;
            }
            
            if (command === 'restart' || command === 'reiniciar') {
                if (!this.adminIds.includes(message.author.id)) {
                    await message.reply('❌ No tienes permisos para usar este comando.');
                    return;
                }
                
                await message.reply('🔄 Reiniciando bot...');
                logger.info('Restart requested by admin', { admin: message.author.tag });
                setTimeout(() => {
                    process.exit(1);
                }, 2000);
                return;
            }
            
            if (command === 'broadcast') {
                if (!this.adminIds.includes(message.author.id)) {
                    await message.reply('❌ No tienes permisos para usar este comando.');
                    return;
                }
                
                const broadcastMessage = args.join(' ');
                if (!broadcastMessage) {
                    await message.reply('❌ Uso: `!broadcast [mensaje]`');
                    return;
                }
                
                // MEJORA: Sanitizar mensaje de broadcast
                const sanitizedBroadcast = this.sanitizeMessageContent(broadcastMessage);
                if (!sanitizedBroadcast || sanitizedBroadcast.length > 1500) {
                    await message.reply('❌ El mensaje es demasiado largo o inválido.');
                    return;
                }
                
                let sent = 0;
                let failed = 0;
                
                for (const guild of this.client.guilds.cache.values()) {
                    const defaultChannel = guild.channels.cache.find(channel => 
                        channel.type === 'GUILD_TEXT' && 
                        channel.permissionsFor(guild.me).has('SEND_MESSAGES')
                    );
                    
                    if (defaultChannel) {
                        try {
                            await defaultChannel.send(`📢 **Anuncio del Administrador:**\n${sanitizedBroadcast}`);
                            sent++;
                        } catch (error) {
                            logger.error('Failed to send broadcast to guild', { 
                                guild: guild.name, 
                                error: error.message 
                            });
                            failed++;
                        }
                    }
                }
                
                await message.reply(`✅ Anuncio enviado a ${sent} servidores. ${failed > 0 ? `Fallos: ${failed}` : ''}`);
                logger.info('Broadcast completed', { sent, failed });
                return;
            }
        }

        // ========== COMANDO NO ENCONTRADO ==========
        const embed = new MessageEmbed()
            .setTitle('❓ Comando no encontrado')
            .setColor('#E74C3C')
            .setDescription(`El comando \`${command}\` no existe.`)
            .addField('📖 Comandos disponibles', 
                'Usa `!ayuda` para ver todos los comandos\n' +
                'O simplemente habla conmigo normalmente y buscaré información cuando sea necesario', false)
            .addField('💡 ¿Sabías que...?', 
                'Puedes pedirme frases o información sin comandos:\n' +
                '• "Dime una frase motivadora"\n' +
                '• "¿Qué es la inteligencia artificial?"\n' +
                '• "Háblame sobre la historia de Roma"', false)
            .setFooter('Mancy • Sistema de conocimiento integrado')
            .setTimestamp();
        
        await message.channel.send({ embeds: [embed] });
    }

    // ========== MANEJO DE CONVERSACIÓN NATURAL ==========
    async handleConversation(message) {
        try {
            // Obtener memoria del usuario
            const userMemory = this.getUserMemory(message.author.id);
            
            // NUEVO: Detectar y obtener datos de APIs nativas
            let nativeAPIData = null;
            if (this.enableKnowledge) {
                try {
                    const apiResult = await this.nativeAPIs.detectAndFetch(message.content);
                    
                    if (apiResult.detected && apiResult.data) {
                        nativeAPIData = apiResult;
                        
                        // Contar estadísticas
                        if (apiResult.type === 'quote') {
                            this.nativeAPICalls.quotes++;
                            logger.info(`Native quote detected`, { 
                                user: message.author.tag,
                                author: apiResult.data.author 
                            });
                        } else if (apiResult.type === 'wikipedia') {
                            this.nativeAPICalls.wikipedia++;
                            logger.info(`Wikipedia detected`, { 
                                user: message.author.tag,
                                topic: apiResult.topic 
                            });
                        }
                    }
                } catch (apiError) {
                    logger.error('Error in native API detection:', apiError);
                }
            }
            
            // Verificar si necesita conocimiento (sistema original)
            let enhancedResponse = null;
            let knowledgeContext = null;
            
            if (this.enableKnowledge && !nativeAPIData) {
                try {
                    const knowledgeResult = await knowledgeIntegration.processMessage(message.content);
                    
                    if (knowledgeResult.shouldEnhance) {
                        knowledgeContext = knowledgeResult;
                        logger.info(`Auto-knowledge search`, { 
                            user: message.author.tag,
                            topic: knowledgeResult.detection.topic 
                        });
                    }
                } catch (knowledgeError) {
                    logger.error('Error in knowledge integration:', knowledgeError);
                }
            }
            
            // Preparar mensajes para Groq con datos nativos si existen
            const messages = this.prepareMessagesForGroq(
                userMemory, 
                message.content, 
                knowledgeContext,
                nativeAPIData
            );
            
            // Indicar que está pensando
            const thinkingMsg = await message.channel.send('💭 Pensando...');
            
            // Generar respuesta
            const response = await this.generateGroqResponse(messages);
            
            // Guardar en memoria
            this.saveToMemory(message.author.id, {
                role: 'user',
                content: message.content,
                timestamp: new Date().toISOString(),
                knowledgeRequested: !!knowledgeContext,
                nativeAPIRequested: !!nativeAPIData,
                nativeAPIType: nativeAPIData?.type
            });
            
            this.saveToMemory(message.author.id, {
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString(),
                enhanced: !!knowledgeContext || !!nativeAPIData,
                knowledgeSource: knowledgeContext?.knowledge?.source,
                nativeAPISource: nativeAPIData?.data?.source
            });
            
            // MEJORA: Guardar memorias con debouncing
            this.scheduleMemorySave();
            
            // Enviar respuesta
            await thinkingMsg.edit(response);
            
            // Log estadístico
            if (nativeAPIData) {
                logger.debug(`${nativeAPIData.type === 'quote' ? 'Quote' : 'Wiki'} native sent`, { 
                    user: message.author.tag,
                    type: nativeAPIData.type 
                });
            } else if (knowledgeContext) {
                logger.debug('Enhanced response sent', { 
                    user: message.author.tag,
                    source: knowledgeContext.knowledge?.source 
                });
            }
            
        } catch (error) {
            logger.error('Error in conversation:', error);
            
            // MEJORA: Enviar error al canal de logs si existe
            await this.sendToErrorChannel(error, message);
            
            // Respuesta de error amigable
            const errorResponses = [
                "Lo siento, hubo un error procesando tu mensaje. ¿Podrías intentarlo de nuevo?",
                "Parece que hay un problema técnico. Intenta en un momento.",
                "¡Ups! Algo salió mal. ¿Podrías reformular tu pregunta?",
                "Tengo problemas para procesar tu mensaje. Intenta más tarde."
            ];
            
            const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
            await message.channel.send(randomError);
        }
    }

    // ========== ENVIAR ERRORES A CANAL DE LOGS ==========
    async sendToErrorChannel(error, message) {
        try {
            const errorChannelId = process.env.ERROR_CHANNEL_ID;
            if (errorChannelId && this.client.isReady()) {
                const channel = await this.client.channels.fetch(errorChannelId);
                if (channel) {
                    const embed = new MessageEmbed()
                        .setTitle('❌ Error en Mancy')
                        .setColor('#FF0000')
                        .addField('Usuario', `${message.author.tag} (${message.author.id})`, true)
                        .addField('Canal', `${message.channel.name} (${message.channel.id})`, true)
                        .addField('Error', `\`\`\`${error.message.substring(0, 1000)}\`\`\``)
                        .addField('Mensaje', `\`\`\`${message.content.substring(0, 500)}\`\`\``)
                        .setTimestamp();
                    
                    await channel.send({ embeds: [embed] });
                }
            }
        } catch (logError) {
            logger.error('Failed to send error to log channel:', logError);
        }
    }

    // ========== PREPARAR MENSAJES PARA GROQ (MODIFICADA PARA APIS NATIVAS) ==========
    prepareMessagesForGroq(userMemory, currentMessage, knowledgeContext, nativeAPIData) {
        const messages = [];
        
        // Añadir instrucción del sistema con conocimiento si está disponible
        let systemMessage = `Eres Mancy, un asistente de Discord inteligente y amigable.`;
        
        if (this.enableMemory && userMemory.length > 0) {
            systemMessage += ` Tienes memoria de conversación con este usuario.`;
        }
        
        // Prioridad 1: Datos de APIs nativas
        if (nativeAPIData && nativeAPIData.data) {
            if (nativeAPIData.type === 'quote') {
                const quote = nativeAPIData.data;
                systemMessage += `\n\nEL USUARIO PIDIÓ UNA FRASE. TIENES ESTA CITA DISPONIBLE:\n` +
                               `"${quote.content}"\n— ${quote.author}\n\n` +
                               `Instrucción: Integra esta cita de forma natural en tu respuesta. ` +
                               `No la cites textualmente a menos que sea apropiado. Responde como si fuera tu propia reflexión.`;
                
            } else if (nativeAPIData.type === 'wikipedia') {
                const wiki = nativeAPIData.data;
                systemMessage += `\n\nINFORMACIÓN SOBRE "${wiki.title}":\n${wiki.summary}\n\n` +
                               `Instrucción: Usa esta información para responder con precisión pero de forma conversacional. ` +
                               `No menciones que viene de Wikipedia. Integra los hechos naturalmente.`;
            }
        }
        // Prioridad 2: Conocimiento general del sistema original
        else if (knowledgeContext) {
            const knowledgeText = knowledgeIntegration.formatKnowledgeForPrompt(knowledgeContext.knowledge);
            systemMessage += `\n\nINFORMACIÓN DE REFERENCIA (usa esto para responder con precisión):\n${knowledgeText}\n\n`;
            systemMessage += `Instrucción: Usa la información de referencia para enriquecer tu respuesta. Sé preciso y natural.`;
        }
        
        messages.push({
            role: 'system',
            content: systemMessage
        });
        
        // Añadir historial de memoria (últimas 10 interacciones)
        if (this.enableMemory && userMemory.length > 0) {
            const recentMemory = userMemory.slice(-10);
            recentMemory.forEach(item => {
                messages.push({
                    role: item.role,
                    content: item.content
                });
            });
        }
        
        // Añadir mensaje actual
        messages.push({
            role: 'user',
            content: currentMessage
        });
        
        return messages;
    }

    // ========== GENERAR RESPUESTA CON GROQ ==========
    async generateGroqResponse(messages) {
        try {
            const completion = await this.groq.chat.completions.create({
                messages: messages,
                model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
                temperature: 0.7,
                max_tokens: 1024,
                stream: false,
                timeout: 30000
            });
            
            let response = completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
            
            // Limpiar respuesta si es necesario
            response = response.trim();
            
            // Asegurarse de que no exceda el límite de Discord
            if (response.length > 2000) {
                response = response.substring(0, 1997) + '...';
            }
            
            return response;
            
        } catch (error) {
            logger.error('Error en Groq:', error);
            
            if (error.message.includes('rate limit')) {
                return 'Estoy recibiendo muchas peticiones. Por favor, intenta de nuevo en un momento.';
            }
            
            if (error.message.includes('timeout')) {
                return 'La respuesta está tardando demasiado. ¿Podrías reformular tu pregunta?';
            }
            
            throw error;
        }
    }

    // ========== SISTEMA DE MEMORIA MEJORADO ==========
    getUserMemory(userId) {
        if (!this.userMemories.has(userId)) {
            this.userMemories.set(userId, []);
        }
        return this.userMemories.get(userId);
    }

    saveToMemory(userId, message) {
        const memory = this.getUserMemory(userId);
        memory.push(message);
        
        // Limitar memoria a 100 mensajes por usuario
        if (memory.length > 100) {
            memory.splice(0, memory.length - 100);
        }
        
        this.userMemories.set(userId, memory);
    }

    // MEJORA: Debounced memory save
    scheduleMemorySave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.saveTimeout = setTimeout(() => {
            this.saveMemories();
        }, 5000); // Guardar después de 5 segundos de inactividad
    }

    removeTopicFromMemory(userId, topic) {
        const memory = this.getUserMemory(userId);
        const originalLength = memory.length;
        
        // Filtrar mensajes que contengan el tema
        const filtered = memory.filter(item => 
            !item.content.toLowerCase().includes(topic.toLowerCase())
        );
        
        this.userMemories.set(userId, filtered);
        this.saveMemories();
        
        return originalLength - filtered.length;
    }

    extractTopics(memory) {
        const topics = new Set();
        
        memory.forEach(item => {
            // Extraer palabras clave (palabras de 4+ letras que no sean comunes)
            const words = item.content.toLowerCase()
                .replace(/[^\w\sáéíóúñ]/gi, '')
                .split(/\s+/)
                .filter(word => word.length >= 4);
            
            // Filtrar palabras comunes
            const commonWords = ['hola', 'gracias', 'porque', 'quiero', 'puedes', 'ayuda', 'buenos', 'tardes', 'noches', 'muchas'];
            const filteredWords = words.filter(word => 
                !commonWords.includes(word) && 
                !word.match(/^\d+$/)
            );
            
            filteredWords.forEach(word => topics.add(word));
        });
        
        return Array.from(topics).slice(0, 20);
    }

    // MEJORA: Limpiar memorias antiguas
    cleanupOldMemories() {
        const now = Date.now();
        const thirtyDaysAgo = 30 * 24 * 60 * 60 * 1000;
        
        for (const [userId, memory] of this.userMemories.entries()) {
            const recentMemory = memory.filter(item => {
                const itemTime = new Date(item.timestamp).getTime();
                return now - itemTime < thirtyDaysAgo;
            });
            
            if (recentMemory.length === 0) {
                this.userMemories.delete(userId);
            } else if (recentMemory.length !== memory.length) {
                this.userMemories.set(userId, recentMemory);
            }
        }
    }

    // MEJORA: Limpieza forzada por alto uso de memoria
    forceCleanup() {
        logger.warn('Performing forced memory cleanup');
        
        // Reducir memorias a la mitad si hay muchas
        if (this.userMemories.size > 500) {
            const entries = Array.from(this.userMemories.entries());
            const half = Math.floor(entries.length / 2);
            this.userMemories = new Map(entries.slice(half));
        }
        
        // Limpiar caché de APIs nativas
        this.nativeAPIs.clearCache();
        
        // Limpiar rate limiter
        this.rateLimiter.cleanup();
        
        logger.info('Forced cleanup completed', { 
            remainingMemories: this.userMemories.size 
        });
    }

    // ========== PERSISTENCIA DE MEMORIA (MODIFICADA) ==========
    loadMemories() {
        try {
            const memoriesPath = path.join(__dirname, 'data', 'memories.json');
            if (fs.existsSync(memoriesPath)) {
                const data = fs.readFileSync(memoriesPath, 'utf8');
                const parsed = safeJsonParse(data);
                this.userMemories = new Map(Object.entries(parsed));
                logger.info(`Memories loaded`, { 
                    users: this.userMemories.size,
                    totalMessages: Array.from(this.userMemories.values()).reduce((sum, mem) => sum + mem.length, 0)
                });
            }
        } catch (error) {
            logger.error('Error loading memories:', error);
            this.userMemories = new Map();
        }
    }

    saveMemories() {
        try {
            const memoriesPath = path.join(__dirname, 'data', 'memories.json');
            const dataDir = path.dirname(memoriesPath);
            
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            const serialized = Object.fromEntries(this.userMemories);
            fs.writeFileSync(memoriesPath, JSON.stringify(serialized, null, 2));
            
            logger.debug('Memories saved', { 
                users: this.userMemories.size,
                totalMessages: Array.from(this.userMemories.values()).reduce((sum, mem) => sum + mem.length, 0)
            });
        } catch (error) {
            logger.error('Error saving memories:', error);
        }
    }

    // ========== MANEJADORES DE ERRORES ==========
    onError(error) {
        logger.error('Discord client error:', error);
    }

    onWarning(warning) {
        logger.warn('Discord client warning:', warning);
    }

    // ========== FUNCIONES DE INICIO/APAGADO ==========
    async start() {
        try {
            logger.info('Starting Mancy...');
            console.log('🚀 Iniciando Mancy...');
            console.log('🌐 APIs Nativas: Quotable & Wikipedia listas');
            console.log('💬 Modo conversacional: ACTIVADO (sin comandos necesarios)');
            console.log('🔒 Sistema de seguridad: ACTIVADO');
            console.log('📊 Sistema de logs: ACTIVADO');
            
            await this.client.login(process.env.DISCORD_BOT_TOKEN);
        } catch (error) {
            logger.error('Error starting bot:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        logger.info('Shutting down bot...');
        
        // Limpiar intervalos
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        console.log('🔄 Guardando memorias antes de apagar...');
        this.saveMemories();
        
        console.log('👋 Desconectando del cliente Discord...');
        this.client.destroy();
        
        console.log('✅ Bot apagado correctamente');
        logger.info('Bot shutdown complete');
    }

    // ========== FUNCIONES PARA API REST ==========
    getBotStatus() {
        const memoryInfo = process.memoryUsage();
        
        return {
            status: this.isReady ? 'online' : 'offline',
            uptime: Date.now() - this.startTime,
            messageCount: this.messageCount,
            commandCount: this.commandCount,
            userCount: this.client.users.cache.size,
            guildCount: this.client.guilds.cache.size,
            memoryEnabled: this.enableMemory,
            knowledgeEnabled: this.enableKnowledge,
            userMemories: this.userMemories.size,
            nativeAPICalls: this.nativeAPICalls,
            version: SYSTEM_CONSTANTS.VERSION || '2.0.0',
            rateLimiter: {
                activeUsers: this.rateLimiter.userLimits.size
            },
            systemMemory: {
                heapUsed: Math.round(memoryInfo.heapUsed / 1024 / 1024) + 'MB',
                heapTotal: Math.round(memoryInfo.heapTotal / 1024 / 1024) + 'MB',
                rss: Math.round(memoryInfo.rss / 1024 / 1024) + 'MB'
            },
            reconnectAttempts: this.reconnectAttempts
        };
    }

    getUserMemoryInfo(userId) {
        const memory = this.getUserMemory(userId);
        return {
            userId: userId,
            messageCount: memory.length,
            lastInteraction: memory.length > 0 ? memory[memory.length - 1].timestamp : null,
            topics: this.extractTopics(memory).slice(0, 10),
            memorySize: JSON.stringify(memory).length,
            nativeAPIUses: memory.filter(m => m.nativeAPIRequested).length,
            enhancedResponses: memory.filter(m => m.enhanced).length,
            rateLimit: this.rateLimiter.getStats(userId)
        };
    }

    forceRestart() {
        logger.info('Force restart requested');
        this.messageCount = 0;
        this.commandCount = 0;
        this.nativeAPIs.clearCache();
        this.rateLimiter.userLimits.clear();
        return { message: 'Reinicio forzado ejecutado', timestamp: new Date().toISOString() };
    }
}

// ========== FUNCIONES DE EXPORTACIÓN ==========
export const bot = new DiscordBot();

export async function initializeAndStartBot() {
    await bot.start();
}

export function getBotStatus() {
    return bot.getBotStatus();
}

export function getUserMemoryInfo(userId) {
    return bot.getUserMemoryInfo(userId);
}

export function forceRestartBot() {
    return bot.forceRestart();
}

export async function shutdownBot() {
    await bot.shutdown();
}

// ========== EJECUCIÓN DIRECTA ==========
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeAndStartBot().catch(error => {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    });
    
    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down...');
        await shutdownBot();
        process.exit(0);
    });
    
    process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down...');
        await shutdownBot();
        process.exit(0);
    });
    
    // MEJORA: Manejar unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // MEJORA: Manejar uncaught exceptions
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught Exception:', error);
        // No salir inmediatamente, intentar continuar
    });
}
