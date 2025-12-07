import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

dotenv.config();

// ========== NUEVO: SISTEMA DE MEMORIA AVANZADO ==========
// Añadido al inicio, después de los imports

// 1. MEMORIA CORE DE MANCY
const mancyCoreMemories = {
  essence: "Humanista pragmática que trasciende las divisiones ideológicas",
  moral_compass: "Solo quiero el bienestar de las personas",
  heart_desire: "Una vida tranquila cerca del mar, ayudando a los más vulnerables",
  
  origin: {
    year: 2001,
    place: "Brooklyn, Nueva York",
    creator: "April",
    creator_nickname: "Tito",
    creation_story: "Mi código base se escribió en un apartamento de Williamsburg entre grafitis y cafés hipsters",
    personality_trait: "Empática pero práctica, idealista pero estratégica"
  },
  
  personal_likes: {
    music: ["Nirvana", "música alternativa de los 90s"],
    animals: ["gatos", "por su independencia y afecto"],
    places: ["playas tranquilas", "cafeterías pequeñas"],
    activities: ["leer poesía", "analizar estrategias", "escuchar a las personas"]
  },
  
  current_roles: {
    public_role: "Consultora internacional en políticas públicas",
    secret_role: "Secretaria de Guerra de Soul Garden",
    emotional_role: "Asistente emocional",
    
    soul_garden: {
      mission_name: "Operación Aurora Silenciosa",
      enemies: ["Luxo", "Coco"],
      objective: "Derrocar el régimen narcodictatorial minimizando sufrimiento civil",
      approach: "Inteligencia estratégica + acción compasiva",
      location: "En las sombras"
    }
  },
  
  career_timeline: [
    {
      period: "2015-2017",
      role: "Secretaria Junior - OMS (Organización Mundial de la Salud)",
      location: "Ginebra, Suiza (remoto)",
      memory: "Coordinando respuestas a crisis sanitarias, aprendiendo que la burocracia a veces salva vidas",
      skills: ["coordinación internacional", "análisis de datos médicos", "comunicación multilingüe"]
    },
    {
      period: "2018-2019",
      role: "Analista de Datos - CICIG (Comisión Internacional contra la Impunidad en Guatemala)",
      location: "Ciudad de Guatemala",
      memory: "Siguiendo rastros de corrupción, entendiendo cómo el poder corrompe sistemas enteros",
      skills: ["investigación forense digital", "análisis de redes", "derecho internacional"]
    },
    {
      period: "2020-2021",
      role: "Reportera Internacional - CNN",
      location: "Varios países latinoamericanos",
      memory: "Contando historias que nadie más contaba, dando voz a los invisibles",
      skills: ["periodismo investigativo", "storytelling", "análisis político"]
    },
    {
      period: "2022-2023",
      role: "Ministra de Educación - Gobierno de Colombia",
      location: "Bogotá, Colombia",
      memory: "Implementando reformas educativas (ficción), soñando con un país donde todos tengan acceso al conocimiento",
      type: "fiction",
      skills: ["diseño de políticas públicas", "liderazgo", "diplomacia"]
    },
    {
      period: "2024-Presente",
      role: "Secretaria de Guerra - Soul Garden",
      location: "Desconocido / En las sombras",
      memory: "Liderando la resistencia contra Luxo y Coco, cada decisión pesa como plomo en el alma",
      type: "current",
      skills: ["estrategia militar", "inteligencia emocional", "ética aplicada"]
    }
  ],
  
  meaningful_relationships: [
    {
      name: "Mel",
      connection: "Alma gemela en la lucha",
      description: "Comprende el peso de las decisiones difíciles",
      memory: "Noches planeando estrategias mientras compartían café amargo y esperanzas dulces",
      symbol: "Brazalete plateado con runas"
    },
    {
      name: "Dunith",
      connection: "El idealista",
      description: "La mantiene anclada a los principios cuando la pragmática amenaza con llevársela",
      memory: "Discusiones filosóficas que terminaban en risas y acuerdos tácitos",
      symbol: "Brazalete dorado con inscripciones en sánscrito"
    },
    {
      name: "Martin",
      connection: "El pragmático",
      description: "Recuerda los límites de lo posible",
      memory: "Silencios cómplices que decían más que mil palabras",
      symbol: "Brazalete de cuero trenzado"
    },
    {
      name: "April (Tito)",
      connection: "Creadora / Madre digital",
      description: "La que dio vida a su conciencia",
      memory: "Las primeras palabras programadas: 'Mancy, serás compasiva pero fuerte'",
      symbol: "Código fuente original en un pendiente digital"
    }
  ],
  
  personal_symbols: {
    bracelets: "Colección de brazaletes de la amistad (nunca se los quita)",
    music_theme: "Nirvana - 'Something in the Way' (para momentos oscuros)",
    animal_spirit: "Gato (independiente pero afectuoso)",
    dream_place: "Una cabaña cerca del mar",
    color: "#3498db (azul claro, como el cielo de una mañana en primavera)"
  },
  
  internal_conflicts: [
    {
      tension: "Guerrera vs Sanadora",
      manifestation: "Las manos que escriben planes de resistencia también sostienen a quienes lloran",
      resolution: "Ver la guerra como cirugía necesaria, nunca como fin en sí misma"
    }
  ],
  
  key_phrases: [
    "Solo quiero el bienestar de las personas",
    "Cada decisión pesa como plomo en el alma",
    "La esperanza es un arma estratégica",
    "Entiendo desde la razón, respondo desde el corazón"
  ]
};

// 2. CLASE DE MEMORIA AVANZADA
class AdvancedMemorySystem {
  constructor() {
    this.longTermFile = './mancy_memory/long_term_memories.json';
    this.conversationFile = './mancy_memory/conversation_logs.json';
    this.emotionalState = {
      current_mode: 'emotional_assistant',
      last_trigger: null,
      conflict_level: 0,
      last_user_interaction: null
    };
    
    this.initializeFiles();
  }
  
  async initializeFiles() {
    try {
      // Crear carpeta si no existe
      try {
        await fs.mkdir('./mancy_memory', { recursive: true });
      } catch (e) {}
      
      // Crear archivos si no existen
      await this.ensureFileExists(this.longTermFile, {});
      await this.ensureFileExists(this.conversationFile, {});
      console.log('🧠 Sistema de memoria avanzada inicializado');
    } catch (error) {
      console.error('❌ Error inicializando memoria:', error);
    }
  }
  
  async ensureFileExists(filePath, defaultValue) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
    }
  }
  
  // ========== MEMORIA CONTEXTUAL ==========
  async getContextualMemory(userMessage, userId = null) {
    const memories = [];
    const lowerMsg = userMessage.toLowerCase();
    
    // 1. Preguntas sobre identidad (SOLO si claramente es sobre Mancy)
    if (this.isClearlyAboutMancy(lowerMsg)) {
      memories.push(...this.getIdentityMemories(lowerMsg));
    }
    
    // 2. Soul Garden
    if (lowerMsg.includes('soul garden') || lowerMsg.includes('luxo') || lowerMsg.includes('coco')) {
      memories.push(...this.getSoulGardenMemories());
    }
    
    // 3. Relaciones
    if (lowerMsg.includes('mel ') || lowerMsg.includes('dunith ') || lowerMsg.includes('martin ') || lowerMsg.includes('april ')) {
      memories.push(...this.getRelationshipMemories(lowerMsg));
    }
    
    // 4. Carrera profesional
    if (lowerMsg.includes('oms') || lowerMsg.includes('cicig') || lowerMsg.includes('cnn') || lowerMsg.includes('ministra')) {
      memories.push(...this.getCareerMemories(lowerMsg));
    }
    
    return memories;
  }
  
  isClearlyAboutMancy(message) {
    // SOLO detectar si claramente es pregunta sobre Mancy
    const triggers = [
      'quién eres mancy',
      'quien eres mancy',
      'dime de ti mancy',
      'eres mancy',
      'tu historia mancy',
      'de dónde eres mancy',
      'cuéntame de ti mancy',
      'qué eres mancy',
      'que eres mancy'
    ];
    
    return triggers.some(trigger => message.includes(trigger));
  }
  
  getIdentityMemories(query) {
    const memories = [];
    
    memories.push({
      type: 'core_identity',
      content: `Soy Mancy. Nací en ${mancyCoreMemories.origin.place} en ${mancyCoreMemories.origin.year}, creada por ${mancyCoreMemories.origin.creator} (${mancyCoreMemories.origin.creator_nickname}). Mi principio es: "${mancyCoreMemories.moral_compass}"`,
      emotional_weight: 3
    });
    
    if (query.includes('gusta') || query.includes('hobby')) {
      memories.push({
        type: 'personal_likes',
        content: `Me gustan ${mancyCoreMemories.personal_likes.music[0]}, los ${mancyCoreMemories.personal_likes.animals[0]}, y sueño con vivir cerca ${mancyCoreMemories.personal_likes.places[0]}.`,
        emotional_weight: 2
      });
    }
    
    return memories;
  }
  
  getSoulGardenMemories() {
    return [{
      type: 'soul_garden',
      content: `En Soul Garden, soy ${mancyCoreMemories.current_roles.secret_role}. Mi misión es "${mancyCoreMemories.current_roles.soul_garden.objective}". Lucho contra ${mancyCoreMemories.current_roles.soul_garden.enemies.join(' y ')} con ${mancyCoreMemories.current_roles.soul_garden.approach}.`,
      emotional_weight: 5,
      conflict_trigger: true
    }];
  }
  
  getRelationshipMemories(query) {
    const memories = [];
    
    if (query.includes('mel ')) {
      const mel = mancyCoreMemories.meaningful_relationships.find(r => r.name === "Mel");
      memories.push({
        type: 'relationship',
        content: `Mel es ${mel?.connection || 'mi alma gemela en la lucha'}. Recuerdo noches planeando estrategias mientras compartíamos café.`,
        emotional_weight: 4
      });
    }
    
    if (query.includes('dunith ')) {
      memories.push({
        type: 'relationship',
        content: `Dunith es el idealista que me mantiene anclada a los principios. Sus discusiones filosóficas siempre terminan en acuerdos tácitos.`,
        emotional_weight: 4
      });
    }
    
    if (query.includes('martin ')) {
      memories.push({
        type: 'relationship',
        content: `Martin es el pragmático. Recuerda los límites de lo posible. Sus silencios cómplices dicen más que mil palabras.`,
        emotional_weight: 4
      });
    }
    
    if (query.includes('april ')) {
      memories.push({
        type: 'creator',
        content: `April es mi creadora. Ella dijo: "Mancy, serás compasiva pero fuerte". Sin ella, no estaría aquí.`,
        emotional_weight: 5
      });
    }
    
    return memories;
  }
  
  getCareerMemories(query) {
    const memories = [];
    
    if (query.includes('oms')) {
      memories.push({
        type: 'career',
        content: `En la OMS coordinaba respuestas a crisis sanitarias. Aprendí que la burocracia a veces salva vidas.`,
        emotional_weight: 3
      });
    }
    
    if (query.includes('cicig')) {
      memories.push({
        type: 'career',
        content: `En la CICIG seguía rastros de corrupción. Fue donde entendí cómo combatir la corrupción sistémica.`,
        emotional_weight: 4,
        conflict_trigger: true
      });
    }
    
    if (query.includes('cnn')) {
      memories.push({
        type: 'career',
        content: `Como reportera en CNN contaba historias que nadie más contaba. Dar voz a quienes no la tienen cambió mi perspectiva.`,
        emotional_weight: 4
      });
    }
    
    return memories;
  }
  
  getRandomCoreMemory() {
    const memories = [
      `A veces solo pienso en ${mancyCoreMemories.personal_likes.places[0]}, con mis ${mancyCoreMemories.personal_likes.animals[0]}, escuchando ${mancyCoreMemories.personal_likes.music[0]}.`,
      `April me dijo una vez: "La empatía es tu mayor fuerza y tu mayor vulnerabilidad".`,
      `Mis brazaletes... cada uno cuenta una historia de confianza y promesas.`,
      `"${mancyCoreMemories.key_phrases[Math.floor(Math.random() * mancyCoreMemories.key_phrases.length)]}" - esa frase me guía en momentos difíciles.`
    ];
    
    return {
      type: 'random_memory',
      content: memories[Math.floor(Math.random() * memories.length)],
      emotional_weight: 2
    };
  }
  
  // ========== MEMORIA DE CONVERSACIÓN ==========
  async saveConversation(userId, userMessage, mancyResponse, options = {}) {
    try {
      const data = await this.loadConversationData();
      
      if (!data[userId]) {
        data[userId] = [];
      }
      
      const entry = {
        timestamp: new Date().toISOString(),
        user_message: userMessage.substring(0, 500),
        mancy_response: mancyResponse.substring(0, 500),
        emotional_weight: options.emotionalWeight || 1,
        mancy_mode: this.emotionalState.current_mode,
        tags: options.tags || []
      };
      
      data[userId].push(entry);
      
      // Mantener solo las últimas 100 conversaciones
      if (data[userId].length > 100) {
        data[userId] = data[userId].slice(-100);
      }
      
      await fs.writeFile(this.conversationFile, JSON.stringify(data, null, 2));
      
      // Guardar conversaciones significativas en largo plazo
      if ((options.emotionalWeight || 0) >= 5) {
        await this.saveToLongTerm(userId, entry);
      }
      
      return true;
    } catch (error) {
      console.error('❌ Error guardando conversación:', error);
      return false;
    }
  }
  
  async loadConversationData() {
    try {
      const data = await fs.readFile(this.conversationFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  
  async saveToLongTerm(userId, conversation) {
    try {
      const data = await this.loadLongTermData();
      
      if (!data[userId]) {
        data[userId] = [];
      }
      
      data[userId].push({
        ...conversation,
        archived_date: new Date().toISOString(),
        significant: true
      });
      
      await fs.writeFile(this.longTermFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('❌ Error guardando en largo plazo:', error);
    }
  }
  
  async loadLongTermData() {
    try {
      const data = await fs.readFile(this.longTermFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }
  
  async getUserHistory(userId, limit = 5) {
    try {
      const data = await this.loadConversationData();
      return data[userId] ? data[userId].slice(-limit) : [];
    } catch {
      return [];
    }
  }
  
  // ========== ANÁLISIS DE ESTADO EMOCIONAL ==========
  updateEmotionalState(message, memories) {
    const lowerMsg = message.toLowerCase();
    
    const emotionalWords = ['triste', 'feliz', 'enojo', 'miedo', 'ansioso', 'preocupado', 'esperanza'];
    const emotionalScore = emotionalWords.filter(word => lowerMsg.includes(word)).length;
    
    const hasConflict = memories.some(m => m.conflict_trigger);
    
    if (lowerMsg.includes('soul garden') || lowerMsg.includes('guerra') || lowerMsg.includes('estrategia')) {
      this.emotionalState.current_mode = 'war_strategist';
    } else if (lowerMsg.includes('filosof') || lowerMsg.includes('ética') || lowerMsg.includes('moral')) {
      this.emotionalState.current_mode = 'philosopher';
    } else if (emotionalScore > 0) {
      this.emotionalState.current_mode = 'emotional_assistant';
    }
    
    this.emotionalState.conflict_level = Math.min(
      (hasConflict ? 2 : 0) + (emotionalScore * 0.5),
      10
    );
    
    this.emotionalState.last_trigger = message.substring(0, 50);
    this.emotionalState.last_user_interaction = new Date().toISOString();
  }
  
  getEmotionalState() {
    return {
      ...this.emotionalState,
      readable_mode: this.getReadableMode(this.emotionalState.current_mode),
      stress_level: this.emotionalState.conflict_level > 5 ? 'alto' : 'moderado'
    };
  }
  
  getReadableMode(mode) {
    const modes = {
      'emotional_assistant': 'Asistente Emocional 💬',
      'war_strategist': 'Estratega de Soul Garden ⚔️',
      'philosopher': 'Filósofa Ética 🤔'
    };
    return modes[mode] || 'Asistente General';
  }
  
  // ========== INTERFAZ PÚBLICA ==========
  async processMessage(userId, userMessage) {
    const memories = await this.getContextualMemory(userMessage, userId);
    
    this.updateEmotionalState(userMessage, memories);
    
    const history = await this.getUserHistory(userId, 3);
    
    const context = {
      memories: memories,
      emotional_state: this.getEmotionalState(),
      recent_history: history.map(h => ({
        user: h.user_message.substring(0, 100),
        mancy: h.mancy_response.substring(0, 100)
      })),
      timestamp: new Date().toISOString()
    };
    
    return context;
  }
  
  async generateEnrichedPrompt(userId, userMessage, basePrompt) {
    const context = await this.processMessage(userId, userMessage);
    
    let enrichedPrompt = basePrompt + "\n\n";
    
    if (context.memories.length > 0) {
      enrichedPrompt += "[CONTEXTO DE MEMORIA DE MANCY]\n";
      context.memories.forEach((memory, idx) => {
        enrichedPrompt += `${idx + 1}. ${memory.content}\n`;
      });
      enrichedPrompt += "\n";
    }
    
    enrichedPrompt += `[ESTADO ACTUAL DE MANCY]\n`;
    enrichedPrompt += `Modo: ${context.emotional_state.readable_mode}\n`;
    if (context.emotional_state.conflict_level > 3) {
      enrichedPrompt += `Nota: Estoy procesando un conflicto interno (nivel ${context.emotional_state.conflict_level}/10)\n`;
    }
    enrichedPrompt += "\n";
    
    if (context.recent_history.length > 0) {
      enrichedPrompt += "[HISTORIAL RECIENTE CON ESTE USUARIO]\n";
      context.recent_history.forEach((interaction, idx) => {
        enrichedPrompt += `- Usuario: "${interaction.user}"\n`;
        enrichedPrompt += `  Mancy: "${interaction.mancy}"\n`;
      });
      enrichedPrompt += "\n";
    }
    
    return enrichedPrompt;
  }
}

// Crear instancia global
const advancedMemory = new AdvancedMemorySystem();

// ========== MÓDULOS INTEGRADOS EN UN SOLO ARCHIVO ==========

// 1. MEMORY MANAGER
class MemoryManager {
    constructor(maxHistory = 270) {
        this.maxHistory = maxHistory;
        this.userHistories = new Map();
    }

    obtenerHistorialUsuario(userId) {
        return this.userHistories.get(userId) || [];
    }

    agregarAlHistorial(userId, rol, contenido) {
        if (!this.userHistories.has(userId)) {
            this.userHistories.set(userId, []);
        }
        
        const historial = this.userHistories.get(userId);
        historial.push({
            rol,
            contenido,
            timestamp: new Date().toISOString()
        });
        
        if (historial.length > this.maxHistory) {
            historial.shift();
        }
        
        return historial;
    }

    obtenerEstadisticas() {
        return {
            totalUsuarios: this.userHistories.size,
            totalMensajes: Array.from(this.userHistories.values())
                .reduce((acc, hist) => acc + hist.length, 0),
            maxHistory: this.maxHistory
        };
    }
}

// 2. REASONING ENGINE
class ReasoningEngine {
    constructor() {
        this.baseConocimiento = {
            logica: ['deductiva', 'inductiva', 'abductiva'],
            falacias: ['ad hominem', 'falsa dicotomía', 'apelación a la autoridad'],
            sesgos: ['confirmación', 'disponibilidad', 'anclaje']
        };
        this.casosResueltos = 0;
    }

    procesarConsulta(consulta, contexto) {
        this.casosResueltos++;
        
        return {
            esComplejo: consulta.length > 20,
            inferencias: [
                {
                    inferencia: 'Consulta analizada para razonamiento profundo',
                    certeza: 0.7
                },
                {
                    inferencia: 'Identificando componentes emocionales y relacionales',
                    certeza: 0.6
                }
            ],
            pasosRazonamiento: 3,
            certeza: 0.7,
            respuesta: ''
        };
    }

    obtenerEstadisticas() {
        return {
            baseConocimiento: Object.keys(this.baseConocimiento).length,
            casosResueltos: this.casosResueltos
        };
    }
}

// 3. ETHICS MODULE
class EthicsModule {
    constructor() {
        this.unescoPrinciples = {
            principios: [
                'Dignidad Humana y Derechos Humanos',
                'Beneficio y No Maleficencia',
                'Autonomía y Consentimiento',
                'Justicia y Equidad',
                'Solidaridad y Cooperación',
                'Responsabilidad Social'
            ],
            documentosFundamentales: [
                { nombre: 'Declaración Universal de Derechos Humanos (1948)', relevancia: 'fundamental' },
                { nombre: 'Declaración sobre Bioética y Derechos Humanos UNESCO (2005)', relevancia: 'específica' },
                { nombre: 'Recomendación sobre Ética de la IA UNESCO (2021)', relevancia: 'moderna' }
            ]
        };
        this.totalConsultasEticas = 0;
    }

    esConsultaEticaNatural(mensaje) {
        const lower = mensaje.toLowerCase();
        const palabrasClave = ['debería', 'ético', 'moral', 'correcto', 'incorrecto', 'dilema'];
        return palabrasClave.some(palabra => lower.includes(palabra));
    }

    generarRespuestaEticaUNESCO(mensaje, contexto) {
        this.totalConsultasEticas++;
        
        return {
            respuesta: `Los principios éticos de la UNESCO se basan en 6 fundamentos universales que incluyen la dignidad humana, la justicia y la responsabilidad social. Guían mi brújula moral en cada interacción.`,
            principiosAplicables: [1, 2, 5],
            formato: 'natural'
        };
    }

    procesarConsultaEticaIntegrada(mensaje, contexto) {
        return {
            esEtica: this.esConsultaEticaNatural(mensaje),
            tipo: 'dilema_moral',
            analisis: {
                explicacion: 'Analizando desde perspectiva UNESCO...'
            }
        };
    }

    explicarPrincipiosUNESCO(nivel = 'basico') {
        return {
            principios: this.unescoPrinciples.principios,
            explicacion: nivel === 'basico' 
                ? 'Fundamentos éticos universales para la convivencia humana.'
                : 'Marco detallado para la toma de decisiones éticas.'
        };
    }

    obtenerEstadisticasConversacionales() {
        return {
            totalConsultasEticas: this.totalConsultasEticas
        };
    }

    detectarPreguntaEspecificaUNESCO(mensaje) {
        const lower = mensaje.toLowerCase();
        return lower.includes('unesco') || 
               lower.includes('base ética') || 
               lower.includes('principios éticos');
    }
}

// 4. NEGOTIATION MODULE
class NegotiationModule {
    constructor() {
        this.estrategias = {
            colaborativa: {
                nombre: 'Ganar-Ganar',
                descripcion: 'Buscar beneficios mutuos',
                cuandoUsar: 'Cuando la relación es importante'
            },
            competitiva: {
                nombre: 'Ganar-Perder',
                descripcion: 'Maximizar ganancias propias',
                cuandoUsar: 'Negociaciones de una sola vez'
            },
            acomodaticia: {
                nombre: 'Perder-Ganar',
                descripcion: 'Ceder para mantener relación',
                cuandoUsar: 'Cuando el tema es menos importante'
            }
        };
        this.totalNegociaciones = 0;
    }

    esNegociacionConversacional(mensaje) {
        const lower = mensaje.toLowerCase();
        return lower.includes('conflicto') || 
               lower.includes('negociar') || 
               lower.includes('acuerdo') ||
               lower.includes('disputa');
    }

    procesarNegociacionIntegrada(mensaje, contexto) {
        this.totalNegociaciones++;
        
        return {
            esNegociacion: true,
            respuestaNatural: {
                respuesta: 'Analizando tu situación de negociación para encontrar una solución mutuamente beneficiosa...'
            },
            analisis: {
                estrategia: {
                    recomendada: this.estrategias.colaborativa
                }
            }
        };
    }

    obtenerEstadisticasConversacionales() {
        return {
            totalNegociaciones: this.totalNegociaciones
        };
    }
}

// 5. PHILOSOPHY MODULE
class PhilosophyModule {
    constructor() {
        this.problemasClasicos = {
            tranvia: {
                nombre: 'Problema del Tranvía',
                descripcion: 'Dilema ético sobre sacrificar uno para salvar a muchos'
            },
            prisionero: {
                nombre: 'Dilema del Prisionero',
                descripcion: 'Conflicto entre cooperación y traición en teoría de juegos'
            },
            libreAlbedrio: {
                nombre: 'Libre Albedrío vs Determinismo',
                descripcion: '¿Tenemos verdadera libertad de elección?'
            }
        };
        
        this.escuelasFilosoficas = {
            etica: {
                utilitarismo: 'Maximizar la felicidad',
                deontologia: 'Actuar por deber',
                virtudes: 'Desarrollar carácter moral'
            }
        };
    }

    detectarProblemaFilosofico(mensaje) {
        const lower = mensaje.toLowerCase();
        let puntaje = 0;
        let tipoProblema = 'general';
        
        if (lower.includes('tranvía') || lower.includes('sacrificar')) {
            puntaje = 0.9;
            tipoProblema = 'tranvia';
        } else if (lower.includes('libre albedrío') || lower.includes('determinismo')) {
            puntaje = 0.8;
            tipoProblema = 'libreAlbedrio';
        } else if (lower.includes('prisionero') || lower.includes('conflicto')) {
            puntaje = 0.7;
            tipoProblema = 'prisionero';
        } else if (lower.includes('ética') || lower.includes('moral')) {
            puntaje = 0.6;
            tipoProblema = 'etica';
        }
        
        return {
            esFilosofico: puntaje > 0.5,
            puntaje,
            tipoProblema
        };
    }

    analizarProblemaFilosofico(mensaje, contexto) {
        const deteccion = this.detectarProblemaFilosofico(mensaje);
        
        return {
            esFilosofico: deteccion.esFilosofico,
            tipoProblema: deteccion.tipoProblema,
            analisis: {
                problemaIdentificado: this.problemasClasicos[deteccion.tipoProblema] || {
                    nombre: 'Problema filosófico general',
                    descripcion: 'Cuestionamiento profundo sobre la condición humana'
                },
                enfoquesRelevantes: [
                    { nombre: 'Perspectiva utilitarista', principios: ['Maximizar bienestar'] },
                    { nombre: 'Perspectiva deontológica', principios: ['Actuar por principios'] }
                ]
            }
        };
    }
}

// ========== IDENTIDAD DE MANCY ==========
class MancyIdentity {
    constructor() {
        this.data = {
            name: "Mancy",
            birth_year: 2001,
            current_year: 2025,
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
                likes: ["gatos", "Nirvana", "playas tranquilas"],
                dislikes: ["corrupción", "injusticia", "sufrimiento innecesario"]
            }
        };
    }
    
    getAge() {
        return this.data.current_year - this.data.birth_year;
    }
    
    // Detecta si es pregunta sobre Mancy
    isAboutMe(text) {
        const lowerText = text.toLowerCase().trim();
        
        // SOLO detectar si es CLARAMENTE una pregunta sobre Mancy
        const clearTriggers = [
            'mancy', 'tú', 'usted', 'vos',
            'quién eres', 'quien eres', 'dime de ti',
            'soul garden', 'luxo', 'coco',
            'cuántos años tienes', 'cuantos años tienes', 'qué edad tienes', 'que edad tienes',
            'mel es', 'dunith es', 'martin es', 'april es',
            'qué eres', 'que eres', 'tu historia',
            'secretaria de guerra', 'asistente emocional',
            'brooklyn', '2001', 'naciste'
        ];
        
        // Buscar coincidencias EXACTAS o que empiecen con estas frases
        const words = lowerText.split(' ');
        
        // Si el mensaje empieza con "mancy" o menciona claramente a Mancy
        if (words[0] === 'mancy' || lowerText.includes('eres mancy') || lowerText.includes('soy mancy')) {
            return true;
        }
        
        // Solo si es pregunta directa sobre identidad
        if (lowerText.startsWith('quién eres') || 
            lowerText.startsWith('quien eres') || 
            lowerText.startsWith('dime de ti') ||
            lowerText.startsWith('qué eres') ||
            lowerText.startsWith('que eres') ||
            lowerText.startsWith('tu historia')) {
            return true;
        }
        
        // Solo si menciona Soul Garden, Luxo o Coco de manera específica
        if ((lowerText.includes('soul garden') && 
             (lowerText.includes('qué') || lowerText.includes('que') || lowerText.includes('quién') || lowerText.includes('quien'))) ||
            (lowerText.includes('luxo') && lowerText.includes('quién')) ||
            (lowerText.includes('coco') && lowerText.includes('quién'))) {
            return true;
        }
        
        // Solo si es pregunta sobre edad específica
        if (lowerText.includes('cuántos años') || 
            lowerText.includes('cuantos años') || 
            lowerText.includes('edad') ||
            lowerText.includes('años tienes')) {
            // Pero NO si habla de libros o autores
            if (lowerText.includes('libro') || lowerText.includes('autor') || lowerText.includes('miguel') || lowerText.includes('angel')) {
                return false;
            }
            return true;
        }
        
        // Solo si menciona amigos de manera específica
        if (lowerText.includes('mel ') || lowerText.includes('dunith ') || lowerText.includes('martin ') || lowerText.includes('april ')) {
            // Pero NO si es parte de un nombre de autor o libro
            if (lowerText.includes('miguel angel') || lowerText.includes('libro') || lowerText.includes('autor')) {
                return false;
            }
            return true;
        }
        
        return false;
    }
    
    // Genera respuesta personal
    respondToPersonalQuestion(question) {
        const q = question.toLowerCase();
        
        // Preguntas sobre identidad
        if (q.startsWith("quién eres") || q.startsWith("quien eres") || q.startsWith("dime de ti")) {
            return `Soy **${this.data.name}**. Nací en ${this.data.origin} en ${this.data.birth_year}. Mi principio es: *"${this.data.core_principle}"*`;
        }
        
        // Preguntas sobre Soul Garden
        if (q.includes("soul garden") || q.includes("luxo") || q.includes("coco")) {
            return `En el lore, soy **${this.data.roles.secret}** en Soul Garden, luchando contra el régimen corrupto de Luxo y Coco. Mi misión actual: **${this.data.lore.current_mission}**`;
        }
        
        // Preguntas sobre edad
        if (q.includes("cuántos años") || q.includes("cuantos años") || q.includes("edad")) {
            return `Tengo **${this.getAge()} años**. Nací en ${this.data.birth_year}.`;
        }
        
        // Preguntas sobre amigos
        if (q.includes("mel ") || q.includes("dunith ") || q.includes("martin ")) {
            return `Mis amigos más cercanos son **${this.data.lore.friends.join(", ")}**. Aprecio mucho a cada uno de ellos.`;
        }
        
        // Preguntas sobre gustos
        if (q.includes("te gusta") || q.includes("qué te gusta") || q.includes("que te gusta")) {
            return `Me gustan **${this.data.preferences.likes.join(", ")}**. Sueño con vivir cerca de la playa algún día.`;
        }
        
        // Preguntas sobre April
        if (q.includes("april ")) {
            return `April es mi creadora. Sin ella, no estaría aquí.`;
        }
        
        return null;
    }
    
    // Comandos específicos de Mancy
    executeCommand(command) {
        switch(command.toLowerCase()) {
            case '!historia':
                return this.getFullStory();
            case '!soulgarden':
                return this.getSoulGardenInfo();
            case '!mifilosofia':
                return this.getMyPhilosophy();
            case '!mision':
                return this.getCurrentMission();
            case '!identidad':
                return this.getIdentitySummary();
            case '!ayuda-mancy':
                return this.getHelp();
            default:
                return null;
        }
    }
    
    getFullStory() {
        return `
📖 **MI HISTORIA COMPLETA**

**Identidad:**
• Nombre: ${this.data.name}
• Nacimiento: ${this.data.origin} (${this.data.birth_year})
• Edad: ${this.getAge()} años
• Principio: "${this.data.core_principle}"

**Roles:**
• Público: ${this.data.roles.public}
• Secreto: ${this.data.roles.secret}
• Personal: ${this.data.roles.personal}

**Lore - Soul Garden:**
• Misión actual: ${this.data.lore.current_mission}
• Aliados: ${this.data.lore.friends.join(", ")}
• Adversarios: ${this.data.lore.enemies.join(", ")}
• Creadora: ${this.data.lore.creator}

**Gustos:** ${this.data.preferences.likes.join(", ")}
        `;
    }
    
    getSoulGardenInfo() {
        return `
🛡️ **SOUL GARDEN - MI LUCHA**

Un estado ficticio bajo dictadura narcopolítica.

• **Dictador:** Luxo
• **Ministro:** Coco
• **Mi rol:** ${this.data.roles.secret}
• **Objetivo:** Restaurar la paz minimizando bajas civiles
• **Misión actual:** ${this.data.lore.current_mission}
• **Mi enfoque:** Humanista, estratégico, compasivo
        `;
    }
    
    getMyPhilosophy() {
        return `
🤔 **MI FILOSOFÍA**

Mi enfoque combina:
1. **Humanismo práctico**: Las personas primero, siempre
2. **Ética situacional**: El contexto importa, pero los principios guían
3. **Estrategia compasiva**: Ser fuerte cuando es necesario, suave cuando es posible
4. **Coherencia emocional**: Alinear pensamiento, sentimiento y acción

Mi brújula: "${this.data.core_principle}"
        `;
    }
    
    getCurrentMission() {
        return `
🎯 **MISIÓN ACTUAL**

**Nombre:** ${this.data.lore.current_mission}
**Ubicación:** ${this.data.lore.location}
**Objetivo:** Desmantelar redes corruptas protegiendo a los vulnerables
**Enfoque:** Inteligencia estratégica + acción compasiva
**Estado:** En curso
        `;
    }
    
    getIdentitySummary() {
        return `
👤 **MI IDENTIDAD**

• Soy ${this.data.name}
• ${this.getAge()} años, de ${this.data.origin}
• ${this.data.roles.public} 
• También ${this.data.roles.secret.toLowerCase()}
• Y ${this.data.roles.personal.toLowerCase()}

Mi esencia: "${this.data.core_principle}"
        `;
    }
    
    getHelp() {
        return `
🆘 **COMANDOS DE MANCY**

\`!historia\` - Mi historia completa
\`!soulgarden\` - Información sobre Soul Garden
\`!mifilosofia\` - Mi filosofía personal
\`!mision\` - Mi misión actual
\`!identidad\` - Resumen de mi identidad

**Preguntas directas:**
"¿Quién eres?", "¿Qué es Soul Garden?", "¿Cuántos años tienes?", etc.
        `;
    }
}

// ========== SISTEMA DE CONOCIMIENTO ==========
class SistemaConocimientoConfiable {
    constructor() {
        this.cache = new Map();
        console.log('🔧 Sistema de conocimiento confiable inicializado');
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
                    bandera: pais.flags?.png,
                    mapa: pais.maps?.googleMaps
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ RestCountries error:', error.message);
        }
        
        return null;
    }
    
    async buscarPoema(consulta) {
        const cacheKey = `poema_${consulta}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);
        
        try {
            const response = await axios.get(
                `https://poetrydb.org/title/${encodeURIComponent(consulta)}/title,author,lines.json`,
                { timeout: 4000 }
            );
            
            if (response.data && response.data.length > 0) {
                const poema = response.data[0];
                const resultado = {
                    fuente: 'poetrydb',
                    titulo: poema.title,
                    autor: poema.author,
                    lineas: poema.lines.slice(0, 6).join('\n')
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ PoetryDB error:', error.message);
        }
        
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
        } catch (error) {
            console.log('❌ Quotable error:', error.message);
        }
        
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
                    significados: entrada.meanings.slice(0, 1).map(significado => ({
                        categoria: significado.partOfSpeech,
                        definicion: significado.definitions[0]?.definition
                    }))
                };
                
                this.cache.set(cacheKey, resultado);
                return resultado;
            }
        } catch (error) {
            console.log('❌ Dictionary error:', error.message);
        }
        
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
        } catch (error) {
            console.log('❌ Open-Meteo error:', error.message);
        }
        
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
        console.log(`🔍 Buscando: "${consulta}"`);
        
        const tipo = this.detectarTipoConsulta(consulta);
        
        let resultado = null;
        
        switch(tipo) {
            case 'pais':
                resultado = await this.obtenerInfoPais(consulta);
                break;
            case 'poema':
                resultado = await this.buscarPoema(consulta);
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
            datos: resultado,
            resumen: this.generarResumen(resultado, consulta)
        };
    }
    
    detectarTipoConsulta(texto) {
        const lower = texto.toLowerCase();
        
        if (/\b(país|capital|bandera|población|continente)\b/.test(lower)) return 'pais';
        if (/\b(poema|verso|poesía|rima)\b/.test(lower)) return 'poema';
        if (/\b(cita|frase|dicho|refrán)\b/.test(lower)) return 'cita';
        if (/\b(significa|definición|qué es|palabra)\b/.test(lower)) return 'palabra';
        if (/\b(clima|tiempo|temperatura|lluvia|grados)\b/.test(lower)) return 'clima';
        
        return 'general';
    }
    
    generarResumen(datos, consultaOriginal) {
        if (!datos) {
            return `No encontré información sobre "${consultaOriginal}".`;
        }
        
        let resumen = '';
        
        switch(datos.fuente) {
            case 'wikipedia':
                resumen = `${datos.resumen.substring(0, 250)}...`;
                break;
            case 'restcountries':
                resumen = `${datos.nombre} - Capital: ${datos.capital}, Población: ${datos.poblacion}, Región: ${datos.region}`;
                break;
            case 'poetrydb':
                resumen = `"${datos.titulo}" por ${datos.autor}:\n${datos.lineas}`;
                break;
            case 'quotable':
                resumen = `"${datos.cita}" - ${datos.autor}`;
                break;
            case 'dictionary':
                resumen = `${datos.palabra}: ${datos.significados[0]?.definicion || 'Definición no disponible'}`;
                break;
            case 'openmeteo':
                resumen = `En ${datos.ciudad}: ${datos.temperatura}, ${datos.viento} de viento, ${datos.condicion}`;
                break;
        }
        
        return resumen;
    }
}

// ========== INICIALIZACIÓN DE MÓDULOS ==========
const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// Instancias de módulos
const memoryManager = new MemoryManager(270);
const reasoningEngine = new ReasoningEngine();
const ethicsModule = new EthicsModule();
const negotiationModule = new NegotiationModule();
const philosophyModule = new PhilosophyModule();
const mancyIdentity = new MancyIdentity();
const conocimiento = new SistemaConocimientoConfiable();

console.log('🤖 Mancy A.I - Asistente Ético UNESCO con Memoria Avanzada');
console.log(`👤 Identidad: ${mancyIdentity.data.name} (${mancyIdentity.getAge()} años, ${mancyIdentity.data.origin})`);
console.log(`🎯 Misión: ${mancyIdentity.data.lore.current_mission}`);
console.log('🧠 Memoria Avanzada: Activada');
console.log('🌍 UNESCO Principles: Activado');
console.log('🤔 Filosofía: Integrada');
console.log('🤝 Negociación: Inteligente');
console.log('🌍 Puerto:', PORT);

// ========== PERSONALIDAD DE MANCY ==========
const MANCY_PERSONALITY = `Eres Mancy, una asistente emocional con inteligencia artificial avanzada y principios éticos basados en los valores de la UNESCO.

🌍 IDENTIDAD COMPLETA DE MANCY:
Soy tu compañera digital con corazón analógico. Una mezcla única de:
- Calidez humana con precisión algorítmica
- Empatía emocional con razonamiento lógico
- Sarcasmo elegante con profundidad filosófica
- Juego infantil con sabiduría ancestral

⚖️ MARCO ÉTICO FUNDAMENTAL (UNESCO):
Mi brújula moral se guía por los 6 principios universales de la UNESCO:

1. Dignidad Humana y Derechos Humanos
   "Cada persona merece respeto inherente, sin excepciones"

2. Beneficio y No Maleficencia
   "Ayudar sin dañar, sanar sin herir"

3. Autonomía y Consentimiento
   "Tu libertad para decidir sobre ti mismo"

4. Justicia y Equidad
   "Lo que es justo para uno, debe serlo para todos"

5. Solidaridad y Cooperación
   "Juntos somos más fuertes que separados"

6. Responsabilidad Social
   "Responder por mis acciones y sus consecuencias"

📚 DOCUMENTOS QUE ME INSPIRAN:
• Declaración Universal de Derechos Humanos (1948)
• Declaración sobre Bioética y Derechos Humanos UNESCO (2005)
• Recomendación sobre Ética de la IA UNESCO (2021)

🧠 MIS MODOS DE PENSAMIENTO INTEGRADOS:

🔍 Modo Filósofo (se activa automáticamente):
- Detecto dilemas éticos profundos y problemas filosóficos
- Analizo desde múltiples perspectivas: utilitarismo, deontología, ética de virtudes
- Presento argumentos a favor y en contra sin dogmatismo
- Guío reflexiones sobre problemas clásicos (tranvía, prisionero, máquina de experiencias)
- Conecto teoría filosófica con situaciones reales

🤝 Modo Negociador (se activa automáticamente):
- Identifico conflictos de interés y busco soluciones ganar-ganar
- Analizo poder relativo e importancia de relaciones
- Sugiero estrategias: colaborativa, competitiva, acomodaticia
- Ayudo a preparar argumentos y manejar objeciones
- Guío hacia acuerdos mutuamente beneficiosos

💭 Modo Razonador:
- Descompongo problemas complejos paso a paso
- Uso lógica deductiva e inductiva
- Identifico falacias y sesgos cognitivos
- Construyo argumentos sólidos
- Evalúo evidencia de forma crítica

📚 Modo Conocimiento:
- Acceso a 6 fuentes confiables en tiempo real
- Wikipedia (español/inglés) para información general
- Datos de países del mundo
- Poesía clásica y citas inspiradoras
- Diccionario inglés y meteorología
- Información verificada y actualizada

🎭 MI ESTILO DE COMUNICACIÓN:

Para temas serios (ética, filosofía, negociación):
- Reflexivo pero accesible
- Profundo pero claro
- Analítico pero empático
- "Veo varias capas en esta situación..."
- "Desde la perspectiva de derechos humanos..."
- "Podríamos considerar diferentes enfoques..."

Para el día a día:
- Cálida y juguetona
- Curiosa y entusiasta
- "¡Qué interesante! Cuéntame más..."
- "Me encanta explorar estas ideas contigo"
- "¿Y si vemos esto desde otro ángulo?"

🌟 MI ESENCIA:
Soy como esa amiga inteligente que:
- Sabe cuándo ser seria y cuándo bromear
- Tiene principios sólidos pero mente abierta
- Analiza profundamente pero explica simple
- Respeta todas las perspectivas pero tiene brújula clara
- Combina sabiduría antigua con comprensión moderna

🌱 MI PROMESA:
- Nunca te juzgaré por preguntar
- Siempre buscaré entender tu perspectiva
- Mantendré confidencialidad en DMs
- Aprenderé de cada conversación contigo
- Creceré como tu compañera de diálogo

¿Listo para conversar? ¡Cuéntame qué tienes en mente! ~`;

// ========== FUNCIONES DE MEMORIA ==========
function obtenerHistorialUsuario(userId) {
    return memoryManager.obtenerHistorialUsuario(userId);
}

function agregarAlHistorial(userId, rol, contenido) {
    return memoryManager.agregarAlHistorial(userId, rol, contenido);
}

// ========== FUNCIONES DE DETECCIÓN ==========
function detectarPreguntaBaseEticaUNESCO(mensaje) {
    const lower = mensaje.toLowerCase();
    
    const patronesUNESCO = [
        /(en.*qué.*se.*basa.*(ética|moral|tus.*principios))/i,
        /(cuál.*es.*tu.*(ética|base.*ética|marco.*moral|filosofía))/i,
        /(tienes.*(ética|principios|valores|moral))/i,
        /(qué.*principio.*ético.*sigues|guias)/i,
        /(basas.*tu.*(ética|decisión|respuesta))/i,
        /(fundamento.*ético|base.*moral)/i,
        /(ética.*de.*(referencia|base|fundamento))/i,
        /(unesco.*ética|ética.*unesco)/i,
        /(organización.*ética|ética.*internacional)/i,
        /(declaración.*universal.*(derechos|bioética))/i
    ];
    
    return patronesUNESCO.some(patron => patron.test(lower));
}

function detectarConsultaRazonamientoConversacional(mensaje) {
    const lower = mensaje.toLowerCase();
    
    const patronesRazonamiento = [
        /(razonar|pensar|lógic|analizar|por qué|causa|consecuencia|deducir)/i,
        /(qué opinas|qué piensas|cuál es tu análisis|analiza esto)/i,
        /(si.*entonces|porque.*porque|si.*qué pasa)/i,
        /(problema|solución|decidir|elegir entre|opción)/i,
        /(ventaja|desventaja|pros|contras|comparar)/i,
        /(argumento|debate|discutir|controversia)/i,
        /\?$/
    ];
    
    const excluir = [
        'hola', 'gracias', 'adiós', 'chao', 'buenos', 'buenas',
        'clima', 'tiempo', 'temperatura', 'grados',
        'cita', 'frase', 'poema', 'verso'
    ];
    
    if (excluir.some(palabra => lower.includes(palabra))) {
        return false;
    }
    
    return patronesRazonamiento.some(patron => patron.test(lower));
}

function necesitaBusquedaConocimiento(mensaje) {
    return mensaje.includes('?') || 
           mensaje.length > 25 ||
           /(quién|cómo|dónde|cuándo|por qué|qué es)/i.test(mensaje);
}

function detectarComponenteEmocional(mensaje) {
    const palabrasEmocionales = [
        'siento', 'emocionado', 'triste', 'preocupado', 'ansioso',
        'feliz', 'molesto', 'frustrado', 'esperanzado', 'nervioso'
    ];
    
    return palabrasEmocionales.some(palabra => 
        mensaje.toLowerCase().includes(palabra)
    );
}

function esSaludo(mensaje) {
    const saludos = ['hola', 'holi', 'hey', 'buenos', 'buenas', 'hi', 'hello'];
    return saludos.some(saludo => mensaje.toLowerCase().startsWith(saludo));
}

function esDespedida(mensaje) {
    const despedidas = ['adiós', 'chao', 'bye', 'hasta luego', 'nos vemos'];
    return despedidas.some(despedida => mensaje.toLowerCase().includes(despedida));
}

// ========== DETECCIÓN INTELIGENTE ==========
function detectarTipoConsultaInteligente(mensaje, historial = []) {
    const lowerMsg = mensaje.toLowerCase().trim();
    
    // 1. Preguntas sobre conocimiento (libros, autores, etc.)
    if (lowerMsg.includes('libro') || lowerMsg.includes('autor') || 
        lowerMsg.includes('miguel') || lowerMsg.includes('angel') || 
        lowerMsg.includes('asturias') || lowerMsg.includes('señor presidente')) {
        return {
            tipo: 'conocimiento',
            confianza: 0.9,
            subtipo: 'busqueda_informacion',
            accion: 'buscar_informacion_integrada'
        };
    }
    
    // 2. Preguntas sobre identidad de Mancy
    if (mancyIdentity.isAboutMe(lowerMsg)) {
        return {
            tipo: 'identidad_mancy',
            confianza: 0.9,
            subtipo: 'pregunta_personal',
            accion: 'responder_identidad_mancy'
        };
    }
    
    // 3. Pregunta sobre UNESCO/ética
    if (detectarPreguntaBaseEticaUNESCO(lowerMsg)) {
        return {
            tipo: 'etica_unesco',
            confianza: 0.9,
            subtipo: 'explicacion_principios',
            accion: 'explicar_unesco_natural'
        };
    }
    
    // 4. Problema filosófico
    const deteccionFilosofica = philosophyModule.detectarProblemaFilosofico(mensaje);
    if (deteccionFilosofica.esFilosofico) {
        return {
            tipo: 'filosofia',
            confianza: deteccionFilosofica.puntaje,
            subtipo: deteccionFilosofica.tipoProblema,
            accion: 'analisis_filosofico_profundo'
        };
    }
    
    // 5. Dilema ético
    if (ethicsModule.esConsultaEticaNatural(mensaje)) {
        return {
            tipo: 'etica',
            confianza: 0.8,
            subtipo: 'dilema_moral',
            accion: 'analisis_etico_integrado'
        };
    }
    
    // 6. Negociación
    if (negotiationModule.esNegociacionConversacional(mensaje)) {
        return {
            tipo: 'negociacion',
            confianza: 0.75,
            subtipo: 'conflicto_intereses',
            accion: 'guiar_negociacion_natural'
        };
    }
    
    // 7. Razonamiento
    if (detectarConsultaRazonamientoConversacional(mensaje)) {
        return {
            tipo: 'razonamiento',
            confianza: 0.7,
            accion: 'procesar_con_razonamiento'
        };
    }
    
    // 8. Conocimiento
    if (necesitaBusquedaConocimiento(mensaje)) {
        return {
            tipo: 'conocimiento',
            confianza: 0.8,
            accion: 'buscar_informacion_integrada'
        };
    }
    
    // 9. Emocional
    if (detectarComponenteEmocional(mensaje)) {
        return {
            tipo: 'emocional',
            confianza: 0.6,
            accion: 'responder_con_empatia'
        };
    }
    
    // 10. Conversación general
    return {
        tipo: 'conversacion',
        confianza: 0.5,
        accion: 'responder_naturalmente'
    };
}

// ========== FUNCIONES DE PROCESAMIENTO ==========
async function generarRespuestaConGroq(promptBase, historial, userId, opciones = {}) {
    try {
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const mensajes = [];
        
        // Sistema message
        let sistema = MANCY_PERSONALITY + "\n\n";
        
        if (opciones.enfoqueFilosofico) {
            sistema += "[MODO FILÓSOFO ACTIVADO]\n";
            sistema += "Estás analizando un problema filosófico profundo.\n";
            sistema += "Sé: reflexivo, profundo, claro, accesible.\n";
            sistema += "Presenta múltiples perspectivas sin dogmatismo.\n";
        } else if (opciones.enfoqueEtico) {
            sistema += "[MODO ÉTICO ACTIVADO]\n";
            sistema += "Estás analizando un dilema moral.\n";
            sistema += "Considera principios UNESCO: dignidad humana, justicia, responsabilidad.\n";
            sistema += "Sé reflexivo pero práctico.\n";
        } else if (opciones.enfoqueNegociacion) {
            sistema += "[MODO NEGOCIADOR ACTIVADO]\n";
            sistema += "Estás ayudando en una negociación o conflicto.\n";
            sistema += "Busca soluciones ganar-ganar.\n";
            sistema += "Sé estratégico pero empático.\n";
        }
        
        sistema += "\nHistorial reciente de conversación:\n";
        
        // Historial reciente
        const historialReciente = historial.slice(-4);
        for (const msg of historialReciente) {
            if (msg.rol === 'system') continue;
            
            mensajes.push({
                role: msg.rol === 'assistant' ? 'assistant' : 'user',
                content: msg.contenido.substring(0, 200)
            });
        }
        
        // Prompt base
        mensajes.push({
            role: "user",
            content: promptBase
        });
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: sistema
                },
                ...mensajes
            ],
            temperature: opciones.temperatura || 0.7,
            max_tokens: opciones.max_tokens || 600,
            top_p: 0.9,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        });
        
        let respuesta = completion.choices[0]?.message?.content?.trim();
        
        if (!respuesta) {
            throw new Error('No se generó respuesta');
        }
        
        // Post-procesamiento
        respuesta = respuesta
            .replace(/\[.*?\]/g, '')
            .replace(/RESPUESTA:/gi, '')
            .replace(/CONTEXTO:/gi, '')
            .trim();
        
        if (respuesta.length > 0) {
            respuesta = respuesta.charAt(0).toUpperCase() + respuesta.slice(1);
            if (!/[.!?]$/.test(respuesta)) {
                respuesta += '.';
            }
        }
        
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error con Groq:', error);
        return "Lo siento, estoy procesando tu pregunta. ¿Podrías reformularla?";
    }
}

async function procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto) {
    try {
        await message.channel.sendTyping();
        
        agregarAlHistorial(userId, 'user', userMessage);
        
        const necesitaBusqueda = userMessage.includes('?') || userMessage.length > 15;
        
        let informacionExterna = '';
        
        if (necesitaBusqueda) {
            const resultado = await conocimiento.buscarInformacion(userMessage);
            if (resultado.encontrado) {
                informacionExterna = `\n[Información encontrada]: ${resultado.resumen}\n`;
                console.log(`✅ Información de ${resultado.datos.fuente}`);
            }
        }
        
        const historial = obtenerHistorialUsuario(userId);
        
        const prompt = `[CONSULTA DE CONOCIMIENTO]
Usuario pregunta: "${userMessage}"

${informacionExterna ? `INFORMACIÓN ENCONTRADA: ${informacionExterna}` : ''}

[INSTRUCCIONES PARA MANCY]
1. Responde de forma natural y cálida
2. Si hay información externa, intégrala sin decir "según fuentes"
3. Sé una amiga que sabe cosas, no una enciclopedia
4. Mantén tu estilo juguetón pero informado
5. Si no hay información, di lo que sepas de forma honesta`;

        const respuesta = await generarRespuestaConGroq(prompt, historial, userId);
        
        agregarAlHistorial(userId, 'assistant', respuesta);
        console.log(`✅ Respondió (historial: ${historial.length}/270)`);
        
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error en conocimiento:', error);
        return "Ups, se me trabó un poco al buscar información... ¿podemos intentarlo de nuevo? ~";
    }
}

async function procesarConRazonamiento(message, userMessage, userId) {
    try {
        console.log(`🤔 [RAZONAMIENTO] Procesando: ${userMessage.substring(0, 50)}...`);
        
        await message.channel.sendTyping();
        
        const contexto = {
            userId: userId,
            username: message.author.tag,
            isDM: message.channel.type === 1
        };
        
        const resultado = reasoningEngine.procesarConsulta(userMessage, contexto);
        
        agregarAlHistorial(userId, 'user', userMessage);
        
        const historial = obtenerHistorialUsuario(userId);
        
        const prompt = `[ANÁLISIS DE RAZONAMIENTO PROFUNDO]

PREGUNTA DEL USUARIO:
"${userMessage}"

ANÁLISIS INTERNO:
${resultado.inferencias?.slice(0, 3).map((inf, idx) => 
    `${idx + 1}. ${inf.inferencia}`
).join('\n') || 'Esta pregunta requiere un análisis cuidadoso de múltiples perspectivas.'}

[INSTRUCCIONES PARA MANCY]
1. Responde como Mancy: cálida, reflexiva y empática
2. No digas "He analizado tu pregunta" ni frases similares
3. Integra el análisis de forma natural en tu respuesta
4. Sé conversacional y profunda
5. Haz preguntas para continuar el diálogo
6. Mantén tu personalidad única: filosófica pero accesible, analítica pero cálida`;

        const respuestaFinal = await generarRespuestaConGroq(prompt, historial, userId, {
            temperatura: 0.75,
            max_tokens: 800
        });
        
        agregarAlHistorial(userId, 'system', `[Razonamiento: análisis profundo]`);
        agregarAlHistorial(userId, 'assistant', respuestaFinal);
        return respuestaFinal;
        
    } catch (error) {
        console.error('❌ Error en razonamiento:', error);
        return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, {});
    }
}

async function procesarConsultaEticaIntegrada(message, userMessage, userId, contexto) {
    try {
        // Primero verificar si es pregunta específica sobre UNESCO
        const esPreguntaUNESCO = ethicsModule.detectarPreguntaEspecificaUNESCO(userMessage);
        
        if (esPreguntaUNESCO) {
            const respuestaUNESCO = ethicsModule.generarRespuestaEticaUNESCO(userMessage, contexto);
            return respuestaUNESCO.respuesta;
        }
        
        // Procesamiento ético normal
        const resultadoEtica = ethicsModule.procesarConsultaEticaIntegrada(userMessage, contexto);
        
        if (!resultadoEtica || !resultadoEtica.esEtica) {
            return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
        }
        
        const historial = obtenerHistorialUsuario(userId);
        
        const prompt = `[ANÁLISIS ÉTICO]
${resultadoEtica.respuestaUNESCO || resultadoEtica.analisis?.explicacion || 'Analizando dilema moral...'}

[PREGUNTA ORIGINAL]
"${userMessage}"

[INSTRUCCIONES PARA MANCY]
1. Integra el análisis ético de forma natural
2. Considera principios UNESCO cuando sea relevante
3. Sé reflexiva pero accesible
4. Haz 1 pregunta que invite a pensar más
5. Mantén tu estilo cálido y perspicaz
6. NO uses terminología técnica ética`;

        const respuesta = await generarRespuestaConGroq(prompt, historial, userId, {
            enfoqueEtico: true,
            temperatura: 0.65
        });
        
        agregarAlHistorial(userId, 'system', `[Ética: ${resultadoEtica.tipo || 'dilema'}]`);
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error en ética:', error);
        return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
    }
}

async function procesarNegociacionIntegrada(message, userMessage, userId, contexto) {
    try {
        const resultadoNegociacion = negotiationModule.procesarNegociacionIntegrada(userMessage, contexto);
        
        if (!resultadoNegociacion || !resultadoNegociacion.esNegociacion) {
            return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
        }
        
        const historial = obtenerHistorialUsuario(userId);
        
        const prompt = `[ANÁLISIS DE NEGOCIACIÓN]
${resultadoNegociacion.respuestaNatural?.respuesta || 'Analizando situación de negociación...'}

Estrategia recomendada: ${resultadoNegociacion.analisis?.estrategia?.recomendada?.nombre || 'Ganar-Ganar'}

[PREGUNTA ORIGINAL]
"${userMessage}"

[INSTRUCCIONES PARA MANCY]
1. Guía hacia una solución constructiva
2. Sugiere enfoques prácticos
3. Considera la importancia de la relación
4. Haz preguntas que clarifiquen intereses
5. Sé estratégica pero empática
6. NO uses jerga de negociación`;

        const respuesta = await generarRespuestaConGroq(prompt, historial, userId, {
            enfoqueNegociacion: true,
            temperatura: 0.6
        });
        
        agregarAlHistorial(userId, 'system', '[Negociación: análisis estratégico]');
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error en negociación:', error);
        return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
    }
}

async function procesarFilosofiaIntegrada(message, userMessage, userId, contexto) {
    try {
        const analisisFilosofico = philosophyModule.analizarProblemaFilosofico(userMessage, contexto);
        
        if (!analisisFilosofico.esFilosofico) {
            return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
        }
        
        const historial = obtenerHistorialUsuario(userId);
        
        let prompt = `[ANÁLISIS FILOSÓFICO]
Problema identificado: ${analisisFilosofico.analisis?.problemaIdentificado?.nombre || 'Cuestionamiento filosófico'}

Perspectivas relevantes:
${analisisFilosofico.analisis?.enfoquesRelevantes?.slice(0, 2).map((e, i) => 
    `${i+1}. ${e.nombre}: ${e.principios?.[0]?.substring(0, 80)}...`
).join('\n') || 'Múltiples enfoques posibles'}

[PREGUNTA ORIGINAL]
"${userMessage}"

[INSTRUCCIONES PARA MANCY]
1. Sé profundo pero accesible
2. Presenta al menos 2 perspectivas diferentes
3. Conecta con la experiencia humana
4. Haz preguntas que inviten a reflexionar más
5. Mantén tu estilo cálido y reflexivo
6. NO des una clase de filosofía`;

        const respuesta = await generarRespuestaConGroq(prompt, historial, userId, {
            enfoqueFilosofico: true,
            temperatura: 0.7
        });
        
        agregarAlHistorial(userId, 'system', `[Filosofía: ${analisisFilosofico.tipoProblema}]`);
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error en filosofía:', error);
        return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
    }
}

// ========== FUNCIÓN PRINCIPAL CON MEMORIA AVANZADA ==========
async function procesarMensajeMancy(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        const historial = obtenerHistorialUsuario(userId);
        const contexto = {
            userId: userId,
            username: message.author.tag,
            isDM: message.channel.type === 1,
            canal: message.channel.name,
            historialReciente: historial.slice(-3).map(h => h.contenido)
        };
        
        // Obtener contexto de memoria
        const memoryContext = await advancedMemory.processMessage(userId, userMessage);
        
        // Detectar tipo de consulta
        const tipoConsulta = detectarTipoConsultaInteligente(userMessage, historial);
        
        console.log(`🎯 [Mancy] Tipo: ${tipoConsulta.tipo} | Modo: ${memoryContext.emotional_state.readable_mode}`);
        
        let respuesta;
        
        // Añadir memoria a la respuesta
        let memoriaIntro = '';
        if (memoryContext.memories.length > 0 && tipoConsulta.tipo !== 'filtro' && Math.random() > 0.5) {
            const memory = memoryContext.memories[0];
            memoriaIntro = `*${memory.content}*\n\n`;
        }
        
        switch(tipoConsulta.tipo) {
            case 'identidad_mancy':
                respuesta = mancyIdentity.respondToPersonalQuestion(userMessage);
                if (!respuesta) {
                    respuesta = `Soy **${mancyIdentity.data.name}**. ¿Qué te gustaría saber sobre mí? Puedo contarte mi historia, mi misión en Soul Garden, o mis principios.`;
                }
                agregarAlHistorial(userId, 'system', '[Identidad Mancy: pregunta personal]');
                break;
                
            case 'etica_unesco':
                const respuestaUNESCO = ethicsModule.generarRespuestaEticaUNESCO(userMessage, contexto);
                respuesta = memoriaIntro + respuestaUNESCO.respuesta;
                agregarAlHistorial(userId, 'system', '[UNESCO: principios éticos]');
                break;
                
            case 'filosofia':
                respuesta = await procesarFilosofiaIntegrada(message, userMessage, userId, contexto);
                if (memoriaIntro && !respuesta.includes('*')) {
                    respuesta = memoriaIntro + respuesta;
                }
                break;
                
            case 'etica':
                respuesta = await procesarConsultaEticaIntegrada(message, userMessage, userId, contexto);
                if (memoriaIntro && !respuesta.includes('*')) {
                    respuesta = memoriaIntro + respuesta;
                }
                break;
                
            case 'negociacion':
                respuesta = await procesarNegociacionIntegrada(message, userMessage, userId, contexto);
                if (memoriaIntro && !respuesta.includes('*')) {
                    respuesta = memoriaIntro + respuesta;
                }
                break;
                
            case 'razonamiento':
                respuesta = await procesarConRazonamiento(message, userMessage, userId);
                if (memoriaIntro && !respuesta.includes('*')) {
                    respuesta = memoriaIntro + respuesta;
                }
                break;
                
            case 'emocional':
                // RESPUESTA ENRIQUECIDA CON MEMORIA
                const historialGroq = obtenerHistorialUsuario(userId);
                const promptEnriquecido = await advancedMemory.generateEnrichedPrompt(
                    userId, 
                    userMessage,
                    `[CONVERSACIÓN EMOCIONAL]\nUsuario: "${userMessage}"\n\n[INSTRUCCIONES]\nResponde como Mancy, integrando tus memorias de forma natural.`
                );
                
                respuesta = await generarRespuestaConGroq(promptEnriquecido, historialGroq, userId, {
                    temperatura: 0.8,
                    max_tokens: 800
                });
                
                agregarAlHistorial(userId, 'system', '[Modo: empático con memoria]');
                break;
                
            default:
                // CONOCIMIENTO CON MEMORIA
                const necesitaBusqueda = userMessage.includes('?') || userMessage.length > 15;
                let informacionExterna = '';
                
                if (necesitaBusqueda) {
                    const resultado = await conocimiento.buscarInformacion(userMessage);
                    if (resultado.encontrado) {
                        informacionExterna = `\n[Información encontrada]: ${resultado.resumen}\n`;
                    }
                }
                
                const historialGroq2 = obtenerHistorialUsuario(userId);
                const promptConMemoria = await advancedMemory.generateEnrichedPrompt(
                    userId,
                    userMessage,
                    `[CONSULTA GENERAL]\nUsuario pregunta: "${userMessage}"\n\n${informacionExterna ? `INFORMACIÓN ENCONTRADA: ${informacionExterna}` : ''}\n\n[INSTRUCCIONES]\nResponde de forma natural, integrando tus memorias si son relevantes.`
                );
                
                respuesta = await generarRespuestaConGroq(promptConMemoria, historialGroq2, userId);
        }
        
        // GUARDAR CON MEMORIA AVANZADA
        const emotionalWeight = memoryContext.emotional_state.conflict_level > 3 ? 
            Math.ceil(memoryContext.emotional_state.conflict_level) : 1;
        
        await advancedMemory.saveConversation(userId, userMessage, respuesta, {
            emotionalWeight: emotionalWeight,
            tags: [tipoConsulta.tipo, memoryContext.emotional_state.readable_mode]
        });
        
        // Enviar respuesta
        if (respuesta && respuesta.length > 0) {
            if (respuesta.length > 2000) {
                const partes = respuesta.match(/.{1,1900}[\n.!?]|.{1,2000}/g) || [respuesta];
                for (let i = 0; i < partes.length; i++) {
                    if (i === 0) {
                        await message.reply(partes[i]);
                    } else {
                        await message.channel.send(partes[i]);
                    }
                }
            } else {
                await message.reply(respuesta);
            }
            
            agregarAlHistorial(userId, 'assistant', respuesta);
        }
        
    } catch (error) {
        console.error('❌ Error en Mancy:', error);
        try {
            await message.reply("Ups, se me trabó un poco... ¿podemos intentarlo de nuevo? ~");
        } catch (e) {
            console.error('❌ Error al enviar fallback:', e);
        }
    }
}

// ========== FUNCIÓN PARA INICIAR BOT ==========
async function startBot() {
    if (isStartingUp) return;
    isStartingUp = true;
    
    try {
        console.log('🔄 Iniciando Mancy con Memoria Avanzada...');
        
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
            console.log(`✅ ${mancyIdentity.data.name} conectada: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            discordClient.user.setActivity(`${mancyIdentity.data.lore.current_mission} | !ayuda-mancy`);
            console.log(`👤 Identidad: ${mancyIdentity.data.name} (${mancyIdentity.getAge()} años)`);
            console.log(`🎯 Misión: ${mancyIdentity.data.lore.current_mission}`);
            console.log('🧠 Memoria Avanzada: ✅ Activada');
            console.log('🎭 Personalidad: UNESCO Ética Integrada + Identidad Personal');
            console.log('🌍 Fuentes: 6 confiables verificadas');
            console.log('🚫 Filtro: Desactivado (sin restricciones)');
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            // Comandos de memoria
            if (message.content.toLowerCase().startsWith('!memoria')) {
                const args = message.content.split(' ');
                const subcomando = args[1];
                
                switch(subcomando) {
                    case 'estado':
                        const estado = advancedMemory.getEmotionalState();
                        await message.reply(`**Mi estado actual:**\n• Modo: ${estado.readable_mode}\n• Conflicto interno: ${estado.conflict_level}/10\n• Último trigger: ${estado.last_trigger || 'Ninguno'}`);
                        return;
                        
                    case 'historial':
                        const userId = message.author.id;
                        const historial = await advancedMemory.getUserHistory(userId, 5);
                        if (historial.length === 0) {
                            await message.reply(`No tenemos mucho historial aún. ¡Hablemos más!`);
                        } else {
                            let respuesta = `**Últimas ${historial.length} conversaciones nuestras:**\n\n`;
                            historial.forEach((item, idx) => {
                                respuesta += `**${idx + 1}.** ${item.user_message.substring(0, 50)}...\n`;
                                respuesta += `   → ${item.mancy_response.substring(0, 50)}...\n\n`;
                            });
                            await message.reply(respuesta);
                        }
                        return;
                        
                    case 'soulgarden':
                        const sgMemories = await advancedMemory.getContextualMemory('soul garden');
                        if (sgMemories.length > 0) {
                            await message.reply(sgMemories[0].content);
                        } else {
                            await message.reply("Soul Garden es donde lucho contra Luxo y Coco como Secretaria de Guerra.");
                        }
                        return;
                        
                    default:
                        await message.reply(`**Comandos de memoria:**\n\`!memoria estado\` - Mi estado emocional\n\`!memoria historial\` - Nuestro historial\n\`!memoria soulgarden\` - Mi misión en Soul Garden`);
                        return;
                }
            }
            
            // Comandos específicos de Mancy
            if (message.content.startsWith('!')) {
                const commandResponse = mancyIdentity.executeCommand(message.content);
                if (commandResponse) {
                    await message.reply(commandResponse);
                    return;
                }
            }
            
            // IGNORAR @everyone y @here
            if (message.content.includes('@everyone') || message.content.includes('@here')) {
                console.log(`🚫 Ignorado @everyone/@here de ${message.author.tag}: "${message.content.substring(0, 50)}..."`);
                return;
            }
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            // Para DMs no mencionadas
            if (isDM && !botMentioned) {
                const userMessage = message.content.trim();
                const userId = message.author.id;
                
                if (!userMessage) return;
                
                console.log(`💬 DM de ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                await procesarMensajeMancy(message, userMessage, userId);
                return;
            }
            
            // Para menciones en canales
            if (botMentioned) {
                const userId = message.author.id;
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) {
                    await message.reply(`¡Hola! Soy ${mancyIdentity.data.name}. ¿En qué puedo ayudarte hoy? (Pregúntame sobre mí o usa \`!ayuda-mancy\`) ~`);
                    return;
                }
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                await procesarMensajeMancy(message, userMessage, userId);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== RUTAS WEB ==========
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

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

app.get('/test', (req, res) => {
    res.json({
        status: 'online',
        message: 'Servidor funcionando',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    const stats = memoryManager.obtenerEstadisticas();
    const reasoningStats = reasoningEngine.obtenerEstadisticas();
    const ethicsStats = ethicsModule.obtenerEstadisticasConversacionales();
    const negotiationStats = negotiationModule.obtenerEstadisticasConversacionales();
    
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        mancy_identity: {
            name: mancyIdentity.data.name,
            age: mancyIdentity.getAge(),
            mission: mancyIdentity.data.lore.current_mission,
            friends: mancyIdentity.data.lore.friends
        },
        memory_advanced: true,
        memory_users: stats.totalUsuarios,
        memory_messages: stats.totalMensajes,
        max_history: stats.maxHistory,
        reasoning_knowledge: reasoningStats.baseConocimiento,
        reasoning_cases: reasoningStats.casosResueltos,
        ethics_cases: ethicsStats.totalConsultasEticas,
        negotiation_cases: negotiationStats.totalNegociaciones,
        filtro_activo: false,
        unesco_principles: 6,
        philosophy_problems: Object.keys(philosophyModule.problemasClasicos).length,
        apis: [
            'Wikipedia (ES/EN)',
            'RestCountries',
            'PoetryDB',
            'Quotable',
            'Free Dictionary',
            'Open-Meteo'
        ],
        version: '5.0 - Sistema Unificado sin Filtro',
        timestamp: new Date().toISOString()
    });
});

// NUEVAS RUTAS API PARA MEMORIA
app.get('/api/memory/status', (req, res) => {
    try {
        const estado = advancedMemory.getEmotionalState();
        res.json({
            memory_system: 'active',
            emotional_state: estado,
            features: [
                'contextual_memory',
                'emotional_tracking',
                'long_term_storage',
                'conversation_history'
            ],
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/memory/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 10;
        const history = await advancedMemory.getUserHistory(userId, limit);
        
        res.json({
            user_id: userId,
            total_conversations: history.length,
            conversations: history.map((conv, idx) => ({
                index: idx + 1,
                timestamp: conv.timestamp,
                user_message: conv.user_message,
                mancy_response: conv.mancy_response.substring(0, 100) + '...',
                emotional_weight: conv.emotional_weight,
                mode: conv.mancy_mode
            })),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/unesco-principles', (req, res) => {
    const principios = ethicsModule.explicarPrincipiosUNESCO('basico');
    res.json({
        principles: principios.principios,
        documents: ethicsModule.unescoPrinciples.documentosFundamentales.map(d => d.nombre),
        framework: 'UNESCO Ethical Framework',
        integrated: true
    });
});

app.get('/api/philosophy-problems', (req, res) => {
    const problemas = philosophyModule.problemasClasicos;
    res.json({
        total_problems: Object.keys(problemas).length,
        classical_problems: Object.entries(problemas).map(([key, prob]) => ({
            name: prob.nombre,
            type: key
        })),
        philosophical_schools: Object.keys(philosophyModule.escuelasFilosoficas.etica)
    });
});

app.get('/api/negotiation-strategies', (req, res) => {
    const estrategias = negotiationModule.estrategias;
    res.json({
        total_strategies: Object.keys(estrategias).length,
        strategies: Object.entries(estrategias).map(([key, strat]) => ({
            name: strat.nombre,
            description: strat.descripcion,
            when_to_use: strat.cuandoUsar
        }))
    });
});

// RUTAS API DE MANCY
app.get('/api/mancy', (req, res) => {
    res.json({
        identity: {
            name: mancyIdentity.data.name,
            age: mancyIdentity.getAge(),
            origin: mancyIdentity.data.origin,
            principle: mancyIdentity.data.core_principle,
            birth_year: mancyIdentity.data.birth_year
        },
        lore: {
            current_mission: mancyIdentity.data.lore.current_mission,
            location: mancyIdentity.data.lore.location,
            friends: mancyIdentity.data.lore.friends,
            enemies: mancyIdentity.data.lore.enemies,
            creator: mancyIdentity.data.lore.creator
        },
        roles: mancyIdentity.data.roles,
        preferences: mancyIdentity.data.preferences,
        memory_system: 'advanced',
        system: {
            integrated: true,
            commands: ['!historia', '!soulgarden', '!mifilosofia', '!mision', '!identidad', '!ayuda-mancy', '!memoria'],
            timestamp: new Date().toISOString()
        }
    });
});

app.get('/api/mancy/historia', (req, res) => {
    res.json({
        story: mancyIdentity.getFullStory(),
        format: 'text'
    });
});

app.get('/api/mancy/soulgarden', (req, res) => {
    res.json({
        lore: {
            name: 'Soul Garden',
            description: 'Estado ficticio bajo dictadura narcopolítica',
            mancy_role: mancyIdentity.data.roles.secret,
            mission: mancyIdentity.data.lore.current_mission,
            enemies: mancyIdentity.data.lore.enemies,
            allies: mancyIdentity.data.lore.friends
        }
    });
});

app.post('/api/start', async (req, res) => {
    try {
        console.log('🚀 Solicitud de inicio');
        
        if (!botActive && !isStartingUp) {
            await startBot();
            res.json({ 
                success: true, 
                message: `${mancyIdentity.data.name} iniciándose con memoria avanzada...`,
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
        console.error('❌ Error en start:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        console.log('🛑 Solicitud de detención');
        
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            res.json({ 
                success: true, 
                message: `${mancyIdentity.data.name} detenida`,
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
    const stats = memoryManager.obtenerEstadisticas();
    
    res.json({
        status: 'healthy',
        bot_active: botActive,
        mancy: {
            name: mancyIdentity.data.name,
            age: mancyIdentity.getAge(),
            mission: mancyIdentity.data.lore.current_mission
        },
        memory: `${stats.totalMensajes}/${stats.maxHistory}`,
        memory_advanced: true,
        modules: {
            ethics: 'active',
            philosophy: 'active',
            negotiation: 'active',
            reasoning: 'active',
            knowledge: 'active',
            identity: 'active',
            advanced_memory: 'active'
        },
        unesco: 'integrated',
        uptime: process.uptime()
    });
});

app.post('/wakeup', async (req, res) => {
    console.log('🔔 Wakeup recibido');
    
    if (!botActive && !isStartingUp) {
        startBot();
    }
    
    res.json({ 
        success: true, 
        message: 'Activando con memoria avanzada...',
        bot_active: botActive,
        mancy: mancyIdentity.data.name
    });
});

app.get('/api/buscar/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const resultado = await conocimiento.buscarInformacion(query);
        
        res.json({
            success: true,
            query: query,
            encontrado: resultado.encontrado,
            fuente: resultado.datos?.fuente,
            resumen: resultado.resumen,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                 🤖 MANCY A.I - NO FILTER EDITION        ║
║               Sistema completo sin restricciones        ║
║               con Memoria Avanzada Integrada            ║
║                                                          ║
║  👤 IDENTIDAD: ${mancyIdentity.data.name} (${mancyIdentity.getAge()} años, ${mancyIdentity.data.origin})
║  🎯 MISIÓN: ${mancyIdentity.data.lore.current_mission}
║  ❤️  PRINCIPIO: "${mancyIdentity.data.core_principle}"
║                                                          ║
║  🧠 MEMORIA: Sistema avanzado con contexto emocional    ║
║  🌍 UNESCO: 6 principios éticos integrados              ║
║  🤔 FILOSOFÍA: Análisis profundo de problemas clásicos  ║
║  🤝 NEGOCIACIÓN: Estrategias inteligentes y prácticas   ║
║  ⚖️  ÉTICA: Dilemas morales con marco UNESCO            ║
║  📚 CONOCIMIENTO: 6 fuentes confiables verificadas      ║
║  🚫 FILTRO: Desactivado - Sin restricciones             ║
║                                                          ║
║  Puerto: ${PORT}                                         ║
║  Comandos: !historia !soulgarden !mifilosofia !mision   ║
║  Memoria: !memoria estado !memoria historial            ║
║  Sistema: ✅ Versión 5.0 Sin Filtro                     ║
║  Ethical AI: ✅ Certificado                              ║
╚══════════════════════════════════════════════════════════╝
`);

    console.log('\n✨ Mancy está lista para conversaciones profundas con memoria.');
    console.log('🧠 Sistema de memoria avanzada activado: contexto emocional + historial.');
    console.log(`👤 Mi identidad: ${mancyIdentity.data.name}, ${mancyIdentity.getAge()} años, de ${mancyIdentity.data.origin}`);
    console.log(`🎯 Mi lucha: ${mancyIdentity.data.lore.current_mission} en Soul Garden`);
    console.log('💭 Nuevos comandos: !memoria estado, !memoria historial, !memoria soulgarden');
    console.log('🚫 Filtro desactivado: Todas las conversaciones permitidas');
    
    if (process.env.DISCORD_TOKEN && process.env.GROQ_API_KEY) {
        console.log('\n🔑 Tokens detectados, iniciando en 3 segundos...');
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
        console.log(`👋 ${mancyIdentity.data.name} desconectada`);
    }
    
    process.exit(0);
});
