// AccuThuis Batterij Simulator v15.2 - Correcte seizoens productie
// Host dit bestand op GitHub/jsDelivr
console.log('AccuThuis Simulator v15.2 geladen - Correcte seizoens productie');

(function() {
    "use strict";
    
    // ==================== PAKKET DEFINITIES ====================
    // Basis modus: indices 0, 1, 2
    // Uitgebreide modus: alle pakketten
    // Laadcapaciteit: MultiPlus-II 3000 = 2.4kW, MultiPlus-II 5000 = 4.0kW
    // Ontlaadcapaciteit: MultiPlus-II 3000 = 3.0kW, MultiPlus-II 5000 = 5.0kW
    // 3-fase = 3x omvormer parallel
    var PAKKETTEN = [
        { id: 0, name: 'Geen batterij', capacity: 0, price: 0, inverterCharge: 0, inverterDischarge: 0, phase: '-' },
        { id: 1, name: 'Plus', capacity: 5, price: 2999, inverterCharge: 2.4, inverterDischarge: 3.0, phase: '1-fase 3kVA' },
        { id: 2, name: 'Pro', capacity: 14, price: 4699, inverterCharge: 4.0, inverterDischarge: 5.0, phase: '1-fase 5kVA' },
        { id: 3, name: 'Pro+', capacity: 29, price: 8199, inverterCharge: 4.0, inverterDischarge: 5.0, phase: '1-fase 5kVA' },
        { id: 4, name: '3p 9kVA 2 accu', capacity: 29, price: 11599, inverterCharge: 7.2, inverterDischarge: 9.0, phase: '3-fase 9kVA' },
        { id: 5, name: '3p 9kVA 3 accu', capacity: 43, price: 13599, inverterCharge: 7.2, inverterDischarge: 9.0, phase: '3-fase 9kVA' },
        { id: 6, name: '3p 15kVA 2 accu', capacity: 29, price: 12399, inverterCharge: 12.0, inverterDischarge: 15.0, phase: '3-fase 15kVA' },
        { id: 7, name: '3p 15kVA 3 accu', capacity: 43, price: 14399, inverterCharge: 12.0, inverterDischarge: 15.0, phase: '3-fase 15kVA' }
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
        // Reset callback naar standaard advanced unlock
        window.passwordCallback = 'advanced';
    }
    
    function showReportUnlock() {
        document.getElementById('passwordModal').classList.add('visible'); 
        document.getElementById('passwordInput').focus();
        // Set callback voor alleen rapport unlock
        window.passwordCallback = 'report';
    }
    
    function closePasswordModal() { 
        document.getElementById('passwordModal').classList.remove('visible'); 
        document.getElementById('passwordInput').value = ''; 
    }
    
    function checkPassword() {
        if (document.getElementById('passwordInput').value === 'accuthuis2025') { 
            if (window.passwordCallback === 'report') {
                // Alleen rapport sectie tonen
                var reportSection = document.getElementById('reportSection');
                if (reportSection) reportSection.style.display = 'block';
            } else {
                // Volledige advanced mode
                unlockAdvanced(); 
            }
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
        var reportSection = document.getElementById('reportSection');
        if (reportSection) reportSection.style.display = 'block';
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
        var reportSection = document.getElementById('reportSection');
        if (reportSection) reportSection.style.display = 'none';
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
        var systemSizeKw = solarWp / 1000; // Peak vermogen in kW
        var batteryEfficiency = 0.95;
        var inputs = getInputValues();
        
        // Bepaal maand op basis van dayOfYear
        var daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        var dayCount = 0;
        var month = 0;
        for (var m = 0; m < 12; m++) {
            if (dayOfYear < dayCount + daysInMonth[m]) {
                month = m;
                break;
            }
            dayCount += daysInMonth[m];
        }
        
        // Seizoensafhankelijke solar irradiance multipliers
        // Deze bepalen hoeveel % van het piekvermogen je haalt op het piekuur
        // Zomer: ~95-100% van piekvermogen mogelijk
        // Winter: ~35-40% van piekvermogen door lage zonnestand
        var peakIrradianceMultiplier = {
            summer: 0.95,   // Juni: zon hoog, ~95% van piekvermogen haalbaar
            spring: 0.80,   // Maart: ~80%
            autumn: 0.70,   // September: ~70%
            winter: 0.40    // December: lage zon, ~40% van piekvermogen
        };
        
        // Uur patronen: relatief t.o.v. het piekuur (genormaliseerd zodat max = 1.0)
        var solarPatterns = {
            summer: [0, 0, 0, 0, 0.02, 0.08, 0.21, 0.42, 0.59, 0.77, 0.90, 0.97, 1.00, 0.98, 0.92, 0.80, 0.61, 0.43, 0.22, 0.08, 0.02, 0, 0, 0],
            winter: [0, 0, 0, 0, 0, 0, 0, 0, 0.09, 0.29, 0.57, 0.86, 1.00, 0.91, 0.71, 0.34, 0.09, 0, 0, 0, 0, 0, 0, 0],
            spring: [0, 0, 0, 0, 0, 0, 0.08, 0.23, 0.46, 0.69, 0.85, 0.95, 1.00, 0.95, 0.85, 0.65, 0.43, 0.18, 0.05, 0, 0, 0, 0, 0],
            autumn: [0, 0, 0, 0, 0, 0, 0.04, 0.18, 0.40, 0.64, 0.82, 0.95, 1.00, 0.95, 0.82, 0.58, 0.33, 0.11, 0, 0, 0, 0, 0, 0]
        };
        
        var seasonFactors = { summer: 0.80, winter: 1.25, spring: 0.95, autumn: 1.00 };
        var solarPattern, seasonFactor, peakMultiplier, seasonName;
        
        if (dayOfYear >= 80 && dayOfYear < 172) { 
            solarPattern = solarPatterns.spring; 
            seasonFactor = seasonFactors.spring; 
            peakMultiplier = peakIrradianceMultiplier.spring;
            seasonName = 'spring'; 
        }
        else if (dayOfYear >= 172 && dayOfYear < 264) { 
            solarPattern = solarPatterns.summer; 
            seasonFactor = seasonFactors.summer; 
            peakMultiplier = peakIrradianceMultiplier.summer;
            seasonName = 'summer'; 
        }
        else if (dayOfYear >= 264 && dayOfYear < 355) { 
            solarPattern = solarPatterns.autumn; 
            seasonFactor = seasonFactors.autumn; 
            peakMultiplier = peakIrradianceMultiplier.autumn;
            seasonName = 'autumn'; 
        }
        else { 
            solarPattern = solarPatterns.winter; 
            seasonFactor = seasonFactors.winter; 
            peakMultiplier = peakIrradianceMultiplier.winter;
            seasonName = 'winter'; 
        }
        
        // Piekproductie in kW = systeemgrootte × seizoens irradiance multiplier
        var peakProductionKw = systemSizeKw * peakMultiplier;
        
        // Debug logging
        console.log('simulateDayForChart - dayOfYear:', dayOfYear, 'month:', month, 'season:', seasonName);
        console.log('  systemSizeKw:', systemSizeKw, 'peakMultiplier:', peakMultiplier, 'peakProductionKw:', peakProductionKw.toFixed(2));
        
        var dailyConsumption = (annualConsumption / 365) * seasonFactor;
        var consumptionPattern = [0.3, 0.25, 0.25, 0.25, 0.3, 0.4, 0.7, 1.2, 1.0, 0.6, 0.5, 0.5, 0.6, 0.5, 0.5, 0.6, 0.8, 1.2, 1.5, 1.4, 1.2, 0.9, 0.6, 0.4];
        var consSum = 0; for (var c = 0; c < 24; c++) consSum += consumptionPattern[c];
        var batteryLevel = batteryCapacity * 0.3;
        var dayData = [];
        
        var dynamicPrices = [0.20,0.19,0.18,0.18,0.19,0.21,0.25,0.28,0.30,0.29,0.27,0.25,0.24,0.23,0.22,0.24,0.27,0.32,0.38,0.42,0.40,0.35,0.28,0.23];
        var prices = inputs.isDynamic ? dynamicPrices : Array(24).fill(inputs.vastTarief);
        
        for (var h = 0; h < 24; h++) {
            // Productie in kW: piekvermogen × uurpatroon (pattern is al 0-1 genormaliseerd)
            var production = peakProductionKw * solarPattern[h];
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
    
    // ==================== EMAIL VALIDATION ====================
    function validateEmail(email) {
        var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    
    // ==================== REPORT GENERATION ====================
    function generateReport() {
        var email = document.getElementById('customerEmail').value.trim();
        var msg = document.getElementById('reportMessage');
        
        if (!validateEmail(email)) {
            msg.textContent = 'Vul een geldig e-mailadres in';
            msg.style.color = '#ef4444';
            msg.style.display = 'block';
            return;
        }
        
        msg.textContent = 'Rapport wordt gegenereerd...';
        msg.style.color = '#3b82f6';
        msg.style.display = 'block';
        
        var today = new Date();
        var months = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
        var reportDate = today.getDate() + ' ' + months[today.getMonth()] + ' ' + today.getFullYear();
        
        // Haal huidige pakket selectie op
        var sliderValue = parseInt(document.getElementById('batteryCapacity').value);
        var pakket = PAKKETTEN[sliderValue];
        var currentResult = simulationResults.scenarios[sliderValue] || simulateScenario(sliderValue);
        var currentDisplayName = pakket.capacity === 0 ? 'Geen batterij' : pakket.capacity + ' kWh (' + pakket.name + ')';
        var currentROI = (currentResult.roiYears && pakket.price > 0) ? currentResult.roiYears + ' jaar' : '-';
        
        // Plus en Pro voor vergelijking
        var noBatteryResult = simulationResults.scenarios[0] || simulateScenario(0);
        var plusResult = simulationResults.scenarios[1] || simulateScenario(1);
        var proResult = simulationResults.scenarios[2] || simulateScenario(2);
        
        // CO2 berekening (0.4 kg CO2 per kWh minder inkoop)
        var plusCO2 = Math.round(Math.max(0, noBatteryResult.gridPurchase - plusResult.gridPurchase) * 0.4);
        var proCO2 = Math.round(Math.max(0, noBatteryResult.gridPurchase - proResult.gridPurchase) * 0.4);
        plusResult.co2Savings = plusCO2;
        proResult.co2Savings = proCO2;
        noBatteryResult.co2Savings = 0;
        
        // Seizoensdata (simuleer met Pro pakket voor rapport)
        var summerDay = simulateDayForChart(172, 2);
        var winterDay = simulateDayForChart(355, 2);
        var springDay = simulateDayForChart(80, 2);
        var autumnDay = simulateDayForChart(264, 2);
        
        // Converteer seizoensdata naar v13 format (.soc in plaats van .batterySoC)
        function convertDayData(dayData) {
            return dayData.map(function(h) {
                return { production: h.production, consumption: h.consumption, soc: h.batterySoC };
            });
        }
        summerDay = convertDayData(summerDay);
        winterDay = convertDayData(winterDay);
        springDay = convertDayData(springDay);
        autumnDay = convertDayData(autumnDay);
        
        // Cumulatieve data
        var plusPrice = PAKKETTEN[1].price;
        var proPrice = PAKKETTEN[2].price;
        var plusCum = [-plusPrice], proCum = [-proPrice];
        var pC = -plusPrice, prC = -proPrice;
        for (var y = 1; y <= 15; y++) {
            var deg = Math.pow(0.98, y - 1);
            pC += plusResult.annualSavings * deg;
            prC += proResult.annualSavings * deg;
            plusCum.push(Math.round(pC));
            proCum.push(Math.round(prC));
        }
        
        var recommendation = currentConsumption > 6000 || currentSolarWp > 6000 
            ? 'Op basis van uw verbruik adviseren wij het Pro Pakket (14 kWh) voor maximale energie-onafhankelijkheid.'
            : (plusResult.roiYears && plusResult.roiYears < 12 
                ? 'Het Plus Pakket (5 kWh) is een uitstekende keuze voor uw situatie.'
                : 'Beide pakketten kunnen interessant zijn. Neem contact op voor persoonlijk advies.');
        
        var reportWindow = window.open('', '_blank');
        if (!reportWindow) {
            msg.textContent = 'Pop-up geblokkeerd. Sta pop-ups toe voor deze site.';
            msg.style.color = '#ef4444';
            return;
        }
        
        // Bouw data object met HUIDIGE input waarden (niet cached)
        var currentSolarWp = parseInt(document.getElementById('solarCapacity').value);
        var currentConsumption = parseInt(document.getElementById('annualConsumption').value);
        
        var d = {
            inputs: { solarWp: currentSolarWp, annualConsumption: currentConsumption },
            monthlyData: simulationResults.monthlyData,
            noBattery: noBatteryResult,
            plusPakket: plusResult,
            proPakket: proResult
        };
        
        var html = buildReportHTML(d, reportDate, recommendation, plusCum, proCum, summerDay, winterDay, springDay, autumnDay, currentResult, currentDisplayName, currentROI);
        reportWindow.document.write(html);
        reportWindow.document.close();
        
        msg.textContent = 'Rapport geopend in nieuw tabblad!';
        msg.style.color = '#10b981';
    }
    
    function buildReportHTML(d, reportDate, recommendation, plusCum, proCum, summerDay, winterDay, springDay, autumnDay, currentResult, currentDisplayName, currentROI) {
        var plusPrice = PAKKETTEN[1].price;
        var proPrice = PAKKETTEN[2].price;
        
        var css = ':root { --brand-blue: #9ACFE1; --brand-dark: #1e3a8a; --green: #10b981; --gray-50: #f9fafb; --gray-200: #e5e7eb; --gray-500: #6b7280; --gray-700: #374151; }';
        css += '* { margin: 0; padding: 0; box-sizing: border-box; }';
        css += 'body { font-family: "Segoe UI", sans-serif; line-height: 1.6; color: var(--gray-700); background: var(--gray-50); }';
        css += '.report-container { max-width: 900px; margin: 0 auto; background: white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }';
        css += '.header { background: linear-gradient(135deg, var(--brand-blue) 0%, #7bb8d0 100%); padding: 40px; text-align: center; position: relative; }';
        css += '.header h1 { color: var(--brand-dark); font-size: 2.5em; font-weight: 700; }';
        css += '.header-subtitle { color: var(--brand-dark); font-size: 1.1em; margin-top: 10px; }';
        css += '.report-date { position: absolute; top: 15px; right: 20px; color: var(--brand-dark); font-size: 0.85em; }';
        css += '.section { padding: 30px 40px; border-bottom: 1px solid var(--gray-200); }';
        css += '.section-title { color: var(--brand-dark); font-size: 1.4em; font-weight: 600; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 3px solid var(--brand-blue); display: inline-block; }';
        css += '.section-intro { color: var(--gray-700); font-size: 0.95em; line-height: 1.7; margin-bottom: 20px; }';
        css += '.config-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }';
        css += '.config-item { background: var(--gray-50); padding: 15px 20px; border-radius: 10px; border-left: 4px solid var(--brand-blue); }';
        css += '.config-label { font-size: 0.85em; color: var(--gray-500); margin-bottom: 5px; }';
        css += '.config-value { font-size: 1.3em; font-weight: 600; color: var(--brand-dark); }';
        css += '.comparison-table { width: 100%; border-collapse: collapse; margin-top: 15px; }';
        css += '.comparison-table th { background: var(--brand-dark); color: white; padding: 15px; text-align: center; }';
        css += '.comparison-table th:first-child { text-align: left; border-radius: 10px 0 0 0; }';
        css += '.comparison-table th:last-child { border-radius: 0 10px 0 0; }';
        css += '.comparison-table td { padding: 12px 15px; text-align: center; border-bottom: 1px solid var(--gray-200); }';
        css += '.comparison-table td:first-child { text-align: left; font-weight: 500; }';
        css += '.comparison-table tr:nth-child(even) { background: var(--gray-50); }';
        css += '.highlight-green { color: var(--green); font-weight: 600; }';
        css += '.highlight-blue { color: var(--brand-dark); font-weight: 600; }';
        css += '.chart-container { background: var(--gray-50); padding: 20px; border-radius: 15px; margin: 20px 0; }';
        css += '.chart-title { font-size: 1.1em; font-weight: 600; color: var(--gray-700); margin-bottom: 15px; text-align: center; }';
        css += '.chart-wrapper { position: relative; height: 300px; }';
        css += '.chart-wrapper-large { position: relative; height: 350px; }';
        css += '.donut-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }';
        css += '.donut-item { text-align: center; }';
        css += '.donut-label { font-weight: 600; font-size: 0.85em; color: var(--gray-700); margin-bottom: 8px; }';
        css += '.donut-wrapper { position: relative; height: 160px; width: 160px; margin: 0 auto; }';
        css += '.donut-legend { display: flex; justify-content: center; gap: 20px; margin-bottom: 15px; }';
        css += '.legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.85em; }';
        css += '.legend-color { width: 14px; height: 14px; border-radius: 3px; }';
        css += '.seasonal-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }';
        css += '.seasonal-grid .chart-container { padding: 15px; }';
        css += '.seasonal-grid .chart-wrapper { height: 220px; }';
        css += '.seasonal-grid .chart-title { font-size: 1em; margin-bottom: 10px; }';
        css += '.info-box { border-radius: 12px; padding: 20px 25px; margin: 15px 0; }';
        css += '.info-box-green { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-left: 4px solid var(--green); }';
        css += '.info-box-blue { background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-left: 4px solid var(--brand-dark); }';
        css += '.info-box-title { font-weight: 600; font-size: 1.1em; margin-bottom: 12px; color: #065f46; }';
        css += '.info-box ul { list-style: none; }';
        css += '.info-box li { padding: 6px 0 6px 25px; position: relative; }';
        css += '.info-box li::before { content: "✓"; position: absolute; left: 0; color: var(--green); font-weight: bold; }';
        css += '.tips-list { }';
        css += '.tip-item { padding: 15px 20px; margin: 12px 0; background: var(--gray-50); border-radius: 8px; border-left: 3px solid var(--brand-blue); }';
        css += '.tip-title { color: var(--gray-700); margin-bottom: 8px; }';
        css += '.tip-title strong { color: var(--brand-dark); }';
        css += '.tip-description { color: var(--gray-500); font-size: 0.9em; line-height: 1.6; margin: 0; }';
        css += '.co2-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 15px; }';
        css += '.co2-card { background: white; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgb(0 0 0 / 0.1); }';
        css += '.co2-value { font-size: 2em; font-weight: 700; color: var(--green); }';
        css += '.co2-label { color: var(--gray-500); font-size: 0.9em; margin-top: 5px; }';
        css += '.co2-highlight { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); grid-column: span 2; display: flex; align-items: center; justify-content: center; gap: 15px; padding: 25px; }';
        css += '.co2-highlight .tree-icon { font-size: 3em; }';
        css += '.co2-highlight-text { font-size: 1.1em; color: #065f46; }';
        css += '.recommendation-box { background: linear-gradient(135deg, var(--brand-blue) 0%, #7bb8d0 100%); border-radius: 15px; padding: 25px 30px; color: var(--brand-dark); }';
        css += '.recommendation-title { font-size: 1.2em; font-weight: 700; margin-bottom: 15px; }';
        css += '.recommendation-text { font-size: 1.05em; line-height: 1.7; }';
        css += '.recommendation-buttons { margin-top: 20px; text-align: center; }';
        css += '.btn-recommend { display: inline-block; background: var(--brand-dark); color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: 600; }';
        css += '.contact-box { background: var(--brand-dark); border-radius: 15px; padding: 30px; color: white; text-align: center; }';
        css += '.contact-title { font-size: 1.3em; font-weight: 600; margin-bottom: 20px; }';
        css += '.contact-buttons { display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }';
        css += '.btn-contact, .btn-order { display: inline-block; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: 600; }';
        css += '.btn-contact { background: var(--brand-blue); color: var(--brand-dark); }';
        css += '.btn-order { background: var(--green); color: white; }';
        css += '.contact-region { margin-top: 20px; color: var(--brand-blue); font-size: 0.95em; }';
        css += '.footer { background: #f3f4f6; padding: 25px 40px; text-align: center; }';
        css += '.disclaimer { font-size: 0.8em; color: var(--gray-500); line-height: 1.7; margin-bottom: 15px; }';
        css += '.footer-brand { color: var(--brand-dark); font-weight: 600; }';
        css += '.simulator-preview { background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; margin: 20px 0; }';
        css += '.sim-config { background: #9ACFE1; padding: 20px; }';
        css += '.sim-config-title { font-size: 1.2em; font-weight: 600; color: #1e293b; margin-bottom: 15px; }';
        css += '.sim-config-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }';
        css += '.sim-config-item { background: rgba(255,255,255,0.15); padding: 15px; border-radius: 6px; text-align: center; }';
        css += '.sim-config-label { font-size: 0.85em; color: #1e293b; margin-bottom: 8px; }';
        css += '.sim-config-value { font-size: 1.6em; font-weight: 600; color: #1e293b; }';
        css += '.sim-stats { padding: 20px; }';
        css += '.sim-stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; }';
        css += '.sim-stat { background: #f8fafc; padding: 15px; border-radius: 6px; text-align: center; border-left: 4px solid #3b82f6; }';
        css += '.sim-stat.production { border-left-color: #10b981; }';
        css += '.sim-stat.consumption { border-left-color: #ef4444; }';
        css += '.sim-stat.cost { border-left-color: #f59e0b; }';
        css += '.sim-stat.savings { border-left-color: #10b981; }';
        css += '.sim-stat.battery { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); border-left: none; transform: scale(1.05); box-shadow: 0 4px 15px rgba(30, 58, 138, 0.4); }';
        css += '.sim-stat.battery .sim-stat-label { color: rgba(255,255,255,0.9); }';
        css += '.sim-stat.battery .sim-stat-value { color: white; font-size: 1.5em; }';
        css += '.sim-stat-label { font-size: 0.8em; color: #64748b; margin-bottom: 6px; }';
        css += '.sim-stat-value { font-size: 1.4em; font-weight: 700; color: #1e293b; }';
        css += '.sim-total { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 18px; text-align: center; color: white; }';
        css += '.sim-total-label { font-size: 0.95em; opacity: 0.9; margin-bottom: 6px; }';
        css += '.sim-total-value { font-size: 1.8em; font-weight: 700; }';
        css += '.download-section { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 8px; padding: 12px 18px; margin: 15px 40px; border: 1px solid #bae6fd; }';
        css += '.download-title { font-weight: 600; font-size: 0.9em; color: var(--brand-dark); margin-bottom: 6px; }';
        css += '.download-intro { color: #475569; font-size: 0.8em; margin-bottom: 10px; }';
        css += '.download-buttons { display: flex; gap: 8px; flex-wrap: wrap; }';
        css += '.btn-download { display: inline-flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer; border: none; font-size: 0.8em; }';
        css += '.btn-print { background: var(--brand-dark); color: white; }';
        css += '.btn-html { background: white; color: var(--brand-dark); border: 1px solid var(--brand-dark); }';
        css += '@media (max-width: 700px) { .config-grid, .seasonal-grid, .co2-grid { grid-template-columns: 1fr; } .co2-highlight { grid-column: span 1; } .donut-grid { grid-template-columns: 1fr; } .contact-buttons, .download-buttons { flex-direction: column; } .section { padding: 20px; } .sim-config-grid, .sim-stats-row { grid-template-columns: 1fr 1fr; } .sim-roi-banner { flex-direction: column; gap: 5px; } }';
        css += '@media print { ';
        css += '* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }';
        css += '@page { size: A4; margin: 15mm 10mm; }';
        css += 'body { font-size: 11pt; }';
        css += '.download-section { display: none !important; }';
        css += '.section { page-break-inside: avoid; padding: 20px 25px; }';
        css += '.header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%) !important; -webkit-print-color-adjust: exact !important; page-break-after: avoid; padding: 25px !important; }';
        css += '.header h1, .header-subtitle, .report-date { color: white !important; }';
        css += '.comparison-table th { background: #1e3a8a !important; color: white !important; -webkit-print-color-adjust: exact !important; }';
        css += '.comparison-table tr:nth-child(even) { background: #f8fafc !important; }';
        css += '.info-box-green { background: #ecfdf5 !important; border-left: 4px solid #10b981 !important; }';
        css += '.info-box-blue { background: #eff6ff !important; border-left: 4px solid #1e3a8a !important; }';
        css += '.tip-item { background: #f8fafc !important; border-left: 3px solid #9ACFE1 !important; }';
        css += '.co2-card { background: #f8fafc !important; box-shadow: none !important; border: 1px solid #e2e8f0; }';
        css += '.co2-highlight { background: #ecfdf5 !important; }';
        css += '.co2-value { color: #10b981 !important; }';
        css += '.recommendation-box { background: #9ACFE1 !important; }';
        css += '.contact-box { background: #1e3a8a !important; color: white !important; }';
        css += '.btn-contact { background: #9ACFE1 !important; }';
        css += '.btn-order { background: #10b981 !important; color: white !important; }';
        css += '.config-item { background: #f8fafc !important; border-left: 4px solid #9ACFE1 !important; }';
        css += '.chart-container { background: #f8fafc !important; page-break-inside: avoid; }';
        css += '.footer { background: #f3f4f6 !important; page-break-inside: avoid; }';
        css += '.section-title { border-bottom: 3px solid #9ACFE1 !important; }';
        css += '.highlight-green { color: #10b981 !important; }';
        css += '.page-break { page-break-before: always; }';
        css += '.simulator-preview { box-shadow: none !important; border: 1px solid #e2e8f0; }';
        css += '.sim-config { background: #9ACFE1 !important; -webkit-print-color-adjust: exact !important; }';
        css += '.sim-config-item { background: rgba(255,255,255,0.3) !important; }';
        css += '.sim-stat { background: #f8fafc !important; }';
        css += '.sim-stat.production { border-left-color: #10b981 !important; }';
        css += '.sim-stat.consumption { border-left-color: #ef4444 !important; }';
        css += '.sim-stat.cost { border-left-color: #f59e0b !important; }';
        css += '.sim-stat.savings { border-left-color: #10b981 !important; }';
        css += '.sim-stat.battery { border-left-color: #8b5cf6 !important; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%) !important; -webkit-print-color-adjust: exact !important; }';
        css += '.sim-stat.battery .sim-stat-label { color: rgba(255,255,255,0.9) !important; }';
        css += '.sim-stat.battery .sim-stat-value { color: white !important; }';
        css += '.sim-total { background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important; -webkit-print-color-adjust: exact !important; color: white !important; }';
        css += '}';
        
        var html = '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
        html += '<title>AccuThuis - Persoonlijk Batterij Rapport</title>';
        html += '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>';
        html += '<style>' + css + '</style></head><body>';
        html += '<div class="report-container">';
        html += '<header class="header"><span class="report-date">' + reportDate + '</span><h1>AccuThuis</h1><p class="header-subtitle">Persoonlijk Batterij Simulatie Rapport</p></header>';
        
        // Download section (compact)
        html += '<div class="download-section"><div class="download-title">📥 Rapport Opslaan</div>';
        html += '<div class="download-buttons"><button class="btn-download btn-print" onclick="window.print()">🖨️ PDF</button><button class="btn-download btn-html" onclick="downloadHTML()">💾 HTML</button></div></div>';
        
        // Simulator Preview - exacte weergave van de simulator
        html += '<section class="section"><h2 class="section-title">Uw Simulatie Resultaat</h2>';
        html += '<p class="section-intro">Hieronder ziet u het resultaat van uw simulatie gebaseerd op de door u gekozen instellingen.</p>';
        html += '<div class="simulator-preview">';
        
        // Haal geavanceerde input waarden op
        var contractTypeEl = document.getElementById('contractType');
        var vastTariefEl = document.getElementById('vastTarief');
        var feedInTariffEl = document.getElementById('feedInTariff');
        var chargingStrategyEl = document.getElementById('chargingStrategy');
        
        var contractType = contractTypeEl ? parseInt(contractTypeEl.value) : 1;
        var vastTariefCents = vastTariefEl ? parseInt(vastTariefEl.value) : 30;
        var feedInCents = feedInTariffEl ? parseInt(feedInTariffEl.value) : 1;
        var chargingStrategy = chargingStrategyEl ? parseInt(chargingStrategyEl.value) : 0;
        
        var contractText = contractType === 0 ? 'Vast' : 'Dynamisch';
        var vastTariefText = '€0.' + String(vastTariefCents).padStart(2, '0');
        var feedInText = feedInCents >= 0 ? '€0.' + String(feedInCents).padStart(2, '0') : '-€0.' + String(Math.abs(feedInCents)).padStart(2, '0');
        var chargingText = contractType === 0 ? 'Normaal (vast)' : (chargingStrategy === 0 ? 'Normaal' : 'Smart laden (DESS)');
        
        // Config panel
        html += '<div class="sim-config">';
        html += '<div class="sim-config-title">🔧 Configuratie</div>';
        html += '<div class="sim-config-grid">';
        html += '<div class="sim-config-item"><div class="sim-config-label">Zonnepanelen:</div><div class="sim-config-value">' + d.inputs.solarWp + ' Wp</div></div>';
        html += '<div class="sim-config-item"><div class="sim-config-label">Jaarverbruik:</div><div class="sim-config-value">' + d.inputs.annualConsumption + ' kWh</div></div>';
        html += '<div class="sim-config-item"><div class="sim-config-label">Batterij:</div><div class="sim-config-value">' + currentDisplayName + '</div></div>';
        html += '<div class="sim-config-item"><div class="sim-config-label">Contract:</div><div class="sim-config-value">' + contractText + '</div></div>';
        html += '<div class="sim-config-item"><div class="sim-config-label">Vast tarief:</div><div class="sim-config-value">' + vastTariefText + '/kWh</div></div>';
        html += '<div class="sim-config-item"><div class="sim-config-label">Teruglever:</div><div class="sim-config-value">' + feedInText + '/kWh</div></div>';
        html += '<div class="sim-config-item"><div class="sim-config-label">Laadstrategie:</div><div class="sim-config-value">' + chargingText + '</div></div>';
        html += '</div></div>';
        
        // Stats row 1
        html += '<div class="sim-stats">';
        html += '<div class="sim-stats-row">';
        html += '<div class="sim-stat production"><div class="sim-stat-label">Energie opwekking</div><div class="sim-stat-value">' + currentResult.totalProduction + ' kWh</div></div>';
        html += '<div class="sim-stat"><div class="sim-stat-label">Teruglevering</div><div class="sim-stat-value">' + currentResult.gridExport + ' kWh</div></div>';
        html += '<div class="sim-stat consumption"><div class="sim-stat-label">Energie inkoop</div><div class="sim-stat-value">' + currentResult.gridPurchase + ' kWh</div></div>';
        html += '<div class="sim-stat production"><div class="sim-stat-label">Energie onafhankelijkheid</div><div class="sim-stat-value">' + currentResult.selfSufficiency + '%</div></div>';
        html += '</div>';
        
        // Stats row 2
        html += '<div class="sim-stats-row">';
        html += '<div class="sim-stat cost"><div class="sim-stat-label">Energiekosten/jaar</div><div class="sim-stat-value">€' + currentResult.netEnergyCost + '</div></div>';
        html += '<div class="sim-stat savings"><div class="sim-stat-label">Besparing/jaar</div><div class="sim-stat-value">' + currentResult.savingsPercent + '%</div></div>';
        html += '<div class="sim-stat savings"><div class="sim-stat-label">Besparing/jaar</div><div class="sim-stat-value">€' + currentResult.annualSavings + '</div></div>';
        html += '<div class="sim-stat battery"><div class="sim-stat-label">Terugverdientijd 👆</div><div class="sim-stat-value">' + currentROI + '</div></div>';
        html += '</div></div>';
        
        // Total savings bar
        html += '<div class="sim-total">';
        html += '<div class="sim-total-label">💰 Totale Besparing over 15 jaar levensduur</div>';
        html += '<div class="sim-total-value">€' + currentResult.lifetimeSavings.toLocaleString('nl-NL') + '</div>';
        html += '</div>';
        
        html += '</div></section>';
        
        // Pakket Vergelijking
        html += '<section class="section"><h2 class="section-title">Pakket Vergelijking</h2>';
        html += '<p class="section-intro">Je ziet hier de 2 pakketten van AccuThuis vergeleken met een systeem zonder thuisbatterij, waarbij alle zonne-energie die niet direct verbruikt wordt naar het net gaat, en waar je maar 1 cent of minder per kWh voor terug krijgt.</p>';
        html += '<table class="comparison-table"><thead><tr><th></th><th>Zonder Batterij</th><th>Plus Pakket (5 kWh)</th><th>Pro Pakket (14 kWh)</th></tr></thead><tbody>';
        html += '<tr><td>Investering</td><td>€0</td><td>€' + plusPrice.toLocaleString('nl-NL') + '</td><td>€' + proPrice.toLocaleString('nl-NL') + '</td></tr>';
        html += '<tr><td>Energiekosten per jaar</td><td>€' + d.noBattery.netEnergyCost + '</td><td>€' + d.plusPakket.netEnergyCost + '</td><td>€' + d.proPakket.netEnergyCost + '</td></tr>';
        html += '<tr><td>Besparing per jaar</td><td>-</td><td class="highlight-green">€' + d.plusPakket.annualSavings + '</td><td class="highlight-green">€' + d.proPakket.annualSavings + '</td></tr>';
        html += '<tr><td>Zelfvoorzienend</td><td>' + d.noBattery.selfSufficiency + '%</td><td>' + d.plusPakket.selfSufficiency + '%</td><td>' + d.proPakket.selfSufficiency + '%</td></tr>';
        html += '<tr><td>Terugverdientijd</td><td>-</td><td>' + (d.plusPakket.roiYears ? d.plusPakket.roiYears + ' jaar' : 'n.v.t.') + '</td><td>' + (d.proPakket.roiYears ? d.proPakket.roiYears + ' jaar' : 'n.v.t.') + '</td></tr>';
        html += '<tr><td>Besparing over 15 jaar</td><td>-</td><td class="highlight-blue">€' + d.plusPakket.lifetimeSavings.toLocaleString('nl-NL') + '</td><td class="highlight-blue">€' + d.proPakket.lifetimeSavings.toLocaleString('nl-NL') + '</td></tr>';
        html += '<tr><td><strong>Netto winst na 15 jaar</strong></td><td>-</td><td class="highlight-green">€' + d.plusPakket.netProfit.toLocaleString('nl-NL') + '</td><td class="highlight-green">€' + d.proPakket.netProfit.toLocaleString('nl-NL') + '</td></tr>';
        html += '<tr><td>CO₂ besparing per jaar</td><td>-</td><td>' + d.plusPakket.co2Savings + ' kg</td><td>' + d.proPakket.co2Savings + ' kg</td></tr>';
        html += '</tbody></table></section>';
        
        // Opgetelde Besparing
        html += '<section class="section page-break"><h2 class="section-title">Opgetelde Besparing</h2>';
        html += '<p class="section-intro">Je ziet hieronder het financiële plaatje over de komende jaren: in jaar 0 doe je de aanschaf van de thuisbatterij, hier hangen kosten aan; en door de besparingen die je dan jaarlijks realiseert verdien je de batterij terug en ga je na een aantal jaren hier ook geld mee verdienen. Deze grafieken lopen verschillend voor de 2 pakketten want het Pro pakket is duurder in aanschaf dan het Plus pakket, maar kan op de langere termijn wel meer opleveren.</p>';
        html += '<div class="chart-container"><div class="chart-title">Vergelijking over 15 jaar (incl. 2% jaarlijkse degradatie)</div><div class="chart-wrapper-large"><canvas id="cumulativeChart"></canvas></div></div></section>';
        
        // Energie Overzicht
        html += '<section class="section"><h2 class="section-title">Energie Overzicht</h2>';
        html += '<p class="section-intro">Het totaal aan energieverbruik wat je maandelijks hebt, samen met de opbrengst van de zonne-energie. In de winter gebruik je meer energie voor verwarming, vaker tv etc, maar is er zeer weinig zonne-energie. En in de zomer juist andersom. Een thuisbatterij kan dit effect niet compenseren, maar wel het dagelijks energieverbruik optimaliseren en daarmee zorgen voor zo groot mogelijke besparing op de energiekosten.</p>';
        html += '<div class="chart-container"><div class="chart-title">Maandelijkse Productie vs Verbruik</div><div class="chart-wrapper"><canvas id="monthlyChart"></canvas></div></div>';
        html += '<div class="chart-container"><div class="chart-title">Energie Verdeling per Scenario</div>';
        html += '<div class="donut-legend"><span class="legend-item"><span class="legend-color" style="background: rgba(16, 185, 129, 0.8);"></span> Direct Gebruikt</span><span class="legend-item"><span class="legend-color" style="background: rgba(139, 92, 246, 0.8);"></span> Via Batterij</span><span class="legend-item"><span class="legend-color" style="background: rgba(245, 158, 11, 0.8);"></span> Teruggeleverd</span></div>';
        html += '<div class="donut-grid"><div class="donut-item"><div class="donut-label">Zonder Batterij</div><div class="donut-wrapper"><canvas id="donutNo"></canvas></div></div><div class="donut-item"><div class="donut-label">Plus Pakket (5 kWh)</div><div class="donut-wrapper"><canvas id="donutPlus"></canvas></div></div><div class="donut-item"><div class="donut-label">Pro Pakket (14 kWh)</div><div class="donut-wrapper"><canvas id="donutPro"></canvas></div></div></div>';
        html += '</div></section>';
        
        // Seizoensanalyse
        html += '<section class="section page-break"><h2 class="section-title">Seizoensanalyse - Pro Pakket (14 kWh)</h2>';
        html += '<p class="section-intro">Hieronder zie je hoe de batterij presteert op een typische dag in elk seizoen. In de zomer is er overvloedige zonne-energie waardoor de batterij snel vol raakt. In de winter is de productie beperkt, maar kan de batterij \'s nachts goedkoop worden opgeladen via het net met Dynamic ESS.</p>';
        html += '<div class="seasonal-grid">';
        html += '<div class="chart-container"><div class="chart-title">☀️ Zomer (21 Juni)</div><div class="chart-wrapper"><canvas id="summerChart"></canvas></div></div>';
        html += '<div class="chart-container"><div class="chart-title">❄️ Winter (21 December)</div><div class="chart-wrapper"><canvas id="winterChart"></canvas></div></div>';
        html += '<div class="chart-container"><div class="chart-title">🌸 Lente (21 Maart)</div><div class="chart-wrapper"><canvas id="springChart"></canvas></div></div>';
        html += '<div class="chart-container"><div class="chart-title">🍂 Herfst (21 September)</div><div class="chart-wrapper"><canvas id="autumnChart"></canvas></div></div>';
        html += '</div></section>';
        
        // Garantie & Kwaliteit
        html += '<section class="section page-break"><h2 class="section-title">Garantie & Kwaliteit</h2>';
        html += '<div class="info-box info-box-green"><div class="info-box-title">Uitgebreide Garantie</div><ul><li><strong>Batterij:</strong> 10 jaar fabrieksgarantie</li><li><strong>Omvormer:</strong> 5 jaar fabrieksgarantie (Victron Energy)</li><li><strong>Installatie:</strong> 3 jaar garantie op vakmanschap</li><li><strong>Certificering:</strong> NEN 1010 gecertificeerde installatie</li></ul></div>';
        html += '<p class="section-intro" style="margin-top: 20px;">Wij werken uitsluitend met hoogwaardige componenten van gerenommeerde fabrikanten. De Victron Energy omvormers staan bekend om hun betrouwbaarheid en lange levensduur. De LiFePO4 batterijen zijn de veiligste en duurzaamste batterijen op de markt.</p></section>';
        
        // Tips voor Optimaal Gebruik
        html += '<section class="section"><h2 class="section-title">Tips voor Optimaal Gebruik</h2>';
        html += '<div class="tips-list">';
        html += '<div class="tip-item"><div class="tip-title"><strong>Dynamic ESS activeren:</strong> Automatische optimalisatie met dynamische energieprijzen</div><p class="tip-description">Met Dynamic ESS (DESS) kan je Victron systeem automatisch inspelen op de dynamische energieprijzen. Het systeem laadt de batterij op wanneer de stroom goedkoop is en gebruikt de opgeslagen energie wanneer de prijzen hoog zijn. Dit maximaliseert je besparing zonder dat je er iets voor hoeft te doen.</p></div>';
        html += '<div class="tip-item"><div class="tip-title"><strong>VRM Portal monitoren:</strong> Houd uw energiestromen in de gaten via de gratis Victron app</div><p class="tip-description">Via de VRM Portal en de Victron Connect app heb je altijd en overal inzicht in je energiesysteem. Je ziet real-time hoeveel energie je opwekt, verbruikt en opslaat. Ook kun je historische data bekijken en meldingen ontvangen bij eventuele problemen.</p></div>';
        html += '<div class="tip-item"><div class="tip-title"><strong>Dynamisch contract:</strong> Overweeg Frank Energie voor extra besparingen met DESS</div><p class="tip-description">Een dynamisch energiecontract zoals Frank Energie is essentieel om maximaal te profiteren van je thuisbatterij. De uurprijzen variëren sterk - soms zelfs negatief! - en met DESS profiteer je automatisch van deze prijsverschillen. Veel van onze klanten besparen hiermee extra ten opzichte van een vast contract.</p></div>';
        html += '</div></section>';
        
        // Milieu Impact
        html += '<section class="section page-break"><h2 class="section-title">Uw Milieu Impact</h2>';
        html += '<div class="info-box info-box-blue">';
        html += '<div class="co2-grid">';
        html += '<div class="co2-card"><div class="co2-value">' + d.plusPakket.co2Savings + '</div><div class="co2-label">kg CO₂/jaar met Plus</div></div>';
        html += '<div class="co2-card"><div class="co2-value">' + d.proPakket.co2Savings + '</div><div class="co2-label">kg CO₂/jaar met Pro</div></div>';
        html += '<div class="co2-card co2-highlight"><span class="tree-icon">🌳</span><div class="co2-highlight-text">Met het Pro Pakket bespaart u over 15 jaar <strong>' + (d.proPakket.co2Savings * 15 / 1000).toFixed(1) + ' ton</strong> CO₂.<br>Gelijk aan het planten van <strong>' + Math.round(d.proPakket.co2Savings * 15 / 20) + '</strong> bomen!</div></div>';
        html += '</div></div></section>';
        
        // Aanbeveling
        html += '<section class="section"><h2 class="section-title">Onze Aanbeveling</h2>';
        html += '<div class="recommendation-box"><div class="recommendation-title">Advies op maat</div><p class="recommendation-text">' + recommendation + '</p>';
        var recommendedUrl = d.proPakket.roiYears && d.proPakket.roiYears < d.plusPakket.roiYears ? 'https://accuthuis.nu/offerte' : 'https://accuthuis.nu/offerte';
        html += '<div class="recommendation-buttons"><a href="' + recommendedUrl + '" class="btn-recommend" target="_blank">🛒 Bekijk Aanbevolen Pakket</a></div></div></section>';
        
        // Contact
        html += '<section class="section"><div class="contact-box"><div class="contact-title">Interesse? Neem contact op!</div><div class="contact-buttons"><a href="https://accuthuis.nu/contact" class="btn-contact" target="_blank">📧 Contact Formulier</a><a href="https://accuthuis.nu/offerte" class="btn-order" target="_blank">🛒 Offerte Aanvragen</a></div><div class="contact-region">📍 Regio Zuid-Gelderland & Oost-Brabant</div></div></section>';
        
        // Download section onderaan (herhaling)
        html += '<div class="download-section"><div class="download-title">📥 Rapport Opslaan</div>';
        html += '<div class="download-buttons"><button class="btn-download btn-print" onclick="window.print()">🖨️ PDF</button><button class="btn-download btn-html" onclick="downloadHTML()">💾 HTML</button></div></div>';
        
        // Footer
        html += '<footer class="footer"><p class="disclaimer"><strong>Disclaimer:</strong> Deze simulatie geeft een indicatie op basis van gemiddelde waarden. Werkelijke besparingen zijn afhankelijk van weersinvloeden, verbruikspatroon en energieprijzen.</p><p class="footer-brand">AccuThuis - Uw partner in thuisbatterijen</p></footer>';
        html += '</div>';
        
        html += '<script>';
        html += 'var data = {';
        html += 'monthly: { production: [' + d.monthlyData.production.map(function(v) { return Math.round(v); }).join(',') + '], consumption: [' + d.monthlyData.consumption.map(function(v) { return Math.round(v); }).join(',') + '] },';
        html += 'noBattery: { direct: ' + (d.noBattery.directUsage || 0) + ', battery: 0, export: ' + d.noBattery.gridExport + ' },';
        html += 'plus: { direct: ' + (d.plusPakket.directUsage || 0) + ', battery: ' + (d.plusPakket.batteryUsage || 0) + ', export: ' + d.plusPakket.gridExport + ' },';
        html += 'pro: { direct: ' + (d.proPakket.directUsage || 0) + ', battery: ' + (d.proPakket.batteryUsage || 0) + ', export: ' + d.proPakket.gridExport + ' },';
        html += 'cumulative: { plus: [' + plusCum.join(',') + '], pro: [' + proCum.join(',') + '] },';
        html += 'summer: ' + JSON.stringify(summerDay) + ',';
        html += 'winter: ' + JSON.stringify(winterDay) + ',';
        html += 'spring: ' + JSON.stringify(springDay) + ',';
        html += 'autumn: ' + JSON.stringify(autumnDay);
        html += '};';
        html += 'var months = ["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];';
        html += 'var years = ["Jaar 0","Jaar 1","Jaar 2","Jaar 3","Jaar 4","Jaar 5","Jaar 6","Jaar 7","Jaar 8","Jaar 9","Jaar 10","Jaar 11","Jaar 12","Jaar 13","Jaar 14","Jaar 15"];';
        html += 'var hours = []; for (var h = 0; h < 24; h++) hours.push(h + ":00");';
        html += 'new Chart(document.getElementById("cumulativeChart"), { type: "line", data: { labels: years, datasets: [{ label: "Plus Pakket (5 kWh) - €' + plusPrice.toLocaleString('nl-NL') + '", data: data.cumulative.plus, borderColor: "rgba(59, 130, 246, 1)", backgroundColor: "rgba(59, 130, 246, 0.1)", borderWidth: 3, fill: true, tension: 0.3, pointRadius: 4 },{ label: "Pro Pakket (14 kWh) - €' + proPrice.toLocaleString('nl-NL') + '", data: data.cumulative.pro, borderColor: "rgba(16, 185, 129, 1)", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 3, fill: true, tension: 0.3, pointRadius: 4 },{ label: "Break-even", data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: "rgba(156, 163, 175, 0.8)", borderWidth: 2, borderDash: [8, 4], pointRadius: 0 }]}, options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "Cumulatief (€)" } } }, plugins: { legend: { position: "bottom" } } } });';
        html += 'new Chart(document.getElementById("monthlyChart"), { type: "bar", data: { labels: months, datasets: [{ label: "Productie", data: data.monthly.production, backgroundColor: "rgba(16, 185, 129, 0.7)", borderColor: "rgba(16, 185, 129, 1)", borderWidth: 1 },{ label: "Verbruik", data: data.monthly.consumption, backgroundColor: "rgba(239, 68, 68, 0.7)", borderColor: "rgba(239, 68, 68, 1)", borderWidth: 1 }]}, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: "kWh" } } }, plugins: { legend: { position: "bottom" } } } });';
        html += 'function donut(id, d) { new Chart(document.getElementById(id), { type: "doughnut", data: { labels: ["Direct Gebruikt", "Via Batterij", "Teruggeleverd"], datasets: [{ data: [d.direct, d.battery, d.export], backgroundColor: ["rgba(16, 185, 129, 0.8)", "rgba(139, 92, 246, 0.8)", "rgba(245, 158, 11, 0.8)"], borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "50%", plugins: { legend: { display: false } } } }); }';
        html += 'donut("donutNo", data.noBattery); donut("donutPlus", data.plus); donut("donutPro", data.pro);';
        html += 'function dayChart(id, dd) { new Chart(document.getElementById(id), { type: "line", data: { labels: hours, datasets: [{ label: "Productie", data: dd.map(function(h) { return h.production.toFixed(2); }), borderColor: "rgba(241, 196, 15, 1)", backgroundColor: "rgba(241, 196, 15, 0.15)", borderWidth: 2, fill: true, tension: 0.4, yAxisID: "y" },{ label: "Verbruik", data: dd.map(function(h) { return h.consumption.toFixed(2); }), borderColor: "rgba(239, 68, 68, 1)", borderWidth: 2, tension: 0.4, yAxisID: "y" },{ label: "Batterij %", data: dd.map(function(h) { return h.soc.toFixed(1); }), borderColor: "rgba(139, 92, 246, 1)", backgroundColor: "rgba(139, 92, 246, 0.1)", borderWidth: 2, fill: true, tension: 0.4, yAxisID: "y1" }]}, options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { maxTicksLimit: 12, font: { size: 9 } } }, y: { type: "linear", position: "left", beginAtZero: true, title: { display: true, text: "kW", font: { size: 10 } }, ticks: { font: { size: 9 } } }, y1: { type: "linear", position: "right", beginAtZero: true, max: 100, title: { display: true, text: "%", font: { size: 10 } }, grid: { drawOnChartArea: false }, ticks: { font: { size: 9 } } } }, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, padding: 8, font: { size: 9 } } } } } }); }';
        html += 'dayChart("summerChart", data.summer); dayChart("winterChart", data.winter); dayChart("springChart", data.spring); dayChart("autumnChart", data.autumn);';
        html += 'function downloadHTML() { var h = document.documentElement.outerHTML; var blob = new Blob([h], { type: "text/html" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "AccuThuis-Rapport.html"; a.click(); }';
        html += '<\/script></body></html>';
        
        return html;
    }
    
    // ==================== INITIALIZE ====================
    function init() {
        setupEventListeners();
        runSimulation();
    }
    
    // ==================== GLOBAL EXPORTS ====================
    window.AccuThuis = {
        showPasswordModal: showPasswordModal,
        showReportUnlock: showReportUnlock,
        closePasswordModal: closePasswordModal,
        checkPassword: checkPassword,
        lockAdvanced: lockAdvanced,
        runSimulation: runSimulation,
        toggleBatteryPackage: toggleBatteryPackage,
        showDay: showDay,
        generateReport: generateReport
    };
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
