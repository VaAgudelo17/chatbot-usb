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
      welcomeImage: path.join(__dirname, '../../', config.welcomeImage),
      responseImage: path.join(__dirname, '../../assets/ola.gif')
    };

    this.sentWelcome = new Set();
    this.setupEvents();
  }

  async checkAssets() {
    try {
      await fs.access(this.assetPaths.welcomeImage);
      await fs.access(this.assetPaths.responseImage);
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
      } else {
        console.warn('⚠️ No se enviaron mensajes por falta de archivos multimedia');
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
        
        console.log(`Enviando a ${user}...`);
        await this.sendWelcomeMessage(user);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Espera 2s entre mensajes
      }
    } catch (error) {
      console.error('Error enviando bienvenidas:', error);
    }
  }

  async sendWelcomeMessage(userId) {
    // Validación adicional
    if (!config.usersToWelcome.includes(userId)) {
      console.warn(`⚠️ Intento de enviar a usuario no autorizado: ${userId}`);
      return;
    }
    
    try {
      const welcomeMsg = config.welcomeMessage.replace('{user}', userId.split('@')[0]);
      await this.client.sendMessage(userId, welcomeMsg);
      
      if (config.welcomeImage) {
        const media = MessageMedia.fromFilePath(path.join(__dirname, '../../', config.welcomeImage));
        await this.client.sendMessage(userId, media, { caption: config.imageCaption });
      }
      console.log(`✅ Bienvenida enviada a ${userId}`);
    } catch (error) {
      console.error(`❌ Error enviando a ${userId}:`, error.message);
    }
  }

async handleMessage(msg) {
  if (msg.fromMe || msg.isGroupMsg) return;

  // Verificar usuario autorizado
  if (!config.usersToWelcome.includes(msg.from)) {
    console.log(`Mensaje de usuario no autorizado: ${msg.from}`);
    return;
  }

  try {
    const response = await nlp.findBestMatch(msg.from, msg.body);
    
    const responseText = response.text || config.defaultResponse;
    await this.client.sendMessage(msg.from, responseText);
    
    if (response.image) {
      try {
        const imagePath = path.join(__dirname, '../../', response.image);
        const media = MessageMedia.fromFilePath(imagePath);
        await this.client.sendMessage(msg.from, media);
        console.log(`🖼️ Imagen enviada como respuesta a ${msg.from}`);
      } catch (mediaError) {
        console.error('Error enviando imagen:', mediaError);
      }
    }

  } catch (error) {
    console.error('❌ Error procesando el mensaje:', error);
    await this.client.sendMessage(msg.from, config.defaultResponse);
  }
}

  initialize() {
    this.client.initialize();
  }
}

module.exports = new WhatsAppService();
