class GameState {
    constructor() {
        this.storageKey = 'mercadoEmMovimento';
        this.defaultState = {
            gameId: null,
            players: [],
            currentRound: 1,
            totalRounds: 5,
            gameStarted: false,
            gameEnded: false,
            activeEvents: [],
            roundResults: [],
            markets: null,
            config: null
        };
    }

    // Inicializar novo jogo
    initNewGame(playerNames) {
        const gameId = Date.now().toString();
        const players = playerNames.map((name, index) => ({
            id: index + 1,
            name: name,
            cash: 50000,
            inventory: {
                basic: 0,
                premium: 0,
                deluxe: 0
            },
            marketShare: {
                national: 0,
                regional: 0,
                international: 0
            },
            reputation: 50,
            decisions: {},
            roundScores: [],
            totalScore: 0
        }));

        const newState = {
            ...this.defaultState,
            gameId: gameId,
            players: players,
            gameStarted: true
        };

        this.saveState(newState);
        return newState;
    }

    // Salvar estado no localStorage
    saveState(state) {
        localStorage.setItem(this.storageKey, JSON.stringify(state));
    }

    // Carregar estado do localStorage
    loadState() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Erro ao carregar estado do jogo:', e);
                return this.defaultState;
            }
        }
        return this.defaultState;
    }

    // Verificar se existe jogo salvo
    hasExistingGame() {
        const state = this.loadState();
        return state.gameStarted && !state.gameEnded;
    }

    // Limpar estado do jogo
    clearGame() {
        localStorage.removeItem(this.storageKey);
    }

    // Atualizar decisões do jogador
    updatePlayerDecisions(playerId, decisions) {
        const state = this.loadState();
        const player = state.players.find(p => p.id === playerId);
        if (player) {
            player.decisions = { ...player.decisions, ...decisions };
            this.saveState(state);
        }
    }

    // Avançar para próxima rodada
    nextRound() {
        const state = this.loadState();
        if (state.currentRound < state.totalRounds) {
            state.currentRound += 1;
            this.saveState(state);
            return true;
        }
        return false;
    }

    // Finalizar jogo
    endGame() {
        const state = this.loadState();
        state.gameEnded = true;
        this.saveState(state);
    }

    // Adicionar evento ativo
    addActiveEvent(event) {
        const state = this.loadState();
        state.activeEvents.push({
            ...event,
            startRound: state.currentRound,
            endRound: state.currentRound + (event.duration - 1)
        });
        this.saveState(state);
    }

    // Remover eventos expirados
    cleanExpiredEvents() {
        const state = this.loadState();
        state.activeEvents = state.activeEvents.filter(
            event => event.endRound >= state.currentRound
        );
        this.saveState(state);
    }

    // Obter eventos ativos
    getActiveEvents() {
        const state = this.loadState();
        return state.activeEvents.filter(
            event => event.startRound <= state.currentRound && 
                    event.endRound >= state.currentRound
        );
    }

    // Calcular efeitos dos eventos ativos
    calculateEventEffects() {
        const events = this.getActiveEvents();
        const effects = {
            marketDemandMultiplier: { national: 1, regional: 1, international: 1 },
            transportCostMultiplier: { national: 1, regional: 1, international: 1 },
            qualitySensitivityMultiplier: { national: 1, regional: 1, international: 1 },
            priceSensitivityMultiplier: { national: 1, regional: 1, international: 1 },
            advertisingSensitivityMultiplier: { national: 1, regional: 1, international: 1 },
            productionCostMultiplier: 1
        };

        events.forEach(event => {
            switch (event.type) {
                case 'market_demand':
                    Object.keys(event.effect).forEach(market => {
                        effects.marketDemandMultiplier[market] += event.effect[market];
                    });
                    break;
                case 'transport_cost':
                    Object.keys(event.effect).forEach(market => {
                        effects.transportCostMultiplier[market] *= event.effect[market];
                    });
                    break;
                case 'quality_sensitivity':
                    Object.keys(event.effect).forEach(market => {
                        effects.qualitySensitivityMultiplier[market] *= event.effect[market];
                    });
                    break;
                case 'price_sensitivity':
                    Object.keys(event.effect).forEach(market => {
                        effects.priceSensitivityMultiplier[market] *= event.effect[market];
                    });
                    break;
                case 'advertising_sensitivity':
                    Object.keys(event.effect).forEach(market => {
                        effects.advertisingSensitivityMultiplier[market] *= event.effect[market];
                    });
                    break;
                case 'production_cost':
                    if (event.effect.all) {
                        effects.productionCostMultiplier *= event.effect.all;
                    }
                    break;
            }
        });

        return effects;
    }
}

// Instância global do gerenciador de estado
window.gameState = new GameState();