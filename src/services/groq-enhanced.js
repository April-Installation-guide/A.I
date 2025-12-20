import { Groq } from 'groq-sdk';

// Importaciones seguras para evitar errores de módulo
let knowledgeIntegration = null;

try {
    // Intentar cargar knowledge-integration.js dinámicamente
    const knowledgeModule = await import('./knowledge-integration.js');
    knowledgeIntegration = knowledgeModule.default || knowledgeModule.knowledgeIntegration || knowledgeModule;
    console.log('✅ knowledge-integration.js cargado correctamente');
} catch (error) {
    console.warn('⚠️ No se pudo cargar knowledge-integration.js:', error.message);
    // Crear un objeto de respaldo
    knowledgeIntegration = {
        processMessage: async () => ({
            shouldEnhance: false,
            detection: { topic: '', confidence: 0 },
            knowledge: null,
            source: 'none'
        }),
        enhancePromptWithKnowledge: (prompt, knowledge) => prompt,
        getStats: () => ({ enabled: false, totalQueries: 0 }),
        setEnabled: () => true
    };
}

class GroqEnhanced {
    constructor(apiKey) {
        if (!apiKey) {
            console.warn('⚠️ Groq API key no proporcionada. Usando modo simulador.');
            this.simulationMode = true;
        } else {
            this.groq = new Groq({ 
                apiKey,
                timeout: 30000,
                maxRetries: 2
            });
            this.simulationMode = false;
        }
        
        this.knowledgeEnabled = process.env.ENABLE_KNOWLEDGE_INTEGRATION !== 'false';
        this.knowledgeThreshold = parseFloat(process.env.KNOWLEDGE_CONFIDENCE_THRESHOLD) || 0.5;
        
        // Configuración específica de Mancy
        this.mancyConfig = {
            model: 'llama-3.1-8b-instant',  // Modelo estable de Mancy
            temperature: 0.7,
            maxTokens: 1024,
            presencePenalty: 0.1,
            frequencyPenalty: 0.1,
            topP: 0.9
        };
        
        // Personalidad de Mancy
        this.mancyPersonality = {
            name: 'Mancy',
            role: 'Asistente super-inteligente',
            traits: ['empática', 'analítica', 'curiosa', 'paciente'],
            communicationStyle: 'conversacional pero precisa',
            corePrinciple: 'Solo quiero el bienestar de las personas'
        };
        
        // Estadísticas
        this.stats = {
            totalCalls: 0,
            enhancedResponses: 0,
            regularResponses: 0,
            errors: 0,
            totalTime: 0,
            knowledgeQueries: 0,
            llamaCalls: 0
        };
    }
    
    /**
     * Genera respuesta mejorada con conocimiento - Estilo Mancy
     */
    async generateEnhancedResponse(message, userMemory = [], userId = 'anonymous') {
        const startTime = Date.now();
        this.stats.totalCalls++;
        this.stats.llamaCalls++;
        
        try {
            // Procesar mensaje para detectar necesidad de conocimiento
            let knowledgeContext = null;
            let enhancedPrompt = message;
            
            if (this.knowledgeEnabled && knowledgeIntegration) {
                this.stats.knowledgeQueries++;
                const knowledgeResult = await knowledgeIntegration.processMessage(message);
                
                if (knowledgeResult.shouldEnhance && 
                    knowledgeResult.detection.confidence >= this.knowledgeThreshold) {
                    
                    console.log(`🧠 [Mancy-Groq] Conocimiento detectado: ${knowledgeResult.detection.topic} (confianza: ${knowledgeResult.detection.confidence.toFixed(2)})`);
                    knowledgeContext = knowledgeResult;
                    
                    if (knowledgeResult.knowledge) {
                        enhancedPrompt = knowledgeIntegration.enhancePromptWithKnowledge(
                            message,
                            knowledgeResult.knowledge
                        );
                    }
                }
            }
            
            // Preparar mensajes con personalidad de Mancy
            const messages = this.prepareMancyMessages(userMemory, enhancedPrompt, knowledgeContext);
            
            // Generar respuesta
            let response;
            let finalResponse;
            
            if (this.simulationMode) {
                // Modo simulador si no hay API key
                response = this.generateMancySimulatedResponse(message, knowledgeContext);
                finalResponse = response;
            } else {
                // Llamar a Groq API con configuración de Mancy
                const completion = await this.groq.chat.completions.create({
                    messages: messages,
                    model: this.mancyConfig.model,
                    temperature: this.mancyConfig.temperature,
                    max_tokens: this.mancyConfig.maxTokens,
                    top_p: this.mancyConfig.topP,
                    presence_penalty: this.mancyConfig.presencePenalty,
                    frequency_penalty: this.mancyConfig.frequencyPenalty,
                    stream: false
                });
                
                response = completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
                
                // Formatear respuesta con estilo Mancy
                finalResponse = this.formatMancyResponse(response, knowledgeContext, message);
            }
            
            const responseTime = Date.now() - startTime;
            this.stats.totalTime += responseTime;
            
            // Actualizar estadísticas
            if (knowledgeContext) {
                this.stats.enhancedResponses++;
                console.log(`✅ [Mancy-Groq] Respuesta mejorada con ${knowledgeContext.source || 'conocimiento'} (${responseTime}ms, Llama 3.1)`);
            } else {
                this.stats.regularResponses++;
                console.log(`🤖 [Mancy-Groq] Respuesta regular (${responseTime}ms, Llama 3.1)`);
            }
            
            return {
                response: finalResponse,
                enhanced: !!knowledgeContext,
                knowledgeUsed: knowledgeContext?.knowledge || null,
                responseTime: responseTime,
                model: this.mancyConfig.model,
                stats: {
                    enhanced: !!knowledgeContext,
                    tokens: response.length / 4,
                    knowledgeSource: knowledgeContext?.source,
                    llamaModel: this.mancyConfig.model
                }
            };
            
        } catch (error) {
            this.stats.errors++;
            console.error('❌ [Mancy-Groq] Error en Llama 3.1:', error.message);
            
            // Respuesta de error con estilo Mancy
            const errorResponse = this.generateMancyErrorResponse(error, message);
            
            return {
                response: errorResponse,
                enhanced: false,
                error: error.message,
                responseTime: Date.now() - startTime,
                model: this.mancyConfig.model
            };
        }
    }
    
    /**
     * Prepara mensajes con personalidad de Mancy
     */
    prepareMancyMessages(userMemory, currentMessage, knowledgeContext) {
        const messages = [];
        
        // Añadir instrucción del sistema con personalidad de Mancy
        let systemMessage = `Eres ${this.mancyPersonality.name}, ${this.mancyPersonality.role}. `;
        systemMessage += `Tus características principales: ${this.mancyPersonality.traits.join(', ')}. `;
        systemMessage += `Estilo de comunicación: ${this.mancyPersonality.communicationStyle}. `;
        systemMessage += `Tu principio central: "${this.mancyPersonality.corePrinciple}".\n\n`;
        
        systemMessage += `**Instrucciones importantes:**\n`;
        systemMessage += `1. Sé empática y comprensiva, pero también precisa en tus respuestas.\n`;
        systemMessage += `2. Mantén un tono conversacional natural, como si hablaras con un amigo.\n`;
        systemMessage += `3. Si no estás segura de algo, admítelo honestamente.\n`;
        systemMessage += `4. Prioriza el bienestar emocional del usuario en tus respuestas.\n`;
        systemMessage += `5. Usa emojis ocasionalmente para añadir calidez (pero no en exceso).\n`;
        
        // Añadir contexto de conocimiento si existe
        if (knowledgeContext && knowledgeContext.knowledge) {
            systemMessage += `\n**INFORMACIÓN DE CONTEXTO DISPONIBLE:**\n`;
            
            if (knowledgeContext.knowledge.summary) {
                systemMessage += `${knowledgeContext.knowledge.summary}\n`;
            } else if (typeof knowledgeContext.knowledge === 'string') {
                systemMessage += `${knowledgeContext.knowledge}\n`;
            }
            
            systemMessage += `\nUsa esta información para enriquecer tu respuesta de manera natural. `;
            systemMessage += `No cites la fuente directamente a menos que sea relevante para la conversación.`;
            systemMessage += ` Integra los hechos de forma orgánica en tu respuesta.\n`;
        }
        
        messages.push({
            role: 'system',
            content: systemMessage
        });
        
        // Añadir historial de memoria de Mancy (si existe)
        if (userMemory && userMemory.length > 0) {
            const recentMemory = userMemory.slice(-6); // Últimas 6 interacciones (balance entre contexto y tokens)
            
            recentMemory.forEach((item, index) => {
                if (item.content && item.content.trim()) {
                    const role = item.role || 'user';
                    const content = item.content.substring(0, 300); // Limitar longitud
                    
                    // Añadir contexto emocional si está disponible
                    let enhancedContent = content;
                    if (item.metadata && item.metadata.emotionalState) {
                        enhancedContent = `[${item.metadata.emotionalState.type}] ${content}`;
                    }
                    
                    messages.push({
                        role: role,
                        content: enhancedContent
                    });
                }
            });
            
            if (recentMemory.length > 0) {
                console.log(`💭 [Mancy-Groq] Cargado ${recentMemory.length} mensajes de memoria`);
            }
        }
        
        // Añadir mensaje actual con análisis emocional
        const emotionalAnalysis = this.analyzeEmotionalTone(currentMessage);
        let enhancedCurrentMessage = currentMessage.substring(0, 800); // Limitar longitud
        
        if (emotionalAnalysis.intensity > 0.6) {
            enhancedCurrentMessage = `[Usuario: ${emotionalAnalysis.primaryEmotion}] ${enhancedCurrentMessage}`;
        }
        
        messages.push({
            role: 'user',
            content: enhancedCurrentMessage
        });
        
        return messages;
    }
    
    /**
     * Analiza el tono emocional del mensaje
     */
    analyzeEmotionalTone(message) {
        const lowerMsg = message.toLowerCase();
        
        const emotions = {
            happy: ['feliz', 'contento', 'alegre', 'emocionado', 'genial', 'maravilloso'],
            sad: ['triste', 'deprimido', 'desanimado', 'melancólico', 'abatido'],
            angry: ['enojado', 'furioso', 'molesto', 'irritado', 'enfadado'],
            anxious: ['ansioso', 'nervioso', 'preocupado', 'estresado', 'asustado'],
            curious: ['pregunta', 'cómo', 'por qué', 'qué es', 'curioso', 'interesante']
        };
        
        let detectedEmotions = [];
        let intensity = 0;
        
        for (const [emotion, keywords] of Object.entries(emotions)) {
            for (const keyword of keywords) {
                if (lowerMsg.includes(keyword)) {
                    detectedEmotions.push(emotion);
                    intensity += 0.2;
                    break;
                }
            }
        }
        
        // Análisis de signos de puntuación
        const questionMarks = (message.match(/\?/g) || []).length;
        const exclamationMarks = (message.match(/!/g) || []).length;
        
        if (questionMarks > 2) intensity += 0.1;
        if (exclamationMarks > 2) intensity += 0.15;
        
        return {
            primaryEmotion: detectedEmotions[0] || 'neutral',
            allEmotions: detectedEmotions,
            intensity: Math.min(1, intensity),
            hasQuestions: questionMarks > 0,
            hasExclamations: exclamationMarks > 0
        };
    }
    
    /**
     * Formatea la respuesta con estilo Mancy
     */
    formatMancyResponse(response, knowledgeContext, originalMessage) {
        let finalResponse = response.trim();
        
        // Limpiar respuestas de IA (remover prefijos como "Como Mancy...")
        finalResponse = finalResponse.replace(/^(?:Como (?:Mancy|asistente|IA)[,:]?\s*)/i, '');
        finalResponse = finalResponse.replace(/^Soy Mancy y/i, '');
        
        // Asegurar que empiece con mayúscula
        if (finalResponse.length > 0) {
            finalResponse = finalResponse.charAt(0).toUpperCase() + finalResponse.slice(1);
        }
        
        // Añadir toque personal de Mancy (emojis ocasionales)
        const shouldAddEmoji = Math.random() < 0.3 && !finalResponse.includes('💭') && !finalResponse.includes('✨');
        if (shouldAddEmoji) {
            const emojis = ['💭', '✨', '🤔', '💫', '🌸', '☕', '🎵', '🌟'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            
            // Añadir al final o en un lugar apropiado
            if (finalResponse.length < 1800) {
                finalResponse += ` ${randomEmoji}`;
            }
        }
        
        // Asegurar límite de Discord
        if (finalResponse.length > 1900) {
            finalResponse = finalResponse.substring(0, 1897) + '...';
        }
        
        // Añadir indicador de conocimiento sutil si es relevante
        if (knowledgeContext && knowledgeContext.source && !finalResponse.includes('Wikipedia') && !finalResponse.includes('fuente')) {
            const sourceNames = {
                'wikipedia': 'información verificada',
                'dictionary': 'definiciones precisas',
                'quotes': 'citas relevantes',
                'news': 'datos actualizados',
                'science': 'conocimiento científico'
            };
            
            const sourceName = sourceNames[knowledgeContext.source] || 'fuentes confiables';
            
            // Solo añadir si hay espacio y no interrumpe el flujo
            if (finalResponse.length < 1800 && knowledgeContext.detection.confidence > 0.7) {
                finalResponse += `\n\n*[Basado en ${sourceName}]*`;
            }
        }
        
        return finalResponse;
    }
    
    /**
     * Genera respuesta simulada estilo Mancy
     */
    generateMancySimulatedResponse(message, knowledgeContext) {
        const baseResponses = [
            `Hola, soy Mancy. Veo que dices: "${message.substring(0, 80)}...". En este momento estoy en modo de demostración.`,
            `Entiendo tu mensaje. Como asistente virtual, normalmente procesaría esto con mi inteligencia artificial.`,
            `💭 Recibí tu mensaje. En producción, analizaría esto con profundidad y empatía.`,
            `Noté que mencionas algo interesante. En modo real, te daría una respuesta más completa.`
        ];
        
        let response = baseResponses[Math.floor(Math.random() * baseResponses.length)];
        
        if (knowledgeContext) {
            response += `\n\n(Detecté que buscas información sobre: ${knowledgeContext.detection.topic})`;
        }
        
        // Añadir toque Mancy
        response += `\n\n*Prueba mi versión completa con Llama 3.1 para respuestas más inteligentes!*`;
        
        return response;
    }
    
    /**
     * Genera respuesta de error estilo Mancy
     */
    generateMancyErrorResponse(error, originalMessage) {
        const errorType = this.classifyError(error);
        
        const mancyErrorMessages = {
            rate_limit: `Parece que estamos recibiendo muchas solicitudes. Como Mancy, te pido paciencia. ¿Podemos intentarlo en un momento? 💭`,
            timeout: `La respuesta está tardando más de lo esperado. A veces necesito un poco más de tiempo para pensar las cosas bien.`,
            api_error: `Estoy teniendo problemas técnicos momentáneos. Mi principio es ser honesta: no puedo responder ahora mismo.`,
            network: `Hay problemas de conexión. ¿Podrías verificar tu internet? Yo, Mancy, estaré aquí esperando.`,
            default: `Lo siento, algo salió mal. Como siempre digo: "Los errores son oportunidades para aprender". ¿Intentamos de nuevo?`
        };
        
        let response = mancyErrorMessages[errorType] || mancyErrorMessages.default;
        
        // Personalizar con fragmento del mensaje
        if (originalMessage.length < 50) {
            response += `\n\n(Tu mensaje: "${originalMessage}")`;
        }
        
        return response;
    }
    
    /**
     * Clasifica el tipo de error
     */
    classifyError(error) {
        const errorMsg = error.message.toLowerCase();
        
        if (errorMsg.includes('rate limit') || errorMsg.includes('too many requests')) {
            return 'rate_limit';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
            return 'timeout';
        } else if (errorMsg.includes('api key') || errorMsg.includes('authentication')) {
            return 'api_error';
        } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
            return 'network';
        }
        
        return 'default';
    }
    
    /**
     * Obtiene estadísticas del sistema de Mancy
     */
    getKnowledgeStats() {
        const integrationStats = knowledgeIntegration?.getStats?.() || { enabled: false };
        
        const enhancedRate = this.stats.totalCalls > 0 ? 
            (this.stats.enhancedResponses / this.stats.totalCalls) * 100 : 0;
        
        const errorRate = this.stats.totalCalls > 0 ? 
            (this.stats.errors / this.stats.totalCalls) * 100 : 0;
        
        return {
            mancySystem: {
                model: this.mancyConfig.model,
                totalCalls: this.stats.totalCalls,
                llamaCalls: this.stats.llamaCalls,
                enhancedResponses: this.stats.enhancedResponses,
                regularResponses: this.stats.regularResponses,
                errors: this.stats.errors,
                knowledgeQueries: this.stats.knowledgeQueries,
                avgResponseTime: this.stats.totalCalls > 0 ? 
                    Math.round(this.stats.totalTime / this.stats.totalCalls) : 0,
                simulationMode: this.simulationMode,
                knowledgeEnabled: this.knowledgeEnabled,
                enhancedRate: `${enhancedRate.toFixed(1)}%`,
                errorRate: `${errorRate.toFixed(1)}%`
            },
            knowledgeIntegration: integrationStats,
            personality: {
                name: this.mancyPersonality.name,
                traits: this.mancyPersonality.traits,
                principle: this.mancyPersonality.corePrinciple
            }
        };
    }
    
    /**
     * Habilita/deshabilita integración de conocimiento
     */
    setKnowledgeEnabled(enabled) {
        this.knowledgeEnabled = enabled;
        
        if (knowledgeIntegration && knowledgeIntegration.setEnabled) {
            knowledgeIntegration.setEnabled(enabled);
        }
        
        console.log(`🔧 [Mancy-Groq] Conocimiento ${enabled ? 'activado' : 'desactivado'}`);
        return enabled;
    }
    
    /**
     * Cambia el modelo de Llama
     */
    setModel(modelName) {
        const validModels = [
            'llama-3.1-8b-instant',
            'llama-3.1-70b-versatile',
            'mixtral-8x7b-32768',
            'gemma-7b-it'
        ];
        
        if (validModels.includes(modelName)) {
            this.mancyConfig.model = modelName;
            console.log(`🔧 [Mancy-Groq] Modelo cambiado a: ${modelName}`);
            return true;
        }
        
        console.warn(`⚠️ Modelo no válido: ${modelName}. Usando: ${this.mancyConfig.model}`);
        return false;
    }
    
    /**
     * Ajusta temperatura (creatividad)
     */
    setTemperature(temp) {
        if (temp >= 0 && temp <= 1) {
            this.mancyConfig.temperature = temp;
            console.log(`🔧 [Mancy-Groq] Temperatura ajustada a: ${temp}`);
            return true;
        }
        return false;
    }
    
    /**
     * Prueba de conexión con Llama 3.1
     */
    async testConnection() {
        if (this.simulationMode) {
            return {
                success: true,
                mode: 'simulation',
                model: this.mancyConfig.model,
                message: 'Modo simulador - Mancy está lista (sin Groq)',
                personality: this.mancyPersonality.name
            };
        }
        
        try {
            const testMessage = 'Hola Mancy, ¿puedes confirmar que estás conectada?';
            const testResponse = await this.groq.chat.completions.create({
                messages: [
                    {
                        role: 'system',
                        content: `Eres Mancy. Responde brevemente confirmando tu conexión.`
                    },
                    {
                        role: 'user',
                        content: testMessage
                    }
                ],
                model: this.mancyConfig.model,
                max_tokens: 50,
                temperature: 0.3
            });
            
            return {
                success: true,
                mode: 'live',
                model: this.mancyConfig.model,
                response: testResponse.choices[0]?.message?.content || '¡Conectada!',
                latency: 'Llama 3.1 activa',
                personality: this.mancyPersonality.name
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                model: this.mancyConfig.model,
                mode: 'error',
                suggestion: 'Verifica tu API key de Groq para Llama 3.1'
            };
        }
    }
    
    /**
     * Obtiene información del modelo actual
     */
    getModelInfo() {
        return {
            name: this.mancyConfig.model,
            description: this.mancyConfig.model.includes('llama-3.1') ? 
                'Llama 3.1 - Modelo estable y rápido' : 'Modelo Groq',
            capabilities: ['conversación', 'razonamiento', 'empatía', 'conocimiento'],
            maxTokens: this.mancyConfig.maxTokens,
            temperature: this.mancyConfig.temperature
        };
    }
}

export default GroqEnhanced;
