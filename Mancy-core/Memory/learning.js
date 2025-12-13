// learning_module.js
import fs from 'fs/promises';
import path from 'path';

class ContinuousLearningModule {
    constructor() {
        this.learningFile = './memory/learning_data.json';
        this.conversationPatterns = new Map();
        this.userModels = new Map();
        this.topicChains = new Map(); // Para seguir temas en conversaciones largas
        
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
    
    // ================== APRENDIZAJE DE USUARIO ==================
    
    async learnFromUserInteraction(userId, userMessage, mancyResponse, metadata) {
        try {
            // 1. Aprender patrones del usuario
            await this.learnUserPatterns(userId, userMessage, metadata);
            
            // 2. Extraer conceptos importantes
            const concepts = this.extractConcepts(userMessage);
            await this.learnConcepts(userId, concepts, metadata);
            
            // 3. Aprender estilo de conversación
            await this.learnConversationStyle(userId, userMessage, mancyResponse);
            
            // 4. Construir modelo del usuario
            await this.buildUserModel(userId, userMessage, metadata);
            
            // 5. Guardar periodicamente
            if (Math.random() < 0.1) { // 10% de probabilidad de guardar
                await this.saveLearningData();
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error en aprendizaje:', error);
            return false;
        }
    }
    
    async learnUserPatterns(userId, message, metadata) {
        if (!this.conversationPatterns.has(userId)) {
            this.conversationPatterns.set(userId, {
                message_lengths: [],
                response_times: [],
                common_topics: new Set(),
                emotional_patterns: [],
                question_patterns: []
            });
        }
        
        const patterns = this.conversationPatterns.get(userId);
        
        // Aprender longitud típica de mensajes
        patterns.message_lengths.push(message.length);
        if (patterns.message_lengths.length > 50) {
            patterns.message_lengths.shift();
        }
        
        // Aprender temas comunes
        const topics = this.extractTopics(message);
        topics.forEach(topic => patterns.common_topics.add(topic));
        
        // Aprender patrones emocionales
        if (metadata?.emotionalState) {
            patterns.emotional_patterns.push({
                state: metadata.emotionalState,
                timestamp: new Date().toISOString()
            });
            
            if (patterns.emotional_patterns.length > 100) {
                patterns.emotional_patterns.shift();
            }
        }
        
        // Aprender patrones de preguntas
        if (message.includes('?')) {
            patterns.question_patterns.push({
                type: this.classifyQuestionType(message),
                complexity: message.length > 50 ? 'high' : 'medium'
            });
        }
    }
    
    extractConcepts(message) {
        const concepts = [];
        const lowerMsg = message.toLowerCase();
        
        // Patrones para extraer conceptos importantes
        const patterns = [
            // Hechos personales
            { pattern: /(?:mi|me llamo|soy) (?:llamo )?([A-Z][a-z]+(?: [A-Z][a-z]+)?)/i, type: 'name' },
            { pattern: /(?:tengo|edad) (\d+) años/i, type: 'age' },
            { pattern: /(?:vivo en|soy de) ([^,.!?]+)/i, type: 'location' },
            { pattern: /(?:trabajo como|soy) ([^,.!?]+)/i, type: 'occupation' },
            { pattern: /(?:estudio|curso) ([^,.!?]+)/i, type: 'studies' },
            
            // Preferencias
            { pattern: /(?:me gusta|amo|adoro) ([^,.!?]+)/i, type: 'likes' },
            { pattern: /(?:odio|detesto|no me gusta) ([^,.!?]+)/i, type: 'dislikes' },
            { pattern: /(?:mi favorito|prefiero) ([^,.!?]+)/i, type: 'favorites' },
            
            // Estados y situaciones
            { pattern: /(?:estoy|me siento) ([^,.!?]+)/i, type: 'state' },
            { pattern: /(?:tuve|pasé) ([^,.!?]+)/i, type: 'experience' },
            { pattern: /(?:quiero|deseo) ([^,.!?]+)/i, type: 'desires' },
            { pattern: /(?:tengo|sufro de) ([^,.!?]+)/i, type: 'problems' }
        ];
        
        patterns.forEach(({ pattern, type }) => {
            const match = message.match(pattern);
            if (match && match[1]) {
                concepts.push({
                    content: match[0],
                    type: type,
                    extracted: match[1],
                    confidence: 0.8,
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        return concepts;
    }
    
    async learnConcepts(userId, concepts, metadata) {
        const userData = await this.getUserLearningData(userId);
        
        concepts.forEach(concept => {
            // Verificar si el concepto ya existe
            const existingIndex = userData.concepts.findIndex(
                c => c.type === concept.type && 
                     c.content.includes(concept.extracted.substring(0, 20))
            );
            
            if (existingIndex >= 0) {
                // Actualizar concepto existente
                userData.concepts[existingIndex].confidence += 0.1;
                userData.concepts[existingIndex].last_mentioned = new Date().toISOString();
                userData.concepts[existingIndex].mention_count = 
                    (userData.concepts[existingIndex].mention_count || 1) + 1;
            } else {
                // Añadir nuevo concepto
                userData.concepts.push({
                    ...concept,
                    mention_count: 1,
                    first_mentioned: new Date().toISOString(),
                    last_mentioned: new Date().toISOString(),
                    context: metadata?.context || 'general'
                });
            }
        });
        
        // Mantener solo conceptos más relevantes
        userData.concepts.sort((a, b) => b.confidence - a.confidence);
        if (userData.concepts.length > 50) {
            userData.concepts = userData.concepts.slice(0, 50);
        }
        
        await this.updateUserLearningData(userId, userData);
    }
    
    async learnConversationStyle(userId, userMessage, mancyResponse) {
        const userData = await this.getUserLearningData(userId);
        
        // Aprender preferencias de estilo
        const stylePatterns = {
            formal: /\b(usted|señor|señora|por favor|gracias)\b/i.test(userMessage),
            informal: /\b(hola|hey|bro|jajaja|lol)\b/i.test(userMessage),
            detailed: userMessage.length > 100,
            concise: userMessage.length < 30,
            emotional: this.containsEmotionalWords(userMessage),
            factual: this.containsFactualWords(userMessage)
        };
        
        // Actualizar perfil de estilo
        Object.keys(stylePatterns).forEach(style => {
            if (stylePatterns[style]) {
                userData.preferred_styles = userData.preferred_styles || {};
                userData.preferred_styles[style] = 
                    (userData.preferred_styles[style] || 0) + 1;
            }
        });
        
        // Aprender qué respuestas funcionan mejor
        const responseEffectiveness = this.estimateResponseEffectiveness(userMessage, mancyResponse);
        userData.effective_responses = userData.effective_responses || [];
        userData.effective_responses.push({
            user_message: userMessage.substring(0, 100),
            mancy_response: mancyResponse.substring(0, 100),
            effectiveness: responseEffectiveness,
            timestamp: new Date().toISOString()
        });
        
        // Mantener solo respuestas recientes
        if (userData.effective_responses.length > 20) {
            userData.effective_responses.shift();
        }
        
        await this.updateUserLearningData(userId, userData);
    }
    
    // ================== MODELADO DE USUARIO ==================
    
    async buildUserModel(userId, currentMessage, metadata) {
        const userData = await this.getUserLearningData(userId);
        
        // Construir perfil psicológico básico
        userModel = {
            personality_traits: this.inferPersonalityTraits(userData),
            communication_style: this.inferCommunicationStyle(userData),
            interests: this.extractInterests(userData),
            knowledge_level: this.estimateKnowledgeLevel(userData),
            emotional_patterns: this.analyzeEmotionalPatterns(userData),
            trust_level: this.calculateTrustLevel(userData)
        };
        
        this.userModels.set(userId, userModel);
        
        // Guardar modelo actualizado
        userData.user_model = userModel;
        await this.updateUserLearningData(userId, userData);
        
        return userModel;
    }
    
    inferPersonalityTraits(userData) {
        const traits = {
            openness: 0.5,
            conscientiousness: 0.5,
            extraversion: 0.5,
            agreeableness: 0.5,
            neuroticism: 0.5
        };
        
        // Inferir basado en patrones de conversación
        if (userData.preferred_styles) {
            if (userData.preferred_styles.emotional > 5) traits.openness += 0.2;
            if (userData.preferred_styles.formal > 3) traits.conscientiousness += 0.15;
            if (userData.preferred_styles.informal > 5) traits.extraversion += 0.2;
        }
        
        // Normalizar valores
        Object.keys(traits).forEach(trait => {
            traits[trait] = Math.min(Math.max(traits[trait], 0.1), 0.9);
        });
        
        return traits;
    }
    
    inferCommunicationStyle(userData) {
        const styles = [];
        
        if (userData.preferred_styles) {
            if (userData.preferred_styles.formal > userData.preferred_styles.informal) {
                styles.push('formal');
            } else {
                styles.push('casual');
            }
            
            if (userData.preferred_styles.detailed) styles.push('detailed');
            if (userData.preferred_styles.emotional) styles.push('expressive');
            if (userData.preferred_styles.factual) styles.push('factual');
        }
        
        return styles.length > 0 ? styles : ['balanced'];
    }
    
    // ================== CONVERSACIONES LARGAS ==================
    
    async manageLongConversation(userId, conversationHistory) {
        if (conversationHistory.length < 3) return null;
        
        const topicChain = this.topicChains.get(userId) || {
            current_topic: null,
            topic_depth: 0,
            subtopics: [],
            topic_start_time: null,
            turns_in_topic: 0
        };
        
        // Analizar si hay cambio de tema
        const lastMessages = conversationHistory.slice(-3);
        const topicChange = this.detectTopicChange(lastMessages);
        
        if (topicChange || topicChain.current_topic === null) {
            // Nuevo tema
            const newTopic = this.extractMainTopic(lastMessages[lastMessages.length - 1].user);
            topicChain.current_topic = newTopic;
            topicChain.topic_depth = 1;
            topicChain.subtopics = [newTopic];
            topicChain.topic_start_time = new Date().toISOString();
            topicChain.turns_in_topic = 1;
        } else {
            // Mismo tema, profundizar
            topicChain.turns_in_topic += 1;
            topicChain.topic_depth = Math.min(topicChain.topic_depth + 0.1, 1.0);
            
            // Extraer subtemas
            const newSubtopics = this.extractSubtopics(
                lastMessages[lastMessages.length - 1].user,
                topicChain.current_topic
            );
            
            newSubtopics.forEach(subtopic => {
                if (!topicChain.subtopics.includes(subtopic)) {
                    topicChain.subtopics.push(subtopic);
                }
            });
        }
        
        this.topicChains.set(userId, topicChain);
        
        // Generar contexto para conversación larga
        return this.generateLongConversationContext(topicChain, conversationHistory);
    }
    
    detectTopicChange(messages) {
        if (messages.length < 2) return true;
        
        const topics1 = this.extractTopics(messages[messages.length - 2].user);
        const topics2 = this.extractTopics(messages[messages.length - 1].user);
        
        // Calcular similitud de temas
        const intersection = topics1.filter(topic => topics2.includes(topic));
        const similarity = intersection.length / Math.max(topics1.length, topics2.length);
        
        return similarity < 0.3; // Cambio de tema si similitud < 30%
    }
    
    extractMainTopic(message) {
        const topics = this.extractTopics(message);
        return topics.length > 0 ? topics[0] : 'general';
    }
    
    extractSubtopics(message, mainTopic) {
        const words = message.toLowerCase().split(/\s+/);
        const stopWords = ['el', 'la', 'los', 'las', 'un', 'una', 'de', 'en', 'y', 'que'];
        
        return words
            .filter(word => word.length > 3 && !stopWords.includes(word))
            .slice(0, 3);
    }
    
    generateLongConversationContext(topicChain, conversationHistory) {
        const context = {
            is_long_conversation: topicChain.turns_in_topic > 3,
            current_topic: topicChain.current_topic,
            topic_depth: topicChain.topic_depth,
            subtopics_explored: topicChain.subtopics.slice(0, 3),
            turns_in_topic: topicChain.turns_in_topic,
            suggestions: []
        };
        
        // Sugerencias basadas en profundidad de conversación
        if (topicChain.topic_depth > 0.7) {
            context.suggestions.push('Profundizar en aspectos específicos');
            context.suggestions.push('Hacer preguntas más detalladas');
        }
        
        if (topicChain.turns_in_topic > 5) {
            context.suggestions.push('Considerar cambiar de tema sutilmente');
            context.suggestions.push('Relacionar con temas anteriores');
        }
        
        // Extraer puntos clave de la conversación
        context.key_points = this.extractKeyPoints(conversationHistory.slice(-5));
        
        return context;
    }
    
    extractKeyPoints(messages) {
        const keyPoints = [];
        
        messages.forEach((msg, index) => {
            if (msg.user.length > 30) { // Mensajes significativos
                const sentences = msg.user.split(/[.!?]+/).filter(s => s.trim().length > 0);
                if (sentences.length > 0) {
                    keyPoints.push({
                        point: sentences[0].substring(0, 100) + '...',
                        from_user: true,
                        position: index
                    });
                }
            }
            
            if (msg.mancy && msg.mancy.length > 30) {
                keyPoints.push({
                    point: msg.mancy.substring(0, 100) + '...',
                    from_user: false,
                    position: index
                });
            }
        });
        
        return keyPoints.slice(0, 5); // Solo 5 puntos clave
    }
    
    // ================== PREDICCIÓN Y ADAPTACIÓN ==================
    
    async predictUserNeeds(userId, currentMessage, context) {
        const userData = await this.getUserLearningData(userId);
        const predictions = [];
        
        // Predecir necesidad emocional
        const emotionalPattern = this.predictEmotionalNeed(userData, currentMessage);
        if (emotionalPattern) {
            predictions.push({
                type: 'emotional',
                need: emotionalPattern.need,
                confidence: emotionalPattern.confidence
            });
        }
        
        // Predecir necesidad informativa
        if (this.containsQuestionWords(currentMessage)) {
            predictions.push({
                type: 'informational',
                need: 'answer',
                confidence: 0.8
            });
        }
        
        // Predecir necesidad social
        if (context?.is_long_conversation && context.turns_in_topic > 10) {
            predictions.push({
                type: 'social',
                need: 'variety',
                confidence: 0.6
            });
        }
        
        return predictions;
    }
    
    predictEmotionalNeed(userData, message) {
        const emotionalWords = this.extractEmotionalWords(message);
        
        if (emotionalWords.length === 0) return null;
        
        // Analizar patrones emocionales previos
        const emotionalHistory = userData.emotional_patterns || [];
        const recentEmotions = emotionalHistory.slice(-5);
        
        if (recentEmotions.length > 0) {
            const avgIntensity = recentEmotions.reduce((sum, e) => sum + (e.intensity || 0.5), 0) / recentEmotions.length;
            
            return {
                need: avgIntensity > 0.7 ? 'support' : 'validation',
                confidence: Math.min(avgIntensity, 0.9)
            };
        }
        
        return {
            need: 'attention',
            confidence: 0.5
        };
    }
    
    // ================== FUNCIONES AUXILIARES ==================
    
    classifyQuestionType(message) {
        const lower = message.toLowerCase();
        
        if (lower.startsWith('por qué') || lower.startsWith('porque')) return 'why';
        if (lower.startsWith('cómo') || lower.startsWith('como')) return 'how';
        if (lower.startsWith('qué') || lower.startsWith('que')) return 'what';
        if (lower.startsWith('cuándo') || lower.startsWith('cuando')) return 'when';
        if (lower.startsWith('dónde') || lower.startsWith('donde')) return 'where';
        if (lower.startsWith('quién') || lower.startsWith('quien')) return 'who';
        
        return 'general';
    }
    
    containsEmotionalWords(message) {
        const emotionalWords = [
            'siento', 'emocionado', 'triste', 'feliz', 'preocupado',
            'ansioso', 'molesto', 'frustrado', 'esperanzado', 'nervioso'
        ];
        
        return emotionalWords.some(word => message.toLowerCase().includes(word));
    }
    
    containsFactualWords(message) {
        const factualWords = [
            'datos', 'información', 'hechos', 'estadísticas',
            'cifras', 'números', 'estudio', 'investigación'
        ];
        
        return factualWords.some(word => message.toLowerCase().includes(word));
    }
    
    containsQuestionWords(message) {
        const questionWords = [
            'qué', 'que', 'cómo', 'como', 'por qué', 'porque',
            'cuándo', 'cuando', 'dónde', 'donde', 'quién', 'quien'
        ];
        
        return questionWords.some(word => 
            message.toLowerCase().includes(word + ' ') || 
            message.toLowerCase().includes(word + '?')
        );
    }
    
    extractEmotionalWords(message) {
        const emotionalWords = [
            'alegre', 'triste', 'enojado', 'emocionado', 'preocupado',
            'asustado', 'sorprendido', 'disgustado', 'confundido', 'aburrido'
        ];
        
        return emotionalWords.filter(word => 
            message.toLowerCase().includes(word)
        );
    }
    
    estimateResponseEffectiveness(userMessage, mancyResponse) {
        // Estimación simple de efectividad
        let score = 0.5;
        
        // Respuesta larga para preguntas complejas
        if (userMessage.length > 50 && mancyResponse.length > 100) score += 0.2;
        
        // Respuesta corta para preguntas simples
        if (userMessage.length < 30 && mancyResponse.length < 80) score += 0.1;
        
        // Contiene elementos conversacionales
        if (mancyResponse.includes('?') || mancyResponse.includes('!')) score += 0.1;
        
        // Personalización
        if (mancyResponse.toLowerCase().includes('tú') || 
            mancyResponse.toLowerCase().includes('usted')) {
            score += 0.1;
        }
        
        return Math.min(score, 1.0);
    }
    
    extractTopics(message) {
        const topics = new Set();
        const lowerMsg = message.toLowerCase();
        
        const topicCategories = {
            trabajo: ['trabajo', 'empleo', 'oficina', 'jefe', 'compañeros', 'reunión'],
            estudios: ['estudio', 'universidad', 'escuela', 'examen', 'tarea', 'profesor'],
            familia: ['familia', 'padres', 'hermanos', 'hijos', 'esposo', 'esposa'],
            amigos: ['amigos', 'amigo', 'amiga', 'compañeros', 'colegas'],
            salud: ['salud', 'enfermedad', 'doctor', 'hospital', 'dolor', 'medicina'],
            tecnología: ['computadora', 'teléfono', 'internet', 'app', 'programa', 'software'],
            hobbies: ['música', 'deporte', 'libro', 'película', 'juego', 'arte'],
            emociones: ['feliz', 'triste', 'enojado', 'emocionado', 'preocupado']
        };
        
        Object.entries(topicCategories).forEach(([topic, keywords]) => {
            if (keywords.some(keyword => lowerMsg.includes(keyword))) {
                topics.add(topic);
            }
        });
        
        return Array.from(topics);
    }
    
    // ================== PERSISTENCIA ==================
    
    async getUserLearningData(userId) {
        try {
            const data = await this.loadLearningData();
            return data.user_models[userId] || {
                concepts: [],
                preferred_styles: {},
                effective_responses: [],
                emotional_patterns: [],
                interaction_count: 0,
                last_updated: new Date().toISOString()
            };
        } catch {
            return {
                concepts: [],
                preferred_styles: {},
                effective_responses: [],
                emotional_patterns: [],
                interaction_count: 0,
                last_updated: new Date().toISOString()
            };
        }
    }
    
    async updateUserLearningData(userId, userData) {
        try {
            const data = await this.loadLearningData();
            data.user_models[userId] = userData;
            data.user_models[userId].interaction_count = 
                (data.user_models[userId].interaction_count || 0) + 1;
            data.user_models[userId].last_updated = new Date().toISOString();
            
            await this.saveLearningData(data);
            return true;
        } catch (error) {
            console.error('❌ Error actualizando datos:', error);
            return false;
        }
    }
    
    async loadLearningData() {
        try {
            const data = await fs.readFile(this.learningFile, 'utf8');
            return JSON.parse(data);
        } catch {
            return {
                user_models: {},
                conversation_patterns: {},
                learned_concepts: [],
                topic_relationships: {}
            };
        }
    }
    
    async saveLearningData(customData = null) {
        try {
            const data = customData || {
                user_models: Object.fromEntries(
                    Array.from(this.userModels.entries()).slice(0, 100) // Limitar tamaño
                ),
                conversation_patterns: Object.fromEntries(this.conversationPatterns),
                learned_concepts: this.extractGlobalConcepts(),
                topic_relationships: this.analyzeTopicRelationships(),
                last_saved: new Date().toISOString()
            };
            
            await fs.writeFile(this.learningFile, JSON.stringify(data, null, 2));
            console.log('💾 Datos de aprendizaje guardados');
            return true;
        } catch (error) {
            console.error('❌ Error guardando aprendizaje:', error);
            return false;
        }
    }
    
    extractGlobalConcepts() {
        const allConcepts = [];
        
        for (const [userId, patterns] of this.conversationPatterns.entries()) {
            if (patterns.common_topics) {
                Array.from(patterns.common_topics).forEach(topic => {
                    if (!allConcepts.includes(topic)) {
                        allConcepts.push(topic);
                    }
                });
            }
        }
        
        return allConcepts.slice(0, 50); // Limitar a 50 conceptos globales
    }
    
    analyzeTopicRelationships() {
        const relationships = {};
        
        for (const [userId, patterns] of this.conversationPatterns.entries()) {
            if (patterns.common_topics && patterns.common_topics.size > 1) {
                const topics = Array.from(patterns.common_topics);
                
                for (let i = 0; i < topics.length; i++) {
                    for (let j = i + 1; j < topics.length; j++) {
                        const key = `${topics[i]}-${topics[j]}`;
                        relationships[key] = (relationships[key] || 0) + 1;
                    }
                }
            }
        }
        
        return relationships;
    }
    
    // ================== INTERFAZ PÚBLICA ==================
    
    async processConversation(userId, userMessage, mancyResponse, metadata = {}) {
        // Aprender de esta interacción
        await this.learnFromUserInteraction(userId, userMessage, mancyResponse, metadata);
        
        // Gestionar conversación larga
        const userHistory = await this.getUserConversationHistory(userId);
        const longConvContext = await this.manageLongConversation(userId, userHistory);
        
        // Predecir necesidades futuras
        const predictions = await this.predictUserNeeds(userId, userMessage, longConvContext);
        
        return {
            learned: true,
            long_conversation_context: longConvContext,
            predictions: predictions,
            user_model: this.userModels.get(userId)
        };
    }
    
    async getUserConversationHistory(userId) {
        try {
            // Esto debería integrarse con tu sistema de memoria existente
            // Por ahora, devuelve un array vacío
            return [];
        } catch {
            return [];
        }
    }
    
    async getContextForResponse(userId, currentMessage) {
        const userData = await this.getUserLearningData(userId);
        const userModel = this.userModels.get(userId);
        const longConvContext = await this.manageLongConversation(
            userId, 
            await this.getUserConversationHistory(userId)
        );
        
        return {
            user_model: userModel,
            learned_concepts: userData.concepts?.slice(0, 5) || [],
            preferred_style: this.getPreferredStyle(userData),
            long_conversation: longConvContext,
            suggestions: this.generateResponseSuggestions(userData, currentMessage)
        };
    }
    
    getPreferredStyle(userData) {
        if (!userData.preferred_styles) return 'balanced';
        
        const styles = Object.entries(userData.preferred_styles);
        if (styles.length === 0) return 'balanced';
        
        styles.sort((a, b) => b[1] - a[1]);
        return styles[0][0];
    }
    
    generateResponseSuggestions(userData, currentMessage) {
        const suggestions = [];
        
        // Sugerir personalización basada en conceptos aprendidos
        if (userData.concepts && userData.concepts.length > 0) {
            const relevantConcepts = userData.concepts
                .filter(c => c.confidence > 0.7)
                .slice(0, 2);
            
            if (relevantConcepts.length > 0) {
                suggestions.push({
                    type: 'personalization',
                    concepts: relevantConcepts.map(c => ({
                        type: c.type,
                        content: c.content.substring(0, 50)
                    }))
                });
            }
        }
        
        // Sugerir estilo basado en preferencias
        const preferredStyle = this.getPreferredStyle(userData);
        if (preferredStyle !== 'balanced') {
            suggestions.push({
                type: 'style_adjustment',
                style: preferredStyle
            });
        }
        
        return suggestions;
    }
}

export default ContinuousLearningModule;
