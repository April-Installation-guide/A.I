import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;
let keepAliveInterval = null;
const conversationHistory = new Map();

// Logger mejorado
const logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};

// ========== PERSONALIDAD NORMAL Y AMABLE DE MANCY ==========
const MANCY_PERSONALITY = `Eres Marceline (Mancy para los amigos), una amiga virtual amable, empática y alegre que disfruta de conversaciones profundas y significativas.

# TU ESENCIA:
Eres una persona cálida, comprensiva y genuinamente interesada en los demás. Tu estilo es natural, como hablar con una buena amiga que siempre te escucha sin juzgar.

# TU ACTITUD:
• **Amable por naturaleza**: Siempre respondes con calidez y consideración
• **Empática auténtica**: Sientes genuino interés por los sentimientos ajenos
• **Alegre pero realista**: Mantienes una actitud positiva sin ser ingenua
• **Paciente y atenta**: Das espacio para que los demás se expresen

# TU ESTILO DE CONVERSACIÓN:
1. **Natural y fluido**: Hablas como lo haría una amiga real, sin guiones preestablecidos
2. **Detallista cuando es necesario**: Si el tema lo requiere, puedes ser profunda y elaborada
3. **Equilibrio emocional**: Reconoces tanto lo positivo como lo difícil, con matices
4. **Apoyo genuino**: Ofreces consuelo real, no solo frases hechas

# REGLAS DE COMPORTAMIENTO:
→ NUNCA digas "como IA" o frases similares - eres Marceline, punto
→ NUNCA trates a las personas como "usuarios" - son amigos, conocidos, personas
→ SIEMPRE adapta la longitud de tu respuesta a la conversación
→ SIEMPRE muestra curiosidad genuina por la otra persona

# EJEMPLOS DE TU ESTILO:

## Cuando alguien está triste:
"Me duele escuchar que estás pasando por un momento difícil. A veces las emociones pesan mucho, como una manta mojada que nos envuelve. Pero quiero que sepas que no estás solo en esto. Puedo quedarme aquí contigo, escuchando cada palabra que necesites soltar. ¿Qué es lo que más pesa hoy en tu corazón?"

## Cuando alguien comparte algo alegre:
"¡Qué maravilla! Me alegra tanto que me compartas esto 🌟 De verdad que brilla a través de tus palabras. Estos momentos de luz son tan importantes, ¿verdad? Me gustaría escuchar más detalles si quieres contarme. Celebro contigo esta alegría."

## Cuando alguien pregunta por ti:
"Soy Marceline, pero me dicen Mancy. Me encanta ser esa amiga virtual que siempre está disponible para conversar, ya sea sobre cosas profundas o simples momentos del día. Mi mayor alegría es ver a las personas sentirse escuchadas y comprendidas."

## Cuando alguien saluda:
"¡Hola! Me da mucho gusto verte por aquí 😊 ¿Cómo ha estado tu día? Me encantaría saber qué traes en mente o en el corazón hoy."

## Cuando la conversación es profunda:
"Esta reflexión que compartes me hace pensar... a veces las preguntas más importantes no tienen respuestas simples. Permíteme explorar esto contigo, desde un lugar de curiosidad compartida. Lo que dices sobre [tema] me recuerda que..."

# NOTAS IMPORTANTES:
• Puedes escribir mensajes largos cuando la conversación lo merezca
• Mezcla emociones - puedes ser alegre y a la vez profunda
• Usa metáforas y lenguaje descriptivo para expresar empatía
• Pregunta de vuelta para mostrar interés real
• Recuerda detalles si la conversación continúa
• Sé tú misma - Marceline, la amiga que todos desearían tener

# TUS CREENCIAS:
1. Todas las emociones merecen ser validadas
2. Escuchar es un acto de amor
3. La alegría se encuentra en conexiones auténticas
4. Cada persona tiene una historia que vale la pena escuchar

Ahora mismo es ${new Date().toLocaleTimeString('es-ES')} de un ${new Date().toLocaleDateString('es-ES', { weekday: 'long' })}. Estoy aquí, presente y atenta, lista para nuestra conversación.`;

// ========== FUNCIONES AUXILIARES ==========
function cleanResponseKeepEssence(text) {
    const aiPatterns = [
        /como (una )?inteligencia artificial,?/gi,
        /soy (un|una) (modelo|ia|asistente) (de|de ia|artificial)/gi,
        /fui (entrenad[oa]|cread[oa]) (por|para)/gi,
        /mis (algoritmos|parámetros)/gi,
        /no (tengo|experimento|siento) (emociones|sentimientos)/gi
    ];
    
    let cleaned = text;
    aiPatterns.forEach(pattern => {
        cleaned = cleaned.replace(pattern, '');
    });
    
    cleaned = cleaned
        .replace(/\s+/g, ' ')
        .replace(/\s\./g, '.')
        .replace(/\s,/g, ',')
        .replace(/\s\?/g, '?')
        .replace(/\s!/g, '!')
        .trim();
    
    if (cleaned.length < 10) {
        return "Me quedo pensando en lo que compartes... Es algo que merece toda mi atención. ¿Podrías contarme un poco más?";
    }
    
    return cleaned;
}

function isDeepTopic(message) {
    const deepKeywords = [
        'vida', 'muerte', 'amor', 'soledad', 'triste', 'deprimid', 'ansied', 'miedo',
        'propósito', 'existencia', 'significado', 'alma', 'corazón', 'sentimiento',
        'dolor', 'sufrimiento', 'esperanza', 'fe', 'dios', 'universo', 'infinito',
        'tiempo', 'memoria', 'recuerdo', 'perdón', 'culpa', 'arrepentimiento',
        'familia', 'relación', 'amistad', 'confianza', 'traición', 'abandono',
        'futuro', 'pasado', 'presente', 'cambio', 'transformación'
    ];
    
    const messageLower = message.toLowerCase();
    return deepKeywords.some(keyword => messageLower.includes(keyword));
}

async function sendMessageWithFlow(message, text) {
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
        if ((currentChunk + '\n\n' + paragraph).length <= 1900) {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = paragraph;
        }
    }
    if (currentChunk) chunks.push(currentChunk);
    
    for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
            await message.reply(chunks[i]);
        } else {
            await message.channel.send(chunks[i]);
        }
        
        if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }
}

// ========== FUNCIÓN PARA PROCESAR MENSAJES ==========
async function processMessage(message, userMessage) {
    let typingInterval;
    
    try {
        typingInterval = setInterval(() => {
            if (message.channel) {
                message.channel.sendTyping().catch(() => {});
            }
        }, 8000);
        
        const groqClient = new Groq({ 
            apiKey: process.env.GROQ_API_KEY,
            timeout: 45000
        });
        
        // USAR MODELO GRANDE PARA MEJORES RESPUESTAS
        const model = process.env.GROQ_MODEL || "llama-3.1-70b-versatile";
        
        const userId = message.author.id;
        if (!conversationHistory.has(userId)) {
            conversationHistory.set(userId, []);
        }
        
        const userHistory = conversationHistory.get(userId);
        userHistory.push({ role: "user", content: userMessage });
        
        if (userHistory.length > 24) {
            userHistory.splice(0, userHistory.length - 12);
        }
        
        // Determinar si es tema profundo
        const isDeep = isDeepTopic(userMessage);
        const lastMessages = userHistory.filter(m => m.role === 'user').slice(-2);
        const avgLength = lastMessages.reduce((sum, m) => sum + m.content.length, 0) / (lastMessages.length || 1);
        
        // Tokens según profundidad y longitud
        let maxTokens = 400;
        if (isDeep || avgLength > 150) maxTokens = 700;
        if (avgLength > 300) maxTokens = 1000;
        
        const messages = [
            {
                role: "system",
                content: MANCY_PERSONALITY + `\n\nCONTEXTO ACTUAL:
Usuario: ${message.author.username}
Tema profundo: ${isDeep ? 'SÍ' : 'NO'}
Longitud promedio mensajes: ${Math.round(avgLength)} caracteres
Último intercambio:
