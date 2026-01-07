// AccuThuis Batterij Simulator v3.0
// Host dit bestand op GitHub Pages of een andere CDN

(function() {
    "use strict";
    
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
        noBattery: {},
        plusPakket: {},
        proPakket: {}
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
        document.getElementById('batteryCapacity').max = 5;
        document.getElementById('chartsSection').classList.add('visible');
        document.getElementById('lockBtnContainer').style.display = 'block';
        updateCharts();
    }
    
    function lockAdvanced() {
        isAdvancedMode = false;
        document.getElementById('advancedBadge').classList.remove('visible');
        document.getElementById('batteryCapacity').max = 2;
        var slider = document.getElementById('batteryCapacity');
        if (parseInt(slider.value) > 2) slider.value = 2;
        document.getElementById('chartsSection').classList.remove('visible');
        document.getElementById('lockBtnContainer').style.display = 'none';
        recalculateBatteryEffects();
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
        
        simulationResults.monthlyData.production = monthlyProductionData.map(function(v) { return Math.round(v); });
        simulationResults.monthlyData.consumption = monthlyConsumptionData.map(function(v) { return Math.round(v); });
        simulationResults.noBattery = simulateScenario(0);
        simulationResults.plusPakket = simulateScenario(5);
        simulationResults.proPakket = simulateScenario(14);
        
        recalculateBatteryEffects();
        if (isAdvancedMode) updateCharts();
    }
    
    function simulateScenario(batteryCapacity) {
        var solarWp = parseInt(document.getElementById('solarCapacity').value);
        var annualConsumption = parseInt(document.getElementById('annualConsumption').value);
        var systemSizeKw = solarWp / 1000;
        var batteryEfficiency = 0.95;
        var feedInTariff = 0.01;
        var vastTarief = 0.30;
        var dynamicPrices = [0.20,0.19,0.18,0.18,0.19,0.21,0.25,0.28,0.30,0.29,0.27,0.25,0.24,0.23,0.22,0.24,0.27,0.32,0.38,0.42,0.40,0.35,0.28,0.23];
        var prices = [];
        for (var p = 0; p < 24; p++) { prices.push(batteryCapacity === 0 ? vastTarief : dynamicPrices[p]); }
        var smartCharging = batteryCapacity > 0;
        var inverterMaxCharge = batteryCapacity <= 10 ? 1.82 : 3.64;
        var inverterMaxDischarge = batteryCapacity <= 10 ? 3.0 : 5.0;
        
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
            
            if (batteryCapacity > 0 && excessSolar > 0 && batteryLevel < batteryCapacity) {
                var toStore = Math.min(excessSolar, (batteryCapacity - batteryLevel) / batteryEfficiency, inverterMaxCharge);
                batteryLevel += toStore * batteryEfficiency;
                excessSolar -= toStore;
            }
            
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
        }
        
        var baselineCost = 0;
        for (var j = 0; j < baseHourlyData.length; j++) {
            var b = baseHourlyData[j];
            var prod = systemSizeKw * b.productionFactor;
            var cons = annualConsumption * b.consumptionFactor;
            var dir = Math.min(prod, cons);
            baselineCost += (cons - dir) * vastTarief;
            baselineCost -= (prod - dir) * feedInTariff;
        }
        
        var selfSufficiency = ((totalConsumption - totalGridPurchase) / totalConsumption) * 100;
        var netEnergyCost = totalEnergyCost - totalFeedInRevenue;
        var annualSavings = batteryCapacity > 0 ? (baselineCost - netEnergyCost) : 0;
        var pakketCosts = { 0: 0, 5: 2799, 14: 4399 };
        var pakketCost = pakketCosts[batteryCapacity] || 0;
        var roiYears = annualSavings > 0 ? pakketCost / annualSavings : null;
        var lifetimeSavings = batteryCapacity > 0 ? annualSavings * 15 * 0.90 : 0;
        
        return {
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
            netProfit: Math.round(lifetimeSavings - pakketCost),
            co2Savings: Math.round(totalBatteryDischarged * 0.4),
            batteryUsage: Math.round(totalBatteryDischarged),
            directUsage: Math.round(totalDirect)
        };
    }
    
    function recalculateBatteryEffects() {
        var sliderValue = parseInt(document.getElementById('batteryCapacity').value);
        var batteryMap = isAdvancedMode ? [0, 5, 10, 14, 29, 43] : [0, 5, 14];
        var batteryCapacity = batteryMap[sliderValue];
        
        var result;
        if (batteryCapacity === 0) result = simulationResults.noBattery;
        else if (batteryCapacity === 5) result = simulationResults.plusPakket;
        else if (batteryCapacity === 14) result = simulationResults.proPakket;
        else result = simulateScenario(batteryCapacity);
        
        var pakketNames = { 5: 'Plus', 10: 'Plus+', 14: 'Pro', 29: 'Pro+', 43: 'Pro++' };
        var name = pakketNames[batteryCapacity] || '';
        var roiText = batteryCapacity === 0 ? '-' : (result.roiYears ? result.roiYears + ' jaar (' + name + ')' : 'Geen besparing');
        
        document.getElementById('productionValue').textContent = result.totalProduction + ' kWh';
        document.getElementById('selfSufficiencyValue').textContent = result.selfSufficiency + '%';
        document.getElementById('gridPurchaseValue').textContent = result.gridPurchase + ' kWh';
        document.getElementById('gridExportValue').textContent = result.gridExport + ' kWh';
        document.getElementById('savingsPercentValue').textContent = result.savingsPercent + '%';
        document.getElementById('energyCostsValue').textContent = '€' + result.netEnergyCost;
        document.getElementById('savingsValue').textContent = '€' + result.annualSavings;
        document.getElementById('roiValue').textContent = roiText;
        document.getElementById('lifetimeSavingsValue').textContent = '€' + result.lifetimeSavings.toLocaleString('nl-NL');
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
        var plus = simulationResults.plusPakket;
        var pro = simulationResults.proPakket;
        var years = ['0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'];
        var plusData = [-2799], proData = [-4399];
        var plusCum = -2799, proCum = -4399;
        for (var y = 1; y <= 15; y++) {
            var deg = Math.pow(0.98, y - 1);
            plusCum += plus.annualSavings * deg;
            proCum += pro.annualSavings * deg;
            plusData.push(Math.round(plusCum));
            proData.push(Math.round(proCum));
        }
        if (cumulativeChart) cumulativeChart.destroy();
        cumulativeChart = new Chart(document.getElementById('cumulativeChart'), {
            type: 'line',
            data: { labels: years.map(function(y) { return 'Jaar ' + y; }), datasets: [
                { label: 'Plus (5 kWh)', data: plusData, borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, fill: true, tension: 0.3 },
                { label: 'Pro (14 kWh)', data: proData, borderColor: 'rgba(16, 185, 129, 1)', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 3, fill: true, tension: 0.3 },
                { label: 'Break-even', data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: 'rgba(156, 163, 175, 0.8)', borderWidth: 2, borderDash: [8, 4], pointRadius: 0 }
            ]},
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
        var batteryMap = isAdvancedMode ? [0, 5, 10, 14, 29, 43] : [0, 5, 14];
        var cap = batteryMap[sliderValue];
        var result = cap === 0 ? simulationResults.noBattery : (cap === 5 ? simulationResults.plusPakket : simulationResults.proPakket);
        if (distributionChart) distributionChart.destroy();
        distributionChart = new Chart(document.getElementById('distributionChart'), {
            type: 'doughnut',
            data: { labels: ['Direct', 'Batterij', 'Teruggeleverd'], datasets: [{ data: [result.directUsage || 0, result.batteryUsage || 0, result.gridExport || 0], backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(245, 158, 11, 0.8)'] }]},
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    function simulateDayForChart(dayOfYear, batteryCapacity) {
        var solarWp = parseInt(document.getElementById('solarCapacity').value);
        var annualConsumption = parseInt(document.getElementById('annualConsumption').value);
        var systemSizeKw = solarWp / 1000;
        var batteryEfficiency = 0.95;
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
        
        for (var h = 0; h < 24; h++) {
            var production = systemSizeKw * solarPattern[h];
            var consumption = dailyConsumption * (consumptionPattern[h] / consSum);
            var excessSolar = Math.max(0, production - consumption);
            var unmetConsumption = Math.max(0, consumption - production);
            
            if (batteryCapacity > 0 && excessSolar > 0 && batteryLevel < batteryCapacity) {
                var toStore = Math.min(excessSolar, (batteryCapacity - batteryLevel) / batteryEfficiency);
                batteryLevel += toStore * batteryEfficiency;
            }
            if (batteryCapacity > 0 && unmetConsumption > 0 && batteryLevel > 0) {
                var discharge = Math.min(unmetConsumption / batteryEfficiency, batteryLevel);
                batteryLevel -= discharge;
            }
            batteryLevel = Math.max(0, Math.min(batteryCapacity, batteryLevel));
            dayData.push({ production: production, consumption: consumption, soc: batteryCapacity > 0 ? (batteryLevel / batteryCapacity) * 100 : 0 });
        }
        return dayData;
    }
    
    function updateDailyChart(dayOfYear) {
        var sliderValue = parseInt(document.getElementById('batteryCapacity').value);
        var batteryMap = isAdvancedMode ? [0, 5, 10, 14, 29, 43] : [0, 5, 14];
        var cap = batteryMap[sliderValue];
        var dayData = simulateDayForChart(dayOfYear, cap);
        var hours = []; for (var h = 0; h < 24; h++) hours.push(h + ':00');
        if (dailyChart) dailyChart.destroy();
        dailyChart = new Chart(document.getElementById('dailyChart'), {
            type: 'line',
            data: { labels: hours, datasets: [
                { label: 'Productie', data: dayData.map(function(d) { return d.production.toFixed(2); }), borderColor: 'rgba(241, 196, 15, 1)', backgroundColor: 'rgba(241, 196, 15, 0.1)', borderWidth: 2, fill: true, tension: 0.4, yAxisID: 'y' },
                { label: 'Verbruik', data: dayData.map(function(d) { return d.consumption.toFixed(2); }), borderColor: 'rgba(239, 68, 68, 1)', borderWidth: 2, tension: 0.4, yAxisID: 'y' },
                { label: 'Batterij %', data: dayData.map(function(d) { return d.soc.toFixed(1); }), borderColor: 'rgba(139, 92, 246, 1)', borderWidth: 2, tension: 0.4, yAxisID: 'y1' }
            ]},
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { position: 'left', beginAtZero: true, title: { display: true, text: 'kW' } }, y1: { position: 'right', beginAtZero: true, max: 100, title: { display: true, text: '%' }, grid: { drawOnChartArea: false } } }, plugins: { legend: { position: 'bottom' } } }
        });
    }
    
    function showDay(dayOfYear) {
        currentDay = dayOfYear;
        var btns = document.querySelectorAll('.day-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.remove('active');
            if (parseInt(btns[i].getAttribute('data-day')) === dayOfYear) {
                btns[i].classList.add('active');
            }
        }
        updateDailyChart(dayOfYear);
    }
    
    // ==================== BATTERY TOGGLE ====================
    function toggleBatteryPackage() {
        var slider = document.getElementById('batteryCapacity');
        var max = isAdvancedMode ? 5 : 2;
        slider.value = (parseInt(slider.value) + 1) % (max + 1);
        slider.dispatchEvent(new Event('input'));
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
        
        var d = simulationResults;
        var today = new Date();
        var months = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
        var reportDate = today.getDate() + ' ' + months[today.getMonth()] + ' ' + today.getFullYear();
        
        var summerDay = simulateDayForChart(172, 14);
        var winterDay = simulateDayForChart(355, 14);
        var springDay = simulateDayForChart(80, 14);
        var autumnDay = simulateDayForChart(264, 14);
        
        var plusCum = [-2799], proCum = [-4399];
        var pC = -2799, prC = -4399;
        for (var y = 1; y <= 15; y++) {
            var deg = Math.pow(0.98, y - 1);
            pC += d.plusPakket.annualSavings * deg;
            prC += d.proPakket.annualSavings * deg;
            plusCum.push(Math.round(pC));
            proCum.push(Math.round(prC));
        }
        
        var recommendation = d.inputs.annualConsumption > 6000 || d.inputs.solarWp > 6000 
            ? 'Op basis van uw verbruik adviseren wij het Pro Pakket (14 kWh) voor maximale energie-onafhankelijkheid.'
            : (d.plusPakket.roiYears && d.plusPakket.roiYears < 12 
                ? 'Het Plus Pakket (5 kWh) is een uitstekende keuze voor uw situatie.'
                : 'Beide pakketten kunnen interessant zijn. Neem contact op voor persoonlijk advies.');
        
        var reportWindow = window.open('', '_blank');
        if (!reportWindow) {
            msg.textContent = 'Pop-up geblokkeerd. Sta pop-ups toe voor deze site.';
            msg.style.color = '#ef4444';
            return;
        }
        
        var html = buildReportHTML(d, reportDate, recommendation, plusCum, proCum, summerDay, winterDay, springDay, autumnDay);
        reportWindow.document.write(html);
        reportWindow.document.close();
        
        msg.textContent = 'Rapport geopend in nieuw tabblad!';
        msg.style.color = '#10b981';
    }
    
    function buildReportHTML(d, reportDate, recommendation, plusCum, proCum, summerDay, winterDay, springDay, autumnDay) {
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
        css += '.download-section { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 20px 25px; margin: 20px 40px; border: 1px solid #bae6fd; }';
        css += '.download-title { font-weight: 600; font-size: 1.1em; color: var(--brand-dark); margin-bottom: 10px; }';
        css += '.download-intro { color: #475569; font-size: 0.9em; margin-bottom: 15px; }';
        css += '.download-buttons { display: flex; gap: 12px; margin-bottom: 15px; flex-wrap: wrap; }';
        css += '.btn-download { display: inline-flex; align-items: center; gap: 8px; padding: 12px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; font-size: 0.95em; }';
        css += '.btn-print { background: var(--brand-dark); color: white; }';
        css += '.btn-html { background: white; color: var(--brand-dark); border: 2px solid var(--brand-dark); }';
        css += '.download-instructions { background: white; border-radius: 8px; padding: 15px; font-size: 0.85em; color: var(--gray-500); }';
        css += '.download-instructions strong { color: var(--brand-dark); }';
        css += '.download-instructions ol { margin: 10px 0 0 20px; }';
        css += '.download-instructions li { margin: 5px 0; }';
        css += '@media (max-width: 700px) { .config-grid, .seasonal-grid, .co2-grid { grid-template-columns: 1fr; } .co2-highlight { grid-column: span 1; } .donut-grid { grid-template-columns: 1fr; } .contact-buttons, .download-buttons { flex-direction: column; } .section { padding: 20px; } }';
        css += '@media print { .download-section { display: none !important; } .section { page-break-inside: avoid; } }';
        
        var html = '<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">';
        html += '<title>AccuThuis - Persoonlijk Batterij Rapport</title>';
        html += '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>';
        html += '<style>' + css + '</style></head><body>';
        html += '<div class="report-container">';
        html += '<header class="header"><span class="report-date">' + reportDate + '</span><h1>AccuThuis</h1><p class="header-subtitle">Persoonlijk Batterij Simulatie Rapport</p></header>';
        
        // Download section
        html += '<div class="download-section"><div class="download-title">📥 Rapport Opslaan</div>';
        html += '<p class="download-intro">Sla dit rapport op zodat je het later kunt raadplegen of delen.</p>';
        html += '<div class="download-buttons"><button class="btn-download btn-print" onclick="window.print()">🖨️ Opslaan als PDF</button><button class="btn-download btn-html" onclick="downloadHTML()">💾 Download HTML</button></div>';
        html += '<div class="download-instructions"><strong>Instructies:</strong><ol><li><strong>PDF opslaan:</strong> Klik op "Opslaan als PDF" → Kies "Opslaan als PDF" als printer → Sla op</li><li><strong>HTML downloaden:</strong> Klik op "Download HTML" → Open later in elke browser</li></ol></div></div>';
        
        // Configuratie sectie
        html += '<section class="section"><h2 class="section-title">Uw Configuratie</h2>';
        html += '<p class="section-intro">We hebben je ingestelde waarden uit de simulator overgenomen in dit rapport. Het rapport gaat uit van een dynamisch energie contract, omdat je daarmee het meeste kunt besparen. Dan kun je naast zonne-energie opslaan in de zomer, in de winter ook \'s nachts, op de goedkoopste momenten de batterij vol laden om op de dure momenten zoals in de avond en in de ochtend de energie te kunnen gebruiken.</p>';
        html += '<div class="config-grid">';
        html += '<div class="config-item"><div class="config-label">Zonnepanelen vermogen</div><div class="config-value">' + d.inputs.solarWp + ' Wp</div></div>';
        html += '<div class="config-item"><div class="config-label">Jaarlijks verbruik</div><div class="config-value">' + d.inputs.annualConsumption + ' kWh</div></div>';
        html += '<div class="config-item"><div class="config-label">Geschatte jaarproductie</div><div class="config-value">' + d.noBattery.totalProduction + ' kWh</div></div>';
        html += '<div class="config-item"><div class="config-label">Energiecontract</div><div class="config-value">Dynamisch</div></div>';
        html += '</div></section>';
        
        // Pakket Vergelijking
        html += '<section class="section"><h2 class="section-title">Pakket Vergelijking</h2>';
        html += '<p class="section-intro">Je ziet hier de 2 pakketten van AccuThuis vergeleken met een systeem zonder thuisbatterij, waarbij alle zonne-energie die niet direct verbruikt wordt naar het net gaat, en waar je maar 1 cent of minder per kWh voor terug krijgt.</p>';
        html += '<table class="comparison-table"><thead><tr><th></th><th>Zonder Batterij</th><th>Plus Pakket (5 kWh)</th><th>Pro Pakket (14 kWh)</th></tr></thead><tbody>';
        html += '<tr><td>Investering</td><td>€0</td><td>€2.799</td><td>€4.399</td></tr>';
        html += '<tr><td>Energiekosten per jaar</td><td>€' + d.noBattery.netEnergyCost + '</td><td>€' + d.plusPakket.netEnergyCost + '</td><td>€' + d.proPakket.netEnergyCost + '</td></tr>';
        html += '<tr><td>Besparing per jaar</td><td>-</td><td class="highlight-green">€' + d.plusPakket.annualSavings + '</td><td class="highlight-green">€' + d.proPakket.annualSavings + '</td></tr>';
        html += '<tr><td>Zelfvoorzienend</td><td>' + d.noBattery.selfSufficiency + '%</td><td>' + d.plusPakket.selfSufficiency + '%</td><td>' + d.proPakket.selfSufficiency + '%</td></tr>';
        html += '<tr><td>Terugverdientijd</td><td>-</td><td>' + (d.plusPakket.roiYears ? d.plusPakket.roiYears + ' jaar' : 'n.v.t.') + '</td><td>' + (d.proPakket.roiYears ? d.proPakket.roiYears + ' jaar' : 'n.v.t.') + '</td></tr>';
        html += '<tr><td>Besparing over 15 jaar</td><td>-</td><td class="highlight-blue">€' + d.plusPakket.lifetimeSavings.toLocaleString('nl-NL') + '</td><td class="highlight-blue">€' + d.proPakket.lifetimeSavings.toLocaleString('nl-NL') + '</td></tr>';
        html += '<tr><td><strong>Netto winst na 15 jaar</strong></td><td>-</td><td class="highlight-green">€' + d.plusPakket.netProfit.toLocaleString('nl-NL') + '</td><td class="highlight-green">€' + d.proPakket.netProfit.toLocaleString('nl-NL') + '</td></tr>';
        html += '<tr><td>CO₂ besparing per jaar</td><td>-</td><td>' + d.plusPakket.co2Savings + ' kg</td><td>' + d.proPakket.co2Savings + ' kg</td></tr>';
        html += '</tbody></table></section>';
        
        // Opgetelde Besparing
        html += '<section class="section"><h2 class="section-title">Opgetelde Besparing</h2>';
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
        html += '<section class="section"><h2 class="section-title">Seizoensanalyse - Pro Pakket (14 kWh)</h2>';
        html += '<p class="section-intro">Hieronder zie je hoe de batterij presteert op een typische dag in elk seizoen. In de zomer is er overvloedige zonne-energie waardoor de batterij snel vol raakt. In de winter is de productie beperkt, maar kan de batterij \'s nachts goedkoop worden opgeladen via het net met Dynamic ESS.</p>';
        html += '<div class="seasonal-grid">';
        html += '<div class="chart-container"><div class="chart-title">☀️ Zomer (21 Juni)</div><div class="chart-wrapper"><canvas id="summerChart"></canvas></div></div>';
        html += '<div class="chart-container"><div class="chart-title">❄️ Winter (21 December)</div><div class="chart-wrapper"><canvas id="winterChart"></canvas></div></div>';
        html += '<div class="chart-container"><div class="chart-title">🌸 Lente (21 Maart)</div><div class="chart-wrapper"><canvas id="springChart"></canvas></div></div>';
        html += '<div class="chart-container"><div class="chart-title">🍂 Herfst (21 September)</div><div class="chart-wrapper"><canvas id="autumnChart"></canvas></div></div>';
        html += '</div></section>';
        
        // Garantie & Kwaliteit
        html += '<section class="section"><h2 class="section-title">Garantie & Kwaliteit</h2>';
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
        html += '<section class="section"><h2 class="section-title">Uw Milieu Impact</h2>';
        html += '<div class="info-box info-box-blue">';
        html += '<div class="co2-grid">';
        html += '<div class="co2-card"><div class="co2-value">' + d.plusPakket.co2Savings + '</div><div class="co2-label">kg CO₂/jaar met Plus</div></div>';
        html += '<div class="co2-card"><div class="co2-value">' + d.proPakket.co2Savings + '</div><div class="co2-label">kg CO₂/jaar met Pro</div></div>';
        html += '<div class="co2-card co2-highlight"><span class="tree-icon">🌳</span><div class="co2-highlight-text">Met het Pro Pakket bespaart u over 15 jaar <strong>' + (d.proPakket.co2Savings * 15 / 1000).toFixed(1) + ' ton</strong> CO₂.<br>Gelijk aan het planten van <strong>' + Math.round(d.proPakket.co2Savings * 15 / 20) + '</strong> bomen!</div></div>';
        html += '</div></div></section>';
        
        // Aanbeveling
        html += '<section class="section"><h2 class="section-title">Onze Aanbeveling</h2>';
        html += '<div class="recommendation-box"><div class="recommendation-title">Advies op maat</div><p class="recommendation-text">' + recommendation + '</p>';
        var recommendedUrl = d.proPakket.roiYears && d.proPakket.roiYears < d.plusPakket.roiYears ? 'https://www.accuthuis.nu/product/20377863/pro-pakket-14-3kw' : 'https://www.accuthuis.nu/product/20566919/plus-pakket-5kw';
        html += '<div class="recommendation-buttons"><a href="' + recommendedUrl + '" class="btn-recommend" target="_blank">🛒 Bekijk Aanbevolen Pakket</a></div></div></section>';
        
        // Contact
        html += '<section class="section"><div class="contact-box"><div class="contact-title">Interesse? Neem contact op!</div><div class="contact-buttons"><a href="https://www.accuthuis.nu/contact" class="btn-contact" target="_blank">📧 Contact Formulier</a><a href="https://www.accuthuis.nu" class="btn-order" target="_blank">🛒 Bestel Hier</a></div><div class="contact-region">📍 Regio Zuid-Gelderland & Oost-Brabant</div></div></section>';
        
        // Footer
        html += '<footer class="footer"><p class="disclaimer"><strong>Disclaimer:</strong> Deze simulatie geeft een indicatie op basis van gemiddelde waarden. Werkelijke besparingen zijn afhankelijk van weersinvloeden, verbruikspatroon en energieprijzen.</p><p class="footer-brand">AccuThuis - Uw partner in thuisbatterijen</p></footer>';
        html += '</div>';
        
        html += '<script>';
        html += 'var data = {';
        html += 'monthly: { production: [' + d.monthlyData.production.join(',') + '], consumption: [' + d.monthlyData.consumption.join(',') + '] },';
        html += 'noBattery: { direct: ' + d.noBattery.directUsage + ', battery: 0, export: ' + d.noBattery.gridExport + ' },';
        html += 'plus: { direct: ' + d.plusPakket.directUsage + ', battery: ' + d.plusPakket.batteryUsage + ', export: ' + d.plusPakket.gridExport + ' },';
        html += 'pro: { direct: ' + d.proPakket.directUsage + ', battery: ' + d.proPakket.batteryUsage + ', export: ' + d.proPakket.gridExport + ' },';
        html += 'cumulative: { plus: [' + plusCum.join(',') + '], pro: [' + proCum.join(',') + '] },';
        html += 'summer: ' + JSON.stringify(summerDay) + ',';
        html += 'winter: ' + JSON.stringify(winterDay) + ',';
        html += 'spring: ' + JSON.stringify(springDay) + ',';
        html += 'autumn: ' + JSON.stringify(autumnDay);
        html += '};';
        html += 'var months = ["Jan","Feb","Mrt","Apr","Mei","Jun","Jul","Aug","Sep","Okt","Nov","Dec"];';
        html += 'var years = ["Jaar 0","Jaar 1","Jaar 2","Jaar 3","Jaar 4","Jaar 5","Jaar 6","Jaar 7","Jaar 8","Jaar 9","Jaar 10","Jaar 11","Jaar 12","Jaar 13","Jaar 14","Jaar 15"];';
        html += 'var hours = []; for (var h = 0; h < 24; h++) hours.push(h + ":00");';
        html += 'new Chart(document.getElementById("cumulativeChart"), { type: "line", data: { labels: years, datasets: [{ label: "Plus Pakket (5 kWh)", data: data.cumulative.plus, borderColor: "rgba(59, 130, 246, 1)", backgroundColor: "rgba(59, 130, 246, 0.1)", borderWidth: 3, fill: true, tension: 0.3, pointRadius: 4 },{ label: "Pro Pakket (14 kWh)", data: data.cumulative.pro, borderColor: "rgba(16, 185, 129, 1)", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 3, fill: true, tension: 0.3, pointRadius: 4 },{ label: "Break-even", data: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: "rgba(156, 163, 175, 0.8)", borderWidth: 2, borderDash: [8, 4], pointRadius: 0 }]}, options: { responsive: true, maintainAspectRatio: false, scales: { y: { title: { display: true, text: "Cumulatief (€)" } } }, plugins: { legend: { position: "bottom" } } } });';
        html += 'new Chart(document.getElementById("monthlyChart"), { type: "bar", data: { labels: months, datasets: [{ label: "Productie", data: data.monthly.production, backgroundColor: "rgba(16, 185, 129, 0.7)", borderColor: "rgba(16, 185, 129, 1)", borderWidth: 1 },{ label: "Verbruik", data: data.monthly.consumption, backgroundColor: "rgba(239, 68, 68, 0.7)", borderColor: "rgba(239, 68, 68, 1)", borderWidth: 1 }]}, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: "kWh" } } }, plugins: { legend: { position: "bottom" } } } });';
        html += 'function donut(id, d) { new Chart(document.getElementById(id), { type: "doughnut", data: { labels: ["Direct Gebruikt", "Via Batterij", "Teruggeleverd"], datasets: [{ data: [d.direct, d.battery, d.export], backgroundColor: ["rgba(16, 185, 129, 0.8)", "rgba(139, 92, 246, 0.8)", "rgba(245, 158, 11, 0.8)"], borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "50%", plugins: { legend: { display: false } } } }); }';
        html += 'donut("donutNo", data.noBattery); donut("donutPlus", data.plus); donut("donutPro", data.pro);';
        html += 'function dayChart(id, dd) { new Chart(document.getElementById(id), { type: "line", data: { labels: hours, datasets: [{ label: "Productie", data: dd.map(function(h) { return h.production.toFixed(2); }), borderColor: "rgba(241, 196, 15, 1)", backgroundColor: "rgba(241, 196, 15, 0.15)", borderWidth: 2, fill: true, tension: 0.4, yAxisID: "y" },{ label: "Verbruik", data: dd.map(function(h) { return h.consumption.toFixed(2); }), borderColor: "rgba(239, 68, 68, 1)", borderWidth: 2, tension: 0.4, yAxisID: "y" },{ label: "Batterij %", data: dd.map(function(h) { return h.soc.toFixed(1); }), borderColor: "rgba(139, 92, 246, 1)", backgroundColor: "rgba(139, 92, 246, 0.1)", borderWidth: 2, fill: true, tension: 0.4, yAxisID: "y1" }]}, options: { responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { maxTicksLimit: 12, font: { size: 9 } } }, y: { type: "linear", position: "left", beginAtZero: true, title: { display: true, text: "kW", font: { size: 10 } }, ticks: { font: { size: 9 } } }, y1: { type: "linear", position: "right", beginAtZero: true, max: 100, title: { display: true, text: "%", font: { size: 10 } }, grid: { drawOnChartArea: false }, ticks: { font: { size: 9 } } } }, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, padding: 8, font: { size: 9 } } } } } }); }';
        html += 'dayChart("summerChart", data.summer); dayChart("winterChart", data.winter); dayChart("springChart", data.spring); dayChart("autumnChart", data.autumn);';
        html += 'function downloadHTML() { var h = document.documentElement.outerHTML; var blob = new Blob([h], { type: "text/html" }); var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "AccuThuis-Rapport.html"; a.click(); }';
        html += '<\/script></body></html>';
        
        return html;
    }
    
    // ==================== EVENT LISTENERS ====================
    function initEventListeners() {
        document.getElementById('solarCapacity').addEventListener('input', function() {
            document.getElementById('solarDisplay').textContent = this.value === '0' ? 'Geen zonnepanelen' : this.value + ' Wp';
            runSimulation();
        });
        
        document.getElementById('annualConsumption').addEventListener('input', function() {
            document.getElementById('consumptionDisplay').textContent = this.value + ' kWh';
            runSimulation();
        });
        
        document.getElementById('batteryCapacity').addEventListener('input', function() {
            var batteryMap = isAdvancedMode ? [0, 5, 10, 14, 29, 43] : [0, 5, 14];
            var cap = batteryMap[parseInt(this.value)];
            var names = { 0: 'Geen batterij', 5: '5 kWh', 10: '10 kWh (Plus+)', 14: '14 kWh', 29: '29 kWh (Pro+)', 43: '43 kWh (Pro++)' };
            document.getElementById('capacityDisplay').textContent = names[cap];
            if (baseHourlyData.length > 0) { recalculateBatteryEffects(); if (isAdvancedMode) updateCharts(); }
        });
        
        document.getElementById('roiCard').addEventListener('click', toggleBatteryPackage);
        document.getElementById('newSimBtn').addEventListener('click', runSimulation);
        document.getElementById('downloadBtn').addEventListener('click', generateReport);
        document.getElementById('unlockTrigger').addEventListener('click', showPasswordModal);
        document.getElementById('unlockBtn').addEventListener('click', checkPassword);
        document.getElementById('cancelBtn').addEventListener('click', closePasswordModal);
        document.getElementById('lockBtn').addEventListener('click', lockAdvanced);
        
        document.getElementById('passwordInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') checkPassword();
        });
        
        var dayBtns = document.querySelectorAll('.day-btn');
        for (var i = 0; i < dayBtns.length; i++) {
            dayBtns[i].addEventListener('click', function() {
                showDay(parseInt(this.getAttribute('data-day')));
            });
        }
    }
    
    // ==================== INITIALIZE ====================
    function init() {
        initEventListeners();
        runSimulation();
    }
    
    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
