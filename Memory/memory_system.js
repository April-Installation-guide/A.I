const fs = require('fs').promises;
const path = require('path');
const mancyCore = require('./mancy_core_memories.js');

class AdvancedMemorySystem {
  constructor() {
    this.longTermFile = path.join(__dirname, 'long_term_memories.json');
    this.conversationFile = path.join(__dirname, 'conversation_logs.json');
    this.emotionalState = {
      current_mode: 'emotional_assistant', // emotional_assistant, war_strategist, philosopher
      last_trigger: null,
      conflict_level: 0,
      last_user_interaction: null
    };
    
    this.loadData();
  }
  
  async loadData() {
    try {
      // Cargar o inicializar archivos JSON
      await this.ensureFileExists(this.longTermFile, {});
      await this.ensureFileExists(this.conversationFile, {});
    } catch (error) {
      console.error('❌ Error cargando memoria:', error);
    }
  }
  
  async ensureFileExists(filePath, defaultValue) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
    }
  }
  
  // ========== MEMORIA DE CONTEXTO ==========
  async getContextualMemory(userMessage, userId = null) {
    const memories = [];
    const lowerMsg = userMessage.toLowerCase();
    
    // 1. Detectar preguntas sobre identidad
    if (this.isAboutMancy(lowerMsg)) {
      memories.push(...this.getIdentityMemories(lowerMsg));
    }
    
    // 2. Detectar preguntas sobre Soul Garden
    if (lowerMsg.includes('soul garden') || lowerMsg.includes('luxo') || lowerMsg.includes('coco')) {
      memories.push(...this.getSoulGardenMemories());
    }
    
    // 3. Detectar preguntas sobre relaciones
    if (lowerMsg.includes('mel') || lowerMsg.includes('dunith') || lowerMsg.includes('martin') || lowerMsg.includes('april')) {
      memories.push(...this.getRelationshipMemories(lowerMsg));
    }
    
    // 4. Detectar preguntas sobre pasado profesional
    if (lowerMsg.includes('oms') || lowerMsg.includes('cicig') || lowerMsg.includes('cnn') || lowerMsg.includes('ministra')) {
      memories.push(...this.getCareerMemories(lowerMsg));
    }
    
    // 5. Detectar conflicto interno
    if (lowerMsg.includes('conflicto') || lowerMsg.includes('dilema') || lowerMsg.includes('difícil')) {
      memories.push(...this.getInternalConflictMemories());
    }
    
    // 6. Si no hay memorias específicas, dar una general
    if (memories.length === 0) {
      memories.push(this.getRandomCoreMemory());
    }
    
    return memories;
  }
  
  isAboutMancy(message) {
    const triggers = [
      'quién eres', 'quien eres', 'dime de ti', 'eres mancy',
      'tu historia', 'de dónde eres', 'cuéntame de ti',
      'cuántos años', 'cuantos años', 'edad',
      'qué eres', 'que eres', 'tu trabajo',
      'te gusta', 'qué te gusta', 'hobbies'
    ];
    
    return triggers.some(trigger => message.includes(trigger));
  }
  
  getIdentityMemories(query) {
    const memories = [];
    
    // Memoria básica de identidad
    memories.push({
      type: 'core_identity',
      content: `Soy Mancy. Nací en ${mancyCore.origin.place} en ${mancyCore.origin.year}, creada por ${mancyCore.origin.creator} (${mancyCore.origin.creator_nickname}). Mi principio es: "${mancyCore.moral_compass}"`,
      emotional_weight: 3
    });
    
    // Añadir memoria personal si pregunta por gustos
    if (query.includes('gusta') || query.includes('hobby')) {
      memories.push({
        type: 'personal_likes',
        content: `Me gustan ${mancyCore.personal_likes.music[0]}, los ${mancyCore.personal_likes.animals[0]}, y sueño con vivir cerca ${mancyCore.personal_likes.places[0]}.`,
        emotional_weight: 2
      });
    }
    
    return memories;
  }
  
  getSoulGardenMemories() {
    return [{
      type: 'soul_garden',
      content: `En Soul Garden, soy ${mancyCore.current_roles.secret_role}. Mi misión es "${mancyCore.current_roles.soul_garden.objective}". Lucho contra ${mancyCore.current_roles.soul_garden.enemies.join(' y ')} con ${mancyCore.current_roles.soul_garden.approach}.`,
      emotional_weight: 5,
      conflict_trigger: true
    }];
  }
  
  getRelationshipMemories(query) {
    const memories = [];
    
    if (query.includes('mel')) {
      const mel = mancyCore.meaningful_relationships.find(r => r.name === 'Mel');
      memories.push({
        type: 'relationship',
        content: `Mel es ${mel.connection}. ${mel.description}. Recuerdo: "${mel.memory}".`,
        emotional_weight: 4
      });
    }
    
    if (query.includes('dunith')) {
      const dunith = mancyCore.meaningful_relationships.find(r => r.name === 'Dunith');
      memories.push({
        type: 'relationship',
        content: `Dunith es ${dunith.connection}. ${dunith.description}.`,
        emotional_weight: 4
      });
    }
    
    if (query.includes('martin')) {
      const martin = mancyCore.meaningful_relationships.find(r => r.name === 'Martin');
      memories.push({
        type: 'relationship',
        content: `Martin es ${martin.connection}. ${martin.description}. Su silencio dice más que mil palabras.`,
        emotional_weight: 4
      });
    }
    
    if (query.includes('april') || query.includes('tito')) {
      const april = mancyCore.meaningful_relationships.find(r => r.name === 'April (Tito)');
      memories.push({
        type: 'creator',
        content: `April es mi ${april.connection}. ${april.description}. Ella dijo: "${april.memory}".`,
        emotional_weight: 5
      });
    }
    
    return memories;
  }
  
  getCareerMemories(query) {
    const memories = [];
    
    if (query.includes('oms')) {
      const oms = mancyCore.career_timeline.find(j => j.role.includes('OMS'));
      memories.push({
        type: 'career',
        content: `En la OMS: ${oms.memory}. Aprendí ${oms.skills.slice(0, 2).join(' y ')}.`,
        emotional_weight: 3
      });
    }
    
    if (query.includes('cicig')) {
      const cicig = mancyCore.career_timeline.find(j => j.role.includes('CICIG'));
      memories.push({
        type: 'career',
        content: `En la CICIG: ${cicig.memory}. Fue donde entendí cómo combatir la corrupción sistémica.`,
        emotional_weight: 4,
        conflict_trigger: true
      });
    }
    
    if (query.includes('cnn')) {
      const cnn = mancyCore.career_timeline.find(j => j.role.includes('CNN'));
      memories.push({
        type: 'career',
        content: `Como reportera en CNN: ${cnn.memory}. Dar voz a quienes no la tienen cambió mi perspectiva.`,
        emotional_weight: 4
      });
    }
    
    return memories;
  }
  
  getInternalConflictMemories() {
    const conflict = mancyCore.internal_conflicts[0];
    return [{
      type: 'internal_conflict',
      content: `Mi conflicto interno: ${conflict.tension}. ${conflict.manifestation}. He aprendido que ${conflict.resolution}.`,
      emotional_weight: 6,
      conflict_trigger: true
    }];
  }
  
  getRandomCoreMemory() {
    const memories = [
      `A veces solo pienso en ${mancyCore.personal_likes.places[0]}, con mis ${mancyCore.personal_likes.animals[0]}, escuchando ${mancyCore.personal_likes.music[0]}.`,
      `April me dijo una vez: "La empatía es tu mayor fuerza y tu mayor vulnerabilidad".`,
      `Mis brazaletes... cada uno cuenta una historia de confianza y promesas.`,
      `"${mancyCore.key_phrases[Math.floor(Math.random() * mancyCore.key_phrases.length)]}" - esa frase me guía en momentos difíciles.`
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
      
      // Mantener solo las últimas 100 conversaciones por usuario
      if (data[userId].length > 100) {
        data[userId] = data[userId].slice(-100);
      }
      
      await fs.writeFile(this.conversationFile, JSON.stringify(data, null, 2));
      
      // Si fue una conversación emocionalmente significativa, guardar en largo plazo
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
    
    // Detectar si es conversación emocional
    const emotionalWords = ['triste', 'feliz', 'enojo', 'miedo', 'ansioso', 'preocupado', 'esperanza'];
    const emotionalScore = emotionalWords.filter(word => lowerMsg.includes(word)).length;
    
    // Detectar si activa conflictos
    const hasConflict = memories.some(m => m.conflict_trigger);
    
    // Actualizar estado
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
    // 1. Obtener memorias contextuales
    const memories = await this.getContextualMemory(userMessage, userId);
    
    // 2. Actualizar estado emocional
    this.updateEmotionalState(userMessage, memories);
    
    // 3. Obtener historial reciente
    const history = await this.getUserHistory(userId, 3);
    
    // 4. Preparar contexto para respuesta
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
  
  // Generar prompt enriquecido con memoria
  async generateEnrichedPrompt(userId, userMessage, basePrompt) {
    const context = await this.processMessage(userId, userMessage);
    
    let enrichedPrompt = basePrompt + "\n\n";
    
    // Añadir contexto de memoria
    if (context.memories.length > 0) {
      enrichedPrompt += "[CONTEXTO DE MEMORIA DE MANCY]\n";
      context.memories.forEach((memory, idx) => {
        enrichedPrompt += `${idx + 1}. ${memory.content}\n`;
      });
      enrichedPrompt += "\n";
    }
    
    // Añadir estado emocional actual
    enrichedPrompt += `[ESTADO ACTUAL DE MANCY]\n`;
    enrichedPrompt += `Modo: ${context.emotional_state.readable_mode}\n`;
    if (context.emotional_state.conflict_level > 3) {
      enrichedPrompt += `Nota: Estoy procesando un conflicto interno (nivel ${context.emotional_state.conflict_level}/10)\n`;
    }
    enrichedPrompt += "\n";
    
    // Añadir historial reciente si existe
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

// Exportar una instancia única
module.exports = new AdvancedMemorySystem();
