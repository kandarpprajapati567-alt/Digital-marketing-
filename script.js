const chatToggle = document.getElementById('chatToggle');
const chatContainer = document.getElementById('chatContainer');
const sendMessage = document.getElementById('sendMessage');
const userInput = document.getElementById('userInput');
const chatBox = document.getElementById('chatBox');

// Touch/Click to Open and Close Logic
chatToggle.addEventListener('click', () => {
    // Agar chat container hidden hai, toh usko display karo
    if (chatContainer.style.display === 'none' || chatContainer.style.display === '') {
        chatContainer.style.display = 'flex';
        chatToggle.textContent = '❌ Close Chat'; // Button ka text change kar diya
    } 
    // Agar pehle se open hai, toh usko close (hide) karo
    else {
        chatContainer.style.display = 'none';
        chatToggle.textContent = '💬 Chat with AI'; // Button ka text wapas normal kar diya
    }
});

// Basic send message functionality
sendMessage.addEventListener('click', () => {
    if (userInput.value.trim() !== '') {
        chatBox.innerHTML += `<p style="background-color: var(--accent-color); color: var(--bg-color); padding: 8px; border-radius: 5px; margin-bottom: 10px; font-size: 0.9rem; text-align: right;">${userInput.value}</p>`;
        userInput.value = '';
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});
