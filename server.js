import { Client, GatewayIntentBits, MessageEmbed, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Groq } from 'groq-sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// Importar APIs de conocimiento - CORREGIDO
import { knowledgeIntegration } from './src/services/knowledge-integration.js';
import { freeAPIs } from './src/utils/free-apis.js';
// Comandos básicos
const apiCommands = {
    clima: async (message, args) => {
        const city = args.join(' ');
        message.reply(`🌤️ Buscaré el clima de ${city || 'tu ciudad'}.`);
    },
    convertir: async (message, args) => {
        message.reply(`🔄 Convertiré ${args[0] || 'algo'}.`);
    },
    chiste: async (message) => {
        message.reply('😂 ¿Qué le dice un bit a otro? Nos vemos en el bus.');
    },
    pais: async (message, args) => {
        message.reply(`🌍 Buscaré información sobre ${args.join(' ') || 'ese país'}.`);
    },
    anime: async (message, args) => {
        message.reply(`🎌 Buscaré información sobre ${args.join(' ') || 'ese anime'}.`);
    }
};

const knowledgeCommands = {
    wikipedia: async (message, args) => {
        const topic = args.join(' ');
        message.reply(`🔍 Buscaré información sobre "${topic}".`);
    },
    libros: async (message, args) => {
        message.reply(`📚 Buscaré libros sobre "${args.join(' ')}".`);
    },
    definir: async (message, args) => {
        message.reply(`📖 Buscaré la definición de "${args.join(' ')}".`);
    },
    filosofo: async (message, args) => {
        message.reply(`🧠 Buscaré información sobre ${args.join(' ')}.`);
    },
    historia: async (message, args) => {
        message.reply(`📅 Buscaré eventos históricos del ${args.join(' ')}.`);
    },
    documentacion: async (message, args) => {
        message.reply(`📄 Buscaré documentación sobre "${args.join(' ')}".`);
    }
};

// Importar constantes si existen
let SYSTEM_CONSTANTS = { VERSION: '2.0.0' };
try {
    const constantsModule = await import('./src/config/constants.js');
    SYSTEM_CONSTANTS = constantsModule.SYSTEM_CONSTANTS || SYSTEM_CONSTANTS;
} catch (error) {
    console.log('Usando constantes por defecto');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========== FUNCIÓN REPLACEMENT PARA jsonrepair ==========
function safeJsonParse(jsonString) {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('Error parsing JSON, attempting repair...');
        
        try {
            let repaired = jsonString.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m);
            repaired = repaired.replace(/'/g, '"');
            repaired = repaired.replace(/,\s*}/g, '}');
            repaired = repaired.replace(/,\s*]/g, ']');
            repaired = repaired.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
            
            return JSON.parse(repaired);
        } catch (repairError) {
            console.error('Could not repair JSON:', repairError.message);
            return {};
        }
    }
}

// ========== SISTEMA DE DETECCIÓN NATIVA DE APIS ==========
class NativeAPIIntegration {
    constructor() {
        this.QUOTABLE_URL = 'https://api.quotable.io';
        this.WIKIPEDIA_URL = 'https://en.wikipedia.org/w/api.php';
        this.cache = new Map();
        this.cacheDuration = 300000;
        this.enabled = true;
        
        this.quotePatterns = [
            /(dime|dame|quiero|necesito|podrías|puedes).*(frase|cita|palabra|motivaci[oó]n|inspiraci[oó]n|sabidur[ií]a)/i,
            /(frase|cita|motivaci[oó]n|inspiraci[oó]n).*(del d[ií]a|para m[ií]|aleatoria|random|filos[oó]fica|bonita)/i,
        ];
        
        this.infoPatterns = [
            /(qu[ée] es|qu[ií]en es|qu[ée] son|qu[ií]enes son)\s+([^?.!]+)/i,
            /(hablame|cu[eé]ntame|dime|sabes).*sobre\s+([^?.!]+)/i,
        ];
    }
    
    async detectAndFetch(message) {
        if (!this.enabled) return null;
        
        const lowerMessage = message.toLowerCase();
        
        for (const pattern of this.quotePatterns) {
            if (pattern.test(lowerMessage)) {
                const filters = this.extractQuoteFilters(lowerMessage);
                return {
                    type: 'quote',
                    data: await this.fetchQuote(filters),
                    detected: true
                };
            }
        }
        
        for (const pattern of this.infoPatterns) {
            const match = message.match(pattern);
            if (match) {
                const topic = this.extractTopic(match);
                if (topic && topic.length > 2) {
                    return {
                        type: 'wikipedia',
                        data: await this.fetchWikipedia(topic),
                        detected: true,
                        topic: topic
                    };
                }
            }
        }
        
        return { type: 'none', detected: false };
    }
    
    extractQuoteFilters(message) {
        const filters = {};
        
        if (message.includes('filosof') || message.includes('filosófico')) {
            filters.tags = 'philosophy';
        } else if (message.includes('amor') || message.includes('romántic')) {
            filters.tags = 'love';
        } else if (message.includes('motiv') || message.includes('éxito')) {
            filters.tags = 'motivational';
        }
        
        return filters;
    }
    
    extractTopic(match) {
        let topic = match[2] || match[3] || '';
        topic = topic.replace(/\b(por favor|gracias|puedes|podrías|dime|dame|un|una|el|la|los|las|sobre|acerca de|qué es|quién es)\b/gi, '')
                    .trim()
                    .replace(/[?¿!¡.,;:]+$/g, '');
        
        return topic.length > 2 ? topic : null;
    }
    
    async fetchQuote(filters = {}) {
        const cacheKey = `quote_${JSON.stringify(filters)}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;
        
        try {
            const params = new URLSearchParams();
            params.append('limit', '1');
            
            if (filters.tags) params.append('tags', filters.tags);
            if (filters.author) params.append('author', filters.author);
            
            const response = await axios.get(`${this.QUOTABLE_URL}/quotes/random?${params}`, {
                timeout: 5000,
                headers: { 'User-Agent': 'MancyBot/NativeIntegration' }
            });
            
            if (response.data && response.data.length > 0) {
                const quote = {
                    content: response.data[0].content,
                    author: response.data[0].author,
                    source: 'Quotable API'
                };
                
                this.setCached(cacheKey, quote);
                return quote;
            }
        } catch (error) {
            console.error('Error fetching quote:', error.message);
        }
        
        return null;
    }
    
    async fetchWikipedia(topic) {
        const cacheKey = `wiki_${topic.toLowerCase()}`;
        const cached = this.getCached(cacheKey);
        if (cached) return cached;
        
        try {
            const searchParams = new URLSearchParams({
                action: 'query',
                list: 'search',
                srsearch: topic,
                format: 'json',
                utf8: 1,
                srlimit: 1
            });
            
            const searchResponse = await axios.get(`${this.WIKIPEDIA_URL}?${searchParams}`, {
                timeout: 8000,
                headers: { 'User-Agent': 'MancyBot/NativeIntegration' }
            });
            
            const searchData = searchResponse.data;
            
            if (!searchData.query || searchData.query.search.length === 0) {
                return null;
            }
            
            const pageTitle = searchData.query.search[0].title;
            
            const contentParams = new URLSearchParams({
                action: 'query',
                prop: 'extracts',
                exintro: 1,
                explaintext: 1,
                titles: pageTitle,
                format: 'json',
                formatversion: 2,
                exchars: 500
            });
            
            const contentResponse = await axios.get(`${this.WIKIPEDIA_URL}?${contentParams}`, {
                timeout: 8000
            });
            
            const pageData = contentResponse.data.query.pages[0];
            
            if (!pageData.extract) {
                return null;
            }
            
            const info = {
                title: pageData.title,
                summary: pageData.extract,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`,
                source: 'Wikipedia API'
            };
            
            this.setCached(cacheKey, info);
            return info;
            
        } catch (error) {
            console.error('Error fetching Wikipedia:', error.message);
            return null;
        }
    }
    
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < this.cacheDuration) {
            return cached.data;
        }
        return null;
    }
    
    setCached(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
    
    clearCache() {
        this.cache.clear();
    }
    
    getStats() {
        return {
            cacheSize: this.cache.size,
            enabled: this.enabled
        };
    }
}

// Clase principal del bot
class DiscordBot {
    constructor() {
        // Inicializar cliente de Discord con GatewayIntentBits
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        // Inicializar cliente Groq
        this.groq = new Groq({ 
            apiKey: process.env.GROQ_API_KEY,
            timeout: 30000
        });

        // Configuración
        this.prefix = process.env.BOT_PREFIX || '!';
        this.adminIds = (process.env.ADMIN_IDS || '').split(',');
        this.enableMemory = process.env.ENABLE_MEMORY !== 'false';
        this.enableKnowledge = process.env.ENABLE_KNOWLEDGE_INTEGRATION !== 'false';
        
        // Almacenamiento de memoria
        this.userMemories = new Map();
        
        // Estado del bot
        this.isReady = false;
        this.startTime = new Date();
        this.messageCount = 0;
        this.commandCount = 0;
        
        // Sistema de integración nativa de APIs
        this.nativeAPIs = new NativeAPIIntegration();
        this.nativeAPICalls = { quotes: 0, wikipedia: 0 };
        
        // Cargar memorias
        this.loadMemories();
        
        // Configurar manejadores de eventos
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.once('ready', () => this.onReady());
        this.client.on('messageCreate', (message) => this.onMessage(message));
        this.client.on('error', (error) => this.onError(error));
    }

    async onReady() {
        console.log(`🤖 ${this.client.user.tag} está en línea!`);
        console.log(`🔧 Prefijo: ${this.prefix}`);
        console.log(`👥 Servidores: ${this.client.guilds.cache.size}`);
        
        this.client.user.setPresence({
            activities: [{
                name: `${this.prefix}ayuda | ${this.client.guilds.cache.size} servidores`,
                type: 3 // LISTENING
            }],
            status: 'online'
        });

        this.isReady = true;
    }

    async onMessage(message) {
        if (message.author.bot) return;
        if (!message.content) return;

        this.messageCount++;

        if (message.content.startsWith(this.prefix)) {
            await this.handleCommand(message);
        } else {
            await this.handleConversation(message);
        }
    }

    async handleCommand(message) {
        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        
        this.commandCount++;

        console.log(`🛠️ Comando: ${command} por ${message.author.tag}`);

        // COMANDO AYUDA
        if (command === 'ayuda' || command === 'help') {
            const embed = new MessageEmbed()
                .setTitle('🤖 Comandos de Mancy')
                .setDescription(`Prefijo: \`${this.prefix}\``)
                .setColor('#0099ff')
                .addField('🧠 Memoria', 
                    '`memoria` - Ver tu memoria\n' +
                    '`temas` - Ver temas guardados\n' +
                    '`reiniciar` - Reiniciar tu memoria', false)
                .addField('🧪 Conocimiento', 
                    '• "Dime una frase motivadora"\n' +
                    '• "¿Qué es la inteligencia artificial?"\n' +
                    '• "Necesito una cita filosófica"', false)
                .addField('📚 Búsquedas', 
                    '`wiki [tema]` - Buscar en Wikipedia\n' +
                    '`definir [palabra]` - Definición\n' +
                    '`filosofo [nombre]` - Filósofo', false)
                .addField('🌤️ Utilidades', 
                    '`clima [ciudad]` - Clima\n' +
                    '`chiste` - Chiste aleatorio\n' +
                    '`pais [nombre]` - Info de país', false)
                .setFooter(`Versión ${SYSTEM_CONSTANTS.VERSION}`)
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
            return;
        }

        // COMANDOS DE MEMORIA
        if (command === 'memoria') {
            const memory = this.getUserMemory(message.author.id);
            const embed = new MessageEmbed()
                .setTitle(`🧠 Memoria de ${message.author.username}`)
                .setColor('#9B59B6')
                .setDescription(`Total interacciones: ${memory.length}`)
                .setTimestamp();

            const recent = memory.slice(-5);
            recent.forEach((item, index) => {
                const content = item.content.length > 100 
                    ? item.content.substring(0, 100) + '...' 
                    : item.content;
                
                embed.addField(
                    `${index + 1}. ${item.role === 'user' ? '🗣️ Tú' : '🤖 Mancy'}`,
                    content,
                    false
                );
            });

            message.channel.send({ embeds: [embed] });
            return;
        }

        if (command === 'temas') {
            const memory = this.getUserMemory(message.author.id);
            const topics = this.extractTopics(memory);
            
            const embed = new MessageEmbed()
                .setTitle(`📚 Temas de ${message.author.username}`)
                .setColor('#3498DB')
                .setFooter(`Total temas: ${topics.length}`)
                .setTimestamp();

            if (topics.length === 0) {
                embed.setDescription('Aún no hay temas guardados.');
            } else {
                embed.setDescription(topics.map(t => `• ${t}`).join('\n'));
            }

            message.channel.send({ embeds: [embed] });
            return;
        }

        if (command === 'reiniciar') {
            this.userMemories.delete(message.author.id);
            this.saveMemories();
            message.reply('✅ Memoria reiniciada.');
            return;
        }

        // COMANDOS DE CONOCIMIENTO
        if (command === 'wiki' || command === 'wikipedia') {
            await knowledgeCommands.wikipedia(message, args);
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

        // COMANDOS DE APIS
        if (command === 'clima' || command === 'weather') {
            await apiCommands.clima(message, args);
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

        // COMANDO PING
        if (command === 'ping') {
            const start = Date.now();
            const msg = await message.channel.send('🏓 Pinging...');
            const latency = Date.now() - start;
            const apiLatency = Math.round(this.client.ws.ping);
            
            msg.edit(`🏓 Pong!\n🤖 Latencia: ${latency}ms\n📡 API: ${apiLatency}ms`);
            return;
        }

        // COMANDO NO ENCONTRADO
        message.reply(`❌ Comando \`${command}\` no encontrado. Usa \`!ayuda\`.`);
    }

    async handleConversation(message) {
        try {
            const userMemory = this.getUserMemory(message.author.id);
            
            // Detectar APIs nativas
            let nativeAPIData = null;
            if (this.enableKnowledge) {
                const apiResult = await this.nativeAPIs.detectAndFetch(message.content);
                
                if (apiResult.detected && apiResult.data) {
                    nativeAPIData = apiResult;
                    
                    if (apiResult.type === 'quote') {
                        this.nativeAPICalls.quotes++;
                    } else if (apiResult.type === 'wikipedia') {
                        this.nativeAPICalls.wikipedia++;
                    }
                }
            }
            
            // Preparar mensajes para Groq
            const messages = this.prepareMessagesForGroq(
                userMemory, 
                message.content, 
                null,
                nativeAPIData
            );
            
            // Generar respuesta
            const thinkingMsg = await message.channel.send('💭 Pensando...');
            const response = await this.generateGroqResponse(messages);
            
            // Guardar en memoria
            this.saveToMemory(message.author.id, {
                role: 'user',
                content: message.content,
                timestamp: new Date().toISOString()
            });
            
            this.saveToMemory(message.author.id, {
                role: 'assistant',
                content: response,
                timestamp: new Date().toISOString()
            });
            
            // Enviar respuesta
            await thinkingMsg.edit(response);
            
            // Guardar cada 10 mensajes
            if (this.messageCount % 10 === 0) {
                this.saveMemories();
            }
            
        } catch (error) {
            console.error('Error en conversación:', error);
            message.channel.send('Lo siento, hubo un error. ¿Podrías intentarlo de nuevo?');
        }
    }

    prepareMessagesForGroq(userMemory, currentMessage, knowledgeContext, nativeAPIData) {
        const messages = [];
        
        let systemMessage = `Eres Mancy, un asistente de Discord inteligente y amigable.`;
        
        if (this.enableMemory && userMemory.length > 0) {
            systemMessage += ` Tienes memoria de conversación con este usuario.`;
        }
        
        if (nativeAPIData && nativeAPIData.data) {
            if (nativeAPIData.type === 'quote') {
                const quote = nativeAPIData.data;
                systemMessage += `\n\nEL USUARIO PIDIÓ UNA FRASE. TIENES ESTA CITA:\n"${quote.content}"\n— ${quote.author}`;
            } else if (nativeAPIData.type === 'wikipedia') {
                const wiki = nativeAPIData.data;
                systemMessage += `\n\nINFORMACIÓN SOBRE "${wiki.title}":\n${wiki.summary}`;
            }
        }
        
        messages.push({ role: 'system', content: systemMessage });
        
        // Historial de memoria
        if (this.enableMemory && userMemory.length > 0) {
            const recentMemory = userMemory.slice(-10);
            recentMemory.forEach(item => {
                messages.push({
                    role: item.role,
                    content: item.content
                });
            });
        }
        
        // Mensaje actual
        messages.push({ role: 'user', content: currentMessage });
        
        return messages;
    }

    async generateGroqResponse(messages) {
        try {
            const completion = await this.groq.chat.completions.create({
                messages: messages,
                model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
                temperature: 0.7,
                max_tokens: 1024,
                stream: false
            });
            
            let response = completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
            
            response = response.trim();
            
            if (response.length > 2000) {
                response = response.substring(0, 1997) + '...';
            }
            
            return response;
            
        } catch (error) {
            console.error('Error en Groq:', error);
            
            if (error.message.includes('rate limit')) {
                return 'Estoy recibiendo muchas peticiones. Por favor, intenta de nuevo en un momento.';
            }
            
            return 'Lo siento, hubo un error al procesar tu mensaje.';
        }
    }

    // ========== SISTEMA DE MEMORIA ==========
    getUserMemory(userId) {
        if (!this.userMemories.has(userId)) {
            this.userMemories.set(userId, []);
        }
        return this.userMemories.get(userId);
    }

    saveToMemory(userId, message) {
        const memory = this.getUserMemory(userId);
        memory.push(message);
        
        if (memory.length > 100) {
            memory.splice(0, memory.length - 100);
        }
        
        this.userMemories.set(userId, memory);
    }

    extractTopics(memory) {
        const topics = new Set();
        
        memory.forEach(item => {
            const words = item.content.toLowerCase()
                .replace(/[^\w\sáéíóúñ]/gi, '')
                .split(/\s+/)
                .filter(word => word.length >= 4);
            
            const commonWords = ['hola', 'gracias', 'porque', 'quiero', 'puedes', 'ayuda'];
            const filteredWords = words.filter(word => 
                !commonWords.includes(word) && 
                !word.match(/^\d+$/)
            );
            
            filteredWords.forEach(word => topics.add(word));
        });
        
        return Array.from(topics).slice(0, 10);
    }

    loadMemories() {
        try {
            const memoriesPath = path.join(__dirname, 'data', 'memories.json');
            if (fs.existsSync(memoriesPath)) {
                const data = fs.readFileSync(memoriesPath, 'utf8');
                const parsed = safeJsonParse(data);
                this.userMemories = new Map(Object.entries(parsed));
                console.log(`📂 Memorias cargadas: ${this.userMemories.size} usuarios`);
            }
        } catch (error) {
            console.error('Error cargando memorias:', error);
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
            
            console.log(`💾 Memorias guardadas: ${this.userMemories.size} usuarios`);
        } catch (error) {
            console.error('Error guardando memorias:', error);
        }
    }

    onError(error) {
        console.error('❌ Error del cliente Discord:', error);
    }

    async start() {
        try {
            console.log('🚀 Iniciando Mancy...');
            console.log('🌐 APIs Nativas: Quotable & Wikipedia listas');
            await this.client.login(process.env.DISCORD_BOT_TOKEN);
        } catch (error) {
            console.error('❌ Error al iniciar el bot:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        console.log('🔄 Guardando memorias...');
        this.saveMemories();
        console.log('👋 Desconectando...');
        this.client.destroy();
        console.log('✅ Bot apagado');
    }
}

// ========== INICIAR BOT ==========
const bot = new DiscordBot();

async function initializeAndStartBot() {
    await bot.start();
}

// Iniciar si es el archivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
    initializeAndStartBot().catch(console.error);
    
    process.on('SIGTERM', async () => {
        console.log('SIGTERM recibido, apagando bot...');
        await bot.shutdown();
        process.exit(0);
    });
    
    process.on('SIGINT', async () => {
        console.log('SIGINT recibido, apagando bot...');
        await bot.shutdown();
        process.exit(0);
    });
}

export { bot, initializeAndStartBot };
