// api/chat.js
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
    // Only allow POST requests from the chat interface
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Only POST method is allowed' });
    }

    const { message } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // Check if the API key is successfully loaded from Vercel
    if (!apiKey) {
        return res.status(500).json({ reply: "API Key missing in Vercel Environment Variables." });
    }

    try {
        // The combined prompt containing rules and user message
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

        // List of models to try. We include '-latest' to handle strict 404 errors.
        const availableModels = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-pro"];
        let aiReply = "";
        let success = false;
        let lastErrorMessage = "";

        // Fallback Loop: Try models one by one using the native fetch API
        for (let modelName of availableModels) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: combinedPrompt }] }]
                    })
                });

                const data = await response.json();

                // If the response is good, extract the text and stop the loop
                if (response.ok && data.candidates && data.candidates.length > 0) {
                    aiReply = data.candidates[0].content.parts[0].text;
                    success = true;
                    break; 
                } else {
                    // Log the error but allow the loop to continue to the next model
                    lastErrorMessage = data.error?.message || "Unknown API error";
                    console.warn(`Model ${modelName} failed: ${lastErrorMessage}`);
                }
            } catch (err) {
                lastErrorMessage = err.message;
                console.warn(`Fetch request failed for ${modelName}: ${err.message}`);
            }
        }

        // If all models in the array failed, send the error to the chat UI
        if (!success) {
            console.error("All models failed. Last Error:", lastErrorMessage);
            return res.status(500).json({ reply: `API Error: ${lastErrorMessage}` });
        }

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
            transporter.sendMail(mailOptions).catch(console.error);
        }

        // Send the AI's response back to the user
        return res.status(200).json({ reply: aiReply });

    } catch (error) {
        console.error("Critical Server Error:", error);
        return res.status(500).json({ reply: "System technical issue. Please try again." });
    }
}
