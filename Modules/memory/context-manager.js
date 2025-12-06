class ContextManager {
    constructor() {
        this.session = {
            id: Date.now(),
            startTime: new Date(),
            messages: [],
            metadata: {
                hasReceivedIntroduction: false,
                introductionTime: null,
                knownTopics: new Set(),
                currentTopic: null,
                topicHistory: []
            }
        };
        
        this.userModel = {
            knowsMancyIdentity: false,
            knowsSoulGarden: false,
            mentionedLuxo: false,
            questionCount: 0,
            lastQuestionType: null
        };
    }
    
    addExchange(userMsg, botMsg) {
        // Extraer intención del usuario
        const userIntent = this.analyzeIntent(userMsg);
        
        // Actualizar modelo de usuario
        this.updateUserModel(userMsg, userIntent);
        
        // Actualizar metadatos de sesión
        this.updateSessionMetadata(userMsg, botMsg);
        
        // Guardar intercambio
        this.session.messages.push({
            user: userMsg,
            bot: botMsg,
            intent: userIntent,
            timestamp: new Date(),
            turn: this.session.messages.length + 1
        });
    }
    
    analyzeIntent(message) {
        const msg = message.toLowerCase();
        const intents = [];
        
        if (msg.includes('cuéntame') || msg.includes('historia')) {
            intents.push('request_introduction');
        }
        if (msg.includes('guerra') || msg.includes('civil')) {
            intents.push('topic_war');
        }
        if (msg.includes('luxo') || msg.includes('galleta')) {
            intents.push('topic_soulgarden');
        }
        if (msg.includes('trabaj') || msg.includes('empleo')) {
            intents.push('topic_work');
        }
        
        return intents.length > 0 ? intents : ['general_chat'];
    }
    
    updateUserModel(message, intents) {
        this.userModel.questionCount++;
        
        if (intents.includes('request_introduction')) {
            this.userModel.knowsMancyIdentity = true;
        }
        
        if (intents.includes('topic_soulgarden')) {
            this.userModel.knowsSoulGarden = true;
            this.userModel.mentionedLuxo = true;
        }
    }
    
    updateSessionMetadata(userMsg, botMsg) {
        // Marcar si la respuesta fue introducción
        if (botMsg.includes('Soy Mancy') || botMsg.includes('tu compañera digital')) {
            this.session.metadata.hasReceivedIntroduction = true;
            this.session.metadata.introductionTime = new Date();
        }
        
        // Extraer temas de la conversación
        const topics = this.extractTopics(userMsg + ' ' + botMsg);
        topics.forEach(topic => {
            this.session.metadata.knownTopics.add(topic);
        });
        
        // Mantener historial de temas
        if (topics.length > 0) {
            this.session.metadata.topicHistory.push({
                topics,
                timestamp: new Date()
            });
        }
    }
    
    extractTopics(text) {
        const topics = [];
        const lowerText = text.toLowerCase();
        
        const topicPatterns = {
            'mancy_identity': ['soy mancy', 'mancy', 'compañera digital'],
            'soulgarden_lore': ['soul garden', 'secretaria de guerra', 'luxo', 'coco'],
            'war_history': ['guerra civil', 'salvadoreña', 'conflicto'],
            'work_experience': ['trabaj', 'empleo', 'experiencia', 'cicih']
        };
        
        for (const [topic, patterns] of Object.entries(topicPatterns)) {
            if (patterns.some(pattern => lowerText.includes(pattern))) {
                topics.push(topic);
            }
        }
        
        return topics;
    }
    
    // MÉTODOS DE CONSULTA CRÍTICOS
    shouldGiveFullIntroduction() {
        // NO dar introducción completa si:
        // 1. Ya se dio antes en esta sesión
        if (this.session.metadata.hasReceivedIntroduction) {
            return false;
        }
        
        // 2. El usuario ya mencionó conocer Soul Garden
        if (this.userModel.knowsSoulGarden) {
            return 'contextual_only';
        }
        
        // 3. Es la primera o segunda pregunta
        return this.userModel.questionCount <= 2;
    }
    
    getContextualBridge() {
        const lastTopics = this.getLastTopics(3);
        
        if (lastTopics.includes('soulgarden_lore')) {
            return "Continuando con lo de Soul Garden... ";
        }
        
        if (lastTopics.includes('war_history')) {
            return "Relacionado con los conflictos que mencionabas... ";
        }
        
        if (lastTopics.includes('work_experience')) {
            return "Sobre mi experiencia laboral... ";
        }
        
        return null;
    }
    
    getLastTopics(count = 3) {
        const allTopics = [];
        this.session.metadata.topicHistory
            .slice(-count)
            .forEach(entry => {
                allTopics.push(...entry.topics);
            });
        return [...new Set(allTopics)];
    }
    
    // Para respuesta específica a "cuéntame tu historia"
    getStoryIntroduction() {
        if (this.userModel.knowsSoulGarden) {
            return "Como Secretaria de Guerra de Soul Garden que mencioné, mi historia comienza...";
        }
        
        if (this.session.metadata.hasReceivedIntroduction) {
            return "Te cuento más sobre mi historia...";
        }
        
        return "¡Vamos a contar una historia! Soy Mancy...";
    }
}

module.exports = ContextManager;
