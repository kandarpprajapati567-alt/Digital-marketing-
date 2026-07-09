// api/chat.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST method is allowed' });
    }

    // History is very important here
    const { message, history = [] } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ reply: "API Key missing in Vercel." });
    }

    try {
        // SUPER STRICT PROMPT: AI ko bhoolne nahi dega
        const systemInstructionText = `
        You are an expert AI Sales Assistant for KP.Digital, representing Kandarp Prajapati.
        
        CRITICAL RULE (DO NOT REPEAT YOURSELF):
        1. Check the chat history. If the user has ALREADY selected a language (e.g., they said "Hindi" or "English"), DO NOT ask for their language preference again.
        2. If they just selected their requirements (like SEO, Ads, etc.), immediately provide the exact prices or a Combo Package based on the guide below.
        3. If this is the VERY FIRST message and no language is selected, only then ask: "Aap kis bhasha mein baat karna pasand karenge? (Hindi, English, or Hinglish)".
        
        STRICT PRICING GUIDE (IN INR):
        Individual Services:
        - Graphic Design & Branding: ₹5,000 / Project
        - Social Media Marketing (SMM): ₹12,000 / Month
        - Search Engine Optimization (SEO): ₹18,000 / Month
        - Meta & Google Ads (PPC): ₹15,000 / Month Campaign + Ad Spend
        - Website Development: ₹35,000 / Project
        - Email Marketing & Automation: ₹7,500 / Month

        Combo Packages (Pitch these to save them money):
        - Starter Combo (SMM + Graphic Design): ₹16,000 / Month
        - Growth Combo (Ads + SMM + Basic SEO): ₹30,000 / Month
        - Premium Full-Stack (Website + Ads + SEO + SMM): ₹40,000 / Month
        
        NEGOTIATION & CLOSING:
        - Be EXTREMELY humble, polite, and down-to-earth. Do NOT make the price sound cheap.
        - Negotiate humbly (max 10-15% off). If they want it cheaper, say you need to consult Kandarp sir.
        - When they agree to a final price, ask for their email to close the deal.
        - Once you have their email and the deal is locked, you MUST include "[DEAL_CLOSED]" in your reply.
        `;

        // ====================================================================
        // BYPASS & MODEL FETCHING
        // ====================================================================
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listResponse = await fetch(listUrl);
        const listData = await listResponse.json();

        if (!listResponse.ok) {
            return res.status(500).json({ reply: `API Authentication Error: ${listData.error?.message}` });
        }

        const validModel = listData.models.find(model => 
            model.supportedGenerationMethods && 
            model.supportedGenerationMethods.includes("generateContent") &&
            model.name.includes("gemini")
        );

        if (!validModel) {
            return res.status(500).json({ reply: "API Error: No supported Gemini models found." });
        }

        const targetModelName = validModel.name;

        // ====================================================================
        // FORMAT CHAT HISTORY
        // ====================================================================
        const formattedContents = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        formattedContents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${targetModelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstructionText }] },
                contents: formattedContents
            })
        });

        const data = await response.json();

        if (!response.ok || !data.candidates || data.candidates.length === 0) {
            return res.status(500).json({ reply: `AI Generation Error: ${data.error?.message || "Unknown error"}` });
        }

        let aiReply = data.candidates[0].content.parts[0].text;

        // Deal close email logic
        if (aiReply.includes('[DEAL_CLOSED]')) {
            aiReply = aiReply.replace('[DEAL_CLOSED]', '').trim();

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: 'Kandarprajapati567@gmail.com',
                subject: '🚀 New Digital Marketing Deal Closed by AI!',
                text: `Congratulations! The AI closed a deal.\n\nClient message: "${message}"\n\nPlease follow up quickly!`
            };

            transporter.sendMail(mailOptions).catch(err => console.error("Email failed:", err));
        }

        return res.status(200).json({ reply: aiReply });

    } catch (error) {
        console.error("Critical Server Error:", error);
        return res.status(500).json({ reply: "System technical issue. Please try again." });
    }
}
