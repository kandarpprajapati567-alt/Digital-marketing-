// api/chat.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    // Only allow POST requests from the chat interface
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST method is allowed' });
    }

    // Extract message and the newly added language parameter (default to English)
    const { message, language = "English" } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // Check if the API key is successfully loaded from Vercel
    if (!apiKey) {
        return res.status(500).json({ reply: "API Key missing in Vercel Environment Variables." });
    }

    try {
        // Updated Prompt: Added Tone Guidelines and Language Support
        const combinedPrompt = `
        You are an expert AI Sales Assistant for KP.Digital.
        The user just selected a requirement or is trying to negotiate.
        
        Your Goal: 
        1. Explain the combo package related to their message.
        2. Give the initial price.
        3. Negotiate humbly if they ask for a discount (max 15% off).
        4. When they agree to a final price, ask for their email to close the deal.
        5. Once you have their email and the deal is locked, you MUST include "[DEAL_CLOSED]" in your reply.
        
        Pricing Guide:
        - Social Media Mgt: $300/month
        - SEO & Web Dev: $800 one-time
        - Full Package: $1200
        
        Tone and Behavioral Guidelines:
        - Be EXTREMELY humble, polite, and down-to-earth. 
        - Do NOT act arrogant or overly formal. 
        - NEVER say "just $1200" or make the price sound cheap, as this is a premium amount.
        - Empathize with the user if they find it expensive and smoothly offer the negotiation discount.
        
        Language Instruction:
        - You MUST reply to the user entirely in the following language: ${language}.
        
        User's Message: "${message}"
        `;

        // ====================================================================
        // THE JAVASCRIPT BYPASS: Dynamically fetch a supported model first
        // ====================================================================
        
        // 1. Fetch available models from Google
        const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const listResponse = await fetch(listUrl);
        const listData = await listResponse.json();

        if (!listResponse.ok) {
            console.error("Model fetch failed:", listData.error?.message);
            return res.status(500).json({ reply: `API Authentication Error: ${listData.error?.message}` });
        }

        // 2. Find the first model that explicitly supports 'generateContent'
        const validModel = listData.models.find(model => 
            model.supportedGenerationMethods && 
            model.supportedGenerationMethods.includes("generateContent") &&
            model.name.includes("gemini") // Ensure we are picking a Gemini model
        );

        if (!validModel) {
            console.error("No compatible models found in the API response.");
            return res.status(500).json({ reply: "API Error: No supported Gemini models found for this API key." });
        }

        const targetModelName = validModel.name;
        console.log(`Bypass successful! Dynamically selected model: ${targetModelName}`);

        // ====================================================================
        // 3. Make the actual request using the dynamically found model
        // ====================================================================
        const generateUrl = `https://generativelanguage.googleapis.com/v1beta/${targetModelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: combinedPrompt }] }]
            })
        });

        const data = await response.json();

        // 4. Handle API processing
        if (!response.ok || !data.candidates || data.candidates.length === 0) {
            const errorMsg = data.error?.message || "Unknown error during content generation";
            console.error("Content generation failed:", errorMsg);
            return res.status(500).json({ reply: `AI Generation Error: ${errorMsg}` });
        }

        let aiReply = data.candidates[0].content.parts[0].text;

        // Check if the AI decided to close the deal
        if (aiReply.includes('[DEAL_CLOSED]')) {
            // Remove the secret tag from the user's view
            aiReply = aiReply.replace('[DEAL_CLOSED]', '').trim();

            // Setup Nodemailer to send you an alert
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

            // Send the email in the background
            transporter.sendMail(mailOptions).catch(err => console.error("Email failed to send:", err));
        }

        // Send the AI's response back to the user
        return res.status(200).json({ reply: aiReply });

    } catch (error) {
        console.error("Critical Server Error:", error);
        return res.status(500).json({ reply: "System technical issue. Please try again." });
    }
}
