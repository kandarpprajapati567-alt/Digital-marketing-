// api/chat.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    // Ensure only POST requests are processed
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST method is allowed' });
    }

    const { message } = req.body;

    try {
        // Initialize the Gemini AI client
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        
        // COMBINED PROMPT: We mix the system instructions with the user's message here.
        // This ensures compatibility with older SDK versions that don't support 'systemInstruction'.
        const combinedPrompt = `
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
        
        User's Message: "${message}"
        `;

        // Array of models to try
        const availableModels = ["gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro"];
        let aiReply = "";
        let success = false;
        let lastErrorMessage = "";

        // Loop through models until one succeeds
        for (let i = 0; i < availableModels.length; i++) {
            try {
                // Notice we removed the systemInstruction parameter here
                const model = genAI.getGenerativeModel({ model: availableModels[i] });
                
                // We pass the combinedPrompt directly into generateContent
                const result = await model.generateContent(combinedPrompt);
                aiReply = result.response.text();
                success = true;
                break; // Exit the loop if successful
            } catch (err) {
                // Capture the exact error message for debugging
                lastErrorMessage = err.message;
                console.warn(`Model ${availableModels[i]} failed: ${err.message}`);
            }
        }

        // If all models fail, return the exact error message so we know how to fix it
        if (!success) {
            console.error("All models failed. Last Error:", lastErrorMessage);
            return res.status(500).json({ reply: `API Error: ${lastErrorMessage}` });
        }

        // Email Trigger Logic for closed deals
        if (aiReply.includes('[DEAL_CLOSED]')) {
            // Remove the secret code so the user doesn't see it
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
                text: `Congratulations! The AI successfully closed a deal.\n\nClient message: "${message}"\n\nPlease follow up!`
            };

            transporter.sendMail(mailOptions).catch(console.error);
        }

        // Send the AI's response back to the frontend
        return res.status(200).json({ reply: aiReply });

    } catch (error) {
        console.error("Critical Server Error:", error);
        return res.status(500).json({ reply: "System technical issue. Please try again." });
    }
}
