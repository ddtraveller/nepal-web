// Use the window.debug function
window.gameDebug = window.debug || console.log;

window.gameDebug('Game script started loading');

/// Constants and state
const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 15;

let ICONS = null;
let gameMap = null;
let playerX = 0;
let playerY = 0;
let currentCharacter = null;
let currentMapId = null;
let maps = null;
let currentMap = null;

// Base terrain types
const TERRAIN_TYPES = {
    0: { type: 'grass', char: '·', passable: true },
    1: { type: 'water', char: '~', passable: false },
    2: { type: 'mountain', char: '▲', passable: false },
    3: { type: 'forest', char: '♣', passable: true },
    'terrain-icon': { type: 'terrain-icon', char: '', passable: true }
};

// Make key variables and functions available globally
window.gameMap = null;
window.playerX = 0;
window.playerY = 0;
window.isTilePassable = function(x, y) {
    if (!window.gameMap || !window.gameMap[y] || typeof window.gameMap[y][x] === 'undefined') {
        return false;
    }
    return window.gameMap[y][x] >= 4 || TERRAIN_TYPES[window.gameMap[y][x]]?.passable || false;
};

async function loadMaps() {
    try {
        const response = await fetch(`https://nepal-web.s3.us-west-2.amazonaws.com/games/adventure2/maps.json?v=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        gameDebug('Maps JSON:', text);
        const data = JSON.parse(text);
        maps = data.maps;
        return true;
    } catch (error) {
        console.error('Error loading maps:', error);
        return false;
    }
}

function getTerrainType(value) {
    if (typeof value === 'number') {
        if (value >= 4) {
            return TERRAIN_TYPES['terrain-icon'];
        }
        return TERRAIN_TYPES[value] || TERRAIN_TYPES[0];
    }
    return TERRAIN_TYPES[0];
}

function changeMap(newMapId) {
    if (!maps) return false;
    
    const newMap = maps.find(map => map.id === newMapId);
    if (!newMap) return false;

    currentMapId = newMapId;
    currentMap = newMap;
    gameMap = generateMap();
    
    const spawn = newMap.defaultSpawn || maps[0].defaultSpawn || { x: 1, y: 1 };
    playerX = spawn.x;
    playerY = spawn.y;

    renderMap();
    updatePlayerPosition();
    return true;
}

async function originalMove(dx, dy) {
    const newX = playerX + dx;
    const newY = playerY + dy;
    
    if (!gameMap || newX < 0 || newX >= MAP_WIDTH || newY < 0 || newY >= MAP_HEIGHT) {
        return;
    }
    
    if (isTilePassable(newX, newY)) {
        const cellValue = gameMap[newY][newX];
        
        playerX = newX;
        playerY = newY;
        updatePlayerPosition();

        if (currentMap?.exit && 
            currentMap.exit.x === newX && 
            currentMap.exit.y === newY) {
            changeMap(currentMap.exit.to);
            return;
        }

        if (cellValue >= 4 && gameMap.selectedTerrainIcons) {
            const icon = gameMap.selectedTerrainIcons.find(icon => 
                icon.mapValue === cellValue
            );
            if (icon && window.dialogueManager) {
                window.dialogueManager.showDialogue(
                    icon.description,
                    icon
                );
            }
        }
    }
}

window.move = async function(dx, dy) {
    if (window.dialogueManager?.isDialogueActive()) {
        window.dialogueManager.hideDialogue();
        return;
    }

    const sound = new Audio('https://nepal-web.s3.us-west-2.amazonaws.com/audio/click.mp3');
    sound.volume = 0.3;
    sound.play().catch(err => window.debug('Sound error:', err));
    
    await originalMove(dx, dy);
};

async function loadIcons() {
    gameDebug('Starting to load icons...');
    const optionsContainer = document.getElementById('characterOptions');
    
    try {
        const response = await fetch('https://nepal-web.s3.us-west-2.amazonaws.com/games/adventure2/game-icons.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        gameDebug('Icons loaded successfully');
        ICONS = data;
        initializeCharacterSelect();
    } catch (error) {
        const errorMsg = 'Error loading icons: ' + error.message;
        gameDebug(errorMsg);
        optionsContainer.innerHTML = errorMsg;
    }
}

function getRandomItems(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function initializeCharacterSelect() {
    gameDebug('Initializing character select...');
    const optionsContainer = document.getElementById('characterOptions');
    optionsContainer.innerHTML = '';
    
    if (!ICONS || !ICONS.characters) {
        gameDebug('No icons data available');
        return;
    }
    
    const characters = getRandomItems(ICONS.characters, 3);
    
    characters.forEach(char => {
        const option = document.createElement('div');
        option.className = 'character-option';
        
        const img = document.createElement('img');
        img.src = `${ICONS.baseUrls.characters}${char.file}`;
        img.alt = char.file;
        
        const desc = document.createElement('span');
        desc.textContent = char.description;
        
        option.appendChild(img);
        option.appendChild(desc);
        option.onclick = () => selectCharacter(char);
        optionsContainer.appendChild(option);
    });
}

function selectCharacter(character) {
    gameDebug('Character selected: ' + character.file);
    currentCharacter = character;
    document.getElementById('characterSelect').classList.add('hidden');
    document.querySelector('.game-container').classList.add('visible');
    startGame();
}

// Then in the generateMap function, make sure to set the global gameMap:
function generateMap() {
    if (!maps) {
        console.error('Maps not loaded');
        return generateRandomMap();
    }

    if (!currentMapId) {
        console.error('Current map ID not set');
        return generateRandomMap();
    }

    currentMap = maps.find(map => map.id === currentMapId);
    if (!currentMap) {
        console.error('Map not found:', currentMapId);
        return generateRandomMap();
    }

    const map = currentMap.layout.map(row => [...row]);
    
    const terrainIcons = ICONS.terrain.map((icon, index) => ({
        ...icon,
        mapValue: 4 + index
    }));
    
    const numIcons = Math.floor(Math.random() * 6) + 1;
    const selectedIcons = terrainIcons
        .sort(() => 0.5 - Math.random())
        .slice(0, numIcons);
    
    selectedIcons.forEach(icon => {
        let placed = false;
        while (!placed) {
            const x = Math.floor(Math.random() * MAP_WIDTH);
            const y = Math.floor(Math.random() * MAP_HEIGHT);
            if (map[y][x] === 0) {
                map[y][x] = icon.mapValue;
                placed = true;
            }
        }
    });

    map.selectedTerrainIcons = selectedIcons;
    window.gameMap = map; // Make sure to set the global gameMap
    return map;
}

function generateRandomMap() {
    const map = Array(MAP_HEIGHT).fill().map(() => 
        Array(MAP_WIDTH).fill(0)
    );

    map[0][0] = 0;
    map[0][MAP_WIDTH-1] = 0;
    map[MAP_HEIGHT-1][0] = 0;
    map[MAP_HEIGHT-1][MAP_WIDTH-1] = 0;
    map[Math.floor(MAP_HEIGHT/2)][Math.floor(MAP_WIDTH/2)] = 0;

    let openPathCount = 5;

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (x === 0 && y === 0) continue;
            else if (x === MAP_WIDTH - 1 && y === 0) continue;
            else if (x === 0 && y === MAP_HEIGHT - 1) continue;
            else if (x === MAP_WIDTH - 1 && y === MAP_HEIGHT - 1) continue;
            else if (x === Math.floor(MAP_WIDTH/2) && y === Math.floor(MAP_HEIGHT/2)) continue;

            const rand = Math.random();
            if (rand < 0.15) {
                map[y][x] = 1;
            } else if (rand < 0.3) {
                map[y][x] = 2;
            } else if (rand < 0.45) {
                map[y][x] = 3;
            } else {
                map[y][x] = 0;
                openPathCount++;
            }
        }
    }

    if (openPathCount < (MAP_WIDTH * MAP_HEIGHT) * 0.25) {
        return generateRandomMap();
    }

    return map;
}

function renderMap() {
    const mapElement = document.getElementById('gameMap');
    mapElement.innerHTML = '<div id="player" class="player"></div>';
    mapElement.style.width = MAP_WIDTH * TILE_SIZE + 'px';
    mapElement.style.height = MAP_HEIGHT * TILE_SIZE + 'px';

    gameMap.forEach((row, y) => {
        row.forEach((cell, x) => {
            const tile = document.createElement('div');
            const isTerrainIcon = cell >= 4;
            const terrainType = isTerrainIcon ? 'terrain-icon' : TERRAIN_TYPES[cell]?.type || 'unknown';
            const terrainChar = isTerrainIcon ? '' : TERRAIN_TYPES[cell]?.char || '';
            
            tile.className = `tile ${terrainType}`;
            tile.style.left = x * TILE_SIZE + 'px';
            tile.style.top = y * TILE_SIZE + 'px';
            tile.textContent = terrainChar;

            if (isTerrainIcon) {
                const icon = gameMap.selectedTerrainIcons.find(icon => icon.mapValue === cell);
                if (icon) {
                    const imgUrl = `${ICONS.baseUrls.terrain}${icon.file}`;
                    tile.style.backgroundImage = `url('${imgUrl}')`;
                    tile.style.backgroundSize = 'contain';
                    tile.style.backgroundRepeat = 'no-repeat';
                }
            }
            
            if (currentMap?.exit && currentMap.exit.x === x && currentMap.exit.y === y) {
                tile.style.border = '2px solid gold';
                tile.style.boxSizing = 'border-box';
                tile.title = `Exit to ${currentMap.exit.to}`;
            }

            mapElement.appendChild(tile);
        });
    });

    if (currentCharacter) {
        const player = document.getElementById('player');
        player.style.backgroundImage = `url('${ICONS.baseUrls.characters}${currentCharacter.file}')`;
        player.style.backgroundSize = 'contain';
        player.style.backgroundRepeat = 'no-repeat';
        player.style.backgroundColor = 'transparent';
    }
}

function isTilePassable(x, y) {
    if (!gameMap || !gameMap[y] || typeof gameMap[y][x] === 'undefined') {
        return false;
    }
    return gameMap[y][x] >= 4 || TERRAIN_TYPES[gameMap[y][x]]?.passable || false;
}

// Update player position globally
function updatePlayerPosition() {
    const player = document.getElementById('player');
    if (!player) return;
    
    window.playerX = playerX; // Update global playerX
    window.playerY = playerY; // Update global playerY
    
    player.style.left = playerX * TILE_SIZE + 'px';
    player.style.top = playerY * TILE_SIZE + 'px';
    
    const positionDisplay = document.getElementById('position');
    const terrainDisplay = document.getElementById('terrain');
    const mapNameDisplay = document.getElementById('mapName');
    
    if (positionDisplay) positionDisplay.textContent = `${playerX}, ${playerY}`;
    if (mapNameDisplay && currentMap) mapNameDisplay.textContent = currentMap.name;
    
    const cellValue = gameMap[playerY][playerX];
    const terrainType = cellValue >= 4 ? TERRAIN_TYPES['terrain-icon'] : TERRAIN_TYPES[cellValue];
    if (terrainDisplay && terrainType) {
        terrainDisplay.textContent = terrainType.type.charAt(0).toUpperCase() + terrainType.type.slice(1);
    }
}

async function startGame() {
    const mapsLoaded = await loadMaps();
    if (!mapsLoaded) {
        console.error('Failed to load maps');
    }
    
    currentMapId = 'forest_entrance';
    gameMap = generateMap();
    renderMap();
    updatePlayerPosition();
    
    window.addEventListener('keydown', (event) => {
        switch(event.key) {
            case 'ArrowLeft':  window.move(-1, 0); break;
            case 'ArrowRight': window.move(1, 0);  break;
            case 'ArrowUp':    window.move(0, -1); break;
            case 'ArrowDown':  window.move(0, 1);  break;
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    gameDebug('DOM Content Loaded');
    loadIcons();
});

// Make move function globally available
window.loadIcons = loadIcons;

// Hook into dialogue system after it's loaded
if (window.dialogueManager) {
    const originalShowDialogue = window.dialogueManager.showDialogue;
    window.dialogueManager.showDialogue = function(message, npc) {
        gameDebug('Intercepting dialogue:', message);
        if (window.parseMessage) {
            window.parseMessage(message);
        }
        return originalShowDialogue.call(this, message, npc);
    };
}

// Check dialogue manager again after a delay
setTimeout(() => {
    if (window.dialogueManager && !window.dialogueManager._hooked) {
        const originalShowDialogue = window.dialogueManager.showDialogue;
        window.dialogueManager.showDialogue = function(message, npc) {
            gameDebug('Intercepting dialogue (delayed):', message);
            if (window.parseMessage) {
                window.parseMessage(message);
            }
            return originalShowDialogue.call(this, message, npc);
        };
        window.dialogueManager._hooked = true;
        gameDebug('Dialogue hooks installed (delayed)');
    }
}, 1000);