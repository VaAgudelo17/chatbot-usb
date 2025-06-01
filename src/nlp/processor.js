const stringSimilarity = require('string-similarity');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config.json');
const ContextManager = require('./contextManager');
const corpus = require('../../data/corpus/corpus.json');

class NLPProcessor {
  constructor() {
    this.contextManager = new ContextManager();
    this.unknownQueriesFile = path.join(__dirname, '../../data/unknown_queries.log');
  }

  async findBestMatch(userId, query) {
    console.log('Corpus cargado:', JSON.stringify(corpus, null, 2));
    if (!query || typeof query !== 'string') {
      return this.getDefaultResponse();
    }

    const processedQuery = this.preprocess(query);
    const context = this.contextManager.getContext(userId) || { step: 'main_menu' };

    // Comandos universales
    if (processedQuery === '5' || processedQuery.includes('volver')) {
      this.contextManager.updateContext(userId, { step: 'main_menu' });
      return this.getMainMenuResponse();
    }

    // Lógica por pasos
    switch (context.step) {
      case 'main_menu':
        return this.handleMainMenu(userId, processedQuery);
      case 'course_selected':
        return this.handleCourseOptions(userId, processedQuery, context.course);
      case 'course_detail':
        return this.handleDetailOptions(userId, processedQuery, context);
      default:
        return this.getDefaultResponse();
    }
  }

  async handleMainMenu(userId, query) {
    const normalizedQuery = this.normalizeString(query).replace(/\s+/g, ' ').trim();
    console.log('Consulta normalizada:', normalizedQuery);

    const courses = {
      '1': '1', '1.': '1', '1 ': '1', 'inteligencia artificial': '1', 'ia': '1', 'artificial': '1',
      '2': '2', '2.': '2', '2 ': '2', 'ciencia de datos': '2', 'datos': '2', 'ciencia': '2',
      '3': '3', '3.': '3', '3 ': '3', 'desarrollo web': '3', 'web': '3', 'desarrollo': '3'
    };

    const course = courses[normalizedQuery];
    console.log('Curso mapeado:', course);

    if (course) {
      this.contextManager.updateContext(userId, { 
        step: 'course_selected', 
        course,
        detail: 'horarios' // Iniciar desde un detalle por defecto
      });
      return this.getCourseMenuResponse(course);
    }
    
    await this.logUnknownQuery(userId, query);
    return this.getMainMenuResponse(); // Mejor que getDefaultResponse
  }




  async handleDetailOptions(userId, query, context) {
    if (query === '1') {
      // Mostrar otro detalle del mismo curso
      const nextDetail = this.getNextDetail(context.detail);
      this.contextManager.updateContext(userId, { detail: nextDetail });
      return this.getCourseDetailResponse(context.course, nextDetail);
    } else if (query === '2') {
      this.contextManager.updateContext(userId, { step: 'course_selected' });
      return { text: '📞 Un asesor se contactará contigo. Proporciona tu teléfono o correo:' };
    } else {
      this.contextManager.updateContext(userId, { step: 'main_menu' });
      return this.getMainMenuResponse();
    }
  }

  // Helpers de respuesta
  getMainMenuResponse() {
    const saludo = corpus.find(item => item.intencion === 'saludo');
    return {
      text: saludo.respuestas[0],
      image: saludo.imagen
    };
  }


  getCourseMenuResponse(courseId) {
    const courseSection = corpus.find(item => item.intencion === 'curso_seleccionado');

    if (!courseSection?.logica?.[courseId]) {
      return {
        text: `Opción no reconocida. Por favor elige:\n1. IA\n2. Ciencia de Datos\n3. Desarrollo Web`,
        image: null
      };
    }

    const courseData = courseSection.logica[courseId];

    return {
      text: courseSection.mensaje_respuesta
        .replace('{nombre}', courseData.nombre)
        .replace('{emoji}', courseData.emoji),
      image: null
    };
  }


  getCourseDetailResponse(courseId, detailKey) {
    const courseData = corpus
      .find(item => item.intencion === 'curso_seleccionado')
      .logica[courseId];

    return {
      text: `${courseData.detalles[detailKey]}\n\n¿Qué más necesitas?\n1. Ver otra información\n2. Hablar con asesor\n3. Volver al menú`
    };
  }


  getDefaultResponse() {
    return { 
      text: config.defaultResponse || 'No entendí tu solicitud. Por favor intenta de nuevo.' 
    };
  }

  preprocess(text) {
    return text.toLowerCase().trim().replace(/[^\w\sáéíóú]/gi, '');
  }

  getNextDetail(currentDetail) {
    const detailsOrder = ['horarios', 'costo', 'requisitos'];
    const currentIndex = detailsOrder.indexOf(currentDetail);
    return detailsOrder[(currentIndex + 1) % detailsOrder.length];
  }

  async logUnknownQuery(userId, query) {
    await fs.appendFile(
      this.unknownQueriesFile, 
      `${new Date().toISOString()}|${userId}|${query}\n`
    );
  }
  normalizeString(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\sáéíóú]/gi, '')
    .trim();
}


async handleCourseOptions(userId, query, courseId) {
  const options = {
    '1': 'horarios',
    '2': 'costo',
    '3': 'requisitos'
  };

  const selectedDetail = options[query];

  if (selectedDetail) {
    this.contextManager.updateContext(userId, {
      step: 'course_detail',
      course: courseId,
      detail: selectedDetail
    });
    return this.getCourseDetailResponse(courseId, selectedDetail);
  }

  return {
    text: `Por favor elige una opción válida:\n1. Horarios\n2. Costo\n3. Requisitos`
  };
}

}

module.exports = new NLPProcessor();