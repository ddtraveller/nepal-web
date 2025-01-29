// Simple inventory manager
window.inventoryManager = {
    items: [],

    addItem(itemName) {
        console.log('Adding item:', itemName);
        const existingItem = this.items.find(i => i.name === itemName);
        if (existingItem) {
            existingItem.quantity++;
        } else {
            this.items.push({ name: itemName, quantity: 1 });
        }
        this.updateDisplay();
        console.log('Current inventory:', this.items);
    },

    removeItem(itemName) {
        console.log('Removing item:', itemName);
        const index = this.items.findIndex(i => i.name === itemName);
        if (index !== -1) {
            if (this.items[index].quantity > 1) {
                this.items[index].quantity--;
            } else {
                this.items.splice(index, 1);
            }
            this.updateDisplay();
            return true;
        }
        return false;
    },

    updateDisplay() {
        const container = document.getElementById('inventoryList');
        if (!container) {
            console.log('No inventory container found');
            return;
        }
        
        if (this.items.length === 0) {
            container.innerHTML = '<div style="color: #666;">No items</div>';
            return;
        }

        // Check if in dialogue
        const isInDialogue = window.dialogueManager?.isActive;
        console.log('In dialogue:', isInDialogue);

        container.innerHTML = this.items.map(item => {
            const itemHtml = `
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px;
                    margin: 5px 0;
                    background: #2a2a2a;
                    border-radius: 4px;
                ">
                    <span>${item.name} ${item.quantity > 1 ? '×' + item.quantity : ''}</span>
                    ${isInDialogue ? `
                        <button
                            onclick="window.dialogueManager.giveItemToNPC('${item.name}')"
                            style="
                                padding: 4px 8px;
                                background: #4a4a4a;
                                border: 1px solid #666;
                                border-radius: 4px;
                                color: #fff;
                                cursor: pointer;
                                font-size: 12px;
                            "
                            onmouseover="this.style.background='#5a5a5a'"
                            onmouseout="this.style.background='#4a4a4a'"
                        >Give to NPC</button>
                    ` : ''}
                </div>
            `;
            return itemHtml;
        }).join('');
        
        console.log('Updated inventory display');
    },

    getItems() {
        return [...this.items];
    }
};

// Add parseMessage function to window
window.parseMessage = function(message) {
    console.log('Parsing message:', message);
    
    // Check for direct "You received" items
    if (message.includes('You received:')) {
        const itemMatch = message.match(/You received:\s*([^\.]+)/);
        if (itemMatch && itemMatch[1]) {
            const itemName = itemMatch[1].trim();
            window.inventoryManager.addItem(itemName);
        }
    }
    
    // Check for quest rewards
    if (message.includes('Reward:')) {
        const rewardMatch = message.match(/Reward:\s*([^\.]+?)(?=\s+from|\.|$)/);
        if (rewardMatch && rewardMatch[1]) {
            const itemName = rewardMatch[1].trim();
            window.inventoryManager.addItem(itemName);
        }
    }
};

// Hook into dialogue manager to catch items
function setupDialogueHooks() {
    if (!window.dialogueManager) return;

    // Add giveItemToNPC method if it doesn't exist
    if (!window.dialogueManager.giveItemToNPC) {
        window.dialogueManager.giveItemToNPC = function(itemName) {
            console.log('Attempting to give item:', itemName);
            if (!this.currentCharacter) {
                console.log('No current character');
                return;
            }
            
            if (window.inventoryManager.removeItem(itemName)) {
                const message = `You give the ${itemName} to ${this.currentCharacter.name} the ${this.currentCharacter.title}.`;
                this.addMessage('System', message);
                
                const responses = [
                    `Thank you for the ${itemName}! This will be very useful.`,
                    `Ah, a ${itemName}! How thoughtful of you.`,
                    `I've been looking for a ${itemName}! Much appreciated.`,
                    `This ${itemName} will serve me well. Thank you.`
                ];
                
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                this.addMessage('NPC', randomResponse);
            }
        };
    }

    // Hook the original generateRandomEvent
    const origGenerateEvent = window.dialogueManager.generateRandomEvent;
    window.dialogueManager.generateRandomEvent = function() {
        const event = origGenerateEvent.call(this);
        // Capture both gift items and quest rewards
        if (event.type === 'gift' && this.lastEventContent?.item) {
            window.inventoryManager.addItem(this.lastEventContent.item);
        } else if (event.type === 'mission' && this.lastEventContent?.reward) {
            window.inventoryManager.addItem(this.lastEventContent.reward);
        }
        return event;
    };

    // Hook dialogue state changes
    const origShowDialogue = window.dialogueManager.showDialogue;
    window.dialogueManager.showDialogue = function(...args) {
        const result = origShowDialogue.apply(this, args);
        if (window.inventoryManager) {
            window.inventoryManager.updateDisplay();
        }
        return result;
    };

    const origHideDialogue = window.dialogueManager.hideDialogue;
    window.dialogueManager.hideDialogue = function(...args) {
        const result = origHideDialogue.apply(this, args);
        if (window.inventoryManager) {
            window.inventoryManager.updateDisplay();
        }
        return result;
    };

    window.dialogueManager._hooked = true;
}

// Try to setup hooks immediately and after a delay
setupDialogueHooks();
setTimeout(setupDialogueHooks, 1000);

// Retry setup periodically until successful
const hookInterval = setInterval(() => {
    if (window.dialogueManager && !window.dialogueManager._hooked) {
        setupDialogueHooks();
    } else if (window.dialogueManager?._hooked) {
        clearInterval(hookInterval);
    }
}, 1000);

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing inventory system');
    window.inventoryManager.updateDisplay();
});