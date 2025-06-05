# 🤖 Chatbot Académico con PLN

Bot de WhatsApp para atención automática con procesamiento de lenguaje natural, diseñado para instituciones educativas.

![chatbot](https://github.com/user-attachments/assets/d266b99f-ec52-48aa-869a-46ebd89003e3)


## 🌟 Características Principales
- **Menú interactivo** de cursos y programas académicos
- **Proceso de inscripción** guiado con validación de datos
- **Información detallada** sobre horarios, costos y requisitos
- **Conexión con asesores** cuando se requiere
- **Reconocimiento flexible** de lenguaje natural
- **Persistencia de contexto** durante conversaciones

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

diagrama...
## hola


