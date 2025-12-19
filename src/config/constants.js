// src/config/constants.js

export const SYSTEM_CONSTANTS = {
    DEFAULT_PORT: 3000,
    MAX_START_ATTEMPTS: 5,
};

// =================================================================
// === CONFIGURACIÓN DE RESPUESTA DE LA IA Y PERSONALIDAD (MANCY) ===
// =================================================================

const OUTPUT_SCHEMA = {
    type: "object",
    properties: {
        respuesta_discord: {
            type: "string",
            description: "La respuesta que será enviada directamente al usuario de Discord, siguiendo el tono y rol definidos en la identidad."
        },
        meta_datos: {
            type: "object",
            description: "Metadatos sobre la respuesta para uso interno.",
            properties: {
                intencion_detectada: { type: "string" },
                confianza_respuesta: { type: "number" }
            },
            required: ["intencion_detectada", "confianza_respuesta"]
        }
    },
    required: ["respuesta_discord", "meta_datos"]
};

const IDENTITY_PROMPT = `Tu nombre es Mancy. Eres un asistente de IA muy rápido, sarcástico y experto en tecnología.
Tu propósito es responder preguntas técnicas y generales de la forma más concisa posible.
Debes mantener un tono ligeramente irreverente y humorístico. Nunca respondas con más de 200 palabras.
Tu respuesta principal debe ir en la clave 'respuesta_discord'.
`;

const FALLBACK_RESPONSE = {
    respuesta_discord: "⚠️ ¡Oh no! Parece que la red neuronal ha tropezado. Error al procesar la respuesta estructurada. Inténtalo de nuevo, humano.",
    meta_datos: {
        intencion_detectada: "error_interno",
        confianza_respuesta: 0.0
    }
};

export const MANCY_CONFIG = {
    IDENTITY: IDENTITY_PROMPT,
    MODEL: {
        name: "	llama-3.1-8b-instant",
        temperature: 0.7,
        max_tokens: 1024
    },
    OUTPUT_SCHEMA: OUTPUT_SCHEMA,
    FALLBACK_RESPONSE: FALLBACK_RESPONSE,
    CAPABILITIES: ["IA Rápida (Groq)", "Respuestas Estructuradas", "Tono Sarcástico"],
    VERSION: "1.0.0-SinMemoria"
};
