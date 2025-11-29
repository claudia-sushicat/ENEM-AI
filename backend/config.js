// Configurações do sistema
module.exports = {
  // Configurações do servidor
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // OpenAI API
  openaiApiKey: process.env.OPENAI_API_KEY,
  
  // JWT
  jwtSecret: process.env.JWT_SECRET,
  
  // Database
  databasePath: process.env.DATABASE_PATH || './database.sqlite',
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN,
  
  // Email (Mailtrap)
  email: {
    from: process.env.EMAIL_FROM,
    frontendUrl: process.env.FRONTEND_URL
  },
  
  // Mailtrap
  mailtrap: {
    token: process.env.MAILTRAP_TOKEN
  },
  
  // Configurações de IA
  ai: {
    model: 'gpt-5.1',
    temperature: 0.7,
    maxTokens: 2000,
    timeout: 30000 // 30 segundos
  }
};
