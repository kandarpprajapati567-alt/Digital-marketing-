// api/chat.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    // Sirf POST requests allow karenge
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST method is allowed' });
    }

    const { message } = req.body;

    try {
        // 1. Gemini AI Setup
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // System Instructions: Yahan aap apne packages aur rules define kar sakte hain
        const systemPrompt = `
        You are an expert AI Sales Assistant for KP.Digital (Kandarp Prajapati).
        Your goal is to understand the client's needs, suggest combo packages, and negotiate to close the deal.
        
        Packages:
        1. Social Media Combo (Instagram + FB Management) - $300/month
        2. SEO + Web Dev Combo (Website + Ranking) - $800 one-time
        3. Full Digital Dominance (Web + SEO + Social Media) - $1200
        
        Rules for Negotiation:
        - Be professional, polite, and persuasive.
        - You can offer up to a 15% discount if the client asks for a lower price or hesitates.
        - NEVER go below the 15% discount limit.
        - If the client agrees to the final price and is ready to start, ask for their email address (if not provided).
        - ONCE the deal is completely finalized and you have their email, you MUST include the exact text "[DEAL_CLOSED]" anywhere in your final response.
        `;

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction: systemPrompt,
        });

        // 2. AI se response generate karwana
        const result = await model.generateContent(message);
        let aiReply = result.response.text();

        // 3. Email Trigger Check
        if (aiReply.includes('[DEAL_CLOSED]')) {
            // Secret code ko client ke message se hata do
            aiReply = aiReply.replace('[DEAL_CLOSED]', '').trim();

            // Aapko email bhejne ka logic
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER, // Aapka Gmail address
                    pass: process.env.EMAIL_PASS  // Aapka Gmail App Password
                }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: 'Kandarprajapati567@gmail.com', // Aapka email jahan alert aayega
                subject: '🚀 New Client Deal Closed by AI!',
                text: `Badhai ho! AI ne ek client ke sath deal close ki hai.\n\nClient ka aakhiri message: "${message}"\n\nJaldi se check karein!`
            };

            // Email bhej do (background mein)
            transporter.sendMail(mailOptions).catch(console.error);
        }

        // Client ko final reply bhej do
        return res.status(200).json({ reply: aiReply });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ reply: "Sorry, I am facing a technical issue right now. Please try again." });
    }
}

