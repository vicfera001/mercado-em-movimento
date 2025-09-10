class GameEngine {
    constructor() {
        this.markets = null;
        this.config = null;
        this.events = null;
        this.loadGameData();
    }

    // Carregar dados do jogo
    async loadGameData() {
        try {
            const [marketsData, configData, eventsData] = await Promise.all([
                fetch('data/markets.json').then(r => r.json()),
                fetch('data/config.json').then(r => r.json()),
                fetch('data/events.json').then(r => r.json())
            ]);
            
            this.markets = marketsData;
            this.config = configData;
            this.events = eventsData.events;
            
            console.log('Dados do jogo carregados com sucesso');
        } catch (error) {
            console.error('Erro ao carregar dados do jogo:', error);
        }
    }

    // Calcular demanda de mercado
    calculateMarketDemand(market, price, advertising, quality, playerMarketShare) {
        if (!this.markets[market]) return 0;

        const marketData = this.markets[market];
        const effects = gameState.calculateEventEffects();
        
        // Demanda base ajustada por eventos
        let baseDemand = marketData.baseDemand * (1 + effects.marketDemandMultiplier[market]);
        
        // Efeito do preço (sensibilidade ajustada por eventos)
        const priceEffect = Math.pow(price / 100, -marketData.priceSensitivity * effects.priceSensitivityMultiplier[market]);
        
        // Efeito da propaganda (sensibilidade ajustada por eventos)
        const adEffect = 1 + (advertising / 10000) * marketData.advertisingSensitivity * effects.advertisingSensitivityMultiplier[market];
        
        // Efeito da qualidade (sensibilidade ajustada por eventos)
        const qualityEffect = Math.pow(quality / 5, marketData.qualitySensitivity * effects.qualitySensitivityMultiplier[market]);
        
        // Efeito da participação no mercado (experiência)
        const marketShareEffect = 1 + (playerMarketShare / 100) * 0.1;
        
        // Cálculo final da demanda
        const demand = baseDemand * priceEffect * adEffect * qualityEffect * marketShareEffect;
        
        return Math.max(0, Math.floor(demand));
    }

    // Calcular custos de transporte
    calculateTransportCost(market, quantity) {
        if (!this.markets[market] || quantity <= 0) return 0;

        const marketData = this.markets[market];
        const effects = gameState.calculateEventEffects();
        
        const baseCost = marketData.transportCost * effects.transportCostMultiplier[market];
        return baseCost * quantity;
    }

    // Calcular custos de produção
    calculateProductionCost(product, quantity) {
        if (!this.config.products[product] || quantity <= 0) return 0;

        const productData = this.config.products[product];
        const effects = gameState.calculateEventEffects();
        
        const unitCost = productData.productionCost * effects.productionCostMultiplier;
        return unitCost * quantity;
    }

    // Simular vendas de um jogador
    simulatePlayerSales(player, decisions) {
        const results = {
            sales: { national: 0, regional: 0, international: 0 },
            revenue: { national: 0, regional: 0, international: 0 },
            costs: {
                production: 0,
                transport: { national: 0, regional: 0, international: 0 },
                advertising: 0
            },
            profit: 0,
            unitsProduced: 0,
            unitsSold: 0
        };

        // Calcular custos de produção
        Object.keys(decisions.production || {}).forEach(product => {
            const quantity = decisions.production[product] || 0;
            results.costs.production += this.calculateProductionCost(product, quantity);
            results.unitsProduced += quantity;
        });

        // Simular vendas por mercado
        Object.keys(decisions.markets || {}).forEach(market => {
            const marketDecision = decisions.markets[market];
            if (!marketDecision.active) return;

            const product = marketDecision.product;
            const price = marketDecision.price;
            const advertising = marketDecision.advertising || 0;
            
            if (!this.config.products[product]) return;

            const quality = this.config.products[product].quality;
            const playerMarketShare = player.marketShare[market] || 0;

            // Calcular demanda
            const demand = this.calculateMarketDemand(market, price, advertising, quality, playerMarketShare);
            
            // Verificar estoque disponível
            const availableStock = player.inventory[product] || 0;
            const unitsSold = Math.min(demand, availableStock);

            results.sales[market] = unitsSold;
            results.revenue[market] = unitsSold * price;
            results.costs.transport[market] = this.calculateTransportCost(market, unitsSold);
            results.unitsSold += unitsSold;
        });

        // Custos de propaganda
        results.costs.advertising = Object.values(decisions.markets || {})
            .reduce((sum, market) => sum + (market.advertising || 0), 0);

        // Calcular lucro total
        const totalRevenue = Object.values(results.revenue).reduce((sum, r) => sum + r, 0);
        const totalCosts = results.costs.production + 
                          Object.values(results.costs.transport).reduce((sum, c) => sum + c, 0) + 
                          results.costs.advertising;
        
        results.profit = totalRevenue - totalCosts;

        return results;
    }

    // Processar rodada completa
    processRound() {
        const state = gameState.loadState();
        const roundResults = [];

        // Simular cada jogador
        state.players.forEach(player => {
            const playerDecisions = player.decisions || {};
            const results = this.simulatePlayerSales(player, playerDecisions);
            
            // Atualizar estado do jogador
            player.cash += results.profit;
            
            // Atualizar estoque (adicionar produção, subtrair vendas)
            Object.keys(playerDecisions.production || {}).forEach(product => {
                player.inventory[product] = (player.inventory[product] || 0) + (playerDecisions.production[product] || 0);
            });

            Object.keys(results.sales).forEach(market => {
                const marketDecision = playerDecisions.markets?.[market];
                if (marketDecision?.active && marketDecision?.product) {
                    player.inventory[marketDecision.product] -= results.sales[market];
                    
                    // Atualizar participação no mercado (simplified)
                    const marketShareGain = results.sales[market] / 100;
                    player.marketShare[market] = Math.min(100, 
                        (player.marketShare[market] || 0) + marketShareGain);
                }
            });

            // Calcular pontuação da rodada
            const roundScore = this.calculatePlayerScore(player);
            player.roundScores.push(roundScore);
            player.totalScore = player.roundScores.reduce((sum, score) => sum + score, 0);
            
            roundResults.push({
                playerId: player.id,
                playerName: player.name,
                results: results,
                score: roundScore,
                cash: player.cash,
                marketShare: { ...player.marketShare }
            });

            // Limpar decisões para próxima rodada
            player.decisions = {};
        });

        // Salvar resultados da rodada
        state.roundResults.push({
            round: state.currentRound,
            results: roundResults
        });

        gameState.saveState(state);
        return roundResults;
    }

    // Calcular pontuação do jogador
    calculatePlayerScore(player) {
        const scoring = this.config.scoring;
        
        const cashScore = (player.cash / 10000) * scoring.cashWeight;
        const marketShareScore = (Object.values(player.marketShare).reduce((sum, ms) => sum + ms, 0) / 3) * scoring.marketShareWeight;
        const inventoryScore = (Object.values(player.inventory).reduce((sum, inv) => sum + inv, 0) / 100) * scoring.inventoryWeight;
        const reputationScore = (player.reputation / 100) * scoring.reputationWeight;
        
        return Math.floor(cashScore + marketShareScore + inventoryScore + reputationScore);
    }

    // Gerar evento aleatório para a rodada
    generateRandomEvent() {
        if (!this.events || Math.random() > 0.7) return null; // 70% de chance de evento
        
        const activeEvents = gameState.getActiveEvents();
        const availableEvents = this.events.filter(event => 
            !activeEvents.some(active => active.id === event.id)
        );
        
        if (availableEvents.length === 0) return null;
        
        const randomEvent = availableEvents[Math.floor(Math.random() * availableEvents.length)];
        return randomEvent;
    }

    // Obter dados de previsão (dados parciais para cada jogador)
    getForecastData(playerId) {
        const state = gameState.loadState();
        const effects = gameState.calculateEventEffects();
        
        // Cada jogador vê dados ligeiramente diferentes (simulando informação incompleta)
        const noise = (playerId * 0.1) - 0.2; // -0.2 a 0.2 de variação
        
        const forecast = {};
        Object.keys(this.markets).forEach(market => {
            const marketData = this.markets[market];
            forecast[market] = {
                estimatedDemand: Math.floor(marketData.baseDemand * (1 + effects.marketDemandMultiplier[market]) * (1 + noise)),
                recommendedPrice: Math.floor(75 + (Math.random() * 50)), // 75-125
                competitorActivity: Math.random() > 0.5 ? 'Alta' : 'Média',
                marketTrend: Math.random() > 0.5 ? 'Crescimento' : 'Estável'
            };
        });
        
        return forecast;
    }

    // Validar decisões do jogador
    validatePlayerDecisions(decisions) {
        const errors = [];
        
        // Validar produção
        if (decisions.production) {
            Object.keys(decisions.production).forEach(product => {
                const quantity = decisions.production[product];
                if (quantity < 0) {
                    errors.push(`Quantidade de produção inválida para ${product}`);
                }
            });
        }
        
        // Validar mercados
        if (decisions.markets) {
            Object.keys(decisions.markets).forEach(market => {
                const marketDecision = decisions.markets[market];
                if (marketDecision.active) {
                    if (!marketDecision.product || !this.config.products[marketDecision.product]) {
                        errors.push(`Produto inválido selecionado para mercado ${market}`);
                    }
                    
                    const productData = this.config.products[marketDecision.product];
                    if (productData) {
                        if (marketDecision.price < productData.minPrice || marketDecision.price > productData.maxPrice) {
                            errors.push(`Preço fora do intervalo permitido para ${marketDecision.product} no mercado ${market}`);
                        }
                    }
                    
                    if (marketDecision.advertising < 0) {
                        errors.push(`Investimento em propaganda inválido para mercado ${market}`);
                    }
                }
            });
        }
        
        return errors;
    }
}

// Instância global do motor do jogo
window.gameEngine = new GameEngine();