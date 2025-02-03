// Combat system for the adventure game
window.combatManager = {
    monsters: new Map(),
    currentMapMonsters: [],
    isInCombat: false,
    currentMonster: null,
    MONSTER_TYPES: [
        { type: 'goblin', health: 30, damage: 5, file: '017-goblin.png' },
        { type: 'dragon', health: 100, damage: 15, file: '002-dragon.png' },
        { type: 'werewolf', health: 50, damage: 10, file: '027-werewolf.png' },
        { type: 'ogre', health: 70, damage: 12, file: '032-ogre.png' },
        { type: 'zombie', health: 40, damage: 7, file: '045-zombie.png' }
    ],

    initialize() {
        // Initialize combat UI
        this.createCombatUI();
        
        // Hook into the move function to handle monster movement
        const originalMove = window.move;
        window.move = async (dx, dy) => {
            console.log('Move intercepted by combat system');
            if (this.isInCombat) {
                console.log('Cannot move while in combat');
                return;
            }
            console.log('Combat check - GameMap:', !!window.gameMap);
            
            // Call original move function
            await originalMove(dx, dy);
            
            // Move monsters after player moves
            this.moveMonsters();
            
            // Check for combat after movement
            this.checkForCombat();
            
            // Spawn new monsters (50% chance)
            if (Math.random() < 0.5) {
                this.spawnMonster();
            }
        };
    },

    createCombatUI() {
        const combatPane = document.createElement('div');
        combatPane.id = 'combatPane';
        combatPane.style.cssText = `
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #222;
            padding: 20px;
            border-radius: 8px;
            z-index: 1000;
            min-width: 300px;
        `;

        const combatContent = `
            <h2>Combat!</h2>
            <div id="monsterStats"></div>
            <div id="playerStats"></div>
            <div id="combatLog" style="max-height: 150px; overflow-y: auto; margin: 10px 0;"></div>
            <div id="combatActions" style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button onclick="window.combatManager.fight()">Fight</button>
                <button onclick="window.combatManager.flee()">Flee</button>
                <button onclick="window.combatManager.showItemMenu()">Use Item</button>
                <button onclick="window.combatManager.showGiveItemMenu()">Give Item</button>
                <button onclick="window.combatManager.initiateDialogue()">Talk</button>
            </div>
        `;

        combatPane.innerHTML = combatContent;
        document.body.appendChild(combatPane);
    },

    spawnMonster() {
        console.log('Attempting to spawn monster...');
        
        // Verify game state
        if (!window.gameMap) {
            console.error('No game map available');
            return;
        }
        
        if (this.isInCombat) {
            console.log('Cannot spawn during combat');
            return;
        }
        
        if (!Array.isArray(window.gameMap) || !Array.isArray(window.gameMap[0])) {
            console.error('Invalid game map structure:', window.gameMap);
            return;
        }

        const mapWidth = window.gameMap[0].length;
        const mapHeight = window.gameMap.length;
        
        console.log('Map dimensions:', mapWidth, 'x', mapHeight);
        console.log('Current player position:', window.playerX, window.playerY);
        
        console.log('Map dimensions:', mapWidth, mapHeight);
        
        // Try to find a valid spawn position
        let attempts = 0;
        while (attempts < 20) {
            const x = Math.floor(Math.random() * mapWidth);
            const y = Math.floor(Math.random() * mapHeight);
            
            if (window.isTilePassable(x, y) && 
                !(x === window.playerX && y === window.playerY)) {
                
                const monsterType = this.MONSTER_TYPES[
                    Math.floor(Math.random() * this.MONSTER_TYPES.length)
                ];
                
                const monster = {
                    x,
                    y,
                    ...monsterType,
                    isHostile: true,
                    currentHealth: monsterType.health
                };

                this.currentMapMonsters.push(monster);
                this.renderMonsters();
                break;
            }
            attempts++;
        }
    },

    renderMonsters() {
        // Remove existing monster elements
        document.querySelectorAll('.monster').forEach(el => el.remove());
        
        // Create new monster elements
        this.currentMapMonsters.forEach(monster => {
            const monsterElement = document.createElement('div');
            monsterElement.className = 'monster';
            monsterElement.style.cssText = `
                position: absolute;
                width: 32px;
                height: 32px;
                left: ${monster.x * 32}px;
                top: ${monster.y * 32}px;
                background-image: url('${window.ICONS.baseUrls.characters}${monster.file}');
                background-size: contain;
                background-repeat: no-repeat;
                z-index: 5;
                transition: all 0.2s;
            `;
            
            if (!monster.isHostile) {
                monsterElement.style.filter = 'hue-rotate(120deg)';
            }
            
            document.getElementById('gameMap').appendChild(monsterElement);
        });
    },

    moveMonsters() {
        this.currentMapMonsters.forEach(monster => {
            if (monster.isHostile) {
                // Move towards player
                const dx = Math.sign(window.playerX - monster.x);
                const dy = Math.sign(window.playerY - monster.y);
                
                const newX = monster.x + dx;
                const newY = monster.y + dy;
                
                if (window.isTilePassable(newX, newY)) {
                    monster.x = newX;
                    monster.y = newY;
                }
            } else {
                // 50% chance to move in random direction
                if (Math.random() < 0.5) {
                    const directions = [
                        {dx: 1, dy: 0},
                        {dx: -1, dy: 0},
                        {dx: 0, dy: 1},
                        {dx: 0, dy: -1}
                    ];
                    const randomDir = directions[Math.floor(Math.random() * directions.length)];
                    const newX = monster.x + randomDir.dx;
                    const newY = monster.y + randomDir.dy;
                    
                    if (window.isTilePassable(newX, newY)) {
                        monster.x = newX;
                        monster.y = newY;
                    }
                }
            }
        });
        
        this.renderMonsters();
    },

    checkForCombat() {
        const monster = this.currentMapMonsters.find(m => 
            m.x === window.playerX && 
            m.y === window.playerY &&
            m.isHostile
        );
        
        if (monster) {
            this.initiateCombat(monster);
        }
    },

    initiateCombat(monster) {
        this.isInCombat = true;
        this.currentMonster = monster;
        
        // Show combat UI
        const combatPane = document.getElementById('combatPane');
        combatPane.style.display = 'block';
        
        // Update stats displays
        this.updateCombatStats();
    },

    updateCombatStats() {
        const monsterStats = document.getElementById('monsterStats');
        monsterStats.innerHTML = `
            <h3>${this.currentMonster.type}</h3>
            <p>Health: ${this.currentMonster.currentHealth}/${this.currentMonster.health}</p>
        `;
    },

    addCombatLog(message) {
        const log = document.getElementById('combatLog');
        const entry = document.createElement('div');
        entry.textContent = message;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    },

    async fight() {
        // Player attacks first
        const playerDamage = Math.floor(Math.random() * 10) + 5;
        this.currentMonster.currentHealth -= playerDamage;
        this.addCombatLog(`You deal ${playerDamage} damage!`);
        
        if (this.currentMonster.currentHealth <= 0) {
            this.monsterDefeated();
            return;
        }
        
        // Monster counterattacks
        if (this.currentMonster.isHostile) {
            const monsterDamage = Math.floor(Math.random() * this.currentMonster.damage);
            this.addCombatLog(`${this.currentMonster.type} deals ${monsterDamage} damage!`);
        }
        
        this.updateCombatStats();
    },

    flee() {
        const success = Math.random() < 0.6; // 60% chance to flee
        if (success) {
            this.addCombatLog('You successfully fled!');
            this.endCombat();
            
            // Move player to random adjacent tile
            const directions = [
                {dx: 1, dy: 0},
                {dx: -1, dy: 0},
                {dx: 0, dy: 1},
                {dx: 0, dy: -1}
            ];
            
            for (const dir of directions) {
                const newX = window.playerX + dir.dx;
                const newY = window.playerY + dir.dy;
                if (window.isTilePassable(newX, newY)) {
                    window.playerX = newX;
                    window.playerY = newY;
                    window.updatePlayerPosition();
                    break;
                }
            }
        } else {
            this.addCombatLog('Failed to flee!');
            // Monster gets a free attack
            const damage = Math.floor(Math.random() * this.currentMonster.damage);
            this.addCombatLog(`${this.currentMonster.type} deals ${damage} damage!`);
        }
    },

    showItemMenu() {
        const items = window.inventoryManager.getItems();
        const itemButtons = items.map(item => `
            <button onclick="window.combatManager.useItem('${item.name}')">
                ${item.name} (${item.quantity})
            </button>
        `).join('');
        
        document.getElementById('combatActions').innerHTML = `
            ${itemButtons}
            <button onclick="window.combatManager.restoreCombatMenu()">Back</button>
        `;
    },

    showGiveItemMenu() {
        const items = window.inventoryManager.getItems();
        const itemButtons = items.map(item => `
            <button onclick="window.combatManager.giveItem('${item.name}')">
                ${item.name} (${item.quantity})
            </button>
        `).join('');
        
        document.getElementById('combatActions').innerHTML = `
            ${itemButtons}
            <button onclick="window.combatManager.restoreCombatMenu()">Back</button>
        `;
    },

    useItem(itemName) {
        if (window.inventoryManager.removeItem(itemName)) {
            // Apply item effects
            if (itemName.includes('Potion')) {
                this.addCombatLog(`Used ${itemName}!`);
            }
        }
        this.restoreCombatMenu();
    },

    giveItem(itemName) {
        if (window.inventoryManager.removeItem(itemName)) {
            const peacefulChance = 0.7; // 70% chance to pacify
            if (Math.random() < peacefulChance) {
                this.currentMonster.isHostile = false;
                this.addCombatLog(`${this.currentMonster.type} accepts your gift and becomes peaceful!`);
                this.endCombat();
            } else {
                this.addCombatLog(`${this.currentMonster.type} takes the ${itemName} but remains hostile!`);
            }
        }
        this.restoreCombatMenu();
    },

    initiateDialogue() {
        if (window.dialogueManager) {
            const monster = this.currentMonster;
            this.endCombat();
            window.dialogueManager.showDialogue(
                `A wild ${monster.type} appears...`,
                { name: monster.type, type: 'monster' }
            );
        }
    },

    restoreCombatMenu() {
        document.getElementById('combatActions').innerHTML = `
            <button onclick="window.combatManager.fight()">Fight</button>
            <button onclick="window.combatManager.flee()">Flee</button>
            <button onclick="window.combatManager.showItemMenu()">Use Item</button>
            <button onclick="window.combatManager.showGiveItemMenu()">Give Item</button>
            <button onclick="window.combatManager.initiateDialogue()">Talk</button>
        `;
    },

    monsterDefeated() {
        this.addCombatLog(`${this.currentMonster.type} was defeated!`);
        
        // Remove monster from current map
        const index = this.currentMapMonsters.findIndex(m => 
            m.x === this.currentMonster.x && 
            m.y === this.currentMonster.y
        );
        if (index !== -1) {
            this.currentMapMonsters.splice(index, 1);
        }
        
        // Chance to drop loot
        if (Math.random() < 0.7) { // 70% chance
            const loot = [
                'Health Potion',
                'Magic Ring',
                'Ancient Coin',
                'Mysterious Gem'
            ];
            const item = loot[Math.floor(Math.random() * loot.length)];
            window.inventoryManager.addItem(item);
            this.addCombatLog(`Found ${item}!`);
        }
        
        this.endCombat();
    },

    endCombat() {
        this.isInCombat = false;
        this.currentMonster = null;
        document.getElementById('combatPane').style.display = 'none';
        this.renderMonsters();
    },

    // Call when changing maps
    clearMonsters() {
        this.currentMapMonsters = [];
        this.renderMonsters();
    }
};

// Initialize combat system when the game starts
document.addEventListener('DOMContentLoaded', () => {
    window.combatManager.initialize();
});

// Hook into map changes
const originalChangeMap = window.changeMap;
window.changeMap = function(...args) {
    const result = originalChangeMap.apply(this, args);
    window.combatManager.clearMonsters();
    return result;
};