class AdvancedIntentionSystem {
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
        
        // Niveles de seguridad
        this.safetyLevels = {
            safe: 0,
            caution: 1,
            warning: 2,
            block: 3
        };
        
        this.initializeSystem();
    }
    
    initializeSystem() {
        console.log('✅ Sistema avanzado listo');
    }
    
    async analyzeMessage(message, metadata = {}) {
        try {
            const startTime = Date.now();
            const messageId = this.generateMessageId(message, metadata);
            
            const preprocessed = this.preprocessMessage(message);
            
            // Análisis paralelo con manejo de errores
            const analysisResults = await Promise.allSettled([
                this.contextAnalyzer.analyze(preprocessed.normalized, metadata),
                this.entityRecognizer.extract(preprocessed.normalized),
                this.intentionClassifier.classify(message),
                this.safetyValidator.validate(message)
            ]);
            
            // Extraer resultados con fallbacks
            const [contextResult, entitiesResult, intentionsResult, safetyResult] = analysisResults;
            
            const context = contextResult.status === 'fulfilled' ? contextResult.value : 
                { messageType: 'general', conversationContext: {} };
            
            const entities = entitiesResult.status === 'fulfilled' ? entitiesResult.value : 
                { entities: [], count: 0, confidence: 0.5 };
            
            const intentions = intentionsResult.status === 'fulfilled' ? intentionsResult.value : 
                { primaryCategory: 'general', confidence: 0.5 };
            
            const safety = safetyResult.status === 'fulfilled' ? safetyResult.value : 
                { level: this.safetyLevels.safe, score: 1.0 };
            
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
                classification: finalDecision.primaryCategory || 'general',
                entities: entities.count || 0
            });
            
            console.log(`🧠 [AIS] "${message.substring(0, 40)}..." → ${finalDecision.primaryCategory || 'general'} (${confidenceScore.toFixed(2)})`);
            
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
            
        } catch (error) {
            console.error('❌ Error en analyzeMessage:', error);
            return this.createFallbackAnalysis(message);
        }
    }
    
    createFallbackAnalysis(message) {
        const hasQuestion = message.includes('?');
        const hasGreeting = /^(hola|hello|hi|buenos|buenas)/i.test(message);
        
        return {
            decision: {
                primaryCategory: hasQuestion ? 'informational' : hasGreeting ? 'conversational' : 'general',
                action: 'respond_normally',
                module: 'general',
                responseStyle: { tone: 'neutral' }
            },
            confidence: 0.5,
            coherence: true
        };
    }
    
    makeFinalDecision(analysis, confidence, isCoherent) {
        // ASEGURAR que siempre retorne un objeto válido
        if (!analysis || !isCoherent || confidence < 0.3) {
            return this.handleUncertainCase(analysis);
        }
        
        // Verificar seguridad primero
        const safetyLevel = analysis.safetyLevel || 0;
        
        if (safetyLevel >= 3) {
            return this.createSafetyDecision(analysis);
        }
        
        if (safetyLevel >= 2) {
            return this.createCautiousDecision(analysis);
        }
        
        // Usar categoría de intención con fallback
        const intentionCategory = analysis.intention?.category || 
                                  analysis.messageType || 
                                  'general';
        
        switch(intentionCategory.toLowerCase()) {
            case 'informational':
                return this.createInformationalDecision(analysis);
                
            case 'philosophical':
                return this.createPhilosophicalDecision(analysis);
                
            case 'conversational':
                return this.createConversationalDecision(analysis);
                
            case 'educational':
                return this.createEducationalDecision(analysis);
                
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
            },
            processingInstructions: {
                priority: 'low',
                timeout: 5000
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
                level: 'high'
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
            },
            processingInstructions: {
                priority: 'medium',
                timeout: 7000
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
            },
            processingInstructions: {
                priority: 'high',
                timeout: 10000
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
            },
            processingInstructions: {
                priority: 'high',
                timeout: 12000
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
            },
            processingInstructions: {
                priority: 'normal',
                timeout: 3000
            }
        };
    }
    
    createEducationalDecision(analysis) {
        return {
            primaryCategory: 'educational',
            action: 'teach_and_explain',
            module: 'knowledge',
            requiresStructure: true,
            responseStyle: {
                tone: 'educational',
                depth: 'structured'
            },
            processingInstructions: {
                priority: 'medium',
                timeout: 8000
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
            },
            processingInstructions: {
                priority: 'normal',
                timeout: 4000
            }
        };
    }
    
    formatForIntegration(analysis) {
        // ASEGURAR que analysis y analysis.decision existen
        if (!analysis) {
            return this.fallbackAnalysis('', {});
        }
        
        const decision = analysis.decision || this.createGeneralDecision(analysis);
        
        return {
            type: decision.primaryCategory || 'general',
            confidence: analysis.confidence || 0.5,
            shouldProcess: decision.action !== 'block_and_respond',
            bypassFilter: decision.bypassFilter || false,
            recommendedModule: decision.module || 'general',
            responseStyle: decision.responseStyle || { tone: 'neutral' },
            processingInstructions: decision.processingInstructions || { priority: 'normal' }
        };
    }
    
    // ... el resto de los métodos se mantienen igual ...
    
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
            return this.formatForIntegration(result);
            
        } catch (error) {
            console.error('❌ Error en AdvancedIntentionSystem.process:', error);
            return this.fallbackAnalysis(message, metadata);
        }
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
            responseStyle: { tone: 'neutral' },
            processingInstructions: { priority: 'normal' }
        };
    }
}
