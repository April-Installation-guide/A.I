const ContextManager = require('../memory/context-manager');

class ResponseGenerator {
    constructor() {
        this.context = new ContextManager();
        this.templates = {
            introduction: {
                full: "Soy Mancy. ¿Qué te gustaría saber sobre mí? Puedo contarte mi historia, mi misión en Soul Garden, o mis principios.",
                contextual: "Como ya sabes, soy Mancy. ",
                soulgarden: "Como Secretaria de Guerra de Soul Garden, "
            },
            story: {
                full: "¡Vamos a contar una historia! Soy Mancy, tu compañera digital...",
                short: "Mi historia comienza...",
                soulgarden: "En el contexto de Soul Garden, mi rol como Secretaria de Guerra..."
            }
        };
    }
    
    generateResponse(userInput, previousBotResponse = null) {
        // Actualizar contexto con el intercambio anterior
        if (previousBotResponse) {
            this.context.addExchange("", previousBotResponse);
        }
        
        // Analizar qué necesita el usuario
        const intent = this.analyzeUserIntent(userInput);
        
        // Verificar si debe dar introducción completa
        const introType = this.context.shouldGiveFullIntroduction();
        
        // Generar respuesta apropiada
        let response = '';
        
        switch(intent.primary) {
            case 'request_introduction':
            case 'request_story':
                response = this.generateIntroductionResponse(introType, intent);
                break;
                
            case 'topic_soulgarden':
                response = this.generateSoulGardenResponse(userInput);
                break;
                
            case 'topic_war':
                response = this.generateWarResponse(userInput);
                break;
                
            case 'topic_work':
                response = this.generateWorkResponse(userInput);
                break;
                
            default:
                response = this.generateGeneralResponse(userInput);
        }
        
        // Agregar puente contextual si existe
        const bridge = this.context.getContextualBridge();
        if (bridge && !response.startsWith(bridge)) {
            response = bridge + response;
        }
        
        // Registrar el intercambio en contexto
        this.context.addExchange(userInput, response);
        
        return response;
    }
    
    generateIntroductionResponse(introType, intent) {
        // EVITAR REPETICIÓN: Lógica crítica
        switch(introType) {
            case false:
                // Ya se presentó antes, usar versión corta
                return this.context.getStoryIntroduction();
                
            case 'contextual_only':
                // Usuario ya conoce Soul Garden
                return this.templates.introduction.soulgarden + 
                       "¿Qué aspecto de mi historia te interesa?";
                
            default:
                // Primera vez, dar introducción completa
                return this.templates.introduction.full;
        }
    }
    
    // ... otros métodos de generación específicos
}

module.exports = ResponseGenerator;
