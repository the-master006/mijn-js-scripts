// AccuThuis Batterij Simulator v15.0 - Nieuwe pakketten en prijzen
// Host dit bestand op GitHub/jsDelivr
console.log('AccuThuis Simulator v15.0 geladen - Nieuwe pakketten en prijzen');

(function() {
    "use strict";
    
    // ==================== PAKKET DEFINITIES ====================
    // Basis modus: indices 0, 1, 2
    // Uitgebreide modus: alle pakketten
    var PAKKETTEN = [
        { id: 0, name: 'Geen batterij', capacity: 0, price: 0, inverterCharge: 0, inverterDischarge: 0, phase: '-' },
        { id: 1, name: 'Plus', capacity: 5, price: 2999, inverterCharge: 1.82, inverterDischarge: 3.0, phase: '1-fase 3kVA' },
        { id: 2, name: 'Pro', capacity: 14, price: 4699, inverterCharge: 3.64, inverterDischarge: 5.0, phase: '1-fase 5kVA' },
        { id: 3, name: 'Pro+', capacity: 29, price: 8199, inverterCharge: 3.64, inverterDischarge: 5.0, phase: '1-fase 5kVA' },
        { id: 4, name: '3p 9kVA 2 accu', capacity: 29, price: 11599, inverterCharge: 5.4, inverterDischarge: 7.2, phase: '3-fase 7.2kW' },
        { id: 5, name: '3p 9kVA 3 accu', capacity: 43, price: 13599, inverterCharge: 5.4, inverterDischarge: 7.2, phase: '3-fase 7.2kW' },
        { id: 6, name: '3p 15kVA 2 accu', capacity: 29, price: 12399, inverterCharge: 9.0, inverterDischarge: 12.0, phase: '3-fase 12kW' },
        { id: 7, name: '3p 15kVA 3 accu', capacity: 43, price: 14399, inverterCharge: 9.0, inverterDischarge: 12.0, phase: '3-fase 12kW' }
    ];
    
    // ==================== STATE ====================
    var isAdvancedMode = false;
    var baseHourlyData = [];
    var monthlyChart, distributionChart, dailyChart, cumulativeChart;
    var currentDay = 172;
    var monthlyProductionData = [];
    var monthlyConsumptionData = [];
    var simulationResults = {
        inputs: { solarWp: 3600, annualConsumption: 4000 },
        monthlyData: { production: [], consumption: [] },
        scenarios: {} // Cache voor alle pakket scenario's
    };
    
    // ==================== PASSWORD ====================
    function showPasswordModal() { 
        document.getElementById('passwordModal').classList.add('visible'); 
        document.getElementById('passwordInput').focus();
    }
    
    function closePasswordModal() { 
        document.getElementById('passwordModal').classList.remove('visible'); 
        document.getElementById('passwordInput').value = ''; 
    }
    
    function checkPassword() {
        if (document.getElementById('passwordInput').value === 'accuthuis2025') { 
            unlockAdvanced(); 
            closePasswordModal(); 
        } else { 
            alert('Onjuist wachtwoord'); 
        }
    }
    
    function unlockAdvanced() {
        isAdvancedMode = true;
        document.getElementById('advancedBadge').classList.add('visible');
        document.getElementById('batteryCapacity').max = PAKKETTEN.length - 1; // 0-7
        document.getElementById('chartsSection').classList.add('visible');
        document.getElementById('lockBtnContainer').style.display = 'block';
        var advInputs = document.getElementById('advancedInputs');
        if (advInputs) advInputs.style.display = 'grid';
        recalculateBatteryEffects();
        updateCharts();
    }
    
    function lockAdvanced() {
        isAdvancedMode = false;
        document.getElementById('advancedBadge').classList.remove('visible');
        document.getElementById('batteryCapacity').max = 2; // Alleen 0, 1, 2 (Geen, Plus, Pro)
        var slider = document.getElementById('batteryCapacity');
        if (parseInt(slider.value) > 2) slider.value = 2;
        document.getElementById('chartsSection').classList.remove('visible');
        document.getElementById('lockBtnContainer').style.display = 'none';
        var advInputs = document.getElementById('advancedInputs');
        if (advInputs) advInputs.style.display = 'none';
        recalculateBatteryEffects();
    }
    
    // ==================== GET INPUT VALUES ====================
    function getInputValues() {
        var contractTypeEl = document.getElementById('contractType');
        var vastTariefEl = document.getElementById('vastTarief');
        var feedInTariffEl = document.getElementById('feedInTariff');
        var chargingStrategyEl = document.getElementById('chargingStrategy');
        
        var contractType = contractTypeEl ? parseInt(contractTypeEl.value) : 1;
        var vastTariefCents = vastTariefEl ? parseInt(vastTariefEl.value) : 30;
        var feedInCents = feedInTariffEl ? parseInt(feedInTariffEl.value) : 1;
        var chargingStrategy = chargingStrategyEl ? parseInt(chargingStrategyEl.value) : 0;
        
        return {
            isDynamic: contractType === 1,
            vastTarief: vastTariefCents / 100,
            feedInTariff: feedInCents / 100,
            smartCharging: contractType === 1 && chargingStrategy === 1
        };
    }
    
    // ==================== SIMULATION ====================
    function runSimulation() {
        var solarWp = parseInt(document.getElementById('solarCapacity').value);
        var annualConsumption = parseInt(document.getElementById('annualConsumption').value);
        var systemSizeKw = solarWp / 1000;
        
        simulationResults.inputs = { solarWp: solarWp, annualConsumption: annualConsumption };
        
        var peakSunHours = [0.73, 1.35, 2.51, 3.72, 4.46, 4.65, 4.56, 4.0, 2.79, 1.77, 0.91, 0.54];
        var daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var solarPattern = [0, 0, 0, 0, 0, 0, 0, 0.05, 0.15, 0.35, 0.60, 0.85, 1.0, 0.95, 0.75, 0.50, 0.25, 0.10, 0.02, 0, 0, 0, 0, 0];
        var consumptionPattern = [0.3, 0.25, 0.25, 0.25, 0.3, 0.4, 0.7, 1.5, 1.8, 1.0, 0.6, 0.5, 0.5, 0.5, 0.5, 0.6, 0.7, 1.0, 1.8, 2.5, 2.0, 1.5, 0.8, 0.5];
        var solarSum = 0, consSum = 0;
        for (var i = 0; i < 24; i++) { solarSum += solarPattern[i]; consSum += consumptionPattern[i]; }
        
        baseHourlyData = [];
        monthlyProductionData = [0,0,0,0,0,0,0,0,0,0,0,0];
        monthlyConsumptionData = [0,0,0,0,0,0,0,0,0,0,0,0];
        var dayCounter = 0;
        var weatherVar = 0.90 + Math.random() * 0.20;
        
        for (var m = 0; m < 12; m++) {
            var seasonFactor = [1.15, 1.10, 1.05, 1.00, 0.90, 0.85, 0.80, 0.85, 0.90, 1.00, 1.10, 1.15][m];
            var monthlyConsTarget = (annualConsumption / 12) * seasonFactor;
            var dailyConsTarget = monthlyConsTarget / daysInMonth[m];
            
            for (var d = 0; d < daysInMonth[m]; d++) {
                var dayWeather = weatherVar * (0.90 + Math.random() * 0.20);
                var cloudFactor = Math.random() > 0.68 ? 0.6 : 1.0;
                var isWeekend = dayCounter % 7 < 2;
                var weekendFactor = isWeekend ? 1.1 : 0.95;
                var dailySolar = peakSunHours[m] * dayWeather * cloudFactor;
                
                for (var h = 0; h < 24; h++) {
                    var prodFactor = dailySolar * (solarPattern[h] / solarSum);
                    var consFactor = (dailyConsTarget * (consumptionPattern[h] / consSum) * weekendFactor * (0.9 + Math.random() * 0.2)) / annualConsumption;
                    
                    baseHourlyData.push({ productionFactor: prodFactor, consumptionFactor: consFactor, hour: h, month: m, dayOfYear: dayCounter });
                    monthlyProductionData[m] += systemSizeKw * prodFactor;
                    monthlyConsumptionData[m] += annualConsumption * consFactor;
                }
                dayCounter++;
            }
        }
        
        simulationResults.monthlyData = { production: monthlyProductionData.slice(), consumption: monthlyConsumptionData.slice() };
        
        // Pre-calculate scenarios voor Plus en Pro (voor cumulatieve grafiek)
        simulationResults.scenarios = {};
        simulationResults.scenarios[1] = simulateScenario(1); // Plus
        simulationResults.scenarios[2] = simulateScenario(2); // Pro
        
        recalculateBatteryEffects();
        if (isAdvancedMode) updateCharts();
    }
    
    function simulateScenario(pakketIndex) {
        var pakket = PAKKETTEN[pakketIndex];
        var batteryCapacity = pakket.capacity;
        var pakketPrice = pakket.price;
        var inverterMaxCharge = pakket.inverterCharge;
        var inverterMaxDischarge = pakket.inverterDischarge;
        
        var solarWp = parseInt(document.getElementById('solarCapacity').value);
        var annualConsumption = parseInt(document.getElementById('annualConsumption').value);
        var systemSizeKw = solarWp / 1000;
        var batteryEfficiency = 0.95;
        
        var inputs = getInputValues();
        var feedInTariff = inputs.feedInTariff;
        var vastTarief = inputs.vastTarief;
        var isDynamic = inputs.isDynamic;
        var smartCharging = inputs.smartCharging && batteryCapacity > 0;
        
        var dynamicPrices = [0.20,0.19,0.18,0.18,0.19,0.21,0.25,0.28,0.30,0.29,0.27,0.25,0.24,0.23,0.22,0.24,0.27,0.32,0.38,0.42,0.40,0.35,0.28,0.23];
        var prices = [];
        for (var p = 0; p < 24; p++) { 
            prices.push(isDynamic ? dynamicPrices[p] : vastTarief); 
        }
        
        var totalProduction = 0, totalConsumption = 0, totalGridPurchase = 0, totalGridExport = 0;
        var totalBatteryDischarged = 0, totalDirect = 0, totalEnergyCost = 0, totalFeedInRevenue = 0;
        var batteryLevel = batteryCapacity * 0.5;
        
        for (var i = 0; i < baseHourlyData.length; i++) {
            var base = baseHourlyData[i];
            var production = systemSizeKw * base.productionFactor;
            var consumption = annualConsumption * base.consumptionFactor;
            totalProduction += production;
            totalConsumption += consumption;
            
            var solarDirect = Math.min(production, consumption);
            var excessSolar = production - solarDirect;
            var unmetConsumption = consumption - solarDirect;
            
            // Laad batterij met overtollige zonne-energie
            if (batteryCapacity > 0 && excessSolar > 0 && batteryLevel < batteryCapacity) {
                var toStore = Math.min(excessSolar, (batteryCapacity - batteryLevel) / batteryEfficiency, inverterMaxCharge);
                batteryLevel += toStore * batteryEfficiency;
                excessSolar -= toStore;
            }
            
            // Smart charging (DESS)
            if (smartCharging && batteryLevel < batteryCapacity) {
                var hourPrice = prices[base.hour];
                var isWinter = base.month <= 2 || base.month >= 9;
                var batteryPct = (batteryLevel / batteryCapacity) * 100;
                var prodRatio = (systemSizeKw * 1000) / annualConsumption;
                var isLowSolar = prodRatio < 0.7;
                var shouldCharge = false;
                var maxLevel = batteryCapacity;
                
                if (systemSizeKw > 0 && !isLowSolar) {
                    maxLevel = batteryCapacity * (isWinter ? 0.85 : 0.65);
                    shouldCharge = isWinter && hourPrice < 0.22 && base.hour >= 1 && base.hour < 5 && batteryPct < 35;
                } else if (systemSizeKw > 0 && isLowSolar) {
                    maxLevel = batteryCapacity * 0.95;
                    shouldCharge = hourPrice < 0.23 && base.hour >= 0 && base.hour < 7 && batteryPct < 75;
                } else {
                    maxLevel = batteryCapacity * 0.95;
                    shouldCharge = hourPrice < 0.25 && base.hour >= 0 && base.hour < 7 && batteryPct < 60;
                }
                
                if (shouldCharge && batteryLevel < maxLevel) {
                    var gridCharging = Math.min((maxLevel - batteryLevel) / batteryEfficiency, inverterMaxCharge);
                    var stored = gridCharging * batteryEfficiency;
                    var usedDirect = Math.min(unmetConsumption, stored);
                    batteryLevel += stored - usedDirect;
                    unmetConsumption -= usedDirect;
                    totalBatteryDischarged += usedDirect;
                    totalEnergyCost += gridCharging * hourPrice;
                    totalGridPurchase += gridCharging;
                }
            }
            
            // Ontlaad batterij
            if (batteryCapacity > 0 && unmetConsumption > 0 && batteryLevel > 0) {
                var discharge = Math.min(unmetConsumption / batteryEfficiency, batteryLevel, inverterMaxDischarge);
                var usable = discharge * batteryEfficiency;
                batteryLevel -= discharge;
                unmetConsumption -= usable;
                totalBatteryDischarged += usable;
            }
            
            batteryLevel = Math.max(0, Math.min(batteryCapacity, batteryLevel));
            totalEnergyCost += unmetConsumption * prices[base.hour];
            totalFeedInRevenue += excessSolar * feedInTariff;
            totalGridPurchase += unmetConsumption;
            totalGridExport += excessSolar;
            totalDirect += solarDirect;
            
            base.production = production;
            base.consumption = consumption;
            base.solarDirect = solarDirect;
            base.gridExport = excessSolar;
        }
        
        // Baseline: kosten zonder batterij met dezelfde prijzen
        var baselineCost = 0;
        for (var j = 0; j < baseHourlyData.length; j++) {
            var b = baseHourlyData[j];
            var prod = systemSizeKw * b.productionFactor;
            var cons = annualConsumption * b.consumptionFactor;
            var dir = Math.min(prod, cons);
            baselineCost += (cons - dir) * prices[b.hour];
            baselineCost -= (prod - dir) * feedInTariff;
        }
        
        var selfSufficiency = ((totalConsumption - totalGridPurchase) / totalConsumption) * 100;
        var netEnergyCost = totalEnergyCost - totalFeedInRevenue;
        var annualSavings = batteryCapacity > 0 ? (baselineCost - netEnergyCost) : 0;
        var roiYears = (annualSavings > 0 && pakketPrice > 0) ? pakketPrice / annualSavings : null;
        var lifetimeSavings = batteryCapacity > 0 ? annualSavings * 15 * 0.90 : 0;
        
        return {
            pakketIndex: pakketIndex,
            pakketName: pakket.name,
            pakketPrice: pakketPrice,
            capacity: batteryCapacity,
            phase: pakket.phase,
            totalProduction: Math.round(totalProduction),
            totalConsumption: Math.round(totalConsumption),
            gridPurchase: Math.round(totalGridPurchase),
            gridExport: Math.round(totalGridExport),
            selfSufficiency: Math.round(selfSufficiency),
            netEnergyCost: Math.round(netEnergyCost),
            baselineCost: Math.round(baselineCost),
            annualSavings: Math.round(annualSavings),
            savingsPercent: Math.round(batteryCapacity > 0 ? (annualSavings / baselineCost) * 100 : 0),
            roiYears: roiYears ? parseFloat(roiYears.toFixed(1)) : null,
            lifetimeSavings: Math.round(lifetimeSavings),
            netProfit: Math.round(lifetimeSavings - pakketPrice),
            batteryUsage: Math.round(totalBatteryDischarged),
            directUsage: Math.round(totalDirect)
        };
    }
    
    function recalculateBatteryEffects() {
        var sliderValue = parseInt(document.getElementById('batteryCapacity').value);
        var pakketIndex = sliderValue; // Direct mapping: slider waarde = pakket index
        
        var result = simulateScenario(pakketIndex);
        simulationResults.scenarios[pakketIndex] = result;
        
        var pakket = PAKKETTEN[pakketIndex];
        var roiText = pakket.capacity === 0 ? '-' : 
            (result.roiYears ? result.roiYears + ' jaar (' + pakket.name + ')' : 'Geen besparing');
        
        document.getElementById('productionValue').textContent = result.totalProduction + ' kWh';
        document.getElementById('selfSufficiencyValue').textContent = result.selfSufficiency + '%';
        document.getElementById('gridPurchaseValue').textContent = result.gridPurchase + ' kWh';
        document.getElementById('gridExportValue').textContent = result.gridExport + ' kWh';
        document.getElementById('savingsPercentValue').textContent = result.savingsPercent + '%';
        document.getElementById('energyCostsValue').textContent = '€' + result.netEnergyCost;
        document.getElementById('savingsValue').textContent = '€' + result.annualSavings;
        document.getElementById('roiValue').textContent = roiText;
        document.getElementById('lifetimeSavingsValue').textContent = '€' + result.lifetimeSavings.toLocaleString('nl-NL');
        
        if (isAdvancedMode) updateCharts();
    }
    
    // ==================== CHARTS ====================
    function updateCharts() {
        if (!isAdvancedMode) return;
        updateCumulativeChart();
        updateMonthlyChart();
        updateDistributionChart();
        updateDailyChart(currentDay);
    }
    
    function updateCumulativeChart() {
        // Gebruik Plus en Pro voor vergelijking
        var plus = simulationResults.scenarios[1] || simulateScenario(1);
        var pro = simulationResults.scenarios[2] || simulateScenario(2);
        
        var plusPrice = PAKKETTEN[1].price;
        var proPrice = PAKKETTEN[2].price;
        
        var years = [];
        for (var y = 0; y <= 15; y++) years.push('Jaar ' + y);
        
        var plusData = [-plusPrice], proData = [-proPrice];
        var plusCum = -plusPrice, proCum = -proPrice;
        
        for (var yr = 1; yr <= 15; yr++) {
            var deg = Math.pow(0.98, yr - 1);
            plusCum += plus.annualSavings * deg;
            proCum += pro.annualSavings * deg;
            plusData.push(Math.round(plusCum));
            proData.push(Math.round(proCum));
        }
        
        if (cumulativeChart) cumulativeChart.destroy();
        cumulativeChart = new Chart(document.getElementById('cumulativeChart'), {
            type: 'line',
            data: { 
                labels: years, 
                datasets: [
                    { label: 'Plus (5 kWh) - €' + plusPrice, data: plusData, borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, fill: true, tension: 0.3 },
                    { label: 'Pro (14 kWh) - €' + proPrice, data: proData, borderColor: 'rgba(16, 185, 129, 1)', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 3, fill: true, tension: 0.3 },
                    { label: 'Break-even', data: Array(16).fill(0), borderColor: 'rgba(156, 163, 175, 0.8)', borderWidth: 2, borderDash: [8, 4], pointRadius: 0 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: 'Cumulatief (€)' } } }, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    function updateMonthlyChart() {
        var months = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
        if (monthlyChart) monthlyChart.destroy();
        monthlyChart = new Chart(document.getElementById('monthlyChart'), {
            type: 'bar',
            data: { labels: months, datasets: [
                { label: 'Productie', data: monthlyProductionData.map(function(v) { return Math.round(v); }), backgroundColor: 'rgba(16, 185, 129, 0.7)' },
                { label: 'Verbruik', data: monthlyConsumptionData.map(function(v) { return Math.round(v); }), backgroundColor: 'rgba(239, 68, 68, 0.7)' }
            ]},
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    function updateDistributionChart() {
        var sliderValue = parseInt(document.getElementById('batteryCapacity').value);
        var result = simulationResults.scenarios[sliderValue] || simulateScenario(sliderValue);
        
        if (distributionChart) distributionChart.destroy();
        distributionChart = new Chart(document.getElementById('distributionChart'), {
            type: 'doughnut',
            data: { labels: ['Direct', 'Batterij', 'Teruggeleverd'], datasets: [{ data: [result.directUsage || 0, result.batteryUsage || 0, result.gridExport || 0], backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(245, 158, 11, 0.8)'] }]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    function simulateDayForChart(dayOfYear, pakketIndex) {
        var pakket = PAKKETTEN[pakketIndex];
        var batteryCapacity = pakket.capacity;
        var inverterMaxCharge = pakket.inverterCharge;
        var inverterMaxDischarge = pakket.inverterDischarge;
        
        var solarWp = parseInt(document.getElementById('solarCapacity').value);
        var annualConsumption = parseInt(document.getElementById('annualConsumption').value);
        var systemSizeKw = solarWp / 1000;
        var batteryEfficiency = 0.95;
        var inputs = getInputValues();
        
        var solarPatterns = {
            summer: [0, 0, 0, 0, 0.02, 0.08, 0.20, 0.40, 0.58, 0.75, 0.88, 0.95, 0.98, 0.96, 0.90, 0.78, 0.60, 0.42, 0.22, 0.08, 0.02, 0, 0, 0],
            winter: [0, 0, 0, 0, 0, 0, 0, 0, 0.03, 0.10, 0.20, 0.30, 0.35, 0.32, 0.25, 0.12, 0.03, 0, 0, 0, 0, 0, 0, 0],
            spring: [0, 0, 0, 0, 0, 0, 0.05, 0.15, 0.30, 0.45, 0.55, 0.62, 0.65, 0.62, 0.55, 0.42, 0.28, 0.12, 0.03, 0, 0, 0, 0, 0],
            autumn: [0, 0, 0, 0, 0, 0, 0.02, 0.10, 0.22, 0.35, 0.45, 0.52, 0.55, 0.52, 0.45, 0.32, 0.18, 0.06, 0, 0, 0, 0, 0, 0]
        };
        var seasonFactors = { summer: 0.80, winter: 1.25, spring: 0.95, autumn: 1.00 };
        var solarPattern, seasonFactor;
        if (dayOfYear >= 80 && dayOfYear < 172) { solarPattern = solarPatterns.spring; seasonFactor = seasonFactors.spring; }
        else if (dayOfYear >= 172 && dayOfYear < 264) { solarPattern = solarPatterns.summer; seasonFactor = seasonFactors.summer; }
        else if (dayOfYear >= 264 && dayOfYear < 355) { solarPattern = solarPatterns.autumn; seasonFactor = seasonFactors.autumn; }
        else { solarPattern = solarPatterns.winter; seasonFactor = seasonFactors.winter; }
        
        var dailyConsumption = (annualConsumption / 365) * seasonFactor;
        var consumptionPattern = [0.3, 0.25, 0.25, 0.25, 0.3, 0.4, 0.7, 1.2, 1.0, 0.6, 0.5, 0.5, 0.6, 0.5, 0.5, 0.6, 0.8, 1.2, 1.5, 1.4, 1.2, 0.9, 0.6, 0.4];
        var consSum = 0; for (var c = 0; c < 24; c++) consSum += consumptionPattern[c];
        var batteryLevel = batteryCapacity * 0.3;
        var dayData = [];
        
        var dynamicPrices = [0.20,0.19,0.18,0.18,0.19,0.21,0.25,0.28,0.30,0.29,0.27,0.25,0.24,0.23,0.22,0.24,0.27,0.32,0.38,0.42,0.40,0.35,0.28,0.23];
        var prices = inputs.isDynamic ? dynamicPrices : Array(24).fill(inputs.vastTarief);
        
        for (var h = 0; h < 24; h++) {
            var solarSum = 0; for (var s = 0; s < 24; s++) solarSum += solarPattern[s];
            var production = systemSizeKw * (solarPattern[h] / (solarSum || 1)) * 5;
            var consumption = dailyConsumption * (consumptionPattern[h] / consSum);
            var solarDirect = Math.min(production, consumption);
            var excessSolar = production - solarDirect;
            var unmetConsumption = consumption - solarDirect;
            var batteryCharge = 0, batteryDischarge = 0, gridCharging = 0;
            
            if (batteryCapacity > 0 && excessSolar > 0) {
                var toCharge = Math.min(excessSolar, (batteryCapacity - batteryLevel) / batteryEfficiency, inverterMaxCharge);
                batteryCharge = toCharge;
                batteryLevel += toCharge * batteryEfficiency;
                excessSolar -= toCharge;
            }
            
            if (inputs.smartCharging && batteryCapacity > 0 && h >= 0 && h < 7 && prices[h] < 0.22) {
                var maxLevel = batteryCapacity * 0.85;
                if (batteryLevel < maxLevel) {
                    gridCharging = Math.min((maxLevel - batteryLevel) / batteryEfficiency, inverterMaxCharge);
                    batteryLevel += gridCharging * batteryEfficiency;
                }
            }
            
            if (batteryCapacity > 0 && unmetConsumption > 0 && batteryLevel > 0) {
                var toDischarge = Math.min(unmetConsumption / batteryEfficiency, batteryLevel, inverterMaxDischarge);
                batteryDischarge = toDischarge * batteryEfficiency;
                batteryLevel -= toDischarge;
                unmetConsumption -= batteryDischarge;
            }
            
            dayData.push({
                hour: h,
                production: production,
                consumption: consumption,
                solarDirect: solarDirect,
                batteryCharge: batteryCharge,
                batteryDischarge: batteryDischarge,
                gridCharging: gridCharging,
                gridImport: unmetConsumption,
                gridExport: excessSolar,
                batterySoC: batteryCapacity > 0 ? (batteryLevel / batteryCapacity) * 100 : 0
            });
        }
        return dayData;
    }
    
    function updateDailyChart(dayOfYear) {
        var sliderValue = parseInt(document.getElementById('batteryCapacity').value);
        var dayData = simulateDayForChart(dayOfYear, sliderValue);
        var hours = [], production = [], consumption = [], solarDirect = [], batteryCharge = [], batteryDischarge = [], gridCharging = [], gridImport = [], gridExport = [], batterySoC = [];
        
        for (var i = 0; i < 24; i++) {
            hours.push(i + ':00');
            var d = dayData[i];
            production.push(d.production.toFixed(2));
            consumption.push(d.consumption.toFixed(2));
            solarDirect.push(d.solarDirect.toFixed(2));
            batteryCharge.push(d.batteryCharge.toFixed(2));
            batteryDischarge.push(d.batteryDischarge.toFixed(2));
            gridCharging.push(d.gridCharging.toFixed(2));
            gridImport.push(d.gridImport.toFixed(2));
            gridExport.push(d.gridExport.toFixed(2));
            batterySoC.push(d.batterySoC.toFixed(1));
        }
        
        if (dailyChart) dailyChart.destroy();
        dailyChart = new Chart(document.getElementById('dailyChart'), {
            type: 'line',
            data: {
                labels: hours,
                datasets: [
                    { label: '☀️ Productie', data: production, borderColor: 'rgba(241, 196, 15, 1)', backgroundColor: 'rgba(241, 196, 15, 0.1)', borderWidth: 2, fill: true, tension: 0.4, yAxisID: 'y' },
                    { label: '🏠 Verbruik', data: consumption, borderColor: 'rgba(239, 68, 68, 1)', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 2, fill: true, tension: 0.4, yAxisID: 'y' },
                    { label: '⚡ Direct', data: solarDirect, borderColor: 'rgba(16, 185, 129, 1)', borderWidth: 2, fill: false, tension: 0.4, yAxisID: 'y' },
                    { label: '🔋 Laden', data: batteryCharge, borderColor: 'rgba(139, 92, 246, 1)', borderWidth: 2, fill: false, tension: 0.4, yAxisID: 'y' },
                    { label: '🔋 Ontladen', data: batteryDischarge, borderColor: 'rgba(109, 40, 217, 1)', borderWidth: 2, fill: false, tension: 0.4, yAxisID: 'y' },
                    { label: '⚡ DESS', data: gridCharging, borderColor: 'rgba(6, 182, 212, 1)', borderWidth: 2, fill: false, tension: 0.4, yAxisID: 'y' },
                    { label: '🔌 Inkoop', data: gridImport, borderColor: 'rgba(245, 158, 11, 1)', borderWidth: 2, fill: false, tension: 0.4, yAxisID: 'y' },
                    { label: '📤 Export', data: gridExport, borderColor: 'rgba(59, 130, 246, 1)', borderWidth: 2, fill: false, tension: 0.4, yAxisID: 'y' },
                    { label: '📊 SoC %', data: batterySoC, borderColor: 'rgba(236, 72, 153, 1)', borderWidth: 2, borderDash: [5, 5], fill: false, tension: 0.4, yAxisID: 'y1' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: { type: 'linear', position: 'left', beginAtZero: true, title: { display: true, text: 'kW' } },
                    y1: { type: 'linear', position: 'right', beginAtZero: true, max: 100, title: { display: true, text: '%' }, grid: { drawOnChartArea: false } }
                },
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } }
            }
        });
    }
    
    function showDay(dayOfYear, button) {
        currentDay = dayOfYear;
        var buttons = document.querySelectorAll('.sim-day-btn');
        for (var i = 0; i < buttons.length; i++) buttons[i].classList.remove('active');
        button.classList.add('active');
        updateDailyChart(dayOfYear);
    }
    
    // ==================== TOGGLE BATTERY ====================
    function toggleBatteryPackage() {
        var slider = document.getElementById('batteryCapacity');
        var max = isAdvancedMode ? PAKKETTEN.length - 1 : 2;
        var next = (parseInt(slider.value) + 1) % (max + 1);
        slider.value = next;
        
        updateCapacityDisplay(next);
        recalculateBatteryEffects();
    }
    
    function updateCapacityDisplay(pakketIndex) {
        var pakket = PAKKETTEN[pakketIndex];
        var displayText;
        if (pakket.capacity === 0) {
            displayText = 'Geen batterij';
        } else if (pakketIndex <= 3) {
            // 1-fase pakketten: Plus, Pro, Pro+
            displayText = pakket.capacity + ' kWh (' + pakket.name + ')';
        } else {
            // 3-fase pakketten: toon ook fase info
            displayText = pakket.capacity + ' kWh ' + pakket.name;
        }
        document.getElementById('capacityDisplay').textContent = displayText;
    }
    
    // ==================== EVENT LISTENERS ====================
    function setupEventListeners() {
        document.getElementById('solarCapacity').addEventListener('input', function() {
            var val = this.value;
            document.getElementById('solarDisplay').textContent = val === '0' ? 'Geen zonnepanelen' : val + ' Wp';
            if (baseHourlyData.length > 0) recalculateBatteryEffects();
        }, { passive: true });
        
        document.getElementById('annualConsumption').addEventListener('input', function() {
            document.getElementById('consumptionDisplay').textContent = this.value + ' kWh';
            if (baseHourlyData.length > 0) recalculateBatteryEffects();
        }, { passive: true });
        
        document.getElementById('batteryCapacity').addEventListener('input', function() {
            var pakketIndex = parseInt(this.value);
            updateCapacityDisplay(pakketIndex);
            if (baseHourlyData.length > 0) recalculateBatteryEffects();
        }, { passive: true });
        
        // Uitgebreide inputs
        var contractType = document.getElementById('contractType');
        if (contractType) {
            contractType.addEventListener('input', function() {
                var type = parseInt(this.value);
                document.getElementById('contractDisplay').textContent = type === 0 ? 'Vast' : 'Dynamisch';
                var chargingEl = document.getElementById('chargingStrategy');
                var chargingDisplay = document.getElementById('chargingDisplay');
                if (chargingEl && chargingDisplay) {
                    if (type === 0) {
                        chargingDisplay.textContent = 'Normaal (vast)';
                    } else {
                        chargingDisplay.textContent = parseInt(chargingEl.value) === 0 ? 'Normaal' : 'Smart laden';
                    }
                }
                if (baseHourlyData.length > 0) recalculateBatteryEffects();
            }, { passive: true });
        }
        
        var vastTarief = document.getElementById('vastTarief');
        if (vastTarief) {
            vastTarief.addEventListener('input', function() {
                var cents = parseInt(this.value);
                document.getElementById('vastTariefDisplay').textContent = '€0.' + String(cents).padStart(2, '0');
                if (baseHourlyData.length > 0) recalculateBatteryEffects();
            }, { passive: true });
        }
        
        var feedInTariff = document.getElementById('feedInTariff');
        if (feedInTariff) {
            feedInTariff.addEventListener('input', function() {
                var cents = parseInt(this.value);
                var display = cents >= 0 ? '€0.' + String(cents).padStart(2, '0') : '-€0.' + String(Math.abs(cents)).padStart(2, '0');
                document.getElementById('feedInDisplay').textContent = display;
                if (baseHourlyData.length > 0) recalculateBatteryEffects();
            }, { passive: true });
        }
        
        var chargingStrategy = document.getElementById('chargingStrategy');
        if (chargingStrategy) {
            chargingStrategy.addEventListener('input', function() {
                var strategy = parseInt(this.value);
                var contractTypeEl = document.getElementById('contractType');
                var isDynamic = contractTypeEl ? parseInt(contractTypeEl.value) === 1 : true;
                if (!isDynamic) {
                    document.getElementById('chargingDisplay').textContent = 'Normaal (vast)';
                } else {
                    document.getElementById('chargingDisplay').textContent = strategy === 0 ? 'Normaal' : 'Smart laden';
                }
                if (baseHourlyData.length > 0) recalculateBatteryEffects();
            }, { passive: true });
        }
        
        var passwordInput = document.getElementById('passwordInput');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') checkPassword();
            });
        }
    }
    
    // ==================== INITIALIZE ====================
    function init() {
        setupEventListeners();
        runSimulation();
    }
    
    // ==================== GLOBAL EXPORTS ====================
    window.AccuThuis = {
        showPasswordModal: showPasswordModal,
        closePasswordModal: closePasswordModal,
        checkPassword: checkPassword,
        lockAdvanced: lockAdvanced,
        runSimulation: runSimulation,
        toggleBatteryPackage: toggleBatteryPackage,
        showDay: showDay
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
