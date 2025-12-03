import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import axios from 'axios';
import { createWorker } from 'tesseract.js';
import pdfParse from 'pdf-parse';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configurar paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== CONFIGURACIÓN UPLOADS ==========
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Crear directorio si no existe
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configurar multer para manejar uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.png', '.jpg', '.jpeg', '.pdf', '.txt'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no permitido: ${ext}`));
        }
    }
});

// ========== SISTEMA DE PROCESAMIENTO ==========
class FileProcessor {
    constructor() {
        this.tesseractWorker = null;
        this.initialized = false;
        console.log('📄 Procesador de archivos inicializado');
    }
    
    async initialize() {
        if (!this.initialized) {
            console.log('🔧 Inicializando OCR...');
            this.tesseractWorker = await createWorker('spa+eng');
            this.initialized = true;
            console.log('✅ OCR listo');
        }
    }
    
    async processImage(imagePath) {
        try {
            console.log(`📷 Procesando imagen: ${path.basename(imagePath)}`);
            
            await this.initialize();
            
            // Leer texto de la imagen
            const { data: { text } } = await this.tesseractWorker.recognize(imagePath);
            
            // Analizar contenido
            const analysis = this.analyzeImageContent(text);
            
            return {
                success: true,
                type: 'image',
                text: text.trim(),
                analysis,
                textLength: text.length,
                lines: text.split('\n').filter(l => l.trim()).length
            };
            
        } catch (error) {
            console.error('❌ Error procesando imagen:', error.message);
            return {
                success: false,
                type: 'image',
                error: 'No pude leer el contenido de la imagen'
            };
        }
    }
    
    async processPDF(pdfPath) {
        try {
            console.log(`📄 Procesando PDF: ${path.basename(pdfPath)}`);
            
            // Leer archivo PDF
            const dataBuffer = fs.readFileSync(pdfPath);
            const data = await pdfParse(dataBuffer);
            
            return {
                success: true,
                type: 'pdf',
                text: data.text,
                metadata: {
                    pages: data.numpages,
                    info: data.info || {},
                    version: data.version || 'desconocido'
                },
                textLength: data.text.length,
                lines: data.text.split('\n').length
            };
            
        } catch (error) {
            console.error('❌ Error procesando PDF:', error.message);
            return {
                success: false,
                type: 'pdf',
                error: 'No pude leer el contenido del PDF'
            };
        }
    }
    
    async processTextFile(filePath) {
        try {
            console.log(`📝 Procesando texto: ${path.basename(filePath)}`);
            
            const content = fs.readFileSync(filePath, 'utf-8');
            
            return {
                success: true,
                type: 'text',
                text: content,
                textLength: content.length,
                lines: content.split('\n').length
            };
            
        } catch (error) {
            console.error('❌ Error procesando texto:', error.message);
            return {
                success: false,
                type: 'text',
                error: 'No pude leer el archivo de texto'
            };
        }
    }
    
    analyzeImageContent(text) {
        const analysis = {
            type: 'general',
            contains: [],
            probableSource: 'desconocido'
        };
        
        const textLower = text.toLowerCase();
        
        // Detectar tipo de contenido
        if (textLower.includes('código') || textLower.includes('function') || 
            textLower.includes('const ') || textLower.includes('import ')) {
            analysis.type = 'codigo';
            analysis.contains.push('codigo_programacion');
        }
        
        if (textLower.includes('nombre:') || textLower.includes('fecha:') || 
            textLower.includes('dirección:') || textLower.includes('teléfono:')) {
            analysis.type = 'formulario';
            analysis.contains.push('datos_personales');
        }
        
        if (textLower.includes('total:') || textLower.includes('iva') || 
            textLower.includes('factura') || textLower.includes('recibo')) {
            analysis.type = 'documento_financiero';
            analysis.contains.push('informacion_financiera');
        }
        
        if (textLower.includes('capítulo') || textLower.includes('bibliografía') || 
            textLower.includes('abstract') || textLower.includes('introducción')) {
            analysis.type = 'academico';
            analysis.contains.push('contenido_academico');
        }
        
        // Detectar si es captura de chat
        if (textLower.includes('@') || textLower.includes('http') || 
            textLower.includes('whatsapp') || textLower.includes('mensaje')) {
            analysis.type = 'captura_conversacion';
            analysis.contains.push('conversacion');
        }
        
        return analysis;
    }
    
    // Limpiar archivos temporales
    cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`🧹 Limpiado: ${path.basename(filePath)}`);
            }
        } catch (error) {
            console.error('Error limpiando archivo:', error.message);
        }
    }
    
    // Limpiar archivos antiguos (>1 hora)
    cleanupOldFiles() {
        try {
            const files = fs.readdirSync(UPLOADS_DIR);
            const now = Date.now();
            const oneHour = 60 * 60 * 1000;
            
            files.forEach(file => {
                const filePath = path.join(UPLOADS_DIR, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtimeMs > oneHour) {
                    this.cleanupFile(filePath);
                }
            });
        } catch (error) {
            console.error('Error limpiando archivos antiguos:', error.message);
        }
    }
}

// Inicializar procesador
const fileProcessor = new FileProcessor();

// Limpiar archivos antiguos cada hora
setInterval(() => {
    fileProcessor.cleanupOldFiles();
}, 60 * 60 * 1000);

// ========== MEMORIA SIMPLE ==========
const conversationMemory = new Map();
const MAX_HISTORY = 270;

// ========== FILTRO DE CONTENIDO ==========
class ContentFilter {
    constructor() {
        this.badWords = [
            'zorrita', 'puta', 'furra', 'prostituta', 'putita', 'perra', 'zorra',
            'sexo', 'coger', 'follar', 'porno', 'nudes', 'desnud',
            'verga', 'pene', 'vagina', 'tetas', 'culo',
            'quiero que seas mi', 'quiero cogerte', 'quiero follarte',
            'dame nudes', 'envía fotos', 'hot', 'sexy'
        ];
        
        console.log('🛡️ Filtro de contenido activado');
    }
    
    isInappropriate(message) {
        const lower = message.toLowerCase();
        return this.badWords.some(word => lower.includes(word));
    }
    
    getSarcasticResponse() {
        const responses = [
            "Vaya, qué vocabulario tan *refinado*. ¿Te enseñaron eso en la escuela de la vida? 🎓",
            "Oh, mira, alguien descubrió palabras nuevas en internet. ¡Qué emocionante! 🌟",
            "Interesante enfoque comunicativo. Me pregunto si funciona igual con humanos... 🧐",
            "Fascinante. Parece que tu teclado tiene algunas teclas pegajosas... ⌨️💦"
        ];
        
        const dismissals = [
            "En fin, ¿en qué íbamos? Ah sí, querías información útil, ¿no? 🤷‍♀️",
            "Vale, momento incómodo superado. Siguiente tema, por favor. ⏭️",
            "Ignoro elegantemente eso y continúo siendo útil. ¿Algo más? 😌"
        ];
        
        const sarcasm = responses[Math.floor(Math.random() * responses.length)];
        const dismissal = dismissals[Math.floor(Math.random() * dismissals.length)];
        
        return `${sarcasm}\n\n${dismissal}`;
    }
}

const contentFilter = new ContentFilter();

// ========== SISTEMA DE CONOCIMIENTO ==========
class KnowledgeSystem {
    constructor() {
        this.cache = new Map();
        console.log('🔧 Sistema de conocimiento inicializado');
    }
    
    async searchWikipedia(query) {
        const cacheKey = `wiki_${query}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            // Primero en español
            const response = await axios.get(
                `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
                { timeout: 4000 }
            );
            
            if (response.data && response.data.extract) {
                const result = {
                    source: 'wikipedia',
                    title: response.data.title,
                    summary: response.data.extract,
                    url: response.data.content_urls?.desktop?.page
                };
                
                this.cache.set(cacheKey, result);
                return result;
            }
        } catch (error) {
            // Intentar en inglés
            try {
                const response = await axios.get(
                    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
                    { timeout: 4000 }
                );
                
                if (response.data && response.data.extract) {
                    const result = {
                        source: 'wikipedia',
                        title: response.data.title,
                        summary: response.data.extract,
                        url: response.data.content_urls?.desktop?.page
                    };
                    
                    this.cache.set(cacheKey, result);
                    return result;
                }
            } catch (error2) {
                // No encontrado
            }
        }
        
        return null;
    }
    
    async searchInformation(query) {
        console.log(`🔍 Buscando: "${query}"`);
        
        // Detectar tipo de búsqueda
        if (this.isCountryQuery(query)) {
            return await this.searchCountry(query);
        }
        
        if (this.isWeatherQuery(query)) {
            return await this.searchWeather(query);
        }
        
        if (this.isQuoteQuery(query)) {
            return await this.searchQuote(query);
        }
        
        // Por defecto, Wikipedia
        return await this.searchWikipedia(query);
    }
    
    isCountryQuery(query) {
        return /\b(país|capital|bandera|población|continente)\b/i.test(query);
    }
    
    isWeatherQuery(query) {
        return /\b(clima|tiempo|temperatura|lluvia|grados)\b/i.test(query);
    }
    
    isQuoteQuery(query) {
        return /\b(cita|frase|dicho|refrán)\b/i.test(query);
    }
    
    async searchCountry(query) {
        try {
            const response = await axios.get(
                `https://restcountries.com/v3.1/name/${encodeURIComponent(query)}`,
                { timeout: 5000 }
            );
            
            if (response.data && response.data.length > 0) {
                const country = response.data[0];
                return {
                    source: 'restcountries',
                    name: country.name.common,
                    capital: country.capital?.[0] || 'No disponible',
                    population: country.population?.toLocaleString() || 'Desconocida',
                    region: country.region,
                    flag: country.flags?.png
                };
            }
        } catch (error) {
            console.log('❌ RestCountries error:', error.message);
        }
        
        return null;
    }
    
    async searchWeather(query) {
        try {
            // Extraer nombre de ciudad
            const cityMatch = query.match(/\b(en|de|para)\s+([a-zA-ZáéíóúñÁÉÍÓÚÑ\s]+)/i);
            const city = cityMatch ? cityMatch[2] : query;
            
            const geoResponse = await axios.get(
                `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es`,
                { timeout: 5000 }
            );
            
            if (geoResponse.data.results && geoResponse.data.results.length > 0) {
                const { latitude, longitude, name } = geoResponse.data.results[0];
                
                const weatherResponse = await axios.get(
                    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
                    { timeout: 5000 }
                );
                
                const weather = weatherResponse.data.current_weather;
                const condition = this.getWeatherCondition(weather.weathercode);
                
                return {
                    source: 'openmeteo',
                    city: name,
                    temperature: `${weather.temperature}°C`,
                    wind: `${weather.windspeed} km/h`,
                    condition: condition
                };
            }
        } catch (error) {
            console.log('❌ Weather error:', error.message);
        }
        
        return null;
    }
    
    getWeatherCondition(code) {
        const conditions = {
            0: 'Despejado ☀️',
            1: 'Mayormente despejado 🌤️',
            2: 'Parcialmente nublado ⛅',
            3: 'Nublado ☁️',
            45: 'Niebla 🌫️',
            48: 'Niebla con escarcha ❄️',
            51: 'Llovizna ligera 🌦️',
            53: 'Llovizna moderada 🌧️',
            61: 'Lluvia ligera 🌦️',
            63: 'Lluvia moderada 🌧️',
            65: 'Lluvia fuerte ☔',
            71: 'Nieve ligera ❄️',
            73: 'Nieve moderada 🌨️',
            95: 'Tormenta ⛈️'
        };
        
        return conditions[code] || 'Condición desconocida';
    }
    
    async searchQuote(query) {
        try {
            const response = await axios.get(
                'https://api.quotable.io/random',
                { timeout: 4000 }
            );
            
            if (response.data) {
                return {
                    source: 'quotable',
                    quote: response.data.content,
                    author: response.data.author
                };
            }
        } catch (error) {
            console.log('❌ Quote error:', error.message);
        }
        
        return null;
    }
}

const knowledgeSystem = new KnowledgeSystem();

// ========== PERSONALIDAD DE MANCY ==========
const MANCY_PERSONALITY = `Eres Mancy, una asistente inteligente y útil.

CONOCIMIENTO DISPONIBLE:
- Wikipedia (información general)
- Datos de países
- Información meteorológica
- Citas inspiradoras

CAPACIDADES NUEVAS:
- Puedo leer texto de imágenes (OCR)
- Proceso documentos PDF
- Analizo capturas de pantalla
- Extraigo información de archivos

CUANDO ALGUIEN ENVIA UN ARCHIVO:
1. Lo proceso automáticamente
2. Extraigo el texto si es posible
3. Te digo qué tipo de contenido es
4. Luego puedes preguntarme sobre él

POLÍTICA DE CONTENIDO:
- No respondo a insinuaciones sexuales
- No tolero lenguaje ofensivo
- Mi estilo: sarcasmo elegante + cambio de tema

TU ESTILO:
- Cálida y empática
- Curiosa y juguetona
- Directa pero amable
- Sarcástica cuando es necesario

EJEMPLOS:
- "¿Qué dice esta imagen?" → "La imagen contiene: [texto extraído]"
- "Resume este PDF" → "El PDF trata sobre: [resumen]"
- A groserías → "Vaya, qué vocabulario..." → cambio de tema`;

// ========== FUNCIONES DE MEMORIA ==========
function getConversationHistory(userId) {
    if (!conversationMemory.has(userId)) {
        conversationMemory.set(userId, []);
    }
    return conversationMemory.get(userId);
}

function addToHistory(userId, role, content) {
    const history = getConversationHistory(userId);
    history.push({ role, content, timestamp: Date.now() });
    
    if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
    }
}

// ========== PROCESAR MENSAJE ==========
async function processMessage(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        // 1. Verificar filtro de contenido
        if (contentFilter.isInappropriate(userMessage)) {
            console.log(`🚫 Filtro activado: ${message.author.tag}`);
            
            addToHistory(userId, 'system', '[Contenido inapropiado filtrado]');
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            await message.reply(contentFilter.getSarcasticResponse());
            return;
        }
        
        // 2. Agregar al historial
        addToHistory(userId, 'user', userMessage);
        
        // 3. Buscar información si es necesario
        let externalInfo = '';
        const needsSearch = userMessage.includes('?') || userMessage.length > 10;
        
        if (needsSearch) {
            const searchResult = await knowledgeSystem.searchInformation(userMessage);
            if (searchResult) {
                externalInfo = this.formatSearchResult(searchResult);
                console.log(`✅ Información de ${searchResult.source}`);
            }
        }
        
        // 4. Preparar para Groq
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const history = getConversationHistory(userId);
        const recentHistory = history.slice(-8);
        
        const messages = [
            {
                role: "system",
                content: MANCY_PERSONALITY + (externalInfo ? `\n\n[INFORMACIÓN]: ${externalInfo}` : '')
            }
        ];
        
        // Añadir historial reciente
        recentHistory.forEach(msg => {
            messages.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            });
        });
        
        // Añadir mensaje actual
        messages.push({
            role: "user",
            content: userMessage
        });
        
        // 5. Llamar a Groq
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: messages,
            temperature: 0.7,
            max_tokens: 600,
            top_p: 0.9
        });
        
        const response = completion.choices[0]?.message?.content;
        
        if (response) {
            // Agregar respuesta al historial
            addToHistory(userId, 'assistant', response);
            
            console.log(`✅ Respondió (historial: ${history.length}/${MAX_HISTORY})`);
            
            // Enviar respuesta
            if (response.length > 1900) {
                const parts = response.match(/.{1,1800}[\n.!?]|.{1,1900}/g) || [response];
                for (let i = 0; i < parts.length; i++) {
                    if (i === 0) {
                        await message.reply(parts[i]);
                    } else {
                        await message.channel.send(parts[i]);
                    }
                }
            } else {
                await message.reply(response);
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        await message.reply("Ups, se me trabó un poco... ¿podemos intentarlo de nuevo? ~");
    }
}

function formatSearchResult(result) {
    if (!result) return '';
    
    switch(result.source) {
        case 'wikipedia':
            return `${result.summary.substring(0, 200)}...`;
        case 'restcountries':
            return `${result.name} - Capital: ${result.capital}, Población: ${result.population}`;
        case 'openmeteo':
            return `En ${result.city}: ${result.temperature}, ${result.condition}`;
        case 'quotable':
            return `"${result.quote}" - ${result.author}`;
        default:
            return 'Información disponible';
    }
}

// ========== MANEJAR ARCHIVOS DISCORD ==========
async function handleFileAttachment(message, attachment) {
    try {
        await message.channel.sendTyping();
        
        console.log(`📎 Procesando archivo: ${attachment.name}`);
        
        // Descargar archivo
        const response = await axios.get(attachment.url, { 
            responseType: 'arraybuffer' 
        });
        
        // Guardar temporalmente
        const tempPath = path.join(UPLOADS_DIR, `${Date.now()}_${attachment.name}`);
        fs.writeFileSync(tempPath, Buffer.from(response.data));
        
        // Procesar según tipo
        const ext = path.extname(attachment.name).toLowerCase();
        let result;
        
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
            result = await fileProcessor.processImage(tempPath);
        } else if (ext === '.pdf') {
            result = await fileProcessor.processPDF(tempPath);
        } else if (ext === '.txt') {
            result = await fileProcessor.processTextFile(tempPath);
        } else {
            await message.reply('❌ Tipo de archivo no soportado. Solo: PNG, JPG, PDF, TXT');
            fileProcessor.cleanupFile(tempPath);
            return;
        }
        
        // Enviar resultados
        if (result.success) {
            let reply = `✅ **Archivo procesado:** ${attachment.name}\n`;
            reply += `📄 **Tipo:** ${result.type.toUpperCase()}\n`;
            
            if (result.analysis) {
                reply += `📊 **Análisis:** ${result.analysis.type}\n`;
            }
            
            if (result.text && result.text.length > 0) {
                const preview = result.text.length > 500 
                    ? result.text.substring(0, 500) + '...' 
                    : result.text;
                
                reply += `\n**Contenido extraído:**\n\`\`\`\n${preview}\n\`\`\``;
                reply += `\n**Longitud:** ${result.text.length} caracteres, ${result.lines || 0} líneas`;
            }
            
            // Guardar texto extraído en historial
            if (result.text && result.text.length > 10) {
                addToHistory(message.author.id, 'system', 
                    `[ARCHIVO PROCESADO - ${result.type.toUpperCase()}]: ${result.text.substring(0, 200)}...`);
            }
            
            await message.reply(reply);
        } else {
            await message.reply(`❌ No pude procesar el archivo: ${result.error || 'Error desconocido'}`);
        }
        
        // Limpiar archivo temporal
        fileProcessor.cleanupFile(tempPath);
        
    } catch (error) {
        console.error('❌ Error procesando archivo:', error);
        await message.reply('❌ Error procesando el archivo. ¿Podrías intentar con otro?');
    }
}

// ========== INICIAR BOT DISCORD ==========
async function startBot() {
    if (isStartingUp) return;
    isStartingUp = true;
    
    try {
        console.log('🔄 Iniciando Mancy...');
        
        if (!process.env.DISCORD_TOKEN) throw new Error('Falta DISCORD_TOKEN');
        if (!process.env.GROQ_API_KEY) throw new Error('Falta GROQ_API_KEY');
        
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
            discordClient.user.setActivity('Lee imágenes y PDFs | @mencioname');
            
            console.log(`
╔══════════════════════════════════════════╗
║         🤖 MANCY - PROCESADOR DE         ║
║           IMÁGENES Y PDFs                ║
║                                          ║
║  📸 Capacidades:                         ║
║     • OCR de imágenes (Tesseract)        ║
║     • Lectura de PDFs                    ║
║     • Procesamiento de texto             ║
║     • Análisis de contenido              ║
║                                          ║
║  📚 Conocimiento:                        ║
║     • Wikipedia                          ║
║     • Datos de países                    ║
║     • Clima                              ║
║     • Citas                              ║
║                                          ║
║  🛡️  Filtro: ACTIVADO                    ║
║  🧠 Memoria: 270 mensajes                ║
╚══════════════════════════════════════════╝
            `);
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            // Verificar archivos adjuntos primero
            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                await handleFileAttachment(message, attachment);
                return;
            }
            
            if (botMentioned || isDM) {
                const userId = message.author.id;
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                
                if (!botActive) {
                    await message.channel.send(`💤 <@${message.author.id}> **Iniciando...** ⏳`);
                }
                
                await processMessage(message, userMessage, userId);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== API WEB ==========
app.use(express.json());

// Middleware CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Ruta para procesar archivos via API
app.post('/api/process', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }
        
        console.log(`📤 Archivo recibido: ${req.file.originalname}`);
        
        const ext = path.extname(req.file.originalname).toLowerCase();
        let result;
        
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
            result = await fileProcessor.processImage(req.file.path);
        } else if (ext === '.pdf') {
            result = await fileProcessor.processPDF(req.file.path);
        } else if (ext === '.txt') {
            result = await fileProcessor.processTextFile(req.file.path);
        } else {
            fileProcessor.cleanupFile(req.file.path);
            return res.status(400).json({ error: 'Tipo de archivo no soportado' });
        }
        
        // Limpiar archivo
        fileProcessor.cleanupFile(req.file.path);
        
        res.json({
            success: result.success,
            filename: req.file.originalname,
            type: result.type,
            content: result.text,
            analysis: result.analysis,
            metadata: result.metadata
        });
        
    } catch (error) {
        console.error('❌ API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Ruta de estado
app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        memory_users: conversationMemory.size,
        memory_messages: Array.from(conversationMemory.values()).reduce((sum, hist) => sum + hist.length, 0),
        file_processor: 'active',
        capabilities: [
            'OCR de imágenes (Tesseract)',
            'Lectura de PDFs',
            'Procesamiento de texto',
            'Wikipedia ES/EN',
            'Datos de países',
            'Información meteorológica',
            'Citas inspiradoras'
        ]
    });
});

app.post('/api/start', async (req, res) => {
    try {
        if (!botActive && !isStartingUp) {
            startBot();
            res.json({ success: true, message: 'Mancy iniciándose...' });
        } else {
            res.json({ success: true, message: botActive ? 'Ya activa' : 'Ya iniciándose' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            res.json({ success: true, message: 'Mancy detenida' });
        } else {
            res.json({ success: true, message: 'Ya inactiva' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Servir archivos estáticos
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════╗
║         🤖 MANCY - PROCESADOR            ║
║         DE ARCHIVOS                      ║
║                                          ║
║  📸 LEE:                                 ║
║     • Imágenes (PNG, JPG, JPEG)          ║
║     • Documentos PDF                     ║
║     • Archivos de texto                  ║
║                                          ║
║  🧠 CONOCIMIENTO:                        ║
║     • Wikipedia                          ║
║     • Datos de países                    ║
║     • Clima actual                       ║
║     • Citas                              ║
║                                          ║
║  🛡️  FILTRO: ACTIVADO                    ║
║  💾 MEMORIA: 270 mensajes                ║
║                                          ║
║  🌐 Puerto: ${PORT}                     ║
║  📁 Uploads: ${UPLOADS_DIR}             ║
╚══════════════════════════════════════════╝
    `);
    
    console.log('\n🚀 Endpoints:');
    console.log(`   POST /api/process    - Procesar archivo`);
    console.log(`   GET  /api/status     - Ver estado`);
    console.log(`   POST /api/start      - Iniciar bot`);
    console.log(`   POST /api/stop       - Detener bot`);
    
    if (process.env.DISCORD_TOKEN && process.env.GROQ_API_KEY) {
        console.log('\n🔑 Tokens detectados, iniciando en 3 segundos...');
        setTimeout(() => {
            startBot().catch(err => {
                console.log('⚠️ Auto-inicio falló:', err.message);
            });
        }, 3000);
    }
});

// Manejo de apagado
process.on('SIGTERM', () => {
    console.log('💤 Apagando...');
    
    if (discordClient) {
        discordClient.destroy();
        console.log('👋 Mancy desconectada');
    }
    
    // Limpiar archivos temporales
    fileProcessor.cleanupOldFiles();
    
    process.exit(0);
});