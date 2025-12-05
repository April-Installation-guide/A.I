// ========== SISTEMA DE RAZONAMIENTO Y LÓGICA ==========
export class ReasoningEngine {
    constructor() {
        // Base de conocimiento estructurada
        this.knowledgeBase = new Map();
        this.rules = [];
        this.inferences = [];
        this.logicalFrameworks = this.cargarMarcosLogicos();
        this.casosResueltos = [];
        this.decisionHistory = [];
        
        // Inicializar con conocimiento básico
        this.inicializarConocimientoBasico();
        
        console.log('🤔 Motor de razonamiento activado');
    }
    
    // ========== 1. INICIALIZACIÓN ==========
    inicializarConocimientoBasico() {
        // Hechos básicos del mundo
        this.agregarHecho('el cielo es azul durante el día', true, 0.95);
        this.agregarHecho('el agua hierve a 100 grados celsius', true, 0.99);
        this.agregarHecho('los humanos necesitan oxígeno', true, 1.0);
        this.agregarHecho('la tierra gira alrededor del sol', true, 1.0);
        
        // Reglas lógicas básicas
        this.agregarRegla(
            (ctx) => ctx.includes('llueve') && ctx.includes('afuera'),
            (ctx) => 'El suelo estará mojado'
        );
        
        this.agregarRegla(
            (ctx) => ctx.includes('noche') && ctx.includes('cielo despejado'),
            (ctx) => 'Podrás ver las estrellas'
        );
        
        this.agregarRegla(
            (ctx) => ctx.includes('estudia') && ctx.includes('regularmente'),
            (ctx) => 'Tendrá buenas calificaciones'
        );
        
        // Marcos lógicos predefinidos
        this.cargarMarcosLogicos();
    }
    
    cargarMarcosLogicos() {
        return {
            deductivo: {
                descripcion: 'Razonamiento de general a particular',
                pasos: ['Premisa general', 'Caso particular', 'Conclusión específica']
            },
            inductivo: {
                descripcion: 'Razonamiento de particular a general',
                pasos: ['Observaciones', 'Patrones', 'Generalización']
            },
            abductivo: {
                descripcion: 'Razonamiento a la mejor explicación',
                pasos: ['Observación', 'Hipótesis posibles', 'Mejor explicación']
            },
            dialectico: {
                descripcion: 'Tesis, antítesis, síntesis',
                pasos: ['Afirmación', 'Refutación', 'Síntesis']
            }
        };
    }
    
    // ========== 2. GESTIÓN DEL CONOCIMIENTO ==========
    agregarHecho(hecho, valor, certeza = 0.9) {
        this.knowledgeBase.set(hecho.toLowerCase(), {
            valor: valor,
            certeza: certeza,
            fuente: 'usuario',
            fecha: new Date().toISOString()
        });
    }
    
    obtenerHecho(hecho) {
        return this.knowledgeBase.get(hecho.toLowerCase());
    }
    
    // ========== 3. SISTEMA DE REGLAS ==========
    agregarRegla(condicion, accion, nombre = '') {
        this.rules.push({
            id: `regla_${Date.now()}_${this.rules.length}`,
            nombre: nombre || `Regla ${this.rules.length + 1}`,
            condicion: condicion,
            accion: accion,
            activaciones: 0,
            efectividad: 0
        });
        console.log(`📝 Nueva regla añadida: ${nombre || 'Sin nombre'}`);
    }
    
    evaluarReglas(contexto) {
        const contextoStr = typeof contexto === 'string' ? contexto : JSON.stringify(contexto);
        const reglasActivadas = [];
        
        this.rules.forEach(regla => {
            try {
                const condicionCumplida = regla.condicion(contextoStr);
                if (condicionCumplida) {
                    regla.activaciones++;
                    const resultado = regla.accion(contextoStr);
                    
                    reglasActivadas.push({
                        regla: regla.nombre,
                        resultado: resultado,
                        confianza: this.calcularConfianzaRegla(regla),
                        explicacion: this.generarExplicacionRegla(regla, contextoStr)
                    });
                }
            } catch (error) {
                console.error(`❌ Error en regla ${regla.nombre}:`, error);
            }
        });
        
        return reglasActivadas;
    }
    
    // ========== 4. INFERENCIA LÓGICA ==========
    inferir(hechos, objetivo = null) {
        console.log(`🔍 Inferencia solicitada para: "${hechos.substring(0, 50)}..."`);
        
        const inferencias = [];
        const hechosLower = hechos.toLowerCase();
        
        // Inferencia directa desde base de conocimiento
        this.knowledgeBase.forEach((valor, hecho) => {
            if (this.coincidePatron(hecho, hechosLower)) {
                inferencias.push({
                    tipo: 'conocimiento',
                    fuente: 'base_de_conocimiento',
                    inferencia: valor.valor,
                    certeza: valor.certeza,
                    hechoRelacionado: hecho
                });
            }
        });
        
        // Inferencia por reglas
        const reglasActivadas = this.evaluarReglas(hechosLower);
        reglasActivadas.forEach(regla => {
            inferencias.push({
                tipo: 'regla',
                fuente: regla.regla,
                inferencia: regla.resultado,
                certeza: regla.confianza,
                explicacion: regla.explicacion
            });
        });
        
        // Inferencia por analogía
        if (this.casosResueltos.length > 0) {
            const analogias = this.buscarAnalogias(hechosLower);
            analogias.forEach(analogia => {
                inferencias.push({
                    tipo: 'analogia',
                    fuente: 'caso_similar',
                    inferencia: analogia.solucion,
                    certeza: analogia.similitud * 0.8, // Reducir certeza por analogía
                    casoSimilar: analogia.caso
                });
            });
        }
        
        // Ordenar por certeza
        inferencias.sort((a, b) => b.certeza - a.certeza);
        
        return {
            hechos: hechos,
            objetivo: objetivo,
            totalInferencias: inferencias.length,
            inferencias: inferencias,
            mejorInferencia: inferencias[0] || null,
            marcoRecomendado: this.recomendarMarcoLogico(hechosLower)
        };
    }
    
    // ========== 5. RAZONAMIENTO POR CASOS ==========
    razonarPorCasos(problema, casosPredefinidos = null) {
        const casos = casosPredefinidos || this.generarCasos(problema);
        const soluciones = [];
        
        casos.forEach(caso => {
            const aplicabilidad = this.calcularAplicabilidad(problema, caso);
            if (aplicabilidad > 0.3) { // Umbral mínimo
                soluciones.push({
                    caso: caso.nombre,
                    descripcion: caso.descripcion,
                    aplicabilidad: aplicabilidad,
                    solucion: caso.solucion,
                    razonamiento: this.generarRazonamientoCaso(problema, caso),
                    certeza: caso.certeza || 0.7
                });
            }
        });
        
        // Ordenar por aplicabilidad
        soluciones.sort((a, b) => b.aplicabilidad - a.aplicabilidad);
        
        // Guardar caso para aprendizaje futuro
        if (soluciones.length > 0) {
            this.guardarCasoResuelto(problema, soluciones[0]);
        }
        
        return {
            problema: problema,
            casosConsiderados: casos.length,
            solucionesEncontradas: soluciones.length,
            soluciones: soluciones,
            recomendacion: soluciones[0] || null
        };
    }
    
    // ========== 6. SISTEMA DE DECISIONES ==========
    tomarDecision(opciones, criterios, contexto = '') {
        console.log(`⚖️ Análisis de decisión: ${opciones.length} opciones, ${criterios.length} criterios`);
        
        const decisiones = [];
        
        opciones.forEach((opcion, index) => {
            const evaluacion = this.evaluarOpcion(opcion, criterios, contexto);
            decisiones.push({
                id: `opcion_${index + 1}`,
                nombre: opcion.nombre || `Opción ${index + 1}`,
                descripcion: opcion.descripcion || '',
                puntuacionTotal: evaluacion.total,
                puntuaciones: evaluacion.detalles,
                puntosFuertes: evaluacion.fortalezas,
                puntosDebiles: evaluacion.debilidades,
                recomendacion: this.clasificarRecomendacion(evaluacion.total),
                justificacion: this.generarJustificacionDecision(opcion, evaluacion)
            });
        });
        
        // Ordenar por puntuación
        decisiones.sort((a, b) => b.puntuacionTotal - a.puntuacionTotal);
        
        // Guardar historial
        this.decisionHistory.push({
            fecha: new Date().toISOString(),
            contexto: contexto,
            opciones: opciones.length,
            decisionTomada: decisiones[0],
            todasOpciones: decisiones
        });
        
        return {
            contexto: contexto,
            totalOpciones: decisiones.length,
            decisiones: decisiones,
            mejorOpcion: decisiones[0],
            analisisComparativo: this.generarAnalisisComparativo(decisiones),
            fechaAnalisis: new Date().toISOString()
        };
    }
    
    // ========== 7. RESOLUCIÓN DE PROBLEMAS ==========
    resolverProblema(descripcion, restricciones = []) {
        console.log(`🔧 Resolviendo problema: "${descripcion.substring(0, 60)}..."`);
        
        const proceso = {
            problema: descripcion,
            restricciones: restricciones,
            pasos: [],
            estado: 'en_proceso',
            inicio: new Date().toISOString()
        };
        
        // Paso 1: Análisis del problema
        const analisis = this.analizarProblema(descripcion);
        proceso.pasos.push({
            paso: 1,
            nombre: 'Análisis del problema',
            resultado: analisis,
            duracion: 'inmediato'
        });
        
        // Paso 2: Descomposición
        const componentes = this.descomponerProblema(descripcion);
        proceso.pasos.push({
            paso: 2,
            nombre: 'Descomposición',
            resultado: componentes,
            duracion: 'inmediato'
        });
        
        // Paso 3: Generar soluciones
        const soluciones = this.generarSoluciones(componentes, restricciones);
        proceso.pasos.push({
            paso: 3,
            nombre: 'Generación de soluciones',
            resultado: { total: soluciones.length, muestras: soluciones.slice(0, 3) },
            duracion: 'inmediato'
        });
        
        // Paso 4: Evaluar soluciones
        const evaluaciones = this.evaluarSoluciones(soluciones);
        proceso.pasos.push({
            paso: 4,
            nombre: 'Evaluación de soluciones',
            resultado: evaluaciones.slice(0, 3),
            duracion: 'inmediato'
        });
        
        // Paso 5: Seleccionar mejor solución
        const mejorSolucion = this.seleccionarMejorSolucion(evaluaciones);
        proceso.pasos.push({
            paso: 5,
            nombre: 'Selección de solución',
            resultado: mejorSolucion,
            duracion: 'inmediato'
        });
        
        // Paso 6: Plan de implementación
        const plan = this.crearPlanImplementacion(mejorSolucion);
        proceso.pasos.push({
            paso: 6,
            nombre: 'Plan de implementación',
            resultado: plan,
            duracion: 'inmediato'
        });
        
        proceso.estado = 'completado';
        proceso.fin = new Date().toISOString();
        proceso.duracionTotal = 'varios pasos lógicos';
        
        return {
            resumen: `Problema resuelto en ${proceso.pasos.length} pasos`,
            proceso: proceso,
            solucionRecomendada: mejorSolucion,
            planImplementacion: plan,
            alternativas: evaluaciones.slice(1, 4)
        };
    }
    
    // ========== 8. PENSAMIENTO CRÍTICO ==========
    analizarArgumento(argumento) {
        const analisis = {
            argumentoOriginal: argumento,
            premisas: this.extraerPremisas(argumento),
            conclusion: this.extraerConclusion(argumento),
            estructura: this.analizarEstructura(argumento),
            validez: this.evaluarValidez(argumento),
            fortalezas: this.identificarFortalezas(argumento),
            debilidades: this.identificarDebilidades(argumento),
            suposiciones: this.identificarSuposiciones(argumento),
            falacias: this.detectarFalacias(argumento)
        };
        
        analisis.evaluacion = this.evaluarArgumentoCompleto(analisis);
        analisis.sugerencias = this.generarSugerenciasMejora(analisis);
        
        return analisis;
    }
    
    // ========== 9. APRENDIZAJE POR EXPERIENCIA ==========
    aprenderDeExperiencia(situacion, resultado, feedback = null) {
        const leccion = {
            id: `leccion_${Date.now()}`,
            situacion: situacion,
            accionesTomadas: resultado.acciones || [],
            resultado: resultado.resultado,
            exito: this.calcularExito(resultado, feedback),
            feedback: feedback,
            fecha: new Date().toISOString(),
            aprendizajes: []
        };
        
        // Extraer aprendizajes
        if (leccion.exito > 0.7) {
            leccion.aprendizajes.push('Acción exitosa, mantener patrón');
        } else if (leccion.exito < 0.3) {
            leccion.aprendizajes.push('Acción no exitosa, evitar patrón');
        }
        
        // Agregar al conocimiento
        const key = this.generarClaveAprendizaje(situacion);
        if (!this.knowledgeBase.has(key)) {
            this.knowledgeBase.set(key, []);
        }
        this.knowledgeBase.get(key).push(leccion);
        
        // Actualizar reglas si es necesario
        this.actualizarReglasConLeccion(leccion);
        
        console.log(`📚 Lección aprendida: ${leccion.aprendizajes[0] || 'Experiencia registrada'}`);
        
        return leccion;
    }
    
    // ========== 10. EXPLICACIÓN DE RAZONAMIENTO ==========
    explicarRazonamiento(proceso, nivelDetalle = 'medio') {
        const explicacion = {
            resumen: `Proceso de ${proceso.tipo || 'razonamiento'}`,
            pasos: [],
            suposiciones: proceso.suposiciones || [],
            alternativasConsideradas: proceso.alternativas || [],
            certeza: this.calcularCertezaProceso(proceso),
            marcoUtilizado: proceso.marco || 'general'
        };
        
        // Reconstruir pasos lógicos
        if (proceso.pasos) {
            proceso.pasos.forEach((paso, index) => {
                explicacion.pasos.push({
                    numero: index + 1,
                    accion: paso.nombre || paso.tipo || `Paso ${index + 1}`,
                    entrada: paso.entrada ? paso.entrada.substring(0, 100) + '...' : null,
                    salida: paso.resultado ? JSON.stringify(paso.resultado).substring(0, 150) + '...' : null,
                    razon: this.obtenerRazonPaso(paso),
                    evidencia: this.obtenerEvidenciaPaso(paso)
                });
            });
        }
        
        // Ajustar nivel de detalle
        if (nivelDetalle === 'basico') {
            explicacion.pasos = explicacion.pasos.slice(0, 3);
        } else if (nivelDetalle === 'detallado') {
            explicacion.detallesTecnicos = this.generarDetallesTecnicos(proceso);
        }
        
        return explicacion;
    }
    
    // ========== FUNCIONES AUXILIARES ==========
    coincidePatron(patron, texto) {
        try {
            // Patrón simple con comodines
            const regexStr = patron
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
            const regex = new RegExp(regexStr, 'i');
            return regex.test(texto);
        } catch (error) {
            return texto.includes(patron);
        }
    }
    
    calcularAplicabilidad(problema, caso) {
        let coincidencias = 0;
        const palabrasProblema = problema.toLowerCase().split(/\s+/);
        const palabrasCaso = caso.palabrasClave || [];
        
        palabrasCaso.forEach(palabra => {
            if (palabrasProblema.includes(palabra.toLowerCase())) {
                coincidencias++;
            }
        });
        
        return coincidencias / Math.max(palabrasCaso.length, 1);
    }
    
    evaluarOpcion(opcion, criterios, contexto) {
        let total = 0;
        const detalles = {};
        const fortalezas = [];
        const debilidades = [];
        
        criterios.forEach(criterio => {
            const puntuacion = this.evaluarCriterioIndividual(opcion, criterio, contexto);
            detalles[criterio.nombre] = {
                puntuacion: puntuacion,
                peso: criterio.peso || 1,
                contribucion: puntuacion * (criterio.peso || 1)
            };
            
            total += puntuacion * (criterio.peso || 1);
            
            // Identificar fortalezas y debilidades
            if (puntuacion >= 8) {
                fortalezas.push(`${criterio.nombre}: ${puntuacion}/10`);
            } else if (puntuacion <= 4) {
                debilidades.push(`${criterio.nombre}: ${puntuacion}/10`);
            }
        });
        
        // Normalizar a escala 0-10
        total = (total / criterios.length) * 10;
        
        return {
            total: Math.min(10, Math.max(0, total)),
            detalles: detalles,
            fortalezas: fortalezas,
            debilidades: debilidades
        };
    }
    
    evaluarCriterioIndividual(opcion, criterio, contexto) {
        // Implementación básica - puede extenderse
        if (typeof criterio.evaluador === 'function') {
            return criterio.evaluador(opcion, contexto);
        }
        
        // Evaluación por defecto
        return Math.floor(Math.random() * 6) + 5; // 5-10
    }
    
    clasificarRecomendacion(puntuacion) {
        if (puntuacion >= 8.5) return 'ALTAMENTE RECOMENDADO';
        if (puntuacion >= 7.0) return 'RECOMENDADO';
        if (puntuacion >= 5.0) return 'NEUTRO';
        if (puntuacion >= 3.0) return 'POCO RECOMENDADO';
        return 'NO RECOMENDADO';
    }
    
    generarJustificacionDecision(opcion, evaluacion) {
        const justificaciones = [];
        
        if (evaluacion.fortalezas.length > 0) {
            justificaciones.push(`Fortalezas: ${evaluacion.fortalezas.join(', ')}`);
        }
        
        if (evaluacion.debilidades.length > 0) {
            justificaciones.push(`Atención a: ${evaluacion.debilidades.join(', ')}`);
        }
        
        justificaciones.push(`Puntuación total: ${evaluacion.total.toFixed(1)}/10`);
        
        return justificaciones.join('. ');
    }
    
    // ========== UTILIDADES DE ANÁLISIS ==========
    analizarProblema(descripcion) {
        const palabras = descripcion.toLowerCase().split(/\s+/);
        const palabrasClave = palabras.filter(p => p.length > 4);
        
        return {
            longitud: descripcion.length,
            palabras: palabras.length,
            palabrasClave: palabrasClave.slice(0, 5),
            tipo: this.clasificarTipoProblema(descripcion),
            complejidad: this.estimarComplejidad(descripcion)
        };
    }
    
    clasificarTipoProblema(descripcion) {
        const lower = descripcion.toLowerCase();
        
        if (/(cómo|como hacer|pasos)/i.test(lower)) return 'procedimental';
        if (/(por qué|razón|causa)/i.test(lower)) return 'causal';
        if (/(cuál|cuáles|opción|elegir)/i.test(lower)) return 'decisión';
        if (/(qué|qué es|definir)/i.test(lower)) return 'conceptual';
        if (/(dónde|ubicación|lugar)/i.test(lower)) return 'espacial';
        if (/(cuándo|fecha|hora)/i.test(lower)) return 'temporal';
        
        return 'general';
    }
    
    // ========== ESTADÍSTICAS Y MÉTRICAS ==========
    obtenerEstadisticas() {
        return {
            baseConocimiento: this.knowledgeBase.size,
            reglas: this.rules.length,
            casosResueltos: this.casosResueltos.length,
            decisionesTomadas: this.decisionHistory.length,
            reglasMasActivas: this.rules
                .sort((a, b) => b.activaciones - a.activaciones)
                .slice(0, 5)
                .map(r => ({ nombre: r.nombre, activaciones: r.activaciones })),
            efectividadPromedio: this.calcularEfectividadPromedio(),
            timestamp: new Date().toISOString()
        };
    }
    
    calcularEfectividadPromedio() {
        if (this.rules.length === 0) return 0;
        const total = this.rules.reduce((sum, regla) => sum + regla.efectividad, 0);
        return total / this.rules.length;
    }
    
    // ========== INTERFAZ SIMPLIFICADA PARA SERVER.JS ==========
    procesarConsulta(consulta, contexto = '') {
        console.log(`🤔 Procesando consulta con razonamiento: "${consulta.substring(0, 60)}..."`);
        
        // Paso 1: Inferencia básica
        const inferencias = this.inferir(consulta);
        
        // Paso 2: Análisis del problema
        const analisisProblema = this.analizarProblema(consulta);
        
        // Paso 3: Generar respuesta razonada
        const respuesta = this.generarRespuestaRazonada(consulta, inferencias, contexto);
        
        return {
            consulta: consulta,
            analisis: analisisProblema,
            inferencias: inferencias,
            respuesta: respuesta,
            certeza: inferencias.mejorInferencia?.certeza || 0.5,
            pasosRazonamiento: inferencias.totalInferencias
        };
    }
    
    generarRespuestaRazonada(consulta, inferencias, contexto) {
        if (inferencias.mejorInferencia) {
            const inferencia = inferencias.mejorInferencia;
            return `Basándome en ${inferencia.fuente}, ${inferencia.inferencia}. ${inferencia.explicacion || ''}`;
        }
        
        // Fallback a razonamiento por casos
        const casos = this.razonarPorCasos(consulta);
        if (casos.recomendacion) {
            return `Analizando casos similares: ${casos.recomendacion.razonamiento}`;
        }
        
        return "Estoy analizando tu pregunta con razonamiento lógico. ¿Podrías darme más contexto?";
    }
}

export default ReasoningEngine;
