class DialogueManager {
    constructor() {
        this.isActive = false;
        this.sessionId = `session-${Date.now()}`;
        this.LAMBDA_URL = 'https://hutcbbitwm5yzzth6lgbeamzuq0eaxjj.lambda-url.us-west-2.on.aws/';
        this.storyStarted = false;
        this.TIMEOUT = 60000;
        this.MAX_RETRIES = 2;
        this.currentEventType = null;
        this.currentCharacter = null;

        // Add interaction tracking
        this.interactions = new Map();
        
        // Add follow-up responses
        this.followupResponses = [
            "The creature appears to be sleeping soundly.",
            "The creature seems busy with something else.",
            "The creature ignores your presence.",
            "The creature nods at you in acknowledgment."
        ];
        
        // Initialize events
        this.events = {
            riddle: [
                { question: "I speak without a mouth and hear without ears. I have no body, but come alive with wind. What am I?", answer: "An echo" },
                { question: "The more you take, the more you leave behind. What am I?", answer: "Footsteps" },
                { question: "What has keys, but no locks; space, but no room; you can enter, but not go in?", answer: "A keyboard" }
            ],
            mission: [
                { task: "Find the ancient scroll in the Crystal Caves", reward: "Magic Ring" },
                { task: "Deliver this message to the Wise One in the Mountain Pass", reward: "50 gold" },
                { task: "Collect 3 mystical herbs from the Mystic Forest", reward: "Healing Potion" }
            ],
            joke: [
                "Why don't mummies have friends? Because they're all wrapped up in themselves!",
                "What do you call a bear with no teeth? A gummy bear!",
                "Why did the scarecrow win an award? Because he was outstanding in his field!"
            ],
            smallTalk: [
                "The weather in the forest has been quite magical lately.",
                "Have you heard about the dragon sightings in the mountains?",
                "The crystal caves are especially bright during the full moon."
            ],
            gift: [
                { item: "Health Potion", description: "A mysterious stranger hands you a small vial of red liquid." },
                { item: "Lucky Coin", description: "You find a gleaming golden coin on the ground." },
                { item: "Magic Map", description: "An old scroll falls from a nearby tree." }
            ],
            clue: [
                "The ancient texts speak of a hidden passage beneath the mountain pass.",
                "Beware the third tree in the mystic forest, for it guards a secret.",
                "When the moons align, the crystal caves reveal their treasures."
            ]
        };

        this.initialize();
        this.loadIconsData();
    }

    async loadIconsData() {
        try {
            const response = await fetch('https://nepal-web.s3.us-west-2.amazonaws.com/games/adventure2/game-icons.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.iconsData = data;
            console.log('Icons loaded in DialogueManager:', this.iconsData);
        } catch (error) {
            console.error('Error loading icons in DialogueManager:', error);
        }
    }

    initialize() {
        if (!document.getElementById('dialoguePane')) {
            const dialoguePane = document.createElement('div');
            dialoguePane.id = 'dialoguePane';
            dialoguePane.style.cssText = `
                background: #222;
                padding: 20px;
                border-radius: 8px;
                flex: 1 1 100%;
                margin-top: 20px;
                order: 3;
                min-height: 300px;
                display: flex;
                flex-direction: column;
            `;

            const conversationContainer = document.createElement('div');
            conversationContainer.id = 'dialogueConversation';
            conversationContainer.style.cssText = `
                flex: 1;
                overflow-y: auto;
                margin-bottom: 15px;
                padding: 10px;
                background: #333;
                border-radius: 4px;
                min-height: 200px;
            `;

            const imageContainer = document.createElement('div');
            imageContainer.id = 'dialogueImage';
            imageContainer.style.cssText = `
                width: 100%;
                height: 200px;
                margin-bottom: 15px;
                background: #333;
                border-radius: 4px;
                display: none;
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
            `;

            const inputContainer = document.createElement('div');
            inputContainer.style.cssText = `
                display: flex;
                gap: 8px;
            `;

            const input = document.createElement('input');
            input.id = 'dialogueInput';
            input.type = 'text';
            input.placeholder = 'Type your response...';
            input.style.cssText = `
                flex: 1;
                padding: 8px;
                border: 1px solid #666;
                border-radius: 4px;
                background: #333;
                color: #fff;
                font-family: monospace;
            `;

            const submitButton = document.createElement('button');
            submitButton.id = 'dialogueSubmit';
            submitButton.textContent = 'Send';
            submitButton.style.cssText = `
                padding: 8px 16px;
                background: #444;
                color: white;
                border: 1px solid #666;
                border-radius: 4px;
                cursor: pointer;
                font-family: monospace;
            `;

            inputContainer.appendChild(input);
            inputContainer.appendChild(submitButton);
            dialoguePane.appendChild(imageContainer);
            dialoguePane.appendChild(conversationContainer);
            dialoguePane.appendChild(inputContainer);

            const gameContainer = document.querySelector('.game-container');
            gameContainer.appendChild(dialoguePane);

            submitButton.addEventListener('click', () => this.handleSubmit());
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSubmit();
                }
            });
        }

        this.dialoguePane = document.getElementById('dialoguePane');
        this.conversationContainer = document.getElementById('dialogueConversation');
        this.imageContainer = document.getElementById('dialogueImage');
        this.input = document.getElementById('dialogueInput');
        this.submitButton = document.getElementById('dialogueSubmit');
    }

    async handleSubmit() {
        const input = this.input.value.trim();
        if (!input) return;

        this.addMessage('Player', input);
        this.input.value = '';
        this.submitButton.disabled = true;

        try {
            const response = await this.sendToLambda(input);
            if (response?.text) {
                this.addMessage('NPC', response.text);
                if (response.image) {
                    this.updateImage(response.image);
                }
            } else {
                throw new Error('No response text from Lambda');
            }
        } catch (error) {
            const loadingMsg = this.conversationContainer.lastElementChild;
            if (loadingMsg && loadingMsg.textContent.includes('Thinking...')) {
                this.conversationContainer.removeChild(loadingMsg);
            }
            this.addMessage('System', error.message || 'Connection lost. Please try again.');
        }

        this.submitButton.disabled = false;
        this.input.focus();
    }

    async sendToLambda(userInput, retryCount = 0) {
        try {
            const payload = {
                action: 'continue',
                session_id: this.sessionId,
                input: userInput,
                story_type: 'dialogue',
                location: this.location,
                location_description: this.locationDescription,
                character: this.currentCharacter ? {
                    name: this.currentCharacter.name,
                    type: this.currentCharacter.title
                } : null,
                dialogue_context: {
                    type: this.currentEventType,
                    content: this.lastEventContent
                }
            };

            if (retryCount === 0) {
                this.addMessage('System', 'Thinking...');
            } else {
                this.updateLastMessage('System', `Thinking... (attempt ${retryCount + 1})`);
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.TIMEOUT);

            try {
                const response = await fetch(this.LAMBDA_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                // Remove loading message
                const loadingMsg = this.conversationContainer.lastElementChild;
                if (loadingMsg && loadingMsg.textContent.includes('Thinking...')) {
                    this.conversationContainer.removeChild(loadingMsg);
                }

                if (data?.response?.text) {
                    return {
                        text: data.response.text,
                        nepaliText: data.response.nepaliText,
                        image: data.response.image
                    };
                }

                if (data?.statusCode === 200 && data?.body) {
                    const responseBody = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                    if (responseBody?.response) {
                        return {
                            text: responseBody.response.text || responseBody.response.english,
                            nepaliText: responseBody.response.nepaliText || responseBody.response.nepali,
                            image: responseBody.response.image
                        };
                    }
                }

                throw new Error(data?.error || 'Invalid response format from Lambda');

            } catch (error) {
                clearTimeout(timeoutId);
                if (error.name === 'AbortError' && retryCount < this.MAX_RETRIES) {
                    return await this.sendToLambda(userInput, retryCount + 1);
                }
                throw error;
            }

        } catch (error) {
            if (retryCount < this.MAX_RETRIES) {
                return await this.sendToLambda(userInput, retryCount + 1);
            }
            throw error;
        }
    }

    updateImage(imageData) {
        if (imageData && this.imageContainer) {
            this.imageContainer.style.display = 'block';
            this.imageContainer.style.backgroundImage = `url(${imageData})`;
        }
    }

    addMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            margin-bottom: 8px;
            padding: 8px;
            border-radius: 4px;
            background: ${sender === 'Player' ? '#1a3a1a' : sender === 'System' ? '#3a1a1a' : '#2a2a3a'};
            font-family: monospace;
        `;
        messageDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
        this.conversationContainer.appendChild(messageDiv);
        this.conversationContainer.scrollTop = this.conversationContainer.scrollHeight;
    }

    updateLastMessage(sender, text) {
        const lastMessage = this.conversationContainer.lastElementChild;
        if (lastMessage && lastMessage.textContent.includes(`${sender}:`)) {
            lastMessage.innerHTML = `<strong>${sender}:</strong> ${text}`;
        } else {
            this.addMessage(sender, text);
        }
    }

    generateRandomEvent() {
        const eventTypes = ['riddle', 'mission', 'joke', 'smallTalk', 'gift', 'clue'];
        const randomType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const eventPool = this.events[randomType];
        const randomEvent = eventPool[Math.floor(Math.random() * eventPool.length)];
        
        let content = '';
        this.currentEventType = randomType;
        
        switch(randomType) {
            case 'riddle':
                content = randomEvent.question;
                this.lastEventContent = randomEvent;
                break;
            case 'mission':
                content = `${randomEvent.task}\nReward: ${randomEvent.reward}`;
                this.lastEventContent = randomEvent;
                break;
            case 'joke':
                content = randomEvent;
                this.lastEventContent = { joke: randomEvent };
                break;
            case 'smallTalk':
                content = randomEvent;
                this.lastEventContent = { statement: randomEvent };
                break;
            case 'gift':
                content = `${randomEvent.description}\nYou received: ${randomEvent.item}`;
                this.lastEventContent = randomEvent;
                break;
            case 'clue':
                content = randomEvent;
                this.lastEventContent = { clue: randomEvent };
                break;
        }
        
        return { content, type: randomType };
    }

    showDialogue(description, terrainIcon) {
        if (this.isActive) return;
        console.log('Showing dialogue with:', { description, terrainIcon });

        // Check if this is a repeat interaction
        if (terrainIcon?.mapValue >= 4) {
            const key = `${terrainIcon.mapValue}-${terrainIcon.name}`;
            
            if (this.interactions.has(key)) {
                // This is a repeat interaction - show a random follow-up response
                const randomResponse = this.followupResponses[Math.floor(Math.random() * this.followupResponses.length)];
                this.conversationContainer.innerHTML = '';
                this.addMessage('NPC', randomResponse);
                this.dialoguePane.style.display = 'block';
                this.isActive = true;
                this.input.focus();
                return;
            }
            
            // Track first interaction
            this.interactions.set(key, true);
        }

        // Continue with normal first-time dialogue
        const event = this.generateRandomEvent();
        this.conversationContainer.innerHTML = '';

        // Set current character based on the character data
        if (terrainIcon?.name && terrainIcon?.type) {
            this.currentCharacter = {
                name: terrainIcon.name,
                title: terrainIcon.type
            };
            console.log('Using character:', this.currentCharacter);
        } else {
            console.log('No valid character data, using default');
            this.currentCharacter = {
                name: 'Mysterious Being',
                title: 'Wanderer'
            };
        }

        // Format the NPC's introduction and event
        const introText = `I am ${this.currentCharacter.name} the ${this.currentCharacter.title}. `;
        let eventText = '';

        switch (event.type) {
            case 'riddle':
                eventText = `I have a riddle for you: "${event.content}"`;
                break;
            case 'mission':
                eventText = `I have a quest for you: ${event.content}`;
                break;
            case 'joke':
                eventText = `Would you like to hear something amusing? ${event.content}`;
                break;
            case 'smallTalk':
                eventText = event.content;
                break;
            case 'gift':
                eventText = event.content;
                break;
            case 'clue':
                eventText = `Let me share a secret with you: ${event.content}`;
                break;
            default:
                eventText = `How can I assist you?`;
        }

        const dialoguePrompt = introText + eventText;
        this.addMessage('NPC', dialoguePrompt);

        this.dialoguePane.style.display = 'block';
        this.isActive = true;
        this.input.focus();
    }

    hideDialogue() {
        if (this.dialoguePane) {
            this.dialoguePane.style.display = 'none';
            this.isActive = false;
            this.currentCharacter = null;
            this.currentEventType = null;
            this.lastEventContent = null;
            this.conversationContainer.innerHTML = '';
        }
    }

    setLocation(location, description) {
        this.location = location;
        this.locationDescription = description;
    }

    isDialogueActive() {
        return this.isActive;
    }

    reset() {
        this.sessionId = `session-${Date.now()}`;
        this.storyStarted = false;
        this.hideDialogue();
        this.interactions.clear(); // Clear interaction history on reset
    }
}

// Initialize the dialogue manager
window.dialogueManager = new DialogueManager();

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DialogueManager;
}              