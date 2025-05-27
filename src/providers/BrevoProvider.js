const brevo = require('@getbrevo/brevo')
import { env } from '~/config/environment'

let apiInstance = new brevo.TransactionalEmailsApi()

let apiKey = apiInstance.authentications['apiKey']
apiKey.apiKey = env.BREVO_API_KEY

const sendEmail = async (recipientEmail, customSubject, customHtmlContent) => {
  // Khởi tạo một cái sendSmtpEmail với những thông tin cần thiết
  let sendSmtpEmail = new brevo.SendSmtpEmail()

  //Tài khoản gửi mail
  sendSmtpEmail.sender = {
    email: env.ADMIN_EMAIL_ADDRESS,
    name: env.ADMIN_EMAIL_NAME
  }
  //Những tài khoản nhận mail
  sendSmtpEmail.to = [{ email: recipientEmail }]

  //Tiêu đề email
  sendSmtpEmail.subject = customSubject

  //Nội dung email
  sendSmtpEmail.htmlContent = customHtmlContent

  //Gọi hành động gửi mail
  return apiInstance.sendTransacEmail(sendSmtpEmail)
}

export const BrevoProvider = {
  sendEmail
}
