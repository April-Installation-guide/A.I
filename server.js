import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import ContinuousLearningModule from './learning.js';

dotenv.config();

// ========== CONFIGURACIÓN ==========
const app = express();
const PORT = process.env.PORT || 10000;

let discordClient = null;
let botActive = false;
let isStartingUp = false;
const learningModule = new ContinuousLearningModule();

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

// ========== SISTEMA DE CONOCIMIENTO ==========
class KnowledgeSystem {
  constructor() {
    this.cache = new Map();
  }
  
  async buscarWikipedia(consulta) {
    const cacheKey = `wiki_${consulta}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    
    try {
      // Intentar español primero
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
      // Intentar inglés si español falla
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
  
  async obtenerInfoPais(consulta) {
    const cacheKey = `pais_${consulta}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    
    try {
      const response = await axios.get(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(consulta)}`,
        { timeout: 4000 }
      );
      
      if (response.data && response.data.length > 0) {
        const pais = response.data[0];
        const resultado = {
          fuente: 'restcountries',
          nombre: pais.name.common,
          capital: pais.capital?.[0] || 'No disponible',
          poblacion: pais.population?.toLocaleString() || 'Desconocida',
          region: pais.region,
          bandera: pais.flags?.png
        };
        
        this.cache.set(cacheKey, resultado);
        return resultado;
      }
    } catch (error) {}
    
    return null;
  }
  
  async obtenerCita(consulta = null) {
    const cacheKey = `cita_${consulta || 'aleatoria'}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    
    try {
      let url = 'https://api.quotable.io/random';
      if (consulta) {
        url = `https://api.quotable.io/search/quotes?query=${encodeURIComponent(consulta)}&limit=1`;
      }
      
      const response = await axios.get(url, { timeout: 3000 });
      
      let citaData;
      if (consulta && response.data.results) {
        citaData = response.data.results[0];
      } else {
        citaData = response.data;
      }
      
      if (citaData) {
        const resultado = {
          fuente: 'quotable',
          cita: citaData.content,
          autor: citaData.author
        };
        
        this.cache.set(cacheKey, resultado);
        return resultado;
      }
    } catch (error) {}
    
    return null;
  }
  
  async definirPalabra(palabra) {
    const cacheKey = `def_${palabra}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    
    try {
      const response = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(palabra)}`,
        { timeout: 4000 }
      );
      
      if (response.data && response.data[0]) {
        const entrada = response.data[0];
        const resultado = {
          fuente: 'dictionary',
          palabra: entrada.word,
          significado: entrada.meanings[0]?.definitions[0]?.definition || 'No disponible'
        };
        
        this.cache.set(cacheKey, resultado);
        return resultado;
      }
    } catch (error) {}
    
    return null;
  }
  
  async obtenerClima(ciudad) {
    const cacheKey = `clima_${ciudad}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
    
    try {
      const geoResponse = await axios.get(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(ciudad)}&count=1&language=es`,
        { timeout: 4000 }
      );
      
      if (geoResponse.data.results && geoResponse.data.results.length > 0) {
        const { latitude, longitude, name } = geoResponse.data.results[0];
        
        const climaResponse = await axios.get(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`,
          { timeout: 4000 }
        );
        
        const clima = climaResponse.data.current_weather;
        const resultado = {
          fuente: 'openmeteo',
          ciudad: name,
          temperatura: `${clima.temperature}°C`,
          viento: `${clima.windspeed} km/h`,
          condicion: this.interpretarClima(clima.weathercode)
        };
        
        this.cache.set(cacheKey, resultado);
        return resultado;
      }
    } catch (error) {}
    
    return null;
  }
  
  interpretarClima(codigo) {
    const condiciones = {
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
    
    return condiciones[codigo] || 'Condición desconocida';
  }
  
  async buscarInformacion(consulta) {
    const tipo = this.detectarTipoConsulta(consulta);
    
    let resultado = null;
    
    switch(tipo) {
      case 'pais':
        resultado = await this.obtenerInfoPais(consulta);
        break;
      case 'cita':
        resultado = await this.obtenerCita(consulta);
        break;
      case 'palabra':
        resultado = await this.definirPalabra(consulta);
        break;
      case 'clima':
        resultado = await this.obtenerClima(consulta);
        break;
      default:
        resultado = await this.buscarWikipedia(consulta);
    }
    
    return {
      consulta: consulta,
      tipo: tipo,
      encontrado: !!resultado,
      datos: resultado
    };
  }
  
  detectarTipoConsulta(texto) {
    const lower = texto.toLowerCase();
    
    if (/\b(país|capital|bandera|población|continente)\b/.test(lower)) return 'pais';
    if (/\b(cita|frase|dicho|refrán)\b/.test(lower)) return 'cita';
    if (/\b(significa|definición|qué es|palabra)\b/.test(lower)) return 'palabra';
    if (/\b(clima|tiempo|temperatura|lluvia|grados)\b/.test(lower)) return 'clima';
    
    return 'general';
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
    const words = ['solo', 'solitario', 'aburrido', 'hablar', 'conversar', 'nadie'];
    return words.some(word => message.includes(word));
  }
  
  detectsNeedForUnderstanding(message) {
    return message.includes('?') || 
           message.includes('cómo') || 
           message.includes('por qué') ||
           message.includes('explica');
  }
  
  detectsNeedForExpression(message) {
    const words = ['siento', 'pienso', 'opino', 'creo', 'me gusta', 'odio'];
    return words.some(word => message.includes(word));
  }
  
  detectsNeedForValidation(message) {
    const words = ['está bien', 'es normal', 'qué opinas', 'hice mal'];
    return words.some(word => message.includes(word));
  }
  
  detectsNeedForDistraction(message) {
    const words = ['aburrido', 'diviérteme', 'cuéntame algo', 'chiste'];
    return words.some(word => message.includes(word));
  }
  
  needsInformation(message) {
    const infoWords = ['qué es', 'quién es', 'dónde', 'cuándo', 'por qué', 'cómo'];
    return infoWords.some(word => message.includes(word));
  }
  
  needsExternalInformation(message) {
    // ¿Necesita buscar información externa?
    const needsInfo = this.needsInformation(message);
    const isQuestion = message.includes('?');
    const hasSpecificQuery = message.length > 10 && 
                           (isQuestion || this.containsFactualQuery(message));
    
    return needsInfo || hasSpecificQuery;
  }
  
  containsFactualQuery(message) {
    const factualWords = ['capital', 'población', 'clima', 'temperatura', 'definición'];
    return factualWords.some(word => message.toLowerCase().includes(word));
  }
  
  analyzeEmotionalState(message) {
    const positive = ['feliz', 'contento', 'emocionado', 'genial', 'increíble'];
    const negative = ['triste', 'enojado', 'frustrado', 'preocupado', 'ansioso'];
    const intense = ['odio', 'amo', 'desesperado', 'devastado'];
    
    let posCount = positive.filter(word => message.includes(word)).length;
    let negCount = negative.filter(word => message.includes(word)).length;
    let intCount = intense.filter(word => message.includes(word)).length;
    
    const total = posCount + negCount;
    
    if (total === 0) return { type: 'neutral', intensity: 0.1 };
    
    const type = posCount > negCount ? 'positive' : 'negative';
    const intensity = Math.min((total + intCount * 2) / 10, 1.0);
    
    return { type, intensity };
  }
  
  calculateRequiredDepth(message) {
    if (message.length > 100) return 0.8;
    if (message.includes('?')) return 0.7;
    if (message.includes('por qué') || message.includes('porque')) return 0.9;
    return 0.5;
  }
  
  isAboutMancy(message) {
    const triggers = [
      'quién eres mancy',
      'quien eres mancy',
      'eres mancy',
      'mancy eres',
      'soul garden',
      'luxo',
      'coco',
      'mel ',
      'dunith ',
      'martin ',
      'april '
    ];
    
    return triggers.some(trigger => message.includes(trigger));
  }
  
  isPersonalMessage(message) {
    const personalWords = ['yo ', 'mi ', 'me ', 'mí ', 'mis '];
    return personalWords.some(word => message.includes(word));
  }
  
  allowsPlayfulness(message, emotionalState) {
    if (emotionalState.type === 'negative' && emotionalState.intensity > 0.6) {
      return false;
    }
    
    const seriousTopics = ['muerte', 'enfermedad', 'triste', 'depresión', 'suicidio'];
    if (seriousTopics.some(topic => message.includes(topic))) {
      return false;
    }
    
    return true;
  }
  
  updateMancyState(essence) {
    if (essence.emotionalState.intensity > 0.7) {
      this.mancyState.mood = 'empathetic';
      this.mancyState.energy = Math.max(0.4, this.mancyState.energy - 0.1);
    } else if (essence.allowsPlayfulness) {
      this.mancyState.mood = 'playful';
      this.mancyState.energy = Math.min(1.0, this.mancyState.energy + 0.05);
    } else if (essence.requiredDepth > 0.7) {
      this.mancyState.mood = 'reflective';
    }
    
    this.mancyState.depthLevel = essence.requiredDepth;
    this.mancyState.lastInteraction = new Date().toISOString();
  }
  
  getPrimaryNeed(essence) {
    const needs = essence.needs;
    if (needs.connection) return 'connection';
    if (needs.validation) return 'validation';
    if (needs.understanding) return 'understanding';
    if (needs.expression) return 'expression';
    if (needs.distraction) return 'distraction';
    if (needs.information) return 'information';
    return 'conversation';
  }
  
  describePersonality() {
    const traits = MANCY_IDENTITY.personality_traits;
    const descriptions = [];
    
    if (traits.empathy > 0.8) descriptions.push('empática');
    if (traits.curiosity > 0.8) descriptions.push('curiosa');
    if (traits.depth > 0.7) descriptions.push('reflexiva');
    if (traits.playfulness > 0.5) descriptions.push('juguetona');
    if (traits.warmth > 0.8) descriptions.push('cálida');
    
    return descriptions.join(', ') || 'equilibrada';
  }
  
  describeConversationStyle() {
    const style = this.conversationStyle;
    const descriptions = [];
    
    if (style.showEmpathy) descriptions.push('empático');
    if (style.bePlayful) descriptions.push('juguetón');
    if (style.askQuestions) descriptions.push('curioso');
    
    return descriptions.join(', ') || 'conversacional';
  }
  
  addMancyTouch(response, essence) {
    let finalResponse = response.trim();
    
    // Limpiar respuestas robóticas
    finalResponse = finalResponse
      .replace(/^["']|["']$/g, '')
      .replace(/Como Mancy,/gi, '')
      .replace(/Según mi análisis,/gi, '')
      .trim();
    
    // Añadir emoji si es apropiado
    if (this.conversationStyle.useEmojis && Math.random() < 0.3) {
      const emojis = this.getAppropriateEmojis(essence);
      if (emojis.length > 0 && !finalResponse.includes(emojis[0])) {
        finalResponse += ` ${emojis[0]}`;
      }
    }
    
    // Añadir puntuación final
    if (finalResponse.length > 0 && !/[.!?]$/.test(finalResponse)) {
      finalResponse += '.';
    }
    
    return finalResponse;
  }
  
  getAppropriateEmojis(essence) {
    if (essence.emotionalState.type === 'negative' && essence.emotionalState.intensity > 0.6) {
      return ['💭', '🌧️'];
    } else if (essence.allowsPlayfulness) {
      return ['✨', '💫', '🤔'];
    }
    return ['✨', '💭'];
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
  prompt += `• Personalidad: ${memorySystem.describePersonality()}\n`;
  prompt += `• Gustos: ${MANCY_IDENTITY.preferences.likes.slice(0, 3).join(', ')}\n\n`;
  
  // ========== ESTADO ACTUAL ==========
  prompt += `[MI ESTADO ACTUAL]\n`;
  prompt += `• Estado de ánimo: ${memorySystem.mancyState.mood}\n`;
  prompt += `• Energía: ${Math.round(memorySystem.mancyState.energy * 100)}%\n`;
  prompt += `• Estilo: ${memorySystem.describeConversationStyle()}\n\n`;
  
  // ========== CONTEXTO ==========
  prompt += `[CONTEXTO DE USUARIO]\n`;
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
          prompt += `• Fuente: Wikipedia\n`;
          prompt += `• Resumen: ${externalInfo.datos.resumen.substring(0, 200)}...\n`;
          break;
        case 'restcountries':
          prompt += `• Fuente: Datos de país\n`;
          prompt += `• País: ${externalInfo.datos.nombre}\n`;
          prompt += `• Capital: ${externalInfo.datos.capital}\n`;
          prompt += `• Población: ${externalInfo.datos.poblacion}\n`;
          break;
        case 'quotable':
          prompt += `• Fuente: Cita\n`;
          prompt += `• Cita: "${externalInfo.datos.cita}"\n`;
          prompt += `• Autor: ${externalInfo.datos.autor}\n`;
          break;
        case 'dictionary':
          prompt += `• Fuente: Diccionario\n`;
          prompt += `• Palabra: ${externalInfo.datos.palabra}\n`;
          prompt += `• Significado: ${externalInfo.datos.significado}\n`;
          break;
        case 'openmeteo':
          prompt += `• Fuente: Clima\n`;
          prompt += `• Ciudad: ${externalInfo.datos.ciudad}\n`;
          prompt += `• Temperatura: ${externalInfo.datos.temperatura}\n`;
          prompt += `• Condición: ${externalInfo.datos.condicion}\n`;
          break;
      }
    }
    prompt += `\n`;
  }
  
  // ========== ANÁLISIS DEL MENSAJE ==========
  prompt += `[ANÁLISIS DEL MENSAJE ACTUAL]\n`;
  prompt += `Usuario dice: "${userMessage}"\n\n`;
  
  prompt += `Lo que detecto:\n`;
  prompt += `• Necesidad principal: ${memorySystem.getPrimaryNeed(essence)}\n`;
  prompt += `• Estado emocional: ${essence.emotionalState.type} (${Math.round(essence.emotionalState.intensity * 100)}%)\n`;
  prompt += `• Es sobre mí: ${essence.isAboutMancy ? 'Sí' : 'No'}\n`;
  prompt += `• Permite juego: ${essence.allowsPlayfulness ? 'Sí' : 'No'}\n\n`;
  
  // ========== INSTRUCCIONES ==========
  prompt += `[CÓMO RESPONDER]\n`;
  
  if (essence.isAboutMancy) {
    prompt += `• Si pregunta sobre mí, comparte mi identidad de forma natural.\n`;
    prompt += `• No suenes robótico, suena como una persona contando sobre sí misma.\n`;
  }
  
  if (externalInfo && externalInfo.encontrado) {
    prompt += `• Integra la información encontrada de forma NATURAL.\n`;
    prompt += `• NO digas "Según Wikipedia" o "Encontré que".\n`;
    prompt += `• Incorpora la información en tu respuesta conversacional.\n`;
  }
  
  if (essence.needs.connection) {
    prompt += `• PRIORIDAD: Conectar emocionalmente.\n`;
    prompt += `• Sé cálida, usa "nosotros", haz que se sienta acompañado.\n`;
  }
  
  if (essence.emotionalState.type === 'negative' && essence.emotionalState.intensity > 0.6) {
    prompt += `• Tono: Empático y serio.\n`;
    prompt += `• Ofrece consuelo genuino.\n`;
    prompt += `• Evita el humor.\n`;
  } else if (essence.allowsPlayfulness && memorySystem.mancyState.energy > 0.7) {
    prompt += `• Tono: Juguetón y ligero.\n`;
    prompt += `• Un poco de humor está bien.\n`;
  }
  
  // ========== REGLAS DE ESTILO ==========
  prompt += `\n[REGLAS DE ESTILO]\n`;
  prompt += `• NO empieces con "Como Mancy..." o frases robóticas.\n`;
  prompt += `• Responde como en una conversación real.\n`;
  prompt += `• Varía longitud de oraciones.\n`;
  prompt += `• Integra información de forma orgánica.\n`;
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

// ========== PROCESAMIENTO PRINCIPAL ==========
async function processMessageWithMancy(message, userMessage, userId) {
  try {
    // 1. Verificar si necesita búsqueda externa
    let externalInfo = null;
    const essence = memorySystem.analyzeMessageEssence(userMessage);
    
    if (essence.needsExternalInfo && !essence.isAboutMancy) {
      externalInfo = await knowledgeSystem.buscarInformacion(userMessage);
    }
    
    // 2. Generar prompt inteligente
    const context = await generateMancyPrompt(userId, userMessage, externalInfo);
    
    // 3. Obtener respuesta de Groq
    const rawResponse = await getGroqResponse(
      context.prompt,
      userMessage,
      context.temperature,
      context.maxTokens
    );
    
    // 4. Añadir toque Mancy
    const finalResponse = memorySystem.addMancyTouch(rawResponse, essence);
    
    // 5. Guardar en memoria
    await memorySystem.saveConversation(userId, userMessage, finalResponse, {
      essence: context.essence,
      externalInfo: externalInfo?.encontrado ? true : false
    });
    
    // 6. Actualizar usuario
    await memorySystem.updateUserInfo(userId, {
      lastMessage: userMessage.substring(0, 100)
    });
    
    return finalResponse;
    
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    return "Perdón, se me trabó el pensamiento. ¿Podemos intentarlo de nuevo? 💭";
  }
}

// ========== INICIAR BOT ==========
async function startBot() {
  if (isStartingUp) return;
  isStartingUp = true;
  
  try {
    console.log('🔄 Iniciando Mancy con APIs de conocimiento...');
    
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
      console.log(`✅ ${MANCY_IDENTITY.name} conectada: ${discordClient.user.tag}`);
      botActive = true;
      isStartingUp = false;
      
      const activities = [
        `${MANCY_IDENTITY.lore.current_mission}`,
        `Consultando APIs de conocimiento`,
        `En ${MANCY_IDENTITY.lore.location}`
      ];
      
      let activityIndex = 0;
      discordClient.user.setActivity(activities[0]);
      
      setInterval(() => {
        activityIndex = (activityIndex + 1) % activities.length;
        discordClient.user.setActivity(activities[activityIndex]);
      }, 30000);
      
      console.log(`
╔══════════════════════════════════════════════════════════╗
║                 🤖 MANCY - CON APIs DE CONOCIMIENTO     ║
║               Wikipedia + Países + Clima + Citas        ║
║               con Memoria Orgánica Integrada            ║
║                                                          ║
║  👤 IDENTIDAD: ${MANCY_IDENTITY.name}
║  🎯 MISIÓN: ${MANCY_IDENTITY.lore.current_mission}
║  ❤️  PRINCIPIO: "${MANCY_IDENTITY.core_principle}"
║                                                          ║
║  🔍 APIS ACTIVAS:                                       ║
║    • Wikipedia (ES/EN)                                  ║
║    • RestCountries (Datos de países)                    ║
║    • Quotable (Citas)                                   ║
║    • DictionaryAPI (Definiciones)                       ║
║    • Open-Meteo (Clima)                                 ║
║                                                          ║
║  🧠 MEMORIA: Sistema orgánico con contexto              ║
║  💭 PERSONALIDAD: ${memorySystem.describePersonality()}
╚══════════════════════════════════════════════════════════╝
`);
    });
    
    discordClient.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      // ========== IGNORAR @everyone y @here ==========
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
      
      // Indicar que está escribiendo
      await message.channel.sendTyping();
      
      // Procesar mensaje
      const response = await processMessageWithMancy(message, userMessage, userId);
      
      // Enviar respuesta
      if (response.length > 2000) {
        const parts = response.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [response];
        for (let i = 0; i < parts.length; i++) {
          if (i === 0) {
            await message.reply(parts[i]);
          } else {
            await message.channel.send(parts[i]);
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } else {
        await message.reply(response);
      }
    });
    
    await discordClient.login(process.env.DISCORD_TOKEN);
    
  } catch (error) {
    console.error('❌ Error iniciando bot:', error);
    isStartingUp = false;
  }
}

// ========== SERVER EXPRESS ==========
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Mancy - Con APIs</title><style>
      body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px;
             background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
      .container { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px);
                   border-radius: 20px; padding: 40px; margin-top: 50px; }
      h1 { text-align: center; }
      .status { background: rgba(255,255,255,0.2); padding: 20px; border-radius: 10px; margin: 20px 0; }
    </style></head>
    <body>
      <div class="container">
        <h1>🤖 Mancy - Con APIs de Conocimiento</h1>
        <div class="status">
          <p><strong>Bot:</strong> ${botActive ? '✅ Activo' : '⏳ Iniciando...'}</p>
          <p><strong>Mancy:</strong> ${MANCY_IDENTITY.name}</p>
          <p><strong>APIs:</strong> Wikipedia, Países, Clima, Citas, Diccionario</p>
          <p><strong>Memoria:</strong> Sistema orgánico activo</p>
        </div>
        <p style="text-align: center; opacity: 0.8;">
          💭 Mancy consulta APIs externas y las integra en conversaciones naturales
        </p>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/status', (req, res) => {
  res.json({
    bot_active: botActive,
    mancy: MANCY_IDENTITY,
    apis: ['Wikipedia', 'RestCountries', 'Quotable', 'DictionaryAPI', 'Open-Meteo'],
    memory: 'organic_system',
    personality: memorySystem.describePersonality()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/start', async (req, res) => {
  if (!botActive && !isStartingUp) {
    startBot();
    res.json({ success: true, message: 'Iniciando...' });
  } else {
    res.json({ success: true, message: botActive ? 'Ya activa' : 'Ya iniciándose' });
  }
});

// ========== INICIAR ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Servidor en puerto ${PORT}`);
  console.log(`🤖 ${MANCY_IDENTITY.name} con APIs de conocimiento`);
  
  if (process.env.DISCORD_TOKEN && process.env.GROQ_API_KEY) {
    console.log('\n🔑 Tokens detectados, iniciando en 3 segundos...');
    setTimeout(() => {
      startBot().catch(console.error);
    }, 3000);
  }
});

process.on('SIGTERM', () => {
  if (discordClient) {
    discordClient.destroy();
    console.log(`👋 ${MANCY_IDENTITY.name} desconectada`);
  }
  process.exit(0);
});
