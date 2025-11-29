const nodemailer = require('nodemailer');
const { MailtrapTransport } = require('mailtrap');
const config = require('./config');

class EmailService {
  constructor() {
    // Configuração do Mailtrap com token
    this.transporter = nodemailer.createTransport(
      MailtrapTransport({
        token: config.mailtrap.token
      })
    );
  }

  async enviarEmailResetSenha(email, nome, token) {
    const resetUrl = `${config.email.frontendUrl}/reset-password?token=${token}`;
    
    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: '🔐 Redefinir Senha - Sistema ENEM',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background: white; border-radius: 10px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #2c3e50; margin: 0; font-size: 28px;">🎓 Sistema ENEM</h1>
              <p style="color: #7f8c8d; margin: 5px 0 0 0;">Plataforma de Estudos</p>
            </div>
            
            <!-- Content -->
            <div style="margin-bottom: 30px;">
              <h2 style="color: #2c3e50; margin-bottom: 20px;">Redefinir Senha</h2>
              
              <p style="color: #34495e; line-height: 1.6; margin-bottom: 20px;">
                Olá <strong>${nome}</strong>,
              </p>
              
              <p style="color: #34495e; line-height: 1.6; margin-bottom: 20px;">
                Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha:
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          padding: 15px 30px; 
                          text-decoration: none; 
                          border-radius: 8px; 
                          display: inline-block; 
                          font-weight: bold; 
                          font-size: 16px;
                          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
                  🔐 Redefinir Senha
                </a>
              </div>
              
              <!-- Alternative Link -->
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #7f8c8d; margin: 0 0 10px 0; font-size: 14px;">
                  <strong>Ou copie e cole este link no seu navegador:</strong>
                </p>
                <p style="word-break: break-all; color: #667eea; margin: 0; font-size: 14px;">
                  ${resetUrl}
                </p>
              </div>
              
              <!-- Security Info -->
              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  <strong>⚠️ Importante:</strong> Este link expira em <strong>1 hora</strong> por motivos de segurança.
                </p>
              </div>
              
              <p style="color: #7f8c8d; line-height: 1.6; margin-top: 20px;">
                Se você não solicitou esta redefinição, ignore este email. Sua senha permanecerá inalterada.
              </p>
            </div>
            
            <!-- Footer -->
            <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 30px 0;">
            <div style="text-align: center;">
              <p style="color: #95a5a6; font-size: 12px; margin: 0;">
                Este é um email automático, não responda a esta mensagem.
              </p>
              <p style="color: #95a5a6; font-size: 12px; margin: 5px 0 0 0;">
                © 2024 Sistema ENEM - Plataforma de Estudos
              </p>
            </div>
          </div>
        </div>
      `
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email de reset enviado com sucesso:', info.messageId);
      return { sucesso: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Erro ao enviar email:', error);
      return { sucesso: false, erro: error.message };
    }
  }

  // Método para testar a conexão com Mailtrap
  async testarConexao() {
    try {
      await this.transporter.verify();
      console.log('✅ Conexão com Mailtrap estabelecida com sucesso!');
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar com Mailtrap:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
