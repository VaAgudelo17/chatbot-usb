const whatsapp = require('./services/whatsapp');


console.log(`
╔══════════════════════════════╗
║    Chatbot Académico v1.0.0   ║
╚══════════════════════════════╝
`);

whatsapp.checkAssets()
  .then(assetsOk => {
    if (assetsOk) whatsapp.initialize();
    else process.exit(1);
  });