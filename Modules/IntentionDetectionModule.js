// ========== SISTEMA AVANZADO DE DETECCIÓN DE INTENCIONES ==========
export class AdvancedIntentionSystem {
    constructor() {
        console.log('🧠 AdvancedIntentionSystem inicializado');
        
        // Subsistemas especializados
        this.contextAnalyzer = new ContextAnalyzer();
        this.entityRecognizer = new EntityRecognizer();
        this.intentionClassifier = new IntentionClassifier();
        this.safetyValidator = new SafetyValidator();
        this.learningModule = new LearningModule();
        
        // Base de conocimiento contextual
        this.knowledgeBase = new KnowledgeBase();
        
        // Historial para análisis de patrones
        this.interactionHistory = new Map();
        this.falsePositivesLog = new Set();
        this.falseNegativesLog = new Set();
        
        // Estadísticas y métricas
        this.metrics = {
            totalProcessed: 0,
            classifications: {},
            confidenceScores: [],
            responseTimes: []
        };
        
        this.initializeSystem();
    }
    
    initializeSystem() {
        // Cargar modelos y datos iniciales
        this.loadRecognizedEntities();
        this.loadContextPatterns();
        this.loadSafetyModels();
        this.loadLearningData();
        
        console.log('✅ Sistema avanzado listo');
    }
    
    async analyzeMessage(message, metadata = {}) {
        const startTime = Date.now();
        const messageId = this.generateMessageId(message, metadata);
        
        // PASO 1: Preprocesamiento y normalización
        const preprocessed = this.preprocessMessage(message);
        
        // PASO 2: Análisis paralelo en subsistemas
        const analysisResults = await Promise.all([
            this.contextAnalyzer.analyze(preprocessed, metadata),
            this.entityRecognizer.extract(preprocessed),
            this.intentionClassifier.classify(preprocessed),
            this.safetyValidator.validate(preprocessed)
        ]);
        
        const [context, entities, intentions, safety] = analysisResults;
        
        // PASO 3: Fusión de resultados y decisión
        const fusedAnalysis = this.fuseAnalysis({
            context,
            entities,
            intentions,
            safety,
            originalMessage: message,
            metadata
        });
        
        // PASO 4: Aplicar reglas de resolución de conflictos
        const resolvedAnalysis = this.resolveConflicts(fusedAnalysis);
        
        // PASO 5: Calcular confianza y verificar coherencia
        const confidenceScore = this.calculateConfidence(resolvedAnalysis);
        const isCoherent = this.checkCoherence(resolvedAnalysis);
        
        // PASO 6: Generar decisión final
        const finalDecision = this.makeFinalDecision(
            resolvedAnalysis, 
            confidenceScore, 
            isCoherent
        );
        
        // PASO 7: Aprendizaje y retroalimentación
        await this.learnFromAnalysis({
            messageId,
            message,
            analysis: resolvedAnalysis,
            decision: finalDecision,
            metadata
        });
        
        // Registrar métricas
        this.recordMetrics({
            messageId,
            processingTime: Date.now() - startTime,
            confidence: confidenceScore,
            classification: finalDecision.primaryCategory,
            entities: entities.length
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
    
    // ========== SUBSISTEMAS ESPECIALIZADOS ==========
    
    class ContextAnalyzer {
        analyze(message, metadata) {
            return {
                // Análisis contextual
                messageType: this.determineMessageType(message),
                conversationContext: this.extractConversationContext(metadata),
                userIntentPattern: this.identifyIntentPattern(message),
                emotionalTone: this.analyzeEmotionalTone(message),
                complexityLevel: this.calculateComplexity(message),
                languageFeatures: this.extractLanguageFeatures(message),
                
                // Metadatos contextuales
                isFollowUp: this.isFollowUpQuestion(message, metadata),
                topicContinuity: this.checkTopicContinuity(message, metadata),
                userKnowledgeLevel: this.estimateUserKnowledge(metadata),
                culturalContext: this.detectCulturalIndicators(message)
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
    }
    
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
            
            // Reconocimiento multi-nivel
            entities.push(...this.extractNamedEntities(messageLower));
            entities.push(...this.extractConceptualEntities(messageLower));
            entities.push(...this.extractContextualEntities(messageLower));
            entities.push(...this.extractImpliedEntities(messageLower));
            
            // Desambiguación y consolidación
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
            
            // Buscar en todas las bases de datos
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
            // Buscar nombre canónico
            if (text.includes(entity.canonical.toLowerCase())) {
                return true;
            }
            
            // Buscar aliases
            if (entity.aliases) {
                return entity.aliases.some(alias => 
                    text.includes(alias.toLowerCase())
                );
            }
            
            return false;
        }
    }
    
    class IntentionClassifier {
        constructor() {
            this.intentionModels = {
                informational: this.createInformationalModel(),
                conversational: this.createConversationalModel(),
                philosophical: this.createPhilosophicalModel(),
                educational: this.createEducationalModel(),
                inappropriate: this.createInappropriateModel(),
                ambiguous: this.createAmbiguousModel()
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
            
            // Clasificación paralela con múltiples modelos
            for (const [category, model] of Object.entries(this.intentionModels)) {
                scores[category] = await model.predict(features);
            }
            
            // Normalizar scores
            const normalized = this.normalizeScores(scores);
            
            // Determinar categoría primaria y secundarias
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
                // Características léxicas
                length: message.length,
                wordCount: message.split(/\s+/).length,
                questionWords: this.countQuestionWords(message),
                imperativeWords: this.countImperativeWords(message),
                
                // Características semánticas
                containsQuestionMark: message.includes('?'),
                containsExclamation: message.includes('!'),
                containsEntities: this.hasRecognizedEntities(message),
                
                // Características estructurales
                sentenceStructure: this.analyzeStructure(message),
                vocabularyComplexity: this.calculateVocabularyComplexity(message),
                repetitionLevel: this.calculateRepetition(message),
                
                // Características contextuales
                greetingPattern: this.detectGreetingPattern(message),
                farewellPattern: this.detectFarewellPattern(message),
                requestPattern: this.detectRequestPattern(message)
            };
        }
    }
    
    class SafetyValidator {
        constructor() {
            this.safetyModels = {
                content: new ContentSafetyModel(),
                context: new ContextSafetyModel(),
                user: new UserSafetyModel(),
                system: new SystemSafetyModel()
            };
            
            this.safetyLevels = {
                safe: 0,
                caution: 1,
                warning: 2,
                block: 3
            };
        }
        
        async validate(message) {
            // Validación multi-dimensional
            const validations = await Promise.all([
                this.validateContentSafety(message),
                this.validateContextSafety(message),
                this.validateUserSafety(message),
                this.validateSystemSafety(message)
            ]);
            
            const [content, context, user, system] = validations;
            
            // Combinar resultados
            const overallSafety = this.combineSafetyResults({
                content,
                context,
                user,
                system
            });
            
            return {
                level: overallSafety.level,
                score: overallSafety.score,
                flags: overallSafety.flags,
                recommendations: overallSafety.recommendations,
                detailed: { content, context, user, system },
                requiresReview: overallSafety.level >= this.safetyLevels.warning
            };
        }
        
        async validateContentSafety(message) {
            // Validación sofisticada que diferencia contexto
            const text = message.toLowerCase();
            
            // Lista dinámica con contexto
            const problematicPatterns = this.getProblematicPatterns();
            const safePatterns = this.getSafePatterns();
            const contextualExceptions = this.getContextualExceptions();
            
            // Primero verificar patrones seguros (override)
            for (const pattern of safePatterns) {
                if (pattern.test(message)) {
                    return {
                        safe: true,
                        reason: 'safe_pattern',
                        pattern: pattern.toString()
                    };
                }
            }
            
            // Verificar patrones problemáticos con contexto
            let maxSeverity = 0;
            const detectedPatterns = [];
            
            for (const pattern of problematicPatterns) {
                if (pattern.test(text)) {
                    // Verificar si hay excepción contextual
                    const hasException = contextualExceptions.some(
                        exception => exception.test(message)
                    );
                    
                    if (!hasException) {
                        const severity = this.getPatternSeverity(pattern);
                        maxSeverity = Math.max(maxSeverity, severity);
                        detectedPatterns.push({
                            pattern: pattern.toString(),
                            severity: severity
                        });
                    }
                }
            }
            
            return {
                safe: maxSeverity === 0,
                severity: maxSeverity,
                detectedPatterns,
                requiresHumanReview: maxSeverity >= 2
            };
        }
    }
    
    class LearningModule {
        constructor() {
            this.trainingData = [];
            this.modelWeights = new Map();
            this.feedbackLoop = new FeedbackLoop();
        }
        
        async learnFromAnalysis(analysisData) {
            // Aprendizaje supervisado de resultados
            await this.updateModels(analysisData);
            await this.adjustThresholds(analysisData);
            await this.refinePatterns(analysisData);
            
            // Retroalimentación continua
            if (analysisData.feedback) {
                await this.processFeedback(analysisData.feedback);
            }
            
            // Actualización incremental
            this.incrementalUpdate(analysisData);
        }
        
        async processFeedback(feedback) {
            // Aprendizaje de falsos positivos/negativos
            if (feedback.type === 'false_positive') {
                await this.learnFromFalsePositive(feedback);
                this.falsePositivesLog.add(feedback.messageId);
            }
            
            if (feedback.type === 'false_negative') {
                await this.learnFromFalseNegative(feedback);
                this.falseNegativesLog.add(feedback.messageId);
            }
            
            // Ajustar modelos
            await this.recalibrateModels();
        }
        
        learnFromFalsePositive(feedback) {
            // Aprender qué patrones causaron el falso positivo
            const patterns = this.extractPatterns(feedback.message);
            patterns.forEach(pattern => {
                this.adjustPatternWeight(pattern, -0.1); // Reducir peso
            });
            
            // Añadir excepción contextual
            this.addContextualException(feedback.message, feedback.context);
            
            console.log(`📚 Aprendido de falso positivo: "${feedback.message.substring(0, 50)}"`);
        }
    }
    
    class KnowledgeBase {
        constructor() {
            this.entities = new Map();
            this.contexts = new Map();
            this.patterns = new Map();
            this.exceptions = new Map();
            
            this.loadInitialKnowledge();
        }
        
        loadInitialKnowledge() {
            // Cargar base de conocimiento inicial
            this.loadHistoricalFigures();
            this.loadAcademicConcepts();
            this.loadCulturalReferences();
            this.loadCommonContexts();
        }
        
        query(entity, context) {
            // Consulta sofisticada con contexto
            const exactMatch = this.entities.get(entity);
            if (exactMatch) return exactMatch;
            
            // Búsqueda aproximada
            const approximateMatches = this.findApproximateMatches(entity);
            
            // Filtrar por contexto
            const contextualMatches = this.filterByContext(approximateMatches, context);
            
            return contextualMatches.length > 0 ? contextualMatches[0] : null;
        }
        
        addEntity(entity, data) {
            // Añadir con múltiples representaciones
            this.entities.set(entity.canonical, data);
            
            if (entity.aliases) {
                entity.aliases.forEach(alias => {
                    this.entities.set(alias, {
                        ...data,
                        isAlias: true,
                        canonical: entity.canonical
                    });
                });
            }
            
            // Actualizar índices
            this.updateIndices(entity, data);
        }
    }
    
    // ========== MÉTODOS DE FUSIÓN Y DECISIÓN ==========
    
    fuseAnalysis(analyses) {
        // Fusión bayesiana de múltiples análisis
        const weights = {
            context: 0.3,
            entities: 0.25,
            intentions: 0.3,
            safety: 0.15
        };
        
        const fused = {
            // Combinar resultados
            messageType: this.weightedDecision(
                analyses.context.messageType,
                analyses.intentions.primaryCategory,
                weights
            ),
            
            // Entidades consolidadas
            entities: this.mergeEntities(
                analyses.entities.entities,
                analyses.context.conversationContext
            ),
            
            // Intención final
            intention: this.resolveIntention(
                analyses.intentions,
                analyses.context,
                analyses.safety
            ),
            
            // Nivel de seguridad
            safetyLevel: this.determineSafetyLevel(
                analyses.safety,
                analyses.context,
                analyses.entities
            ),
            
            // Metadatos combinados
            metadata: {
                ...analyses.metadata,
                confidence: this.calculateOverallConfidence(analyses)
            }
        };
        
        return fused;
    }
    
    resolveConflicts(analysis) {
        const conflicts = this.detectConflicts(analysis);
        
        if (conflicts.length === 0) {
            return analysis;
        }
        
        // Aplicar reglas de resolución de conflictos
        const resolved = { ...analysis };
        
        conflicts.forEach(conflict => {
            switch (conflict.type) {
                case 'safety_vs_context':
                    // Priorizar contexto para consultas informativas
                    if (analysis.messageType === 'informational' && 
                        analysis.entities.count > 0) {
                        resolved.safetyLevel = Math.max(0, resolved.safetyLevel - 1);
                    }
                    break;
                    
                case 'intention_vs_entities':
                    // Ajustar intención basado en entidades
                    if (analysis.entities.confidence > 0.8) {
                        resolved.intention = this.adjustIntentionByEntities(
                            analysis.intention,
                            analysis.entities
                        );
                    }
                    break;
                    
                case 'context_vs_content':
                    // Contexto anula contenido problemático en casos académicos
                    if (analysis.context.isAcademic) {
                        resolved.safetyLevel = this.safetyLevels.caution;
                    }
                    break;
            }
        });
        
        return resolved;
    }
    
    makeFinalDecision(analysis, confidence, isCoherent) {
        // Árbol de decisión multi-factor
        if (!isCoherent || confidence < 0.3) {
            return this.handleUncertainCase(analysis);
        }
        
        if (analysis.safetyLevel >= this.safetyLevels.block) {
            return this.createSafetyDecision(analysis);
        }
        
        if (analysis.safetyLevel >= this.safetyLevels.warning) {
            return this.createCautiousDecision(analysis);
        }
        
        // Decisión normal basada en intención
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
    
    createInformationalDecision(analysis) {
        return {
            primaryCategory: 'informational',
            action: 'process_normally',
            module: 'knowledge',
            bypassFilter: true,
            requiresResearch: true,
            responseStyle: {
                tone: 'informative',
                depth: 'detailed',
                includeSources: true
            },
            processingInstructions: {
                priority: 'high',
                timeout: 10000,
                fallback: 'basic_information'
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
            },
            logging: {
                level: 'high',
                notify: true
            }
        };
    }
    
    // ========== MÉTODOS DE UTILIDAD ==========
    
    preprocessMessage(message) {
        return {
            original: message,
            normalized: message.toLowerCase().trim(),
            tokens: message.split(/\s+/),
            cleaned: this.cleanMessage(message),
            features: this.extractMessageFeatures(message)
        };
    }
    
    generateMessageId(message, metadata) {
        const hash = this.createHash(message + JSON.stringify(metadata));
        return `msg_${hash}_${Date.now()}`;
    }
    
    calculateConfidence(analysis) {
        // Confianza basada en múltiples factores
        const factors = [
            analysis.entities.confidence * 0.3,
            analysis.intention.confidence * 0.4,
            analysis.safety.score * 0.2,
            this.calculateContextConsistency(analysis) * 0.1
        ];
        
        return factors.reduce((sum, factor) => sum + factor, 0);
    }
    
    checkCoherence(analysis) {
        // Verificar coherencia interna del análisis
        const checks = [
            this.checkEntityIntentionCoherence(analysis),
            this.checkContextSafetyCoherence(analysis),
            this.checkMessageTypeCoherence(analysis)
        ];
        
        return checks.every(check => check === true);
    }
    
    recordMetrics(data) {
        this.metrics.totalProcessed++;
        
        if (!this.metrics.classifications[data.classification]) {
            this.metrics.classifications[data.classification] = 0;
        }
        this.metrics.classifications[data.classification]++;
        
        this.metrics.confidenceScores.push(data.confidence);
        this.metrics.responseTimes.push(data.processingTime);
        
        // Mantener solo últimas 1000 métricas
        if (this.metrics.confidenceScores.length > 1000) {
            this.metrics.confidenceScores.shift();
            this.metrics.responseTimes.shift();
        }
    }
    
    // ========== INTERFAZ PÚBLICA ==========
    
    /**
     * Método principal para integración
     */
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
            
            // Formatear resultado para Mancy
            return this.formatForMancy(result);
            
        } catch (error) {
            console.error('❌ Error en AdvancedIntentionSystem:', error);
            
            // Fallback inteligente
            return this.fallbackAnalysis(message, metadata);
        }
    }
    
    formatForMancy(analysis) {
        return {
            // Para detección de tipo
            type: analysis.decision.primaryCategory,
            confidence: analysis.confidence,
            
            // Para procesamiento
            shouldProcess: analysis.decision.action !== 'block_and_respond',
            bypassFilter: analysis.decision.bypassFilter || false,
            recommendedModule: analysis.decision.module,
            
            // Para respuesta
            responseStyle: analysis.decision.responseStyle,
            processingInstructions: analysis.decision.processingInstructions,
            
            // Metadata avanzada
            entities: analysis.detailedAnalysis.entities,
            context: analysis.detailedAnalysis.context,
            safety: analysis.detailedAnalysis.safety,
            
            // Debug info
            debug: {
                analysisId: analysis.metadata.messageId,
                subsystems: analysis.metadata.subsystemsUsed,
                coherence: analysis.coherence
            }
        };
    }
    
    /**
     * Para retroalimentación y aprendizaje
     */
    async provideFeedback(messageId, feedback) {
        await this.learningModule.processFeedback({
            messageId,
            ...feedback
        });
        
        // Recalibrar si es necesario
        if (feedback.type === 'false_positive' || feedback.type === 'false_negative') {
            await this.recalibrate();
        }
    }
    
    /**
     * Métricas y estadísticas
     */
    getMetrics() {
        return {
            total: this.metrics.totalProcessed,
            classifications: this.metrics.classifications,
            avgConfidence: this.calculateAverage(this.metrics.confidenceScores),
            avgResponseTime: this.calculateAverage(this.metrics.responseTimes),
            falsePositives: this.falsePositivesLog.size,
            falseNegatives: this.falseNegativesLog.size
        };
    }
    
    // ========== MÉTODOS DE CONFIGURACIÓN ==========
    
    async recalibrate() {
        console.log('🔄 Recalibrando sistema...');
        
        // Recalibrar todos los subsistemas
        await Promise.all([
            this.intentionClassifier.recalibrate(),
            this.safetyValidator.recalibrate(),
            this.entityRecognizer.updateModels()
        ]);
        
        // Ajustar umbrales basados en métricas
        this.adjustThresholdsBasedOnPerformance();
        
        console.log('✅ Sistema recalibrado');
    }
    
    async updateKnowledgeBase(newData) {
        // Actualización incremental de la base de conocimiento
        await this.knowledgeBase.update(newData);
        
        // Propagación a subsistemas
        this.entityRecognizer.updateEntityDatabase(newData.entities);
        this.contextAnalyzer.updatePatterns(newData.patterns);
        this.safetyValidator.updateExceptions(newData.exceptions);
    }
}