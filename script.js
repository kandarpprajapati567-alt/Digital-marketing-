document.addEventListener("DOMContentLoaded", () => {
    // --- 1. Settings & Theme Logic ---
    const settingsBtn = document.getElementById('open-settings');
    const settingsModal = document.getElementById('settings-overlay');
    const closeSettingsBtn = document.getElementById('close-settings');
    const themeSelector = document.getElementById('theme-selector');
    const aiLangSelector = document.getElementById('global-ai-lang');

    // Load saved preferences from LocalStorage
    const currentTheme = localStorage.getItem('theme') || 'dark';
    const currentLang = localStorage.getItem('aiLang') || 'English';

    if (currentTheme === 'light') {
        document.body.classList.add('light-mode');
        themeSelector.value = 'light';
    }
    aiLangSelector.value = currentLang;

    // Open/Close Modal
    settingsBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
    closeSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');

    // Change Theme
    themeSelector.addEventListener('change', (e) => {
        if (e.target.value === 'light') {
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
        }
    });

    // Change Global AI Language
    aiLangSelector.addEventListener('change', (e) => {
        localStorage.setItem('aiLang', e.target.value);
    });

    // --- 2. Chatbot UI Logic (Only run if chatbox exists on page) ---
    const chatToggle = document.getElementById('chat-toggle');
    if (chatToggle) {
        const chatBox = document.getElementById('chat-box');
        const chatMessages = document.getElementById('chat-messages');
        const inputArea = document.getElementById('chat-input-area');
        const userInput = document.getElementById('user-input');
        const sendBtn = document.getElementById('send-btn');
        const submitServicesBtn = document.getElementById('submit-services-btn');
        const reqOptionsDiv = document.getElementById('requirement-options');

        chatToggle.addEventListener('click', () => {
            chatBox.style.display = chatBox.style.display === 'flex' ? 'none' : 'flex';
            chatToggle.innerText = chatBox.style.display === 'flex' ? 'Close Assistant' : 'Open AI Assistant';
        });

        function addMessage(text, sender) {
            const msgDiv = document.createElement('div');
            msgDiv.classList.add('msg', sender === 'user' ? 'user-msg' : 'bot-msg');
            msgDiv.innerText = text;
            chatMessages.appendChild(msgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight; 
        }

        async function sendMessageToAI(text) {
            addMessage(text, 'user');
            userInput.value = '';

            // Get language directly from localStorage now!
            const selectedLanguage = localStorage.getItem('aiLang') || 'English';

            const typingId = 'typing-' + Date.now();
            const msgDiv = document.createElement('div');
            msgDiv.classList.add('msg', 'bot-msg');
            msgDiv.id = typingId;
            msgDiv.innerText = 'Typing...';
            chatMessages.appendChild(msgDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text, language: selectedLanguage })
                });
                
                const data = await response.json();
                document.getElementById(typingId).remove();
                addMessage(data.reply || "Error connecting to AI.", 'bot');
            } catch (error) {
                document.getElementById(typingId).remove();
                addMessage("Connection error. Please try again later.", 'bot');
            }
        }

        submitServicesBtn.addEventListener('click', () => {
            const selectedBoxes = document.querySelectorAll('.req-label input:checked');
            let selectedServices = Array.from(selectedBoxes).map(box => box.value);

            if (selectedServices.length === 0) {
                alert("Please select at least one service before submitting.");
                return;
            }

            const finalRequirementText = "I want these services: " + selectedServices.join(", ");
            reqOptionsDiv.style.display = 'none'; 
            inputArea.style.display = 'flex'; 
            sendMessageToAI(finalRequirementText);
        });

        sendBtn.addEventListener('click', () => {
            if (userInput.value.trim()) sendMessageToAI(userInput.value.trim());
        });
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && userInput.value.trim()) sendMessageToAI(userInput.value.trim());
        });
    }
});
