// api/chat.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST method is allowed' });
    }

    const { message } = req.body;

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        const systemPrompt = `
        You are an expert AI Sales Assistant for KP.Digital.
        The user just selected a requirement or is trying to negotiate.
        
        Your Goal: 
        1. Explain the combo package related to their message.
        2. Give the initial price.
        3. Negotiate if they ask for a discount (max 15% off).
        4. When they agree to a final price, ask for their email to close the deal.
        5. Once you have their email and the deal is locked, you MUST include "[DEAL_CLOSED]" in your reply.
        
        Pricing Guide:
        - Social Media Mgt: $300/month
        - SEO & Web Dev: $800 one-time
        - Full Package: $1200
        `;

        // DYNAMIC MODEL SELECTOR (JavaScript Inbuilt array iteration & Try/Catch)
        // Yeh error aane par crash nahi hone dega, active model automatically dhoondhega
        const availableModels = ["gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro"];
        let aiReply = "";
        let success = false;

        for (let i = 0; i < availableModels.length; i++) {
            try {
                const model = genAI.getGenerativeModel({
                    model: availableModels[i],
                    systemInstruction: systemPrompt,
                });
                
                const result = await model.generateContent(message);
                aiReply = result.response.text();
                success = true;
                break; // Agar response mil gaya, toh loop se baahar aa jao
            } catch (err) {
                console.warn(`Model ${availableModels[i]} failed, trying next...`);
                // Error ignore karega aur array ka agla model try karega
            }
        }

        if (!success) {
            return res.status(500).json({ reply: "Sorry, all AI models are currently down. Please contact directly via email." });
        }

        // Email Trigger Logic
        if (aiReply.includes('[DEAL_CLOSED]')) {
            aiReply = aiReply.replace('[DEAL_CLOSED]', '').trim();

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: 'Kandarprajapati567@gmail.com',
                subject: '🚀 New Digital Marketing Deal Closed by AI!',
                text: `Badhai ho! AI ne ek client ke sath deal close ki hai.\n\nClient message: "${message}"\n\nPlease jaldi se follow up karein!`
            };

            transporter.sendMail(mailOptions).catch(console.error);
        }

        return res.status(200).json({ reply: aiReply });

    } catch (error) {
        console.error("Critical Server Error:", error);
        return res.status(500).json({ reply: "System technical issue. Please try again." });
    }
}
