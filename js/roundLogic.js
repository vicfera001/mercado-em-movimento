class RoundLogic {
    constructor() {
        this.currentPlayer = 0;
        this.playerDecisions = {};
        this.forecast = null;
        this.events = [];
        this.roundData = null;
    }

    // Inicializar rodada
    async init() {
        const state = gameState.loadState();
        
        // Verificar se o jogo está válido
        if (!state.gameStarted || state.gameEnded) {
            alert('Jogo não encontrado. Redirecionando para o início.');
            window.location.href = 'index.html';
            return;
        }

        // Aguardar carregamento dos dados do jogo
        await this.waitForGameEngine();
        
        // Limpar eventos expirados
        gameState.cleanExpiredEvents();
        
        // Gerar novos eventos para esta rodada (30% de chance)
        if (Math.random() < 0.3) {
            const newEvent = gameEngine.generateRandomEvent();
            if (newEvent) {
                gameState.addActiveEvent(newEvent);
                this.events.push(newEvent);
            }
        }

        // Obter eventos ativos
        this.events = gameState.getActiveEvents();
        
        // Inicializar interface
        this.setupUI();
        this.loadPlayerData();
        this.generateForecast();
        this.showEvents();
        
        // Mostrar primeiro jogador
        this.showPlayer(0);
    }

    async waitForGameEngine() {
        while (!gameEngine.markets || !gameEngine.config) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    setupUI() {
        const state = gameState.loadState();
        
        // Atualizar informações da rodada
        document.getElementById('currentRound').textContent = state.currentRound;
        document.getElementById('totalRounds').textContent = state.totalRounds;
        
        // Configurar navegação entre jogadores
        const playerNav = document.getElementById('playerNavigation');
        playerNav.innerHTML = '';
        
        state.players.forEach((player, index) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-primary';
            btn.textContent = player.name;
            btn.onclick = () => this.showPlayer(index);
            btn.id = `playerBtn${index}`;
            playerNav.appendChild(btn);
        });
        
        // Configurar produtos no select
        this.setupProductSelects();
    }

    setupProductSelects() {
        const selects = document.querySelectorAll('.product-select');
        selects.forEach(select => {
            select.innerHTML = '<option value="">Selecione um produto</option>';
            Object.keys(gameEngine.config.products).forEach(productKey => {
                const product = gameEngine.config.products[productKey];
                const option = document.createElement('option');
                option.value = productKey;
                option.textContent = `${product.name} (Custo: R$ ${product.productionCost}, Qualidade: ${product.quality})`;
                select.appendChild(option);
            });
        });
    }

    loadPlayerData() {
        const state = gameState.loadState();
        this.players = state.players;
        
        // Inicializar decisões se não existirem
        this.players.forEach(player => {
            if (!this.playerDecisions[player.id]) {
                this.playerDecisions[player.id] = {
                    production: { basic: 0, premium: 0, deluxe: 0 },
                    markets: {
                        national: { active: false, product: '', price: 0, advertising: 0 },
                        regional: { active: false, product: '', price: 0, advertising: 0 },
                        international: { active: false, product: '', price: 0, advertising: 0 }
                    }
                };
            }
        });
    }

    generateForecast() {
        // Gerar previsões para cada jogador (dados ligeiramente diferentes)
        this.forecast = {};
        this.players.forEach(player => {
            this.forecast[player.id] = gameEngine.getForecastData(player.id);
        });
    }

    showEvents() {
        const eventsContainer = document.getElementById('eventsContainer');
        
        if (this.events.length === 0) {
            eventsContainer.innerHTML = `
                <div class="events-panel no-events">
                    <h3 style="color: #38a169; margin-bottom: 10px;">📈 Cenário Estável</h3>
                    <p>Não há eventos especiais afetando o mercado nesta rodada. Condições normais de negócio.</p>
                </div>
            `;
        } else {
            let eventsHTML = `
                <div class="events-panel">
                    <h3 style="color: #c53030; margin-bottom: 15px;">⚠️ Eventos de Mercado Ativos</h3>
            `;
            
            this.events.forEach(event => {
                eventsHTML += `
                    <div class="event-item">
                        <div class="event-title">${event.name}</div>
                        <div class="event-description">${event.description}</div>
                        <small style="color: #718096;">
                            Ativo até a rodada ${event.endRound}
                        </small>
                    </div>
                `;
            });
            
            eventsHTML += '</div>';
            eventsContainer.innerHTML = eventsHTML;
        }
    }

    showPlayer(playerIndex) {
        this.currentPlayer = playerIndex;
        const player = this.players[playerIndex];
        const decisions = this.playerDecisions[player.id];

        // Atualizar navegação
        document.querySelectorAll('[id^="playerBtn"]').forEach(btn => {
            btn.classList.remove('btn-success');
            btn.classList.add('btn-primary');
        });
        document.getElementById(`playerBtn${playerIndex}`).classList.remove('btn-primary');
        document.getElementById(`playerBtn${playerIndex}`).classList.add('btn-success');

        // Atualizar informações do jogador
        document.getElementById('playerName').textContent = player.name;
        document.getElementById('playerCash').textContent = `R$ ${player.cash.toLocaleString()}`;
        
        // Atualizar reputação se elemento existir
        const reputationElement = document.getElementById('playerReputation');
        if (reputationElement) {
            reputationElement.textContent = `${player.reputation}%`;
        }
        
        // Atualizar estoque
        document.getElementById('stockBasic').textContent = player.inventory.basic || 0;
        document.getElementById('stockPremium').textContent = player.inventory.premium || 0;
        document.getElementById('stockDeluxe').textContent = player.inventory.deluxe || 0;

        // Atualizar participação de mercado
        document.getElementById('marketShareNational').textContent = `${(player.marketShare.national || 0).toFixed(1)}%`;
        document.getElementById('marketShareRegional').textContent = `${(player.marketShare.regional || 0).toFixed(1)}%`;
        document.getElementById('marketShareInternational').textContent = `${(player.marketShare.international || 0).toFixed(1)}%`;

        // Carregar decisões salvas
        this.loadPlayerDecisions(decisions);
        
        // Mostrar previsões
        this.showForecast(player.id);
        
        // Atualizar status das decisões
        this.updateDecisionStatus(player.id);
    }

    loadPlayerDecisions(decisions) {
        // Carregar produção
        document.getElementById('prodBasic').value = decisions.production.basic || 0;
        document.getElementById('prodPremium').value = decisions.production.premium || 0;
        document.getElementById('prodDeluxe').value = decisions.production.deluxe || 0;

        // Carregar decisões de mercado
        ['national', 'regional', 'international'].forEach(market => {
            const marketDecision = decisions.markets[market];
            
            document.getElementById(`${market}Active`).checked = marketDecision.active;
            document.getElementById(`${market}Product`).value = marketDecision.product || '';
            document.getElementById(`${market}Price`).value = marketDecision.price || '';
            document.getElementById(`${market}Advertising`).value = marketDecision.advertising || 0;
            
            // Atualizar disponibilidade dos campos
            this.toggleMarketFields(market);
        });
    }

    savePlayerDecisions() {
        const player = this.players[this.currentPlayer];
        const decisions = {
            production: {
                basic: parseInt(document.getElementById('prodBasic').value) || 0,
                premium: parseInt(document.getElementById('prodPremium').value) || 0,
                deluxe: parseInt(document.getElementById('prodDeluxe').value) || 0
            },
            markets: {}
        };

        // Salvar decisões de mercado
        ['national', 'regional', 'international'].forEach(market => {
            decisions.markets[market] = {
                active: document.getElementById(`${market}Active`).checked,
                product: document.getElementById(`${market}Product`).value,
                price: parseFloat(document.getElementById(`${market}Price`).value) || 0,
                advertising: parseFloat(document.getElementById(`${market}Advertising`).value) || 0
            };
        });

        this.playerDecisions[player.id] = decisions;
        
        // Salvar no localStorage via gameState
        gameState.updatePlayerDecisions(player.id, decisions);
        
        // Atualizar status
        this.updateDecisionStatus(player.id);
        
        alert(`Decisões de ${player.name} salvas com sucesso!`);
    }

    updateDecisionStatus(playerId) {
        const decisions = this.playerDecisions[playerId];
        
        // Verificar se as decisões estão completas
        let hasProduction = Object.values(decisions.production).some(qty => qty > 0);
        let hasMarkets = Object.values(decisions.markets).some(market => market.active && market.product && market.price > 0);
        
        // Atualizar indicador visual
        const playerBtn = document.getElementById(`playerBtn${this.players.findIndex(p => p.id === playerId)}`);
        if (hasProduction && hasMarkets) {
            playerBtn.style.background = '#38a169';
            playerBtn.title = 'Decisões completas';
        } else {
            playerBtn.style.background = '#ed8936';
            playerBtn.title = 'Decisões incompletas';
        }
    }

    showForecast(playerId) {
        const forecast = this.forecast[playerId];
        const container = document.getElementById('forecastContainer');
        
        let forecastHTML = '<div class="forecast-grid">';
        
        Object.keys(forecast).forEach(market => {
            const marketName = gameEngine.markets[market].name;
            const data = forecast[market];
            
            forecastHTML += `
                <div class="forecast-card">
                    <div class="market-name">${marketName}</div>
                    <div class="forecast-item">
                        <span class="forecast-label">Demanda Estimada:</span>
                        <span class="forecast-value">${data.estimatedDemand.toLocaleString()}</span>
                    </div>
                    <div class="forecast-item">
                        <span class="forecast-label">Preço Sugerido:</span>
                        <span class="forecast-value">R$ ${data.recommendedPrice}</span>
                    </div>
                    <div class="forecast-item">
                        <span class="forecast-label">Atividade Concorrentes:</span>
                        <span class="forecast-value">${data.competitorActivity}</span>
                    </div>
                    <div class="forecast-item">
                        <span class="forecast-label">Tendência:</span>
                        <span class="forecast-value">${data.marketTrend}</span>
                    </div>
                </div>
            `;
        });
        
        forecastHTML += '</div>';
        container.innerHTML = forecastHTML;
    }

    toggleMarketFields(market) {
        const active = document.getElementById(`${market}Active`).checked;
        
        document.getElementById(`${market}Product`).disabled = !active;
        document.getElementById(`${market}Price`).disabled = !active;
        document.getElementById(`${market}Advertising`).disabled = !active;
        
        if (!active) {
            document.getElementById(`${market}Product`).value = '';
            document.getElementById(`${market}Price`).value = '';
            document.getElementById(`${market}Advertising`).value = 0;
        }
    }

    updatePriceRange(market) {
        const productKey = document.getElementById(`${market}Product`).value;
        const priceInput = document.getElementById(`${market}Price`);
        
        if (productKey && gameEngine.config.products[productKey]) {
            const product = gameEngine.config.products[productKey];
            priceInput.min = product.minPrice;
            priceInput.max = product.maxPrice;
            priceInput.placeholder = `${product.minPrice} - ${product.maxPrice}`;
            
            // Definir preço inicial se estiver vazio
            if (!priceInput.value) {
                priceInput.value = Math.floor((product.minPrice + product.maxPrice) / 2);
            }
        }
    }

    validateAllDecisions() {
        const errors = [];
        
        for (let player of this.players) {
            const decisions = this.playerDecisions[player.id];
            const playerErrors = gameEngine.validatePlayerDecisions(decisions);
            
            if (playerErrors.length > 0) {
                errors.push(`${player.name}: ${playerErrors.join(', ')}`);
            }
            
            // Verificar se jogador tem decisões mínimas
            const hasProduction = Object.values(decisions.production).some(qty => qty > 0);
            const hasMarkets = Object.values(decisions.markets).some(market => market.active);
            
            if (!hasProduction) {
                errors.push(`${player.name}: Nenhuma produção definida`);
            }
            
            if (!hasMarkets) {
                errors.push(`${player.name}: Nenhum mercado selecionado`);
            }
        }
        
        return errors;
    }

    finishRound() {
        // Salvar decisões do jogador atual
        this.savePlayerDecisions();
        
        // Validar todas as decisões
        const errors = this.validateAllDecisions();
        
        if (errors.length > 0) {
            alert('Erros encontrados:\n\n' + errors.join('\n\n') + '\n\nPor favor, corrija os erros antes de finalizar a rodada.');
            return;
        }
        
        if (confirm('Tem certeza que deseja finalizar esta rodada? Após confirmar, não será possível alterar as decisões.')) {
            // Processar rodada
            const results = gameEngine.processRound();
            
            // Salvar resultados
            const state = gameState.loadState();
            
            // Verificar se é a última rodada
            if (state.currentRound >= state.totalRounds) {
                gameState.endGame();
                window.location.href = 'final.html';
            } else {
                // Avançar para próxima rodada
                gameState.nextRound();
                const nextRound = state.currentRound + 1;
                window.location.href = `rodada${nextRound}.html`;
            }
        }
    }

    // Função auxiliar para formatar moeda
    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }
}

// Instância global da lógica da rodada
window.roundLogic = new RoundLogic();