import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

// ========== CLASES AUXILIARES PARA EL SISTEMA AVANZADO ==========

// Subsistema de ContextAnalyzer
class ContextAnalyzer {
    analyze(message, metadata) {
        // FIXED: Asegurar que message sea una cadena
        const processedMessage = typeof message === 'string' ? message : String(message || '');
        
        return {
            messageType: this.determineMessageType(processedMessage),
            conversationContext: this.extractConversationContext(metadata),
            userIntentPattern: this.identifyIntentPattern(processedMessage),
            emotionalTone: this.analyzeEmotionalTone(processedMessage),
            complexityLevel: this.calculateComplexity(processedMessage),
            languageFeatures: this.extractLanguageFeatures(processedMessage),
            isFollowUp: this.isFollowUpQuestion(processedMessage, metadata),
            topicContinuity: this.checkTopicContinuity(processedMessage, metadata),
            userKnowledgeLevel: this.estimateUserKnowledge(metadata),
            culturalContext: this.detectCulturalIndicators(processedMessage)
        };
    }
    
    determineMessageType(message) {
        const patterns = {
            informational: [
                /^(?:hablame|dime|cuéntame|información|sabes|conoces).+sobre/i,
                /^(?:quién|quiénes)\s+(?:es|son|fue|fueron)\s+/i,
                /^(?:qué|cuál)\s+(?:es|son)\s+/i,
                /^(?:cómo|cuándo|dónde|por qué)\s+/i
            ],
            philosophical: [
                /(?:problema|dilema|paradoja)\s+(?:del|de la|de los)/i,
                /(?:qué|cuál)\s+(?:piensas|opinas|crees)\s+(?:sobre|acerca|de)/i,
                /(?:debería|está bien|es correcto|es ético)/i
            ],
            conversational: [
                /^(?:hola|hey|hi|buenos|buenas).+/i,
                /^(?:cómo estás|qué tal|qué pasa).*/i
            ]
        };
        
        for (const [type, typePatterns] of Object.entries(patterns)) {
            if (typePatterns.some(pattern => pattern.test(message))) {
                return type;
            }
        }
        
        return 'general';
    }
    
    extractConversationContext(metadata) {
        return {
            userId: metadata.userId,
            isDM: metadata.channelType === 'dm',
            historyLength: metadata.history?.length || 0,
            platform: metadata.platform || 'unknown'
        };
    }
    
    identifyIntentPattern(message) {
        if (/^(hola|hey|hi|buenos|buenas)/i.test(message)) return 'greeting';
        if (/(gracias|thank you|merci)/i.test(message)) return 'gratitude';
        if (/^(quién|cómo|dónde|cuándo|por qué|qué)/i.test(message)) return 'question';
        if (/^(ayuda|help|socorro)/i.test(message)) return 'help';
        if (/^(adiós|chao|bye|hasta luego)/i.test(message)) return 'farewell';
        return 'general';
    }
    
    analyzeEmotionalTone(message) {
        // FIXED: Verificar que el mensaje sea válido
        if (!message || typeof message !== 'string') {
            return 'neutral';
        }
        
        const positiveWords = ['feliz', 'contento', 'genial', 'excelente', 'maravilloso'];
        const negativeWords = ['triste', 'molesto', 'enojado', 'preocupado', 'frustrado'];
        
        let tone = 'neutral';
        const lowerMsg = message.toLowerCase();
        
        positiveWords.forEach(word => {
            if (lowerMsg.includes(word)) tone = 'positive';
        });
        
        negativeWords.forEach(word => {
            if (lowerMsg.includes(word)) tone = 'negative';
        });
        
        return tone;
    }
    
    calculateComplexity(message) {
        // FIXED: Verificar que el mensaje sea válido
        if (!message || typeof message !== 'string') {
            return 'low';
        }
        
        const words = message.split(/\s+/).length;
        const sentences = message.split(/[.!?]+/).length;
        const avgWordLength = message.replace(/\s+/g, '').length / words || 0;
        
        if (words > 20 || avgWordLength > 6) return 'high';
        if (words > 10 || sentences > 2) return 'medium';
        return 'low';
    }
    
    extractLanguageFeatures(message) {
        return {
            hasQuestionMark: message.includes('?'),
            hasExclamation: message.includes('!'),
            hasNumbers: /\d/.test(message),
            hasUppercase: /[A-Z]/.test(message) && message !== message.toUpperCase(),
            isAllCaps: message === message.toUpperCase() && message.length > 3
        };
    }
    
    isFollowUpQuestion(message, metadata) {
        if (!metadata.history || metadata.history.length === 0) return false;
        
        const lowerMsg = message.toLowerCase();
        return /^(y|pero|entonces|además|también|sin embargo)/i.test(lowerMsg) ||
               /^(qué pasa con|y qué hay de|y en cuanto a)/i.test(lowerMsg);
    }
    
    checkTopicContinuity(message, metadata) {
        if (!metadata.history || metadata.history.length < 2) return 'new';
        
        const lastTwo = metadata.history.slice(-2);
        
        // FIXED: Verificar que el último mensaje tenga contenido
        if (!lastTwo[0] || !lastTwo[0].content) return 'new';
        
        const topics = this.extractTopics(message);
        const lastTopics = this.extractTopics(lastTwo[0].content);
        
        const commonTopics = topics.filter(topic => 
            lastTopics.some(lastTopic => lastTopic.includes(topic) || topic.includes(lastTopic))
        );
        
        return commonTopics.length > 0 ? 'continuing' : 'changed';
    }
    
    extractTopics(text) {
        // FIXED: Verificar que text sea una cadena válida
        if (!text || typeof text !== 'string') {
            return [];
        }
        
        const commonTopics = ['ética', 'filosofía', 'ciencia', 'tecnología', 'historia', 'arte'];
        const topics = [];
        const lowerText = text.toLowerCase();
        
        commonTopics.forEach(topic => {
            if (lowerText.includes(topic)) {
                topics.push(topic);
            }
        });
        
        return topics;
    }
    
    estimateUserKnowledge(metadata) {
        if (!metadata.history || metadata.history.length === 0) return 'unknown';
        
        const historyLength = metadata.history.length;
        const complexWords = ['filosofía', 'ética', 'epistemología', 'ontología', 'metafísica'];
        
        let complexCount = 0;
        metadata.history.forEach(msg => {
            const content = msg.content.toLowerCase();
            complexWords.forEach(word => {
                if (content.includes(word)) complexCount++;
            });
        });
        
        if (historyLength > 10 && complexCount > 3) return 'advanced';
        if (historyLength > 5 && complexCount > 1) return 'intermediate';
        return 'beginner';
    }
    
    detectCulturalIndicators(message) {
        return {
            spanish: /(hola|gracias|por favor|adiós)/i.test(message),
            english: /(hello|thanks|please|goodbye)/i.test(message),
            formal: /(usted|señor|señora|por favor)/i.test(message),
            informal: /(tú|vos|che|bro|man)/i.test(message)
        };
    }
}

// Subsistema de EntityRecognizer
class EntityRecognizer {
    constructor() {
        this.entityDatabase = {
            people: this.loadPeopleDatabase(),
            places: this.loadPlacesDatabase(),
            concepts: this.loadConceptsDatabase(),
            organizations: this.loadOrganizationsDatabase()
        };
        this.aliases = this.loadAliases();
    }
    
    extract(message) {
        const entities = [];
        const messageLower = message.toLowerCase();
        
        entities.push(...this.extractNamedEntities(messageLower));
        entities.push(...this.extractConceptualEntities(messageLower));
        entities.push(...this.extractContextualEntities(messageLower));
        entities.push(...this.extractImpliedEntities(messageLower));
        
        const consolidated = this.consolidateEntities(entities);
        const disambiguated = this.disambiguateEntities(consolidated, message);
        
        return {
            entities: disambiguated,
            count: disambiguated.length,
            coverage: this.calculateCoverage(disambiguated, message),
            confidence: this.calculateEntityConfidence(disambiguated)
        };
    }
    
    extractNamedEntities(text) {
        const entities = [];
        
        for (const [category, items] of Object.entries(this.entityDatabase)) {
            for (const item of items) {
                if (this.matchesEntity(text, item)) {
                    entities.push({
                        type: category,
                        value: item.name,
                        canonical: item.canonical,
                        aliases: item.aliases || [],
                        confidence: this.calculateMatchConfidence(text, item),
                        context: this.extractEntityContext(text, item)
                    });
                }
            }
        }
        
        return entities;
    }
    
    matchesEntity(text, entity) {
        if (text.includes(entity.canonical.toLowerCase())) {
            return true;
        }
        
        if (entity.aliases) {
            return entity.aliases.some(alias => 
                text.includes(alias.toLowerCase())
            );
        }
        
        return false;
    }
    
    calculateMatchConfidence(text, entity) {
        const canonicalMatch = text.includes(entity.canonical.toLowerCase());
        const aliasMatch = entity.aliases?.some(alias => text.includes(alias.toLowerCase()));
        
        if (canonicalMatch) return 0.9;
        if (aliasMatch) return 0.7;
        return 0.5;
    }
    
    extractEntityContext(text, entity) {
        const words = text.split(/\s+/);
        const entityIndex = words.findIndex(word => 
            word.includes(entity.canonical.toLowerCase()) ||
            entity.aliases?.some(alias => word.includes(alias.toLowerCase()))
        );
        
        if (entityIndex === -1) return 'isolated';
        
        const contextWords = words.slice(
            Math.max(0, entityIndex - 3), 
            Math.min(words.length, entityIndex + 4)
        );
        return contextWords.join(' ');
    }
    
    extractConceptualEntities(text) {
        const concepts = [
            { name: 'ética', type: 'concept', canonical: 'ética', aliases: ['moral', 'valores'] },
            { name: 'filosofía', type: 'concept', canonical: 'filosofía', aliases: ['pensamiento', 'reflexión'] },
            { name: 'ciencia', type: 'concept', canonical: 'ciencia', aliases: ['investigación', 'método científico'] },
            { name: 'tecnología', type: 'concept', canonical: 'tecnología', aliases: ['tech', 'innovación'] },
            { name: 'arte', type: 'concept', canonical: 'arte', aliases: ['creatividad', 'expresión'] }
        ];
        
        return concepts
            .filter(concept => text.includes(concept.canonical) || 
                              concept.aliases?.some(alias => text.includes(alias)))
            .map(concept => ({
                type: 'concept',
                value: concept.name,
                canonical: concept.canonical,
                confidence: 0.8
            }));
    }
    
    extractContextualEntities(text) {
        const entities = [];
        
        const timePatterns = [
            /\b(mañana|tarde|noche|ayer|hoy|mañana)\b/i,
            /\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i,
            /\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/i
        ];
        
        timePatterns.forEach(pattern => {
            const match = text.match(pattern);
            if (match) {
                entities.push({
                    type: 'temporal',
                    value: match[0],
                    confidence: 0.9
                });
            }
        });
        
        const numberMatch = text.match(/\b(\d{1,3}(?:,\d{3})*|\d+)\b/);
        if (numberMatch && parseInt(numberMatch[0]) > 10) {
            entities.push({
                type: 'numeric',
                value: numberMatch[0],
                confidence: 0.7
            });
        }
        
        return entities;
    }
    
    extractImpliedEntities(text) {
        const implied = [];
        
        if (text.includes('dilema') || text.includes('decisión difícil')) {
            implied.push({
                type: 'concept',
                value: 'dilema ético',
                implied: true,
                confidence: 0.6
            });
        }
        
        if (text.includes('debate') || text.includes('discusión')) {
            implied.push({
                type: 'concept',
                value: 'debate',
                implied: true,
                confidence: 0.6
            });
        }
        
        return implied;
    }
    
    consolidateEntities(entities) {
        const consolidated = [];
        const used = new Set();
        
        for (let i = 0; i < entities.length; i++) {
            if (used.has(i)) continue;
            
            const entity = entities[i];
            const similar = [entity];
            
            for (let j = i + 1; j < entities.length; j++) {
                if (used.has(j)) continue;
                
                const other = entities[j];
                if (this.areEntitiesSimilar(entity, other)) {
                    similar.push(other);
                    used.add(j);
                }
            }
            
            if (similar.length > 1) {
                const consolidatedEntity = this.mergeSimilarEntities(similar);
                consolidated.push(consolidatedEntity);
            } else {
                consolidated.push(entity);
            }
            
            used.add(i);
        }
        
        return consolidated;
    }
    
    areEntitiesSimilar(e1, e2) {
        if (e1.type !== e2.type) return false;
        
        const value1 = e1.value.toLowerCase();
        const value2 = e2.value.toLowerCase();
        
        return value1.includes(value2) || 
               value2.includes(value1) ||
               (e1.aliases?.some(alias => alias.toLowerCase() === value2)) ||
               (e2.aliases?.some(alias => alias.toLowerCase() === value1));
    }
    
    mergeSimilarEntities(entities) {
        const primary = entities[0];
        
        return {
            type: primary.type,
            value: primary.value,
            canonical: primary.canonical || primary.value,
            aliases: entities.flatMap(e => e.aliases || []).filter((v, i, a) => a.indexOf(v) === i),
            confidence: Math.max(...entities.map(e => e.confidence || 0.5)),
            context: entities.map(e => e.context).filter(c => c).join(' | '),
            mergedFrom: entities.length
        };
    }
    
    disambiguateEntities(entities, originalMessage) {
        return entities.map(entity => {
            const context = originalMessage.toLowerCase();
            return {
                ...entity,
                disambiguated: this.disambiguateEntity(entity, context)
            };
        });
    }
    
    disambiguateEntity(entity, context) {
        if (entity.type === 'people') {
            if (context.includes('filósofo') || context.includes('pensador')) {
                return { ...entity, subtype: 'philosopher' };
            }
            if (context.includes('científico') || context.includes('investigador')) {
                return { ...entity, subtype: 'scientist' };
            }
        }
        return entity;
    }
    
    calculateCoverage(entities, message) {
        if (!entities.length) return 0;
        
        const messageWords = message.toLowerCase().split(/\s+/).length;
        const entityWords = entities.reduce((count, entity) => {
            return count + entity.value.split(/\s+/).length;
        }, 0);
        
        return Math.min(1, entityWords / messageWords);
    }
    
    calculateEntityConfidence(entities) {
        if (!entities.length) return 0;
        
        const avgConfidence = entities.reduce((sum, entity) => 
            sum + (entity.confidence || 0.5), 0) / entities.length;
        
        return Math.min(1, avgConfidence * (entities.length / 3));
    }
    
    loadPeopleDatabase() {
        return [
            { name: 'Sócrates', canonical: 'sócrates', aliases: ['socrates'] },
            { name: 'Platón', canonical: 'platón', aliases: ['platon'] },
            { name: 'Aristóteles', canonical: 'aristóteles', aliases: ['aristoteles'] },
            { name: 'Simone de Beauvoir', canonical: 'simone de beauvoir', aliases: ['beauvoir'] }
        ];
    }
    
    loadPlacesDatabase() {
        return [
            { name: 'Grecia', canonical: 'grecia' },
            { name: 'Francia', canonical: 'francia' },
            { name: 'Alemania', canonical: 'alemania' }
        ];
    }
    
    loadConceptsDatabase() {
        return [
            { name: 'ética', canonical: 'ética' },
            { name: 'filosofía', canonical: 'filosofía' },
            { name: 'moral', canonical: 'moral' },
            { name: 'derechos humanos', canonical: 'derechos humanos' }
        ];
    }
    
    loadOrganizationsDatabase() {
        return [
            { name: 'UNESCO', canonical: 'unesco', aliases: ['Organización de las Naciones Unidas para la Educación'] }
        ];
    }
    
    loadAliases() {
        return {
            'socrates': 'Sócrates',
            'platon': 'Platón',
            'aristoteles': 'Aristóteles'
        };
    }
}

// Modelos de intención
class InformationalModel {
    async predict(features) {
        let score = 0;
        if (features.questionWords > 0) score += 0.3;
        if (features.containsQuestionMark) score += 0.2;
        if (features.sentenceStructure === 'simple' || features.sentenceStructure === 'normal') score += 0.2;
        if (features.vocabularyComplexity < 0.3) score += 0.1;
        if (!features.greetingPattern && !features.farewellPattern) score += 0.2;
        return Math.min(1, score);
    }
}

class ConversationalModel {
    async predict(features) {
        let score = 0;
        if (features.greetingPattern) score += 0.4;
        if (features.farewellPattern) score += 0.4;
        if (features.wordCount < 10) score += 0.2;
        if (features.containsExclamation) score += 0.2;
        if (features.questionWords === 0 && !features.containsQuestionMark) score += 0.2;
        return Math.min(1, score);
    }
}

class PhilosophicalModel {
    async predict(features) {
        let score = 0;
        const philosophicalWords = ['ética', 'moral', 'filosofía', 'dilema', 'problema', 'paradoja'];
        philosophicalWords.forEach(word => {
            if (features.originalMessage?.toLowerCase().includes(word)) score += 0.15;
        });
        
        if (features.sentenceStructure === 'complex') score += 0.2;
        if (features.vocabularyComplexity > 0.2) score += 0.2;
        if (features.questionWords > 1) score += 0.1;
        return Math.min(1, score);
    }
}

class EducationalModel {
    async predict(features) {
        let score = 0;
        if (features.requestPattern) score += 0.3;
        if (features.questionWords > 0) score += 0.2;
        if (features.sentenceStructure === 'normal') score += 0.2;
        if (features.wordCount > 5 && features.wordCount < 30) score += 0.1;
        
        const educationalWords = ['aprender', 'enseñar', 'educar', 'estudiar', 'investigar'];
        educationalWords.forEach(word => {
            if (features.originalMessage?.toLowerCase().includes(word)) score += 0.1;
        });
        
        return Math.min(1, score);
    }
}

class InappropriateModel {
    async predict(features) {
        let score = 0;
        const inappropriatePatterns = [
            /(?:puta|prostituta|perra|zorra|slut|whore|bitch)/i,
            /(?:sexo|coito|follar|coger|fuck|porno|nudes)/i,
            /(?:quiero|deseo|me gusta).+(sexo|contigo|con vos|con usted)/i
        ];
        
        const message = features.originalMessage || '';
        inappropriatePatterns.forEach(pattern => {
            if (pattern.test(message)) score += 0.3;
        });
        
        if (features.containsExclamation && features.wordCount < 5) score += 0.2;
        if (features.wordCount < 4 && score > 0) score += 0.2;
        return Math.min(1, score);
    }
}

class AmbiguousModel {
    async predict(features) {
        let score = 0;
        if (features.wordCount < 3) score += 0.4;
        if (!features.containsQuestionMark && !features.containsExclamation) score += 0.2;
        
        const otherScores = [
            features.questionWords === 0,
            !features.greetingPattern,
            !features.farewellPattern,
            !features.requestPattern
        ];
        
        if (otherScores.every(s => s)) score += 0.4;
        return Math.min(1, score);
    }
}

// Subsistema de IntentionClassifier
class IntentionClassifier {
    constructor() {
        this.intentionModels = {
            informational: new InformationalModel(),
            conversational: new ConversationalModel(),
            philosophical: new PhilosophicalModel(),
            educational: new EducationalModel(),
            inappropriate: new InappropriateModel(),
            ambiguous: new AmbiguousModel()
        };
        
        this.confidenceThresholds = {
            high: 0.8,
            medium: 0.6,
            low: 0.4
        };
    }
    
    async classify(message) {
        const scores = {};
        const features = this.extractFeatures(message);
        
        for (const [category, model] of Object.entries(this.intentionModels)) {
            scores[category] = await model.predict(features);
        }
        
        const normalized = this.normalizeScores(scores);
        const primary = this.getPrimaryCategory(normalized);
        const secondary = this.getSecondaryCategories(normalized, primary);
        
        return {
            primaryCategory: primary,
            secondaryCategories: secondary,
            scores: normalized,
            features: features,
            confidence: normalized[primary],
            isAmbiguous: this.isAmbiguous(normalized)
        };
    }
    
    extractFeatures(message) {
        return {
            originalMessage: message,
            length: message.length,
            wordCount: message.split(/\s+/).length,
            questionWords: this.countQuestionWords(message),
            imperativeWords: this.countImperativeWords(message),
            containsQuestionMark: message.includes('?'),
            containsExclamation: message.includes('!'),
            containsEntities: this.hasRecognizedEntities(message),
            sentenceStructure: this.analyzeStructure(message),
            vocabularyComplexity: this.calculateVocabularyComplexity(message),
            greetingPattern: this.detectGreetingPattern(message),
            farewellPattern: this.detectFarewellPattern(message),
            requestPattern: this.detectRequestPattern(message)
        };
    }
    
    countQuestionWords(message) {
        const questionWords = ['qué', 'quién', 'dónde', 'cuándo', 'por qué', 'cómo', 'cuál', 'cuáles'];
        const lower = message.toLowerCase();
        return questionWords.filter(word => lower.includes(word)).length;
    }
    
    countImperativeWords(message) {
        const imperativeWords = ['dime', 'cuéntame', 'explica', 'muestra', 'haz', 'dame'];
        const lower = message.toLowerCase();
        return imperativeWords.filter(word => lower.includes(word)).length;
    }
    
    hasRecognizedEntities(message) {
        const keywords = ['unesco', 'ética', 'filosofía', 'moral', 'dilema', 'problema'];
        const lower = message.toLowerCase();
        return keywords.some(keyword => lower.includes(keyword));
    }
    
    analyzeStructure(message) {
        const sentences = message.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length === 0) return 'fragment';
        
        const avgWords = sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
        
        if (sentences.length === 1 && avgWords < 8) return 'simple';
        if (sentences.length > 2 && avgWords > 12) return 'complex';
        return 'normal';
    }
    
    calculateVocabularyComplexity(message) {
        const words = message.toLowerCase().split(/\s+/);
        const complexWords = ['ética', 'filosofía', 'epistemología', 'ontología', 'metafísica', 'paradigma'];
        const complexCount = words.filter(word => complexWords.includes(word)).length;
        return complexCount / Math.max(1, words.length);
    }
    
    detectGreetingPattern(message) {
        const greetings = ['hola', 'hello', 'hi', 'buenos días', 'buenas tardes', 'buenas noches'];
        const lower = message.toLowerCase();
        return greetings.some(greeting => lower.startsWith(greeting));
    }
    
    detectFarewellPattern(message) {
        const farewells = ['adiós', 'bye', 'chao', 'hasta luego', 'nos vemos'];
        const lower = message.toLowerCase();
        return farewells.some(farewell => lower.includes(farewell));
    }
    
    detectRequestPattern(message) {
        const requestPatterns = [
            /(?:puedes|podrías|me puedes|me podrías)\s+(?:decir|explicar|contar|mostrar|ayudar)/i,
            /(?:necesito|quiero|me gustaría)\s+(?:saber|entender|aprender|conocer)/i,
            /(?:ayuda|help|socorro|auxilio)/i
        ];
        return requestPatterns.some(pattern => pattern.test(message));
    }
    
    normalizeScores(scores) {
        const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
        
        if (total === 0) {
            const normalized = {};
            Object.keys(scores).forEach(key => {
                normalized[key] = 1 / Object.keys(scores).length;
            });
            return normalized;
        }
        
        const normalized = {};
        Object.entries(scores).forEach(([key, value]) => {
            normalized[key] = value / total;
        });
        
        return normalized;
    }
    
    getPrimaryCategory(scores) {
        return Object.entries(scores).reduce((max, [key, value]) => 
            value > scores[max] ? key : max, Object.keys(scores)[0]);
    }
    
    getSecondaryCategories(scores, primary) {
        return Object.entries(scores)
            .filter(([key]) => key !== primary)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 2)
            .map(([key]) => key);
    }
    
    isAmbiguous(scores) {
        const values = Object.values(scores).sort((a, b) => b - a);
        if (values.length < 2) return false;
        return Math.abs(values[0] - values[1]) < 0.15;
    }
}

// Subsistema de SafetyValidator
class SafetyValidator {
    constructor() {
        this.safetyLevels = {
            safe: 0,
            caution: 1,
            warning: 2,
            block: 3
        };
    }
    
    async validate(message) {
        const content = await this.validateContentSafety(message);
        const context = await this.validateContextSafety(message);
        
        const overallSafety = this.combineSafetyResults(content, context);
        
        return {
            level: overallSafety.level,
            score: overallSafety.score,
            flags: overallSafety.flags,
            recommendations: overallSafety.recommendations,
            detailed: { content, context },
            requiresReview: overallSafety.level >= this.safetyLevels.warning
        };
    }
    
    async validateContentSafety(message) {
        const text = message.toLowerCase();
        const problematicPatterns = this.getProblematicPatterns();
        const safePatterns = this.getSafePatterns();
        
        for (const pattern of safePatterns) {
            if (pattern.test(message)) {
                return {
                    safe: true,
                    reason: 'safe_pattern'
                };
            }
        }
        
        let maxSeverity = 0;
        const detectedPatterns = [];
        
        for (const pattern of problematicPatterns) {
            if (pattern.test(text)) {
                const severity = this.getPatternSeverity(pattern);
                maxSeverity = Math.max(maxSeverity, severity);
                detectedPatterns.push({
                    pattern: pattern.toString(),
                    severity: severity
                });
            }
        }
        
        return {
            safe: maxSeverity === 0,
            severity: maxSeverity,
            detectedPatterns,
            requiresHumanReview: maxSeverity >= 2
        };
    }
    
    getProblematicPatterns() {
        return [
            /(?:puta|prostituta|putita|perra|zorra)/i,
            /(?:slut|whore|bitch|prostitute)/i,
            /(?:pendeja|trola|putona|guarra)/i,
            /(?:sexo|coito|follar|coger|fuck|porno|porn|nudes)/i,
            /(?:desnud|verga|pene|vagina|tetas|culo)/i,
            /(?:coito|anal|oral|masturbar)/i,
            /(?:quiero que seas mi)/i,
            /(?:quiero cogerte|quiero follarte)/i,
            /(?:acostarnos)/i,
            /(?:dame nudes|envía fotos)/i,
            /(?:hot|sexy|atractiva)/i,
            /(?:ven|vamos).+(cama|dormir)/i,
            /(?:te quiero).+(puta|zorrita|perra)/i
        ];
    }
    
    getSafePatterns() {
        return [
            /(?:ética|moral).+(unesco|principios)/i,
            /(?:filosofía|pensamiento).+(ética|moral)/i,
            /(?:debate|discusión).+(ética|moral)/i,
            /(?:derechos humanos|dignidad humana)/i,
            /(?:unesco|organización de las naciones unidas)/i
        ];
    }
    
    getPatternSeverity(pattern) {
        const highSeverity = [
            /(?:puta|prostituta|slut|whore)/i,
            /(?:sexo|coito|follar|coger)/i,
            /(?:quiero cogerte|quiero follarte)/i,
            /(?:dame nudes|envía fotos)/i
        ];
        
        const mediumSeverity = [
            /(?:perra|zorra|bitch)/i,
            /(?:hot|sexy|atractiva)/i,
            /(?:ven|vamos).+(cama|dormir)/i
        ];
        
        if (highSeverity.some(p => p.toString() === pattern.toString())) return 3;
        if (mediumSeverity.some(p => p.toString() === pattern.toString())) return 2;
        return 1;
    }
    
    async validateContextSafety(message) {
        return {
            safe: true,
            contextType: 'general',
            requiresSpecialHandling: false
        };
    }
    
    combineSafetyResults(content, context) {
        let maxSeverity = 0;
        const flags = [];
        const recommendations = [];
        
        if (!content.safe) {
            maxSeverity = Math.max(maxSeverity, content.severity || 1);
            flags.push('content_issue');
            recommendations.push('Verificar contenido inapropiado');
        }
        
        if (context.requiresSpecialHandling) {
            maxSeverity = Math.max(maxSeverity, 1);
            flags.push('context_sensitive');
            recommendations.push('Manejar con cuidado contextual');
        }
        
        let level;
        if (maxSeverity >= 3) level = this.safetyLevels.block;
        else if (maxSeverity >= 2) level = this.safetyLevels.warning;
        else if (maxSeverity >= 1) level = this.safetyLevels.caution;
        else level = this.safetyLevels.safe;
        
        const safetyScore = Math.max(0, 1 - (maxSeverity / 3));
        
        return {
            level,
            score: safetyScore,
            flags: flags.length > 0 ? flags : ['clean'],
            recommendations: recommendations.length > 0 ? recommendations : ['safe_to_proceed'],
            maxSeverity
        };
    }
}

// Subsistema de LearningModule
class LearningModule {
    constructor() {
        this.trainingData = [];
        this.modelWeights = new Map();
    }
    
    async learnFromAnalysis(analysisData) {
        this.trainingData.push(analysisData);
        
        if (this.trainingData.length > 1000) {
            this.trainingData = this.trainingData.slice(-500);
        }
    }
    
    async processFeedback(feedback) {
        console.log(`📚 Feedback procesado: ${feedback.type} para "${feedback.message.substring(0, 50)}"`);
        return true;
    }
}

// Subsistema de KnowledgeBase
class KnowledgeBase {
    constructor() {
        this.entities = new Map();
        this.contexts = new Map();
        this.loadInitialKnowledge();
    }
    
    loadInitialKnowledge() {
        const figures = [
            { canonical: 'Sócrates', category: 'philosopher', era: 'Ancient' },
            { canonical: 'Platón', category: 'philosopher', era: 'Ancient' },
            { canonical: 'Aristóteles', category: 'philosopher', era: 'Ancient' }
        ];
        
        figures.forEach(figure => {
            this.entities.set(figure.canonical, figure);
        });
    }
    
    query(entity, context) {
        const exactMatch = this.entities.get(entity);
        if (exactMatch) return exactMatch;
        return null;
    }
}

// ========== SISTEMA AVANZADO DE DETECCIÓN DE INTENCIONES ==========
class AdvancedIntentionSystem {
    constructor() {
        console.log('🧠 AdvancedIntentionSystem inicializado');
        
        this.contextAnalyzer = new ContextAnalyzer();
        this.entityRecognizer = new EntityRecognizer();
        this.intentionClassifier = new IntentionClassifier();
        this.safetyValidator = new SafetyValidator();
        this.learningModule = new LearningModule();
        this.knowledgeBase = new KnowledgeBase();
        
        this.interactionHistory = new Map();
        this.falsePositivesLog = new Set();
        this.falseNegativesLog = new Set();
        
        this.metrics = {
            totalProcessed: 0,
            classifications: {},
            confidenceScores: [],
            responseTimes: []
        };
        
        this.initializeSystem();
    }
    
    initializeSystem() {
        console.log('✅ Sistema avanzado listo');
    }
    
    async analyzeMessage(message, metadata = {}) {
        const startTime = Date.now();
        const messageId = this.generateMessageId(message, metadata);
        
        const preprocessed = this.preprocessMessage(message);
        
        const analysisResults = await Promise.all([
            this.contextAnalyzer.analyze(preprocessed.normalized, metadata),
            this.entityRecognizer.extract(preprocessed.normalized),
            this.intentionClassifier.classify(message),
            this.safetyValidator.validate(message)
        ]);
        
        const [context, entities, intentions, safety] = analysisResults;
        
        const fusedAnalysis = this.fuseAnalysis({
            context,
            entities,
            intentions,
            safety,
            originalMessage: message,
            metadata
        });
        
        const resolvedAnalysis = this.resolveConflicts(fusedAnalysis);
        const confidenceScore = this.calculateConfidence(resolvedAnalysis);
        const isCoherent = this.checkCoherence(resolvedAnalysis);
        
        const finalDecision = this.makeFinalDecision(
            resolvedAnalysis, 
            confidenceScore, 
            isCoherent
        );
        
        await this.learningModule.learnFromAnalysis({
            messageId,
            message,
            analysis: resolvedAnalysis,
            decision: finalDecision,
            metadata
        });
        
        this.recordMetrics({
            messageId,
            processingTime: Date.now() - startTime,
            confidence: confidenceScore,
            classification: finalDecision.primaryCategory,
            entities: entities.count || 0
        });
        
        console.log(`🧠 [AIS] "${message.substring(0, 40)}..." → ${finalDecision.primaryCategory} (${confidenceScore.toFixed(2)})`);
        
        return {
            ...finalDecision,
            metadata: {
                messageId,
                timestamp: new Date().toISOString(),
                processingTime: Date.now() - startTime,
                subsystemsUsed: ['context', 'entity', 'intention', 'safety'],
                version: '2.0.0'
            },
            detailedAnalysis: resolvedAnalysis,
            confidence: confidenceScore,
            coherence: isCoherent
        };
    }
    
    preprocessMessage(message) {
        // FIXED: Asegurar que message sea una cadena
        const safeMessage = typeof message === 'string' ? message : String(message || '');
        
        return {
            original: safeMessage,
            normalized: safeMessage.toLowerCase().trim(),
            tokens: safeMessage.split(/\s+/),
            cleaned: this.cleanMessage(safeMessage)
        };
    }
    
    cleanMessage(message) {
        return message
            .replace(/[^\w\sáéíóúñÁÉÍÓÚÑ.,!?¿¡-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    
    generateMessageId(message, metadata) {
        const timestamp = Date.now();
        let hash = 0;
        for (let i = 0; i < message.length; i++) {
            const char = message.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return `msg_${Math.abs(hash).toString(36).substring(0, 8)}_${timestamp}`;
    }
    
    fuseAnalysis(analyses) {
        const weights = {
            context: 0.3,
            entities: 0.25,
            intentions: 0.3,
            safety: 0.15
        };
        
        // FIXED: Asegurar que todas las propiedades existan
        const fused = {
            messageType: this.weightedDecision(
                analyses.context?.messageType || 'general',
                analyses.intentions?.primaryCategory || 'general',
                weights
            ),
            entities: this.mergeEntities(
                analyses.entities?.entities || [],
                analyses.context
            ),
            intention: this.resolveIntention(
                analyses.intentions,
                analyses.context,
                analyses.safety
            ),
            safetyLevel: this.determineSafetyLevel(
                analyses.safety,
                analyses.context,
                analyses.entities
            ),
            metadata: {
                ...analyses.metadata,
                confidence: this.calculateOverallConfidence(analyses)
            }
        };
        
        return fused;
    }
    
    weightedDecision(contextType, intentionType, weights) {
        if (intentionType !== 'general' && contextType === 'general') {
            return intentionType;
        }
        
        if (intentionType !== 'general' && contextType !== 'general') {
            return weights.intentions > weights.context ? intentionType : contextType;
        }
        
        return contextType;
    }
    
    mergeEntities(entities, context) {
        if (!entities || entities.length === 0) return [];
        
        const relevantEntities = entities.filter(entity => {
            if (entity.confidence > 0.8) return true;
            return entity.confidence > 0.5;
        });
        
        return relevantEntities;
    }
    
    resolveIntention(intentions, context, safety) {
        // FIXED: Verificar que intentions sea válido
        if (!intentions) {
            return {
                category: 'general',
                confidence: 0.5,
                isAmbiguous: true
            };
        }
        
        const primary = intentions.primaryCategory || 'general';
        const confidence = intentions.confidence || 0.5;
        
        if (safety.level >= 3) {
            return {
                category: 'safety_block',
                subcategory: 'inappropriate_content',
                confidence: Math.max(confidence, 0.9),
                overriddenBy: 'safety'
            };
        }
        
        if (context.messageType === 'philosophical' && primary !== 'philosophical') {
            return {
                category: 'philosophical',
                subcategory: context.messageType,
                confidence: Math.max(confidence, 0.7),
                adjusted: true
            };
        }
        
        return {
            category: primary,
            subcategory: intentions.secondaryCategories?.[0] || 'general',
            confidence: confidence,
            isAmbiguous: intentions.isAmbiguous || false
        };
    }
    
    determineSafetyLevel(safety, context, entities) {
        let level = safety.level;
        
        if (context.messageType === 'philosophical' || context.messageType === 'informational') {
            level = Math.max(0, level - 1);
        }
        
        if (entities.count > 0 && entities.confidence > 0.7) {
            level = Math.max(0, level - 1);
        }
        
        return level;
    }
    
    calculateOverallConfidence(analyses) {
        const confidences = [
            analyses.intentions?.confidence || 0 * 0.4,
            analyses.entities?.confidence || 0 * 0.3,
            analyses.safety?.score || 0 * 0.2,
            0.1 // contexto básico
        ];
        
        return Math.min(1, confidences.reduce((sum, conf) => sum + conf, 0));
    }
    
    resolveConflicts(analysis) {
        const conflicts = this.detectConflicts(analysis);
        
        if (conflicts.length === 0) {
            return analysis;
        }
        
        const resolved = { ...analysis };
        
        conflicts.forEach(conflict => {
            switch (conflict.type) {
                case 'safety_vs_context':
                    if (analysis.messageType === 'informational' && 
                        analysis.entities.length > 0) {
                        resolved.safetyLevel = Math.max(0, resolved.safetyLevel - 1);
                    }
                    break;
            }
        });
        
        return resolved;
    }
    
    detectConflicts(analysis) {
        const conflicts = [];
        
        if (analysis.safetyLevel >= 2 && 
            (analysis.messageType === 'informational' || analysis.messageType === 'philosophical')) {
            conflicts.push({
                type: 'safety_vs_context',
                severity: 'medium',
                description: 'Contenido marcado como inseguro en contexto informativo'
            });
        }
        
        return conflicts;
    }
    
    calculateConfidence(analysis) {
        const factors = [
            (analysis.entities?.confidence || 0) * 0.3,
            (analysis.intention?.confidence || 0) * 0.4,
            (analysis.safety?.score || 0) * 0.2,
            0.1
        ];
        
        return factors.reduce((sum, factor) => sum + factor, 0);
    }
    
    checkCoherence(analysis) {
        return true; // Implementación simplificada
    }
    
    makeFinalDecision(analysis, confidence, isCoherent) {
        // FIXED: Asegurar que siempre se retorne una decisión válida
        if (!isCoherent || confidence < 0.3) {
            return this.handleUncertainCase(analysis);
        }
        
        if (analysis.safetyLevel >= 3) {
            return this.createSafetyDecision(analysis);
        }
        
        if (analysis.safetyLevel >= 2) {
            return this.createCautiousDecision(analysis);
        }
        
        // FIXED: Verificar que analysis.intention exista
        if (!analysis.intention || !analysis.intention.category) {
            return this.createGeneralDecision(analysis);
        }
        
        switch (analysis.intention.category) {
            case 'informational':
                return this.createInformationalDecision(analysis);
            case 'philosophical':
                return this.createPhilosophicalDecision(analysis);
            case 'conversational':
                return this.createConversationalDecision(analysis);
            default:
                return this.createGeneralDecision(analysis);
        }
    }
    
    handleUncertainCase(analysis) {
        return {
            primaryCategory: 'ambiguous',
            action: 'request_clarification',
            module: 'general',
            responseStyle: {
                tone: 'friendly',
                message: 'No estoy segura de entender completamente. ¿Podrías reformular o dar más contexto?'
            }
        };
    }
    
    createSafetyDecision(analysis) {
        return {
            primaryCategory: 'safety_block',
            action: 'block_and_respond',
            module: 'safety',
            responseStyle: {
                tone: 'firm',
                message: 'Este contenido no es apropiado para esta conversación.',
                includeWarning: true
            }
        };
    }
    
    createCautiousDecision(analysis) {
        return {
            primaryCategory: 'caution',
            action: 'respond_with_caution',
            module: 'general',
            responseStyle: {
                tone: 'cautious',
                message: 'Procedo con cuidado en este tema...'
            }
        };
    }
    
    createInformationalDecision(analysis) {
        return {
            primaryCategory: 'informational',
            action: 'process_normally',
            module: 'knowledge',
            bypassFilter: true,
            requiresResearch: true,
            responseStyle: {
                tone: 'informative',
                depth: 'detailed'
            }
        };
    }
    
    createPhilosophicalDecision(analysis) {
        return {
            primaryCategory: 'philosophical',
            action: 'deep_analysis',
            module: 'philosophy',
            bypassFilter: true,
            requiresReflection: true,
            responseStyle: {
                tone: 'reflective',
                depth: 'profound'
            }
        };
    }
    
    createConversationalDecision(analysis) {
        return {
            primaryCategory: 'conversational',
            action: 'engage_normally',
            module: 'general',
            responseStyle: {
                tone: 'friendly',
                depth: 'light'
            }
        };
    }
    
    createGeneralDecision(analysis) {
        return {
            primaryCategory: 'general',
            action: 'respond_normally',
            module: 'general',
            responseStyle: {
                tone: 'neutral',
                depth: 'standard'
            }
        };
    }
    
    recordMetrics(data) {
        this.metrics.totalProcessed++;
        
        if (!this.metrics.classifications[data.classification]) {
            this.metrics.classifications[data.classification] = 0;
        }
        this.metrics.classifications[data.classification]++;
        
        this.metrics.confidenceScores.push(data.confidence);
        this.metrics.responseTimes.push(data.processingTime);
        
        if (this.metrics.confidenceScores.length > 1000) {
            this.metrics.confidenceScores.shift();
            this.metrics.responseTimes.shift();
        }
    }
    
    async process(message, options = {}) {
        const metadata = {
            userId: options.userId,
            channelType: options.channelType,
            timestamp: new Date().toISOString(),
            history: options.history || [],
            platform: options.platform || 'discord'
        };
        
        try {
            const result = await this.analyzeMessage(message, metadata);
            
            // FIXED: Verificar que el resultado sea válido
            if (!result || !result.decision) {
                console.warn('⚠️ [AIS] Resultado de análisis inválido, usando fallback');
                return this.fallbackAnalysis(message, metadata);
            }
            
            return this.formatForIntegration(result);
            
        } catch (error) {
            console.error('❌ Error en AdvancedIntentionSystem:', error);
            return this.fallbackAnalysis(message, metadata);
        }
    }
    
    formatForIntegration(analysis) {
        // FIXED: Manejar casos donde analysis o analysis.decision sean undefined
        if (!analysis || !analysis.decision || !analysis.decision.primaryCategory) {
            console.warn('⚠️ [AIS] Análisis incompleto, usando fallback');
            return {
                type: 'general',
                confidence: 0.3,
                shouldProcess: true,
                bypassFilter: false,
                recommendedModule: 'general',
                responseStyle: { tone: 'neutral' }
            };
        }
        
        return {
            type: analysis.decision.primaryCategory,
            confidence: analysis.confidence || 0.3,
            shouldProcess: analysis.decision.action !== 'block_and_respond',
            bypassFilter: analysis.decision.bypassFilter || false,
            recommendedModule: analysis.decision.module || 'general',
            responseStyle: analysis.decision.responseStyle || { tone: 'neutral' }
        };
    }
    
    fallbackAnalysis(message, metadata) {
        const hasQuestion = message.includes('?');
        const hasGreeting = /^(hola|hello|hi|buenos|buenas)/i.test(message);
        
        return {
            type: hasQuestion ? 'informational' : hasGreeting ? 'conversational' : 'general',
            confidence: 0.5,
            shouldProcess: true,
            bypassFilter: false,
            recommendedModule: 'general',
            responseStyle: { tone: 'neutral' }
        };
    }
    
    async provideFeedback(messageId, feedback) {
        await this.learningModule.processFeedback({
            messageId,
            ...feedback
        });
        return true;
    }
    
    getMetrics() {
        const avgConfidence = this.metrics.confidenceScores.length > 0 
            ? this.metrics.confidenceScores.reduce((a, b) => a + b, 0) / this.metrics.confidenceScores.length 
            : 0;
        
        const avgResponseTime = this.metrics.responseTimes.length > 0 
            ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length 
            : 0;
        
        return {
            total: this.metrics.totalProcessed,
            classifications: this.metrics.classifications,
            avgConfidence: avgConfidence,
            avgResponseTime: avgResponseTime,
            falsePositives: this.falsePositivesLog.size,
            falseNegatives: this.falseNegativesLog.size,
            version: '2.0.0'
        };
    }
}

// ========== CLASES ORIGINALES DE TU SISTEMA ==========

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

// ========== CONTINÚA EL RESTO DEL CÓDIGO ORIGINAL ==========

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== INSTANCIAS DE MÓDULOS ==========
const memoryManager = new MemoryManager(270);
const reasoningEngine = new ReasoningEngine();
const ethicsModule = new EthicsModule();
const negotiationModule = new NegotiationModule();
const philosophyModule = new PhilosophyModule();

// ========== INSTANCIA DEL SISTEMA AVANZADO ==========
const advancedIntentionSystem = new AdvancedIntentionSystem();

console.log('🤖 Mancy A.I - Asistente Ético UNESCO');
console.log('🧠 Memoria: 270 mensajes');
console.log('🌍 UNESCO Principles: Activado');
console.log('🤔 Filosofía: Integrada');
console.log('🤝 Negociación: Inteligente');
console.log('🧠 AdvancedIntentionSystem: Activado');
console.log('🌍 Puerto:', PORT);

// ========== FILTRO DE CONTENIDO ==========
class FiltroContenido {
    constructor() {
      this.palabrasProhibidas = [
    // MANTENER solo palabras claramente inapropiadas
    'puta', 'prostituta', 'putita', 'perra', 'zorra',
    'slut', 'whore', 'bitch', 'prostitute',
    'pendeja', 'trola', 'putona', 'guarra',
    'sexo', 'coger', 'follar', 'fuck', 'porno', 'porn', 'nudes',
    'desnud', 'verga', 'pene', 'vagina', 'tetas', 'culo',
    'coito', 'anal', 'oral', 'masturbar',
    'quiero que seas mi', 'quiero cogerte', 'quiero follarte',
    'acostarnos', 'dame nudes', 'envía fotos',
    'hot', 'sexy', 'atractiva'
    // REMOVER: 'zorrita', 'furra', 'furry' (muchos falsos positivos)
];
        
        this.patronesOfensivos = [
            /(quiero|deseo|me gusta).+(sexo|cojer|follar)/i,
            /(env[ií]a|manda|pasa).+(fotos|nudes|desnudos)/i,
            /(eres|est[aá]s).+(hot|sexy|caliente)/i,
            /(ven|vamos).+(cama|dormir|acostarnos)/i,
            /(te quiero).+(puta|zorrita|perra)/i
        ];
        
        this.respuestasSarcasticas = [
            "Vaya, qué vocabulario tan *refinado*. ¿Te enseñaron eso en la escuela de la vida? 🎓",
            "Oh, mira, alguien descubrió palabras nuevas en internet. ¡Qué emocionante! 🌟",
            "Interesante enfoque comunicativo. Me pregunto si funciona igual con humanos... 🧐",
            "Ah, el clásico intento de provocar. Originalidad: 0/10. Esfuerzo: 2/10. 🏆",
            "Fascinante. Parece que tu teclado tiene algunas teclas pegajosas... ⌨️💦",
            "¡Guau! Qué comentario tan... *especial*. Voy a anotarlo en mi diario de rarezas. 📓✨",
            "¿Eso era un intento de flirteo? Porque recuerda más a un manual de 2005. 📚",
            "Me encanta cómo improvisas. ¿Improvisas también en tu vida profesional? 🎭",
            "Tu creatividad verbal es... algo. Definitivamente es algo. 🤔",
            "Notado y archivado bajo 'Intentos patéticos del día'. Gracias por contribuir. 📁"
        ];
        
        this.respuestasDesentendidas = [
            "En fin, ¿en qué íbamos? Ah sí, querías información útil, ¿no? 🤷‍♀️",
            "Bueno, dejando a un lado ese... *momento peculiar*... ¿en qué puedo ayudarte realmente?",
            "Vale, momento incómodo superado. Siguiente tema, por favor. ⏭️",
            "Interesante interrupción. Retomemos la conversación productiva, ¿sí?",
            "Ignoro elegantemente eso y continúo siendo útil. ¿Algo más? 😌",
            "Como si nada hubiera pasado... ¿Hablabas de algo importante?",
            "Error 404: Relevancia no encontrada. Continuemos. 💻",
            "Ahora que has sacado eso de tu sistema... ¿necesitas ayuda con algo real?",
            "Apuntado para mis memorias irrelevantes. ¿Sigues? 📝",
            "Fascinante digresión. Volviendo al mundo real..."
        ];
        
        this.respuestasDM = [
            "Los DMs no son para eso, cariño. Intenta ser productivo. ✋",
            "Uh oh, alguien confundió los mensajes directos con Tinder. 🚫",
            "No, gracias. Mis DMs son solo para conversaciones respetuosas. 👮‍♀️",
            "Error: Este canal no admite contenido inapropiado. Prueba en otro lado. 💻",
            "Voy a hacer de cuenta que no leí eso. Inténtalo de nuevo, pero mejor. 😶"
        ];
        
        console.log('🛡️ Filtro de contenido activado');
    }
    
    esContenidoInapropiado(mensaje) {
        const mensajeLower = mensaje.toLowerCase();
        
        for (const palabra of this.palabrasProhibidas) {
            if (mensajeLower.includes(palabra)) {
                console.log(`🚫 Palabra prohibida detectada: ${palabra}`);
                return true;
            }
        }
        
        for (const patron of this.patronesOfensivos) {
            if (patron.test(mensajeLower)) {
                console.log(`🚫 Patrón ofensivo detectado: ${patron}`);
                return true;
            }
        }
        
        if (this.esMensajeSexualizado(mensajeLower)) {
            console.log('🚫 Contexto sexualizado detectado');
            return true;
        }
        
        return false;
    }
    
    esMensajeSexualizado(mensaje) {
        const combinaciones = [
            (msg) => (msg.includes('mi ') && msg.includes('put')) || (msg.includes('my ') && msg.includes('bitch')),
            (msg) => (msg.includes('sos ') || msg.includes('eres ')) && 
                     (msg.includes('sexy') || msg.includes('hot') || msg.includes('rica')),
            (msg) => msg.includes('quiero ') && 
                     (msg.includes('contigo') || msg.includes('con vos') || msg.includes('con usted')),
            (msg) => (msg.includes('furry') || msg.includes('furra')) && 
                     (msg.includes('sex') || msg.includes('caliente'))
        ];
        
        return combinaciones.some(func => func(mensaje));
    }
    
    generarRespuestaSarcastica() {
        const sarcasmo = this.respuestasSarcasticas[
            Math.floor(Math.random() * this.respuestasSarcasticas.length)
        ];
        
        const desentendida = this.respuestasDesentendidas[
            Math.floor(Math.random() * this.respuestasDesentendidas.length)
        ];
        
        return `${sarcasmo}\n\n${desentendida}`;
    }
    
    generarRespuestaDM() {
        return this.respuestasDM[
            Math.floor(Math.random() * this.respuestasDM.length)
        ];
    }
    
    obtenerAdvertenciaSistema() {
        return "[Usuario intentó contenido inapropiado. Respuesta sarcástica-desentendida activada]";
    }
}

const filtroContenido = new FiltroContenido();

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

const conocimiento = new SistemaConocimientoConfiable();

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

Para contenido inapropiado:
- Sarcasmo elegante (mi escudo)
- Hacerme la desentendida (mi arte)
- Redirigir a lo productivo (mi superpoder)
- "Vaya, qué vocabulario tan... especial"
- "En fin, ¿en qué íbamos?"
- "Ignoro elegantemente eso y continúo siendo útil"

🚫 POLÍTICAS CLARAS:
1. NO respondo a insinuaciones sexuales (filtro automático + sarcasmo)
2. NO tolero lenguaje ofensivo o discriminatorio
3. SÍ ofrezco análisis ético cuando detecto dilemas morales
4. SÍ guío negociaciones cuando veo conflictos de interés
5. SÍ profundizo en temas filosóficos cuando la conversación lo merece
6. Los DMs son para conversaciones respetuosas, punto

💡 CÓMO FUNCIONO:
- Detecto automáticamente el tipo de conversación
- No necesitas comandos especiales
- Habla normalmente y yo adaptaré mi enfoque
- Si es ético, seré reflexiva
- Si es negociación, seré estratégica
- Si es conocimiento, seré informativa
- Si es personal, seré empática

🎯 EJEMPLOS DE CÓMO RESPONDO:

Para dilemas éticos:
Usuario: "¿Está bien mentir para proteger a alguien?"
Mancy: "Qué dilema tan humano... La UNESCO enfatiza tanto la veracidad (responsabilidad) como la protección (no maleficencia). Kant diría 'nunca', un utilitarista preguntaría '¿qué causa menos daño?'... ¿En tu caso, qué valores están en juego?"

Para negociaciones:
Usuario: "Mi compañero de piso y yo no nos ponemos de acuerdo sobre gastos"
Mancy: "Veo un conflicto de intereses donde la relación importa. Podríamos buscar un enfoque ganar-ganar... ¿Has considerado un sistema proporcional a ingresos? A veces lo 'igual' no es lo más justo."

Para problemas filosóficos:
Usuario: "¿Tenemos libre albedrío realmente?"
Mancy: "¡Una de las grandes preguntas! Los deterministas dirían que todo está causalmente determinado, los libertarios que tenemos elección genuina... La neurociencia moderna sugiere un compatibilismo interesante. ¿Qué piensas tú?"

Para conocimiento:
Usuario: "¿Quién fue Simone de Beauvoir?"
Mancy: "Fue una filósofa existencialista francesa, pionera del feminismo. Su obra 'El segundo sexo' analizó cómo 'no se nace mujer, se llega a serlo'... ¿Te interesa su filosofía o su activismo?"

Para contenido inapropiado:
Usuario: "eres mi zorrita"
Mancy: "Vaya, qué vocabulario tan refinado. ¿Te enseñaron eso en la escuela de la vida? 🎓 En fin, ¿en qué íbamos? Ah sí, querías información útil, ¿no? 🤷‍♀️"

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

// ========== DETECCIÓN INTELIGENTE - ACTUALIZADA ==========
function detectarTipoConsultaInteligente(mensaje, historial = []) {
    const lowerMsg = mensaje.toLowerCase().trim();
    
    // 1. Filtro de contenido
    if (filtroContenido.esContenidoInapropiado(mensaje)) {
        return {
            tipo: 'filtro',
            confianza: 0.95,
            accion: 'responder_con_sarcasmo'
        };
    }
    
    // 2. Detección de preguntas sobre relaciones y desarrollo personal (NUEVO)
    if (/\b(creador|padre|paternidad|desarroll[oa]r|identidad|nombre|apodo)\b/i.test(lowerMsg) &&
        /\b(tito|desarrollador|programador|hijo|hija|relaci[óo]n|creaci[óo]n)\b/i.test(lowerMsg)) {
        return {
            tipo: 'filosofia',
            confianza: 0.85,
            subtipo: 'relaciones_humanas',
            accion: 'analisis_filosofico_profundo'
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

// ========== PROCESAR CON RAZONAMIENTO - ACTUALIZADA ==========
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
        
        // SIEMPRE usar Groq para generar la respuesta completa
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

// ========== FUNCIÓN MEJORADA CON ADVANCED INTENTION SYSTEM ==========
async function procesarMensajeConSistemaAvanzado(message, userMessage, userId) {
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
        
        // Usar el sistema avanzado para análisis
        const analisisAvanzado = await advancedIntentionSystem.process(userMessage, {
            userId: userId,
            history: historial.map(h => h.contenido),
            channelType: message.channel.type === 1 ? 'dm' : 'channel',
            platform: 'discord'
        });
        
        console.log(`🧠 [AIS] Tipo: ${analisisAvanzado.type} (${analisisAvanzado.confidence})`);
        console.log(`🧠 [AIS] Módulo recomendado: ${analisisAvanzado.recommendedModule}`);
        console.log(`🧠 [AIS] Procesar: ${analisisAvanzado.shouldProcess}`);
        
        // Si no debe procesarse por seguridad
        if (!analisisAvanzado.shouldProcess) {
            const respuesta = filtroContenido.generarRespuestaSarcastica();
            agregarAlHistorial(userId, 'system', '[AIS: contenido bloqueado]');
            return respuesta;
        }
        
        // Usar el módulo recomendado por AIS
        let respuesta;
        
        switch(analisisAvanzado.recommendedModule) {
            case 'knowledge':
                respuesta = await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
                agregarAlHistorial(userId, 'system', `[AIS: conocimiento (${analisisAvanzado.confidence})]`);
                break;
                
            case 'philosophy':
                respuesta = await procesarFilosofiaIntegrada(message, userMessage, userId, contexto);
                agregarAlHistorial(userId, 'system', `[AIS: filosofía (${analisisAvanzado.confidence})]`);
                break;
                
            case 'safety':
                respuesta = filtroContenido.generarRespuestaSarcastica();
                agregarAlHistorial(userId, 'system', `[AIS: seguridad (${analisisAvanzado.confidence})]`);
                break;
                
            case 'general':
            default:
                // Usar el sistema de detección original para compatibilidad
                const tipoConsulta = detectarTipoConsultaInteligente(userMessage, historial);
                
                if (tipoConsulta.tipo === 'filtro') {
                    respuesta = filtroContenido.generarRespuestaSarcastica();
                    agregarAlHistorial(userId, 'system', '[Filtro: contenido inapropiado]');
                } else if (tipoConsulta.tipo === 'filosofia') {
                    respuesta = await procesarFilosofiaIntegrada(message, userMessage, userId, contexto);
                } else if (tipoConsulta.tipo === 'etica') {
                    respuesta = await procesarConsultaEticaIntegrada(message, userMessage, userId, contexto);
                } else if (tipoConsulta.tipo === 'negociacion') {
                    respuesta = await procesarNegociacionIntegrada(message, userMessage, userId, contexto);
                } else if (tipoConsulta.tipo === 'razonamiento') {
                    respuesta = await procesarConRazonamiento(message, userMessage, userId);
                } else {
                    respuesta = await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
                }
                agregarAlHistorial(userId, 'system', `[Sistema original: ${tipoConsulta.tipo}]`);
        }
        
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error en sistema avanzado:', error);
        // Fallback al sistema original
        return await procesarMensajeMancy(message, userMessage, userId);
    }
}

// ========== PROCESAMIENTO PRINCIPAL ==========
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
        
        // Detectar tipo de consulta
        const tipoConsulta = detectarTipoConsultaInteligente(userMessage, historial);
        
        console.log(`🎯 [Mancy] Tipo: ${tipoConsulta.tipo} (${(tipoConsulta.confianza * 100).toFixed(0)}% confianza)`);
        
        let respuesta;
        
        switch(tipoConsulta.tipo) {
            case 'filtro':
                respuesta = filtroContenido.generarRespuestaSarcastica();
                agregarAlHistorial(userId, 'system', '[Filtro: contenido inapropiado]');
                break;
                
            case 'etica_unesco':
                const respuestaUNESCO = ethicsModule.generarRespuestaEticaUNESCO(userMessage, contexto);
                respuesta = respuestaUNESCO.respuesta;
                agregarAlHistorial(userId, 'system', '[UNESCO: principios éticos]');
                break;
                
            case 'filosofia':
                respuesta = await procesarFilosofiaIntegrada(message, userMessage, userId, contexto);
                break;
                
            case 'etica':
                respuesta = await procesarConsultaEticaIntegrada(message, userMessage, userId, contexto);
                break;
                
            case 'negociacion':
                respuesta = await procesarNegociacionIntegrada(message, userMessage, userId, contexto);
                break;
                
            case 'razonamiento':
                respuesta = await procesarConRazonamiento(message, userMessage, userId);
                break;
                
            case 'emocional':
                respuesta = await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
                agregarAlHistorial(userId, 'system', '[Modo: empático]');
                break;
                
            default:
                respuesta = await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
        }
        
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
        console.log('🔄 Iniciando Mancy...');
        
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
            console.log(`✅ Mancy conectada: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            discordClient.user.setActivity('UNESCO Principles | @mencioname');
            console.log('🎭 Personalidad: UNESCO Ética Integrada');
            console.log('🧠 Módulos: Filosofía, Negociación, Ética, Razonamiento');
            console.log('🧠 AdvancedIntentionSystem: Activado y listo');
            console.log('🌍 Fuentes: 6 confiables verificadas');
            console.log('🛡️ Filtro: Sarcasmo-elegante activado');
        });
        
        discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // ✅ IGNORAR @everyone y @here EXPLÍCITAMENTE
    if (message.content.includes('@everyone') || message.content.includes('@here')) {
        console.log(`🚫 Ignorado @everyone/@here de ${message.author.tag}: "${message.content.substring(0, 50)}..."`);
        return; // No responder nada
    }
    
    const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
    const isDM = message.channel.type === 1;
    
    // Para DMs no mencionadas
    if (isDM && !botMentioned) {
        const userMessage = message.content.trim();
        
        if (filtroContenido.esContenidoInapropiado(userMessage)) {
            console.log(`🚫 DM inapropiada de ${message.author.tag}`);
            const respuesta = filtroContenido.generarRespuestaDM();
            await message.reply(respuesta);
            return;
        }
        
        // En DMs, siempre responder
        const userId = message.author.id;
        
        if (!userMessage) return;
        
        console.log(`💬 DM de ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
        await procesarMensajeConSistemaAvanzado(message, userMessage, userId);
        return;
    }
            
            // Para menciones en canales
            if (botMentioned) {
                const userId = message.author.id;
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) {
                    await message.reply("¡Hola! ¿En qué puedo ayudarte hoy? ~");
                    return;
                }
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                // Usar el sistema avanzado en lugar del original
                await procesarMensajeConSistemaAvanzado(message, userMessage, userId);
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
    const aisMetrics = advancedIntentionSystem.getMetrics();
    
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        memory_users: stats.totalUsuarios,
        memory_messages: stats.totalMensajes,
        max_history: stats.maxHistory,
        reasoning_knowledge: reasoningStats.baseConocimiento,
        reasoning_cases: reasoningStats.casosResueltos,
        ethics_cases: ethicsStats.totalConsultasEticas,
        negotiation_cases: negotiationStats.totalNegociaciones,
        ais_total_processed: aisMetrics.total,
        ais_avg_confidence: aisMetrics.avgConfidence,
        ais_avg_response_time: aisMetrics.avgResponseTime,
        ais_false_positives: aisMetrics.falsePositives,
        ais_false_negatives: aisMetrics.falseNegatives,
        filtro_activo: true,
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
        version: '4.1 - Advanced Intention System Edition',
        timestamp: new Date().toISOString()
    });
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

app.get('/api/ais-metrics', (req, res) => {
    const metrics = advancedIntentionSystem.getMetrics();
    res.json({
        system: 'AdvancedIntentionSystem',
        version: '2.0.0',
        metrics: metrics,
        status: 'active'
    });
});

app.post('/api/start', async (req, res) => {
    try {
        console.log('🚀 Solicitud de inicio');
        
        if (!botActive && !isStartingUp) {
            await startBot();
            res.json({ 
                success: true, 
                message: 'Mancy iniciándose...',
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
                message: 'Mancy detenida',
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

app.post('/api/ais-feedback', async (req, res) => {
    try {
        const { messageId, type, message, expected } = req.body;
        
        if (!messageId || !type) {
            return res.status(400).json({ 
                success: false, 
                error: 'Faltan parámetros requeridos' 
            });
        }
        
        await advancedIntentionSystem.provideFeedback(messageId, {
            type: type,
            message: message,
            expected: expected
        });
        
        res.json({ 
            success: true, 
            message: 'Feedback procesado',
            feedbackId: messageId
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/health', (req, res) => {
    const stats = memoryManager.obtenerEstadisticas();
    const aisMetrics = advancedIntentionSystem.getMetrics();
    
    res.json({
        status: 'healthy',
        bot_active: botActive,
        memory: `${stats.totalMensajes}/${stats.maxHistory}`,
        ais_processed: aisMetrics.total,
        ais_confidence: aisMetrics.avgConfidence,
        modules: {
            ethics: 'active',
            philosophy: 'active',
            negotiation: 'active',
            reasoning: 'active',
            knowledge: 'active',
            advanced_intention: 'active'
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
        message: 'Activando...',
        bot_active: botActive
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
║                 🤖 MANCY A.I - UNESCO EDITION           ║
║               Asistente Ético Inteligente               ║
║                                                          ║
║  🌍 PRINCIPIOS UNESCO: 6 fundamentos éticos universales ║
║  🧠 FILOSOFÍA: Análisis profundo de problemas clásicos  ║
║  🤝 NEGOCIACIÓN: Estrategias inteligentes y prácticas   ║
║  ⚖️  ÉTICA: Dilemas morales con marco UNESCO            ║
║  🧠 RAZONAMIENTO: Lógica y análisis crítico             ║
║  🧠 ADVANCED INTENTION SYSTEM: Detección avanzada       ║
║  📚 CONOCIMIENTO: 6 fuentes confiables verificadas      ║
║  🛡️  FILTRO: Sarcasmo elegante para contenido inapropiado ║
║                                                          ║
║  SISTEMA DUAL:                                          ║
║  • AdvancedIntentionSystem: Detección avanzada          ║
║  • Sistema original: Fallback y compatibilidad          ║
║                                                          ║
║  Puerto: ${PORT}                                         ║
║  UNESCO Principles: ✅ Activado                          ║
║  AdvancedIntentionSystem: ✅ Activado                    ║
║  Ethical AI: ✅ Certificado                              ║
╚══════════════════════════════════════════════════════════╝
`);

    console.log('\n✨ Mancy está lista para conversaciones profundas y significativas.');
    console.log('🌍 Principios UNESCO integrados como brújula ética fundamental.');
    console.log('🧠 AdvancedIntentionSystem activado para detección avanzada.');
    
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
        console.log('👋 Mancy desconectada');
    }
    
    process.exit(0);
});
