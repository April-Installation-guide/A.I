const Database = require('./bot.db');
const MemoryManager = require('./MemoryManajer.js');

class LearningModule {
    constructor() {
        this.db = new Database();
        this.memory = new MemoryManager();
        this.learnedData = new Map();
        this.triggers = new Map();
    }

    async initialize() {
        await this.db.connect();
        await this.loadLearnedData();
        console.log('Módulo de aprendizaje inicializado');
    }

    async learn(trigger, response, context = 'general') {
        try {
            // Guardar en base de datos
            await this.db.query(
                'INSERT INTO learned_responses (trigger, response, context, usage_count) VALUES (?, ?, ?, 1)',
                [trigger.toLowerCase(), response, context]
            );

            // Actualizar memoria en caliente
            this.learnedData.set(trigger.toLowerCase(), {
                response,
                context,
                usageCount: 1,
                lastUsed: new Date()
            });

            // Indexar triggers
            this.indexTrigger(trigger.toLowerCase());
            
            return true;
        } catch (error) {
            console.error('Error learning:', error);
            return false;
        }
    }

    async recall(trigger, context = 'general') {
        const normalizedTrigger = trigger.toLowerCase();
        
        // Primero buscar en memoria
        if (this.learnedData.has(normalizedTrigger)) {
            const data = this.learnedData.get(normalizedTrigger);
            data.usageCount++;
            data.lastUsed = new Date();
            return data.response;
        }

        // Buscar en base de datos
        try {
            const result = await this.db.query(
                'SELECT * FROM learned_responses WHERE trigger = ? AND context = ? ORDER BY usage_count DESC',
                [normalizedTrigger, context]
            );

            if (result.length > 0) {
                const data = result[0];
                // Actualizar en memoria
                this.learnedData.set(normalizedTrigger, {
                    response: data.response,
                    context: data.context,
                    usageCount: data.usage_count + 1,
                    lastUsed: new Date()
                });

                // Incrementar contador en DB
                await this.db.query(
                    'UPDATE learned_responses SET usage_count = usage_count + 1 WHERE id = ?',
                    [data.id]
                );

                return data.response;
            }
        } catch (error) {
            console.error('Error recalling:', error);
        }

        return null;
    }

    async searchSimilar(trigger, threshold = 0.6) {
        const normalizedTrigger = trigger.toLowerCase();
        const results = [];

        // Búsqueda simple por similitud de palabras
        for (const [key, data] of this.learnedData.entries()) {
            const similarity = this.calculateSimilarity(normalizedTrigger, key);
            if (similarity >= threshold) {
                results.push({
                    trigger: key,
                    response: data.response,
                    similarity: similarity,
                    usageCount: data.usageCount
                });
            }
        }

        // Ordenar por similitud y uso
        return results.sort((a, b) => {
            if (b.similarity !== a.similarity) {
                return b.similarity - a.similarity;
            }
            return b.usageCount - a.usageCount;
        });
    }

    calculateSimilarity(str1, str2) {
        const words1 = str1.split(' ');
        const words2 = str2.split(' ');
        
        const intersection = words1.filter(word => words2.includes(word));
        const union = [...new Set([...words1, ...words2])];
        
        return intersection.length / union.length;
    }

    indexTrigger(trigger) {
        const words = trigger.toLowerCase().split(' ');
        words.forEach(word => {
            if (!this.triggers.has(word)) {
                this.triggers.set(word, new Set());
            }
            this.triggers.get(word).add(trigger);
        });
    }

    async loadLearnedData() {
        try {
            const results = await this.db.query(
                'SELECT * FROM learned_responses ORDER BY usage_count DESC LIMIT 1000'
            );

            results.forEach(row => {
                this.learnedData.set(row.trigger, {
                    response: row.response,
                    context: row.context,
                    usageCount: row.usage_count,
                    lastUsed: new Date(row.last_used || Date.now())
                });
                
                this.indexTrigger(row.trigger);
            });

            console.log(`Cargados ${results.length} conocimientos en memoria`);
        } catch (error) {
            console.error('Error loading learned data:', error);
        }
    }

    async forget(trigger) {
        try {
            await this.db.query(
                'DELETE FROM learned_responses WHERE trigger = ?',
                [trigger.toLowerCase()]
            );
            
            this.learnedData.delete(trigger.toLowerCase());
            return true;
        } catch (error) {
            console.error('Error forgetting:', error);
            return false;
        }
    }

    getStats() {
        return {
            totalLearned: this.learnedData.size,
            triggersIndexed: this.triggers.size,
            memoryUsage: process.memoryUsage().heapUsed
        };
    }
}

module.exports = LearningModule;
