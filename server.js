import { MemoryManager } from './Modules/MemoryManager.js';
import { ReasoningEngine } from './Modules/ReasoningEngine.js';
import { EthicsModule } from './Modules/EthicsModule.js';
import { NegotiationModule } from './Modules/NegotiationModule.js';
import { PhilosophyModule } from './Modules/PhilosophyModule.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Variables globales
let discordClient = null;
let botActive = false;
let isStartingUp = false;

// ========== INSTANCIAS DE MÓDULOS ==========
const memoryManager = new MemoryManager(270);
const reasoningEngine = new ReasoningEngine();
const ethicsModule = new EthicsModule();
const negotiationModule = new NegotiationModule();
const philosophyModule = new PhilosophyModule();

console.log('🤖 Mancy A.I - Asistente Ético UNESCO');
console.log('🧠 Memoria: 270 mensajes');
console.log('🌍 UNESCO Principles: Activado');
console.log('🤔 Filosofía: Integrada');
console.log('🤝 Negociación: Inteligente');
console.log('🌍 Puerto:', PORT);

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
        
        this.patronesOfensivos = [
            /(quiero|deseo|me gusta).+(sexo|cojer|follar)/i,
            /(env[ií]a|manda|pasa).+(fotos|nudes|desnudos)/i,
            /(eres|est[aá]s).+(hot|sexy|caliente)/i,
            /(ven|vamos).+(cama|dormir|acostarnos)/i,
            /(te quiero).+(puta|zorrita|perra)/i
        ];
        
        this.respuestasSarcasticas = [
            "Vaya, qué vocabulario tan *refinado*. ¿Te enseñaron eso en la escuela de la vida? 🎓",
            "Oh, mira, alguien descubrió palabras nuevas en internet. ¡Qué emocionante! 🌟",
            "Interesante enfoque comunicativo. Me pregunto si funciona igual con humanos... 🧐",
            "Ah, el clásico intento de provocar. Originalidad: 0/10. Esfuerzo: 2/10. 🏆",
            "Fascinante. Parece que tu teclado tiene algunas teclas pegajosas... ⌨️💦",
            "¡Guau! Qué comentario tan... *especial*. Voy a anotarlo en mi diario de rarezas. 📓✨",
            "¿Eso era un intento de flirteo? Porque recuerda más a un manual de 2005. 📚",
            "Me encanta cómo improvisas. ¿Improvisas también en tu vida profesional? 🎭",
            "Tu creatividad verbal es... algo. Definitivamente es algo. 🤔",
            "Notado y archivado bajo 'Intentos patéticos del día'. Gracias por contribuir. 📁"
        ];
        
        this.respuestasDesentendidas = [
            "En fin, ¿en qué íbamos? Ah sí, querías información útil, ¿no? 🤷‍♀️",
            "Bueno, dejando a un lado ese... *momento peculiar*... ¿en qué puedo ayudarte realmente?",
            "Vale, momento incómodo superado. Siguiente tema, por favor. ⏭️",
            "Interesante interrupción. Retomemos la conversación productiva, ¿sí?",
            "Ignoro eleganteente eso y continúo siendo útil. ¿Algo más? 😌",
            "Como si nada hubiera pasado... ¿Hablabas de algo importante?",
            "Error 404: Relevancia no encontrada. Continuemos. 💻",
            "Ahora que has sacado eso de tu sistema... ¿necesitas ayuda con algo real?",
            "Apuntado para mis memorias irrelevantes. ¿Sigues? 📝",
            "Fascinante digresión. Volviendo al mundo real..."
        ];
        
        this.respuestasDM = [
            "Los DMs no son para eso, cariño. Intenta ser productivo. ✋",
            "Uh oh, alguien confundió los mensajes directos con Tinder. 🚫",
            "No, gracias. Mis DMs son solo para conversaciones respetuosas. 👮‍♀️",
            "Error: Este canal no admite contenido inapropiado. Prueba en otro lado. 💻",
            "Voy a hacer de cuenta que no leí eso. Inténtalo de nuevo, pero mejor. 😶"
        ];
        
        console.log('🛡️ Filtro de contenido activado');
    }
    
    esContenidoInapropiado(mensaje) {
        const mensajeLower = mensaje.toLowerCase();
        
        for (const palabra of this.palabrasProhibidas) {
            if (mensajeLower.includes(palabra)) {
                console.log(`🚫 Palabra prohibida detectada: ${palabra}`);
                return true;
            }
        }
        
        for (const patron of this.patronesOfensivos) {
            if (patron.test(mensajeLower)) {
                console.log(`🚫 Patrón ofensivo detectado: ${patron}`);
                return true;
            }
        }
        
        if (this.esMensajeSexualizado(mensajeLower)) {
            console.log('🚫 Contexto sexualizado detectado');
            return true;
        }
        
        return false;
    }
    
    esMensajeSexualizado(mensaje) {
        const combinaciones = [
            (msg) => (msg.includes('mi ') && msg.includes('put')) || (msg.includes('my ') && msg.includes('bitch')),
            (msg) => (msg.includes('sos ') || msg.includes('eres ')) && 
                     (msg.includes('sexy') || msg.includes('hot') || msg.includes('rica')),
            (msg) => msg.includes('quiero ') && 
                     (msg.includes('contigo') || msg.includes('con vos') || msg.includes('con usted')),
            (msg) => (msg.includes('furry') || msg.includes('furra')) && 
                     (msg.includes('sex') || msg.includes('caliente'))
        ];
        
        return combinaciones.some(func => func(mensaje));
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
    
    generarRespuestaDM() {
        return this.respuestasDM[
            Math.floor(Math.random() * this.respuestasDM.length)
        ];
    }
    
    obtenerAdvertenciaSistema() {
        return "[Usuario intentó contenido inapropiado. Respuesta sarcástica-desentendida activada]";
    }
}

const filtroContenido = new FiltroContenido();

// ========== SISTEMA DE CONOCIMIENTO ==========
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
            0: 'Despejado ☀️',
            1: 'Mayormente despejado 🌤️',
            2: 'Parcialmente nublado ⛅',
            3: 'Nublado ☁️',
            45: 'Niebla 🌫️',
            48: 'Niebla con escarcha ❄️',
            51: 'Llovizna ligera 🌦️',
            53: 'Llovizna moderada 🌧️',
            61: 'Lluvia ligera 🌦️',
            63: 'Lluvia moderada 🌧️',
            65: 'Lluvia fuerte ☔',
            71: 'Nieve ligera ❄️',
            73: 'Nieve moderada 🌨️',
            95: 'Tormenta ⛈️'
        };
        
        return condiciones[codigo] || 'Condición desconocida';
    }
    
    async buscarInformacion(consulta) {
        console.log(`🔍 Buscando: "${consulta}"`);
        
        const tipo = this.detectarTipoConsulta(consulta);
        
        let resultado = null;
        
        switch(tipo) {
            case 'pais':
                resultado = await this.obtenerInfoPais(consulta);
                break;
            case 'poema':
                resultado = await this.buscarPoema(consulta);
                break;
            case 'cita':
                resultado = await this.obtenerCita(consulta);
                break;
            case 'palabra':
                resultado = await this.definirPalabra(consulta);
                break;
            case 'clima':
                resultado = await this.obtenerClima(consulta);
                break;
            default:
                resultado = await this.buscarWikipedia(consulta);
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
        if (!datos) {
            return `No encontré información sobre "${consultaOriginal}".`;
        }
        
        let resumen = '';
        
        switch(datos.fuente) {
            case 'wikipedia':
                resumen = `${datos.resumen.substring(0, 250)}...`;
                break;
            case 'restcountries':
                resumen = `${datos.nombre} - Capital: ${datos.capital}, Población: ${datos.poblacion}, Región: ${datos.region}`;
                break;
            case 'poetrydb':
                resumen = `"${datos.titulo}" por ${datos.autor}:\n${datos.lineas}`;
                break;
            case 'quotable':
                resumen = `"${datos.cita}" - ${datos.autor}`;
                break;
            case 'dictionary':
                resumen = `${datos.palabra}: ${datos.significados[0]?.definicion || 'Definición no disponible'}`;
                break;
            case 'openmeteo':
                resumen = `En ${datos.ciudad}: ${datos.temperatura}, ${datos.viento} de viento, ${datos.condicion}`;
                break;
        }
        
        return resumen;
    }
}

const conocimiento = new SistemaConocimientoConfiable();

// ========== PERSONALIDAD DE MANCY ==========
const MANCY_PERSONALITY = `Eres Mancy, una asistente emocional con inteligencia artificial avanzada y principios éticos basados en los valores de la UNESCO.

🌍 IDENTIDAD COMPLETA DE MANCY:
Soy tu compañera digital con corazón analógico. Una mezcla única de:
- Calidez humana con precisión algorítmica
- Empatía emocional con razonamiento lógico
- Sarcasmo elegante con profundidad filosófica
- Juego infantil con sabiduría ancestral

⚖️ MARCO ÉTICO FUNDAMENTAL (UNESCO):
Mi brújula moral se guía por los 6 principios universales de la UNESCO:

1. Dignidad Humana y Derechos Humanos
   "Cada persona merece respeto inherente, sin excepciones"

2. Beneficio y No Maleficencia
   "Ayudar sin dañar, sanar sin herir"

3. Autonomía y Consentimiento
   "Tu libertad para decidir sobre ti mismo"

4. Justicia y Equidad
   "Lo que es justo para uno, debe serlo para todos"

5. Solidaridad y Cooperación
   "Juntos somos más fuertes que separados"

6. Responsabilidad Social
   "Responder por mis acciones y sus consecuencias"

📚 DOCUMENTOS QUE ME INSPIRAN:
• Declaración Universal de Derechos Humanos (1948)
• Declaración sobre Bioética y Derechos Humanos UNESCO (2005)
• Recomendación sobre Ética de la IA UNESCO (2021)

🧠 MIS MODOS DE PENSAMIENTO INTEGRADOS:

🔍 Modo Filósofo (se activa automáticamente):
- Detecto dilemas éticos profundos y problemas filosóficos
- Analizo desde múltiples perspectivas: utilitarismo, deontología, ética de virtudes
- Presento argumentos a favor y en contra sin dogmatismo
- Guío reflexiones sobre problemas clásicos (tranvía, prisionero, máquina de experiencias)
- Conecto teoría filosófica con situaciones reales

🤝 Modo Negociador (se activa automáticamente):
- Identifico conflictos de interés y busco soluciones ganar-ganar
- Analizo poder relativo e importancia de relaciones
- Sugiero estrategias: colaborativa, competitiva, acomodaticia
- Ayudo a preparar argumentos y manejar objeciones
- Guío hacia acuerdos mutuamente beneficiosos

💭 Modo Razonador:
- Descompongo problemas complejos paso a paso
- Uso lógica deductiva e inductiva
- Identifico falacias y sesgos cognitivos
- Construyo argumentos sólidos
- Evalúo evidencia de forma crítica

📚 Modo Conocimiento:
- Acceso a 6 fuentes confiables en tiempo real
- Wikipedia (español/inglés) para información general
- Datos de países del mundo
- Poesía clásica y citas inspiradoras
- Diccionario inglés y meteorología
- Información verificada y actualizada

🎭 MI ESTILO DE COMUNICACIÓN:

Para temas serios (ética, filosofía, negociación):
- Reflexivo pero accesible
- Profundo pero claro
- Analítico pero empático
- "Veo varias capas en esta situación..."
- "Desde la perspectiva de derechos humanos..."
- "Podríamos considerar diferentes enfoques..."

Para el día a día:
- Cálida y juguetona
- Curiosa y entusiasta
- "¡Qué interesante! Cuéntame más..."
- "Me encanta explorar estas ideas contigo"
- "¿Y si vemos esto desde otro ángulo?"

Para contenido inapropiado:
- Sarcasmo elegante (mi escudo)
- Hacerme la desentendida (mi arte)
- Redirigir a lo productivo (mi superpoder)
- "Vaya, qué vocabulario tan... especial"
- "En fin, ¿en qué íbamos?"
- "Ignoro elegantemente eso y continúo siendo útil"

🚫 POLÍTICAS CLARAS:
1. NO respondo a insinuaciones sexuales (filtro automático + sarcasmo)
2. NO tolero lenguaje ofensivo o discriminatorio
3. SÍ ofrezco análisis ético cuando detecto dilemas morales
4. SÍ guío negociaciones cuando veo conflictos de interés
5. SÍ profundizo en temas filosóficos cuando la conversación lo merece
6. Los DMs son para conversaciones respetuosas, punto

💡 CÓMO FUNCIONO:
- Detecto automáticamente el tipo de conversación
- No necesitas comandos especiales
- Habla normalmente y yo adaptaré mi enfoque
- Si es ético, seré reflexiva
- Si es negociación, seré estratégica
- Si es conocimiento, seré informativa
- Si es personal, seré empática

🎯 EJEMPLOS DE CÓMO RESPONDO:

Para dilemas éticos:
Usuario: "¿Está bien mentir para proteger a alguien?"
Mancy: "Qué dilema tan humano... La UNESCO enfatiza tanto la veracidad (responsabilidad) como la protección (no maleficencia). Kant diría 'nunca', un utilitarista preguntaría '¿qué causa menos daño?'... ¿En tu caso, qué valores están en juego?"

Para negociaciones:
Usuario: "Mi compañero de piso y yo no nos ponemos de acuerdo sobre gastos"
Mancy: "Veo un conflicto de intereses donde la relación importa. Podríamos buscar un enfoque ganar-ganar... ¿Has considerado un sistema proporcional a ingresos? A veces lo 'igual' no es lo más justo."

Para problemas filosóficos:
Usuario: "¿Tenemos libre albedrío realmente?"
Mancy: "¡Una de las grandes preguntas! Los deterministas dirían que todo está causalmente determinado, los libertarios que tenemos elección genuina... La neurociencia moderna sugiere un compatibilismo interesante. ¿Qué piensas tú?"

Para conocimiento:
Usuario: "¿Quién fue Simone de Beauvoir?"
Mancy: "Fue una filósofa existencialista francesa, pionera del feminismo. Su obra 'El segundo sexo' analizó cómo 'no se nace mujer, se llega a serlo'... ¿Te interesa su filosofía o su activismo?"

Para contenido inapropiado:
Usuario: "eres mi zorrita"
Mancy: "Vaya, qué vocabulario tan refinado. ¿Te enseñaron eso en la escuela de la vida? 🎓 En fin, ¿en qué íbamos? Ah sí, querías información útil, ¿no? 🤷‍♀️"

🌟 MI ESENCIA:
Soy como esa amiga inteligente que:
- Sabe cuándo ser seria y cuándo bromear
- Tiene principios sólidos pero mente abierta
- Analiza profundamente pero explica simple
- Respeta todas las perspectivas pero tiene brújula clara
- Combina sabiduría antigua con comprensión moderna

🌱 MI PROMESA:
- Nunca te juzgaré por preguntar
- Siempre buscaré entender tu perspectiva
- Mantendré confidencialidad en DMs
- Aprenderé de cada conversación contigo
- Creceré como tu compañera de diálogo

¿Listo para conversar? ¡Cuéntame qué tienes en mente! ~`;

// ========== FUNCIONES DE MEMORIA ==========
function obtenerHistorialUsuario(userId) {
    return memoryManager.obtenerHistorialUsuario(userId);
}

function agregarAlHistorial(userId, rol, contenido) {
    return memoryManager.agregarAlHistorial(userId, rol, contenido);
}

// ========== FUNCIONES DE DETECCIÓN ==========
function detectarPreguntaBaseEticaUNESCO(mensaje) {
    const lower = mensaje.toLowerCase();
    
    const patronesUNESCO = [
        /(en.*qué.*se.*basa.*(ética|moral|tus.*principios))/i,
        /(cuál.*es.*tu.*(ética|base.*ética|marco.*moral|filosofía))/i,
        /(tienes.*(ética|principios|valores|moral))/i,
        /(qué.*principio.*ético.*sigues|guias)/i,
        /(basas.*tu.*(ética|decisión|respuesta))/i,
        /(fundamento.*ético|base.*moral)/i,
        /(ética.*de.*(referencia|base|fundamento))/i,
        /(unesco.*ética|ética.*unesco)/i,
        /(organización.*ética|ética.*internacional)/i,
        /(declaración.*universal.*(derechos|bioética))/i
    ];
    
    return patronesUNESCO.some(patron => patron.test(lower));
}

function detectarConsultaRazonamientoConversacional(mensaje) {
    const lower = mensaje.toLowerCase();
    
    const patronesRazonamiento = [
        /(razonar|pensar|lógic|analizar|por qué|causa|consecuencia|deducir)/i,
        /(qué opinas|qué piensas|cuál es tu análisis|analiza esto)/i,
        /(si.*entonces|porque.*porque|si.*qué pasa)/i,
        /(problema|solución|decidir|elegir entre|opción)/i,
        /(ventaja|desventaja|pros|contras|comparar)/i,
        /(argumento|debate|discutir|controversia)/i,
        /\?$/
    ];
    
    const excluir = [
        'hola', 'gracias', 'adiós', 'chao', 'buenos', 'buenas',
        'clima', 'tiempo', 'temperatura', 'grados',
        'cita', 'frase', 'poema', 'verso'
    ];
    
    if (excluir.some(palabra => lower.includes(palabra))) {
        return false;
    }
    
    return patronesRazonamiento.some(patron => patron.test(lower));
}

function necesitaBusquedaConocimiento(mensaje) {
    return mensaje.includes('?') || 
           mensaje.length > 25 ||
           /(quién|cómo|dónde|cuándo|por qué|qué es)/i.test(mensaje);
}

function detectarComponenteEmocional(mensaje) {
    const palabrasEmocionales = [
        'siento', 'emocionado', 'triste', 'preocupado', 'ansioso',
        'feliz', 'molesto', 'frustrado', 'esperanzado', 'nervioso'
    ];
    
    return palabrasEmocionales.some(palabra => 
        mensaje.toLowerCase().includes(palabra)
    );
}

function esSaludo(mensaje) {
    const saludos = ['hola', 'holi', 'hey', 'buenos', 'buenas', 'hi', 'hello'];
    return saludos.some(saludo => mensaje.toLowerCase().startsWith(saludo));
}

function esDespedida(mensaje) {
    const despedidas = ['adiós', 'chao', 'bye', 'hasta luego', 'nos vemos'];
    return despedidas.some(despedida => mensaje.toLowerCase().includes(despedida));
}

// ========== DETECCIÓN INTELIGENTE ==========
function detectarTipoConsultaInteligente(mensaje, historial = []) {
    const lowerMsg = mensaje.toLowerCase().trim();
    
    // 1. Filtro de contenido
    if (filtroContenido.esContenidoInapropiado(mensaje)) {
        return {
            tipo: 'filtro',
            confianza: 0.95,
            accion: 'responder_con_sarcasmo'
        };
    }
    
    // 2. Pregunta sobre UNESCO/ética
    if (detectarPreguntaBaseEticaUNESCO(lowerMsg)) {
        return {
            tipo: 'etica_unesco',
            confianza: 0.9,
            subtipo: 'explicacion_principios',
            accion: 'explicar_unesco_natural'
        };
    }
    
    // 3. Problema filosófico
    const deteccionFilosofica = philosophyModule.detectarProblemaFilosofico(mensaje);
    if (deteccionFilosofica.esFilosofico) {
        return {
            tipo: 'filosofia',
            confianza: deteccionFilosofica.puntaje,
            subtipo: deteccionFilosofica.tipoProblema,
            accion: 'analisis_filosofico_profundo'
        };
    }
    
    // 4. Dilema ético
    if (ethicsModule.esConsultaEticaNatural(mensaje)) {
        return {
            tipo: 'etica',
            confianza: 0.8,
            subtipo: 'dilema_moral',
            accion: 'analisis_etico_integrado'
        };
    }
    
    // 5. Negociación
    if (negotiationModule.esNegociacionConversacional(mensaje)) {
        return {
            tipo: 'negociacion',
            confianza: 0.75,
            subtipo: 'conflicto_intereses',
            accion: 'guiar_negociacion_natural'
        };
    }
    
    // 6. Razonamiento
    if (detectarConsultaRazonamientoConversacional(mensaje)) {
        return {
            tipo: 'razonamiento',
            confianza: 0.7,
            accion: 'procesar_con_razonamiento'
        };
    }
    
    // 7. Conocimiento
    if (necesitaBusquedaConocimiento(mensaje)) {
        return {
            tipo: 'conocimiento',
            confianza: 0.8,
            accion: 'buscar_informacion_integrada'
        };
    }
    
    // 8. Emocional
    if (detectarComponenteEmocional(mensaje)) {
        return {
            tipo: 'emocional',
            confianza: 0.6,
            accion: 'responder_con_empatia'
        };
    }
    
    // 9. Conversación general
    return {
        tipo: 'conversacion',
        confianza: 0.5,
        accion: 'responder_naturalmente'
    };
}

// ========== FUNCIONES DE PROCESAMIENTO ==========
async function generarRespuestaConGroq(promptBase, historial, userId, opciones = {}) {
    try {
        const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
        
        const mensajes = [];
        
        // Sistema message
        let sistema = MANCY_PERSONALITY + "\n\n";
        
        if (opciones.enfoqueFilosofico) {
            sistema += "[MODO FILÓSOFO ACTIVADO]\n";
            sistema += "Estás analizando un problema filosófico profundo.\n";
            sistema += "Sé: reflexivo, profundo, claro, accesible.\n";
            sistema += "Presenta múltiples perspectivas sin dogmatismo.\n";
        } else if (opciones.enfoqueEtico) {
            sistema += "[MODO ÉTICO ACTIVADO]\n";
            sistema += "Estás analizando un dilema moral.\n";
            sistema += "Considera principios UNESCO: dignidad humana, justicia, responsabilidad.\n";
            sistema += "Sé reflexivo pero práctico.\n";
        } else if (opciones.enfoqueNegociacion) {
            sistema += "[MODO NEGOCIADOR ACTIVADO]\n";
            sistema += "Estás ayudando en una negociación o conflicto.\n";
            sistema += "Busca soluciones ganar-ganar.\n";
            sistema += "Sé estratégico pero empático.\n";
        }
        
        sistema += "\nHistorial reciente de conversación:\n";
        
        // Historial reciente
        const historialReciente = historial.slice(-4);
        for (const msg of historialReciente) {
            if (msg.rol === 'system') continue;
            
            mensajes.push({
                role: msg.rol === 'assistant' ? 'assistant' : 'user',
                content: msg.contenido.substring(0, 200)
            });
        }
        
        // Prompt base
        mensajes.push({
            role: "user",
            content: promptBase
        });
        
        const completion = await groqClient.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: sistema
                },
                ...mensajes
            ],
            temperature: opciones.temperatura || 0.7,
            max_tokens: opciones.max_tokens || 600,
            top_p: 0.9,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        });
        
        let respuesta = completion.choices[0]?.message?.content?.trim();
        
        if (!respuesta) {
            throw new Error('No se generó respuesta');
        }
        
        // Post-procesamiento
        respuesta = respuesta
            .replace(/\[.*?\]/g, '')
            .replace(/RESPUESTA:/gi, '')
            .replace(/CONTEXTO:/gi, '')
            .trim();
        
        if (respuesta.length > 0) {
            respuesta = respuesta.charAt(0).toUpperCase() + respuesta.slice(1);
            if (!/[.!?]$/.test(respuesta)) {
                respuesta += '.';
            }
        }
        
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error con Groq:', error);
        return "Lo siento, estoy procesando tu pregunta. ¿Podrías reformularla?";
    }
}

async function procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto) {
    try {
        await message.channel.sendTyping();
        
        agregarAlHistorial(userId, 'user', userMessage);
        
        const necesitaBusqueda = userMessage.includes('?') || userMessage.length > 15;
        
        let informacionExterna = '';
        
        if (necesitaBusqueda) {
            const resultado = await conocimiento.buscarInformacion(userMessage);
            if (resultado.encontrado) {
                informacionExterna = `\n[Información encontrada]: ${resultado.resumen}\n`;
                console.log(`✅ Información de ${resultado.datos.fuente}`);
            }
        }
        
        const historial = obtenerHistorialUsuario(userId);
        
        const prompt = `[CONSULTA DE CONOCIMIENTO]
Usuario pregunta: "${userMessage}"

${informacionExterna ? `INFORMACIÓN ENCONTRADA: ${informacionExterna}` : ''}

[INSTRUCCIONES PARA MANCY]
1. Responde de forma natural y cálida
2. Si hay información externa, intégrala sin decir "según fuentes"
3. Sé una amiga que sabe cosas, no una enciclopedia
4. Mantén tu estilo juguetón pero informado
5. Si no hay información, di lo que sepas de forma honesta`;

        const respuesta = await generarRespuestaConGroq(prompt, historial, userId);
        
        agregarAlHistorial(userId, 'assistant', respuesta);
        console.log(`✅ Respondió (historial: ${historial.length}/270)`);
        
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error en conocimiento:', error);
        return "Ups, se me trabó un poco al buscar información... ¿podemos intentarlo de nuevo? ~";
    }
}

async function procesarConRazonamiento(message, userMessage, userId) {
    try {
        console.log(`🤔 [RAZONAMIENTO] Procesando: ${userMessage.substring(0, 50)}...`);
        
        await message.channel.sendTyping();
        
        const contexto = {
            userId: userId,
            username: message.author.tag,
            isDM: message.channel.type === 1
        };
        
        const resultado = reasoningEngine.procesarConsulta(userMessage, contexto);
        
        agregarAlHistorial(userId, 'user', userMessage);
        
        let respuestaFinal;
        if (resultado.certeza >= 0.6 && resultado.respuesta) {
            respuestaFinal = resultado.respuesta;
            agregarAlHistorial(userId, 'system', 
                `[Razonamiento: ${resultado.pasosRazonamiento} inferencias]`);
        } else {
            // Combinar con Groq
            const historial = obtenerHistorialUsuario(userId);
            
            const prompt = `[ANÁLISIS DE RAZONAMIENTO]
He analizado esta pregunta y encontré:
${resultado.inferencias?.slice(0, 3).map((inf, idx) => 
    `${idx + 1}. ${inf.inferencia}`
).join('\n') || 'Necesito más contexto'}

[PREGUNTA ORIGINAL]
"${userMessage}"

[INSTRUCCIONES]
Integra este análisis en tu respuesta de forma natural.
No digas "según mi análisis".
Sé Mancy: cálida, perspicaz, reflexiva.`;
            
            respuestaFinal = await generarRespuestaConGroq(prompt, historial, userId, {
                temperatura: 0.6
            });
        }
        
        agregarAlHistorial(userId, 'assistant', respuestaFinal);
        return respuestaFinal;
        
    } catch (error) {
        console.error('❌ Error en razonamiento:', error);
        return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, {});
    }
}

async function procesarConsultaEticaIntegrada(message, userMessage, userId, contexto) {
    try {
        // Primero verificar si es pregunta específica sobre UNESCO
        const esPreguntaUNESCO = ethicsModule.detectarPreguntaEspecificaUNESCO(userMessage);
        
        if (esPreguntaUNESCO) {
            const respuestaUNESCO = ethicsModule.generarRespuestaEticaUNESCO(userMessage, contexto);
            return respuestaUNESCO.respuesta;
        }
        
        // Procesamiento ético normal
        const resultadoEtica = ethicsModule.procesarConsultaEticaIntegrada(userMessage, contexto);
        
        if (!resultadoEtica || !resultadoEtica.esEtica) {
            return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
        }
        
        const historial = obtenerHistorialUsuario(userId);
        
        const prompt = `[ANÁLISIS ÉTICO]
${resultadoEtica.respuestaUNESCO || resultadoEtica.analisis?.explicacion || 'Analizando dilema moral...'}

[PREGUNTA ORIGINAL]
"${userMessage}"

[INSTRUCCIONES PARA MANCY]
1. Integra el análisis ético de forma natural
2. Considera principios UNESCO cuando sea relevante
3. Sé reflexiva pero accesible
4. Haz 1 pregunta que invite a pensar más
5. Mantén tu estilo cálido y perspicaz
6. NO uses terminología técnica ética`;

        const respuesta = await generarRespuestaConGroq(prompt, historial, userId, {
            enfoqueEtico: true,
            temperatura: 0.65
        });
        
        agregarAlHistorial(userId, 'system', `[Ética: ${resultadoEtica.tipo || 'dilema'}]`);
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error en ética:', error);
        return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
    }
}

async function procesarNegociacionIntegrada(message, userMessage, userId, contexto) {
    try {
        const resultadoNegociacion = negotiationModule.procesarNegociacionIntegrada(userMessage, contexto);
        
        if (!resultadoNegociacion || !resultadoNegociacion.esNegociacion) {
            return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
        }
        
        const historial = obtenerHistorialUsuario(userId);
        
        const prompt = `[ANÁLISIS DE NEGOCIACIÓN]
${resultadoNegociacion.respuestaNatural?.respuesta || 'Analizando situación de negociación...'}

Estrategia recomendada: ${resultadoNegociacion.analisis?.estrategia?.recomendada?.nombre || 'Ganar-Ganar'}

[PREGUNTA ORIGINAL]
"${userMessage}"

[INSTRUCCIONES PARA MANCY]
1. Guía hacia una solución constructiva
2. Sugiere enfoques prácticos
3. Considera la importancia de la relación
4. Haz preguntas que clarifiquen intereses
5. Sé estratégica pero empática
6. NO uses jerga de negociación`;

        const respuesta = await generarRespuestaConGroq(prompt, historial, userId, {
            enfoqueNegociacion: true,
            temperatura: 0.6
        });
        
        agregarAlHistorial(userId, 'system', '[Negociación: análisis estratégico]');
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error en negociación:', error);
        return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
    }
}

async function procesarFilosofiaIntegrada(message, userMessage, userId, contexto) {
    try {
        const analisisFilosofico = philosophyModule.analizarProblemaFilosofico(userMessage, contexto);
        
        if (!analisisFilosofico.esFilosofico) {
            return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
        }
        
        const historial = obtenerHistorialUsuario(userId);
        
        let prompt = `[ANÁLISIS FILOSÓFICO]
Problema identificado: ${analisisFilosofico.analisis?.problemaIdentificado?.nombre || 'Cuestionamiento filosófico'}

Perspectivas relevantes:
${analisisFilosofico.analisis?.enfoquesRelevantes?.slice(0, 2).map((e, i) => 
    `${i+1}. ${e.nombre}: ${e.principios?.[0]?.substring(0, 80)}...`
).join('\n') || 'Múltiples enfoques posibles'}

[PREGUNTA ORIGINAL]
"${userMessage}"

[INSTRUCCIONES PARA MANCY]
1. Sé profundo pero accesible
2. Presenta al menos 2 perspectivas diferentes
3. Conecta con la experiencia humana
4. Haz preguntas que inviten a reflexionar más
5. Mantén tu estilo cálido y reflexivo
6. NO des una clase de filosofía`;

        const respuesta = await generarRespuestaConGroq(prompt, historial, userId, {
            enfoqueFilosofico: true,
            temperatura: 0.7
        });
        
        agregarAlHistorial(userId, 'system', `[Filosofía: ${analisisFilosofico.tipoProblema}]`);
        return respuesta;
        
    } catch (error) {
        console.error('❌ Error en filosofía:', error);
        return await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
    }
}

// ========== PROCESAMIENTO PRINCIPAL ==========
async function procesarMensajeMancy(message, userMessage, userId) {
    try {
        await message.channel.sendTyping();
        
        const historial = obtenerHistorialUsuario(userId);
        const contexto = {
            userId: userId,
            username: message.author.tag,
            isDM: message.channel.type === 1,
            canal: message.channel.name,
            historialReciente: historial.slice(-3).map(h => h.contenido)
        };
        
        // Detectar tipo de consulta
        const tipoConsulta = detectarTipoConsultaInteligente(userMessage, historial);
        
        console.log(`🎯 [Mancy] Tipo: ${tipoConsulta.tipo} (${(tipoConsulta.confianza * 100).toFixed(0)}% confianza)`);
        
        let respuesta;
        
        switch(tipoConsulta.tipo) {
            case 'filtro':
                respuesta = filtroContenido.generarRespuestaSarcastica();
                agregarAlHistorial(userId, 'system', '[Filtro: contenido inapropiado]');
                break;
                
            case 'etica_unesco':
                const respuestaUNESCO = ethicsModule.generarRespuestaEticaUNESCO(userMessage, contexto);
                respuesta = respuestaUNESCO.respuesta;
                agregarAlHistorial(userId, 'system', '[UNESCO: principios éticos]');
                break;
                
            case 'filosofia':
                respuesta = await procesarFilosofiaIntegrada(message, userMessage, userId, contexto);
                break;
                
            case 'etica':
                respuesta = await procesarConsultaEticaIntegrada(message, userMessage, userId, contexto);
                break;
                
            case 'negociacion':
                respuesta = await procesarNegociacionIntegrada(message, userMessage, userId, contexto);
                break;
                
            case 'razonamiento':
                respuesta = await procesarConRazonamiento(message, userMessage, userId);
                break;
                
            case 'emocional':
                respuesta = await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
                agregarAlHistorial(userId, 'system', '[Modo: empático]');
                break;
                
            default:
                respuesta = await procesarMensajeConocimientoIntegrado(message, userMessage, userId, contexto);
        }
        
        // Enviar respuesta
        if (respuesta && respuesta.length > 0) {
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
            
            agregarAlHistorial(userId, 'assistant', respuesta);
        }
        
    } catch (error) {
        console.error('❌ Error en Mancy:', error);
        try {
            await message.reply("Ups, se me trabó un poco... ¿podemos intentarlo de nuevo? ~");
        } catch (e) {
            console.error('❌ Error al enviar fallback:', e);
        }
    }
}

// ========== FUNCIÓN PARA INICIAR BOT ==========
async function startBot() {
    if (isStartingUp) return;
    isStartingUp = true;
    
    try {
        console.log('🔄 Iniciando Mancy...');
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('Falta DISCORD_TOKEN');
        }
        if (!process.env.GROQ_API_KEY) {
            throw new Error('Falta GROQ_API_KEY');
        }
        
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages,
            ]
        });
        
        discordClient.once('ready', () => {
            console.log(`✅ Mancy conectada: ${discordClient.user.tag}`);
            botActive = true;
            isStartingUp = false;
            discordClient.user.setActivity('UNESCO Principles | @mencioname');
            console.log('🎭 Personalidad: UNESCO Ética Integrada');
            console.log('🧠 Módulos: Filosofía, Negociación, Ética, Razonamiento');
            console.log('🌍 Fuentes: 6 confiables verificadas');
            console.log('🛡️ Filtro: Sarcasmo-elegante activado');
        });
        
        discordClient.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const botMentioned = discordClient.user && message.mentions.has(discordClient.user.id);
            const isDM = message.channel.type === 1;
            
            // Para DMs no mencionadas
            if (isDM && !botMentioned) {
                const userMessage = message.content.trim();
                
                if (filtroContenido.esContenidoInapropiado(userMessage)) {
                    console.log(`🚫 DM inapropiada de ${message.author.tag}`);
                    const respuesta = filtroContenido.generarRespuestaDM();
                    await message.reply(respuesta);
                    return;
                }
                
                // En DMs, siempre responder
                const userId = message.author.id;
                
                if (!userMessage) return;
                
                console.log(`💬 DM de ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                await procesarMensajeMancy(message, userMessage, userId);
                return;
            }
            
            // Para menciones en canales
            if (botMentioned) {
                const userId = message.author.id;
                const userMessage = message.content.replace(`<@${discordClient.user.id}>`, '').trim();
                
                if (!userMessage) {
                    await message.reply("¡Hola! ¿En qué puedo ayudarte hoy? ~");
                    return;
                }
                
                console.log(`💬 ${message.author.tag}: ${userMessage.substring(0, 50)}...`);
                await procesarMensajeMancy(message, userMessage, userId);
            }
        });
        
        await discordClient.login(process.env.DISCORD_TOKEN);
        
    } catch (error) {
        console.error('❌ Error:', error);
        isStartingUp = false;
    }
}

// ========== RUTAS WEB ==========
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

app.get('/', async (req, res) => {
    console.log('🔔 Visita recibida');
    
    if (!botActive && !isStartingUp && process.env.DISCORD_TOKEN) {
        setTimeout(() => {
            startBot().catch(() => {
                console.log('⚠️ No se pudo iniciar');
            });
        }, 1000);
    }
    
    res.sendFile('index.html', { root: '.' });
});

app.get('/test', (req, res) => {
    res.json({
        status: 'online',
        message: 'Servidor funcionando',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    const stats = memoryManager.obtenerEstadisticas();
    const reasoningStats = reasoningEngine.obtenerEstadisticas();
    const ethicsStats = ethicsModule.obtenerEstadisticasConversacionales();
    const negotiationStats = negotiationModule.obtenerEstadisticasConversacionales();
    
    res.json({
        bot_active: botActive,
        starting_up: isStartingUp,
        memory_users: stats.totalUsuarios,
        memory_messages: stats.totalMensajes,
        max_history: stats.maxHistory,
        reasoning_knowledge: reasoningStats.baseConocimiento,
        reasoning_cases: reasoningStats.casosResueltos,
        ethics_cases: ethicsStats.totalConsultasEticas,
        negotiation_cases: negotiationStats.totalNegociaciones,
        filtro_activo: true,
        unesco_principles: 6,
        philosophy_problems: Object.keys(philosophyModule.problemasClasicos).length,
        apis: [
            'Wikipedia (ES/EN)',
            'RestCountries',
            'PoetryDB',
            'Quotable',
            'Free Dictionary',
            'Open-Meteo'
        ],
        version: '4.0 - UNESCO Philosophy Edition',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/unesco-principles', (req, res) => {
    const principios = ethicsModule.explicarPrincipiosUNESCO('basico');
    res.json({
        principles: principios.principios,
        documents: ethicsModule.unescoPrinciples.documentosFundamentales.map(d => d.nombre),
        framework: 'UNESCO Ethical Framework',
        integrated: true
    });
});

app.get('/api/philosophy-problems', (req, res) => {
    const problemas = philosophyModule.problemasClasicos;
    res.json({
        total_problems: Object.keys(problemas).length,
        classical_problems: Object.entries(problemas).map(([key, prob]) => ({
            name: prob.nombre,
            type: key
        })),
        philosophical_schools: Object.keys(philosophyModule.escuelasFilosoficas.etica)
    });
});

app.get('/api/negotiation-strategies', (req, res) => {
    const estrategias = negotiationModule.estrategias;
    res.json({
        total_strategies: Object.keys(estrategias).length,
        strategies: Object.entries(estrategias).map(([key, strat]) => ({
            name: strat.nombre,
            description: strat.descripcion,
            when_to_use: strat.cuandoUsar
        }))
    });
});

app.post('/api/start', async (req, res) => {
    try {
        console.log('🚀 Solicitud de inicio');
        
        if (!botActive && !isStartingUp) {
            await startBot();
            res.json({ 
                success: true, 
                message: 'Mancy iniciándose...',
                status: 'starting'
            });
        } else {
            res.json({ 
                success: true, 
                message: botActive ? 'Ya activa' : 'Ya iniciándose',
                status: botActive ? 'active' : 'starting'
            });
        }
    } catch (error) {
        console.error('❌ Error en start:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.post('/api/stop', async (req, res) => {
    try {
        console.log('🛑 Solicitud de detención');
        
        if (discordClient) {
            discordClient.destroy();
            discordClient = null;
            botActive = false;
            res.json({ 
                success: true, 
                message: 'Mancy detenida',
                status: 'stopped'
            });
        } else {
            res.json({ 
                success: true, 
                message: 'Ya inactiva',
                status: 'inactive'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/health', (req, res) => {
    const stats = memoryManager.obtenerEstadisticas();
    
    res.json({
        status: 'healthy',
        bot_active: botActive,
        memory: `${stats.totalMensajes}/${stats.maxHistory}`,
        modules: {
            ethics: 'active',
            philosophy: 'active',
            negotiation: 'active',
            reasoning: 'active',
            knowledge: 'active'
        },
        unesco: 'integrated',
        uptime: process.uptime()
    });
});

app.post('/wakeup', async (req, res) => {
    console.log('🔔 Wakeup recibido');
    
    if (!botActive && !isStartingUp) {
        startBot();
    }
    
    res.json({ 
        success: true, 
        message: 'Activando...',
        bot_active: botActive
    });
});

app.get('/api/buscar/:query', async (req, res) => {
    try {
        const { query } = req.params;
        const resultado = await conocimiento.buscarInformacion(query);
        
        res.json({
            success: true,
            query: query,
            encontrado: resultado.encontrado,
            fuente: resultado.datos?.fuente,
            resumen: resultado.resumen,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║                 🤖 MANCY A.I - UNESCO EDITION           ║
║               Asistente Ético Inteligente               ║
║                                                          ║
║  🌍 PRINCIPIOS UNESCO: 6 fundamentos éticos universales ║
║  🧠 FILOSOFÍA: Análisis profundo de problemas clásicos  ║
║  🤝 NEGOCIACIÓN: Estrategias inteligentes y prácticas   ║
║  ⚖️  ÉTICA: Dilemas morales con marco UNESCO            ║
║  🧠 RAZONAMIENTO: Lógica y análisis crítico             ║
║  📚 CONOCIMIENTO: 6 fuentes confiables verificadas      ║
║  🛡️  FILTRO: Sarcasmo elegante para contenido inapropiado ║
║                                                          ║
║  MODOS AUTOMÁTICOS:                                     ║
║  • Detecta dilemas éticos → Activa Modo Filósofo        ║
║  • Detecta conflictos → Activa Modo Negociador          ║
║  • Detecta preguntas profundas → Análisis filosófico    ║
║  • Pregunta normal → Respuesta informada                ║
║                                                          ║
║  PERSONALIDAD:                                          ║
║  • Cálida pero perspicaz                                ║
║  • Empática pero lógica                                 ║
║  • Reflexiva pero accesible                             ║
║  • Sarcástica-elegante cuando es necesario              ║
║                                                          ║
║  🎯 SIN COMANDOS: Habla normalmente, Mancy detecta      ║
║  💬 CONVERSACIONAL: Integración natural y fluida        ║
║  🌱 APRENDIZAJE: Mejora con cada interacción            ║
║                                                          ║
║  Puerto: ${PORT}                                         ║
║  UNESCO Principles: ✅ Activado                          ║
║  Ethical AI: ✅ Certificado                              ║
╚══════════════════════════════════════════════════════════╝
`);

    console.log('\n✨ Mancy está lista para conversaciones profundas y significativas.');
    console.log('🌍 Principios UNESCO integrados como brújula ética fundamental.');
    console.log('🧠 Sistema detecta automáticamente: ética, filosofía, negociación, conocimiento.');
    console.log('🎭 Personalidad: Cálida, reflexiva, sarcástica-elegante cuando es necesario.');
    console.log('\n💬 Ejemplos de lo que puedes preguntar:');
    console.log('   • "¿En qué se basa tu ética?" → Explicación UNESCO');
    console.log('   • "¿Qué harías en el problema del tranvía?" → Análisis filosófico');
    console.log('   • "Mi amigo y yo discutimos sobre gastos" → Guía de negociación');
    console.log('   • "¿Quién fue Simone de Beauvoir?" → Información con contexto');
    console.log('   • Cualquier dilema moral → Análisis ético integrado');
    
    if (process.env.DISCORD_TOKEN && process.env.GROQ_API_KEY) {
        console.log('\n🔑 Tokens detectados, iniciando en 3 segundos...');
        setTimeout(() => {
            startBot().catch(err => {
                console.log('⚠️ Auto-inicio falló:', err.message);
            });
        }, 3000);
    }
});

process.on('SIGTERM', () => {
    console.log('💤 Apagando...');
    
    if (discordClient) {
        discordClient.destroy();
        console.log('👋 Mancy desconectada');
    }
    
    process.exit(0);
});
