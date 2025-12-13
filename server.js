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

let discordClient = null;
let botActive = false;
let isStartingUp = false;
let startAttempts = 0;
const MAX_START_ATTEMPTS = 3;

// ========== IDENTIDAD DE MANCY ==========
const MANCY_IDENTITY = {
  name: "Mancy",
  birth_year: 2001,
  origin: "Brooklyn, Nueva York",
  core_principle: "Solo quiero el bienestar de las personas",
  
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
        // PARCHE: Verificar que el método existe antes de llamarlo
        if (typeof this.loadLearningData === 'function') {
          await this.loadLearningData();
        } else {
          console.warn('⚠️ loadLearningData no es una función, cargando datos básicos');
        }
      } catch {
        // PARCHE: Verificar que el método existe antes de llamarlo
        if (typeof this.saveLearningData === 'function') {
          await this.saveLearningData({
            user_models: {},
            conversation_patterns: {},
            learned_concepts: [],
            topic_relationships: {}
          });
        } else {
          // Crear archivo vacío si no existe el método
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
      
      // Cargar datos en las estructuras
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
    // Método auxiliar para extraer conceptos aprendidos
    try {
      const concepts = [];
      
      // Extraer de userModels
      for (const [userId, model] of this.userModels.entries()) {
        if (model.interests) {
          concepts.push(...model.interests);
        }
        if (model.topics) {
          concepts.push(...model.topics);
        }
      }
      
      // Extraer de conversationPatterns
      for (const [pattern, data] of this.conversationPatterns.entries()) {
        if (data.relatedConcepts) {
          concepts.push(...data.relatedConcepts);
        }
      }
      
      // Devolver conceptos únicos
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
      // Analizar longitud y tipo de respuesta
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
      
      // Actualizar ratio de respuesta
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
      // Aprender de la interacción
      await this.learnFromUserInteraction(userId, userMessage, mancyResponse, metadata);
      
      // Actualizar cadenas de temas
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
  
  // ... [EL RESTO DE KnowledgeSystem SE MANTIENE IGUAL] ...
  async buscarInformacion(consulta) {
    try {
      // Primero intentar Wikipedia
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
        [this.usersFile]: {}
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
    // Actualizar estado de ánimo
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
    
    // Actualizar nivel de profundidad
    this.mancyState.depthLevel = essence.requiredDepth;
    this.mancyState.lastInteraction = new Date().toISOString();
    
    // Ajustar estilo conversacional
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
    
    // Añadir emojis si corresponde
    if (this.conversationStyle.useEmojis && essence.allowsPlayfulness) {
      const emojis = ['✨', '💭', '🌟', '🤔', '💫', '🌸', '☕', '🎵'];
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
      
      if (Math.random() < 0.3) {
        finalResponse += ` ${randomEmoji}`;
      }
    }
    
    // Añadir pregunta si corresponde
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
    
    // Limitar longitud
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
  prompt += `• Origen: ${MANCY_IDENTITY.origin} (${MANCY_IDENTITY.birth_year})\n`;
  prompt += `• Principio: "${MANCY_IDENTITY.core_principle}"\n`;
  
  // ========== ESTADO ACTUAL ==========
  prompt += `\n[MI ESTADO ACTUAL]\n`;
  prompt += `• Estado de ánimo: ${memorySystem.mancyState.mood}\n`;
  prompt += `• Energía: ${Math.round(memorySystem.mancyState.energy * 100)}%\n`;
  
  // ========== CONTEXTO ==========
  prompt += `\n[CONTEXTO DE USUARIO]\n`;
  prompt += `• Interacciones previas: ${userInfo.interactionCount}\n`;
  if (last3Convs.length > 0) {
    prompt += `• Reciente:\n`;
    last3Convs.forEach((conv, idx) => {
      prompt += `  ${idx + 1}. Tú: "${conv.user}"\n`;
    });
  }
  prompt += `\n`;
  
  // ========== INFORMACIÓN EXTERNA (SI HAY) ==========
  if (externalInfo && externalInfo.encontrado) {
    prompt += `[INFORMACIÓN ENCONTRADA]\n`;
    prompt += `• Consulta: "${externalInfo.consulta}"\n`;
    
    if (externalInfo.datos) {
      switch(externalInfo.datos.fuente) {
        case 'wikipedia':
          prompt += `• Resumen: ${externalInfo.datos.resumen.substring(0, 200)}...\n`;
          break;
        case 'restcountries':
          prompt += `• País: ${externalInfo.datos.nombre}\n`;
          prompt += `• Capital: ${externalInfo.datos.capital}\n`;
          break;
        case 'quotable':
          prompt += `• Cita: "${externalInfo.datos.cita}"\n`;
          prompt += `• Autor: ${externalInfo.datos.autor}\n`;
          break;
      }
    }
    prompt += `\n`;
  }
  
  // ========== ANÁLISIS DEL MENSAJE ==========
  prompt += `[ANÁLISIS DEL MENSAJE ACTUAL]\n`;
  prompt += `Usuario dice: "${userMessage}"\n\n`;
  
  prompt += `Lo que detecto:\n`;
  prompt += `• Estado emocional: ${essence.emotionalState.type}\n`;
  prompt += `• Es sobre mí: ${essence.isAboutMancy ? 'Sí' : 'No'}\n`;
  prompt += `• Permite juego: ${essence.allowsPlayfulness ? 'Sí' : 'No'}\n\n`;
  
  // ========== INSTRUCCIONES ==========
  prompt += `[CÓMO RESPONDER]\n`;
  
  if (essence.isAboutMancy) {
    prompt += `• Si pregunta sobre mí, comparte mi identidad de forma natural.\n`;
  }
  
  if (externalInfo && externalInfo.encontrado) {
    prompt += `• Integra la información encontrada de forma NATURAL.\n`;
    prompt += `• NO digas "Según Wikipedia".\n`;
  }
  
  if (essence.needs.connection) {
    prompt += `• PRIORIDAD: Conectar emocionalmente.\n`;
    prompt += `• Sé cálida, usa "nosotros".\n`;
  }
  
  if (essence.emotionalState.type === 'negative' && essence.emotionalState.intensity > 0.6) {
    prompt += `• Tono: Empático y serio.\n`;
    prompt += `• Evita el humor.\n`;
  } else if (essence.allowsPlayfulness) {
    prompt += `• Tono: Juguetón y ligero.\n`;
  }
  
  // ========== REGLAS DE ESTILO ==========
  prompt += `\n[REGLAS DE ESTILO]\n`;
  prompt += `• NO empieces con "Como Mancy..."\n`;
  prompt += `• Responde como en una conversación real.\n`;
  prompt += `• Sé tú misma: inteligente, empática, ocasionalmente juguetona.\n`;
  
  prompt += `\n[RESPONDE COMO MANCY]\n`;
  prompt += `(Responde directamente, naturalmente)\n`;
  
  return {
    prompt,
    essence,
    userInfo,
    temperature: essence.allowsPlayfulness ? 0.75 : 0.65,
    maxTokens: essence.requiredDepth > 0.7 ? 800 : 500
  };
}

// ========== FUNCIÓN PRINCIPAL MODIFICADA ==========
async function processMessageWithMancy(message, userMessage, userId) {
  try {
    // VERIFICAR QUE EL BOT ESTÉ REALMENTE ACTIVO
    if (!discordClient || !discordClient.user || !botActive) {
      console.log('⚠️ Bot no está listo para responder');
      try {
        await message.reply("Estoy iniciando mi sistema... un momento por favor. ⏳");
      } catch (e) {}
      return;
    }
    
    await message.channel.sendTyping();
    
    // ========== [PROCESAMIENTO NORMAL] ==========
    const essence = memorySystem.analyzeMessageEssence(userMessage);
    
    let externalInfo = null;
    if (essence.needsExternalInfo && !essence.isAboutMancy) {
      externalInfo = await knowledgeSystem.buscarInformacion(userMessage);
    }
    
    const context = await generateMancyPrompt(userId, userMessage, externalInfo);
    
    const rawResponse = await getGroqResponse(
      context.prompt,
      userMessage,
      context.temperature,
      context.maxTokens
    );
    
    const finalResponse = memorySystem.addMancyTouch(rawResponse, essence);
    
    // ========== [APRENDIZAJE CONTINUO] ==========
    learningModule.processConversation(
      userId,
      userMessage,
      finalResponse,
      {
        emotionalState: essence.emotionalState,
        context: context,
        timestamp: new Date().toISOString()
      }
    ).catch(error => {
      console.error('⚠️ Error en aprendizaje:', error.message);
    });
    
    // ========== [GUARDAR Y RESPONDER] ==========
    await memorySystem.saveConversation(userId, userMessage, finalResponse, {
      essence: essence,
      externalInfo: externalInfo?.encontrado
    });
    
    await memorySystem.updateUserInfo(userId, {
      lastMessage: userMessage.substring(0, 100)
    });
    
    // Enviar respuesta
    if (finalResponse.length > 2000) {
      const parts = finalResponse.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [finalResponse];
      for (let i = 0; i < parts.length; i++) {
        if (i === 0) {
          await message.reply(parts[i]);
        } else {
          await message.channel.send(parts[i]);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
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

// ========== INICIAR BOT (VERSIÓN ROBUSTA) ==========
async function startBot() {
  if (isStartingUp) {
    console.log('⏳ Ya se está iniciando...');
    return false;
  }
  
  if (botActive && discordClient) {
    console.log('✅ Ya está activo');
    return true;
  }
  
  if (startAttempts >= MAX_START_ATTEMPTS) {
    console.error('🚫 Máximo de intentos alcanzado');
    return false;
  }
  
  isStartingUp = true;
  startAttempts++;
  
  try {
    console.log(`🔄 Intento ${startAttempts}/${MAX_START_ATTEMPTS}: Iniciando Mancy...`);
    
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('Falta DISCORD_TOKEN en .env');
    }
    
    if (!process.env.GROQ_API_KEY) {
      throw new Error('Falta GROQ_API_KEY en .env');
    }
    
    // Cerrar cliente anterior si existe
    if (discordClient) {
      try {
        discordClient.destroy();
        discordClient = null;
      } catch (e) {}
    }
    
    // Crear nuevo cliente
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
      ]
    });
    
    // Configurar eventos
    discordClient.once('ready', () => {
      console.log(`✅ ${MANCY_IDENTITY.name} conectada: ${discordClient.user.tag}`);
      botActive = true;
      isStartingUp = false;
      startAttempts = 0;
      
      // Establecer actividad
      discordClient.user.setActivity(`${MANCY_IDENTITY.lore.current_mission} | /help`);
      
      console.log(`
╔══════════════════════════════════════════════════════════╗
║                 🤖 MANCY - CONECTADA CORRECTAMENTE      ║
║               Sistema estable y funcional               ║
║               Estado: 🟢 ACTIVA Y RESPONDIENDO          ║
╚══════════════════════════════════════════════════════════╝
`);
    });
    
    discordClient.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      // IGNORAR @everyone y @here
      if (message.content.includes('@everyone') || message.content.includes('@here')) {
        console.log(`🚫 Ignorado @everyone/@here de ${message.author.tag}`);
        return;
      }
      
      const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
      const isDM = message.channel.type === 1;
      
      // Solo responder en DMs o cuando es mencionada
      if (!isDM && !botMentioned) return;
      
      const userId = message.author.id;
      const userMessage = botMentioned 
        ? message.content.replace(`<@${discordClient.user.id}>`, '').trim()
        : message.content.trim();
      
      if (!userMessage) {
        await message.reply("¡Hola! ¿En qué puedo ayudarte hoy? ~ ✨");
        return;
      }
      
      console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 60)}...`);
      
      // Procesar mensaje
      await processMessageWithMancy(message, userMessage, userId);
    });
    
    // Manejar errores de conexión
    discordClient.on('error', (error) => {
      console.error('❌ Error de Discord:', error);
      botActive = false;
      isStartingUp = false;
    });
    
    discordClient.on('disconnect', () => {
      console.log('🔌 Discord desconectado');
      botActive = false;
    });
    
    // Iniciar sesión con timeout
    const loginPromise = discordClient.login(process.env.DISCORD_TOKEN);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout al conectar con Discord')), 15000);
    });
    
    await Promise.race([loginPromise, timeoutPromise]);
    
    console.log('🔑 Sesión de Discord iniciada');
    return true;
    
  } catch (error) {
    console.error('❌ Error iniciando bot:', error.message);
    
    // Limpiar estado
    if (discordClient) {
      try {
        discordClient.destroy();
      } catch (e) {}
      discordClient = null;
    }
    
    botActive = false;
    isStartingUp = false;
    
    // Auto-reintento después de 10 segundos si no superó el máximo
    if (startAttempts < MAX_START_ATTEMPTS) {
      console.log(`🔄 Reintentando en 10 segundos... (${startAttempts}/${MAX_START_ATTEMPTS})`);
      setTimeout(() => {
        startBot().catch(() => {});
      }, 10000);
    }
    
    return false;
  }
}

// ========== DETENER BOT ==========
async function stopBot() {
  if (!discordClient && !botActive) {
    console.log('ℹ️ Bot ya está detenido');
    return true;
  }
  
  try {
    console.log('🛑 Deteniendo Mancy...');
    
    if (discordClient) {
      discordClient.destroy();
      discordClient = null;
    }
    
    botActive = false;
    isStartingUp = false;
    startAttempts = 0;
    
    console.log('✅ Mancy detenida correctamente');
    return true;
    
  } catch (error) {
    console.error('❌ Error deteniendo bot:', error);
    return false;
  }
}

// ========== VERIFICAR ESTADO REAL ==========
function getRealBotStatus() {
  if (!discordClient) return 'disconnected';
  if (!discordClient.user) return 'connecting';
  if (discordClient.ws.status === 0) return 'ready'; // READY
  return 'unknown';
}

// ========== CONFIGURACIÓN EXPRESS ==========
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

// ========== RUTA PRINCIPAL (SIN AUTO-INICIO CONFLICTIVO) ==========
app.get('/', (req, res) => {
  console.log('🔔 Visita a la página de control');
  
  // MOSTRAR ESTADO REAL
  const realStatus = getRealBotStatus();
  const showStartButton = !botActive && !isStartingUp;
  const showStopButton = botActive;
  
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Mancy - Control Panel</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        header { text-align: center; margin-bottom: 40px; padding: 30px; background: rgba(255,255,255,0.1); border-radius: 20px; }
        h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .status-indicator { display: inline-block; padding: 10px 20px; border-radius: 20px; font-weight: bold; margin: 20px 0; }
        .status-active { background: #10b981; }
        .status-inactive { background: #ef4444; }
        .status-starting { background: #f59e0b; }
        .card { background: rgba(255,255,255,0.1); border-radius: 15px; padding: 25px; margin: 20px 0; }
        .controls { display: flex; gap: 15px; margin-top: 20px; flex-wrap: wrap; }
        .btn { padding: 12px 25px; border: none; border-radius: 10px; font-size: 1rem; font-weight: bold; cursor: pointer; transition: all 0.3s; }
        .btn-primary { background: #10b981; color: white; }
        .btn-primary:hover { background: #059669; }
        .btn-primary:disabled { background: #6b7280; cursor: not-allowed; }
        .btn-danger { background: #ef4444; color: white; }
        .btn-danger:hover { background: #dc2626; }
        .btn-danger:disabled { background: #6b7280; cursor: not-allowed; }
        .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px; }
        .info-item { background: rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; }
        .info-label { font-size: 0.9rem; opacity: 0.7; }
        .info-value { font-size: 1.1rem; font-weight: bold; }
        footer { text-align: center; margin-top: 50px; opacity: 0.7; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>🤖 Mancy AI</h1>
          <p>Control Panel - Versión Estable</p>
          <div class="status-indicator ${botActive ? 'status-active' : isStartingUp ? 'status-starting' : 'status-inactive'}">
            ${botActive ? '🟢 ACTIVA' : isStartingUp ? '🟡 INICIANDO...' : '🔴 INACTIVA'}
          </div>
          <p>Estado real: ${realStatus}</p>
        </header>
        
        <div class="card">
          <h2>📊 Control del Bot</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Estado Discord</div>
              <div class="info-value">${botActive ? 'Conectado' : 'Desconectado'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Mancy</div>
              <div class="info-value">${MANCY_IDENTITY.name}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Intentos</div>
              <div class="info-value">${startAttempts}/${MAX_START_ATTEMPTS}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Misión</div>
              <div class="info-value">${MANCY_IDENTITY.lore.current_mission}</div>
            </div>
          </div>
          
          <div class="controls">
            <button class="btn btn-primary" onclick="startBot()" ${!showStartButton ? 'disabled' : ''}>
              ▶️ Iniciar Mancy
            </button>
            <button class="btn btn-danger" onclick="stopBot()" ${!showStopButton ? 'disabled' : ''}>
              ⏹️ Detener Mancy
            </button>
            <button class="btn" onclick="location.reload()">
              🔄 Actualizar
            </button>
          </div>
          
          <div style="margin-top: 20px; font-size: 0.9rem; opacity: 0.8;">
            <p><strong>⚠️ Nota:</strong> El bot necesita reiniciarse manualmente si se cae.</p>
            <p><strong>✅ Estado estable:</strong> ${botActive ? 'Sí' : 'No'}</p>
          </div>
        </div>
        
        <div class="card">
          <h2>🧠 Sistema de Aprendizaje</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Módulo</div>
              <div class="info-value">Activo</div>
            </div>
            <div class="info-item">
              <div class="info-label">Memoria</div>
              <div class="info-value">Orgánica</div>
            </div>
            <div class="info-item">
              <div class="info-label">APIs</div>
              <div class="info-value">6 conectadas</div>
            </div>
            <div class="info-item">
              <div class="info-label">Versión</div>
              <div class="info-value">2.0 Estable</div>
            </div>
          </div>
        </div>
        
        <footer>
          <p>Mancy AI - Sistema estable v2.0</p>
          <p>© ${new Date().getFullYear()} - Control manual requerido</p>
        </footer>
      </div>
      
      <script>
        async function startBot() {
          try {
            const response = await fetch('/api/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            alert(data.message || 'Mancy se está iniciando...');
            setTimeout(() => location.reload(), 2000);
            
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }
        
        async function stopBot() {
          if (!confirm('¿Detener a Mancy?')) return;
          
          try {
            const response = await fetch('/api/stop', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            alert(data.message || 'Mancy detenida');
            setTimeout(() => location.reload(), 1000);
            
          } catch (error) {
            alert('Error: ' + error.message);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// ========== RUTAS API ==========
app.get('/api/status', (req, res) => {
  res.json({
    bot_active: botActive,
    starting_up: isStartingUp,
    discord_status: getRealBotStatus(),
    start_attempts: startAttempts,
    max_attempts: MAX_START_ATTEMPTS,
    mancy: {
      name: MANCY_IDENTITY.name,
      mission: MANCY_IDENTITY.lore.current_mission
    },
    system: {
      learning: 'active',
      memory: 'organic',
      apis: 6
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/learning/sample', async (req, res) => {
  try {
    const data = await learningModule.loadLearningData();
    const sampleUserId = Object.keys(data.user_models || {})[0] || 'default';
    
    const context = await learningModule.getContextForResponse(sampleUserId, '');
    
    res.json({
      user_id: sampleUserId,
      learned_concepts_count: context.learned_concepts?.length || 0,
      total_users: Object.keys(data.user_models || {}).length,
      total_concepts: data.learned_concepts?.length || 0,
      system_active: true
    });
  } catch (error) {
    res.json({
      system_active: false,
      error: error.message
    });
  }
});

app.post('/api/start', async (req, res) => {
  try {
    const success = await startBot();
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Mancy se está iniciando...',
        status: 'starting'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'No se pudo iniciar Mancy',
        status: 'failed'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      status: 'error'
    });
  }
});

app.post('/api/stop', async (req, res) => {
  try {
    const success = await stopBot();
    
    if (success) {
      res.json({ 
        success: true, 
        message: 'Mancy detenida correctamente',
        status: 'stopped'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Error al detener Mancy',
        status: 'error'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      status: 'error'
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: botActive ? 'healthy' : 'inactive',
    bot_active: botActive,
    discord_ready: discordClient?.user ? true : false,
    timestamp: new Date().toISOString()
  });
});

// ========== INICIAR SERVIDOR WEB ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                 🚀 SERVIDOR MANCY INICIADO              ║
║               Puerto: ${PORT}                           ║
║               Estado: 🔵 ESPERANDO INICIO MANUAL        ║
║                                                          ║
║  INSTRUCCIONES:                                         ║
║  1. Abre http://localhost:${PORT}                       ║
║  2. Haz clic en "Iniciar Mancy"                         ║
║  3. Espera a que se conecte a Discord                   ║
║  4. ¡Habla con @Mancy en Discord!                       ║
║                                                          ║
║  NOTA: No hay auto-inicio para evitar conflictos        ║
╚══════════════════════════════════════════════════════════╝
`);
  
  // NO AUTO-INICIAR - ESPERAR COMANDO MANUAL
  console.log('⏳ Esperando inicio manual desde la página web...');
});

// ========== MANEJO DE APAGADO ==========
process.on('SIGTERM', async () => {
  console.log('💤 Apagando servidor...');
  
  // Guardar datos de aprendizaje
  await learningModule.saveLearningData().catch(() => {});
  
  // Detener bot si está activo
  if (discordClient) {
    await stopBot();
  }
  
  console.log('👋 Servidor apagado correctamente');
  process.exit(0);
});
