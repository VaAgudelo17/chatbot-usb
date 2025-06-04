const stringSimilarity = require('string-similarity');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config.json');
const ContextManager = require('./contextManager');
const corpus = require('../../data/corpus/corpus.json');

// Constantes
const DESPEDIDAS = ['adios', 'chao', 'gracias', 'salir', 'terminar', 'hasta luego'];
const INFO_GENERAL = ['informacion', 'que ofrecen', 'cursos', 'programas'];
const UBICACION = ['donde estan', 'ubicacion', 'direccion', 'como llegar'];
const CONTACTO = ['telefono', 'celular', 'llamar', 'contacto', 'correo', 'email'];
const SALUDOS = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hi', 'hello'];

class NLPProcessor {
  constructor() {
    this.contextManager = new ContextManager();
    this.unknownQueriesFile = path.join(__dirname, '../../data/unknown_queries.log');
  }

  async findBestMatch(userId, query) {
    const queryNormalizada = this.normalizeString(query);
    
    // Verificar despedidas primero
    if (DESPEDIDAS.includes(queryNormalizada)) {
      const despedida = corpus.find(item => item.intencion === 'despedida');
      return { 
        text: despedida.respuestas[Math.floor(Math.random() * despedida.respuestas.length)],
        image: null
      };
    }

    // Manejar otras intenciones directas
    if (INFO_GENERAL.includes(queryNormalizada)) {
      const info = corpus.find(item => item.intencion === 'informacion_general');
      return { text: info.respuestas[0], image: null };
    }

    if (UBICACION.includes(queryNormalizada)) {
      const ubic = corpus.find(item => item.intencion === 'ubicacion');
      return { text: ubic.respuestas[0], image: null };
    }

    if (CONTACTO.includes(queryNormalizada)) {
      const contacto = corpus.find(item => item.intencion === 'contacto');
      return { text: contacto.respuestas[0], image: null };
    }

    if (!query || typeof query !== 'string') {
      return this.getDefaultResponse();
    }

    const context = this.contextManager.getContext(userId) || { step: 'main_menu' };

    // Manejar contexto de espera de información de contacto
    if (context.step === 'waiting_contact_info') {
      return this.handleContactInfo(userId, query);
    }

    // Comandos universales
    if (queryNormalizada === '5' || queryNormalizada === '7' || queryNormalizada.includes('volver') || queryNormalizada.includes('menu')) {
      this.contextManager.updateContext(userId, { step: 'main_menu' });
      return this.getMainMenuResponse();
    }

    // Lógica por pasos
    switch (context.step) {
      case 'main_menu':
        return this.handleMainMenu(userId, queryNormalizada);
      case 'course_selected':
        return this.handleCourseOptions(userId, queryNormalizada, context.course);
      case 'course_detail':
        return this.handleDetailOptions(userId, queryNormalizada, context);
      default:
        return this.getDefaultResponse(context);
    }
  }

  async handleMainMenu(userId, query) {
    const courses = {
      '1': '1', '1.': '1', '1 ': '1', 'inteligencia artificial': '1', 'ia': '1', 'artificial': '1',
      '2': '2', '2.': '2', '2 ': '2', 'ciencia de datos': '2', 'datos': '2', 'ciencia': '2',
      '3': '3', '3.': '3', '3 ': '3', 'desarrollo web': '3', 'web': '3', 'desarrollo': '3'
    };

    const course = courses[query];

    if (course) {
      this.contextManager.updateContext(userId, { 
        step: 'course_selected', 
        course,
        detail: 'horarios'
      });
      return this.getCourseMenuResponse(course);
    }
    
    await this.logUnknownQuery(userId, query);
    return this.getDefaultResponse();
  }

  async handleCourseOptions(userId, query, courseId) {
    const opciones = {
      '1': 'horarios',
      '2': 'costo',
      '3': 'requisitos',
      '4': 'duracion',
      '5': 'certificacion',
      '6': 'asesor',
      '7': 'volver'
    };

    const opcion = opciones[query];

    if (!opcion) {
      await this.logUnknownQuery(userId, query);
      return this.getDefaultResponse({ step: 'course_selected' });
    }

    if (opcion === 'volver') {
      this.contextManager.updateContext(userId, { step: 'main_menu' });
      return this.getMainMenuResponse();
    }

    if (opcion === 'asesor') {
      const courseData = corpus
        .find(item => item.intencion === 'curso_seleccionado')
        .logica[courseId];
      
      this.contextManager.updateContext(userId, { 
        step: 'waiting_contact_info',
        course: courseId
      });
      return { 
        text: `📞 Un asesor de ${courseData.nombre} te contactará. Por favor envía tu:\n\n• Número de teléfono\n• O correo electrónico\n\nEjemplo: 3101234567 o nombre@correo.com`,
        image: null
      };
    }

    this.contextManager.updateContext(userId, {
      step: 'course_detail',
      course: courseId,
      detail: opcion
    });

    return this.getCourseDetailResponse(courseId, opcion);
  }

  async handleDetailOptions(userId, query, context) {
    const detailsOrder = ['horarios', 'costo', 'requisitos', 'duracion', 'certificacion'];
    
    if (query === '1') {
      const nextDetail = this.getNextDetail(context.detail, detailsOrder);
      this.contextManager.updateContext(userId, { detail: nextDetail });
      return this.getCourseDetailResponse(context.course, nextDetail);
    } else if (query === '2') {
      this.contextManager.updateContext(userId, { 
        step: 'waiting_contact_info',
        course: context.course
      });
      return { 
        text: '📞 Un asesor se contactará contigo. Por favor envía tu número de teléfono o correo electrónico:',
        image: null
      };
    } else {
      this.contextManager.updateContext(userId, { step: 'main_menu' });
      return this.getMainMenuResponse();
    }
  }

  async handleContactInfo(userId, query) {
    const phoneRegex = /^[0-9]{7,15}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedQuery = this.normalizeString(query).replace(/\s+/g, '');
    
    if (phoneRegex.test(normalizedQuery)) {
      // Guardar en "base de datos" (archivo temporal)
      await this.saveContactInfo(userId, { phone: normalizedQuery });
      this.contextManager.updateContext(userId, { step: 'main_menu' });
      return {
        text: '✅ Gracias por tu número. Un asesor te contactará pronto.\n\n¿En qué más puedo ayudarte?',
        image: null
      };
    } else if (emailRegex.test(normalizedQuery)) {
      await this.saveContactInfo(userId, { email: normalizedQuery });
      this.contextManager.updateContext(userId, { step: 'main_menu' });
      return {
        text: '✅ Gracias por tu correo. Un asesor te contactará pronto.\n\n¿En qué más puedo ayudarte?',
        image: null
      };
    } else {
      return {
        text: '⚠️ Formato incorrecto. Por favor envía:\n\n• Número de teléfono (ej: 3101234567)\n• O correo electrónico (ej: nombre@correo.com)',
        image: null
      };
    }
  }

  async saveContactInfo(userId, info) {
    const contactsFile = path.join(__dirname, '../../data/contacts.log');
    const data = {
      timestamp: new Date().toISOString(),
      userId,
      ...info
    };
    await fs.appendFile(contactsFile, JSON.stringify(data) + '\n');
  }

  getMainMenuResponse() {
    const saludo = corpus.find(item => item.intencion === 'saludo');
    return {
      text: saludo.respuestas[0],
      image: saludo.imagen ? path.join(__dirname, '../../', saludo.imagen) : null
    };
  }

  getCourseMenuResponse(courseId) {
    const courseSection = corpus.find(item => item.intencion === 'curso_seleccionado');
    const courseData = courseSection?.logica?.[courseId];

    if (!courseData) {
      return {
        text: `Opción no reconocida. Por favor elige:\n1. IA\n2. Ciencia de Datos\n3. Desarrollo Web`,
        image: null
      };
    }

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

    const optionsText = detailKey === 'asesor' ? 
      "\n\nPor favor envía tu número de teléfono o correo electrónico:" :
      "\n\n¿Qué más necesitas?\n1. Ver otra información\n2. Hablar con asesor\n3. Volver al menú";

    return {
      text: `${courseData.detalles[detailKey]}${optionsText}`,
      image: null
    };
  }

  getDefaultResponse(context) {
    if (context?.step === 'course_selected') {
      return { 
        text: "😅 No entendí. Por favor elige:\n\n1. Horarios\n2. Costo\n3. Requisitos\n4. Duración\n5. Certificación\n6. Asesor\n7. Volver\n\nO escribe 'menú' para reiniciar",
        image: null
      };
    }
    
    return { 
      text: "😕 No entendí. Selecciona:\n\n1️⃣ Inteligencia Artificial\n2️⃣ Ciencia de Datos\n3️⃣ Desarrollo Web\n\nO pregunta por:\n• Ubicación\n• Contacto\n• Información",
      image: null
    };
  }

  getNextDetail(currentDetail, detailsOrder) {
    const currentIndex = detailsOrder.indexOf(currentDetail);
    return detailsOrder[(currentIndex + 1) % detailsOrder.length];
  }

  preprocess(text) {
    return this.normalizeString(text);
  }

  async logUnknownQuery(userId, query) {
    await fs.appendFile(
      this.unknownQueriesFile, 
      `${new Date().toISOString()}|${userId}|${query}\n`
    );
  }

  normalizeString(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\sáéíóú]/gi, '')
      .trim();
  }
}

module.exports = new NLPProcessor();