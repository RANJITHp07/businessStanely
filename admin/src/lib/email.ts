import nodemailer from "nodemailer";

export const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

interface SendOTPEmailProps {
  to: string;
  otp: string;
  userName?: string;
}

interface SendWelcomeEmailProps {
  to: string;
  userName: string;
}

interface SendAdminInviteEmailProps {
  to: string;
  userName: string;
  password: string;
}

interface SendAgentInviteEmailProps {
  to: string;
  userName: string;
  password: string;
}

export async function sendOTPEmail({ to, otp, userName }: SendOTPEmailProps) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || "Legal Stanley"}" <${
        process.env.EMAIL_USER
      }>`,
      to: to,
      subject: "Password Reset OTP - Business Management System",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset OTP</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Password Reset Request</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              ${userName ? `Hello ${userName},` : "Hello,"}
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              We received a request to reset your password for your Business Management System account. 
              Please use the following OTP (One-Time Password) to reset your password:
            </p>
            
            <div style="background: #fff; border: 2px dashed #667eea; border-radius: 8px; padding: 25px; text-align: center; margin: 25px 0;">
              <h2 style="color: #667eea; font-size: 36px; margin: 0; letter-spacing: 8px; font-weight: bold;">
                ${otp}
              </h2>
              <p style="color: #6c757d; font-size: 14px; margin: 10px 0 0 0;">
                This OTP is valid for 10 minutes
              </p>
            </div>
            
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #856404; margin: 0; font-size: 14px;">
                <strong>⚠️ Security Alert:</strong> If you didn't request this password reset, please ignore this email and consider changing your password as a precaution.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
              This is an automated email. Please do not reply to this message.
            </p>
            
            <p style="font-size: 16px; margin-top: 20px;">
              Best regards,<br>
              <strong>Legal Stanley Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
            <p style="margin: 0;">
              © ${new Date().getFullYear()} Legal Stanley. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Legal Stanley - Password Reset OTP
        
        ${userName ? `Hello ${userName},` : "Hello,"}
        
        We received a request to reset your password for your Business Management System account.
        
        Your OTP: ${otp}
        
        This OTP is valid for 10 minutes.
        
        If you didn't request this password reset, please ignore this email and consider changing your password as a precaution.
        
        Best regards,
        Legal Stanley Team
        
        © ${new Date().getFullYear()} Legal Stanley. All rights reserved.
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("OTP email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendWelcomeEmail({
  to,
  userName,
}: SendWelcomeEmailProps) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || "Legal Stanley"}" <${
        process.env.EMAIL_USER
      }>`,
      to: to,
      subject: "Welcome to Legal Stanley!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Legal Stanley</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Legal Stanley!</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 18px; margin-bottom: 20px; color: #007bff;">
              Hello ${userName}! 🎉
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Thank you for joining Legal Stanley! We're excited to have you on board and can't wait to help you streamline your business operations.
            </p>
            
            <div style="background: #e7f3ff; border-radius: 8px; padding: 25px; margin: 25px 0;">
              <h3 style="color: #007bff; margin-top: 0; font-size: 20px;">🚀 What's Next?</h3>
              <ul style="color: #666; line-height: 1.8; padding-left: 20px; margin: 0;">
                <li>Complete your profile setup</li>
                <li>Explore our intuitive dashboard</li>
                <li>Connect with your team members</li>
                <li>Start managing your business tasks efficiently</li>
                <li>Discover our powerful automation tools</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL}/dashboard" 
                 style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; transition: background-color 0.3s;">
                🏁 Get Started Now
              </a>
            </div>
            
            <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #155724; margin: 0; font-size: 14px;">
                <strong>💡 Pro Tip:</strong> Bookmark your dashboard for quick access to all your business tools!
              </p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 15px;">
              If you have any questions or need assistance getting started, our support team is here to help. Simply reply to this email or contact us through the help center.
            </p>
            
            <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
              This is an automated welcome email. You can unsubscribe from marketing emails in your account settings.
            </p>
            
            <p style="font-size: 16px; margin-top: 25px;">
              Welcome aboard!<br>
              <strong>The Legal Stanley Team</strong>
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
            <p style="margin: 0;">
              © ${new Date().getFullYear()} Legal Stanley. All rights reserved.
            </p>
            <p style="margin: 5px 0 0 0;">
              Follow us on social media for updates and tips!
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Legal Stanley!
        
        Hello ${userName}!
        
        Thank you for joining Legal Stanley! We're excited to have you on board and can't wait to help you streamline your business operations.
        
        What's Next?
        - Complete your profile setup
        - Explore our intuitive dashboard
        - Connect with your team members
        - Start managing your business tasks efficiently
        - Discover our powerful automation tools
        
        Get started now: ${process.env.NEXTAUTH_URL}/dashboard
        
        Pro Tip: Bookmark your dashboard for quick access to all your business tools!
        
        If you have any questions or need assistance getting started, our support team is here to help. Simply reply to this email or contact us through the help center.
        
        Welcome aboard!
        The Legal Stanley Team
        
        © ${new Date().getFullYear()} Legal Stanley. All rights reserved.
        Follow us on social media for updates and tips!
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("Welcome email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendAdminInviteEmail({
  to,
  userName,
  password,
}: SendAdminInviteEmailProps) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || "Legal Stanley"}" <${
        process.env.EMAIL_USER
      }>`,
      to: to,
      subject: "Welcome to Legal Stanley - Admin Account Created",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Legal Stanley</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Legal Stanley</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hello ${userName},
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your admin account has been created in the Legal Stanley management system. Here are your login credentials:
            </p>

            <div style="background: #ffffff; padding: 20px; border-radius: 5px; border: 1px solid #dee2e6; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>Email:</strong> ${to}</p>
              <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
            </div>

            <p style="font-size: 16px; margin-bottom: 20px;">
              Please login using your email and the password above. For security purposes, change your password immediately after logging in.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${
                process.env.NEXTAUTH_URL
              }/login" style="background: #4c51bf; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Login Now
              </a>
            </div>

            <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
              For security reasons, please change your password immediately after logging in.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
            <p style="margin: 0;">
              © ${new Date().getFullYear()} Legal Stanley. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Legal Stanley!
        
        Hello ${userName}!
        
        Your admin account has been created in the Legal Stanley management system. Here are your login credentials:
        
        Email: ${to}
        Password: ${password}
        
        Please login using your email and the password above. For security purposes, change your password immediately after logging in.
        
        Login now: ${process.env.NEXTAUTH_URL}/login
        
        For security reasons, please change your password immediately after logging in.
        
        Best regards,
        The Legal Stanley Team
        
        © ${new Date().getFullYear()} Legal Stanley. All rights reserved.
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("Admin invite email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending admin invite email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendAgentInviteEmail({
  to,
  userName,
  password,
}: SendAgentInviteEmailProps) {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME || "Legal Stanley"}" <${
        process.env.EMAIL_USER
      }>`,
      to: to,
      subject: "Welcome to Legal Stanley - Agent Account Created",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Legal Stanley</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Legal Stanley</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hello ${userName},
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Your agent account has been created in the Legal Stanley management system. Here are your login credentials:
            </p>

            <div style="background: #ffffff; padding: 20px; border-radius: 5px; border: 1px solid #dee2e6; margin-bottom: 20px;">
              <p style="margin: 5px 0;"><strong>Email:</strong> ${to}</p>
              <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
            </div>

            <p style="font-size: 16px; margin-bottom: 20px;">
              Please login to your agent portal using your email and the password above. For security purposes, we recommend changing your password after logging in.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${
                process.env.AGENT_PORTAL_URL || "http://localhost:3000"
              }/login" style="background: #4c51bf; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                Login to Agent Portal
              </a>
            </div>

            <p style="font-size: 14px; color: #6c757d; margin-top: 30px;">
              For security reasons, please change your password after logging in for the first time.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #6c757d; font-size: 12px;">
            <p style="margin: 0;">
              © ${new Date().getFullYear()} Legal Stanley. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to Legal Stanley!
        
        Hello ${userName}!
        
        Your agent account has been created in the Legal Stanley management system. Here are your login credentials:
        
        Email: ${to}
        Password: ${password}
        
        Please login to your agent portal using your email and the password above. For security purposes, we recommend changing your password after logging in.
        
        Login now: ${process.env.AGENT_PORTAL_URL || "http://localhost:3000"}/login
        
        For security reasons, please change your password after logging in for the first time.
        
        Best regards,
        The Legal Stanley Team
        
        © ${new Date().getFullYear()} Legal Stanley. All rights reserved.
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log("Agent invite email sent successfully:", result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error("Error sending agent invite email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}