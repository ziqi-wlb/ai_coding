// Expense tracking app for "月光生活家"
class ExpenseTracker {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.moods = JSON.parse(localStorage.getItem('moods')) || [];
        this.budgets = JSON.parse(localStorage.getItem('budgets')) || [];
        this.currentTab = 'add';
        this.selectedMood = null;
        this.uploadedImages = [];
        this.deepseekApiKey = this.getApiKey();
        
        this.init();
    }

    getApiKey() {
        // Get API key from window config (browser environment)
        if (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.DEEPSEEK_API_KEY) {
            return window.APP_CONFIG.DEEPSEEK_API_KEY;
        }
        
        // Return null to disable AI features silently
        return null;
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDate();
        this.updateStatistics();
        this.updateTrendChart();
    }

    setupEventListeners() {
        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Expense form
        document.getElementById('expenseForm').addEventListener('submit', (e) => this.addExpense(e));

        // Trend period buttons
        document.querySelectorAll('.trend-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTrendPeriod(e.target.dataset.period));
        });

        // Mood buttons in expense form
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectMood(e.target.dataset.mood));
        });

        // Budget form
        document.getElementById('budgetForm').addEventListener('submit', (e) => this.addBudget(e));

        // Image upload
        document.getElementById('imageUpload').addEventListener('change', (e) => this.handleImageUpload(e));

        // History search and filters
        document.getElementById('historySearch').addEventListener('input', () => this.updateHistoryList());
        document.getElementById('categoryFilter').addEventListener('change', () => this.updateHistoryList());
        document.getElementById('dateFilter').addEventListener('change', () => this.updateHistoryList());
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
    }

    switchTab(tabName) {
        // Update navigation
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tabName).classList.add('active');

        this.currentTab = tabName;

        // Update charts when switching to stats/insights/budget/history tabs
        if (tabName === 'stats') {
            this.updateStatistics();
        } else if (tabName === 'insights') {
            this.updateMoodStats();
        } else if (tabName === 'budget') {
            this.updateBudgetList();
        } else if (tabName === 'history') {
            this.updateHistoryList();
        }
    }

    addExpense(e) {
        e.preventDefault();
        
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const date = document.getElementById('date').value;
        const note = document.getElementById('note').value;

        if (!amount || !category || !date) {
            this.showMessage('请填写完整信息', 'error');
            return;
        }

        const expense = {
            id: Date.now(),
            amount: amount,
            category: category,
            date: date,
            note: note,
            images: [...this.uploadedImages],
            mood: this.selectedMood,
            moodNote: document.getElementById('moodNote').value,
            timestamp: new Date().toISOString()
        };

        this.expenses.push(expense);
        this.saveExpenses();
        this.showMessage('记账成功！', 'success');
        this.resetForm();
    }

    resetForm() {
        document.getElementById('expenseForm').reset();
        this.setDefaultDate();
        this.uploadedImages = [];
        this.updateImagePreview();
        this.selectedMood = null;
        document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));
    }

    saveExpenses() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    updateStatistics() {
        this.updateCategoryChart();
        this.updateCategoryList();
        this.updateTrendChart();
    }

    updateCategoryChart() {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        
        // Calculate category totals
        const categoryTotals = {};
        this.expenses.forEach(expense => {
            categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
        });

        const labels = Object.keys(categoryTotals);
        const data = Object.values(categoryTotals);
        const colors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'
        ];

        // Destroy existing chart if it exists
        if (this.categoryChart) {
            this.categoryChart.destroy();
        }

        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    }

    updateCategoryList() {
        const categoryList = document.getElementById('categoryList');
        const categoryTotals = {};
        
        this.expenses.forEach(expense => {
            categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
        });

        const sortedCategories = Object.entries(categoryTotals)
            .sort(([,a], [,b]) => b - a);

        categoryList.innerHTML = sortedCategories.map(([category, amount]) => `
            <div class="category-item">
                <span class="category-name">${category}</span>
                <span class="category-amount">¥${amount.toFixed(2)}</span>
            </div>
        `).join('');
    }

    switchTrendPeriod(period) {
        document.querySelectorAll('.trend-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-period="${period}"]`).classList.add('active');
        this.updateTrendChart(parseInt(period));
    }

    updateTrendChart(days = 7) {
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        // Calculate daily totals for the specified period
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const dailyTotals = {};
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            dailyTotals[dateStr] = 0;
        }

        this.expenses.forEach(expense => {
            const expenseDate = new Date(expense.date);
            if (expenseDate >= startDate && expenseDate <= endDate) {
                const dateStr = expense.date;
                dailyTotals[dateStr] = (dailyTotals[dateStr] || 0) + expense.amount;
            }
        });

        const labels = Object.keys(dailyTotals).map(date => {
            const d = new Date(date);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        });
        const data = Object.values(dailyTotals);

        // Destroy existing chart if it exists
        if (this.trendChart) {
            this.trendChart.destroy();
        }

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: '每日支出',
                    data: data,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    selectMood(mood) {
        document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));
        document.querySelector(`[data-mood="${mood}"]`).classList.add('selected');
        this.selectedMood = mood;
    }



    showMessage(message, type = 'success') {
        // Remove existing message
        const existingMessage = document.querySelector('.success-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'success-message';
        messageDiv.textContent = message;
        messageDiv.style.background = type === 'success' ? '#28a745' : '#dc3545';
        
        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }

    // Image upload functionality
    handleImageUpload(e) {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    this.uploadedImages.push({
                        id: Date.now() + Math.random(),
                        data: event.target.result,
                        name: file.name
                    });
                    this.updateImagePreview();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    updateImagePreview() {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = '';

        this.uploadedImages.forEach(image => {
            const item = document.createElement('div');
            item.className = 'image-preview-item';
            item.innerHTML = `
                <img src="${image.data}" alt="${image.name}">
                <button class="remove-image" onclick="app.removeImage('${image.id}')">×</button>
            `;
            preview.appendChild(item);
        });
    }

    removeImage(imageId) {
        this.uploadedImages = this.uploadedImages.filter(img => img.id !== imageId);
        this.updateImagePreview();
    }

    // Budget functionality
    addBudget(e) {
        e.preventDefault();
        
        const category = document.getElementById('budgetCategory').value;
        const amount = parseFloat(document.getElementById('budgetAmount').value);

        if (!category || !amount) {
            this.showMessage('请填写完整信息', 'error');
            return;
        }

        // Check if budget already exists for this category
        const existingBudget = this.budgets.find(b => b.category === category);
        if (existingBudget) {
            existingBudget.amount = amount;
            this.showMessage('预算已更新！', 'success');
        } else {
            const budget = {
                id: Date.now(),
                category: category,
                amount: amount,
                timestamp: new Date().toISOString()
            };
            this.budgets.push(budget);
            this.showMessage('预算设置成功！', 'success');
        }

        this.saveBudgets();
        this.updateBudgetList();
        document.getElementById('budgetForm').reset();
    }

    saveBudgets() {
        localStorage.setItem('budgets', JSON.stringify(this.budgets));
    }

    updateBudgetList() {
        const budgetList = document.getElementById('budgetList');
        
        if (this.budgets.length === 0) {
            budgetList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">还没有设置预算，快来设置你的预算吧！</p>';
            return;
        }

        // Calculate current month expenses by category
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthlyExpenses = {};
        
        this.expenses.forEach(expense => {
            if (expense.date.startsWith(currentMonth)) {
                monthlyExpenses[expense.category] = (monthlyExpenses[expense.category] || 0) + expense.amount;
            }
        });

        budgetList.innerHTML = this.budgets.map(budget => {
            const used = monthlyExpenses[budget.category] || 0;
            const percentage = Math.min((used / budget.amount) * 100, 100);
            const remaining = Math.max(budget.amount - used, 0);
            const over = Math.max(used - budget.amount, 0);

            let progressClass = '';
            if (percentage >= 100) {
                progressClass = 'danger';
            } else if (percentage >= 80) {
                progressClass = 'warning';
            }

            return `
                <div class="budget-item">
                    <div class="budget-header">
                        <span class="budget-category">${budget.category}</span>
                        <span class="budget-amount">¥${budget.amount.toFixed(2)}</span>
                    </div>
                    <div class="budget-progress">
                        <div class="progress-bar">
                            <div class="progress-fill ${progressClass}" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                    <div class="budget-stats">
                        <span class="budget-used">已用: ¥${used.toFixed(2)}</span>
                        ${over > 0 ? 
                            `<span class="budget-over">超支: ¥${over.toFixed(2)}</span>` :
                            `<span class="budget-remaining">剩余: ¥${remaining.toFixed(2)}</span>`
                        }
                    </div>
                </div>
            `;
        }).join('');
    }

    // History functionality
    updateHistoryList() {
        const historyList = document.getElementById('historyList');
        const searchTerm = document.getElementById('historySearch').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;

        // Filter expenses
        let filteredExpenses = this.expenses.filter(expense => {
            // Search filter
            const matchesSearch = !searchTerm || 
                expense.note.toLowerCase().includes(searchTerm) ||
                expense.category.toLowerCase().includes(searchTerm);

            // Category filter
            const matchesCategory = !categoryFilter || expense.category === categoryFilter;

            // Date filter
            let matchesDate = true;
            if (dateFilter) {
                const expenseDate = new Date(expense.date);
                const now = new Date();
                
                switch (dateFilter) {
                    case 'today':
                        matchesDate = expenseDate.toDateString() === now.toDateString();
                        break;
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        matchesDate = expenseDate >= weekAgo;
                        break;
                    case 'month':
                        matchesDate = expenseDate.getMonth() === now.getMonth() && 
                                     expenseDate.getFullYear() === now.getFullYear();
                        break;
                }
            }

            return matchesSearch && matchesCategory && matchesDate;
        });

        // Sort by date (newest first)
        filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (filteredExpenses.length === 0) {
            historyList.innerHTML = `
                <div class="empty-history">
                    <h3>📝 暂无记录</h3>
                    <p>没有找到符合条件的消费记录<br>试试调整搜索条件或添加新的消费记录</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = filteredExpenses.map(expense => {
            const date = new Date(expense.date);
            const formattedDate = date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });

            const imagesHtml = expense.images && expense.images.length > 0 ? `
                <div class="history-images">
                    ${expense.images.map((image, index) => `
                        <img src="${image.data}" alt="${image.name}" class="history-image" 
                             onclick="app.showImageModal('${image.data}')">
                    `).join('')}
                </div>
            ` : '';

            return `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-category">${expense.category}</span>
                        <span class="history-amount">¥${expense.amount.toFixed(2)}</span>
                    </div>
                    <div class="history-date">${formattedDate}</div>
                    ${expense.note ? `<div class="history-note">"${expense.note}"</div>` : ''}
                    ${imagesHtml}
                </div>
            `;
        }).join('');
    }

    showImageModal(imageSrc) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        modalImage.src = imageSrc;
        modal.style.display = 'flex';
    }

    closeImageModal() {
        const modal = document.getElementById('imageModal');
        modal.style.display = 'none';
    }

    // Mood scoring system
    getMoodScore(mood) {
        const moodScores = {
            'happy': 5,
            'excited': 4,
            'calm': 3,
            'worried': 2,
            'sad': 1,
            'angry': 0
        };
        return moodScores[mood] || 3;
    }

    getMoodEmoji(mood) {
        const moodEmojis = {
            'happy': '😊',
            'excited': '🤩',
            'calm': '😌',
            'worried': '😰',
            'sad': '😢',
            'angry': '😠'
        };
        return moodEmojis[mood] || '😐';
    }

    getMoodName(mood) {
        const moodNames = {
            'happy': '开心',
            'excited': '兴奋',
            'calm': '平静',
            'worried': '担心',
            'sad': '难过',
            'angry': '生气'
        };
        return moodNames[mood] || '未知';
    }

    // Mood statistics functionality
    updateMoodStats() {
        this.updateMoodSummary();
        this.updateMoodExpenseChart();
        this.updateMoodInsights();
    }

    updateMoodSummary() {
        const moodSummary = document.getElementById('moodSummary');
        
        // Get expenses with mood data
        const expensesWithMood = this.expenses.filter(expense => expense.mood);
        
        if (expensesWithMood.length === 0) {
            moodSummary.innerHTML = `
                <h3>心情统计</h3>
                <p style="text-align: center; color: #666; padding: 20px;">还没有心情记录，快去记录你的心情吧！</p>
            `;
            return;
        }

        // Calculate mood statistics from expense records
        const moodStats = {};
        expensesWithMood.forEach(expense => {
            if (!moodStats[expense.mood]) {
                moodStats[expense.mood] = {
                    count: 0,
                    totalScore: 0,
                    avgScore: 0
                };
            }
            moodStats[expense.mood].count++;
            moodStats[expense.mood].totalScore += this.getMoodScore(expense.mood);
        });

        // Calculate average scores
        Object.keys(moodStats).forEach(mood => {
            moodStats[mood].avgScore = moodStats[mood].totalScore / moodStats[mood].count;
        });

        // Sort by frequency
        const sortedMoods = Object.entries(moodStats)
            .sort(([,a], [,b]) => b.count - a.count);

        moodSummary.innerHTML = `
            <h3>心情统计</h3>
            ${sortedMoods.map(([mood, stats]) => {
                const scoreClass = stats.avgScore >= 4 ? 'positive' : 
                                  stats.avgScore >= 2 ? 'neutral' : 'negative';
                return `
                    <div class="mood-score">
                        <div class="mood-name">
                            <span class="mood-emoji">${this.getMoodEmoji(mood)}</span>
                            <span>${this.getMoodName(mood)}</span>
                        </div>
                        <div class="mood-value ${scoreClass}">
                            ${stats.count}次 (${stats.avgScore.toFixed(1)}分)
                        </div>
                    </div>
                `;
            }).join('')}
        `;
    }

    updateMoodExpenseChart() {
        const ctx = document.getElementById('moodExpenseChart').getContext('2d');
        
        // Calculate mood-expense correlation
        const moodExpenseData = {};
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // Get expenses from current month with mood data
        const monthlyExpenses = this.expenses.filter(expense => 
            expense.date.startsWith(currentMonth) && expense.mood
        );

        // Create mood-expense correlation from expense records
        monthlyExpenses.forEach(expense => {
            if (!moodExpenseData[expense.mood]) {
                moodExpenseData[expense.mood] = {
                    totalAmount: 0,
                    count: 0,
                    avgAmount: 0
                };
            }
            moodExpenseData[expense.mood].totalAmount += expense.amount;
            moodExpenseData[expense.mood].count++;
        });

        // Calculate average amounts
        Object.keys(moodExpenseData).forEach(mood => {
            moodExpenseData[mood].avgAmount = moodExpenseData[mood].totalAmount / moodExpenseData[mood].count;
        });

        const labels = Object.keys(moodExpenseData).map(mood => this.getMoodName(mood));
        const data = Object.values(moodExpenseData).map(stats => stats.avgAmount);
        const colors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7'
        ];

        // Destroy existing chart if it exists
        if (this.moodExpenseChart) {
            this.moodExpenseChart.destroy();
        }

        this.moodExpenseChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '平均消费金额',
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '¥' + value.toFixed(0);
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    async updateMoodInsights() {
        const moodInsights = document.getElementById('moodInsights');
        
        // Show loading state
        moodInsights.innerHTML = `
            <h3>dots-llm分析</h3>
            <div style="text-align: center; color: #666; padding: 20px;">
                <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #667eea; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin-top: 10px;">dots-llm正在分析你的消费数据...</p>
            </div>
        `;

        try {
            // Calculate insights
            const insights = await this.calculateMoodInsights();
            
            moodInsights.innerHTML = `
                <h3>dots-llm洞察</h3>
                ${insights.map(insight => `
                    <div class="insight-item">
                        ${insight}
                    </div>
                `).join('')}
            `;
        } catch (error) {
            console.error('Error updating mood insights:', error);
            moodInsights.innerHTML = `
                <h3>dots-llm分析</h3>
                <div class="insight-item">
                    <div class="insight-text">暂时无法获取dots-llm洞察，请稍后再试</div>
                </div>
            `;
        }
    }

    async calculateMoodInsights() {
        const insights = [];
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // Get current month data with mood
        const monthlyExpenses = this.expenses.filter(expense => 
            expense.date.startsWith(currentMonth) && expense.mood
        );

        if (monthlyExpenses.length === 0) {
            insights.push('本月还没有心情记录，建议多记录心情来了解消费模式，让dots-llm为你提供更精准的分析');
            return insights;
        }

        // Prepare data for DeepSeek analysis
        const analysisData = this.prepareAnalysisData(monthlyExpenses);
        
        try {
            // Get AI insights from DeepSeek
            const aiInsights = await this.getDeepSeekInsights(analysisData);
            insights.push(...aiInsights);
        } catch (error) {
            console.error('DeepSeek API error:', error);
            // Fallback to basic insights
            insights.push(...this.getBasicInsights(monthlyExpenses));
        }

        return insights;
    }

    prepareAnalysisData(monthlyExpenses) {
        // Calculate mood-expense correlation
        const moodExpenseData = {};
        const categoryData = {};
        const dailyData = {};
        
        monthlyExpenses.forEach(expense => {
            // Mood data
            if (!moodExpenseData[expense.mood]) {
                moodExpenseData[expense.mood] = { amounts: [], count: 0 };
            }
            moodExpenseData[expense.mood].amounts.push(expense.amount);
            moodExpenseData[expense.mood].count++;
            
            // Category data
            if (!categoryData[expense.category]) {
                categoryData[expense.category] = { amounts: [], count: 0 };
            }
            categoryData[expense.category].amounts.push(expense.amount);
            categoryData[expense.category].count++;
            
            // Daily data
            if (!dailyData[expense.date]) {
                dailyData[expense.date] = { amount: 0, mood: expense.mood, count: 0 };
            }
            dailyData[expense.date].amount += expense.amount;
            dailyData[expense.date].count++;
        });

        // Calculate averages
        const moodAverages = {};
        Object.keys(moodExpenseData).forEach(mood => {
            const amounts = moodExpenseData[mood].amounts;
            moodAverages[mood] = {
                avgAmount: amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
                totalAmount: amounts.reduce((sum, amount) => sum + amount, 0),
                count: amounts.length
            };
        });

        const categoryAverages = {};
        Object.keys(categoryData).forEach(category => {
            const amounts = categoryData[category].amounts;
            categoryAverages[category] = {
                avgAmount: amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length,
                totalAmount: amounts.reduce((sum, amount) => sum + amount, 0),
                count: amounts.length
            };
        });

        return {
            moodAverages,
            categoryAverages,
            dailyData,
            totalExpenses: monthlyExpenses.length,
            totalAmount: monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0)
        };
    }

    async getDeepSeekInsights(analysisData) {
        // Check if API key is available
        if (!this.deepseekApiKey) {
            throw new Error('DeepSeek API key not configured');
        }

        const prompt = this.buildAnalysisPrompt(analysisData);
        
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.deepseekApiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    {
                        role: 'system',
                        content: '你是一个专业的消费心理分析师，擅长分析用户的消费行为与心情的关系。请用温暖、贴心的语言给出个性化的消费建议。'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;
        
        // Parse AI response into insights
        return this.parseAIResponse(aiResponse);
    }

    buildAnalysisPrompt(analysisData) {
        const { moodAverages, categoryAverages, totalExpenses, totalAmount } = analysisData;
        
        let prompt = `请分析以下消费数据，给出个性化的消费洞察和建议：

用户本月消费概况：
- 总消费次数：${totalExpenses}次
- 总消费金额：¥${totalAmount.toFixed(2)}

心情消费分析：`;

        Object.entries(moodAverages).forEach(([mood, data]) => {
            prompt += `\n- ${this.getMoodName(mood)}：平均¥${data.avgAmount.toFixed(2)}，共${data.count}次`;
        });

        prompt += `\n\n消费分类分析：`;
        Object.entries(categoryAverages).forEach(([category, data]) => {
            prompt += `\n- ${category}：平均¥${data.avgAmount.toFixed(2)}，共${data.count}次`;
        });

        prompt += `\n\n请基于这些数据，给出3-5条个性化的消费洞察和建议，包括：
1. 心情与消费的关系分析
2. 消费习惯的优化建议
3. 情绪管理的建议
4. 预算规划的建议

请用温暖、贴心的语言，像朋友一样给出建议。`;

        return prompt;
    }

    parseAIResponse(aiResponse) {
        // Split response into individual insights
        const insights = aiResponse.split('\n').filter(line => 
            line.trim() && 
            !line.match(/^\d+\./) && 
            line.length > 10
        ).map(line => line.trim());

        // If no insights found, try alternative parsing
        if (insights.length === 0) {
            const sentences = aiResponse.split(/[。！？]/).filter(s => s.trim().length > 10);
            return sentences.slice(0, 5).map(sentence => 
                `<div class="insight-text">${sentence.trim()}</div>`
            );
        }

        return insights.slice(0, 5).map(insight => 
            `<div class="insight-text">${insight}</div>`
        );
    }

    getBasicInsights(monthlyExpenses) {
        const insights = [];
        
        // Calculate mood-expense correlation
        const moodExpenseData = {};
        monthlyExpenses.forEach(expense => {
            if (!moodExpenseData[expense.mood]) {
                moodExpenseData[expense.mood] = [];
            }
            moodExpenseData[expense.mood].push(expense.amount);
        });

        // Generate basic insights
        const moodAverages = {};
        Object.keys(moodExpenseData).forEach(mood => {
            const amounts = moodExpenseData[mood];
            moodAverages[mood] = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
        });

        const sortedMoods = Object.entries(moodAverages).sort(([,a], [,b]) => b - a);
        
        if (sortedMoods.length > 0) {
            const [highestMood, highestAmount] = sortedMoods[0];
            const [lowestMood, lowestAmount] = sortedMoods[sortedMoods.length - 1];
            
            insights.push(`<div class="insight-text"><span class="insight-highlight">${this.getMoodName(highestMood)}</span>时平均消费最高，达到¥${highestAmount.toFixed(2)}</div>`);
            insights.push(`<div class="insight-text"><span class="insight-highlight">${this.getMoodName(lowestMood)}</span>时消费最理性，平均¥${lowestAmount.toFixed(2)}</div>`);
        }

        return insights;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ExpenseTracker();
});
