export class PhilosophyModule {
    constructor() {
        this.problemasClasicos = this.inicializarProblemasClasicos();
        this.escuelasFilosoficas = this.inicializarEscuelasFilosoficas();
        this.filosofosImportantes = this.inicializarFilosofos();
        this.conceptosClave = this.inicializarConceptosClave();
        this.historicoAnalisis = new Map(); // Para rastrear análisis previos
        console.log('🧠 PhilosophyModule inicializado - Versión Mejorada 2.0');
    }
    
    inicializarProblemasClasicos() {
        return {
            elTranvia: {
                nombre: "El problema del tranvía",
                descripcion: "Dilema ético sobre sacrificar una vida para salvar varias",
                versiones: [
                    { 
                        version: "Original (Foot, 1967)", 
                        escenario: "Tranvía fuera de control hacia 5 personas. ¿Debes desviarlo a una vía con 1 persona?",
                        variantes: ["Interruptor", "Pasarela", "Tranvía con botón"]
                    },
                    { 
                        version: "Pasarela gorda", 
                        escenario: "Persona obesa en puente detendría el tranvía. ¿La empujas?",
                        analisis: "Explora diferencia entre acción/omisión"
                    },
                    {
                        version: "Tranvía circular",
                        escenario: "Tranvía atrapado en bucle. ¿Sacrificas a uno para salvar a muchos en ciclo infinito?",
                        implicaciones: "Valor de la vida en contextos repetitivos"
                    }
                ],
                perspectivas: {
                    utilitarismo: "Sí, salva al mayor número",
                    deontologia: "No, no usar personas como medios",
                    relativismo: "Depende del contexto cultural",
                    contratoSocial: "¿Qué acordaría la sociedad?"
                }
            },
            elViolinista: {
                nombre: "El problema del violinista (Thomson, 1971)",
                descripcion: "Analogía sobre el aborto y derechos corporales",
                escenario: "Te despiertas conectado a un violinista moribundo por 9 meses para salvarlo",
                cuestionesClave: [
                    "Derecho a usar el cuerpo de otro",
                    "Responsabilidad por necesidades ajenas",
                    "Límites de la obligación moral"
                ],
                aplicaciones: ["Debate sobre aborto", "Donación de órganos obligatoria", "Deberes de rescate"]
            },
            laCaverna: {
                nombre: "El mito de la caverna (Platón)",
                descripcion: "Alegoría sobre realidad, conocimiento y educación",
                elementos: ["Sombras (apariencias)", "Fuego (conocimiento imperfecto)", "Sol (verdad)", "Prisioneros (ignorancia)"],
                interpretaciones: [
                    "Crítica a la educación tradicional",
                    "Naturaleza de la realidad",
                    "Rol del filósofo en sociedad"
                ]
            },
            libreAlbedrio: {
                nombre: "Libre albedrío vs determinismo",
                descripcion: "¿Tenemos verdadera libertad de elección?",
                argumentos: {
                    determinismo: ["Causalidad física", "Genética", "Ambiente", "Neurociencia"],
                    libertarismo: ["Conciencia", "Agencia moral", "Responsabilidad"],
                    compatibilismo: ["Libertad como ausencia de coacción"]
                },
                experimentos: ["Libet", "Frankfurt cases", "Dios omnipotente"]
            },
            laMaquinaDeExperiencias: {
                nombre: "La máquina de experiencias (Nozick, 1974)",
                descripcion: "¿Conectarías a una máquina que simule felicidad perfecta?",
                implicaciones: ["Valor de la realidad vs ilusión", "Importancia de la autenticidad", "Naturaleza del bienestar"]
            },
            elBarcoDeTeseo: {
                nombre: "Paradoja del barco de Teseo",
                descripcion: "Identidad a través del cambio gradual",
                versiones: ["Reemplazo gradual", "Reensamblaje de partes viejas"],
                aplicaciones: ["Identidad personal", "Propiedad intelectual", "Restauración histórica"]
            }
        };
    }
    
    inicializarEscuelasFilosoficas() {
        return {
            etica: {
                deontologia: {
                    nombre: "Deontología (Kant, Ross, Rawls)",
                    principios: [
                        "Imperativo categórico: Actúa solo según máximas que puedas querer como ley universal",
                        "Tratar a las personas como fines en sí mismas, no como medios",
                        "Deberes prima facie (Ross)",
                        "Justicia como imparcialidad (Rawls)"
                    ],
                    representantes: ["Immanuel Kant", "W.D. Ross", "John Rawls"],
                    criticas: ["Rigidez", "Conflictos entre deberes", "Poca sensibilidad contextual"]
                },
                utilitarismo: {
                    nombre: "Utilitarismo (Bentham, Mill, Singer)",
                    variantes: {
                        acto: "Evalúa cada acto individualmente",
                        regla: "Sigue reglas que maximicen utilidad",
                        preferencia: "Maximiza satisfacción de preferencias",
                        negativo: "Minimiza el sufrimiento"
                    },
                    principios: [
                        "Principio de utilidad: Máxima felicidad para el máximo número",
                        "Cálculo hedonístico (Bentham)",
                        "Calidades de placer (Mill)",
                        "Consideración igualitaria de intereses (Singer)"
                    ],
                    metricas: ["Placer/dolor", "Preferencias satisfechas", "Bienestar objetivo"]
                },
                eticaVirtud: {
                    nombre: "Ética de la virtud (Aristóteles, MacIntyre)",
                    conceptos: [
                        "Eudaimonia (florecimiento humano)",
                        "Auream mediocritas (justo medio)",
                        "Virtudes cardinales: Prudencia, Justicia, Fortaleza, Templanza",
                        "Phronesis (sabiduría práctica)"
                    ],
                    enfoque: "Desarrollar carácter virtuoso más que seguir reglas"
                },
                eticaCuidado: {
                    nombre: "Ética del cuidado (Gilligan, Noddings)",
                    principios: [
                        "Importancia de las relaciones",
                        "Responsividad",
                        "Cuidado como práctica relacional",
                        "Crítica a enfoques abstractos universales"
                    ],
                    contexto: "Desarrollada como respuesta feminista a teorías tradicionales"
                }
            },
            epistemologia: {
                racionalismo: {
                    nombre: "Racionalismo (Descartes, Spinoza, Leibniz)",
                    tesis: ["Conocimiento innato", "Razón como fuente primaria", "Deducción a priori"]
                },
                empirismo: {
                    nombre: "Empirismo (Locke, Berkeley, Hume)",
                    tesis: ["Tabula rasa", "Experiencia como fuente", "Inducción"]
                },
                escepticismo: {
                    nombre: "Escepticismo (Pirrón, Sexto Empírico)",
                    niveles: ["Metódico (Descartes)", "Radical", "Moderado"]
                }
            },
            metafisica: {
                realismo: "El mundo existe independientemente de la mente",
                idealismo: "La realidad es mental o depende de la mente",
                materialismo: "Solo existe lo material",
                dualismo: "Mente y materia son sustancias distintas"
            }
        };
    }
    
    inicializarFilosofos() {
        return {
            antiguos: [
                { nombre: "Sócrates", contribucion: "Método socrático, ética del conocimiento" },
                { nombre: "Platón", contribucion: "Teoría de las formas, estado ideal" },
                { nombre: "Aristóteles", contribucion: "Lógica, ética de la virtud, cuatro causas" }
            ],
            modernos: [
                { nombre: "Descartes", contribucion: "Cogito ergo sum, dualismo mente-cuerpo" },
                { nombre: "Kant", contribucion: "Filosofía crítica, deontología" },
                { nombre: "Nietzsche", contribucion: "Voluntad de poder, muerte de Dios" }
            ],
            contemporaneos: [
                { nombre: "Simone de Beauvoir", contribucion: "Feminismo existencialista" },
                { nombre: "Peter Singer", contribucion: "Utilitarismo práctico, liberación animal" },
                { nombre: "Martha Nussbaum", contribucion: "Enfoque de capacidades, emociones en ética" }
            ]
        };
    }
    
    inicializarConceptosClave() {
        return {
            logicos: ["Falacia", "Sofisma", "Síntesis", "Antítesis", "Dialéctica"],
            metafisicos: ["Sustancia", "Esencia", "Existencia", "Causalidad", "Contingencia"],
            epistemologicos: ["Justificación", "Verdad", "Certeza", "Doxa vs Episteme", "A priori/A posteriori"],
            eticos: ["Autonomía", "Beneficencia", "No-maleficencia", "Justicia", "Dignidad"]
        };
    }
    
    detectarProblemaFilosofico(mensaje) {
        const texto = mensaje.toLowerCase().trim();
        let puntaje = 0;
        let tipoProblema = 'general';
        let subtipo = null;
        let palabrasClaveDetectadas = [];
        
        // Análisis exhaustivo de contenido filosófico
        const indicadoresFilosoficos = [
            { patron: /\b(filosof[ií]a|filos[oó]fico)\b/i, peso: 0.4 },
            { patron: /\b(ética|moral|deber|obligaci[oó]n)\b/i, peso: 0.3 },
            { patron: /\b(existencia|ser|realidad|verdad)\b/i, peso: 0.3 },
            { patron: /\b(conocimiento|saber|creencia|justificaci[oó]n)\b/i, peso: 0.3 },
            { patron: /\b(libertad|libre albedr[ií]o|determinismo)\b/i, peso: 0.5 },
            { patron: /\b(tranv[ií]a|sacrificar|salvar|elegir entre)\b/i, peso: 0.6 },
            { patron: /\b(sentido|prop[oó]sito|significado.*vida)\b/i, peso: 0.4 },
            { patron: /\b(mente|conciencia|alma|esp[íi]ritu)\b/i, peso: 0.3 },
            { patron: /\b(dilema|paradoja|problema.*(moral|ético))\b/i, peso: 0.7 },
            { patron: /\b(justicia|igualdad|derechos|equidad)\b/i, peso: 0.3 },
            { patron: /\b(placer|felicidad|sufrimiento|dolor)\b/i, peso: 0.3 },
            { patron: /\b(identidad|yo|personalidad|cambio)\b/i, peso: 0.4 },
            { patron: /\b(dios|religi[oó]n|fe|creencia.*divina)\b/i, peso: 0.3 },
            { patron: /\b(raz[oó]n|l[oó]gica|argumento|premisa)\b/i, peso: 0.2 },
            { patron: /\b(kant|utilitarismo|arist[oó]teles|nietzsche)\b/i, peso: 0.8 }
        ];
        
        // Detectar indicadores
        indicadoresFilosoficos.forEach(({ patron, peso }) => {
            if (patron.test(texto)) {
                puntaje += peso;
                const match = texto.match(patron);
                if (match) palabrasClaveDetectadas.push(match[0]);
            }
        });
        
        // Detectar problemas específicos
        if (/\b(tranv[ií]a|desviar.*tranv[ií]a|sacrificar.*uno.*salvar.*muchos)\b/i.test(texto)) {
            tipoProblema = 'tranvia';
            puntaje = Math.max(puntaje, 0.85);
        } else if (/\b(violinista|conectado.*violinista|obligado.*salvar)\b/i.test(texto)) {
            tipoProblema = 'violinista';
            puntaje = Math.max(puntaje, 0.8);
        } else if (/\b(libre albedr[ií]o|determinismo|tenemos.*libertad)\b/i.test(texto)) {
            tipoProblema = 'libreAlbedrio';
            puntaje = Math.max(puntaje, 0.75);
        } else if (/\b(barco.*teseo|identidad.*cambio|partes.*reemplazadas)\b/i.test(texto)) {
            tipoProblema = 'barcoTeseo';
            puntaje = Math.max(puntaje, 0.7);
        } else if (/\b(m[aá]quina.*experiencias|felicidad.*simulada|realidad.*ilusión)\b/i.test(texto)) {
            tipoProblema = 'maquinaExperiencias';
            puntaje = Math.max(puntaje, 0.7);
        } else if (puntaje > 0.3) {
            tipoProblema = 'general';
        }
        
        // Determinar subtipo por dominio filosófico
        if (/\b(ética|moral|deber|bueno|malo)\b/i.test(texto)) {
            subtipo = 'etica';
        } else if (/\b(conocimiento|verdad|creencia|justificaci[oó]n)\b/i.test(texto)) {
            subtipo = 'epistemologia';
        } else if (/\b(realidad|existencia|ser|mente|cuerpo)\b/i.test(texto)) {
            subtipo = 'metafisica';
        } else if (/\b(pol[ií]tica|sociedad|justicia|derechos)\b/i.test(texto)) {
            subtipo = 'politica';
        }
        
        // Ajustar puntaje por longitud y complejidad
        const palabras = texto.split(/\s+/).length;
        if (palabras > 15 && palabras < 100) {
            puntaje += 0.1; // Longitud óptima para preguntas filosóficas
        }
        
        if (texto.includes('?') && texto.split('?').length === 1) {
            puntaje += 0.1; // Pregunta bien formulada
        }
        
        return {
            esFilosofico: puntaje > 0.4,
            puntaje: Math.min(0.95, puntaje),
            tipoProblema: tipoProblema,
            subtipo: subtipo,
            palabrasClave: [...new Set(palabrasClaveDetectadas)],
            complejidad: this.calcularComplejidad(texto),
            requiereAnalisisProfundo: puntaje > 0.6
        };
    }
    
    calcularComplejidad(texto) {
        let complejidad = 0;
        const palabras = texto.toLowerCase().split(/\s+/);
        
        // Palabras complejas filosóficas
        const palabrasComplejas = [
            'ontología', 'epistemología', 'deontología', 'utilitarismo',
            'existencialismo', 'fenomenología', 'hermenéutica', 'dialéctica',
            'metafísica', 'axiológico', 'teleológico', 'categórico',
            'imperativo', 'eudaimonia', 'phronesis', 'sofisma', 'paradoja'
        ];
        
        palabrasComplejas.forEach(palabra => {
            if (texto.toLowerCase().includes(palabra)) {
                complejidad += 2;
            }
        });
        
        // Factores estructurales
        if (texto.length > 200) complejidad += 1;
        if (texto.includes('?')) complejidad += 1;
        if (/si.*entonces|porque.*porque|causa.*efecto/i.test(texto)) complejidad += 1;
        
        return Math.min(5, complejidad);
    }
    
    analizarProblemaFilosofico(mensaje, contexto) {
        const deteccion = this.detectarProblemaFilosofico(mensaje);
        
        if (!deteccion.esFilosofico) {
            return {
                esFilosofico: false,
                recomendacion: 'procesar_normalmente',
                razon: 'No se detectó contenido filosófico significativo'
            };
        }
        
        const problemaEspecifico = this.identificarProblemaEspecifico(mensaje);
        const enfoquesAplicables = this.seleccionarEnfoques(deteccion);
        const marcoAnalitico = this.construirMarcoAnalitico(deteccion, problemaEspecifico);
        
        // Registrar análisis
        this.registrarAnalisis(contexto?.userId || 'anon', {
            mensaje,
            deteccion,
            timestamp: new Date().toISOString()
        });
        
        return {
            esFilosofico: true,
            tipoProblema: deteccion.tipoProblema,
            subtipo: deteccion.subtipo,
            confianza: deteccion.puntaje,
            problemaIdentificado: problemaEspecifico,
            enfoquesRelevantes: enfoquesAplicables,
            marcoAnalitico: marcoAnalitico,
            preguntasGuias: this.generarPreguntasGuias(deteccion, problemaEspecifico),
            recursosSugeridos: this.sugerirRecursos(deteccion),
            estiloRespuesta: this.determinarEstiloRespuesta(deteccion)
        };
    }
    
    identificarProblemaEspecifico(mensaje) {
        const texto = mensaje.toLowerCase();
        
        // Mapeo de problemas a patrones
        const problemas = {
            elTranvia: {
                nombre: "El problema del tranvía",
                descripcion: "Dilema ético clásico sobre sacrificar una vida para salvar varias",
                detectadoPor: [
                    /tranv[ií]a.*desviar|desviar.*tranv[ií]a/i,
                    /sacrificar.*uno.*salvar.*muchos/i,
                    /cambiar.*v[ií]a.*personas/i
                ]
            },
            elViolinista: {
                nombre: "El violinista",
                descripcion: "Problema sobre derechos corporales y obligaciones morales",
                detectadoPor: [
                    /violinista.*conectado|conectado.*violinista/i,
                    /obligado.*salvar.*vida/i,
                    /cuerpo.*uso.*otro/i
                ]
            }
        };
        
        for (const [key, problema] of Object.entries(problemas)) {
            for (const patron of problema.detectadoPor) {
                if (patron.test(texto)) {
                    return {
                        ...problema,
                        clave: key,
                        versiones: this.problemasClasicos[key]?.versiones || []
                    };
                }
            }
        }
        
        // Problema general
        return {
            nombre: "Problema filosófico general",
            descripcion: "Cuestionamiento sobre aspectos fundamentales de la existencia humana",
            tipo: "general",
            areasImplicadas: this.detectarAreasFilosoficas(texto)
        };
    }
    
    detectarAreasFilosoficas(texto) {
        const areas = [];
        
        const mapeoAreas = {
            etica: [/ética|moral|deber|bueno|malo|correcto|incorrecto/i],
            epistemologia: [/conocimiento|verdad|creencia|saber|justificación/i],
            metafisica: [/realidad|existencia|ser|mundo|universo|naturaleza/i],
            estetica: [/belleza|arte|experiencia.*estética|gusto/i],
            politica: [/sociedad|gobierno|justicia|derechos|libertad.*política/i]
        };
        
        for (const [area, patrones] of Object.entries(mapeoAreas)) {
            if (patrones.some(patron => patron.test(texto))) {
                areas.push(area);
            }
        }
        
        return areas.length > 0 ? areas : ['filosofia_general'];
    }
    
    seleccionarEnfoques(deteccion) {
        const enfoques = [];
        
        if (deteccion.subtipo === 'etica' || deteccion.tipoProblema === 'tranvia') {
            enfoques.push(
                {
                    escuela: "Utilitarismo",
                    enfoque: "Evaluar consecuencias",
                    preguntaGuia: "¿Qué opción produce el mayor bien para el mayor número?",
                    representantes: ["Jeremy Bentham", "John Stuart Mill", "Peter Singer"]
                },
                {
                    escuela: "Deontología Kantiana",
                    enfoque: "Considerar principios universales",
                    preguntaGuia: "¿Puedes querer que tu acción sea una ley universal?",
                    principios: ["Imperativo categórico", "Autonomía", "Dignidad humana"]
                },
                {
                    escuela: "Ética de la virtud",
                    enfoque: "Desarrollar carácter moral",
                    preguntaGuia: "¿Qué haría una persona virtuosa en esta situación?",
                    virtudes: ["Prudencia", "Justicia", "Fortaleza", "Templanza"]
                }
            );
        }
        
        if (deteccion.tipoProblema === 'libreAlbedrio') {
            enfoques.push(
                {
                    escuela: "Determinismo",
                    perspectiva: "Nuestras acciones están causalmente determinadas",
                    argumentos: ["Causalidad física", "Genética", "Influencia ambiental"]
                },
                {
                    escuela: "Libertarismo",
                    perspectiva: "Tenemos libre albedrío genuino",
                    argumentos: ["Conciencia", "Agencia", "Responsabilidad moral"]
                },
                {
                    escuela: "Compatibilismo",
                    perspectiva: "Libertad compatible con determinismo",
                    definicion: "Libertad como ausencia de coacción externa"
                }
            );
        }
        
        return enfoques.slice(0, 3); // Máximo 3 enfoques
    }
    
    construirMarcoAnalitico(deteccion, problema) {
        return {
            nivelAnalisis: deteccion.complejidad > 3 ? 'profundo' : 'intermedio',
            dimensiones: [
                "Ética: valores y deberes implicados",
                "Lógica: consistencia de argumentos",
                "Metafísica: presuposiciones sobre realidad",
                "Antropológica: concepción de ser humano"
            ],
            metodologia: deteccion.requiereAnalisisProfundo 
                ? "Análisis multi-perspectiva con evaluación crítica"
                : "Enfoque introductorio con clarificación conceptual",
            objetivos: [
                "Clarificar términos y conceptos",
                "Identificar presuposiciones implícitas",
                "Explorar consecuencias lógicas",
                "Considerar alternativas teóricas"
            ]
        };
    }
    
    generarPreguntasGuias(deteccion, problema) {
        const preguntas = [];
        
        // Preguntas generales filosóficas
        preguntas.push(
            "¿Qué valores están en conflicto en esta situación?",
            "¿Qué presuposiciones estás haciendo?",
            "¿Cómo se vería esto desde otra perspectiva cultural o histórica?",
            "¿Cuáles serían las consecuencias a largo plazo de cada opción?"
        );
        
        // Preguntas específicas por tipo de problema
        if (problema.clave === 'elTranvia') {
            preguntas.push(
                "¿Hay diferencia moral entre acción y omisión?",
                "¿Importa quiénes son las personas involucradas?",
                "¿Cambiaría tu decisión si tuvieras una relación personal con alguna de las personas?"
            );
        }
        
        if (deteccion.subtipo === 'epistemologia') {
            preguntas.push(
                "¿Cómo sabes que lo que crees es verdadero?",
                "¿Qué cuenta como evidencia en este caso?",
                "¿Podrías estar equivocado? ¿Cómo lo sabrías?"
            );
        }
        
        return preguntas.slice(0, 4); // Máximo 4 preguntas
    }
    
    sugerirRecursos(deteccion) {
        const recursos = [];
        
        if (deteccion.tipoProblema === 'tranvia') {
            recursos.push(
                "Artículo: 'The Trolley Problem' de Judith Jarvis Thomson",
                "Libro: 'Ethics: Inventing Right and Wrong' de J.L. Mackie",
                "Video: 'The Trolley Problem Explained' de Wireless Philosophy"
            );
        }
        
        if (deteccion.subtipo === 'etica') {
            recursos.push(
                "Introducción: 'The Elements of Moral Philosophy' de James Rachels",
                "Clásico: 'Groundwork for the Metaphysics of Morals' de Kant",
                "Contemporáneo: 'Practical Ethics' de Peter Singer"
            );
        }
        
        return recursos;
    }
    
    determinarEstiloRespuesta(deteccion) {
        if (deteccion.puntaje > 0.7) {
            return {
                tono: "académico_reflexivo",
                profundidad: "analisis_complejo",
                estructura: "marco_teorico_practico",
                longitud: "extensa"
            };
        } else if (deteccion.puntaje > 0.5) {
            return {
                tono: "pedagogico_accesible",
                profundidad: "conceptos_clave",
                estructura: "pregunta_respuesta_dialogica",
                longitud: "moderada"
            };
        } else {
            return {
                tono: "introductorio_amigable",
                profundidad: "ideas_basicas",
                estructura: "explicacion_sencilla",
                longitud: "breve"
            };
        }
    }
    
    registrarAnalisis(userId, datos) {
        if (!this.historicoAnalisis.has(userId)) {
            this.historicoAnalisis.set(userId, []);
        }
        
        const historial = this.historicoAnalisis.get(userId);
        historial.push(datos);
        
        // Mantener solo últimos 10 análisis
        if (historial.length > 10) {
            historial.shift();
        }
    }
    
    obtenerEvolucionFilosofica(userId) {
        const historial = this.historicoAnalisis.get(userId);
        if (!historial || historial.length < 2) return null;
        
        const temas = historial.map(entry => entry.deteccion.tipoProblema);
        const temasUnicos = [...new Set(temas)];
        
        return {
            totalAnalisis: historial.length,
            temasExplorados: temasUnicos,
            complejidadPromedio: historial.reduce((sum, entry) => 
                sum + entry.deteccion.complejidad, 0) / historial.length,
            tendencia: this.calcularTendencia(historial)
        };
    }
    
    calcularTendencia(historial) {
        if (historial.length < 3) return "insuficiente_datos";
        
        const ultimos = historial.slice(-3);
        const complejidades = ultimos.map(h => h.deteccion.complejidad);
        
        const incremento = complejidades[2] - complejidades[0];
        
        if (incremento > 1) return "aumentando_complejidad";
        if (incremento < -1) return "disminuyendo_complejidad";
        return "estable";
    }
    
    // Método adicional para generar respuestas estructuradas
    generarEstructuraRespuesta(analisis) {
        return {
            introduccion: `Analizando tu pregunta desde la perspectiva filosófica de ${analisis.enfoquesRelevantes[0]?.escuela || 'múltiples enfoques'}:`,
            marcoTeorico: analisis.enfoquesRelevantes.map(e => 
                `• ${e.escuela}: ${e.enfoque}`
            ).join('\n'),
            analisis: "Considerando las dimensiones éticas, lógicas y metafísicas implicadas...",
            preguntasReflexivas: analisis.preguntasGuias.slice(0, 2),
            conclusion: "No hay respuestas definitivas, pero el proceso de reflexión en sí es valioso.",
            recursos: analisis.recursosSugeridos.length > 0 
                ? `Para profundizar: ${analisis.recursosSugeridos[0]}`
                : ""
        };
    }
}
