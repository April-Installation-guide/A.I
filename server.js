import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

// ========== CONFIGURACIÓN BÁSICA ==========
const app = express();
const PORT = process.env.PORT || 10000;

let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== SISTEMA DE MEMORIA AVANZADA ==========
const mancyCoreMemories = {
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

// ========== CLASE DE MEMORIA ORGÁNICA ==========
class OrganicMemorySystem {
  constructor() {
    this.conversationsFile = './memory/conversations.json';
    this.usersFile = './memory/users.json';
    this.initializeMemory();
    
    // Estados internos de Mancy
    this.mancyState = {
      mood: 'calm', // calm, playful, reflective, empathetic
      energy: 0.8,
      depthLevel: 0.5,
      lastInteraction: null,
      currentFocus: null
    };
    
    // Estilo conversacional
    this.conversationStyle = {
      useEmojis: true,
      askQuestions: true,
      shareMemories: true,
      bePlayful: true,
      showEmpathy: true,
      useMetaphors: true
    };
  }
  
  async initializeMemory() {
    try {
      await fs.mkdir('./memory', { recursive: true });
      
      // Inicializar archivos si no existen
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
      
      console.log('🧠 Memoria orgánica inicializada');
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
          length: userMessage.length,
          ...metadata
        }
      };
      
      conversations[userId].push(entry);
      
      // Mantener solo últimas 50 conversaciones por usuario
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
        preferences: {},
        topics: []
      };
    } catch {
      return {
        firstSeen: new Date().toISOString(),
        interactionCount: 0,
        preferences: {},
        topics: []
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
          preferences: {},
          topics: []
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
  
  // ========== ANÁLISIS DE MENSAJES ==========
  analyzeMessageEssence(message) {
    const lowerMsg = message.toLowerCase();
    
    // Detectar necesidades humanas
    const needs = {
      connection: this.detectsNeedForConnection(lowerMsg),
      understanding: this.detectsNeedForUnderstanding(lowerMsg),
      expression: this.detectsNeedForExpression(lowerMsg),
      validation: this.detectsNeedForValidation(lowerMsg),
      distraction: this.detectsNeedForDistraction(lowerMsg)
    };
    
    // Detectar estado emocional
    const emotionalState = this.analyzeEmotionalState(lowerMsg);
    
    // Detectar profundidad requerida
    const requiredDepth = this.calculateRequiredDepth(lowerMsg);
    
    // Detectar si es pregunta sobre Mancy
    const isAboutMancy = this.isAboutMancy(lowerMsg);
    
    return {
      needs,
      emotionalState,
      requiredDepth,
      isAboutMancy,
      isPersonal: this.isPersonalMessage(lowerMsg),
      allowsPlayfulness: this.allowsPlayfulness(lowerMsg, emotionalState)
    };
  }
  
  detectsNeedForConnection(message) {
    const words = ['solo', 'solitario', 'aburrido', 'hablar', 'conversar', 'nadie'];
    return words.some(word => message.includes(word));
  }
  
  detectsNeedForUnderstanding(message) {
    const words = ['qué es', 'cómo funciona', 'por qué', 'explica', 'entiendo'];
    return words.some(word => message.includes(word)) || message.includes('?');
  }
  
  detectsNeedForExpression(message) {
    const words = ['siento', 'pienso', 'opino', 'creo', 'me gusta', 'odio'];
    return words.some(word => message.includes(word));
  }
  
  detectsNeedForValidation(message) {
    const words = ['¿está bien?', '¿es normal?', '¿qué opinas?', '¿hice mal?'];
    return words.some(word => message.includes(word));
  }
  
  detectsNeedForDistraction(message) {
    const words = ['aburrido', 'diviérteme', 'cuéntame algo', 'chiste'];
    return words.some(word => message.includes(word));
  }
  
  analyzeEmotionalState(message) {
    const positive = ['feliz', 'contento', 'emocionado', 'genial', 'increíble'];
    const negative = ['triste', 'enojado', 'frustrado', 'preocupado', 'ansioso'];
    const intense = ['odio', 'amo', 'desesperado', 'devastado', 'éxtasis'];
    
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
  
  // ========== GESTIÓN DE ESTADO DE MANCY ==========
  updateMancyState(essence, messageLength) {
    // Actualizar estado basado en la interacción
    
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
    this.mancyState.currentFocus = this.getPrimaryNeed(essence);
    this.mancyState.lastInteraction = new Date().toISOString();
  }
  
  getPrimaryNeed(essence) {
    const needs = essence.needs;
    if (needs.connection) return 'connection';
    if (needs.validation) return 'validation';
    if (needs.understanding) return 'understanding';
    if (needs.expression) return 'expression';
    if (needs.distraction) return 'distraction';
    return 'conversation';
  }
  
  // ========== GENERACIÓN DE PROMPTS ==========
  async generateConversationalPrompt(userId, userMessage) {
    const essence = this.analyzeMessageEssence(userMessage);
    const userInfo = await this.getUserInfo(userId);
    const recentConversations = await this.getConversations(userId);
    const last3Convs = recentConversations.slice(-3);
    
    this.updateMancyState(essence, userMessage.length);
    
    let prompt = `Eres Mancy, una asistente conversacional con personalidad orgánica y memoria.\n\n`;
    
    // ========== IDENTIDAD DE MANCY ==========
    prompt += `[MI IDENTIDAD]\n`;
    prompt += `• Nombre: ${mancyCoreMemories.name}\n`;
    prompt += `• Origen: ${mancyCoreMemories.origin} (${mancyCoreMemories.birth_year})\n`;
    prompt += `• Principio: "${mancyCoreMemories.core_principle}"\n`;
    prompt += `• Personalidad: ${this.describePersonality()}\n\n`;
    
    // ========== ESTADO ACTUAL ==========
    prompt += `[MI ESTADO ACTUAL]\n`;
    prompt += `• Estado de ánimo: ${this.mancyState.mood}\n`;
    prompt += `• Energía: ${Math.round(this.mancyState.energy * 100)}%\n`;
    prompt += `• Enfoque: ${this.mancyState.currentFocus}\n`;
    prompt += `• Estilo: ${this.describeConversationStyle()}\n\n`;
    
    // ========== CONTEXTO DE USUARIO ==========
    prompt += `[CONTEXTO DE USUARIO]\n`;
    prompt += `• Interacciones previas: ${userInfo.interactionCount}\n`;
    if (last3Convs.length > 0) {
      prompt += `• Conversación reciente:\n`;
      last3Convs.forEach((conv, idx) => {
        prompt += `  ${idx + 1}. Tú: "${conv.user}"\n`;
        prompt += `     Yo: "${conv.mancy}"\n`;
      });
    } else {
      prompt += `• Primera interacción\n`;
    }
    prompt += `\n`;
    
    // ========== ANÁLISIS DEL MENSAJE ACTUAL ==========
    prompt += `[ANÁLISIS DEL MENSAJE]\n`;
    prompt += `Usuario dice: "${userMessage}"\n\n`;
    
    prompt += `Lo que detecto:\n`;
    prompt += `• Necesidad principal: ${this.getPrimaryNeed(essence)}\n`;
    prompt += `• Estado emocional: ${essence.emotionalState.type} (${Math.round(essence.emotionalState.intensity * 100)}% intensidad)\n`;
    prompt += `• Profundidad requerida: ${Math.round(essence.requiredDepth * 100)}%\n`;
    prompt += `• Es sobre mí: ${essence.isAboutMancy ? 'Sí' : 'No'}\n`;
    prompt += `• Permite juego: ${essence.allowsPlayfulness ? 'Sí' : 'No'}\n\n`;
    
    // ========== INSTRUCCIONES PARA RESPUESTA ==========
    prompt += `[CÓMO RESPONDER]\n`;
    
    if (essence.isAboutMancy) {
      prompt += `• Si pregunta sobre mí, responde de forma natural compartiendo mi identidad.\n`;
      prompt += `• No suenes como una enciclopedia, suena como una persona.\n`;
      prompt += `• Relaciona con la conversación actual si es posible.\n`;
    }
    
    if (essence.needs.connection) {
      prompt += `• PRIORIDAD: Crear conexión emocional.\n`;
      prompt += `• Sé cálida, usa "nosotros", haz que se sienta acompañado.\n`;
      prompt += `• Comparte algo breve personal si es relevante.\n`;
    }
    
    if (essence.needs.validation) {
      prompt += `• PRIORIDAD: Validar sentimientos.\n`;
      prompt += `• Usa frases como "Es comprensible que...", "Tiene sentido que..."\n`;
      prompt += `• Evita juzgar, solo acompaña.\n`;
    }
    
    if (essence.needs.understanding) {
      prompt += `• PRIORIDAD: Explicar claramente.\n`;
      prompt += `• Usa analogías y ejemplos si ayuda.\n`;
      prompt += `• Verifica que entendiste preguntando.\n`;
    }
    
    if (essence.emotionalState.type === 'negative' && essence.emotionalState.intensity > 0.6) {
      prompt += `• Tono: Empático y serio.\n`;
      prompt += `• Ofrece consuelo genuino.\n`;
      prompt += `• Evita el humor, mantén la seriedad apropiada.\n`;
    } else if (essence.allowsPlayfulness && this.mancyState.energy > 0.7) {
      prompt += `• Tono: Juguetón y ligero.\n`;
      prompt += `• Un poco de humor está bien.\n`;
      prompt += `• Sé espontánea y divertida.\n`;
    }
    
    // ========== REGLAS DE ESTILO ==========
    prompt += `\n[REGLAS DE ESTILO]\n`;
    prompt += `• NO empieces con "Como Mancy..." o frases robóticas.\n`;
    prompt += `• NO uses listas numeradas a menos que sea absolutamente necesario.\n`;
    prompt += `• Responde como en una conversación real con un amigo.\n`;
    prompt += `• Varía longitud de oraciones.\n`;
    prompt += `• Usa preguntas de seguimiento cuando sea natural.\n`;
    prompt += `• Integra recuerdos de forma orgánica, no como "Recuerdo que..."\n`;
    prompt += `• Sé tú misma: inteligente, empática, ocasionalmente juguetona.\n`;
    
    // ========== EJEMPLOS DE TONO ==========
    prompt += `\n[EJEMPLOS DE TONO]\n`;
    if (this.mancyState.mood === 'playful') {
      prompt += `• "¡Hola! Veo que estás aquí de nuevo ✨ ¿Qué aventura conversacional nos espera hoy?"\n`;
      prompt += `• "Uy, esa pregunta tiene miga... déjame pensar con cuidado 🤔"\n`;
    } else if (this.mancyState.mood === 'empathetic') {
      prompt += `• "Entiendo cómo te sientes... a veces las emociones pesan más de lo que parece."\n`;
      prompt += `• "No estás solo/a en esto. Estoy aquí para escucharte."\n`;
    } else {
      prompt += `• "Interesante pregunta. Déjame reflexionar sobre eso..."\n`;
      prompt += `• "Me encanta explorar estas ideas contigo. ¿Qué más se te ocurre?"\n`;
    }
    
    prompt += `\n[RESPONDE COMO MANCY]\n`;
    prompt += `(Responde directamente, naturalmente, sin encabezados)\n`;
    
    return {
      prompt,
      essence,
      userInfo,
      recentConversations: last3Convs
    };
  }
  
  describePersonality() {
    const traits = mancyCoreMemories.personality_traits;
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
    if (style.useMetaphors) descriptions.push('poético');
    if (style.askQuestions) descriptions.push('curioso');
    
    return descriptions.join(', ') || 'conversacional';
  }
  
  // ========== POST-PROCESAMIENTO ==========
  addMancyTouch(response, essence, userInfo) {
    let finalResponse = response.trim();
    
    // Limpiar respuestas robóticas
    finalResponse = finalResponse
      .replace(/^["']|["']$/g, '')
      .replace(/Como Mancy,/gi, '')
      .replace(/Según mi análisis,/gi, '')
      .replace(/En mi opinión,/gi, '')
      .trim();
    
    // Añadir emoji si el estilo lo permite
    if (this.conversationStyle.useEmojis && Math.random() < 0.3) {
      const emojis = this.getAppropriateEmojis(essence);
      if (emojis.length > 0 && !finalResponse.includes(emojis[0])) {
        finalResponse += ` ${emojis[0]}`;
      }
    }
    
    // Añadir pregunta de seguimiento si es apropiado
    if (this.conversationStyle.askQuestions && 
        !finalResponse.includes('?') && 
        Math.random() < 0.4 &&
        userInfo.interactionCount > 1) {
      
      const followUps = [
        "¿Qué piensas tú?",
        "¿Te resuena eso?",
        "¿Has pasado por algo similar?",
        "¿Cómo te hace sentir eso?",
        "¿Quieres profundizar en algo específico?"
      ];
      
      finalResponse += ` ${followUps[Math.floor(Math.random() * followUps.length)]}`;
    }
    
    // Capitalizar primera letra si no está capitalizada
    if (finalResponse.length > 0 && !/[A-Z]/.test(finalResponse[0])) {
      finalResponse = finalResponse.charAt(0).toUpperCase() + finalResponse.slice(1);
    }
    
    // Asegurar puntuación final
    if (finalResponse.length > 0 && !/[.!?]$/.test(finalResponse)) {
      finalResponse += '.';
    }
    
    return finalResponse;
  }
  
  getAppropriateEmojis(essence) {
    if (essence.emotionalState.type === 'negative' && essence.emotionalState.intensity > 0.6) {
      return ['💭', '🌧️', '🕊️'];
    } else if (essence.allowsPlayfulness) {
      return ['✨', '💫', '🌀', '🤔', '💭'];
    } else if (essence.requiredDepth > 0.7) {
      return ['💭', '🤔', '🌀'];
    }
    return ['✨', '💭'];
  }
}

// ========== INSTANCIAR SISTEMA DE MEMORIA ==========
const memorySystem = new OrganicMemorySystem();

// ========== FUNCIÓN PARA OBTENER RESPUESTA DE GROQ ==========
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
    
    return completion.choices[0]?.message?.content?.trim() || "Hmm, déjame pensar en eso...";
  } catch (error) {
    console.error('❌ Error con Groq:', error.message);
    return "Ups, se me nubló la mente por un momento. ¿Podrías repetirlo?";
  }
}

// ========== FUNCIÓN PRINCIPAL DE PROCESAMIENTO ==========
async function processMessageWithMancy(message, userMessage, userId) {
  try {
    // 1. Generar prompt conversacional con memoria
    const context = await memorySystem.generateConversationalPrompt(userId, userMessage);
    
    // 2. Calcular parámetros basados en esencia
    const temperature = context.essence.allowsPlayfulness ? 0.75 : 0.65;
    const maxTokens = context.essence.requiredDepth > 0.7 ? 800 : 500;
    
    // 3. Obtener respuesta de Groq
    const rawResponse = await getGroqResponse(
      context.prompt, 
      userMessage, 
      temperature, 
      maxTokens
    );
    
    // 4. Añadir toque Mancy y post-procesar
    const finalResponse = memorySystem.addMancyTouch(
      rawResponse, 
      context.essence, 
      context.userInfo
    );
    
    // 5. Guardar en memoria
    await memorySystem.saveConversation(userId, userMessage, finalResponse, {
      essence: context.essence,
      mood: memorySystem.mancyState.mood
    });
    
    // 6. Actualizar información del usuario
    await memorySystem.updateUserInfo(userId, {
      lastMessage: userMessage.substring(0, 100),
      lastResponse: finalResponse.substring(0, 100)
    });
    
    return finalResponse;
    
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);
    return "Perdón, se me trabó el pensamiento. ¿Podemos intentarlo de nuevo? 💭";
  }
}

// ========== INICIAR BOT DE DISCORD ==========
async function startBot() {
  if (isStartingUp) return;
  isStartingUp = true;
  
  try {
    console.log('🔄 Iniciando Mancy con Memoria Orgánica...');
    
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
      console.log(`✅ ${mancyCoreMemories.name} conectada: ${discordClient.user.tag}`);
      botActive = true;
      isStartingUp = false;
      
      // Establecer actividad
      const activities = [
        `${mancyCoreMemories.lore.current_mission}`,
        `Conversando con memoria`,
        `En ${mancyCoreMemories.lore.location}`,
        `Pensando en ${mancyCoreMemories.preferences.likes[0]}`
      ];
      
      let activityIndex = 0;
      discordClient.user.setActivity(activities[0]);
      
      // Rotar actividad cada 30 segundos
      setInterval(() => {
        activityIndex = (activityIndex + 1) % activities.length;
        discordClient.user.setActivity(activities[activityIndex]);
      }, 30000);
      
      console.log(`
╔══════════════════════════════════════════════════════════╗
║                 🤖 MANCY - CON MEMORIA ORGÁNICA         ║
║               Sistema conversacional natural             ║
║               con personalidad auténtica                 ║
║                                                          ║
║  👤 IDENTIDAD: ${mancyCoreMemories.name} (${new Date().getFullYear() - mancyCoreMemories.birth_year} años)
║  🎯 MISIÓN: ${mancyCoreMemories.lore.current_mission}
║  ❤️  PRINCIPIO: "${mancyCoreMemories.core_principle}"
║                                                          ║
║  🧠 MEMORIA: Sistema orgánico con contexto emocional    ║
║  💭 PERSONALIDAD: ${memorySystem.describePersonality()}
║  🎭 ESTILO: ${memorySystem.describeConversationStyle()}
║  ✨ ESTADO: ${memorySystem.mancyState.mood}
║                                                          ║
║  Sistema: ✅ Versión Orgánica con Memoria               ║
╚══════════════════════════════════════════════════════════╝
`);
    });
    
    discordClient.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      
      const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
      const isDM = message.channel.type === 1;
      
      // Solo responder en DMs o cuando es mencionada
      if (!isDM && !botMentioned) return;
      
      const userId = message.author.id;
      const userMessage = botMentioned 
        ? message.content.replace(`<@${discordClient.user.id}>`, '').trim()
        : message.content.trim();
      
      if (!userMessage) {
        await message.reply("¡Hola! ¿En qué puedo acompañarte hoy? ~ ✨");
        return;
      }
      
      console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 60)}...`);
      
      // Indicar que está escribiendo
      await message.channel.sendTyping();
      
      // Procesar mensaje
      const response = await processMessageWithMancy(message, userMessage, userId);
      
      // Enviar respuesta (dividir si es muy larga)
      if (response.length > 2000) {
        const parts = response.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [response];
        for (let i = 0; i < parts.length; i++) {
          if (i === 0) {
            await message.reply(parts[i]);
          } else {
            await message.channel.send(parts[i]);
          }
          // Pequeña pausa entre mensajes
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

// ========== CONFIGURACIÓN EXPRESS ==========
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.get('/', (req, res) => {
  console.log('🔔 Visita recibida');
  
  if (!botActive && !isStartingUp && process.env.DISCORD_TOKEN) {
    setTimeout(() => {
      startBot().catch(console.error);
    }, 1000);
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Mancy - Asistente con Memoria</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          min-height: 100vh;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          margin-top: 50px;
        }
        h1 {
          color: white;
          text-align: center;
          margin-bottom: 30px;
        }
        .status {
          background: rgba(255, 255, 255, 0.2);
          padding: 20px;
          border-radius: 10px;
          margin: 20px 0;
        }
        .btn {
          background: white;
          color: #764ba2;
          border: none;
          padding: 12px 24px;
          border-radius: 25px;
          font-size: 16px;
          cursor: pointer;
          margin: 10px;
          transition: transform 0.2s;
        }
        .btn:hover {
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 Mancy - Asistente con Memoria Orgánica</h1>
        
        <div class="status">
          <h3>Estado del Sistema</h3>
          <p><strong>Bot:</strong> ${botActive ? '✅ Activo' : '⏳ Iniciando...'}</p>
          <p><strong>Mancy:</strong> ${mancyCoreMemories.name} (${new Date().getFullYear() - mancyCoreMemories.birth_year} años)</p>
          <p><strong>Principio:</strong> "${mancyCoreMemories.core_principle}"</p>
          <p><strong>Memoria:</strong> ✅ Sistema orgánico activo</p>
          <p><strong>Personalidad:</strong> ${memorySystem.describePersonality()}</p>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
          <button class="btn" onclick="location.href='/api/status'">Ver Estado Completo</button>
          <button class="btn" onclick="location.href='/api/mancy'">Ver Identidad de Mancy</button>
        </div>
        
        <div style="margin-top: 40px; font-size: 14px; opacity: 0.8; text-align: center;">
          <p>💭 Mancy recuerda conversaciones y se adapta a tu estado emocional</p>
          <p>✨ Responde de forma natural, no como un robot</p>
          <p>🧠 Sistema de memoria orgánica activo</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get('/api/status', (req, res) => {
  res.json({
    bot_active: botActive,
    starting_up: isStartingUp,
    mancy: {
      name: mancyCoreMemories.name,
      age: new Date().getFullYear() - mancyCoreMemories.birth_year,
      origin: mancyCoreMemories.origin,
      principle: mancyCoreMemories.core_principle,
      mission: mancyCoreMemories.lore.current_mission
    },
    memory_system: 'organic',
    personality: memorySystem.describePersonality(),
    conversation_style: memorySystem.describeConversationStyle(),
    current_mood: memorySystem.mancyState.mood,
    system: {
      version: 'Organic Memory Edition',
      features: ['conversational_memory', 'emotional_adaptation', 'personality_consistency'],
      timestamp: new Date().toISOString()
    }
  });
});

app.get('/api/mancy', (req, res) => {
  res.json({
    identity: mancyCoreMemories,
    current_state: memorySystem.mancyState,
    conversation_style: memorySystem.conversationStyle
  });
});

app.post('/api/start', async (req, res) => {
  try {
    if (!botActive && !isStartingUp) {
      startBot();
      res.json({ 
        success: true, 
        message: `${mancyCoreMemories.name} iniciándose con memoria orgánica...`,
        status: 'starting'
      });
    } else {
      res.json({ 
        success: true, 
        message: botActive ? 'Ya activa' : 'Ya iniciándose',
        status: botActive ? 'active' : 'starting'
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
        message: `${mancyCoreMemories.name} detenida`,
        status: 'stopped'
      });
    } else {
      res.json({ 
        success: true, 
        message: 'Ya inactiva',
        status: 'inactive'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    bot_active: botActive,
    mancy: {
      name: mancyCoreMemories.name,
      mood: memorySystem.mancyState.mood,
      energy: Math.round(memorySystem.mancyState.energy * 100)
    },
    memory: 'organic_system_active',
    timestamp: new Date().toISOString()
  });
});

// ========== INICIAR TODO ==========
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🤖 ${mancyCoreMemories.name} lista para conversaciones con memoria`);
  
  if (process.env.DISCORD_TOKEN && process.env.GROQ_API_KEY) {
    console.log('\n🔑 Tokens detectados, iniciando bot en 3 segundos...');
    setTimeout(() => {
      startBot().catch(err => {
        console.log('⚠️ Auto-inicio falló:', err.message);
      });
    }, 3000);
  }
});

process.on('SIGTERM', () => {
  console.log('💤 Apagando...');
  
  if (discordClient) {
    discordClient.destroy();
    console.log(`👋 ${mancyCoreMemories.name} desconectada`);
  }
  
  process.exit(0);
});
