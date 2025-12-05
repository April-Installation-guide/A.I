export class MemoryManager {
    constructor(maxHistory = 500) { // 85% más capacidad
        this.maxHistory = maxHistory;
        this.userHistories = new Map();
        this.userProfiles = new Map(); // Perfiles mejorados
        this.emotionalPatterns = new Map(); // Patrones emocionales
        this.conversationVectors = new Map(); // Vectores semánticos
        this.knowledgeGraph = new Map(); // Grafo de conocimiento por usuario
    }

    obtenerHistorialUsuario(userId) {
        return this.userHistories.get(userId) || [];
    }

    agregarAlHistorial(userId, rol, contenido) {
        if (!this.userHistories.has(userId)) {
            this.userHistories.set(userId, []);
        }
        
        const historial = this.userHistories.get(userId);
        const timestamp = new Date();
        
        // Análisis avanzado del mensaje
        const analisisMensaje = this.analizarMensajeAvanzado(contenido, rol);
        
        historial.push({
            rol,
            contenido,
            timestamp: timestamp.toISOString(),
            analisis: analisisMensaje,
            embeddings: this.generarEmbeddingSimple(contenido),
            emocion: this.detectarEmocionAvanzada(contenido)
        });
        
        // Actualizar perfil del usuario
        this.actualizarPerfilUsuario(userId, contenido, rol, analisisMensaje);
        
        // Actualizar grafo de conocimiento
        this.actualizarGrafoConocimiento(userId, contenido, analisisMensaje.temas);
        
        // Mantener límite con prioridad inteligente
        if (historial.length > this.maxHistory) {
            this.mantenimientoInteligente(userId);
        }
        
        return historial;
    }

    analizarMensajeAvanzado(texto, rol) {
        const analisis = {
            longitud: texto.length,
            complejidad: this.calcularComplejidad(texto),
            temas: this.extraerTemas(texto),
            intencion: this.detectarIntencion(texto),
            preguntas: this.extraerPreguntas(texto),
            argumentos: this.identificarArgumentos(texto)
        };
        
        // Análisis semántico profundo
        const palabrasClave = this.extraerPalabrasClave(texto);
        const relacionTemas = this.analizarRelacionTematicas(palabrasClave);
        
        return {
            ...analisis,
            palabrasClave,
            relacionTemas,
            coherencia: this.calcularCoherencia(texto),
            profundidad: this.calcularProfundidadFilosofica(texto)
        };
    }

    calcularComplejidad(texto) {
        const palabras = texto.split(/\s+/).length;
        const oraciones = texto.split(/[.!?]+/).length - 1;
        const palabrasComplejas = texto.match(/\b[a-zA-Z]{8,}\b/g) || [];
        
        return Math.min(1, (palabrasComplejas.length / palabras) * 3 + 
                       (palabras / Math.max(1, oraciones)) / 20);
    }

    extraerTemas(texto) {
        const temas = [];
        const textoLower = texto.toLowerCase();
        
        const categorias = {
            filosofia: ['filosofía', 'ética', 'moral', 'existencia', 'libre albedrío', 'conocimiento'],
            ciencia: ['ciencia', 'tecnología', 'investigación', 'experimento', 'método científico'],
            arte: ['arte', 'literatura', 'música', 'creatividad', 'expresión'],
            relaciones: ['amistad', 'amor', 'familia', 'conflicto', 'comunicación'],
            psicologia: ['mente', 'emociones', 'conducta', 'personalidad', 'terapia'],
            tecnologia: ['ia', 'inteligencia artificial', 'algoritmo', 'programación', 'digital']
        };
        
        Object.entries(categorias).forEach(([categoria, palabras]) => {
            const coincidencias = palabras.filter(p => textoLower.includes(p));
            if (coincidencias.length > 0) {
                temas.push({
                    categoria,
                    fuerza: coincidencias.length / palabras.length,
                    palabras: coincidencias
                });
            }
        });
        
        return temas;
    }

    detectarIntencion(texto) {
        const lower = texto.toLowerCase();
        
        if (lower.includes('?') || /^(cómo|qué|por qué|cuándo|dónde|quién)/i.test(texto)) {
            return 'pregunta';
        }
        if (/(quiero|necesito|me gustaría|busco)/i.test(lower)) {
            return 'solicitud';
        }
        if (/(gracias|agradezco|aprecio)/i.test(lower)) {
            return 'agradecimiento';
        }
        if (/(opinas|piensas|crees|consideras)/i.test(lower)) {
            return 'opinion';
        }
        if (/(ayuda|ayúdame|assistance)/i.test(lower)) {
            return 'ayuda';
        }
        
        return 'conversacion';
    }

    extraerPreguntas(texto) {
        const preguntas = texto.split(/[.!?]+/).filter(oracion => 
            oracion.trim().endsWith('?') || /^(cómo|qué|por qué|cuándo|dónde|quién)/i.test(oracion.trim())
        );
        
        return preguntas.map(p => ({
            texto: p.trim(),
            tipo: this.clasificarPregunta(p)
        }));
    }

    clasificarPregunta(pregunta) {
        const lower = pregunta.toLowerCase();
        
        if (/^(qué es|qué significa|definición)/i.test(lower)) return 'definicion';
        if (/^(cómo funciona|cómo se|cómo hacer)/i.test(lower)) return 'procedimiento';
        if (/^(por qué|causa|razón)/i.test(lower)) return 'causa';
        if (/^(cuándo|dónde|quién)/i.test(lower)) return 'especifico';
        if (/^(debería|está bien|es correcto|moral)/i.test(lower)) return 'etica';
        if (/^(qué opinas|qué piensas|qué crees)/i.test(lower)) return 'opinion';
        
        return 'general';
    }

    identificarArgumentos(texto) {
        const argumentos = [];
        const oraciones = texto.split(/[.!?]+/);
        
        oraciones.forEach((oracion, index) => {
            if (oracion.trim().length < 10) return;
            
            // Detectar premisas y conclusiones
            const indicadoresPremisa = ['porque', 'dado que', 'ya que', 'debido a'];
            const indicadoresConclusion = ['por lo tanto', 'así que', 'en consecuencia', 'luego'];
            
            const esPremisa = indicadoresPremisa.some(i => oracion.toLowerCase().includes(i));
            const esConclusion = indicadoresConclusion.some(i => oracion.toLowerCase().includes(i));
            
            if (esPremisa || esConclusion) {
                argumentos.push({
                    tipo: esPremisa ? 'premisa' : 'conclusion',
                    contenido: oracion.trim(),
                    posicion: index
                });
            }
        });
        
        return argumentos;
    }

    extraerPalabrasClave(texto) {
        // Lista de palabras vacías (stop words) en español
        const stopWords = ['de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros', 'mi', 'mis', 'tú', 'te', 'ti', 'tu', 'tus', 'ellas', 'nosotras', 'vosotros', 'vosotras', 'os', 'mío', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas', 'nuestro', 'nuestra', 'nuestros', 'nuestras', 'vuestro', 'vuestra', 'vuestros', 'vuestras', 'esos', 'esas', 'estoy', 'estás', 'está', 'estamos', 'estáis', 'están', 'esté', 'estés', 'estemos', 'estéis', 'estén', 'estaré', 'estarás', 'estará', 'estaremos', 'estaréis', 'estarán', 'estaría', 'estarías', 'estaríamos', 'estaríais', 'estarían', 'estaba', 'estabas', 'estábamos', 'estabais', 'estaban', 'estuve', 'estuviste', 'estuvo', 'estuvimos', 'estuvisteis', 'estuvieron', 'estuviera', 'estuvieras', 'estuviéramos', 'estuvierais', 'estuvieran', 'estuviese', 'estuvieses', 'estuviésemos', 'estuvieseis', 'estuviesen', 'estando', 'estado', 'estada', 'estados', 'estadas', 'estad', 'he', 'has', 'ha', 'hemos', 'habéis', 'han', 'haya', 'hayas', 'hayamos', 'hayáis', 'hayan', 'habré', 'habrás', 'habrá', 'habremos', 'habréis', 'habrán', 'habría', 'habrías', 'habríamos', 'habríais', 'habrían', 'había', 'habías', 'habíamos', 'habíais', 'habían', 'hube', 'hubiste', 'hubo', 'hubimos', 'hubisteis', 'hubieron', 'hubiera', 'hubieras', 'hubiéramos', 'hubierais', 'hubieran', 'hubiese', 'hubieses', 'hubiésemos', 'hubieseis', 'hubiesen', 'habiendo', 'habido', 'habida', 'habidos', 'habidas', 'soy', 'eres', 'es', 'somos', 'sois', 'son', 'sea', 'seas', 'seamos', 'seáis', 'sean', 'seré', 'serás', 'será', 'seremos', 'seréis', 'serán', 'sería', 'serías', 'seríamos', 'seríais', 'serían', 'era', 'eras', 'éramos', 'erais', 'eran', 'fui', 'fuiste', 'fue', 'fuimos', 'fuisteis', 'fueron', 'fuera', 'fueras', 'fuéramos', 'fuerais', 'fueran', 'fuese', 'fueses', 'fuésemos', 'fueseis', 'fuesen', 'sintiendo', 'sentido', 'tengo', 'tienes', 'tiene', 'tenemos', 'tenéis', 'tienen', 'tenga', 'tengas', 'tengamos', 'tengáis', 'tengan', 'tendré', 'tendrás', 'tendrá', 'tendremos', 'tendréis', 'tendrán', 'tendría', 'tendrías', 'tendríamos', 'tendríais', 'tendrían', 'tenía', 'tenías', 'teníamos', 'teníais', 'tenían', 'tuve', 'tuviste', 'tuvo', 'tuvimos', 'tuvisteis', 'tuvieron', 'tuviera', 'tuvieras', 'tuviéramos', 'tuvierais', 'tuvieran', 'tuviese', 'tuvieses', 'tuviésemos', 'tuvieseis', 'tuviesen', 'teniendo', 'tenido', 'tenida', 'tenidos', 'tenidas', 'tened'];
        
        const palabras = texto.toLowerCase()
            .replace(/[^\w\sáéíóúüñ]/g, ' ')
            .split(/\s+/)
            .filter(palabra => 
                palabra.length > 3 && 
                !stopWords.includes(palabra) &&
                !/\d/.test(palabra)
            );
        
        // Frecuencia de palabras
        const frecuencia = {};
        palabras.forEach(palabra => {
            frecuencia[palabra] = (frecuencia[palabra] || 0) + 1;
        });
        
        // Ordenar por frecuencia y devolver las 10 más comunes
        return Object.entries(frecuencia)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([palabra,]) => palabra);
    }

    analizarRelacionTematicas(palabrasClave) {
        const relaciones = {
            'filosofia': ['ética', 'moral', 'pensamiento', 'existencia'],
            'ciencia': ['investigación', 'método', 'experimento', 'tecnología'],
            'arte': ['creatividad', 'expresión', 'belleza', 'cultura'],
            'tecnologia': ['digital', 'algoritmo', 'programación', 'innovación']
        };
        
        const scores = {};
        
        palabrasClave.forEach(palabra => {
            Object.entries(relaciones).forEach(([tema, palabrasRelacionadas]) => {
                if (palabrasRelacionadas.includes(palabra)) {
                    scores[tema] = (scores[tema] || 0) + 1;
                }
            });
        });
        
        return Object.entries(scores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
    }

    calcularCoherencia(texto) {
        const oraciones = texto.split(/[.!?]+/).filter(o => o.trim().length > 5);
        if (oraciones.length < 2) return 1;
        
        let cambiosTema = 0;
        let temaAnterior = null;
        
        for (let i = 0; i < oraciones.length; i++) {
            const temasActual = this.extraerTemas(oraciones[i]);
            const temaPrincipal = temasActual[0]?.categoria || 'general';
            
            if (temaAnterior && temaPrincipal !== temaAnterior) {
                cambiosTema++;
            }
            
            temaAnterior = temaPrincipal;
        }
        
        return Math.max(0, 1 - (cambiosTema / oraciones.length));
    }

    calcularProfundidadFilosofica(texto) {
        let score = 0;
        
        // Palabras indicadoras de profundidad
        const palabrasProfundas = [
            'existencia', 'conciencia', 'realidad', 'verdad', 'significado',
            'libertad', 'determinismo', 'moral', 'ética', 'justicia',
            'tiempo', 'espacio', 'universo', 'infinito', 'finito',
            'mente', 'cuerpo', 'alma', 'espíritu', 'materialismo',
            'idealismo', 'racionalismo', 'empirismo', 'escepticismo'
        ];
        
        const textoLower = texto.toLowerCase();
        palabrasProfundas.forEach(palabra => {
            if (textoLower.includes(palabra)) {
                score += 1;
            }
        });
        
        // Preguntas profundas
        const preguntasProfundas = [
            /por qué existimos?/i,
            /qué es (la verdad|la realidad|la conciencia)/i,
            /tiene sentido la vida?/i,
            /qué es (el bien|el mal)/i,
            /somos libres?/i
        ];
        
        preguntasProfundas.forEach(regex => {
            if (regex.test(texto)) {
                score += 2;
            }
        });
        
        // Longitud y complejidad
        const complejidad = this.calcularComplejidad(texto);
        score += complejidad * 3;
        
        return Math.min(10, score) / 10;
    }

    generarEmbeddingSimple(texto) {
        // Embedding simplificado (en un sistema real usarías un modelo)
        const palabras = texto.toLowerCase().split(/\s+/);
        const vector = {
            emocional: this.detectarEmocionAvanzada(texto).valor,
            complejidad: this.calcularComplejidad(texto),
            longitud: Math.min(1, texto.length / 1000),
            interrogativo: texto.includes('?') ? 1 : 0,
            filosofico: this.calcularProfundidadFilosofica(texto)
        };
        
        return vector;
    }

    detectarEmocionAvanzada(texto) {
        const emociones = {
            alegria: ['feliz', 'contento', 'alegre', 'emocionado', 'entusiasmado', 'genial', 'maravilloso'],
            tristeza: ['triste', 'deprimido', 'melancólico', 'desanimado', 'desesperado', 'solo'],
            ira: ['enojo', 'enfado', 'frustrado', 'molesto', 'indignado', 'rabia', 'ira'],
            miedo: ['miedo', 'temeroso', 'ansioso', 'preocupado', 'nervioso', 'asustado'],
            sorpresa: ['sorpresa', 'asombro', 'increíble', 'sorprendido', 'impresionado'],
            curiosidad: ['curioso', 'interesado', 'pregunta', 'quisiera saber', 'cómo funciona'],
            confusión: ['confundido', 'no entiendo', 'perplejo', 'desconcertado'],
            gratitud: ['gracias', 'agradecido', 'aprecio', 'valoro', 'agradecimiento']
        };
        
        const textoLower = texto.toLowerCase();
        const scores = {};
        
        Object.entries(emociones).forEach(([emocion, palabras]) => {
            const coincidencias = palabras.filter(p => textoLower.includes(p)).length;
            if (coincidencias > 0) {
                scores[emocion] = coincidencias / palabras.length;
            }
        });
        
        if (Object.keys(scores).length === 0) {
            return { emocion: 'neutral', valor: 0.5, confianza: 0.3 };
        }
        
        const emocionDominante = Object.entries(scores)
            .reduce((a, b) => a[1] > b[1] ? a : b);
        
        return {
            emocion: emocionDominante[0],
            valor: emocionDominante[1],
            confianza: Math.min(1, emocionDominante[1] * 2),
            todas: scores
        };
    }

    actualizarPerfilUsuario(userId, mensaje, rol, analisis) {
        if (!this.userProfiles.has(userId)) {
            this.userProfiles.set(userId, {
                interacciones: 0,
                temasFavoritos: {},
                estiloComunicacion: {},
                nivelProfundidad: 0,
                emocionalPattern: {},
                conocimientoAreas: {},
                ultimaInteraccion: null
            });
        }
        
        const perfil = this.userProfiles.get(userId);
        perfil.interacciones++;
        perfil.ultimaInteraccion = new Date().toISOString();
        
        // Actualizar temas favoritos
        analisis.temas.forEach(tema => {
            perfil.temasFavoritos[tema.categoria] = 
                (perfil.temasFavoritos[tema.categoria] || 0) + tema.fuerza;
        });
        
        // Actualizar estilo de comunicación
        perfil.estiloComunicacion[analisis.intencion] = 
            (perfil.estiloComunicacion[analisis.intencion] || 0) + 1;
        
        // Actualizar patrón emocional
        const emocion = this.detectarEmocionAvanzada(mensaje);
        perfil.emocionalPattern[emocion.emocion] = 
            (perfil.emocionalPattern[emocion.emocion] || 0) + 1;
        
        // Actualizar nivel de profundidad
        perfil.nivelProfundidad = 
            (perfil.nivelProfundidad * (perfil.interacciones - 1) + analisis.profundidad) / perfil.interacciones;
    }

    actualizarGrafoConocimiento(userId, mensaje, temas) {
        if (!this.knowledgeGraph.has(userId)) {
            this.knowledgeGraph.set(userId, {
                conceptos: new Map(),
                relaciones: [],
                ultimaActualizacion: null
            });
        }
        
        const grafo = this.knowledgeGraph.get(userId);
        grafo.ultimaActualizacion = new Date().toISOString();
        
        // Extraer conceptos del mensaje
        const conceptos = this.extraerConceptos(mensaje);
        
        conceptos.forEach(concepto => {
            const conceptoActual = grafo.conceptos.get(concepto.nombre) || {
                nombre: concepto.nombre,
                frecuencia: 0,
                contexto: [],
                temas: [],
                ultimaMencion: null
            };
            
            conceptoActual.frecuencia++;
            conceptoActual.ultimaMencion = new Date().toISOString();
            conceptoActual.contexto.push(mensaje.substring(0, 100));
            conceptoActual.temas = [...new Set([...conceptoActual.temas, ...temas.map(t => t.categoria)])];
            
            grafo.conceptos.set(concepto.nombre, conceptoActual);
        });
        
        // Establecer relaciones entre conceptos
        if (conceptos.length > 1) {
            for (let i = 0; i < conceptos.length - 1; i++) {
                for (let j = i + 1; j < conceptos.length; j++) {
                    const relacion = {
                        conceptoA: conceptos[i].nombre,
                        conceptoB: conceptos[j].nombre,
                        fuerza: 1 / (Math.abs(i - j) + 1),
                        contexto: mensaje.substring(0, 150)
                    };
                    
                    grafo.relaciones.push(relacion);
                }
            }
        }
    }

    extraerConceptos(texto) {
        // Extraer sustantivos y conceptos importantes
        const palabras = texto.split(/\s+/);
        const conceptos = [];
        
        // Lista de indicadores de conceptos importantes
        const indicadores = [
            'es', 'son', 'significa', 'definición', 'concepto',
            'teoría', 'principio', 'ley', 'idea', 'nocion'
        ];
        
        palabras.forEach((palabra, index) => {
            // Palabras que probablemente sean conceptos importantes
            if (palabra.length > 5 && /^[A-Z]/.test(palabra)) {
                conceptos.push({
                    nombre: palabra,
                    posicion: index,
                    tipo: 'propio'
                });
            }
            
            // Si hay un indicador seguido de una palabra, es probablemente un concepto
            if (indicadores.includes(palabra.toLowerCase()) && palabras[index + 1]) {
                conceptos.push({
                    nombre: palabras[index + 1],
                    posicion: index + 1,
                    tipo: 'definido',
                    indicador: palabra
                });
            }
        });
        
        return conceptos.filter((c, i, arr) => 
            arr.findIndex(cc => cc.nombre === c.nombre) === i
        );
    }

    mantenimientoInteligente(userId) {
        const historial = this.userHistories.get(userId);
        if (!historial || historial.length <= this.maxHistory) return;
        
        // Mantener los mensajes más importantes
        const importancia = historial.map((msg, index) => ({
            index,
            importancia: this.calcularImportanciaMensaje(msg)
        }));
        
        importancia.sort((a, b) => b.importancia - a.importancia);
        
        // Mantener los más importantes y los más recientes
        const aMantener = new Set();
        
        // Los 20% más importantes
        const cantidadImportantes = Math.floor(this.maxHistory * 0.2);
        importancia.slice(0, cantidadImportantes).forEach(item => {
            aMantener.add(item.index);
        });
        
        // Los más recientes (últimos 80%)
        const cantidadRecientes = this.maxHistory - cantidadImportantes;
        for (let i = historial.length - 1; i >= 0 && aMantener.size < this.maxHistory; i--) {
            aMantener.add(i);
        }
        
        // Filtrar historial
        const nuevoHistorial = historial.filter((_, index) => aMantener.has(index));
        this.userHistories.set(userId, nuevoHistorial);
    }

    calcularImportanciaMensaje(mensaje) {
        let importancia = 0;
        
        // Mensajes del sistema son importantes
        if (mensaje.rol === 'system') importancia += 3;
        
        // Mensajes con análisis profundo
        if (mensaje.analisis) {
            importancia += mensaje.analisis.profundidad * 2;
            importancia += mensaje.analisis.complejidad * 1.5;
            
            // Mensajes con preguntas
            if (mensaje.analisis.preguntas?.length > 0) {
                importancia += mensaje.analisis.preguntas.length * 0.5;
            }
            
            // Mensajes con argumentos
            if (mensaje.analisis.argumentos?.length > 0) {
                importancia += mensaje.analisis.argumentos.length * 0.7;
            }
        }
        
        // Mensajes emocionales intensos
        if (mensaje.emocion && mensaje.emocion.confianza > 0.7) {
            importancia += mensaje.emocion.valor * 1.2;
        }
        
        return importancia;
    }

    obtenerPerfilUsuario(userId) {
        const perfil = this.userProfiles.get(userId);
        if (!perfil) return null;
        
        // Temas favoritos ordenados
        const temasFavoritos = Object.entries(perfil.temasFavoritos || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tema, score]) => ({ tema, score }));
        
        // Emociones más frecuentes
        const emocionesFrecuentes = Object.entries(perfil.emocionalPattern || {})
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([emocion, frecuencia]) => ({ emocion, frecuencia }));
        
        // Estilo de comunicación
        const estiloComunicacion = Object.entries(perfil.estiloComunicacion || {})
            .sort((a, b) => b[1] - a[1])
            .map(([tipo, count]) => ({ tipo, count }));
        
        // Conceptos más mencionados
        const grafo = this.knowledgeGraph.get(userId);
        const conceptosFrecuentes = grafo ? 
            Array.from(grafo.conceptos.entries())
                .sort((a, b) => b[1].frecuencia - a[1].frecuencia)
                .slice(0, 10)
                .map(([nombre, datos]) => ({ 
                    nombre, 
                    frecuencia: datos.frecuencia,
                    temas: datos.temas 
                })) : [];
        
        return {
            interacciones: perfil.interacciones,
            nivelProfundidad: perfil.nivelProfundidad,
            temasFavoritos,
            emocionesFrecuentes,
            estiloComunicacion,
            conceptosFrecuentes,
            ultimaInteraccion: perfil.ultimaInteraccion,
            antiguedad: this.calcularAntiguedad(perfil.ultimaInteraccion)
        };
    }

    calcularAntiguedad(fechaISO) {
        if (!fechaISO) return 'desconocida';
        
        const ahora = new Date();
        const ultima = new Date(fechaISO);
        const diferenciaMs = ahora - ultima;
        const diferenciaDias = Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
        
        if (diferenciaDias === 0) return 'hoy';
        if (diferenciaDias === 1) return 'ayer';
        if (diferenciaDias < 7) return `hace ${diferenciaDias} días`;
        if (diferenciaDias < 30) return `hace ${Math.floor(diferenciaDias / 7)} semanas`;
        if (diferenciaDias < 365) return `hace ${Math.floor(diferenciaDias / 30)} meses`;
        return `hace ${Math.floor(diferenciaDias / 365)} años`;
    }

    obtenerEstadisticas() {
        const totalUsuarios = this.userHistories.size;
        let totalMensajes = 0;
        let totalAnalizados = 0;
        
        this.userHistories.forEach(historial => {
            totalMensajes += historial.length;
            totalAnalizados += historial.filter(m => m.analisis).length;
        });
        
        const perfilesAnalizados = Array.from(this.userProfiles.values()).length;
        const grafosConocimiento = Array.from(this.knowledgeGraph.values()).length;
        
        return {
            totalUsuarios,
            totalMensajes,
            mensajesAnalizados: totalAnalizados,
            porcentajeAnalizado: totalMensajes > 0 ? (totalAnalizados / totalMensajes * 100).toFixed(1) : 0,
            perfilesUsuario: perfilesAnalizados,
            grafosConocimiento,
            maxHistory: this.maxHistory,
            capacidadUsada: ((totalMensajes / (totalUsuarios * this.maxHistory || 1)) * 100).toFixed(1)
        };
    }

    // Método para limpieza automática
    limpiezaAutomatica(diasRetencion = 30) {
        const limiteTiempo = new Date();
        limiteTiempo.setDate(limiteTiempo.getDate() - diasRetencion);
        
        let eliminados = 0;
        
        this.userHistories.forEach((historial, userId) => {
            const historialFiltrado = historial.filter(mensaje => {
                const fechaMensaje = new Date(mensaje.timestamp);
                return fechaMensaje > limiteTiempo;
            });
            
            eliminados += historial.length - historialFiltrado.length;
            this.userHistories.set(userId, historialFiltrado);
            
            // Si el historial queda vacío, limpiar también perfiles
            if (historialFiltrado.length === 0) {
                this.userProfiles.delete(userId);
                this.knowledgeGraph.delete(userId);
            }
        });
        
        return {
            mensajesEliminados: eliminados,
            fechaLimite: limiteTiempo.toISOString(),
            usuariosActivos: this.userHistories.size
        };
    }
}
