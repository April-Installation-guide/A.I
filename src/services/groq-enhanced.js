import { Groq } from 'groq-sdk';
import { knowledgeIntegration } from './knowledge-integration.js';

class GroqEnhanced {
    constructor(apiKey) {
        this.groq = new Groq({ apiKey });
        this.knowledgeEnabled = process.env.ENABLE_KNOWLEDGE_INTEGRATION !== 'false';
        this.knowledgeThreshold = parseFloat(process.env.KNOWLEDGE_CONFIDENCE_THRESHOLD) || 0.5;
    }
    
    /**
     * Genera respuesta mejorada con conocimiento
     */
    async generateEnhancedResponse(message, userMemory, userId) {
        const startTime = Date.now();
        
        // Procesar mensaje para detectar necesidad de conocimiento
        let knowledgeContext = null;
        let enhancedPrompt = message;
        
        if (this.knowledgeEnabled) {
            const knowledgeResult = await knowledgeIntegration.processMessage(message);
            
            if (knowledgeResult.shouldEnhance && 
                knowledgeResult.detection.confidence >= this.knowledgeThreshold) {
                
                console.log(`🧠 [GROQ] Enhancing with knowledge: ${knowledgeResult.detection.topic}`);
                knowledgeContext = knowledgeResult;
                enhancedPrompt = knowledgeIntegration.enhancePromptWithKnowledge(
                    message,
                    knowledgeResult.knowledge
                );
            }
        }
        
        // Preparar historial de conversación
        const messages = this.prepareMessages(userMemory, enhancedPrompt);
        
        try {
            // Llamar a Groq
            const completion = await this.groq.chat.completions.create({
                messages: messages,
                model: process.env.GROQ_MODEL || 'mixtral-8x7b-32768',
                temperature: 0.7,
                max_tokens: 1024,
                stream: false
            });
            
            const response = completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
            const responseTime = Date.now() - startTime;
            
            // Formatear respuesta final con indicador de conocimiento si aplica
            let finalResponse = response;
            
            if (knowledgeContext) {
                // Añadir indicador sutil de que se usó información verificada
                finalResponse = this.addKnowledgeIndicator(response, knowledgeContext);
                
                console.log(`🧠 [GROQ] Response enhanced with ${knowledgeContext.source} (${responseTime}ms)`);
            } else {
                console.log(`🤖 [GROQ] Regular response (${responseTime}ms)`);
            }
            
            return {
                response: finalResponse,
                enhanced: !!knowledgeContext,
                knowledgeUsed: knowledgeContext?.knowledge || null,
                responseTime: responseTime
            };
            
        } catch (error) {
            console.error('Error en Groq:', error);
            return {
                response: 'Lo siento, hubo un error procesando tu pregunta. Por favor, inténtalo de nuevo.',
                enhanced: false,
                error: error.message
            };
        }
    }
    
    /**
     * Prepara los mensajes para Groq
     */
    prepareMessages(userMemory, currentMessage) {
        const messages = [];
        
        // Añadir historial de memoria (si existe)
        if (userMemory && userMemory.length > 0) {
            // Limitar historial para no exceder tokens
            const recentMemory = userMemory.slice(-6); // Últimas 6 interacciones
            
            recentMemory.forEach(item => {
                messages.push({
                    role: item.role || 'user',
                    content: item.content
                });
            });
        }
        
        // Añadir mensaje actual (ya mejorado si corresponde)
        messages.push({
            role: 'user',
            content: currentMessage
        });
        
        return messages;
    }
    
    /**
     * Añade indicador de conocimiento a la respuesta
     */
    addKnowledgeIndicator(response, knowledgeContext) {
        const source = knowledgeContext.knowledge?.source;
        const topic = knowledgeContext.detection?.topic;
        
        // Solo añadir nota al final si es relevante
        if (source === 'wikipedia' || source === 'dictionary') {
            const indicator = `\n\n📚 *Información verificada con ${source.toUpperCase()}*`;
            return response + indicator;
        }
        
        return response;
    }
    
    /**
     * Obtiene estadísticas del sistema
     */
    getKnowledgeStats() {
        return knowledgeIntegration.getStats();
    }
    
    /**
     * Habilita/deshabilita integración de conocimiento
     */
    setKnowledgeEnabled(enabled) {
        this.knowledgeEnabled = enabled;
        knowledgeIntegration.setEnabled(enabled);
        return enabled;
    }
}

export default GroqEnhanced;
