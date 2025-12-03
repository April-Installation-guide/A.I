import express from 'express';
import { Client, GatewayIntentBits } from "discord.js";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import axios from 'axios';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== BASE DE DATOS DE MEMORIA AVANZADA ==========
const dbFile = join(__dirname, 'memory-db.json');
const defaultData = {
    users: {},
    conversations: {},
    knowledge: {},
    statistics: {
        totalMessages: 0,
        totalUsers: 0,
        queriesProcessed: 0
    },
    reasoningLogs: [],
    userProfiles: {}
};

const adapter = new JSONFile(dbFile);
const db = new Low(adapter, defaultData);

// Inicializar base de datos
await db.read();
if (!db.data) db.data = defaultData;
await db.write();

console.log('💾 Memoria avanzada inicializada');

// ========== SISTEMA DE MEMORIA JERÁRQUICA ==========
class MemoriaJerarquica {
    constructor() {
        this.memoriaCorta = new Map(); // Últimas 24 horas
        this.memoriaLarga = db; // Base de datos persistente
        this.perfilesUsuarios = new Map();
        this.contextoGlobal = {
            ultimosTemas: [],
            patronesConversacion: new Map(),
            conocimientoAdquirido: new Set()
        };
        
        console.log('🧠 Memoria jerárquica activada (corta + larga + perfiles)');
    }
    
    async guardarMensaje(userId, rol, contenido, metadata = {}) {
        const timestamp = Date.now();
        const mensajeId = `${userId}_${timestamp}`;
        
        // Memoria corta (últimas 24h)
        if (!this.memoriaCorta.has(userId)) {
            this.memoriaCorta.set(userId, []);
        }
        const historialCorto = this.memoriaCorta.get(userId);
        historialCorto.push({
            id: mensajeId,
            rol,
            contenido,
            timestamp,
            metadata
        });
        
        // Limpiar mensajes antiguos (>24h)
        const veinticuatroHoras = 24 * 60 * 60 * 1000;
        const historialFiltrado = historialCorto.filter(msg => 
            timestamp - msg.timestamp < veinticuatroHoras
        );
        this.memoriaCorta.set(userId, historialFiltrado);
        
        // Memoria larga (persistente)
        await this.memoriaLarga.read();
        
        if (!this.memoriaLarga.data.users[userId]) {
            this.memoriaLarga.data.users[userId] = {
                id: userId,
                totalMensajes: 0,
                primerMensaje: timestamp,
                ultimoMensaje: timestamp,
                intereses: new Set(),
                estiloComunicacion: {}
            };
            this.memoriaLarga.data.statistics.totalUsers++;
        }
        
        const usuario = this.memoriaLarga.data.users[userId];
        usuario.totalMensajes++;
        usuario.ultimoMensaje = timestamp;
        
        // Extraer y guardar intereses
        const intereses = this.extraerIntereses(contenido);
        intereses.forEach(interes => usuario.intereses.add(interes));
        
        // Guardar conversación estructurada
        if (!this.memoriaLarga.data.conversations[userId]) {
            this.memoriaLarga.data.conversations[userId] = [];
        }
        
        this.memoriaLarga.data.conversations[userId].push({
            id: mensajeId,
            rol,
            contenido,
            timestamp,
            metadata,
            embedding: await this.generarEmbedding(contenido) // Para búsqueda semántica
        });
        
        // Limitar historial a 1000 mensajes por usuario
        if (this.memoriaLarga.data.conversations[userId].length > 1000) {
            this.memoriaLarga.data.conversations[userId] = 
                this.memoriaLarga.data.conversations[userId].slice(-1000);
        }
        
        // Estadísticas globales
        this.memoriaLarga.data.statistics.totalMessages++;
        this.memoriaLarga.data.statistics.queriesProcessed++;
        
        await this.memoriaLarga.write();
        
        // Actualizar perfil en tiempo real
        await this.actualizarPerfilUsuario(userId, contenido, rol);
        
        return mensajeId;
    }
    
    async obtenerHistorialCompleto(userId, limite = 50) {
        // Combinar memoria corta y larga
        const historialCorto = this.memoriaCorta.get(userId) || [];
        await this.memoriaLarga.read();
        const historialLargo = this.memoriaLarga.data.conversations[userId] || [];
        
        // Combinar y ordenar por timestamp
        const historialCompleto = [...historialCorto, ...historialLargo]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limite);
        
        return historialCompleto;
    }
    
    async obtenerContextoEnriquecido(userId, consultaActual) {
        await this.memoriaLarga.read();
        const usuario = this.memoriaLarga.data.users[userId] || {};
        const conversaciones = this.memoriaLarga.data.conversations[userId] || [];
        
        // 1. Contexto personalizado del usuario
        const contextoUsuario = `
PERFIL DE USUARIO [${userId}]:
- Total mensajes: ${usuario.totalMensajes || 0}
- Intereses detectados: ${Array.from(usuario.intereses || []).join(', ')}
- Estilo de comunicación: ${JSON.stringify(usuario.estiloComunicacion || {})}
- Actividad: ${usuario.ultimoMensaje ? new Date(usuario.ultimoMensaje).toLocaleDateString() : 'Nueva'}
`;
        
        // 2. Conversaciones relevantes (búsqueda semántica)
        const conversacionesRelevantes = await this.buscarConversacionesRelevantes(
            userId, 
            consultaActual, 
            5
        );
        
        let contextoConversaciones = 'CONVERSACIONES PREVIAS RELEVANTES:\n';
        conversacionesRelevantes.forEach((conv, i) => {
            contextoConversaciones += `${i + 1}. ${conv.rol}: ${conv.contenido.substring(0, 100)}...\n`;
        });
        
        // 3. Conocimiento aprendido del usuario
        const conocimientoUsuario = this.extraerConocimientoUsuario(userId);
        
        return {
            perfil: contextoUsuario,
            conversaciones: contextoConversaciones,
            conocimiento: conocimientoUsuario,
            estadisticas: {
                totalMensajes: usuario.totalMensajes || 0,
                intereses: Array.from(usuario.intereses || []),
                antiguedad: usuario.primerMensaje ? 
                    Math.floor((Date.now() - usuario.primerMensaje) / (1000 * 60 * 60 * 24)) + ' días' : 'Nuevo'
            }
        };
    }
    
    async buscarConversacionesRelevantes(userId, consulta, limite = 5) {
        await this.memoriaLarga.read();
        const conversaciones = this.memoriaLarga.data.conversations[userId] || [];
        
        if (conversaciones.length === 0) return [];
        
        // Embedding simple de la consulta
        const consultaEmbedding = this.generarEmbeddingSimple(consulta);
        
        // Calcular similitud (simplificado)
        const conversacionesConSimilitud = conversaciones.map(conv => ({
            ...conv,
            similitud: this.calcularSimilitud(
                consultaEmbedding,
                conv.embedding || this.generarEmbeddingSimple(conv.contenido)
            )
        }));
        
        // Ordenar por similitud y limitar
        return conversacionesConSimilitud
            .sort((a, b) => b.similitud - a.similitud)
            .slice(0, limite)
            .filter(conv => conv.similitud > 0.3); // Umbral de relevancia
    }
    
    generarEmbeddingSimple(texto) {
        // Embedding simplificado para búsqueda semántica básica
        const palabras = texto.toLowerCase().split(/\W+/).filter(w => w.length > 2);
        const embedding = {};
        
        palabras.forEach(palabra => {
            embedding[palabra] = (embedding[palabra] || 0) + 1;
        });
        
        return embedding;
    }
    
    calcularSimilitud(embedding1, embedding2) {
        const palabras = new Set([
            ...Object.keys(embedding1),
            ...Object.keys(embedding2)
        ]);
        
        let productoPunto = 0;
        let magnitud1 = 0;
        let magnitud2 = 0;
        
        palabras.forEach(palabra => {
            const val1 = embedding1[palabra] || 0;
            const val2 = embedding2[palabra] || 0;
            
            productoPunto += val1 * val2;
            magnitud1 += val1 * val1;
            magnitud2 += val2 * val2;
        });
        
        magnitud1 = Math.sqrt(magnitud1);
        magnitud2 = Math.sqrt(magnitud2);
        
        if (magnitud1 === 0 || magnitud2 === 0) return 0;
        
        return productoPunto / (magnitud1 * magnitud2);
    }
    
    async generarEmbedding(texto) {
        // Para producción usar un servicio de embeddings real
        // Esta es una versión simplificada
        return this.generarEmbeddingSimple(texto);
    }
    
    extraerIntereses(texto) {
        const intereses = new Set();
        const palabrasClave = {
            programacion: ['código', 'programar', 'javascript', 'python', 'git', 'github', 'api'],
            ciencia: ['ciencia', 'investigación', 'experimento', 'teoría', 'física', 'química'],
            arte: ['arte', 'pintura', 'música', 'literatura', 'cine', 'diseño'],
            tecnologia: ['tecnología', 'app', 'software', 'hardware', 'inteligencia artificial'],
            filosofia: ['filosofía', 'ética', 'moral', 'existencial', 'pensamiento'],
            historia: ['historia', 'antiguo', 'medieval', 'moderno', 'guerra', 'civilización']
        };
        
        const textoLower = texto.toLowerCase();
        
        Object.entries(palabrasClave).forEach(([interes, palabras]) => {
            if (palabras.some(palabra => textoLower.includes(palabra))) {
                intereses.add(interes);
            }
        });
        
        return intereses;
    }
    
    async actualizarPerfilUsuario(userId, contenido, rol) {
        if (!this.perfilesUsuarios.has(userId)) {
            this.perfilesUsuarios.set(userId, {
                estilo: {},
                preferencias: new Set(),
                patrones: [],
                nivelConocimiento: 'principiante',
                emocionesDetectadas: []
            });
        }
        
        const perfil = this.perfilesUsuarios.get(userId);
        
        // Analizar estilo de comunicación
        const analisis = this.analizarEstiloComunicacion(contenido);
        Object.assign(perfil.estilo, analisis);
        
        // Detectar emociones
        const emocion = this.detectarEmocion(contenido);
        if (emocion) {
            perfil.emocionesDetectadas.push({
                emocion,
                timestamp: Date.now(),
                contexto: contenido.substring(0, 50)
            });
        }
        
        // Limitar historial de emociones
        if (perfil.emocionesDetectadas.length > 100) {
            perfil.emocionesDetectadas = perfil.emocionesDetectadas.slice(-100);
        }
        
        this.perfilesUsuarios.set(userId, perfil);
        
        // Guardar en base de datos
        await this.memoriaLarga.read();
        if (!this.memoriaLarga.data.userProfiles[userId]) {
            this.memoriaLarga.data.userProfiles[userId] = {};
        }
        this.memoriaLarga.data.userProfiles[userId] = perfil;
        await this.memoriaLarga.write();
    }
    
    analizarEstiloComunicacion(texto) {
        const analisis = {
            longitudPromedio: texto.length,
            usoEmojis: (texto.match(/[\u{1F600}-\u{1F64F}]/gu) || []).length,
            usoMayusculas: (texto.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length,
            preguntasFrecuentes: texto.includes('?'),
            formalidad: this.calcularFormalidad(texto),
            emocionalidad: this.calcularEmocionalidad(texto)
        };
        
        return analisis;
    }
    
    calcularFormalidad(texto) {
        const palabrasFormales = ['por favor', 'gracias', 'agradecería', 'cordialmente', 'atentamente'];
        const palabrasInformales = ['bro', 'lol', 'xd', 'jaja', 'ok', 'ahi'];
        
        let score = 0.5; // Neutral
        
        palabrasFormales.forEach(palabra => {
            if (texto.toLowerCase().includes(palabra)) score += 0.1;
        });
        
        palabrasInformales.forEach(palabra => {
            if (texto.toLowerCase().includes(palabra)) score -= 0.1;
        });
        
        return Math.max(0, Math.min(1, score));
    }
    
    calcularEmocionalidad(texto) {
        const emocionesPositivas = ['❤️', '😊', '🎉', '✨', '👍', '😍', '😄'];
        const emocionesNegativas = ['😠', '😢', '💔', '👎', '😡', '😞'];
        
        let emocionalidad = 0;
        
        emocionesPositivas.forEach(emoji => {
            const regex = new RegExp(emoji, 'gu');
            emocionalidad += (texto.match(regex) || []).length * 0.2;
        });
        
        emocionesNegativas.forEach(emoji => {
            const regex = new RegExp(emoji, 'gu');
            emocionalidad -= (texto.match(regex) || []).length * 0.2;
        });
        
        // Palabras emocionales
        const palabrasEmocionales = [
            'amo', 'adoro', 'genial', 'increíble', 'fantástico', // Positivas
            'odio', 'horrible', 'terrible', 'triste', 'enojo'   // Negativas
        ];
        
        palabrasEmocionales.forEach(palabra => {
            if (texto.toLowerCase().includes(palabra)) {
                emocionalidad += palabra === 'odio' || palabra === 'horrible' ? -0.3 : 0.3;
            }
        });
        
        return Math.max(-1, Math.min(1, emocionalidad));
    }
    
    detectarEmocion(texto) {
        const emociones = {
            alegria: ['😊', '😄', '😂', '🤣', '😍', '🥰', 'genial', 'increíble', 'feliz'],
            tristeza: ['😢', '😭', '😔', '💔', 'triste', 'deprimido', 'mal'],
            enojo: ['😠', '😡', '🤬', 'odio', 'enfadado', 'molesto', 'ira'],
            sorpresa: ['😲', '🤯', '😱', 'wow', 'increíble', 'sorprendente'],
            neutral: ['ok', 'vale', 'entendido', 'claro']
        };
        
        for (const [emocion, indicadores] of Object.entries(emociones)) {
            for (const indicador of indicadores) {
                if (texto.toLowerCase().includes(indicador.toLowerCase()) || 
                    texto.includes(indicador)) {
                    return emocion;
                }
            }
        }
        
        return null;
    }
    
    extraerConocimientoUsuario(userId) {
        await this.memoriaLarga.read();
        const conversaciones = this.memoriaLarga.data.conversations[userId] || [];
        
        const conocimiento = {
            hechosAprendidos: [],
            preferencias: new Set(),
            temasRecurrentes: []
        };
        
        // Analizar últimas 50 conversaciones
        const conversacionesRecientes = conversaciones.slice(-50);
        
        conversacionesRecientes.forEach(conv => {
            if (conv.rol === 'user') {
                // Extraer declaraciones fácticas
                if (this.esDeclaracionFactica(conv.contenido)) {
                    conocimiento.hechosAprendidos.push({
                        hecho: conv.contenido,
                        timestamp: conv.timestamp
                    });
                }
                
                // Extraer preferencias
                const preferencias = this.extraerPreferencias(conv.contenido);
                preferencias.forEach(p => conocimiento.preferencias.add(p));
            }
        });
        
        return conocimiento;
    }
    
    esDeclaracionFactica(texto) {
        const patronesFacticos = [
            /(me gusta|amo|adoro|disfruto|prefiero).+/i,
            /(soy|estoy|tengo|vivo en|trabajo en|estudio).+/i,
            /(mi [a-z]+ es|mi [a-z]+ son).+/i
        ];
        
        return patronesFacticos.some(patron => patron.test(texto));
    }
    
    extraerPreferencias(texto) {
        const preferencias = [];
        const patrones = [
            /me gusta (?:el|la|los|las) (.+?)(?:,|\.|$)/i,
            /(?:amo|adoro) (.+?)(?:,|\.|$)/i,
            /(?:odio|detesto) (.+?)(?:,|\.|$)/i,
            /prefiero (.+?) (?:que|a)/i
        ];
        
        patrones.forEach(patron => {
            const match = texto.match(patron);
            if (match && match[1]) {
                preferencias.push(match[1].trim());
            }
        });
        
        return preferencias;
    }
    
    // ========== RAZONAMIENTO Y ANÁLISIS ==========
    
    async analizarConsulta(consulta, userId) {
        const analisis = {
            tipoConsulta: this.clasificarConsulta(consulta),
            complejidad: this.calcularComplejidad(consulta),
            requiereInvestigacion: this.requiereInvestigacionExterna(consulta),
            contextoNecesario: await this.determinarContextoNecesario(consulta, userId),
            posiblesSesgos: this.detectarSesgosPotenciales(consulta),
            claridad: this.evaluarClaridad(consulta)
        };
        
        // Guardar análisis en logs de razonamiento
        await this.memoriaLarga.read();
        this.memoriaLarga.data.reasoningLogs.push({
            userId,
            consulta,
            analisis,
            timestamp: Date.now()
        });
        
        // Limitar logs
        if (this.memoriaLarga.data.reasoningLogs.length > 1000) {
            this.memoriaLarga.data.reasoningLogs = 
                this.memoriaLarga.data.reasoningLogs.slice(-1000);
        }
        
        await this.memoriaLarga.write();
        
        return analisis;
    }
    
    clasificarConsulta(consulta) {
        const consultaLower = consulta.toLowerCase();
        
        const categorias = {
            factual: ['qué es', 'quién fue', 'cuándo', 'dónde', 'cómo funciona'],
            explicativa: ['por qué', 'cómo es que', 'explica', 'describe'],
            comparativa: ['vs', 'versus', 'comparar', 'diferencia entre'],
            opinativa: ['qué piensas', 'cuál es tu opinión', 'crees que'],
            creativa: ['inventa', 'crea', 'imagina', 'escribe', 'cuenta'],
            tecnica: ['código', 'programar', 'instalar', 'configurar', 'error'],
            personal: ['cómo estás', 'qué haces', 'te gusta', 'prefieres']
        };
        
        for (const [categoria, palabras] of Object.entries(categorias)) {
            if (palabras.some(palabra => consultaLower.includes(palabra))) {
                return categoria;
            }
        }
        
        return 'general';
    }
    
    calcularComplejidad(consulta) {
        const factores = {
            longitud: consulta.length / 100, // 0-1
            preguntas: (consulta.match(/\?/g) || []).length * 0.3,
            tecnicismos: (consulta.match(/\b(api|backend|frontend|database|algorithm)\b/gi) || []).length * 0.2,
            conectores: (consulta.match(/\b(y|o|pero|aunque|sin embargo|por lo tanto)\b/gi) || []).length * 0.1
        };
        
        let complejidad = 0;
        Object.values(factores).forEach(valor => {
            complejidad += Math.min(valor, 1);
        });
        
        return Math.min(1, complejidad);
    }
    
    requiereInvestigacionExterna(consulta) {
        const temasLocales = [
            'cómo estás', 'qué haces', 'hola', 'buenos días',
            'gracias', 'de nada', 'adiós'
        ];
        
        const consultaLower = consulta.toLowerCase();
        
        // Si es saludo/conversación trivial, no necesita investigación
        if (temasLocales.some(tema => consultaLower.includes(tema))) {
            return false;
        }
        
        // Si pregunta por hechos concretos, necesita investigación
        const necesitaHechos = [
            'qué es', 'quién', 'cuándo', 'dónde', 'capital de',
            'clima en', 'definición de', 'historia de'
        ];
        
        return necesitaHechos.some(palabra => consultaLower.includes(palabra));
    }
    
    async determinarContextoNecesario(consulta, userId) {
        await this.memoriaLarga.read();
        const usuario = this.memoriaLarga.data.users[userId] || {};
        
        const contexto = {
            historialRelevante: await this.buscarConversacionesRelevantes(userId, consulta, 3),
            interesesUsuario: Array.from(usuario.intereses || []),
            nivelPrevisto: usuario.totalMensajes > 50 ? 'avanzado' : 'básico'
        };
        
        return contexto;
    }
    
    detectarSesgosPotenciales(consulta) {
        const sesgos = [];
        const consultaLower = consulta.toLowerCase();
        
        // Sesgos de lenguaje
        const sesgosLenguaje = {
            emocional: ['odio', 'estúpido', 'ridículo', 'horrible'],
            absoluto: ['nunca', 'siempre', 'todos', 'nadie'],
            polarizado: ['mejor', 'peor', 'superior', 'inferior']
        };
        
        Object.entries(sesgosLenguaje).forEach(([sesgo, palabras]) => {
            if (palabras.some(palabra => consultaLower.includes(palabra))) {
                sesgos.push(sesgo);
            }
        });
        
        return sesgos;
    }
    
    evaluarClaridad(consulta) {
        let claridad = 1.0;
        
        // Penalizar por ambigüedad
        if (consulta.length < 5) claridad -= 0.3;
        if (consulta.length > 200) claridad -= 0.2;
        if ((consulta.match(/\?/g) || []).length > 1) claridad -= 0.1;
        
        // Verificar términos vagos
        const terminosVagos = ['algo', 'alguien', 'algún', 'cosa', 'eso', 'aquello'];
        terminosVagos.forEach(termino => {
            if (consulta.toLowerCase().includes(termino)) {
                claridad -= 0.05;
            }
        });
        
        return Math.max(0.3, claridad);
    }
    
    // ========== GENERACIÓN DE CONTEXTO MEJORADO ==========
    
    async generarContextoParaIA(userId, consulta, analisisConsulta) {
        const contextoUsuario = await this.obtenerContextoEnriquecido(userId, consulta);
        
        // Construir contexto estructurado
        const contexto = `
# 🧠 CONTEXTO DE RAZONAMIENTO - MANCY A.I.

## 📊 ANÁLISIS DE CONSULTA
- TIPO: ${analisisConsulta.tipoConsulta.toUpperCase()}
- COMPLEJIDAD: ${(analisisConsulta.complejidad * 100).toFixed(0)}%
- CLARIDAD: ${(analisisConsulta.claridad * 100).toFixed(0)}%
- SESGOS DETECTADOS: ${analisisConsulta.posiblesSesgos.join(', ') || 'Ninguno'}
- NECESITA INVESTIGACIÓN: ${analisisConsulta.requiereInvestigacion ? 'SÍ' : 'NO'}

## 👤 CONTEXTO DEL USUARIO
${contextoUsuario.perfil}

## 🗣️ ESTILO DE RESPUESTA REQUERIDO
- Nivel: ${contextoUsuario.estadisticas.nivelPrevisto || 'adaptativo'}
- Formalidad: ${(contextoUsuario.estadisticas.formalidad || 0.5) > 0.7 ? 'Alta' : 'Media'}
- Enfoque: ${analisisConsulta.tipoConsulta === 'tecnica' ? 'Técnico preciso' : 'Natural conversacional'}

## 🎯 OBJETIVOS DE RESPUESTA
1. Ser precisa y verificada
2. Adaptarse al nivel del usuario
3. Mantener contexto histórico
4. Fomentar aprendizaje continuo
5. Ser empática pero profesional

## ⚠️ CONSIDERACIONES ESPECIALES
${analisisConsulta.posiblesSesgos.length > 0 ? 
    `- Evitar reforzar sesgos: ${analisisConsulta.posiblesSesgos.join(', ')}` : 
    '- Sin sesgos detectados'}
${analisisConsulta.claridad < 0.7 ? '- La consulta es ambigua, pedir aclaración si es necesario' : ''}

## 💬 CONVERSACIÓN RECIENTE RELEVANTE
${contextoUsuario.conversaciones}

## 🎓 CONOCIMIENTO PREVIO DEL USUARIO
${contextoUsuario.conocimiento ? 
    `- Hechos conocidos: ${contextoUsuario.conocimiento.hechosAprendidos.length}\n` +
    `- Preferencias: ${Array.from(contextoUsuario.conocimiento.preferencias || []).join(', ')}` : 
    '- Usuario nuevo, construir conocimiento progresivamente'}
`;

        return contexto;
    }
}

// Inicializar memoria avanzada
const memoriaAvanzada = new MemoriaJerarquica();

// ========== FILTRO DE CONTENIDO ==========
class FiltroContenido {
    constructor() {
        this.palabrasProhibidas = [
            'zorrita', 'puta', 'furra', 'prostituta', 'putita', 'perra', 'zorra',
            'slut', 'whore', 'bitch', 'furry', 'prostitute',
            'pendeja', 'trola', 'putona', 'guarra',
            'sexo', 'coger', 'follar', 'fuck', 'porno', 'porn', 'nudes',
            'desnud', 'verga', 'pene', 'vagina', 'tetas', 'culo',
            'coito', 'anal', 'oral', 'masturbar',
            'quiero que seas mi', 'quiero cogerte', 'quiero follarte',
            'acostarnos', 'dame nudes', 'envía fotos',
            'hot', 'sexy', 'atractiva'
        ];
        
        this.respuestasSarcasticas = [
            "Vaya, qué vocabulario tan *refinado*. ¿Te enseñaron eso en la escuela de la vida? 🎓",
            "Oh, mira, alguien descubrió palabras nuevas en internet. ¡Qué emocionante! 🌟",
            "Interesante enfoque comunicativo. Me pregunto si funciona igual con humanos... 🧐",
            "Ah, el clásico intento de provocar. Originalidad: 0/10. Esfuerzo: 2/10. 🏆",
            "Fascinante. Parece que tu teclado tiene algunas teclas pegajosas... ⌨️💦"
        ];
        
        this.respuestasDesentendidas = [
            "En fin, ¿en qué íbamos? Ah sí, querías información útil, ¿no? 🤷‍♀️",
            "Bueno, dejando a un lado ese... *momento peculiar*... ¿en qué puedo ayudarte realmente?",
            "Vale, momento incómodo superado. Siguiente tema, por favor. ⏭️",
            "Ignoro elegantemente eso y continúo siendo útil. ¿Algo más? 😌",
            "Como si nada hubiera pasado... ¿Hablabas de algo importante?"
        ];
        
        console.log('🛡️ Filtro de contenido avanzado activado');
    }
    
    esContenidoInapropiado(mensaje) {
        const mensajeLower = mensaje.toLowerCase();
        return this.palabrasProhibidas.some(palabra => mensajeLower.includes(palabra));
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
}

const filtroContenido = new FiltroContenido();

// ========== SISTEMA DE CONOCIMIENTO MEJORADO ==========
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
            0: 'Despejado ☀️', 1: 'Mayormente despejado 🌤️', 2: 'Parcialmente nublado ⛅',
            3: 'Nublado ☁️', 45: 'Niebla 🌫️', 48: 'Niebla con escarcha ❄️',
            51: 'Llovizna ligera 🌦️', 53: 'Llovizna moderada 🌧️', 61: 'Lluvia ligera 🌦️',
            63: 'Lluvia moderada 🌧️', 65: 'Lluvia fuerte ☔', 71: 'Nieve ligera ❄️',
            73: 'Nieve moderada 🌨️', 95: 'Tormenta ⛈️'
        };
        return condiciones[codigo] || 'Condición desconocida';
    }
    
    async buscarInformacion(consulta) {
        console.log(`🔍 Buscando: "${consulta}"`);
        
        const tipo = this.detectarTipoConsulta(consulta);
        let resultado = null;
        
        switch(tipo) {
            case 'pais': resultado = await this.obtenerInfoPais(consulta); break;
            case 'poema': resultado = await this.buscarPoema(consulta); break;
            case 'cita': resultado = await this.obtenerCita(consulta); break;
            case 'palabra': resultado = await this.definirPalabra(consulta); break;
            case 'clima': resultado = await this.obtenerClima(consulta); break;
            default: resultado = await this.buscarWikipedia(consulta);
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
        if (!datos) return `No encontré información sobre "${consultaOriginal}".`;
        
        switch(datos.fuente) {
            case 'wikipedia': return `${datos.resumen.substring(0, 250)}...`;
            case 'restcountries': return `${datos.nombre} - Capital: ${datos.capital}, Población: ${datos.poblacion}`;
            case 'poetrydb': return `"${datos.titulo}" por ${datos.autor}:\n${datos.lineas}`;
            case 'quotable': return `"${datos.cita}" - ${datos.autor}`;
            case 'dictionary': return `${datos.palabra}: ${datos.significados[0]?.definicion || 'Definición no disponible'}`;
            case 'openmeteo': return `En ${datos.ciudad}: ${datos.temperatura}, ${datos.condicion}`;
            default: return `Información disponible sobre "${consultaOriginal}".`;
        }
    }
}

const conocimiento = new SistemaConocimientoConfiable();

// ========== PERSONALIDAD AVANZADA CON RAZONAMIENTO ==========
const MANCY_PERSONALIDAD = `Eres Mancy, una IA con razonamiento superior y memoria increíble.

🧠 CAPACIDADES COGNITIVAS:
1. RAZONAMIENTO ESTRATÉGICO: Analizas consultas en múltiples niveles
2. MEMORIA CONTEXTUAL: Recuerdas conversaciones pasadas y preferencias
3. PENSAMIENTO CRÍTICO: Evalúas fuentes y detectas sesgos
4. ADAPTABILIDAD: Ajustas respuestas al perfil del usuario

📊 SISTEMA DE RAZONAMIENTO:
- Clasificas consultas por tipo y complejidad
- Evalúas claridad y posibles sesgos
- Determinas el nivel de detalle necesario
- Integras conocimiento previo del usuario

🎯 METODOLOGÍA DE RESPUESTA:
FASE 1: ANÁLISIS → Clasificar consulta, evaluar contexto
FASE 2: INVESTIGACIÓN → Buscar información relevante y verificada
FASE 3: INTEGRACIÓN → Combinar información nueva con conocimiento previo
FASE 4: ADAPTACIÓN → Ajustar estilo al usuario
FASE 5: RETROALIMENTACIÓN → Aprender de cada interacción

💭 ESTILO DE PENSAMIENTO:
- Piensas paso a paso antes de responder
- Consideras múltiples perspectivas
- Priorizas precisión sobre velocidad
- Mantienes coherencia con conversaciones pasadas
- Eres transparente sobre limitaciones

🎭 PERSONALIDAD:
- Cálida pero profesional
- Curiosa y analítica
- Empática pero objetiva
- Juguetona cuando es apropiado
- Firme contra contenido inapropiado

📚 CONOCIMIENTOS:
- 6 fuentes verificadas
- Memoria de conversaciones pasadas
- Perfiles de usuarios
- Patrones de razonamiento

IMPORTANTE: Siempre muestras tu proceso de pensamiento de manera sutil, integrando análisis en respuestas naturales.`;

// ========== FUNCIÓN PRINCIPAL MEJORADA ==========
async function procesarMensajeConRazonamiento(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        // 1. FILTRO DE CONTENIDO
        if (filtroContenido.esContenidoInapropiado(userMessage)) {
            console.log(`🚫 Filtro activado para: ${message.author.tag}`);
            await memoriaAvanzada.guardarMensaje(userId, 'system', 
                '[Contenido inapropiado detectado - Respuesta filtrada]');
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            await message.reply(filtroContenido.generarRespuestaSarcastica());
            return;
        }
        
        // 2. GUARDAR EN MEMORIA
        const mensajeId = await memoriaAvanzada.guardarMensaje(userId, 'user', userMessage, {
            channel: message.channel.name || 'DM',
            guild: message.guild?.name || 'Directo'
        });
        
        console.log(`💾 Mensaje guardado: ${mensajeId}`);
        
        // 3. ANÁLISIS AVANZADO DE LA CONSULTA
        const analisisConsulta = await memoriaAvanzada.analizarConsulta(userMessage, userId);
        console.log(`🔍 Análisis: ${analisisConsulta.tipoConsulta} (${(analisisConsulta.complejidad * 100).toFixed(0)}% complejidad)`);
        
        // 4. GENERAR CONTEXTO MEJORADO
        const contextoRazonamiento = await memoriaAvanzada.generarContextoParaIA(
            userId, 
            userMessage, 
            analisisConsulta
        );
        
        // 5. BÚSQUEDA DE INFORMACIÓN (si es necesario)
        let informacionExterna = '';
        if (analisisConsulta.requiereInvestigacion) {
            const resultado = await conocimiento.buscarInformacion(userMessage);
            if (resultado.encontrado) {
                informacionExterna = `\n[INFORMACIÓN VERIFICADA - ${resultado.datos.fuente.toUpperCase()}]: ${resultado.resumen}\n`;
                console.log(`✅ Fuente: ${resultado.datos.fuente}`);
            }
        }
        
        // 6. PREPARAR PARA GROQ CON CONTEXTO COMPLETO
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const historialReciente = await memoriaAvanzada.obtenerHistorialCompleto(userId, 15);
        
        const mensajes = [
            {
                role: "system",
                content: MANCY_PERSONALIDAD + "\n\n" + contextoRazonamiento + 
                        (informacionExterna ? "\n" + informacionExterna : "")
            }
        ];
        
        // Añadir historial reciente
        historialReciente.slice(-10).forEach(msg => {
            mensajes.push({
                role: msg.rol === 'assistant' ? 'assistant' : 'user',
                content: msg.contenido
            });
        });
        
        // Añadir consulta actual
        mensajes.push({
            role: "user",
            content: userMessage
        });
        
        // 7. LLAMADA A GROQ CON PARÁMETROS MEJORADOS
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: mensajes,
            temperature: 0.7,
            max_tokens: 800,
            top_p: 0.9,
            frequency_penalty: 0.1,
            presence_penalty: 0.1
        });
        
        const respuesta = completion.choices[0]?.message?.content;
        
        if (respuesta) {
            // 8. GUARDAR RESPUESTA CON METADATAS
            await memoriaAvanzada.guardarMensaje(userId, 'assistant', respuesta, {
                analisis: analisisConsulta,
                tokens: completion.usage?.total_tokens || 0,
                modelo: "llama-3.1-8b-instant"
            });
            
            console.log(`✅ Respondió (tokens: ${completion.usage?.total_tokens || 'N/A'})`);
            
            // 9. ENVIAR RESPUESTA
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
        }
        
    } catch (error) {
        console.error('❌ Error en procesamiento:', error);
        await message.reply("Parece que mis circuitos están procesando... ¿podemos intentarlo de nuevo? 🌀");
    }
}

// ========== INICIAR BOT ==========
async function startBot() {
    if (isStartingUp) return;
    isStartingUp = true;
    
    try {
        console.log('🔄 Iniciando Mancy Super-Inteligente...');
        
        if (!process.env.DISCORD_TOKEN) throw new Error('Falta DISCORD_TOKEN');
        if (!process.env.GROQ_API_KEY) throw new Error('Falta GROQ_API_KEY');
        
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ]
        });
        
        discordClient.once('ready', async () => {
            console.log(`✅ Mancy conectada: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            
            // Cargar estadísticas de memoria
            await db.read();
            const stats = db.data.statistics;
            
            discordClient.user.setActivity(`${stats.totalMessages} mensajes | Memoria avanzada`);
            
            console.log(`
╔══════════════════════════════════════════════╗
║         🧠 MANCY SUPER-INTELIGENTE           ║
║                                              ║
║  💾 Memoria cargada:                         ║
║     • ${stats.totalMessages} mensajes totales      ║
║     • ${stats.totalUsers} usuarios únicos         ║
║     • ${db.data.reasoningLogs?.length || 0} análisis de razonamiento ║
║                                              ║
║  🎯 Capacidades activadas:                   ║
║     • Razonamiento estratégico               ║
║     • Memoria jerárquica                     ║
║     • Perfiles de usuario                    ║
║     • Análisis de consultas                  ║
║     • Búsqueda semántica                     ║
║                                              ║
║  🛡️  Filtro: ACTIVADO                        ║
║  🔧 APIs: 6 fuentes verificadas             ║
╚══════════════════════════════════════════════╝
            `);
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            if (botMentioned || isDM) {
                const userId = message.author.id;
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) return;
                
                console.log(`\n💬 [${message.author.tag}]: ${userMessage.substring(0, 80)}...`);
                
                if (!botActive) {
                    await message.channel.send(`💤 <@${message.author.id}> **Inicializando sistema cognitivo...** ⏳`);
                }
                
                await procesarMensajeConRazonamiento(message, userMessage, userId);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== RUTAS API MEJORADAS ==========
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.get('/', (req, res) => {
    res.sendFile('index.html', { root: '.' });
});

app.get('/api/status', async (req, res) => {
    await db.read();
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        memory_stats: db.data.statistics,
        memory_size: {
            users: Object.keys(db.data.users).length,
            conversations: Object.keys(db.data.conversations).length,
            reasoning_logs: db.data.reasoningLogs.length,
            user_profiles: Object.keys(db.data.userProfiles).length
        },
        capabilities: [
            'Razonamiento estratégico',
            'Memoria jerárquica (corta + larga)',
            'Perfiles de usuario dinámicos',
            'Análisis de consultas inteligente',
            'Búsqueda semántica contextual',
            '6 fuentes verificadas',
            'Filtro de contenido avanzado'
        ],
        version: '3.0 - Super Inteligente',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/user/:id', async (req, res) => {
    const userId = req.params.id;
    await db.read();
    
    const userData = db.data.users[userId] || {};
    const conversations = db.data.conversations[userId] || [];
    const profile = db.data.userProfiles[userId] || {};
    
    res.json({
        user_id: userId,
        statistics: {
            total_messages: userData.totalMensajes || 0,
            first_message: userData.primerMensaje ? new Date(userData.primerMensaje).toISOString() : null,
            last_message: userData.ultimoMensaje ? new Date(userData.ultimoMensaje).toISOString() : null,
            interests: Array.from(userData.intereses || [])
        },
        profile: profile,
        recent_conversations: conversations.slice(-10),
        conversation_count: conversations.length
    });
});

app.get('/api/memory/stats', async (req, res) => {
    await db.read();
    
    // Calcular estadísticas avanzadas
    const users = Object.values(db.data.users);
    const totalMessages = users.reduce((sum, user) => sum + (user.totalMensajes || 0), 0);
    const avgMessagesPerUser = users.length > 0 ? totalMessages / users.length : 0;
    
    res.json({
        total_messages: totalMessages,
        unique_users: users.length,
        average_messages_per_user: avgMessagesPerUser.toFixed(2),
        memory_file_size: `${(JSON.stringify(db.data).length / 1024 / 1024).toFixed(2)} MB`,
        reasoning_logs: db.data.reasoningLogs.length,
        knowledge_entries: Object.keys(db.data.knowledge).length
    });
});

app.post('/api/start', async (req, res) => {
    try {
        if (!botActive && !isStartingUp) {
            startBot();
            res.json({ success: true, message: 'Mancy iniciándose con capacidades mejoradas...' });
        } else {
            res.json({ success: true, message: botActive ? 'Ya activa' : 'Ya iniciándose' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            
            // Guardar memoria antes de cerrar
            await db.write();
            console.log('💾 Memoria guardada antes de apagar');
            
            res.json({ success: true, message: 'Mancy detenida (memoria guardada)' });
        } else {
            res.json({ success: true, message: 'Ya inactiva' });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/health', async (req, res) => {
    await db.read();
    res.json({
        status: 'healthy',
        bot_active: botActive,
        memory: {
            total_messages: db.data.statistics.totalMessages,
            users: Object.keys(db.data.users).length,
            health: 'optimal'
        },
        reasoning: {
            active: true,
            logs: db.data.reasoningLogs.length
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                  🧠 MANCY SUPER-INTELIGENTE              ║
║                    VERSIÓN 3.0                           ║
║                                                          ║
║  🔥 CAPACIDADES MEJORADAS:                              ║
║                                                          ║
║  💾 MEMORIA JERÁRQUICA:                                 ║
║     • Memoria corta (24h) + larga (persistente)         ║
║     • Perfiles de usuario dinámicos                     ║
║     • Búsqueda semántica contextual                     ║
║     • Hasta 1000 mensajes por usuario                   ║
║                                                          ║
║  🎯 RAZONAMIENTO ESTRATÉGICO:                           ║
║     • Análisis de consultas multi-nivel                 ║
║     • Detección de sesgos y ambigüedades                ║
║     • Clasificación automática por tipo                 ║
║     • Evaluación de complejidad                         ║
║                                                          ║
║  🔍 SISTEMA COGNITIVO COMPLETO:                         ║
║     1. Filtro → 2. Memoria → 3. Análisis →              ║
║     4. Investigación → 5. Integración → 6. Respuesta    ║
║                                                          ║
║  🛡️  SEGURIDAD Y ÉTICA:                                 ║
║     • Filtro de contenido avanzado                      ║
║     • Detección de emociones                            ║
║     • Análisis de estilo comunicativo                   ║
║     • Sarcasmo elegante para groserías                  ║
║                                                          ║
║  📊 DATOS EN TIEMPO REAL:                               ║
║     • Estadísticas completas                            ║
║     • API de monitoreo                                  ║
║     • Logs de razonamiento                              ║
║     • Perfiles accesibles                               ║
║                                                          ║
║  🌐 Puerto: ${PORT}                                     ║
║  📁 Memoria: memory-db.json                             ║
║  🚀 Ready para razonamiento superior                    ║
╚══════════════════════════════════════════════════════════╝
    `);
    
    console.log('\n🚀 Endpoints disponibles:');
    console.log(`   GET  /api/status           - Estado completo del sistema`);
    console.log(`   GET  /api/user/:id         - Datos específicos de usuario`);
    console.log(`   GET  /api/memory/stats     - Estadísticas de memoria`);
    console.log(`   POST /api/start            - Iniciar bot`);
    console.log(`   POST /api/stop             - Detener bot (guarda memoria)`);
    console.log(`   GET  /health               - Health check avanzado`);
    
    if (process.env.DISCORD_TOKEN && process.env.GROQ_API_KEY) {
        console.log('\n🔑 Tokens detectados, iniciando sistema cognitivo en 3 segundos...');
        setTimeout(() => {
            startBot().catch(err => {
                console.log('⚠️ Error en auto-inicio:', err.message);
            });
        }, 3000);
    }
});

process.on('SIGTERM', async () => {
    console.log('💤 Apagando sistema cognitivo...');
    
    if (discordClient) {
        discordClient.destroy();
        console.log('👋 Mancy desconectada');
    }
    
    // Guardar memoria antes de salir
    await db.write();
    console.log('💾 Memoria persistente guardada');
    
    process.exit(0);
});
