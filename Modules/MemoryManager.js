// memory-manager.js - VERSIÓN CORREGIDA

class MemoryManager {
    constructor() {
        this.conversationHistory = [];
        this.userContext = {
            knowsMancy: false,
            knowsSoulGarden: false,
            knowsLuxo: false,
            lastTopics: [],
            interactionCount: 0
        };
        this.introductionGiven = false;
    }

    addMessage(sender, message) {
        this.conversationHistory.push({
            sender,
            message,
            timestamp: Date.now()
        });
        
        // Actualizar contexto del usuario
        this.updateUserContext(sender, message);
        
        // Mantener historial limitado
        if (this.conversationHistory.length > 30) {
            this.conversationHistory = this.conversationHistory.slice(-30);
        }
    }

    updateUserContext(sender, message) {
        if (sender === 'user') {
            this.userContext.interactionCount++;
            
            // Detectar si ya conoce a Mancy
            if (message.toLowerCase().includes('mancy') || 
                message.includes('historia') ||
                message.includes('cuéntame') ||
                message.includes('presentación')) {
                this.userContext.knowsMancy = true;
            }
            
            // Detectar si sabe sobre Soul Garden/Luxo
            if (message.includes('Luxo') || 
                message.includes('Soul Garden') || 
                message.includes('galletas')) {
                this.userContext.knowsSoulGarden = true;
                this.userContext.knowsLuxo = true;
            }
            
            // Registrar últimos temas
            const topics = this.extractTopics(message);
            this.userContext.lastTopics = [
                ...this.userContext.lastTopics,
                ...topics
            ].slice(-5); // Mantener solo últimos 5 temas
        }
        
        if (sender === 'Mancy' && message.includes('Soy Mancy')) {
            this.introductionGiven = true;
        }
    }

    extractTopics(message) {
        const topics = [];
        const lowerMsg = message.toLowerCase();
        
        if (lowerMsg.includes('guerra') || lowerMsg.includes('civil') || lowerMsg.includes('salvadoreña')) {
            topics.push('guerra_civil');
        }
        if (lowerMsg.includes('luxo') || lowerMsg.includes('coco') || lowerMsg.includes('galletas')) {
            topics.push('soul_garden_lore');
        }
        if (lowerMsg.includes('trabaj') || lowerMsg.includes('empleo') || lowerMsg.includes('cicih')) {
            topics.push('experiencia_laboral');
        }
        if (lowerMsg.includes('historia') || lowerMsg.includes('cuéntame')) {
            topics.push('biografia_mancy');
        }
        
        return topics;
    }

    // NUEVO MÉTODO CRÍTICO: Verificar si debe presentarse
    shouldIntroduceMancy() {
        // REGLA 1: Si ya se presentó en esta conversación, NO repetir
        if (this.introductionGiven && this.userContext.interactionCount > 2) {
            return false;
        }
        
        // REGLA 2: Si el usuario ya sabe quién es (por mención previa), NO presentar
        if (this.userContext.knowsMancy) {
            return false;
        }
        
        // REGLA 3: Si hay contexto de Soul Garden, usar ese en lugar de presentación genérica
        if (this.userContext.knowsSoulGarden) {
            return 'contextual'; // Señal para respuesta contextualizada
        }
        
        // REGLA 4: Solo presentarse en primeras interacciones
        return this.userContext.interactionCount <= 3;
    }

    // NUEVO: Obtener contexto para respuesta personalizada
    getContextualResponse() {
        const lastUserMessage = this.conversationHistory
            .filter(msg => msg.sender === 'user')
            .pop();
        
        if (!lastUserMessage) return null;
        
        const lastTopic = this.userContext.lastTopics[this.userContext.lastTopics.length - 1];
        
        // CONECTORES CONTEXTUALES BASADOS EN HISTORIAL
        if (lastTopic === 'soul_garden_lore') {
            return {
                type: 'continue_lore',
                reference: "Como Secretaria de Guerra de Soul Garden que mencioné antes...",
                avoidGeneric: true
            };
        }
        
        if (lastTopic === 'guerra_civil') {
            return {
                type: 'relate_to_war',
                reference: "Hablando de conflictos, en mi rol en Soul Garden...",
                avoidGeneric: true
            };
        }
        
        return null;
    }

    getRecentHistory(count = 5) {
        return this.conversationHistory.slice(-count);
    }

    // NUEVO: Limpiar presentaciones duplicadas
    filterDuplicateIntroductions(response) {
        if (!response) return response;
        
        // Si la respuesta empieza con "Soy Mancy" y ya se presentó antes
        if (response.startsWith("Soy Mancy") && this.introductionGiven) {
            // Reemplazar con versión contextual
            if (this.userContext.knowsSoulGarden) {
                return "Como ya sabes, soy Mancy, la Secretaria de Guerra de Soul Garden. " + 
                       response.substring("Soy Mancy".length);
            }
            // O simplemente quitar la presentación repetitiva
            return response.replace("Soy Mancy. ¿Qué te gustaría saber sobre mí? ", "");
        }
        
        return response;
    }
}

module.exports = MemoryManager;
