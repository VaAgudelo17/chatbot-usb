const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const nlp = require('../nlp/processor');
const config = require('../../config.json');
const fs = require('fs').promises;

class WhatsAppService {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, '../../data/sessions'),
        clientId: 'bot-academico'
      }),
      puppeteer: {
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      },
      webVersionCache: {
        type: 'remote',
        remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
      }
    });

    this.assetPaths = {
      welcomeImage: path.join(__dirname, '../../', config.welcomeImage)
    };

    this.sentWelcome = new Set();
    this.inactiveTimers = new Map();
    this.waitingForInteraction = new Map();
    this.setupEvents();
  }

  async checkAssets() {
    try {
      await fs.access(this.assetPaths.welcomeImage);
      console.log('🖼️ Todos los assets existen correctamente.');
      return true;
    } catch (e) {
      console.error('❌ Assets faltantes o inaccesibles:', e.message);
      return false;
    }
  }

  setupEvents() {
    this.client.on('qr', qr => {
      console.log('🔍 Escanea este QR con WhatsApp:');
      require('qrcode-terminal').generate(qr, { small: true });
    });

    this.client.on('authenticated', () => {
      console.log('✅ Autenticación exitosa con WhatsApp');
    });

    this.client.on('auth_failure', msg => {
      console.error('❌ Fallo de autenticación:', msg);
      process.exit(1);
    });

    this.client.on('ready', async () => {
      console.log('🚀 Bot completamente operativo');
      const assetsOk = await this.checkAssets();
      if (assetsOk) {
        await this.sendInitialWelcomeMessages();
      }
    });

    this.client.on('disconnected', (reason) => {
      console.log('🔄 Reconexión en curso. Motivo:', reason);
      setTimeout(() => this.client.initialize(), 5000);
    });

    this.client.on('message', msg => this.handleMessage(msg));
  }

  async sendInitialWelcomeMessages() {
    try {
      console.log('Usuarios configurados para recibir bienvenida:', config.usersToWelcome);

      for (const user of config.usersToWelcome) {
        if (!user.endsWith('@c.us')) {
          console.warn(`Formato inválido: ${user} - Se omitirá`);
          continue;
        }

        console.log(`Enviando bienvenida a ${user}...`);
        await this.sendWelcomeMessage(user);
        this.waitingForInteraction.set(user, true);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Error enviando bienvenidas:', error);
    }
  }

  async sendWelcomeMessage(userId) {
    if (!config.usersToWelcome.includes(userId)) {
      console.warn(`⚠️ Intento de enviar a usuario no autorizado: ${userId}`);
      return;
    }

    try {
      const welcomeMsg = config.welcomeMessage.replace('{user}', userId.split('@')[0]);
      await this.client.sendMessage(userId, welcomeMsg);

      if (config.welcomeImage) {
        const media = MessageMedia.fromFilePath(this.assetPaths.welcomeImage);
        await this.client.sendMessage(userId, media, { caption: config.imageCaption });
      }
      console.log(`✅ Bienvenida enviada a ${userId}`);
    } catch (error) {
      console.error(`❌ Error enviando a ${userId}:`, error.message);
    }
  }

  normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\sáéíóú]/gi, '')
      .trim();
  }

  async handleMessage(msg) {
    if (msg.fromMe || msg.isGroupMsg) return;

    if (!config.usersToWelcome.includes(msg.from)) {
      console.log(`Mensaje de usuario no autorizado: ${msg.from}`);
      return;
    }

    clearTimeout(this.inactiveTimers.get(msg.from));

    if (this.waitingForInteraction.get(msg.from)) {
      const normalizedMsg = this.normalizeString(msg.body);
      const saludos = ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hi', 'hello'];

      if (saludos.includes(normalizedMsg)) {
        this.waitingForInteraction.set(msg.from, false);
        const menu = await nlp.getMainMenuResponse();
        await this.client.sendMessage(msg.from, menu.text);

        if (menu.image) {
          const media = MessageMedia.fromFilePath(path.join(__dirname, '../../', menu.image));
          await this.client.sendMessage(msg.from, media);
        }
      } else {
        await this.client.sendMessage(msg.from,
          "Por favor inicia la conversación con un saludo (ej: 'Hola') para continuar 😊");
      }
      return;
    }

    try {
      const response = await nlp.findBestMatch(msg.from, msg.body);
      await this.client.sendMessage(msg.from, response.text);

      if (response.image) {
        const media = MessageMedia.fromFilePath(path.join(__dirname, '../../', response.image));
        await this.client.sendMessage(msg.from, media);
      }

      this.inactiveTimers.set(msg.from, setTimeout(async () => {
        await this.client.sendMessage(msg.from,
          "⏳ ¿Sigues ahí? Si necesitas ayuda, escribe 'menú' para volver al inicio.");
      }, 300000));

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error);
      await this.client.sendMessage(msg.from, '⚠️ Ocurrió un error. Intenta nuevamente más tarde.');
    }
  }

  initialize() {
    this.client.initialize();
  }
}

module.exports = new WhatsAppService();
