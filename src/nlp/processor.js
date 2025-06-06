const stringSimilarity = require('string-similarity');
const path = require('path');
const fs = require('fs-extra');
const config = require('../../config.json');
const ContextManager = require('./contextManager');
const corpus = require('../../data/corpus/corpus.json');

const DESPEDIDAS = ['adios', 'chao', 'gracias', 'salir', 'terminar', 'hasta luego'];
const INFO_GENERAL = ['informacion', 'que ofrecen', 'cursos', 'programas'];
const UBICACION = ['donde estan', 'ubicacion', 'direccion', 'como llegar'];
const CONTACTO = ['telefono', 'celular', 'llamar', 'contacto', 'correo', 'email'];
const SALUDOS = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hi', 'hello'];

class NLPProcessor {
  constructor() {
    this.contextManager = new ContextManager();
    this.unknownQueriesFile = path.join(__dirname, '../../data/unknown_queries.log');
    this.inscriptionsFile = path.join(__dirname, '../../data/inscriptions.log');
  }

  async findBestMatch(userId, query) {
    const queryNormalizada = this.normalizeString(query);
    
    if (DESPEDIDAS.includes(queryNormalizada)) {
      const despedida = corpus.find(item => item.intencion === 'despedida');
      return { 
        text: despedida.respuestas[Math.floor(Math.random() * despedida.respuestas.length)],
        image: null
      };
    }

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

    if (SALUDOS.includes(queryNormalizada)) {
      const saludo = corpus.find(item => item.intencion === 'saludo');
      return { 
        text: saludo.respuestas[Math.floor(Math.random() * saludo.respuestas.length)],
        image: saludo.imagen ? path.join(__dirname, '../../', saludo.imagen) : null
      };
    }

    if (!query || typeof query !== 'string') {
      return this.getDefaultResponse();
    }

    const context = this.contextManager.getContext(userId) || { step: 'main_menu' };

    if (context.step === 'waiting_inscription_data') {
      return this.handleInscriptionData(userId, query, context);
    }

    if (context.step === 'waiting_contact_info') {
      return this.handleContactInfo(userId, query);
    }

    if (queryNormalizada === '8' || queryNormalizada.includes('volver') || queryNormalizada.includes('menu')) {
      this.contextManager.updateContext(userId, { step: 'main_menu' });
      return this.getMainMenuResponse();
    }

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

  async handleInscriptionData(userId, query, context) {
    const extractData = (text) => {
      const data = {
        nombre: '',
        documento: '',
        telefono: '',
        correo: ''
      };

      const prefixedPatterns = {
        nombre: ['nombre', 'name'],
        documento: ['documento', 'cedula', 'identificacion'],
        telefono: ['telefono', 'teléfono', 'celular', 'cel', 'contacto'],
        correo: ['correo', 'email', 'e-mail']
      };

      for (const [field, patterns] of Object.entries(prefixedPatterns)) {
        for (const pattern of patterns) {
          const regex = new RegExp(`${pattern}[:\s]*(.*?)(?=\\n|${Object.keys(prefixedPatterns).filter(k => k !== field).join('|')}|$)`, 'i');
          const match = text.match(regex);
          if (match && match[1]) {
            data[field] = match[1].trim();
            break;
          }
        }
      }

      if (!data.nombre || !data.documento || !data.telefono || !data.correo) {
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length >= 4) {
          data.nombre = lines[0].trim();
          data.documento = lines[1].trim();
          data.telefono = lines[2].trim();
          
          const emailLine = lines.slice(3).find(line => line.includes('@'));
          data.correo = emailLine ? emailLine.trim() : lines[3].trim();
        }
      }

      if (!data.correo || !data.correo.includes('@')) {
        const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
        if (emailMatch) data.correo = emailMatch[0];
      }

      return data;
    };

    const extracted = extractData(query);
    const newData = {
      ...context.data,
      nombre: extracted.nombre || context.data.nombre,
      documento: extracted.documento || context.data.documento,
      telefono: extracted.telefono || context.data.telefono,
      correo: extracted.correo || context.data.correo
    };

    this.contextManager.updateContext(userId, { data: newData });

    if (newData.nombre && newData.documento && newData.telefono && newData.correo) {
      const courseData = corpus
        .find(item => item.intencion === 'curso_seleccionado')
        .logica[context.course];

      await this.saveInscription({
        userId,
        ...newData,
        curso: courseData.nombre,
        cursoId: context.course,
        fecha: new Date().toISOString()
      });

      this.contextManager.updateContext(userId, { step: 'main_menu' });

      return {
        text: `✅ ¡Inscripción a ${courseData.nombre} completada! ${courseData.emoji}\n\nResumen:\nNombre: ${newData.nombre}\nDocumento: ${newData.documento}\nTeléfono: ${newData.telefono}\nCorreo: ${newData.correo}\n\nRecibirás un correo de confirmación en las próximas horas.`,
        image: null
      };
    }

    const missing = [];
    if (!newData.nombre) missing.push("🔹 Nombre completo");
    if (!newData.documento) missing.push("🔹 Número de documento");
    if (!newData.telefono) missing.push("🔹 Teléfono de contacto");
    if (!newData.correo) missing.push("🔹 Correo electrónico");

    const courseData = corpus
      .find(item => item.intencion === 'curso_seleccionado')
      .logica[context.course];

    return {
      text: `📝 Faltan datos para tu inscripción a ${courseData.nombre}:\n${missing.join('\n')}\n\nPuedes enviar los datos de estas formas:\n\n1. Con prefijos:\nNombre: [Tu nombre]\nDocumento: [Tu documento]\nTeléfono: [Tu teléfono]\nCorreo: [Tu correo]\n\n2. Uno por línea:\n[Tu nombre]\n[Tu documento]\n[Tu teléfono]\n[Tu correo]`,
      image: null
    };
  }

  async saveInscription(data) {
    await fs.appendFile(this.inscriptionsFile, JSON.stringify(data) + '\n');
  }

  async handleMainMenu(userId, query) {
    const courses = {
      '1': '1', '1.': '1', 
      'inteligencia artificial': '1', 'ia': '1', 'ai': '1', 'inteligencia': '1',
      '2': '2', '2.': '2', 
      'ciencia de datos': '2', 'datos': '2', 'analisis de datos': '2', 'analítica': '2',
      '3': '3', '3.': '3', 
      'desarrollo web': '3', 'web': '3', 'programacion web': '3', 'páginas web': '3'
    };

    // Buscar coincidencia exacta
    let course = courses[query];

    // Si no hay coincidencia exacta, buscar la mejor coincidencia
    if (!course) {
      const matches = stringSimilarity.findBestMatch(query, Object.keys(courses));
      if (matches.bestMatch.rating > 0.6) {
        course = courses[matches.bestMatch.target];
      }
    }

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
      'horario': 'horarios', 'horarios': 'horarios', 'fechas': 'horarios', 
      'cuando': 'horarios', 'dias': 'horarios', 'días': 'horarios', 'cuándo': 'horarios',
      
      '2': 'costo', 
      'precio': 'costo', 'costos': 'costo', 'precios': 'costo', 
      'valor': 'costo', 'pago': 'costo', 'inversión': 'costo', 'cuanto cuesta': 'costo',
      
      '3': 'requisitos', 
      'requisito': 'requisitos', 'requerimientos': 'requisitos', 
      'necesito': 'requisitos', 'conocimientos previos': 'requisitos', 'que necesito': 'requisitos',
      
      '4': 'duracion', 
      'duración': 'duracion', 'tiempo': 'duracion', 'dura': 'duracion', 
      'cuanto dura': 'duracion', 'semanas': 'duracion', 'meses': 'duracion', 'días': 'duracion',
      
      '5': 'certificacion', 
      'certificado': 'certificacion', 'diploma': 'certificacion', 
      'certificación': 'certificacion', 'acreditación': 'certificacion', 'recibo diploma': 'certificacion',
      
      '6': 'asesor', 
      'hablar': 'asesor', 'consultar': 'asesor', 'asesoría': 'asesor', 
      'asesoria': 'asesor', 'contactar': 'asesor', 'consultoria': 'asesor', 'quiero hablar': 'asesor',
      
      '7': 'inscribirme', 
      'inscripcion': 'inscribirme', 'matricular': 'inscribirme', 
      'registrar': 'inscribirme', 'matricula': 'inscribirme', 'registro': 'inscribirme', 'quiero inscribirme': 'inscribirme',
      
      '8': 'volver', 
      'menu': 'volver', 'menú': 'volver', 'principal': 'volver', 
      'inicio': 'volver', 'atras': 'volver', 'regresar': 'volver', 'volver al menú': 'volver'
    };

    // Buscar coincidencia exacta
    let opcion = opciones[query];

    // Si no hay coincidencia exacta, buscar la mejor coincidencia
    if (!opcion) {
      const matches = stringSimilarity.findBestMatch(query, Object.keys(opciones));
      if (matches.bestMatch.rating > 0.6) {
        opcion = opciones[matches.bestMatch.target];
      }
    }

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

    if (opcion === 'inscribirme') {
      this.contextManager.updateContext(userId, { 
        step: 'waiting_inscription_data',
        data: {},
        course: courseId
      });
      const courseData = corpus
        .find(item => item.intencion === 'curso_seleccionado')
        .logica[courseId];
      return { 
        text: `📝 Inscripción a ${courseData.nombre} ${courseData.emoji}\n\nPor favor envía tus datos (puedes usar cualquier formato):\n\n• Nombre completo\n• Número de documento\n• Teléfono de contacto\n• Correo electrónico`,
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
    const queryNormalizada = this.normalizeString(query);
    
    if (query === '1' || queryNormalizada === 'siguiente' || queryNormalizada.includes('otra informacion')) {
      const nextDetail = this.getNextDetail(context.detail, detailsOrder);
      this.contextManager.updateContext(userId, { detail: nextDetail });
      return this.getCourseDetailResponse(context.course, nextDetail);
    } else if (query === '2' || queryNormalizada.includes('asesor') || queryNormalizada.includes('hablar')) {
      this.contextManager.updateContext(userId, { 
        step: 'waiting_contact_info',
        course: context.course
      });
      return { 
        text: '📞 Un asesor se contactará contigo. Por favor envía tu número de teléfono o correo electrónico:',
        image: null
      };
    } else if (query === '3' || queryNormalizada.includes('volver') || queryNormalizada.includes('menu')) {
      this.contextManager.updateContext(userId, { step: 'main_menu' });
      return this.getMainMenuResponse();
    } else {
      await this.logUnknownQuery(userId, query);
      return {
        text: '😅 No entendí. Por favor elige:\n\n1. Ver otra información\n2. Hablar con asesor\n3. Volver al menú',
        image: null
      };
    }
  }

  async handleContactInfo(userId, query) {
    const phoneRegex = /^[0-9]{7,15}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedQuery = this.normalizeString(query).replace(/\s+/g, '');
    
    if (phoneRegex.test(normalizedQuery)) {
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

    const optionsText = "\n\n¿Qué más necesitas?\n1. Ver otra información\n2. Hablar con asesor\n3. Volver al menú";

    return {
      text: `${courseData.detalles[detailKey]}${optionsText}`,
      image: null
    };
  }

  getDefaultResponse(context) {
    if (context?.step === 'course_selected') {
      return { 
        text: "😅 No entendí. Por favor elige una opción:\n\n1. Horarios\n2. Costo\n3. Requisitos\n4. Duración\n5. Certificación\n6. Hablar con asesor\n7. Inscribirme\n8. Volver",
        image: null
      };
    }
    
    if (context?.step === 'waiting_inscription_data') {
      return {
        text: "📝 Por favor envía tus datos para completar la inscripción:\n\n• Nombre completo\n• Número de documento\n• Teléfono de contacto\n• Correo electrónico\n\nPuedes enviarlos en cualquier formato.",
        image: null
      };
    }
    
    return { 
      text: "😕 No entendí. Selecciona:\n\n1️⃣ Inteligencia Artificial\n2️⃣ Ciencia de Datos\n3️⃣ Desarrollo Web\n\nO escribe:\n• 'Ubicación' para dirección\n• 'Contacto' para teléfonos",
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