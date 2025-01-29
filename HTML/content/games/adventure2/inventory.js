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
    },

    updateDisplay() {
        const container = document.getElementById('inventoryList');
        if (!container) return;
        
        if (this.items.length === 0) {
            container.innerHTML = 'No items';
            return;
        }

        container.innerHTML = this.items
            .map(item => `${item.name} ${item.quantity > 1 ? '×' + item.quantity : ''}`)
            .join('<br>');
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
if (window.dialogueManager) {
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
}

// Try to hook into dialogue again after a delay in case it loads late
setTimeout(() => {
    if (window.dialogueManager && !window.dialogueManager._hooked) {
        const origGenerateEvent = window.dialogueManager.generateRandomEvent;
        window.dialogueManager.generateRandomEvent = function() {
            const event = origGenerateEvent.call(this);
            if (event.type === 'gift' && this.lastEventContent?.item) {
                window.inventoryManager.addItem(this.lastEventContent.item);
            } else if (event.type === 'mission' && this.lastEventContent?.reward) {
                window.inventoryManager.addItem(this.lastEventContent.reward);
            }
            return event;
        };
        window.dialogueManager._hooked = true;
    }
}, 1000);