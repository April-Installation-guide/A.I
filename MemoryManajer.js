const fs = require('fs').promises;
const path = require('path');

class LearningModule {
    constructor() {
        this.dataPath = path.join(__dirname, 'learning_data.json');
        this.learnedData = new Map();
        this.triggers = new Map();
    }

    async initialize() {
        try {
            await this.loadData();
            console.log('Módulo de aprendizaje inicializado');
        } catch (error) {
            // Si no existe el archivo, crea uno vacío
            await this.saveData();
            console.log('Nuevo archivo de aprendizaje creado');
        }
    }

    async loadData() {
        try {
            const data = await fs.readFile(this.dataPath, 'utf8');
            const parsed = JSON.parse(data);
            
            // Convertir array a Map
            parsed.forEach(item => {
                this.learnedData.set(item.trigger, {
                    response: item.response,
                    context: item.context || 'general',
                    usageCount: item.usageCount || 1,
                    lastUsed: new Date(item.lastUsed),
                    createdAt: new Date(item.createdAt)
                });
                
                // Indexar triggers
                this.indexTrigger(item.trigger);
            });
            
            console.log(`Cargados ${parsed.length} conocimientos`);
        } catch (error) {
            // Archivo no existe, empezar vacío
            this.learnedData = new Map();
        }
    }

    async saveData() {
        try {
            // Convertir Map a array
            const dataArray = Array.from(this.learnedData.entries()).map(([trigger, data]) => ({
                trigger,
                response: data.response,
                context: data.context,
                usageCount: data.usageCount,
                lastUsed: data.lastUsed.toISOString(),
                createdAt: data.createdAt.toISOString()
            }));
            
            await fs.writeFile(this.dataPath, JSON.stringify(dataArray, null, 2));
            return true;
        } catch (error) {
            console.error('Error guardando datos:', error);
            return false;
        }
    }

    async learn(trigger, response, context = 'general') {
        const normalizedTrigger = trigger.toLowerCase().trim();
        
        if (this.learnedData.has(normalizedTrigger)) {
            // Actualizar existente
            const existing = this.learnedData.get(normalizedTrigger);
            existing.response = response;
            existing.context = context;
            existing.usageCount++;
            existing.lastUsed = new Date();
        } else {
            // Crear nuevo
            this.learnedData.set(normalizedTrigger, {
                response,
                context,
                usageCount: 1,
                lastUsed: new Date(),
                createdAt: new Date()
            });
            
            // Indexar nuevo trigger
            this.indexTrigger(normalizedTrigger);
        }
        
        // Guardar cambios
        await this.saveData();
        return true;
    }

    async recall(trigger) {
        const normalizedTrigger = trigger.toLowerCase().trim();
        
        // Búsqueda exacta
        if (this.learnedData.has(normalizedTrigger)) {
            const data = this.learnedData.get(normalizedTrigger);
            data.usageCount++;
            data.lastUsed = new Date();
            await this.saveData(); // Guardar contador actualizado
            return data.response;
        }
        
        // Búsqueda parcial (opcional)
        return await this.searchSimilar(trigger, 0.8);
    }

    async searchSimilar(trigger, threshold = 0.6) {
        const normalizedTrigger = trigger.toLowerCase().trim();
        const triggerWords = normalizedTrigger.split(' ').filter(w => w.length > 2);
        
        let bestMatch = null;
        let highestSimilarity = 0;
        
        // Buscar en triggers existentes
        for (const [key, data] of this.learnedData.entries()) {
            const similarity = this.calculateSimilarity(normalizedTrigger, key);
            
            if (similarity > highestSimilarity && similarity >= threshold) {
                highestSimilarity = similarity;
                bestMatch = {
                    trigger: key,
                    response: data.response,
                    similarity: similarity,
                    usageCount: data.usageCount
                };
            }
        }
        
        return bestMatch ? bestMatch.response : null;
    }

    calculateSimilarity(str1, str2) {
        // Método simple de similitud por palabras comunes
        const words1 = new Set(str1.split(' ').filter(w => w.length > 2));
        const words2 = new Set(str2.split(' ').filter(w => w.length > 2));
        
        if (words1.size === 0 || words2.size === 0) return 0;
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }

    indexTrigger(trigger) {
        const words = trigger.toLowerCase().split(' ').filter(w => w.length > 2);
        words.forEach(word => {
            if (!this.triggers.has(word)) {
                this.triggers.set(word, new Set());
            }
            this.triggers.get(word).add(trigger);
        });
    }

    async forget(trigger) {
        const normalizedTrigger = trigger.toLowerCase().trim();
        
        if (this.learnedData.has(normalizedTrigger)) {
            this.learnedData.delete(normalizedTrigger);
            await this.saveData();
            return true;
        }
        
        return false;
    }

    async searchByKeyword(keyword) {
        const normalizedKeyword = keyword.toLowerCase().trim();
        const results = [];
        
        for (const [trigger, data] of this.learnedData.entries()) {
            if (trigger.includes(normalizedKeyword) || 
                data.response.toLowerCase().includes(normalizedKeyword)) {
                results.push({
                    trigger,
                    response: data.response,
                    usageCount: data.usageCount
                });
            }
        }
        
        return results.sort((a, b) => b.usageCount - a.usageCount);
    }

    getStats() {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        let recentLearned = 0;
        let totalUsage = 0;
        
        for (const data of this.learnedData.values()) {
            totalUsage += data.usageCount;
            if (data.createdAt > oneWeekAgo) {
                recentLearned++;
            }
        }
        
        return {
            totalKnowledge: this.learnedData.size,
            totalTriggers: this.triggers.size,
            totalUsage: totalUsage,
            recentLearned: recentLearned,
            memorySize: JSON.stringify(Array.from(this.learnedData.entries())).length
        };
    }

    async backup() {
        const backupPath = path.join(__dirname, `learning_backup_${Date.now()}.json`);
        await fs.copyFile(this.dataPath, backupPath);
        return backupPath;
    }
}

module.exports = LearningModule;
