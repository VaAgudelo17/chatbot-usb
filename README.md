# 🤖 Chatbot Académico con PLN: NeuroWeb

NeuroWeb es un servicio automatizado que permite la inscripción y atención a estudiantes interesados en formarse en Inteligencia Artificial, Ciencia de Datos y Desarrollo Web a través de WhatsApp.

<img src="https://github.com/user-attachments/assets/59a7dc4c-9d6f-4b9f-b869-61e6d4841445" alt="chatbot" width="140"/>

## Funcionalidades 🛠️
1. **Visualización de cursos disponibles:**
   - Inteligencia Artificial
   - Ciencia de Datos
   - Desarrollo Web 
   
2. **Información de cursos:**:
   - Horarios
   - Costos
   - Requisitos
   - Duración
   - Certificación
3. **Proceso de inscripción:**
  - Captura de datos personales
  - Confirmación con resumen
4. Otras funciones:
  - Contacto con asesores
  - Información de ubicación
  - Datos de contacto


## 🌟 Características Principales

- **Menú interactivo** de cursos académicos
- **Proceso de inscripción** guiado con validación de datos
- **Información detallada** sobre horarios, costos y requisitos
- **Conexión con asesores** cuando se requiere
- **Reconocimiento flexible** de lenguaje natural
- **Persistencia de contexto** durante conversaciones

## 🔄 Flujo de Procesamiento

1. **Recepción de Mensaje**: El bot recibe mensajes a través de WhatsApp Web
2. **Preprocesamiento**: Normalización de texto (minúsculas, sin acentos)
3. **Clasificación de Intención**: Búsqueda de coincidencias en el corpus
4. **Manejo de contexto conversacional**
5. **Generación de Respuesta**:
   - Recuperación de información específica sobre los cursos
   - Construcción de mensajes personalizados según el contexto
6. **Persistencia de Datos**:
   - Registro de conversaciones
   - Almacenamiento de inscripciones a los cursos de NeuroWeb

# 📦 Estructura del Proyecto

```text
chatbot-academico/
├── assets/               # Multimedia del bot
├── data/
│   ├── corpus/           # Intenciones y respuestas
│   ├── sessions/         # Sesiones de WhatsApp
│   ├── contacts.log      # Registro de contactos
│   └── inscriptions.log  # Inscripciones realizadas
├── src/
│   ├── services/
│   │   ├── whatsapp/     # Conexión con WhatsApp
│   │   └── nlp/          # Procesamiento de lenguaje
└── config.json           # Configuración inicial

```

## 🛠️ Arquitectura Técnica

### Diagrama de Componentes

```mermaid
flowchart TB
    subgraph WhatsApp
        WAPI[WhatsApp Web API]
    end

    subgraph Aplicación
        BOT[Bot Principal]
        NLP[Procesador PLN]
        CTX[Gestor de Contexto]
        DS[(Data Stores)]
    end

    Usuario --> WAPI
    WAPI --> BOT
    BOT --> NLP
    NLP --> CTX
    CTX --> DS
    DS --> CTX
    CTX --> NLP
    NLP --> BOT
    BOT --> WAPI
    WAPI --> Usuario
```
🚀 Instalación y Configuración
Clona el repositorio:
```
git clone https://github.com/VaAgudelo17/chatbot-usb.git
cd chatbot-usb
```
Instala dependencias:
```
npm install
```
## ▶️ Ejecución
```
npm start
```
## 🛠️ Dependencias Principales
| Paquete           | Función                      |
|-------------------|------------------------------|
| whatsapp-web.js    | Conexión con WhatsApp        |
| string-similarity  | Comparación de similitud de texto |
| fs-extra          | Manejo de archivos            |
| qrcode-terminal    | Generación de QR en terminal |

## 📌 Requisitos del Sistema
- **Node.js v16+**
- **NPM v8+**
- **WhatsApp activo en dispositivo móvil**
- **Navegador Chromium instalado**

## Archivos Principales 📄
- **processor.js** Lógica de procesamiento de mensajes
- **whatsapp.js** Configuración del cliente WhatsApp
- **corpus.json** Base de conocimiento del chatbot
- **contextManager.js** Gestión de flujos conversacionales


