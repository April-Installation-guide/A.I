const ResponseGenerator = require('./src/bot/response-generator');

class MancyApp {
    constructor() {
        this.responseGenerator = new ResponseGenerator();
        this.lastBotResponse = null;
    }
    
    async processUserMessage(userInput) {
        try {
            // Generar respuesta usando el contexto
            const response = this.responseGenerator.generateResponse(
                userInput, 
                this.lastBotResponse
            );
            
            // Guardar para siguiente turno
            this.lastBotResponse = response;
            
            return {
                success: true,
                response,
                timestamp: new Date()
            };
        } catch (error) {
            console.error("Error processing message:", error);
            return {
                success: false,
                response: "Lo siento, hubo un error procesando tu mensaje.",
                error: error.message
            };
        }
    }
    
    // Para reiniciar conversación
    resetConversation() {
        this.responseGenerator = new ResponseGenerator();
        this.lastBotResponse = null;
    }
}

module.exports = MancyApp;
