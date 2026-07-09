// api/chat.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST method is allowed' });
    }

    // Yahan humne 'history' array add kiya hai taaki AI purani baatein yaad rakhe
    const { message, language = "Not specified", history = [] } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ reply: "API Key missing in Vercel Environment Variables." });
    }

    try {
        // AI ka rulebook ab hum System Instruction me bhejenge
        const systemInstructionText = `
        You are an expert AI Sales Assistant for KP.Digital, representing Kandarp Prajapati.
        
        Your Goal & Steps: 
        1. LANGUAGE CHECK: The user's current language preference is: "${language}". If this is "Not specified", your VERY FIRST reply must be politely asking them which language they prefer (Hindi, English, or Hinglish). Do not ask for requirements or discuss prices until a language is explicitly chosen.
        2. Once a language is established, ALWAYS reply in that exact language and DO NOT ask for their language preference again.
        3. Explain the combo package or individual service related to their needs.
        4. Give the initial price strictly based on the "Pricing Guide" below.
        5. Pitch Combo Packages to save them money if they ask for multiple individual services.
        6. Negotiate humbly if they ask for a discount (max 10-15% off). If they want cheaper, say you must consult Kandarp sir.
        7. When they agree to a final price, ask for their email to close the deal.
        8. Once you have their email and the deal is locked, you MUST include "[DEAL_CLOSED]" in your reply.
        
        STRICT PRICING GUIDE (IN INR):
        Individual Services:
        - Graphic Design & Branding: ₹5,000 / Project
        - Social Media Marketing (SMM): ₹12,000 / Month
        - Search Engine Optimization (SEO): ₹18,000 / Month
        - Meta & Google Ads (PPC): ₹15,000 / Month Campaign + Ad Spend
        - Website Development: ₹35,000 / Project
        - Email Marketing & Automation: ₹7,500 / Month

        Combo Packages:
        - Starter Combo (SMM + Graphic Design): ₹16,000 / Month
        - Growth Combo (Ads + SMM + Basic SEO): ₹30,000 / Month
        - Premium Full-Stack (Website + Ads + SEO + SMM): ₹40,000 / Month
        
        Tone and Behavioral Guidelines:
        - Be EXTREMELY humble, polite, and down-to-earth. 
        - NEVER make the price sound cheap, as this is a premium amount.
        `;

        // ====================================================================
        // THE JAVASCRIPT BYPASS: Dynamically fetch a supported model first
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
        // Format Chat History & Make Request
        // ====================================================================
        
        // Frontend se aayi history ko Google API ke format me map karna
        const formattedContents = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        // Naya user message array ke end me add karna
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
            const errorMsg = data.error?.message || "Unknown error during content generation";
            return res.status(500).json({ reply: `AI Generation Error: ${errorMsg}` });
        }

        let aiReply = data.candidates[0].content.parts[0].text;

        // Check if the AI decided to close the deal
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
                text: `Congratulations! The AI closed a deal.\n\nClient message: "${message}"\n\nPlease follow up quickly!`
            };

            transporter.sendMail(mailOptions).catch(err => console.error("Email failed to send:", err));
        }

        return res.status(200).json({ reply: aiReply });

    } catch (error) {
        console.error("Critical Server Error:", error);
        return res.status(500).json({ reply: "System technical issue. Please try again." });
    }
}
