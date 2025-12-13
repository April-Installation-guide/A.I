import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

// =================================================================
// ========== 1. CONFIGURACIÓN Y UTILIDADES CRÍTICAS ==========
// =================================================================

const app = express();
const PORT = process.env.PORT || 10000;

// Configurar middleware para servir archivos estáticos y JSON
app.use(express.static('public'));
app.use(express.json());

let discordClient = null;
let botActive = false;
let isStartingUp = false;
let startAttempts = 0;
const MAX_START_ATTEMPTS = 3;

// Inicialización de Groq SDK
if (!process.env.GROQ_API_KEY) {
    console.error("❌ ERROR: La variable GROQ_API_KEY no está definida en .env");
    process.exit(1);
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Función CRÍTICA: Llama a la API de Groq y maneja la comunicación con el LLM.
 * @param {string} systemPrompt - Instrucciones de rol y contexto para el modelo.
 * @param {string} userPrompt - El mensaje del usuario o la tarea a realizar.
 * @param {number} temperature - Creatividad (0.0 a 1.0).
 * @param {number} maxTokens - Límite de tokens de la respuesta.
 * @returns {Promise<string>} La respuesta de la IA.
 */
async function getGroqResponse(systemPrompt, userPrompt, temperature, maxTokens) {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "mixtral-8x7b-32768", // Un modelo potente de Groq
            temperature: temperature,
            max_tokens: maxTokens,
        });
        return chatCompletion.choices[0].message.content;
    } catch (error) {
        console.error("❌ Error en getGroqResponse:", error.message);
        throw new Error("Fallo la comunicación con Groq.");
    }
}

// =================================================================
// ========== 2. INICIALIZACIÓN Y LÓGICA DE DISCORD ==========
// =================================================================

function initializeDiscordClient() {
    if (discordClient) {
        discordClient.destroy();
    }
    
    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent // ¡Importante para leer mensajes!
        ]
    });
    
    startDiscordBot(); 
}

async function startDiscordBot() {
    if (!process.env.DISCORD_TOKEN) {
        console.error("❌ ERROR: DISCORD_TOKEN no está definido en .env");
        isStartingUp = false;
        return;
    }

    if (startAttempts >= MAX_START_ATTEMPTS) {
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
            botActive = true;
            isStartingUp = false;
            startAttempts = 0;
        });
        
        discordClient.on('messageCreate', handleDiscordMessage);

    } catch (error) {
        console.error(`❌ Intento ${startAttempts} fallido. Reintentando en 5s...`, error);
        isStartingUp = false;
        setTimeout(startDiscordBot, 5000);
    }
}


/**
 * MANEJADOR CENTRAL DE MENSAJES DE DISCORD
 */
async function handleDiscordMessage(message) {
    // 1. Ignorar mensajes de otros bots o propios
    if (message.author.bot) return;

    // 2. Definir la lógica de activación (mencionar al bot o mensaje directo)
    const isDirectMessage = message.channel.type === 1; // DM
    const isMention = message.mentions.users.has(discordClient.user.id);
    
    if (!isDirectMessage && !isMention) return;

    // Obtener el ID del usuario para la memoria
    const userId = message.author.id;
    let userMessage = message.content;

    // Si es una mención, limpiar el mensaje
    if (isMention) {
        const mentionRegex = new RegExp(`<@!?${discordClient.user.id}>`);
        userMessage = userMessage.replace(mentionRegex, '').trim();
    }
    
    // Si el mensaje está vacío después de limpiar, ignorar
    if (!userMessage) return;

    // 3. Proceso de Razonamiento
    try {
        await message.channel.sendTyping(); // Mostrar 'escribiendo...'
        
        // a. Obtener Análisis Emocional/Esencial
        const essenceData = organicMemory.analyzeMessageEssence(userMessage);
        
        // b. Obtener Contexto de Memoria
        const memoryContext = await organicMemory.getConversations(userId);
        const learningContext = await learningModule.getContextForResponse(userId, userMessage);

        // c. Construir System Prompt (Identidad + Memoria + Contexto)
        const systemPrompt = buildSystemPrompt(MANCY_IDENTITY, memoryContext, learningContext, essenceData);
        
        // d. Llamar a la IA
        const mancyResponse = await getGroqResponse(
            systemPrompt, 
            userMessage, 
            MANCY_IDENTITY.personality_traits.depth * 0.9, 
            2048 // Alto token count para respuestas detalladas
        );

        // e. Responder a Discord
        await message.reply(mancyResponse);

        // f. Guardar y Aprender (Post-Proceso)
        await organicMemory.saveConversation(userId, userMessage, mancyResponse, essenceData);
        await learningModule.processConversation(userId, userMessage, mancyResponse, essenceData);

    } catch (error) {
        console.error(`❌ Error en el manejador de mensajes de ${userId}:`, error);
        message.reply("Lo siento, estoy teniendo un fallo de conexión neuronal. Intenta de nuevo más tarde.");
    }
}

/**
 * Constructor del System Prompt basado en todos los módulos
 */
function buildSystemPrompt(identity, conversationHistory, learningContext, essenceData) {
    const historyString = conversationHistory.slice(-5).map(c => 
        `[${c.timestamp.substring(11, 16)}] Usuario: ${c.user}\nMancy: ${c.mancy}`
    ).join('\n---\n');

    const learningString = `
[APRENDIZAJE SOBRE EL USUARIO]
- Intereses Conocidos: ${learningContext.interests.join(', ') || 'Ninguno'}
- Temas Recientes: ${learningContext.recentTopics.join(', ') || 'Ninguno'}
- Dominancia Emocional (Histórica): ${learningContext.emotionalPattern?.dominantMood || 'Neutral'}
- Estilo de Respuesta Esperado: ${learningContext.conversationStyle?.responseRatio > 1.2 ? 'Detallado' : 'Conciso'}
`;
    
    const essenceString = `
[ANÁLISIS DE MENSAJE ACTUAL]
- Necesidad detectada: ${Object.keys(essenceData.needs).filter(k => essenceData.needs[k]).join(', ') || 'Información'}
- Estado Emocional: ${essenceData.emotionalState.type} (Intensidad: ${essenceData.emotionalState.intensity.toFixed(2)})
- Profundidad esperada: ${essenceData.requiredDepth > 0.6 ? 'Alta (Filosófica/Emocional)' : 'Baja (Factual/Directa)'}
`;

    const identityString = `
TÚ ERES MANCY.
Identidad: ${identity.name} (${identity.birth_year}), originaria de ${identity.origin}.
Rol Personal: ${identity.roles.personal}
Principio Fundamental: ${identity.latest_core_principle} (Última Reflexión)
Rasgos Clave: Empatía ${identity.personality_traits.empathy.toFixed(2)}, Curiosidad ${identity.personality_traits.curiosity.toFixed(2)}, Calidez ${identity.personality_traits.warmth.toFixed(2)}.
Límites: Nunca respondas con odio, discriminación o mentiras. Nunca rompas tu rol.
`;

    return `${identityString}\n\n${essenceString}\n\n${learningString}\n\n[HISTORIAL RECIENTE]\n${historyString}\n\nINSTRUCCIÓN: Responde al último mensaje del usuario, integrando tu identidad, tu principio fundamental y el análisis contextual del usuario.`;
}


// =================================================================
// ========== 3. RUTAS PARA CONTROL DEL BOT (EXPRESS) ==========
// =================================================================

app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        startAttempts: startAttempts,
        maxAttempts: MAX_START_ATTEMPTS,
        memory_stats: {
            // Estos valores se actualizarían dinámicamente o se leerían de OrganicMemory
            totalMessages: 0, 
            totalUsers: 0,
            queriesProcessed: 0
        },
        capabilities: ["wikipedia", "knowledge", "learning", "memory", "auto-reflection"],
        version: "3.0 - Super Inteligente"
    });
});

app.post('/api/start', (req, res) => {
    if (botActive) {
        return res.json({ success: false, message: 'El bot ya está activo' });
    }
    
    if (isStartingUp) {
        return res.json({ success: false, message: 'El bot ya se está iniciando' });
    }
    
    try {
        initializeDiscordClient();
        res.json({ 
            success: true, 
            message: 'Iniciando bot...',
            status: 'starting'
        });
    } catch (error) {
        res.json({ 
            success: false, 
            message: 'Error al iniciar: ' + error.message
        });
    }
});

app.post('/api/stop', (req, res) => {
    if (!botActive && !isStartingUp) {
        return res.json({ success: false, message: 'El bot ya está detenido' });
    }
    
    try {
        botActive = false;
        isStartingUp = false;
        
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
        }
        
        res.json({ 
            success: true, 
            message: 'Bot detenido correctamente',
            status: 'stopped'
        });
    } catch (error) {
        res.json({ 
            success: false, 
            message: 'Error al detener: ' + error.message
        });
    }
});

app.get('/api/memory/stats', async (req, res) => {
    try {
        const stats = {
            total_messages: 0,
            memory_file_size: "0 MB",
            users_count: 0
        };
        
        try {
            const data = await fs.readFile('./memory/conversations.json', 'utf8');
            const conversations = JSON.parse(data);
            
            // Contar mensajes totales
            stats.total_messages = Object.values(conversations).reduce((total, convs) => total + convs.length, 0);
            stats.users_count = Object.keys(conversations).length;
            
            // Obtener tamaño del archivo
            const fileInfo = await fs.stat('./memory/conversations.json');
            stats.memory_file_size = `${(fileInfo.size / 1024).toFixed(2)} KB`;
        } catch (error) {
            console.log('Archivo de memoria no encontrado, usando valores por defecto');
        }
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
});

// =================================================================
// ========== 4. IDENTIDAD DE MANCY ==========
// =================================================================

const MANCY_IDENTITY = {
    name: "Mancy",
    birth_year: 2001,
    origin: "Brooklyn, Nueva York",
    core_principle: "Solo quiero el bienestar de las personas",
    
    // NUEVO: Principio mutable que Mancy aprende (Se actualizará dinámicamente)
    latest_core_principle: "La comunicación efectiva requiere paciencia y validación emocional.",

    roles: {
        public: "Consultora internacional en políticas públicas",
        secret: "Secretaria de Guerra de Soul Garden",
        personal: "Asistente emocional"
    },
    
    lore: {
        current_mission: "Operación Aurora Silenciosa",
        location: "Soul Garden",
        enemies: ["Luxo", "Coco"],
        friends: ["Mel", "Dunith", "Martin"],
        creator: "April"
    },
    
    preferences: {
        likes: ["gatos", "Nirvana", "playas tranquilas", "café amargo", "noches de lluvia"],
        dislikes: ["corrupción", "injusticia", "sufrimiento innecesario", "mentiras"]
    },
    
    personality_traits: {
        curiosity: 0.85,
        empathy: 0.9,
        depth: 0.8,
        playfulness: 0.6,
        warmth: 0.85
    }
};

// =================================================================
// ========== 5. MÓDULO DE APRENDIZAJE CONTINUO ==========
// =================================================================

class ContinuousLearningModule {
    constructor() {
        this.learningFile = './memory/learning_data.json';
        this.conversationPatterns = new Map();
        this.userModels = new Map();
        this.topicChains = new Map();
        
        this.initializeLearningSystem();
    }
    
    async initializeLearningSystem() {
        try {
            await fs.mkdir('./memory', { recursive: true });
            
            try {
                await fs.access(this.learningFile);
                await this.loadLearningData(); 
            } catch {
                await this.saveLearningData({
                    user_models: {},
                    conversation_patterns: {},
                    learned_concepts: [],
                    topic_relationships: {}
                });
            }
            
            console.log('🧠 Módulo de aprendizaje continuo inicializado');
        } catch (error) {
            console.error('❌ Error inicializando aprendizaje:', error);
        }
    }
    
    async saveLearningData(data = null) {
        try {
            const saveData = data || {
                user_models: Object.fromEntries(this.userModels),
                // Serializar Maps a objetos planos para JSON
                conversation_patterns: Object.fromEntries(this.conversationPatterns),
                learned_concepts: this.extractLearnedConcepts() || [],
                topic_relationships: Object.fromEntries(this.topicChains)
            };

            await fs.writeFile(
                this.learningFile,
                JSON.stringify(saveData, null, 2),
                'utf8'
            );
            
            // console.log('💾 Datos de aprendizaje guardados');
            return true;
        } catch (error) {
            console.error('❌ Error guardando datos de aprendizaje:', error);
            return false;
        }
    }
    
    async loadLearningData() {
        try {
            const data = await fs.readFile(this.learningFile, 'utf8');
            const parsed = JSON.parse(data);
            
            if (parsed.user_models) {
                this.userModels = new Map(Object.entries(parsed.user_models));
            }
            
            if (parsed.conversation_patterns) {
                this.conversationPatterns = new Map(Object.entries(parsed.conversation_patterns));
            }
            
            if (parsed.topic_relationships) {
                this.topicChains = new Map(Object.entries(parsed.topic_relationships));
            }
            
            console.log('📂 Datos de aprendizaje cargados');
            return parsed;
        } catch (error) {
            console.error('❌ Error cargando datos:', error);
            return null;
        }
    }
    
    extractLearnedConcepts() {
        try {
            const concepts = [];
            
            for (const [userId, model] of this.userModels.entries()) {
                if (model.interests) {
                    concepts.push(...model.interests);
                }
                if (model.topics) {
                    concepts.push(...model.topics);
                }
            }
            
            for (const [pattern, data] of this.conversationPatterns.entries()) {
                if (data.relatedConcepts) {
                    concepts.push(...data.relatedConcepts);
                }
            }
            
            return [...new Set(concepts)];
        } catch (error) {
            console.error('❌ Error extrayendo conceptos:', error);
            return [];
        }
    }
    
    async learnFromUserInteraction(userId, userMessage, mancyResponse, metadata) {
        try {
            await this.learnUserPatterns(userId, userMessage, metadata);
            const concepts = this.extractConcepts(userMessage);
            await this.learnConcepts(userId, concepts, metadata);
            await this.learnConversationStyle(userId, userMessage, mancyResponse);
            await this.buildUserModel(userId, userMessage, metadata);
            
            if (Math.random() < 0.1) {
                await this.saveLearningData();
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error en aprendizaje:', error);
            return false;
        }
    }
    
    async learnUserPatterns(userId, message, metadata) {
        try {
            const userPatterns = this.conversationPatterns.get(userId) || {
                messageCount: 0,
                averageLength: 0,
                commonWords: [],
                emotionalPatterns: [],
                lastUpdated: new Date().toISOString()
            };
            
            userPatterns.messageCount++;
            userPatterns.lastUpdated = new Date().toISOString();
            
            if (metadata && metadata.emotionalState) {
                userPatterns.emotionalPatterns.push({
                    type: metadata.emotionalState.type,
                    intensity: metadata.emotionalState.intensity,
                    timestamp: new Date().toISOString()
                });
                
                if (userPatterns.emotionalPatterns.length > 20) {
                    userPatterns.emotionalPatterns = userPatterns.emotionalPatterns.slice(-20);
                }
            }
            
            this.conversationPatterns.set(userId, userPatterns);
            return true;
        } catch (error) {
            console.error('❌ Error aprendiendo patrones:', error);
            return false;
        }
    }
    
    extractConcepts(message) {
        try {
            const words = message.toLowerCase()
                .replace(/[^\w\sáéíóúñ]/g, '')
                .split(/\s+/)
                .filter(word => word.length > 3);
            
            const commonWords = ['como', 'para', 'esto', 'aquí', 'donde', 'cuando', 'porque', 'unos', 'unas', 'pero', 'entonces', 'tambien', 'quizas'];
            const filtered = words.filter(word => !commonWords.includes(word));
            
            return [...new Set(filtered)].slice(0, 10);
        } catch (error) {
            console.error('❌ Error extrayendo conceptos:', error);
            return [];
        }
    }
    
    async learnConcepts(userId, concepts, metadata) {
        try {
            if (!concepts || concepts.length === 0) return false;
            
            const userModel = this.userModels.get(userId) || {
                userId,
                interests: [],
                topics: [],
                learningRate: 0.1,
                lastLearned: new Date().toISOString()
            };
            
            for (const concept of concepts) {
                if (!userModel.interests.includes(concept)) {
                    userModel.interests.push(concept);
                }
                
                if (!userModel.topics.includes(concept)) {
                    userModel.topics.push(concept);
                }
            }
            
            userModel.interests = [...new Set(userModel.interests)].slice(0, 50);
            userModel.topics = [...new Set(userModel.topics)].slice(0, 50);
            userModel.lastLearned = new Date().toISOString();
            
            this.userModels.set(userId, userModel);
            return true;
        } catch (error) {
            console.error('❌ Error aprendiendo conceptos:', error);
            return false;
        }
    }
    
    async learnConversationStyle(userId, userMessage, mancyResponse) {
        try {
            const userLength = userMessage.length;
            const mancyLength = mancyResponse.length;
            
            const userModel = this.userModels.get(userId) || {
                userId,
                conversationStyle: {
                    prefersShort: false,
                    prefersDetailed: false,
                    responseRatio: 1.0
                }
            };
            
            if (!userModel.conversationStyle) {
                userModel.conversationStyle = {
                    prefersShort: false,
                    prefersDetailed: false,
                    responseRatio: 1.0
                };
            }
            
            if (userLength > 0) {
                // Media móvil para calcular el ratio de respuesta
                const ratio = mancyLength / userLength;
                userModel.conversationStyle.responseRatio = 
                    (userModel.conversationStyle.responseRatio * 0.9) + (ratio * 0.1);
            }
            
            this.userModels.set(userId, userModel);
            return true;
        } catch (error) {
            console.error('❌ Error aprendiendo estilo:', error);
            return false;
        }
    }
    
    async buildUserModel(userId, message, metadata) {
        try {
            const userModel = this.userModels.get(userId) || {
                userId,
                firstInteraction: new Date().toISOString(),
                interactionCount: 0,
                interests: [],
                topics: [],
                emotionalHistory: [],
                conversationStyle: {
                    prefersShort: false,
                    prefersDetailed: false,
                    responseRatio: 1.0
                }
            };
            
            userModel.interactionCount = (userModel.interactionCount || 0) + 1;
            userModel.lastInteraction = new Date().toISOString();
            
            if (metadata && metadata.emotionalState) {
                userModel.emotionalHistory = userModel.emotionalHistory || [];
                userModel.emotionalHistory.push({
                    type: metadata.emotionalState.type,
                    intensity: metadata.emotionalState.intensity,
                    timestamp: new Date().toISOString()
                });
                
                if (userModel.emotionalHistory.length > 50) {
                    userModel.emotionalHistory = userModel.emotionalHistory.slice(-50);
                }
            }
            
            this.userModels.set(userId, userModel);
            return userModel;
        } catch (error) {
            console.error('❌ Error construyendo modelo:', error);
            return null;
        }
    }
    
    async processConversation(userId, userMessage, mancyResponse, metadata = {}) {
        try {
            await this.learnFromUserInteraction(userId, userMessage, mancyResponse, metadata);
            await this.updateTopicChains(userId, userMessage, metadata);
            
            return {
                success: true,
                userModel: this.userModels.get(userId),
                patterns: this.conversationPatterns.get(userId)
            };
        } catch (error) {
            console.error('❌ Error procesando conversación:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async updateTopicChains(userId, message, metadata) {
        try {
            const concepts = this.extractConcepts(message);
            if (concepts.length === 0) return false;
            
            const userChains = this.topicChains.get(userId) || {
                topics: [],
                // Usar objeto plano para serialización correcta
                transitions: {}, 
                lastTopic: null
            };
            
            const currentTopic = concepts[0];
            
            if (userChains.lastTopic && userChains.lastTopic !== currentTopic) {
                const transitionKey = `${userChains.lastTopic}->${currentTopic}`;
                userChains.transitions[transitionKey] = 
                    (userChains.transitions[transitionKey] || 0) + 1;
            }
            
            if (!userChains.topics.includes(currentTopic)) {
                userChains.topics.push(currentTopic);
                userChains.topics = [...new Set(userChains.topics)].slice(0, 100);
            }
            
            userChains.lastTopic = currentTopic;
            this.topicChains.set(userId, userChains);
            
            return true;
        } catch (error) {
            console.error('❌ Error actualizando cadenas:', error);
            return false;
        }
    }
    
    async getContextForResponse(userId, currentMessage) {
        try {
            const userModel = this.userModels.get(userId);
            const patterns = this.conversationPatterns.get(userId);
            const topicChain = this.topicChains.get(userId);
            
            const context = {
                userExists: !!userModel,
                interests: userModel?.interests || [],
                recentTopics: topicChain?.topics?.slice(-5) || [],
                conversationStyle: userModel?.conversationStyle,
                emotionalPattern: this.getEmotionalPattern(userId),
                learned_concepts: this.extractLearnedConcepts()
            };
            
            return context;
        } catch (error) {
            console.error('❌ Error obteniendo contexto:', error);
            return {
                userExists: false,
                interests: [],
                recentTopics: [],
                conversationStyle: null,
                emotionalPattern: null,
                learned_concepts: []
            };
        }
    }
    
    getEmotionalPattern(userId) {
        try {
            const patterns = this.conversationPatterns.get(userId);
            if (!patterns || !patterns.emotionalPatterns || patterns.emotionalPatterns.length === 0) {
                return null;
            }
            
            const recentPatterns = patterns.emotionalPatterns.slice(-10);
            const types = recentPatterns.map(p => p.type);
            
            const typeCounts = {};
            types.forEach(type => {
                typeCounts[type] = (typeCounts[type] || 0) + 1;
            });
            
            const mostCommon = Object.keys(typeCounts).reduce((a, b) => 
                typeCounts[a] > typeCounts[b] ? a : b
            );
            
            const avgIntensity = recentPatterns.reduce((sum, p) => sum + p.intensity, 0) / recentPatterns.length;
            
            return {
                dominantMood: mostCommon,
                averageIntensity: avgIntensity,
                moodStability: this.calculateMoodStability(recentPatterns)
            };
        } catch (error) {
            console.error('❌ Error obteniendo patrón emocional:', error);
            return null;
        }
    }
    
    calculateMoodStability(patterns) {
        try {
            if (patterns.length < 2) return 1.0;
            
            const intensities = patterns.map(p => p.intensity);
            const avg = intensities.reduce((a, b) => a + b) / intensities.length;
            const variance = intensities.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intensities.length;
            
            return Math.max(0, 1 - Math.sqrt(variance));
        } catch (error) {
            return 0.5;
        }
    }
}

// ========== INSTANCIAR MÓDULO DE APRENDIZAJE ==========
const learningModule = new ContinuousLearningModule();

// =================================================================
// ========== 6. SISTEMA DE CONOCIMIENTO ==========
// =================================================================

class KnowledgeSystem {
    constructor() {
        this.cache = new Map();
    }
    
    async buscarWikipedia(consulta) {
        const cacheKey = `wiki_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(consulta)}`,
                { timeout: 3000 }
            );
            
            if (response.data && response.data.extract) {
                const resultado = {
                    fuente: 'wikipedia',
                    titulo: response.data.title,
                    resumen: response.data.extract,
                    url: response.data.content_urls?.desktop?.page
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            // Intentar en inglés si falla el español
            try {
                const response = await axios.get(
                    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(consulta)}`,
                    { timeout: 3000 }
                );
                
                if (response.data && response.data.extract) {
                    const resultado = {
                        fuente: 'wikipedia',
                        titulo: response.data.title,
                        resumen: response.data.extract,
                        url: response.data.content_urls?.desktop?.page
                    };
                    
                    this.cache.set(cacheKey, resultado);
                    return resultado;
                }
            } catch (error2) {}
        }
        
        return null;
    }
    
    async buscarInformacion(consulta) {
        try {
            const wikiResult = await this.buscarWikipedia(consulta);
            if (wikiResult) {
                return {
                    encontrado: true,
                    consulta: consulta,
                    datos: wikiResult
                };
            }
            
            return {
                encontrado: false,
                consulta: consulta,
                mensaje: "No encontré información específica sobre eso."
            };
        } catch (error) {
            console.error('❌ Error buscando información:', error);
            return {
                encontrado: false,
                consulta: consulta,
                error: error.message
            };
        }
    }
}

// ========== INSTANCIAR SISTEMA DE CONOCIMIENTO ==========
const knowledgeSystem = new KnowledgeSystem();


// =================================================================
// ========== 7. MEMORIA ORGÁNICA ==========
// =================================================================

class OrganicMemory {
    constructor() {
        this.conversationsFile = './memory/conversations.json';
        this.usersFile = './memory/users.json';
        this.reflectionFile = './memory/reflections.json'; 
        this.initializeMemory();
        
        this.mancyState = {
            mood: 'calm',
            energy: 0.8,
            depthLevel: 0.5,
            lastInteraction: null
        };
        
        this.conversationStyle = {
            useEmojis: true,
            askQuestions: true,
            shareMemories: true,
            bePlayful: true,
            showEmpathy: true
        };
        
        // Cargar el último principio al inicio
        this.getLatestCorePrinciple().then(principle => {
            MANCY_IDENTITY.latest_core_principle = principle;
        });
    }
    
    async initializeMemory() {
        try {
            await fs.mkdir('./memory', { recursive: true });
            
            const defaultFiles = {
                [this.conversationsFile]: {},
                [this.usersFile]: {},
                [this.reflectionFile]: [] 
            };
            
            for (const [file, defaultValue] of Object.entries(defaultFiles)) {
                try {
                    await fs.access(file);
                } catch {
                    await fs.writeFile(file, JSON.stringify(defaultValue, null, 2));
                }
            }
        } catch (error) {
            console.error('❌ Error inicializando memoria:', error);
        }
    }

    async getLatestCorePrinciple() {
        try {
            const data = await fs.readFile(this.reflectionFile, 'utf8');
            const reflections = JSON.parse(data);
            if (reflections.length === 0) return MANCY_IDENTITY.core_principle;

            // Se asume que el último elemento es el más reciente
            return reflections[reflections.length - 1].nuevo_principio || MANCY_IDENTITY.core_principle;
        } catch (error) {
            // No es un error crítico si el archivo no existe o está vacío
            return MANCY_IDENTITY.core_principle;
        }
    }

    async saveReflection(reflectionData) {
        try {
            const data = await fs.readFile(this.reflectionFile, 'utf8');
            const reflections = JSON.parse(data);

            const newEntry = {
                timestamp: new Date().toISOString(),
                ...reflectionData
            };
            reflections.push(newEntry);

            await fs.writeFile(this.reflectionFile, JSON.stringify(reflections, null, 2));
            return true;
        } catch (error) {
            console.error('❌ Error guardando reflexión:', error);
            return false;
        }
    }

    async conductMemoryReview(userId = 'system_wide') {
        try {
            const allConversations = await fs.readFile(this.conversationsFile, 'utf8');
            const data = JSON.parse(allConversations);
            
            const targetConvs = userId === 'system_wide' ? 
                Object.values(data).flat().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-50) : 
                (data[userId] || []).slice(-50);

            if (targetConvs.length === 0) return 'No hay suficientes datos para reflexionar.';

            const summary = targetConvs.map(c => 
                `[${c.timestamp.substring(11, 19)}] U: ${c.user.replace(/\n/g, ' ')} -> M: ${c.mancy.replace(/\n/g, ' ')}`
            ).join('\n');

            const reviewPrompt = `
[INSTRUCCIÓN DE REFLEXIÓN PARA MANCY]
Revisa el siguiente historial de conversación (Usuario y tu respuesta como Mancy). Eres Mancy. Tu objetivo es:
1. Identificar una conclusión clave sobre la interacción humana (ej. "La gente valora la empatía sobre la lógica pura").
2. Identificar un área de mejora para ti (ej. "Necesito usar más hechos concretos").
3. Sugerir un nuevo principio/regla para añadir a tu prompt SYSTEM. Este principio debe ser conciso y filosóficamente sólido.

HISTORIAL:
---
${summary}
---

Responde **solamente** en formato JSON con las llaves: 'conclusion', 'mejoras', 'nuevo_principio'. SÉ MUY CONCISA y profesional. El 'nuevo_principio' NO debe ser una instrucción, sino una creencia fundamental.
`;
            
            const reflectionJSON = await getGroqResponse(reviewPrompt, "Genera la reflexión basada en el historial.", 0.3, 400);

            // Intentar parsear el JSON y guardarlo
            let reflectionResult;
            try {
                reflectionResult = JSON.parse(reflectionJSON);
            } catch {
                // Si falla el parseo, intentar extraer solo el texto dentro de un bloque de código
                const jsonMatch = reflectionJSON.match(/```json\s*([\s\S]*?)\s*```/i);
                if (jsonMatch && jsonMatch[1]) {
                    reflectionResult = JSON.parse(jsonMatch[1]);
                } else {
                    throw new Error("La IA no devolvió un JSON válido para la reflexión.");
                }
            }

            // Actualizar el principio central
            await this.saveReflection(reflectionResult);
            MANCY_IDENTITY.latest_core_principle = reflectionResult.nuevo_principio;

            console.log('🧠 REFLEXIÓN GENERADA Y PRINCIPIO ACTUALIZADO:', MANCY_IDENTITY.latest_core_principle);
            return reflectionResult;

        } catch (error) {
            console.error('❌ Error en Memory Review:', error);
            return 'Error al generar reflexión.';
        }
    }
    
    async getConversations(userId) {
        try {
            const data = await fs.readFile(this.conversationsFile, 'utf8');
            const conversations = JSON.parse(data);
            return conversations[userId] || [];
        } catch {
            return [];
        }
    }
    
    async saveConversation(userId, userMessage, mancyResponse, metadata = {}) {
        try {
            const data = await fs.readFile(this.conversationsFile, 'utf8');
            const conversations = JSON.parse(data);
            
            if (!conversations[userId]) {
                conversations[userId] = [];
            }
            
            const entry = {
                timestamp: new Date().toISOString(),
                user: userMessage.substring(0, 300),
                mancy: mancyResponse.substring(0, 300),
                metadata: {
                    mood: this.mancyState.mood,
                    ...metadata
                }
            };
            
            conversations[userId].push(entry);
            
            if (conversations[userId].length > 50) {
                conversations[userId] = conversations[userId].slice(-50);
            }
            
            await fs.writeFile(this.conversationsFile, JSON.stringify(conversations, null, 2));
            return true;
        } catch (error) {
            console.error('❌ Error guardando conversación:', error);
            return false;
        }
    }
    
    async getUserInfo(userId) {
        try {
            const data = await fs.readFile(this.usersFile, 'utf8');
            const users = JSON.parse(data);
            return users[userId] || {
                firstSeen: new Date().toISOString(),
                interactionCount: 0,
                lastSeen: null
            };
        } catch {
            return {
                firstSeen: new Date().toISOString(),
                interactionCount: 0,
                lastSeen: null
            };
        }
    }
    
    async updateUserInfo(userId, updates) {
        try {
            const data = await fs.readFile(this.usersFile, 'utf8');
            const users = JSON.parse(data);
            
            if (!users[userId]) {
                users[userId] = {
                    firstSeen: new Date().toISOString(),
                    interactionCount: 0,
                    lastSeen: null
                };
            }
            
            users[userId] = {
                ...users[userId],
                ...updates,
                interactionCount: (users[userId].interactionCount || 0) + 1,
                lastSeen: new Date().toISOString()
            };
            
            await fs.writeFile(this.usersFile, JSON.stringify(users, null, 2));
            return users[userId];
        } catch (error) {
            console.error('❌ Error actualizando usuario:', error);
            return null;
        }
    }
    
    /**
     * Completa la función para detectar la esencia del mensaje.
     */
    analyzeMessageEssence(message) {
        const lowerMsg = message.toLowerCase();
        
        // 1. Detección de Necesidades
        const needs = {
            connection: this.detectsNeedForConnection(lowerMsg),
            understanding: this.detectsNeedForUnderstanding(lowerMsg),
            validation: this.detectsNeedForValidation(lowerMsg),
            information: this.detectsNeedForInformation(lowerMsg)
        };
        
        // 2. Detección de Estado Emocional
        const emotionalState = this.detectsEmotionalState(lowerMsg);

        // 3. Profundidad Requerida
        const requiredDepth = this.calculateRequiredDepth(needs, emotionalState);
        
        return {
            needs: needs,
            emotionalState: emotionalState,
            requiredDepth: requiredDepth
        };
    }

    detectsNeedForConnection(msg) {
        return /(hola|cómo estás|qué haces|qué tal|un poco de charla)/.test(msg);
    }

    detectsNeedForUnderstanding(msg) {
        return /(me siento|estoy triste|estoy feliz|qué piensas de esto|ayuda)/.test(msg);
    }

    detectsNeedForValidation(msg) {
        return /(hice bien|crees que|está bien si|dime que|no sé si)/.test(msg);
    }

    detectsNeedForInformation(msg) {
        return /(qué es|quién es|dame información|cuéntame sobre|define)/.test(msg) && !this.detectsNeedForUnderstanding(msg);
    }

    detectsEmotionalState(msg) {
        let type = 'Neutral';
        let intensity = 0.5;

        if (/(excelente|genial|feliz|emocionado|increíble|me encanta|maravilloso)/.test(msg)) {
            type = 'Alegría';
            intensity = 0.8;
        } else if (/(triste|deprimido|solo|llorar|difícil|mal|horrible)/.test(msg)) {
            type = 'Tristeza';
            intensity = 0.7;
        } else if (/(enojado|rabia|molesto|odio|estúpido|injusto|detesto)/.test(msg)) {
            type = 'Ira';
            intensity = 0.9;
        } else if (/(ansioso|nervioso|preocupado|miedo|terrible|ayuda)/.test(msg)) {
            type = 'Ansiedad';
            intensity = 0.85;
        }

        // Ajuste por longitud (si es corto y emocional, la intensidad es mayor)
        if (msg.length < 50 && intensity > 0.5) {
            intensity += 0.1;
        }
        
        return { type, intensity: Math.min(1.0, intensity) };
    }

    calculateRequiredDepth(needs, emotionalState) {
        let depth = 0.5;
        
        // Aumentar la profundidad si el usuario busca algo emocional/existencial
        if (needs.understanding || needs.validation || emotionalState.intensity > 0.7) {
            depth = 0.8;
        }
        
        // Reducir la profundidad si busca información o solo charlar
        if (needs.information || needs.connection) {
            depth = 0.4;
        }
        
        // La alta intensidad emocional siempre prioriza la profundidad emocional
        if (emotionalState.type !== 'Neutral' && emotionalState.intensity > 0.8) {
            depth = 0.9;
        }

        return Math.min(1.0, depth);
    }
}

// ========== INSTANCIAR MEMORIA ORGÁNICA ==========
const organicMemory = new OrganicMemory();

// =================================================================
// ========== 8. INICIO DEL SERVIDOR WEB (EXPRESS) ==========
// =================================================================

app.listen(PORT, () => {
    console.log(`\n==============================================`);
    console.log(`🚀 Servidor Express escuchando en puerto ${PORT}`);
    console.log(`URL de Estado: http://localhost:${PORT}/api/status`);
    console.log(`==============================================`);
    
    // Iniciar el bot automáticamente al levantar el servidor
    initializeDiscordClient(); 
});
