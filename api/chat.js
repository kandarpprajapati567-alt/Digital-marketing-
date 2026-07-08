// api/chat.js
import nodemailer from 'nodemailer';
// Dekhiye, humne yahan Google package import hata diya hai!

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST method is allowed' });
    }

    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ reply: "API Key missing in Vercel Environment Variables." });
    }

    try {
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

        // INBUILT JAVASCRIPT FETCH API
        // Direct REST API call without any NPM package
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: combinedPrompt }]
                }]
            })
        });

        const data = await response.json();

        // Error handling from the raw API
        if (!response.ok) {
            console.error("Inbuilt Fetch Error:", data);
            return res.status(500).json({ reply: `API Error: ${data.error?.message || "Unknown API issue"}` });
        }

        // Parsing the response text exactly as the API returns it
        let aiReply = data.candidates[0].content.parts[0].text;

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
