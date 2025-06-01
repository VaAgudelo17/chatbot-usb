const natural = require('natural');
const stringSimilarity = require('string-similarity');
const fs = require('fs-extra');
const path = require('path');
const ContextManager = require('./contextManager');
const config = require('../../config.json');

class NLPProcessor {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.corpus = this.loadCorpus();
    this.contextManager = new ContextManager();
    this.unknownQueriesFile = path.join(__dirname, '../../data/unknown_queries.log');

    // Validación de configuración
    if (!config.similarityThreshold || !config.defaultResponse) {
      throw new Error('Configuración incompleta en config.json');
    }
  }

  loadCorpus() {

    try {
      const corpusPath = path.join(__dirname, '../../data/corpus/corpus.json');
      
      if (!fs.existsSync(path.dirname(corpusPath))) {
        fs.mkdirSync(path.dirname(corpusPath), { recursive: true });
      }
      
      if (!fs.existsSync(corpusPath)) {
        console.error('No se encontró corpus.json, creando uno vacío');
        fs.writeFileSync(corpusPath, '[]', 'utf-8');
        return [];
      }

      const content = fs.readFileSync(corpusPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error crítico cargando corpus:', error);
      return [];
    }
  }

  preprocess(text) {
    if (typeof text !== 'string') return '';
    return text.toLowerCase().trim();
  }

  async findBestMatch(userId, query) {
    if (!query || typeof query !== 'string') {
      return {
        text: config.defaultResponse,
        image: null
      };
    }

    const processedQuery = this.preprocess(query);
    const context = this.contextManager.getContext(userId);
    let bestMatch = { 
      score: config.similarityThreshold, 
      response: null 
    };

    // Búsqueda en el corpus (sin filtro por contexto en esta versión)
    for (const item of this.corpus) {
      if (!item.preguntas || !item.respuestas) continue;
      
      for (const question of item.preguntas) {
        const score = stringSimilarity.compareTwoStrings(
          processedQuery,
          this.preprocess(question)
        );
        
        if (score > bestMatch.score) {
          bestMatch = {
            score,
            response: this.getRandomResponse(item.respuestas),
            intent: item.intencion,
            image: item.imagen || null
          };
        }
      }
    }

    if (bestMatch.response) {
      this.contextManager.updateContext(userId, { 
        lastIntent: bestMatch.intent 
      });
      
      // Si es un saludo, añadir menú de opciones
      if (bestMatch.intent === 'saludo') {
        const menu = "\n\nElige una opción:\n1. Cursos disponibles\n2. Horarios\n3. Admisión\n4. Costos\n5. Contacto";
        bestMatch.response = bestMatch.response + menu;
      }
      
      return {
        text: bestMatch.response,
        image: bestMatch.image
      };
    }

    await this.logUnknownQuery(userId, query);
    return {
      text: config.defaultResponse,
      image: null
    };
  }

  getRandomResponse(responses) {
    try {
      return responses[Math.floor(Math.random() * responses.length)];
    } catch {
      return 'Gracias por tu mensaje.';
    }
  }

  async logUnknownQuery(userId, query) {
    try {
      const timestamp = new Date().toISOString();
      await fs.appendFile(
        this.unknownQueriesFile, 
        `${timestamp}|${userId}|${query}\n`
      );
    } catch (error) {
      console.error('❌ Error registrando consulta desconocida:', error);
    }
  }
async generateDynamicResponse(userId, intent, query) {
  const context = this.contextManager.getContext(userId);
  
  // Manejo de navegación entre menús
  if (query === '5' || query.includes('volver')) {
    return this.findBestMatch(userId, 'menu');
  }

  // Manejo de sub-opciones
  if (context && context.lastIntent) {
    const mainIntent = context.lastIntent.split('_')[0];
    if (['1','2','3','4'].includes(query) && ['ia','datos','web'].includes(mainIntent)) {
      return this.findBestMatch(userId, `${mainIntent}_${query}`);
    }
  }

  return {
    text: bestMatch.response || config.defaultResponse,
    image: bestMatch.image,
    intent: bestMatch.intent
  };
}


}

module.exports = new NLPProcessor();
