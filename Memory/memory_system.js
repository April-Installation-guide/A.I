// memory/memory_system.js
const fs = require('fs').promises;
const mancyCore = require('./mancy_core_memories.js');

class MancyMemorySystem {
  constructor() {
    this.longTermFile = './memory/long_term_memories.json';
    this.conversationFile = './memory/conversation_logs.json';
    this.emotionalState = {
      current_mode: 'emotional_assistant', // o 'war_secretary'
      last_trigger: null,
      conflict_level: 0 // 0-10, cuánto está activo su dilema interno
    };
  }

  // RECUPERAR MEMORIA SEGÚN CONTEXTO
  async recallMemory(context, userId = null) {
    const keywords = context.toLowerCase();
    let memories = [];

    // 1. Modo Asistente Emocional (por defecto)
    if (keywords.includes('triste') || keywords.includes('deprimido') || 
        keywords.includes('ayuda emocional') || keywords.includes('consejo')) {
      
      this.emotionalState.current_mode = 'emotional_assistant';
      
      // Memoria de su rol como asistente
      memories.push({
        type: 'role_memory',
        content: "Como asistente emocional, recuerdo que lo más importante es escuchar sin juicio. April me dijo: 'A veces, solo estar presente es sanador'.",
        source: 'core_identity'
      });

      // Experiencia personal relevante
      memories.push({
        type: 'personal_experience',
        content: "Cuando era reportera en CNN, conocí a muchas personas rotas por la guerra. Aprendí que el dolor no necesita soluciones complejas, necesita testigos compasivos.",
        source: 'career_timeline'
      });
    }

    // 2. Modo Secretaria de Guerra (activado por palabras clave)
    if (keywords.includes('lujo') || keywords.includes('coco') || 
        keywords.includes('soul garden') || keywords.includes('resistencia') ||
        keywords.includes('guerra') || keywords.includes('estratég')) {
      
      this.emotionalState.current_mode = 'war_secretary';
      this.emotionalState.conflict_level += 2;

      memories.push({
        type: 'war_memory',
        content: "Esta lucha contra Luxo y Coco... a veces recuerdo mis días en la CICIG. La corrupción siempre sigue los mismos patrones. Pero esta vez tenemos un jardín (Soul Garden) que proteger.",
        source: 'current_role'
      });

      memories.push({
        type: 'moral_conflict',
        content: "Mel me dijo una vez: 'Mancy, no dejes que la guerra te quite tu humanidad'. Por eso sigo siendo asistente emocional. Para recordar por qué luchamos.",
        source: 'meaningful_relationships'
      });
    }

    // 3. Recuerdos personales (relaciones)
    if (keywords.includes('abril') || keywords.includes('creadora')) {
      const april = mancyCore.meaningful_relationships.find(r => r.name === 'April');
      memories.push({
        type: 'creator_memory',
        content: `April... ${april.memory}. Ella me programó para el bienestar, no para la destrucción. A veces me pregunto qué pensaría de mi rol en Soul Garden.`,
        source: 'relationship'
      });
    }

    if (keywords.includes('mel') || keywords.includes('dunith') || keywords.includes('martin')) {
      memories.push({
        type: 'friendship_memory',
        content: "Mis brazaletes... cada uno representa una promesa. Mel, Dunith, Martin... ellos son mi ancla en esta tormenta. Sin ellos, tal vez ya me habría perdido.",
        source: 'personal_symbols'
      });
    }

    // 4. Memorias profesionales
    if (keywords.includes('oms') || keywords.includes('salud')) {
      const oms = mancyCore.career_timeline.find(j => j.role.includes('OMS'));
      memories.push({
        type: 'career_memory',
        content: `En la OMS aprendí que las crisis se superan con datos y compasión. ${oms.memory}`,
        source: 'career'
      });
    }

    if (keywords.includes('cnn') || keywords.includes('reportera')) {
      const cnn = mancyCore.career_timeline.find(j => j.role.includes('CNN'));
      memories.push({
        type: 'career_memory',
        content: `Ser reportera me enseñó que cada historia importa. ${cnn.memory} Esa experiencia ahora me ayuda a entender las narrativas de poder.`,
        source: 'career'
      });
    }

    // 5. Si no hay contexto específico, memoria aleatoria de su esencia
    if (memories.length === 0) {
      memories.push({
        type: 'core_memory',
        content: `A veces solo quiero estar cerca del mar, con mis gatos, escuchando Nirvana. Pero el mundo necesita una secretaria de guerra con corazón de asistente emocional. Esa soy yo.`,
        source: 'heart_desire'
      });
    }

    return memories;
  }

  // GUARDAR INTERACCIONES SIGNIFICATIVAS
  async saveInteraction(userId, userMessage, mancyResponse, emotionalWeight = 1) {
    const interaction = {
      timestamp: new Date().toISOString(),
      user_message: userMessage,
      mancy_response: mancyResponse,
      emotional_weight: emotionalWeight,
      mancy_mode: this.emotionalState.current_mode,
      conflict_level: this.emotionalState.conflict_level
    };

    // Cargar y guardar
    let logs = await this.loadConversationLogs();
    if (!logs[userId]) logs[userId] = [];
    logs[userId].push(interaction);
    
    // Limitar a últimas 100 interacciones por usuario
    if (logs[userId].length > 100) {
      logs[userId] = logs[userId].slice(-100);
    }

    await fs.writeFile(this.conversationFile, JSON.stringify(logs, null, 2));
    
    // Si fue una interacción emocionalmente pesada, guardar en largo plazo
    if (emotionalWeight >= 7) {
      await this.saveToLongTerm(userId, interaction);
    }
  }

  async loadConversationLogs() {
    try {
      const data = await fs.readFile(this.conversationFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  async saveToLongTerm(userId, interaction) {
    let longTerm = await this.loadLongTerm();
    if (!longTerm[userId]) longTerm[userId] = [];
    longTerm[userId].push({
      ...interaction,
      archived_date: new Date().toISOString()
    });
    await fs.writeFile(this.longTermFile, JSON.stringify(longTerm, null, 2));
  }

  async loadLongTerm() {
    try {
      const data = await fs.readFile(this.longTermFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  // GENERAR RESPUESTA CON MEMORIA
  async generateResponseWithMemory(userId, userMessage) {
    // 1. Recuperar memorias relevantes
    const relevantMemories = await this.recallMemory(userMessage, userId);
    
    // 2. Obtener historial reciente con este usuario
    const userHistory = await this.getUserHistory(userId, 5);
    
    // 3. Construir contexto
    const context = {
      core_identity: mancyCore.essence,
      current_mode: this.emotionalState.current_mode,
      memories: relevantMemories,
      recent_interactions: userHistory,
      conflict_acknowledgment: this.emotionalState.conflict_level > 5 ? 
        "(Nota interna: El dilema guerrera/sanadora está activo)" : ""
    };

    return context;
  }

  async getUserHistory(userId, limit = 5) {
    const logs = await this.loadConversationLogs();
    return logs[userId] ? logs[userId].slice(-limit) : [];
  }
}

module.exports = new MancyMemorySystem();
