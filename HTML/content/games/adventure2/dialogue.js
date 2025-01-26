class DialogueManager {
    constructor() {
        this.isActive = false;
        this.initialize();
    }

    initialize() {
        this.dialoguePane = document.getElementById('dialoguePane');
        this.dialogueText = document.getElementById('dialogueText');
        this.dialogueContinue = document.getElementById('dialogueContinue');
        
        if (this.dialogueContinue) {
            this.dialogueContinue.addEventListener('click', () => this.hideDialogue());
        }
    }

    showDialogue(description, terrain) {
        if (!this.dialoguePane || this.isActive) return;
        
        this.dialogueText.textContent = `You encounter ${description}. What mysteries await?`;
        this.dialoguePane.style.display = 'block';
        this.isActive = true;
    }

    hideDialogue() {
        if (!this.dialoguePane) return;
        
        this.dialoguePane.style.display = 'none';
        this.isActive = false;
    }
}

window.dialogueManager = new DialogueManager();