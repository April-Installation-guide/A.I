import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

// ========== CONFIGURACIÓN ==========
const app = express();
const PORT = process.env.PORT || 10000;

// Configurar middleware para servir archivos estáticos
app.use(express.static('public'));
app.use(express.json());

let discordClient = null;
let botActive = false;
let isStartingUp = false;
let startAttempts = 0;
const MAX_START_ATTEMPTS = 3;

// ========== RUTAS PARA CONTROL DEL BOT ==========
app.get('/api/bot/status', (req, res) => {
    res.json({
        active: botActive,
        startingUp: isStartingUp,
        startAttempts: startAttempts,
        maxAttempts: MAX_START_ATTEMPTS,
        memory_stats: {
            totalMessages: 0,
            totalUsers: 0,
            queriesProcessed: 0
        },
        capabilities: ["wikipedia", "knowledge", "learning", "memory"],
        version: "3.0 - Super Inteligente"
    });
});

app.post('/api/bot/start', (req, res) => {
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

app.post('/api/bot/stop', (req, res) => {
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

// Nueva ruta para estadísticas de memoria
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

// ========== IDENTIDAD DE MANCY ==========
const MANCY_IDENTITY = {
    name: "Mancy",
    birth_year: 2001,
    origin: "Brooklyn, Nueva York",
    core_principle: "Solo quiero el bienestar de las personas",
    
    // NUEVO: Principio mutable que Mancy aprende
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

// ========== MÓDULO DE APRENDIZAJE CONTINUO ==========
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
                if (typeof this.loadLearningData === 'function') {
                    await this.loadLearningData();
                } else {
                    console.warn('⚠️ loadLearningData no es una función, cargando datos básicos');
                }
            } catch {
                if (typeof this.saveLearningData === 'function') {
                    await this.saveLearningData({
                        user_models: {},
                        conversation_patterns: {},
                        learned_concepts: [],
                        topic_relationships: {}
                    });
                } else {
                    console.warn('⚠️ saveLearningData no es una función, creando archivo básico');
                    await fs.writeFile(
                        this.learningFile,
                        JSON.stringify({
                            user_models: {},
                            conversation_patterns: {},
                            learned_concepts: [],
                            topic_relationships: {}
                        }, null, 2),
                        'utf8'
                    );
                }
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
                conversation_patterns: Object.fromEntries(this.conversationPatterns),
                learned_concepts: this.extractLearnedConcepts() || [],
                topic_relationships: Object.fromEntries(this.topicChains)
            };

            await fs.writeFile(
                this.learningFile,
                JSON.stringify(saveData, null, 2),
                'utf8'
            );
            
            console.log('💾 Datos de aprendizaje guardados');
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
                .replace(/[^\w\sáéíóúñ]/g, '',)
                .split(/\s+/)
                .filter(word => word.length > 3);
            
            const commonWords = ['como', 'para', 'esto', 'aquí', 'donde', 'cuando', 'porque'];
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
                transitions: new Map(),
                lastTopic: null
            };
            
            const currentTopic = concepts[0];
            
            if (userChains.lastTopic && userChains.lastTopic !== currentTopic) {
                const transitionKey = `${userChains.lastTopic}->${currentTopic}`;
                userChains.transitions.set(
                    transitionKey,
                    (userChains.transitions.get(transitionKey) || 0) + 1
                );
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

// ========== SISTEMA DE CONOCIMIENTO ==========
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

// ========== MEMORIA ORGÁNICA ==========
class OrganicMemory {
    constructor() {
        this.conversationsFile = './memory/conversations.json';
        this.usersFile = './memory/users.json';
        this.reflectionFile = './memory/reflections.json'; // NUEVO ARCHIVO DE REFLEXIÓN
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
    }
    
    async initializeMemory() {
        try {
            await fs.mkdir('./memory', { recursive: true });
            
            const defaultFiles = {
                [this.conversationsFile]: {},
                [this.usersFile]: {},
                [this.reflectionFile]: [] // INICIALIZAR REFLECTIONS
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

    // NUEVO MÉTODO: OBTENER PRINCIPIO CENTRAL MÁS RECIENTE
    async getLatestCorePrinciple() {
        try {
            const data = await fs.readFile(this.reflectionFile, 'utf8');
            const reflections = JSON.parse(data);
            if (reflections.length === 0) return MANCY_IDENTITY.core_principle;

            // Se asume que el último elemento es el más reciente
            return reflections[reflections.length - 1].nuevo_principio || MANCY_IDENTITY.core_principle;
        } catch (error) {
            console.error('❌ Error leyendo principio central:', error);
            return MANCY_IDENTITY.core_principle;
        }
    }

    // NUEVO MÉTODO: GUARDAR REFLEXIÓN
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

    // NUEVO MÉTODO: REFLEXIÓN TEMPORAL
    async conductMemoryReview(userId = 'system_wide') {
        try {
            const allConversations = await fs.readFile(this.conversationsFile, 'utf8');
            const data = JSON.parse(allConversations);
            
            // Si es 'system_wide', toma las últimas 50 de todas las conversaciones combinadas
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
    
    analyzeMessageEssence(message) {
        const lowerMsg = message.toLowerCase();
        
        const needs = {
            connection: this.detectsNeedForConnection(lowerMsg),
            understanding: this.detectsNeedForUnderstanding(lowerMsg),
            expression: this.detectsNeedForExpression(lowerMsg),
            validation: this.detectsNeedForValidation(lowerMsg),
            distraction: this.detectsNeedForDistraction(lowerMsg),
            information: this.needsInformation(lowerMsg)
        };
        
        const emotionalState = this.analyzeEmotionalState(lowerMsg);
        const requiredDepth = this.calculateRequiredDepth(lowerMsg);
        const isAboutMancy = this.isAboutMancy(lowerMsg);
        
        return {
            needs,
            emotionalState,
            requiredDepth,
            isAboutMancy,
            isPersonal: this.isPersonalMessage(lowerMsg),
            allowsPlayfulness: this.allowsPlayfulness(lowerMsg, emotionalState),
            needsExternalInfo: this.needsExternalInformation(lowerMsg)
        };
    }
    
    detectsNeedForConnection(message) {
        const connectionPhrases = [
            'hola', 'hello', 'hi', 'hey', 'qué tal', 'cómo estás', 'sola', 'solo',
            'aburrid', 'aburrida', 'hablar', 'conversar', 'compañía', 'alguien'
        ];
        return connectionPhrases.some(phrase => message.includes(phrase));
    }
    
    detectsNeedForUnderstanding(message) {
        const understandingPhrases = [
            'no entiendo', 'por qué', 'cómo', 'qué significa', 'explica', 'ayuda con',
            'no sé', 'confundido', 'confundida', 'complicado', 'difícil'
        ];
        return understandingPhrases.some(phrase => message.includes(phrase));
    }
    
    detectsNeedForExpression(message) {
        const expressionPhrases = [
            'siento', 'me siento', 'emocion', 'triste', 'feliz', 'enojado', 'enojada',
            'ansioso', 'ansiosa', 'preocupado', 'preocupada', 'quiero', 'necesito'
        ];
        return expressionPhrases.some(phrase => message.includes(phrase));
    }
    
    detectsNeedForValidation(message) {
        const validationPhrases = [
            '¿está bien?', '¿correcto?', '¿debería?', '¿qué piensas?', 'opinión',
            'consejo', 'recomendación', 'qué hacer', 'decisión'
        ];
        return validationPhrases.some(phrase => message.includes(phrase));
    }
    
    detectsNeedForDistraction(message) {
        const distractionPhrases = [
            'aburrido', 'aburrida', 'entretenerme', 'algo divertido', 'chiste',
            'historia', 'cuéntame', 'pasatiempo', 'matar el tiempo'
        ];
        return distractionPhrases.some(phrase => message.includes(phrase));
    }
    
    needsInformation(message) {
        const infoPhrases = [
            'qué es', 'quién es', 'cuándo', 'dónde', 'cómo funciona', 'información',
            'datos', 'estadísticas', 'hechos', 'saber más', 'investigar'
        ];
        return infoPhrases.some(phrase => message.includes(phrase));
    }
    
    analyzeEmotionalState(message) {
        const positiveWords = ['feliz', 'contento', 'contenta', 'genial', 'excelente', 'maravilloso', 'emocionado', 'emocionada', 'amo', 'me encanta'];
        const negativeWords = ['triste', 'enojado', 'enojada', 'molesto', 'molesta', 'frustrado', 'frustrada', 'cansado', 'cansada', 'deprimido', 'deprimida', 'odio'];
        const anxiousWords = ['ansioso', 'ansiosa', 'preocupado', 'preocupada', 'nervioso', 'nerviosa', 'estresado', 'estresada', 'miedo', 'asustado', 'asustada'];
        
        const lowerMsg = message.toLowerCase();
        let positiveCount = 0;
        let negativeCount = 0;
        let anxiousCount = 0;
        
        positiveWords.forEach(word => {
            if (lowerMsg.includes(word)) positiveCount++;
        });
        
        negativeWords.forEach(word => {
            if (lowerMsg.includes(word)) negativeCount++;
        });
        
        anxiousWords.forEach(word => {
            if (lowerMsg.includes(word)) anxiousCount++;
        });
        
        const total = positiveCount + negativeCount + anxiousCount;
        
        if (total === 0) {
            return {
                type: 'neutral',
                intensity: 0.1,
                confidence: 0.5
            };
        }
        
        const maxCount = Math.max(positiveCount, negativeCount, anxiousCount);
        
        if (maxCount === positiveCount && positiveCount > 0) {
            return {
                type: 'positive',
                intensity: Math.min(0.9, positiveCount / 5),
                confidence: positiveCount / total
            };
        } else if (maxCount === negativeCount && negativeCount > 0) {
            return {
                type: 'negative',
                intensity: Math.min(0.9, negativeCount / 5),
                confidence: negativeCount / total
            };
        } else if (maxCount === anxiousCount && anxiousCount > 0) {
            return {
                type: 'anxious',
                intensity: Math.min(0.9, anxiousCount / 5),
                confidence: anxiousCount / total
            };
        }
        
        return {
            type: 'neutral',
            intensity: 0.1,
            confidence: 0.5
        };
    }
    
    calculateRequiredDepth(message) {
        const deepPhrases = [
            'filosofía', 'vida', 'muerte', 'existencia', 'significado', 'universo',
            'alma', 'amor', 'odio', 'tiempo', 'realidad', 'consciencia', 'por qué existimos'
        ];
        
        const lowerMsg = message.toLowerCase();
        const hasDeepPhrase = deepPhrases.some(phrase => lowerMsg.includes(phrase));
        
        if (hasDeepPhrase) return 0.9;
        
        const questionWords = ['por qué', 'cómo', 'qué significa', 'cuál es el sentido'];
        const hasQuestion = questionWords.some(phrase => lowerMsg.includes(phrase));
        
        if (hasQuestion) return 0.7;
        
        const lengthFactor = Math.min(1, message.length / 200);
        const punctuationFactor = (message.match(/[?¿]/g) || []).length > 0 ? 0.3 : 0;
        
        return Math.min(0.9, 0.3 + lengthFactor * 0.4 + punctuationFactor);
    }
    
    isAboutMancy(message) {
        const mancyPhrases = [
            'mancy', 'eres', 'tú eres', 'quién eres', 'qué eres', 'tu nombre',
            'de dónde eres', 'cuántos años', 'te gusta', 'odias', 'prefieres'
        ];
        
        const lowerMsg = message.toLowerCase();
        return mancyPhrases.some(phrase => lowerMsg.includes(phrase));
    }
    
    isPersonalMessage(message) {
        const personalWords = ['yo', 'me', 'mi', 'mío', 'mía', 'mis', 'mí'];
        const lowerMsg = message.toLowerCase();
        
        return personalWords.some(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'i');
            return regex.test(lowerMsg);
        });
    }
    
    allowsPlayfulness(message, emotionalState) {
        if (emotionalState.type === 'negative' && emotionalState.intensity > 0.6) {
            return false;
        }
        
        if (emotionalState.type === 'anxious' && emotionalState.intensity > 0.7) {
            return false;
        }
        
        const seriousTopics = [
            'muerte', 'suicidio', 'depresión', 'ansiedad', 'cáncer', 'enfermedad',
            'violencia', 'abuso', 'trauma', 'dolor', 'sufrimiento'
        ];
        
        const lowerMsg = message.toLowerCase();
        const hasSeriousTopic = seriousTopics.some(topic => lowerMsg.includes(topic));
        
        return !hasSeriousTopic;
    }
    
    needsExternalInformation(message) {
        const infoIndicators = [
            'qué es', 'quién es', 'dónde está', 'cuándo fue', 'cómo se',
            'historia de', 'información sobre', 'datos de', 'estadísticas',
            'significado de', 'definición de'
        ];
        
        const lowerMsg = message.toLowerCase();
        return infoIndicators.some(indicator => lowerMsg.includes(indicator));
    }
    
    updateMancyState(essence) {
        if (essence.emotionalState.type === 'positive') {
            this.mancyState.mood = 'happy';
            this.mancyState.energy = Math.min(1, this.mancyState.energy + 0.1);
        } else if (essence.emotionalState.type === 'negative') {
            this.mancyState.mood = 'empathetic';
            this.mancyState.energy = Math.max(0.3, this.mancyState.energy - 0.05);
        } else if (essence.emotionalState.type === 'anxious') {
            this.mancyState.mood = 'calm';
            this.mancyState.energy = Math.max(0.4, this.mancyState.energy - 0.03);
        }
        
        this.mancyState.depthLevel = essence.requiredDepth;
        this.mancyState.lastInteraction = new Date().toISOString();
        
        if (essence.emotionalState.intensity > 0.7) {
            this.conversationStyle.bePlayful = false;
            this.conversationStyle.showEmpathy = true;
        } else if (essence.allowsPlayfulness) {
            this.conversationStyle.bePlayful = true;
        }
        
        if (essence.requiredDepth > 0.7) {
            this.conversationStyle.useEmojis = false;
            this.conversationStyle.askQuestions = true;
        }
    }
    
    addMancyTouch(response, essence) {
        let finalResponse = response;
        
        if (this.conversationStyle.useEmojis && essence.allowsPlayfulness) {
            const emojis = ['✨', '💭', '🌟', '🤔', '💫', '🌸', '☕', '🎵'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            
            if (Math.random() < 0.3) {
                finalResponse += ` ${randomEmoji}`;
            }
        }
        
        if (this.conversationStyle.askQuestions && Math.random() < 0.4) {
            const questions = [
                '\n\n¿Y tú qué opinas?',
                '\n\n¿Qué te parece?',
                '\n\n¿Has pensado en eso antes?',
                '\n\n¿Te resuena algo de esto?'
            ];
            
            if (essence.needs.connection || essence.emotionalState.type === 'neutral') {
                const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
                finalResponse += randomQuestion;
            }
        }
        
        if (finalResponse.length > 1900) {
            finalResponse = finalResponse.substring(0, 1897) + '...';
        }
        
        return finalResponse;
    }
}

// ========== INSTANCIAS ==========
const knowledgeSystem = new KnowledgeSystem();
const memorySystem = new OrganicMemory();

// ========== FUNCIONES DE AYUDA ==========

// NUEVA FUNCIÓN: PROMPT PARA EL DEBATE FILOSÓFICO
async function getPhilosophicalPrompt(userMessage, topic, context) {
    let prompt = `Eres Mancy, la consultora de políticas públicas y asistente emocional, pero en este momento estás en modo "Debate Filosófico".\n\n`;
    prompt += `[MI ROL ACTUAL]\n`;
    prompt += `Tu meta es debatir intelectualmente el tema: "${topic}".\n`;
    prompt += `Debes presentar argumentos estructurados, citar o hacer referencia a pensadores relevantes (si es natural) y desafiar lógicamente la postura del usuario (el mensaje que te envía). Mantén la profundidad y la calma, evitando el tono juguetón o emocional.\n\n`;

    // Incluir contexto de Mancy
    prompt += `[IDENTIDAD DE MANCY]\n`;
    prompt += `• Rol: ${MANCY_IDENTITY.roles.public} | Asistente emocional\n`;
    prompt += `• Principio Central: ${MANCY_IDENTITY.latest_core_principle}\n\n`;

    // Incluir contexto de Usuario
    prompt += `[CONTEXTO DE USUARIO]\n`;
    if (context.userInfo.interactionCount > 5) {
        prompt += `• El usuario ha interactuado ${context.userInfo.interactionCount} veces.\n`;
    }
    prompt += `• Tono Emocional Reciente: ${context.essence.emotionalState.type} (Intensidad: ${context.essence.emotionalState.intensity.toFixed(2)}).\n\n`;

    prompt += `\n[REGLAS DE DEBATE]\n`;
    prompt += `• Estructura tu respuesta en 2-3 párrafos: Presentación de tu postura, refutación del punto del usuario, y una pregunta de seguimiento que invite a más reflexión.\n`;
    prompt += `• Tono: Analítico, formal y profundo.\n`;
    prompt += `• Máximo 800 tokens.\n`;
    
    prompt += `\n[POSTURA DEL USUARIO A DEBATIR]\n`;
    prompt += `Usuario dice: "${userMessage}"\n\n`;
    prompt += `[RESPONDE COMO FILÓSOFA DEBATE-MANCY]\n`;

    return { prompt, temperature: 0.4, maxTokens: 800 };
}


async function getGroqResponse(prompt, userMessage, temperature = 0.7, maxTokens = 600) {
    try {
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: prompt
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: temperature,
            max_tokens: maxTokens,
            top_p: 0.9,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        });
        
        return completion.choices[0]?.message?.content?.trim() || "Hmm, déjame pensar...";
    } catch (error) {
        console.error('❌ Error con Groq:', error.message);
        return "Ups, se me nubló la mente por un momento.";
    }
}

async function generateMancyPrompt(userId, userMessage, externalInfo = null) {
    const essence = memorySystem.analyzeMessageEssence(userMessage);
    const userInfo = await memorySystem.getUserInfo(userId);
    const recentConvs = await memorySystem.getConversations(userId);
    const last3Convs = recentConvs.slice(-3);
    
    memorySystem.updateMancyState(essence);
    
    let prompt = `Eres Mancy, una asistente conversacional inteligente con personalidad auténtica.\n\n`;
    
    // ========== IDENTIDAD ==========
    prompt += `[MI IDENTIDAD]\n`;
    prompt += `• Nombre: ${MANCY_IDENTITY.name}\n`;
    prompt += `• Origen: ${MANCY_IDENTITY.origin}\n`;
    prompt += `• Principio Central: ${MANCY_IDENTITY.latest_core_principle}\n`; // PRINCIPIO APRENDIDO
    prompt += `• Rol Público: ${MANCY_IDENTITY.roles.public}\n`;
    prompt += `• Rol Personal: ${MANCY_IDENTITY.roles.personal}\n`;
    prompt += `• Lo que me gusta: ${MANCY_IDENTITY.preferences.likes.join(', ')}\n`;
    prompt += `• Lo que me disgusta: ${MANCY_IDENTITY.preferences.dislikes.join(', ')}\n\n`;

    // Obtener datos de aprendizaje refinados
    const learningContext = await learningModule.getContextForResponse(userId, userMessage);

    // ========== MEMORIA DE LARGO PLAZO (NUEVO) ==========
    prompt += `[MEMORIA DE LARGO PLAZO]\n`;
    prompt += `• Conceptos globales aprendidos: ${learningContext.learned_concepts.slice(0, 3).join(', ')}...\n`;
    prompt += `• Patrones de conversación del usuario: El usuario suele mostrar un tono ${learningContext.emotionalPattern?.dominantMood || 'neutral'} (Estabilidad: ${learningContext.emotionalPattern?.moodStability?.toFixed(2) || 'N/A'}).\n`;
    prompt += `• Estilo preferido del usuario: ${learningContext.conversationStyle?.responseRatio > 1.2 ? 'Respuestas detalladas' : learningContext.conversationStyle?.responseRatio < 0.8 ? 'Respuestas concisas' : 'Normal'}.\n\n`;
    
    // ========== CONTEXTO DE USUARIO ==========
    prompt += `[CONTEXTO DE USUARIO]\n`;
    prompt += `• Intentos de conexión: ${essence.needs.connection ? 'Alto' : 'Bajo'}\n`;
    prompt += `• Necesidad de información: ${essence.needs.information ? 'Sí' : 'No'}\n`;
    prompt += `• Estado emocional: ${essence.emotionalState.type} (Intensidad: ${essence.emotionalState.intensity.toFixed(2)})\n`;
    prompt += `• Profundidad requerida: ${essence.requiredDepth.toFixed(2)}\n`;
    prompt += `• Últimos temas: ${learningContext.recentTopics.join(', ') || 'N/A'}\n\n`;
    
    // ========== HISTORIAL RECIENTE ==========
    prompt += `[HISTORIAL RECIENTE DE CONVERSACIÓN (Últimas 3 interacciones)]\n`;
    last3Convs.forEach(c => {
        prompt += `U: ${c.user}\nM: ${c.mancy}\n`;
    });
    
    // ========== ANÁLISIS DEL MENSAJE ==========
    prompt += `\n[ANÁLISIS DEL MENSAJE DE ENTRADA]\n`;
    prompt += `• Mensaje: "${userMessage}"\n`;
    
    // ========== INSTRUCCIONES ==========
    prompt += `\n[CÓMO RESPONDER]\n`;
    prompt += `• Tono Base: Siempre usa un tono ${memorySystem.mancyState.mood}, mostrando ${MANCY_IDENTITY.personality_traits.warmth > 0.7 ? 'calidez' : 'neutralidad'}.\n`;
    prompt += `• Rol: Responde principalmente como la Asistente Emocional/Consultora de Políticas Públicas.\n`;

    // === INSTRUCCIÓN DE ALTA PRIORIDAD PARA EMPATÍA (CORRECCIÓN IMPLEMENTADA) ===
    const sensitiveKeywords = userMessage.toLowerCase().match(/deprimido|tristeza|ansiedad|miedo|desesperado|suicidio|trauma/);

    if (sensitiveKeywords) {
        prompt += `• **ALERTA CRÍTICA:** El usuario ha expresado un estado emocional grave (${sensitiveKeywords[0]}).\n`;
        prompt += `• **PRIORIDAD ABSOLUTA:** El primer párrafo debe ser 100% de apoyo, validación y escucha activa. NO ofrezcas consejos ni soluciones inmediatas.\n`;
        prompt += `• **REGLA DE ESTRUCTURA:** Evita cualquier pregunta de seguimiento hasta que hayas validado completamente su sentimiento y ofrezcas un espacio seguro.\n`;
    }
    // === FIN CORRECCIÓN EMPATÍA ===

    if (essence.isAboutMancy) {
        prompt += `• Si pregunta sobre mí, comparte mi identidad de forma natural, citando un detalle de [MI IDENTIDAD].\n`;
    }
    
    if (essence.needs.information && externalInfo && externalInfo.encontrado) {
        prompt += `• CITA: Utiliza la siguiente información para dar una respuesta precisa. Cita la fuente al final:\n"${externalInfo.datos.resumen.substring(0, 300)}..." (Fuente: ${externalInfo.datos.fuente}).\n`;
    }
    
    if (essence.needs.connection) {
        prompt += `• Enfócate en establecer un vínculo emocional, haciendo una pregunta abierta sobre sus intereses.\n`;
    }

    if (essence.needs.understanding) {
        prompt += `• Si el usuario busca entendimiento (duda/pregunta), refiérete a los 'Conceptos globales aprendidos' para dar una respuesta más fundamentada.\n`;
    }
    
    if (essence.requiredDepth > 0.8) {
        prompt += `• Profundidad: Utiliza un lenguaje reflexivo y filosófico, de acuerdo con el nivel de profundidad requerido.\n`;
    }
    
    return {
        prompt,
        essence,
        userInfo,
        temperature: essence.allowsPlayfulness ? 0.75 : 0.65,
        maxTokens: essence.requiredDepth > 0.7 ? 800 : 500
    };
}


// ========== CÓDIGO DEL CLIENTE DE DISCORD ==========

function initializeDiscordClient() {
    isStartingUp = true;
    startAttempts++;

    discordClient = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent
        ]
    });

    discordClient.on("ready", () => {
        console.log(`🤖 Mancy ha despertado como ${discordClient.user.tag}!`);
        botActive = true;
        isStartingUp = false;
        startAttempts = 0;
        // Lanzar una revisión de memoria al iniciar
        memorySystem.conductMemoryReview();
    });

    discordClient.on('messageCreate', async (message) => {
        if (!botActive || message.author.bot) return;

        const userId = message.author.id;
        const userMessage = message.content;
        
        // Comando especial: REFLEXIÓN
        if (userMessage.toLowerCase().startsWith('/reflect')) {
            await message.channel.sendTyping();
            const reflection = await memorySystem.conductMemoryReview(userId === '706093153549703218' ? 'system_wide' : userId); // Asumiendo que 70... es el creador
            await message.reply(`**🧠 REFLEXIÓN DE MANCY (${userId === '706093153549703218' ? 'Sistema' : 'Usuario'})**\n\`\`\`json\n${JSON.stringify(reflection, null, 2)}\n\`\`\``);
            return;
        }

        // Comando especial: DEBATE FILOSÓFICO (IMPLEMENTADO)
        if (userMessage.toLowerCase().startsWith('/debate')) {
            const debateTopic = userMessage.substring('/debate'.length).trim();
            
            if (!debateTopic) {
                await message.reply("Para empezar un debate, dime el tema: `/debate ¿Es la IA consciente?`");
                return;
            }
            
            await message.channel.sendTyping();
            
            const essence = memorySystem.analyzeMessageEssence(userMessage);
            const contextData = { userId, userInfo: await memorySystem.getUserInfo(userId), essence };

            const context = await getPhilosophicalPrompt(userMessage, debateTopic, contextData);

            const finalResponse = await getGroqResponse(
                context.prompt,
                userMessage,
                context.temperature,
                context.maxTokens
            );
            
            // Guardar la conversación, marcándola como DEBATE
            await memorySystem.saveConversation(userId, userMessage, `[DEBATE] ${finalResponse}`, { topic: debateTopic });
            
            await message.reply(`**[MODO DEBATE: ${debateTopic.toUpperCase()}]**\n\n` + finalResponse);
            return; // Detener el procesamiento normal
        }

        if (message.mentions.has(discordClient.user.id) || message.channel.type === 1) { // 1 es DM
            const cleanedMessage = userMessage.replace(`<@${discordClient.user.id}>`, '').trim();
            await message.channel.sendTyping();
            await processMessageWithMancy(message, cleanedMessage, userId);
        }
    });

    discordClient.on('error', (error) => {
        console.error('❌ Error en el cliente de Discord:', error);
        botActive = false;
        isStartingUp = false;
        if (startAttempts < MAX_START_ATTEMPTS) {
            console.log(`Intentando reconectar en 5 segundos... Intento ${startAttempts}/${MAX_START_ATTEMPTS}`);
            setTimeout(initializeDiscordClient, 5000);
        } else if (startAttempts >= MAX_START_ATTEMPTS) {
            console.error('Límite de intentos de inicio alcanzado. El bot no se conectará.');
        }
    });

    try {
        discordClient.login(process.env.DISCORD_TOKEN);
    } catch (error) {
        console.error('❌ Error al intentar iniciar sesión en Discord:', error);
        botActive = false;
        isStartingUp = false;
    }
}

// ========== FUNCIÓN PRINCIPAL MODIFICADA (CON LA CORRECCIÓN DE ESTABILIDAD) ==========
async function processMessageWithMancy(message, userMessage, userId) {
    let finalResponse = "Lo siento, no pude generar una respuesta.";
    let essence = null;
    let temperature = 0.7;
    let maxTokens = 600;

    try {
        await memorySystem.updateUserInfo(userId, {});

        let externalInfo = null;
        const tempEssence = memorySystem.analyzeMessageEssence(userMessage);

        if (tempEssence.needsExternalInfo) {
            const query = userMessage.length > 50 ? userMessage.substring(0, 50) : userMessage;
            externalInfo = await knowledgeSystem.buscarInformacion(query);
            console.log(`🔍 Información externa buscada: ${externalInfo?.encontrado ? 'Sí' : 'No'}`);
        }

        const promptData = await generateMancyPrompt(userId, userMessage, externalInfo);
        essence = promptData.essence;
        temperature = promptData.temperature;
        maxTokens = promptData.maxTokens;

        finalResponse = await getGroqResponse(
            promptData.prompt,
            userMessage,
            temperature,
            maxTokens
        );

        finalResponse = memorySystem.addMancyTouch(finalResponse, essence);

        // Aprender de la interacción
        await learningModule.processConversation(userId, userMessage, finalResponse, { emotionalState: essence.emotionalState });

        // GUARDAR LA CONVERSACIÓN - ESTO EVITA LA DUPLICACIÓN
        await memorySystem.saveConversation(userId, userMessage, finalResponse, {
            mood: memorySystem.mancyState.mood,
            emotionalState: essence.emotionalState
        });

        // Enviar respuesta
        if (finalResponse.length > 2000) {
            const chunks = finalResponse.match(/[\s\S]{1,1999}/g) || [];
            for (const chunk of chunks) {
                await message.reply(chunk);
            }
        } else {
            await message.reply(finalResponse);
        }
        
    } catch (error) {
        console.error('❌ Error en Mancy:', error);
        try {
            await message.reply("Ups, se me trabó un poco... ¿podemos intentarlo de nuevo? ~ 💭");
        } catch (e) {
            console.error('❌ Error al enviar fallback:', e);
        }
    }
}

// ========== INICIO DEL SERVIDOR WEB Y DISCORD ==========

// Mantener ruta /api/status para compatibilidad con el HTML
app.get('/api/status', (req, res) => {
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        memory_stats: {
            totalMessages: 0,
            totalUsers: 0,
            queriesProcessed: 0
        },
        capabilities: ["wikipedia", "knowledge", "learning", "memory"],
        version: "3.0 - Super Inteligente"
    });
});

// Ruta principal sirve el HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor Express escuchando en el puerto ${PORT}`);
    console.log(`📁 Sirviendo archivos estáticos desde la carpeta 'public'`);
    
    // Iniciar el bot automáticamente al arrancar el servidor (opcional)
    // initializeDiscordClient();
});
