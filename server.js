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

// ========== PROCESADOR DE ARCHIVOS INTELIGENTE ==========
class SmartFileProcessor {
    constructor() {
        this.tesseractWorker = null;
        this.initialized = false;
        console.log('📄 Procesador de archivos inteligente inicializado');
    }
    
    async initialize() {
        if (!this.initialized) {
            console.log('🔧 Inicializando OCR...');
            this.tesseractWorker = await createWorker('spa+eng');
            this.initialized = true;
            console.log('✅ OCR listo');
        }
    }
    
    async analyzeImageForText(imagePath) {
        try {
            await this.initialize();
            
            // Análisis rápido si hay texto
            const { data: quickScan } = await this.tesseractWorker.recognize(imagePath, {
                rectangle: { top: 0, left: 0, width: 100, height: 100 }
            });
            
            // Si hay más de 10 caracteres detectados, probablemente tenga texto
            const hasText = quickScan.text.trim().length > 10;
            
            return {
                hasText,
                confidence: quickScan.confidence,
                quickText: quickScan.text.substring(0, 50)
            };
            
        } catch (error) {
            console.error('❌ Error analizando imagen:', error.message);
            return { hasText: false, confidence: 0, quickText: '' };
        }
    }
    
    async extractTextFromImage(imagePath) {
        try {
            await this.initialize();
            
            // OCR completo
            const { data: { text, confidence } } = await this.tesseractWorker.recognize(imagePath);
            
            // Limpiar texto: eliminar líneas vacías y espacios extras
            const cleanText = text
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n')
                .trim();
            
            return {
                success: true,
                text: cleanText,
                confidence,
                length: cleanText.length,
                lines: cleanText.split('\n').filter(l => l.trim()).length
            };
            
        } catch (error) {
            console.error('❌ Error en OCR:', error.message);
            return { success: false, error: 'Error en reconocimiento de texto' };
        }
    }
    
    async describeImage(imagePath) {
        try {
            // Usar Groq Vision para describir la imagen
            const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
            
            // Leer imagen como base64
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            
            const completion = await groqClient.chat.completions.create({
                model: "llama-3.2-11b-vision-preview",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Describe esta imagen en español. Si tiene texto visible, menciónalo pero NO lo transcribas completo. Solo di qué tipo de texto es (ej: 'tiene texto que parece un meme', 'hay subtítulos', 'hay letreros'). Sé conciso."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 150,
                temperature: 0.7
            });
            
            return {
                success: true,
                description: completion.choices[0]?.message?.content,
                hasVision: true
            };
            
        } catch (visionError) {
            console.log('⚠️ Vision AI no disponible, usando análisis básico');
            
            // Fallback: analizar rápidamente
            const analysis = await this.analyzeImageForText(imagePath);
            
            let description = "📸 **Imagen recibida**\n";
            
            if (analysis.hasText) {
                description += "🔤 Parece tener texto visible.\n";
                description += "💡 Usa: `!transcribir` para transcribir el texto\n";
                description += "     `!resumir` para que te lo explique";
            } else {
                description += "🖼️ Imagen sin texto aparente.\n";
                description += "📝 Si es una captura con texto, usa: `!transcribir`";
            }
            
            return {
                success: true,
                description,
                hasVision: false,
                hasText: analysis.hasText
            };
        }
    }
    
    async processPDF(pdfPath) {
        try {
            const dataBuffer = fs.readFileSync(pdfPath);
            const data = await pdfParse(dataBuffer);
            
            return {
                success: true,
                text: data.text,
                metadata: {
                    pages: data.numpages,
                    info: data.info || {}
                },
                textLength: data.text.length
            };
            
        } catch (error) {
            console.error('❌ Error procesando PDF:', error.message);
            return { success: false, error: 'Error leyendo PDF' };
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
    
    // Análisis inteligente de contenido
    analyzeImageContent(text) {
        const analysis = {
            type: 'general',
            contains: [],
            probableSource: 'desconocido'
        };
        
        const textLower = text.toLowerCase();
        
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
        
        if (textLower.includes('@') || textLower.includes('http') || 
            textLower.includes('whatsapp') || textLower.includes('mensaje')) {
            analysis.type = 'captura_conversacion';
            analysis.contains.push('conversacion');
        }
        
        if (textLower.includes('meme') || textLower.includes('lol') || 
            textLower.includes('jajaja') || textLower.includes('xd') ||
            textLower.includes('chiste') || textLower.includes('funny')) {
            analysis.type = 'meme_chiste';
            analysis.contains.push('humor');
        }
        
        return analysis;
    }
    
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

// Inicializar procesador INTELIGENTE
const fileProcessor = new SmartFileProcessor();

// Limpiar archivos antiguos cada hora
setInterval(() => {
    fileProcessor.cleanupOldFiles();
}, 60 * 60 * 1000);

// ========== MEMORIA DE COMANDOS POR USUARIO ==========
const userFileContext = new Map(); // userId -> {filePath, fileName, type, hasText, timestamp}

// ========== MEMORIA DE CONVERSACIÓN ==========
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
        
        if (this.isQuoteQuery(query)) {
            return await this.searchQuote(query);
        }
        
        // Por defecto, Wikipedia
        return await this.searchWikipedia(query);
    }
    
    isCountryQuery(query) {
        return /\b(país|capital|bandera|población|continente)\b/i.test(query);
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
- Citas inspiradoras

CAPACIDADES DE PROCESAMIENTO DE ARCHIVOS:
- TRANSCRIBO texto de imágenes (OCR)
- LEO documentos PDF
- LEO archivos de texto .txt
- Analizo capturas de pantalla con texto
- NO hago "lectura" general de imágenes, solo transcripción de texto

CUANDO ALGUIEN ENVIA UN ARCHIVO:
1. Si es PDF o TXT: ofrezco leer el contenido
2. Si es imagen: ofrezco transcribir el texto si lo tiene
3. Los archivos expiran después de 5 minutos sin usar

COMANDOS DISPONIBLES:
- !transcribir - Transcribir texto de imágenes
- !leer - Leer PDFs y archivos de texto
- !resumir - Resumir el contenido
- !describir - Descripción de imágenes
- !que-es - Análisis del tipo de documento

POLÍTICA DE CONTENIDO:
- No respondo a insinuaciones sexuales
- No tolero lenguaje ofensivo
- Mi estilo: sarcasmo elegante + cambio de tema

TU ESTILO:
- Cálida y empática
- Curiosa y juguetona
- Directa pero amable
- Sarcástica cuando es necesario
- Ofreces opciones en lugar de imponer`;

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

// ========== MANEJAR ARCHIVOS DISCORD ==========
async function handleFileAttachment(message, attachment) {
    try {
        await message.channel.sendTyping();
        
        console.log(`📎 Archivo recibido: ${attachment.name}`);
        
        // Descargar archivo
        const response = await axios.get(attachment.url, { 
            responseType: 'arraybuffer',
            timeout: 10000
        });
        
        // Guardar temporalmente
        const tempPath = path.join(UPLOADS_DIR, `${Date.now()}_${attachment.name}`);
        fs.writeFileSync(tempPath, Buffer.from(response.data));
        
        const ext = path.extname(attachment.name).toLowerCase();
        const userId = message.author.id;
        
        // Guardar contexto del archivo para este usuario
        userFileContext.set(userId, {
            filePath: tempPath,
            fileName: attachment.name,
            type: ext === '.pdf' ? 'pdf' : (ext === '.txt' ? 'text' : 'image'),
            timestamp: Date.now()
        });
        
        let reply = '';
        
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
            // PARA IMÁGENES: Solo transcribir texto, no "leer"
            const textAnalysis = await fileProcessor.analyzeImageForText(tempPath);
            const description = await fileProcessor.describeImage(tempPath);
            
            reply = `📸 **Imagen recibida:** ${attachment.name}\n\n`;
            
            if (description.hasVision) {
                reply += `**Descripción:** ${description.description}\n\n`;
            } else {
                reply += description.description + '\n\n';
            }
            
            // Ofrecer solo transcripción, no "lectura"
            if (textAnalysis.hasText) {
                reply += `🔤 **Parece tener texto.** Comando disponible:\n`;
                reply += `\`!transcribir\` - Transcribir el texto\n`;
                reply += `\`!resumir\` - Resumir el contenido\n`;
            } else {
                reply += `🖼️ **Sin texto aparente.** ¿Qué te gustaría hacer?\n`;
                reply += `\`!describir\` - Descripción más detallada\n`;
                reply += `\`!transcribir\` - Intentar transcribir (por si tiene texto)\n`;
            }
            
            // Guardar si tiene texto en el contexto
            userFileContext.get(userId).hasText = textAnalysis.hasText;
            
        } else if (ext === '.pdf') {
            // PARA PDFs: Leer contenido
            const fileInfo = await fileProcessor.processPDF(tempPath);
            
            reply = `📄 **PDF recibido:** ${attachment.name}\n\n`;
            reply += `📖 ${fileInfo.metadata.pages || '?'} páginas detectadas\n\n`;
            reply += `**Comandos disponibles:**\n`;
            reply += `\`!leer\` - Leer contenido del PDF\n`;
            reply += `\`!resumir\` - Resumir el contenido\n`;
            reply += `\`!pagina [número]\` - Leer página específica\n`;
            
        } else if (ext === '.txt') {
            // Para archivos de texto: Leer contenido
            const fileInfo = await fileProcessor.processTextFile(tempPath);
            
            reply = `📝 **Archivo de texto recibido:** ${attachment.name}\n\n`;
            reply += `📊 ${fileInfo.lines || 0} líneas, ${fileInfo.textLength || 0} caracteres\n\n`;
            reply += `**Comandos disponibles:**\n`;
            reply += `\`!leer\` - Leer contenido completo\n`;
            reply += `\`!resumir\` - Resumir el contenido`;
            
            // Guardar en contexto
            userFileContext.get(userId).hasText = true;
            
        } else {
            // Tipo no soportado
            reply = `❌ Tipo de archivo no soportado: ${ext}\n`;
            reply += `Soporto: PNG, JPG, JPEG, PDF, TXT`;
            fileProcessor.cleanupFile(tempPath);
            userFileContext.delete(userId);
        }
        
        // Agregar tiempo límite (5 minutos)
        reply += `\n⏰ *Tienes 5 minutos para usar comandos con este archivo*`;
        
        await message.reply(reply);
        
    } catch (error) {
        console.error('❌ Error manejando archivo:', error);
        await message.reply('❌ Error procesando el archivo. ¿Podrías intentar con otro?');
    }
}

// ========== MANEJAR COMANDOS DE ARCHIVOS ==========
async function handleFileCommand(message, command, args) {
    const userId = message.author.id;
    const context = userFileContext.get(userId);
    
    if (!context) {
        await message.reply('❌ No tienes ningún archivo reciente. Envía un archivo primero.');
        return;
    }
    
    // Verificar si el archivo es muy viejo (>5 minutos)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    if (context.timestamp < fiveMinutesAgo) {
        await message.reply('⏰ El archivo ha expirado (más de 5 minutos). Envía uno nuevo.');
        userFileContext.delete(userId);
        fileProcessor.cleanupFile(context.filePath);
        return;
    }
    
    try {
        await message.channel.sendTyping();
        
        let result;
        
        switch(command) {
            case 'transcribir':
                // Solo para imágenes - transcribir texto
                if (context.type === 'image') {
                    result = await fileProcessor.extractTextFromImage(context.filePath);
                    
                    if (result?.success && result.text) {
                        const textPreview = result.text.length > 1000 
                            ? result.text.substring(0, 1000) + '...' 
                            : result.text;
                        
                        // Mensaje más natural para transcripción
                        let reply = `📸 **La imagen dice esto:**\n\`\`\`\n${textPreview}\n\`\`\``;
                        
                        // Estadísticas opcionales
                        if (result.confidence || result.length) {
                            reply += `\n📊 `;
                            
                            if (result.confidence) {
                                reply += `Confianza: ${Math.round(result.confidence)}%`;
                                if (result.length) reply += ` • `;
                            }
                            
                            if (result.length) {
                                reply += `${result.length} caracteres`;
                            }
                            
                            if (result.lines && result.lines > 1) {
                                reply += ` • ${result.lines} líneas`;
                            }
                        }
                        
                        // Análisis de contenido
                        const analysis = fileProcessor.analyzeImageContent(result.text);
                        if (analysis.type !== 'general') {
                            reply += `\n🔍 **Tipo detectado:** ${analysis.type}`;
                        }
                        
                        await message.reply(reply);
                        
                        // Guardar en memoria de conversación
                        addToHistory(userId, 'system', 
                            `[TEXTO TRANSCRITO DE IMAGEN - ${analysis.type}]: ${result.text.substring(0, 200)}...`);
                    } else {
                        await message.reply('❌ No pude transcribir texto. Puede que no haya texto legible.');
                    }
                } else {
                    await message.reply('❌ Este comando solo funciona con imágenes.');
                }
                break;
                
            case 'leer':
                // Solo para PDFs y archivos de texto
                if (context.type === 'pdf') {
                    result = await fileProcessor.processPDF(context.filePath);
                    
                    if (result?.success && result.text) {
                        const textPreview = result.text.length > 1000 
                            ? result.text.substring(0, 1000) + '...' 
                            : result.text;
                        
                        let reply = `📄 **Contenido del PDF:**\n\`\`\`\n${textPreview}\n\`\`\``;
                        reply += `\n📊 ${result.textLength} caracteres, ${result.metadata?.pages || 0} páginas`;
                        
                        await message.reply(reply);
                        
                        // Guardar en memoria de conversación
                        addToHistory(userId, 'system', 
                            `[CONTENIDO DE PDF]: ${result.text.substring(0, 200)}...`);
                    } else {
                        await message.reply('❌ No pude leer el PDF.');
                    }
                } else if (context.type === 'text') {
                    result = await fileProcessor.processTextFile(context.filePath);
                    
                    if (result?.success && result.text) {
                        const textPreview = result.text.length > 1000 
                            ? result.text.substring(0, 1000) + '...' 
                            : result.text;
                        
                        let reply = `📝 **Contenido del archivo:**\n\`\`\`\n${textPreview}\n\`\`\``;
                        reply += `\n📊 ${result.textLength} caracteres, ${result.lines} líneas`;
                        
                        await message.reply(reply);
                    } else {
                        await message.reply('❌ No pude leer el archivo de texto.');
                    }
                } else {
                    await message.reply('❌ Este comando solo funciona con PDFs y archivos de texto. Para imágenes usa: `!transcribir`');
                }
                break;
                
            case 'resumir':
                if (context.type === 'image') {
                    // Primero transcribir texto, luego resumir
                    const textResult = await fileProcessor.extractTextFromImage(context.filePath);
                    
                    if (textResult.success && textResult.text) {
                        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
                        
                        // Primero analizar el tipo
                        const analysis = fileProcessor.analyzeImageContent(textResult.text);
                        
                        const completion = await groqClient.chat.completions.create({
                            model: "llama-3.1-8b-instant",
                            messages: [
                                {
                                    role: "system",
                                    content: analysis.type === 'meme_chiste' 
                                        ? "Explica este meme o chiste de forma divertida pero breve en español."
                                        : "Resume el siguiente texto de forma concisa en español. Destaca los puntos principales."
                                },
                                {
                                    role: "user",
                                    content: textResult.text.substring(0, 2000)
                                }
                            ],
                            max_tokens: 200
                        });
                        
                        let reply = `📋 **Resumen:**\n${completion.choices[0]?.message?.content}`;
                        
                        if (analysis.type !== 'general') {
                            reply += `\n\n🔍 **Categoría:** ${analysis.type}`;
                        }
                        
                        await message.reply(reply);
                    } else {
                        await message.reply('❌ No hay texto para resumir en esta imagen.');
                    }
                } else if (context.type === 'pdf' || context.type === 'text') {
                    // Para PDFs y archivos de texto
                    const textResult = context.type === 'pdf' 
                        ? await fileProcessor.processPDF(context.filePath)
                        : await fileProcessor.processTextFile(context.filePath);
                    
                    if (textResult.success && textResult.text) {
                        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
                        
                        const completion = await groqClient.chat.completions.create({
                            model: "llama-3.1-8b-instant",
                            messages: [
                                {
                                    role: "system",
                                    content: "Resume el siguiente texto de forma concisa en español. Destaca los puntos principales."
                                },
                                {
                                    role: "user",
                                    content: textResult.text.substring(0, 3000)
                                }
                            ],
                            max_tokens: 250
                        });
                        
                        await message.reply(`📋 **Resumen:**\n${completion.choices[0]?.message?.content}`);
                    }
                }
                break;
                
            case 'describir':
                if (context.type === 'image') {
                    const description = await fileProcessor.describeImage(context.filePath);
                    await message.reply(`🎨 **Descripción:**\n${description.description}`);
                } else {
                    await message.reply('❌ Este comando solo funciona con imágenes.');
                }
                break;
                
            case 'que-es':
                if (context.type === 'image') {
                    const textAnalysis = await fileProcessor.analyzeImageForText(context.filePath);
                    let analysis = `🔍 **Análisis de la imagen:**\n`;
                    
                    if (textAnalysis.hasText) {
                        analysis += `• Tiene texto legible (${Math.round(textAnalysis.confidence)}% confianza)\n`;
                        analysis += `• Fragmento: "${textAnalysis.quickText}"\n`;
                        analysis += `• Posiblemente: documento, captura, meme o letrero`;
                    } else {
                        analysis += `• Sin texto detectable\n`;
                        analysis += `• Probablemente: paisaje, foto, ilustración o imagen abstracta`;
                    }
                    
                    await message.reply(analysis);
                } else {
                    await message.reply(`📄 **Tipo de archivo:** ${context.type.toUpperCase()}`);
                }
                break;
                
            default:
                await message.reply(`❌ Comando no reconocido. Comandos disponibles:\n` +
                    `• \`!transcribir\` - Transcribir texto de imágenes\n` +
                    `• \`!leer\` - Leer PDFs y archivos de texto\n` +
                    `• \`!resumir\` - Resumir contenido\n` +
                    `• \`!describir\` - Descripción de imágenes\n` +
                    `• \`!que-es\` - Análisis del documento`);
        }
        
        // Limpiar archivo después de usar
        fileProcessor.cleanupFile(context.filePath);
        userFileContext.delete(userId);
        
    } catch (error) {
        console.error('❌ Error en comando de archivo:', error);
        await message.reply('❌ Error procesando el comando.');
        
        // Limpiar en caso de error
        if (context?.filePath) {
            fileProcessor.cleanupFile(context.filePath);
        }
        userFileContext.delete(userId);
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
                externalInfo = formatSearchResult(searchResult);
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
        case 'quotable':
            return `"${result.quote}" - ${result.author}`;
        default:
            return 'Información disponible';
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
            discordClient.user.setActivity('Transcribe y lee archivos | @mencioname');
            
            console.log(`
╔══════════════════════════════════════════╗
║         🤖 MANCY MEJORADA                ║
║   PROCESAMIENTO INTELIGENTE DE ARCHIVOS  ║
║                                          ║
║  📸 CAPACIDADES:                         ║
║     • Transcribir texto de imágenes      ║
║     • Leer documentos PDF                ║
║     • Leer archivos de texto .txt        ║
║     • NO "leer" imágenes sin texto       ║
║                                          ║
║  📚 CONOCIMIENTO:                        ║
║     • Wikipedia ES/EN                    ║
║     • Datos de países                    ║
║     • Citas inspiradoras                 ║
║                                          ║
║  🛡️  FILTRO: ACTIVADO                    ║
║  🧠 Memoria: 270 mensajes                ║
║  ⏰ Archivos: 5 minutos de vida          ║
╚══════════════════════════════════════════╝
            `);
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            // 1. Manejar archivos adjuntos primero
            if (message.attachments.size > 0) {
                const attachment = message.attachments.first();
                await handleFileAttachment(message, attachment);
                return;
            }
            
            // 2. Manejar comandos de archivos (¡NO requiere mención!)
            const content = message.content.toLowerCase().trim();
            if (content.startsWith('!')) {
                const command = content.substring(1).split(' ')[0];
                const args = content.substring(command.length + 2).split(' ');
                
                const fileCommands = ['transcribir', 'leer', 'resumir', 'describir', 'que-es', 'pagina'];
                
                if (fileCommands.includes(command)) {
                    await handleFileCommand(message, command, args);
                    return;
                }
            }
            
            // 3. Conversación normal (solo si mencionan o es DM)
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
            // Usar sistema inteligente
            const textAnalysis = await fileProcessor.analyzeImageForText(req.file.path);
            const description = await fileProcessor.describeImage(req.file.path);
            const ocrResult = await fileProcessor.extractTextFromImage(req.file.path);
            
            result = {
                success: ocrResult.success,
                filename: req.file.originalname,
                type: 'image',
                text: ocrResult.text,
                analysis: {
                    hasText: textAnalysis.hasText,
                    confidence: textAnalysis.confidence,
                    description: description.description,
                    hasVision: description.hasVision
                },
                metadata: {
                    textLength: ocrResult.length,
                    confidence: ocrResult.confidence
                }
            };
            
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
        file_contexts: userFileContext.size,
        file_processor: 'smart_processor_active',
        capabilities: [
            'Transcripción de texto de imágenes (OCR)',
            'Lectura de documentos PDF',
            'Lectura de archivos de texto .txt',
            'Wikipedia ES/EN',
            'Datos de países',
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
║         🤖 MANCY MEJORADA                ║
║   PROCESAMIENTO INTELIGENTE DE ARCHIVOS  ║
║                                          ║
║  📸 CAPACIDADES:                         ║
║     • Transcribir texto de imágenes      ║
║     • Leer documentos PDF                ║
║     • Leer archivos de texto .txt        ║
║     • NO "leer" imágenes sin texto       ║
║                                          ║
║  📚 CONOCIMIENTO:                        ║
║     • Wikipedia                          ║
║     • Datos de países                    ║
║     • Citas inspiradoras                 ║
║                                          ║
║  🛡️  FILTRO: ACTIVADO                    ║
║  💾 MEMORIA: 270 mensajes                ║
║  ⏰ ARCHIVOS: 5 minutos de vida          ║
║                                          ║
║  🌐 Puerto: ${PORT}                     ║
║  📁 Uploads: ${UPLOADS_DIR}             ║
╚══════════════════════════════════════════╝
    `);
    
    console.log('\n🚀 Endpoints:');
    console.log(`   POST /api/process    - Procesar archivo (sistema inteligente)`);
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
