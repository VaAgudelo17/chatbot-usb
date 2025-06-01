const fs = require('fs').promises;
const path = require('path');

module.exports = async (assets) => {
  for (const [name, filePath] of Object.entries(assets)) {
    try {
      await fs.access(filePath);
      console.log(`✓ ${name}: ${filePath}`);
    } catch (e) {
      console.error(`✗ ${name} no encontrado en: ${filePath}`);
      return false;
    }
  }
  return true;
};