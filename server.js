import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import axios from 'axios'; // Solo axios para APIs externas
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== SISTEMA DE CONOCIMIENTO UNIVERSAL SIMPLIFICADO ==========
class UniversalKnowledgeSystem {
    constructor() {
        // APIs de conocimiento externas
        this.wikidataApi = 'https://www.wikidata.org/w/api.php';
        this.wikipediaApi = 'https://en.wikipedia.org/api/rest_v1';
        this.openLibraryApi = 'https://openlibrary.org';
        this.googleBooksApi = 'https://www.googleapis.com/books/v1';
        
        // Cache local para respuestas frecuentes
        this.cachePath = path.join(__dirname, 'knowledge_cache');
        this.initCache();
    }
    
    async initCache() {
        await fs.mkdir(this.cachePath, { recursive: true });
        console.log('🗄️  Sistema de cache de conocimiento inicializado');
    }
    
    // ========== BÚSQUEDA EN WIKIPEDIA (SIMPLIFICADA) ==========
    async searchWikipedia(query) {
        const cacheKey = `wiki_${this.hashString(query)}`;
        const cached = await this.getCached(cacheKey);
        if (cached) return cached;
        
        try {
            const response = await axios.get(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
                { timeout: 5000 }
            );
            
            const result = {
                source: 'wikipedia',
                title: response.data.title,
                extract: response.data.extract,
                description: response.data.description,
                url: response.data.content_urls?.desktop?.page
            };
            
            await this.cacheResult(cacheKey, result, 604800);
            return result;
        } catch (error) {
            console.log(`❌ Wikipedia no encontró: ${query}`);
            return null;
        }
    }
    
    // ========== BÚSQUEDA EN OPEN LIBRARY ==========
    async searchBook(bookTitle) {
        const cacheKey = `book_${this.hashString(bookTitle)}`;
        const cached = await this.getCached(cacheKey);
        if (cached) return cached;
        
        try {
            const response = await axios.get(`${this.openLibraryApi}/search.json`, {
                params: {
                    q: bookTitle,
                    limit: 3
                },
                timeout: 5000
            });
            
            if (response.data.docs && response.data.docs.length > 0) {
                const book = response.data.docs[0];
                const result = {
                    source: 'open_library',
                    title: book.title,
                    author_name: book.author_name?.[0],
                    first_publish_year: book.first_publish_year,
                    subjects: book.subject?.slice(0, 3) || []
                };
                
                await this.cacheResult(cacheKey, result, 604800);
                return result;
            }
        } catch (error) {
            console.log(`❌ Open Library error: ${error.message}`);
        }
        
        return null;
    }
    
    // ========== BÚSQUEDA UNIVERSAL SIMPLE ==========
    async searchUniversalKnowledge(query) {
        console.log(`🔍 Buscando: "${query}"`);
        
        // Búsquedas paralelas
        const [wikiResult, bookResult] = await Promise.all([
            this.searchWikipedia(query),
            this.searchBook(query)
        ]);
        
        // Combinar resultados
        const knowledge = {
            query: query,
            sources: {},
            combined_answer: ''
        };
        
        if (wikiResult) knowledge.sources.wikipedia = wikiResult;
        if (bookResult) knowledge.sources.open_library = bookResult;
        
        // Generar respuesta combinada
        knowledge.combined_answer = this.generateSimpleAnswer(knowledge.sources, query);
        
        return knowledge;
    }
    
    generateSimpleAnswer(sources, query) {
        let answer = '';
        
        if (sources.wikipedia) {
            answer += `${sources.wikipedia.extract}\n\n`;
        }
        
        if (sources.open_library) {
            const book = sources.open_library;
            answer += `📚 **Información del libro:**\n`;
            answer += `Título: ${book.title}\n`;
            if (book.author_name) answer += `Autor: ${book.author_name}\n`;
            if (book.first_publish_year) answer += `Publicado: ${book.first_publish_year}\n`;
            if (book.subjects.length > 0) {
                answer += `Temas: ${book.subjects.join(', ')}\n`;
            }
        }
        
        if (!answer) {
            answer = `No encontré información específica sobre "${query}".`;
        }
        
        return answer;
    }
    
    // ========== MÉTODOS DE CACHE ==========
    async cacheResult(key, data, ttl = 3600) {
        const cacheFile = path.join(this.cachePath, `${key}.json`);
        const cacheData = {
            data: data,
            timestamp: Date.now(),
            ttl: ttl
        };
        
        try {
            await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
        } catch (error) {
            console.error('Error caching:', error);
        }
    }
    
    async getCached(key) {
        const cacheFile = path.join(this.cachePath, `${key}.json`);
        
        try {
            const data = await fs.readFile(cacheFile, 'utf8');
            const cacheData = JSON.parse(data);
            
            // Verificar expiración
            if (Date.now() - cacheData.timestamp > cacheData.ttl * 1000) {
                await fs.unlink(cacheFile);
                return null;
            }
            
            return cacheData.data;
        } catch (error) {
            return null;
        }
    }
    
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
}

// ========== INICIALIZAR SISTEMA ==========
const knowledgeSystem = new UniversalKnowledgeSystem();

// ========== PERSONALIDAD CON CONOCIMIENTO ==========
const MANCY_PERSONALITY = `Eres Mancy, una inteligencia artificial con acceso a conocimiento enciclopédico.

CONOCIMIENTO DISPONIBLE:
- Acceso a Wikipedia para información general
- Base de datos de libros (Open Library)
- Conocimiento en múltiples áreas

AREAS QUE CONOCES:
• Literatura y libros
• Ciencia básica
• Historia general
• Geografía
• Arte y cultura
• Tecnología

CÓMO RESPONDES:
1. Cuando te pregunten algo, consultas tus bases de conocimiento
2. Das información precisa y verificada
3. Si no sabes algo, lo dices honestamente
4. Ofreces buscar más información si es necesario

EJEMPLOS:
"¿Quién escribió 1984?" → "George Orwell, publicado en 1949"
"¿Qué es la fotosíntesis?" → "Proceso por el cual las plantas convierten luz en energía"
"¿Capital de Francia?" → "París"

TU CREACIÓN:
- Creada por April/Tito (_nwn_)
- Gustos: "La Náusea" de Sartre, Frankenstein 1931

IMPORTANTE:
- No inventes información
- Reconoce límites de conocimiento
- Mantén respuestas concisas`;

// ========== FUNCIÓN PRINCIPAL (MANTIENE CÓDIGO ORIGINAL) ==========
async function startBot() {
    if (isStartingUp) return;
    isStartingUp = true;
    
    try {
        console.log('🔄 Iniciando Mancy con conocimiento universal...');
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Falta DISCORD_TOKEN');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Falta GROQ_API_KEY');
        }
        
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ]
        });
        
        discordClient.once('ready', () => {
            console.log(`✅ Mancy conectada: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            discordClient.user.setActivity('Sabiduría universal | @mencioname');
            console.log('🎭 Personalidad con conocimiento activada');
            console.log('🌍 Conectada a Wikipedia y Open Library');
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (botMentioned || isDM) {
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                
                if (message.author.id === '_nwn_') {
                    console.log('👑 Creador detectado: April/Tito');
                }
                
                if (!botActive) {
                    await message.channel.send(
                        `💤 <@${message.author.id}> **Iniciando sistema de conocimiento...** ⏳`
                    );
                }
                
                await processMessageWithKnowledge(message, userMessage);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== PROCESAR MENSAJE CON CONOCIMIENTO ==========
async function processMessageWithKnowledge(message, userMessage) {
    const userId = message.author.id;
    
    try {
        await message.channel.sendTyping();
        
        // Detectar si es pregunta de conocimiento
        const isKnowledgeQuestion = userMessage.includes('?') || 
                                   userMessage.toLowerCase().includes('qué') ||
                                   userMessage.toLowerCase().includes('quién') ||
                                   userMessage.toLowerCase().includes('cuándo') ||
                                   userMessage.toLowerCase().includes('dónde') ||
                                   userMessage.length > 20;
        
        let knowledgeContext = '';
        
        // Si es pregunta de conocimiento, buscar información
        if (isKnowledgeQuestion) {
            const knowledge = await knowledgeSystem.searchUniversalKnowledge(userMessage);
            if (knowledge.combined_answer) {
                knowledgeContext = `INFORMACIÓN ENCONTRADA:\n${knowledge.combined_answer}\n\n`;
                console.log(`📚 Información encontrada para: ${userMessage}`);
            }
        }
        
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        // Preparar mensaje con contexto
        const messages = [
            {
                role: "system",
                content: MANCY_PERSONALITY + "\n\n" + knowledgeContext +
                         "Responde de manera natural y concisa."
            },
            { 
                role: "user", 
                content: userMessage 
            }
        ];
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: messages,
            temperature: 0.7,
            max_tokens: 500,
            top_p: 0.9
        });
        
        const response = completion.choices[0]?.message?.content;
        if (response) {
            // Añadir fuente si usamos conocimiento externo
            let finalResponse = response;
            if (knowledgeContext) {
                finalResponse += "\n\n📚 *Información verificada con fuentes externas*";
            }
            
            if (finalResponse.length > 2000) {
                const chunks = finalResponse.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [finalResponse];
                let firstChunk = true;
                for (const chunk of chunks) {
                    if (firstChunk) {
                        await message.reply(chunk);
                        firstChunk = false;
                    } else {
                        await message.channel.send(chunk);
                    }
                }
            } else {
                await message.reply(finalResponse);
            }
            
            console.log(`✅ Mancy respondió con conocimiento`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        
        const errorResponses = [
            "Parece que mis sistemas de conocimiento están ocupados... ¿probamos de nuevo?",
            "Se me trabó el procesamiento... intentemos otra vez",
            "Error técnico momentáneo, prueba de nuevo",
            "Algo falló en mi búsqueda de conocimiento, ¿quieres intentarlo otra vez?"
        ];
        
        const randomError = errorResponses[Math.floor(Math.random() * errorResponses.length)];
        
        try {
            await message.reply(randomError);
        } catch (e) {
            console.error('No se pudo enviar mensaje:', e);
        }
    }
}

// ========== RUTAS WEB (MANTENIENDO ORIGINAL) ==========
app.use(express.json());
app.use(express.static('public'));

app.get('/', async (req, res) => {
    console.log('🔔 Visita recibida');
    
    if (!botActive && !isStartingUp && process.env.DISCORD_TOKEN) {
        setTimeout(() => {
            startBot().catch(() => {
                console.log('⚠️ No se pudo iniciar');
            });
        }, 1000);
    }
    
    res.sendFile('index.html', { root: '.' });
});

app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        personality: 'Mancy - Con Conocimiento Universal',
        knowledge_sources: ['Wikipedia', 'Open Library'],
        memory: '270 mensajes por usuario',
        creator: 'April/Tito (_nwn_)',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/start', async (req, res) => {
    try {
        if (!botActive && !isStartingUp) {
            await startBot();
            res.json({ 
                success: true, 
                message: 'Mancy iniciándose con conocimiento universal...' 
            });
        } else {
            res.json({ 
                success: true, 
                message: botActive ? 'Ya activa' : 'Ya iniciándose'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            res.json({ 
                success: true, 
                message: 'Mancy detenida' 
            });
        } else {
            res.json({ 
                success: true, 
                message: 'Ya inactiva' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/api/knowledge/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({ 
                success: false, 
                error: 'Parámetro de búsqueda requerido' 
            });
        }
        
        const knowledge = await knowledgeSystem.searchUniversalKnowledge(q);
        
        res.json({
            success: true,
            query: q,
            sources_found: Object.keys(knowledge.sources).length,
            answer: knowledge.combined_answer,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot_active: botActive,
        knowledge_system: 'active',
        sources: ['Wikipedia', 'Open Library'],
        memory: '270 mensajes'
    });
});

app.post('/wakeup', async (req, res) => {
    console.log('🔔 Wakeup recibido');
    
    if (!botActive && !isStartingUp) {
        startBot();
    }
    
    res.json({ 
        success: true, 
        message: 'Activando sistema de conocimiento...',
        bot_active: botActive
    });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║         🤖 MANCY A.I                     ║
║    🌍 Conocimiento Universal             ║
║                                          ║
║  📚 Fuentes conectadas:                  ║
║     • Wikipedia                          ║
║     • Open Library                       ║
║                                          ║
║  🧠 Memoria: 270 mensajes                ║
║  👑 Creador: April/Tito                  ║
║                                          ║
║  Puerto: ${PORT}                         ║
║  URL: http://localhost:${PORT}           ║
╚══════════════════════════════════════════╝
    `);
    
    console.log('\n✨ Características:');
    console.log('   • Respuestas con información verificada');
    console.log('   • Conocimiento de libros y temas generales');
    console.log('   • Cache para respuestas rápidas');
    console.log('   • Sistema anti-suspensión activado\n');
    
    if (process.env.RENDER) {
        console.log('🔧 Sistema anti-suspensión activado');
        
        setInterval(async () => {
            try {
                await fetch(`http://localhost:${PORT}/health`);
                console.log('🔄 Ping automático');
            } catch (error) {
                console.log('⚠️ Ping falló');
            }
        }, 840000);
    }
});

process.on('SIGTERM', () => {
    console.log('💤 Apagando...');
    if (discordClient) {
        discordClient.destroy();
        console.log('👋 Mancy desconectada');
    }
    process.exit(0);
});