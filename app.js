// Expense tracking app for "月光生活家"
class ExpenseTracker {
    constructor() {
        this.expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        this.moods = JSON.parse(localStorage.getItem('moods')) || [];
        this.budgets = JSON.parse(localStorage.getItem('budgets')) || [];
        this.currentTab = 'add';
        this.selectedMood = null;
        this.uploadedImages = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDate();
        this.updateStatistics();
        this.updateTrendChart();
        this.updateMoodHistory();
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

        // Mood buttons
        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectMood(e.target.dataset.mood));
        });

        // Save mood
        document.getElementById('saveMood').addEventListener('click', () => this.saveMood());

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

        // Update charts when switching to stats/trend/budget/history tabs
        if (tabName === 'stats') {
            this.updateStatistics();
        } else if (tabName === 'trend') {
            this.updateTrendChart();
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
    }

    saveExpenses() {
        localStorage.setItem('expenses', JSON.stringify(this.expenses));
    }

    updateStatistics() {
        this.updateCategoryChart();
        this.updateCategoryList();
        this.updateMoodStats();
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

    saveMood() {
        const note = document.getElementById('moodNote').value.trim();
        
        if (!this.selectedMood) {
            this.showMessage('请选择心情', 'error');
            return;
        }

        const moodEntry = {
            id: Date.now(),
            mood: this.selectedMood,
            note: note,
            date: new Date().toISOString().split('T')[0],
            timestamp: new Date().toISOString()
        };

        this.moods.push(moodEntry);
        localStorage.setItem('moods', JSON.stringify(this.moods));
        
        this.showMessage('心情记录成功！', 'success');
        this.updateMoodHistory();
        this.resetMoodForm();
    }

    resetMoodForm() {
        document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('selected'));
        document.getElementById('moodNote').value = '';
        this.selectedMood = null;
    }

    updateMoodHistory() {
        const moodHistory = document.getElementById('moodHistory');
        const recentMoods = this.moods.slice(-10).reverse();

        if (recentMoods.length === 0) {
            moodHistory.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">还没有心情记录，快来记录今天的心情吧！</p>';
            return;
        }

        const moodEmojis = {
            happy: '😊',
            sad: '😢',
            angry: '😠',
            excited: '🤩',
            worried: '😰',
            calm: '😌'
        };

        moodHistory.innerHTML = recentMoods.map(mood => `
            <div class="mood-entry">
                <div class="mood-entry-header">
                    <span>${moodEmojis[mood.mood]} ${mood.mood}</span>
                    <span class="mood-date">${mood.date}</span>
                </div>
                ${mood.note ? `<div class="mood-text">${mood.note}</div>` : ''}
            </div>
        `).join('');
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
        
        if (this.moods.length === 0) {
            moodSummary.innerHTML = `
                <h3>心情统计</h3>
                <p style="text-align: center; color: #666; padding: 20px;">还没有心情记录，快去记录你的心情吧！</p>
            `;
            return;
        }

        // Calculate mood statistics
        const moodStats = {};
        this.moods.forEach(mood => {
            if (!moodStats[mood.mood]) {
                moodStats[mood.mood] = {
                    count: 0,
                    totalScore: 0,
                    avgScore: 0
                };
            }
            moodStats[mood.mood].count++;
            moodStats[mood.mood].totalScore += this.getMoodScore(mood.mood);
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
        
        // Get expenses from current month
        const monthlyExpenses = this.expenses.filter(expense => 
            expense.date.startsWith(currentMonth)
        );

        // Get moods from current month
        const monthlyMoods = this.moods.filter(mood => 
            mood.date.startsWith(currentMonth)
        );

        // Create mood-expense correlation
        monthlyMoods.forEach(mood => {
            const moodDate = mood.date;
            const dayExpenses = monthlyExpenses.filter(expense => expense.date === moodDate);
            const totalAmount = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
            
            if (!moodExpenseData[mood.mood]) {
                moodExpenseData[mood.mood] = {
                    totalAmount: 0,
                    count: 0,
                    avgAmount: 0
                };
            }
            moodExpenseData[mood.mood].totalAmount += totalAmount;
            moodExpenseData[mood.mood].count++;
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

    updateMoodInsights() {
        const moodInsights = document.getElementById('moodInsights');
        
        if (this.moods.length === 0) {
            moodInsights.innerHTML = `
                <h3>心情消费洞察</h3>
                <p style="text-align: center; color: #666; padding: 20px;">记录更多心情数据，获取个性化洞察</p>
            `;
            return;
        }

        // Calculate insights
        const insights = this.calculateMoodInsights();
        
        moodInsights.innerHTML = `
            <h3>心情消费洞察</h3>
            ${insights.map(insight => `
                <div class="insight-item">
                    <div class="insight-text">${insight}</div>
                </div>
            `).join('')}
        `;
    }

    calculateMoodInsights() {
        const insights = [];
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // Get current month data
        const monthlyExpenses = this.expenses.filter(expense => 
            expense.date.startsWith(currentMonth)
        );
        const monthlyMoods = this.moods.filter(mood => 
            mood.date.startsWith(currentMonth)
        );

        if (monthlyMoods.length === 0) {
            insights.push('本月还没有心情记录，建议多记录心情来了解消费模式');
            return insights;
        }

        // Calculate mood-expense correlation
        const moodExpenseData = {};
        monthlyMoods.forEach(mood => {
            const moodDate = mood.date;
            const dayExpenses = monthlyExpenses.filter(expense => expense.date === moodDate);
            const totalAmount = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
            
            if (!moodExpenseData[mood.mood]) {
                moodExpenseData[mood.mood] = [];
            }
            moodExpenseData[mood.mood].push(totalAmount);
        });

        // Generate insights
        const moodAverages = {};
        Object.keys(moodExpenseData).forEach(mood => {
            const amounts = moodExpenseData[mood];
            moodAverages[mood] = amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
        });

        // Find highest and lowest spending moods
        const sortedMoods = Object.entries(moodAverages).sort(([,a], [,b]) => b - a);
        
        if (sortedMoods.length > 0) {
            const [highestMood, highestAmount] = sortedMoods[0];
            const [lowestMood, lowestAmount] = sortedMoods[sortedMoods.length - 1];
            
            insights.push(`<span class="insight-highlight">${this.getMoodName(highestMood)}</span>时平均消费最高，达到¥${highestAmount.toFixed(2)}`);
            insights.push(`<span class="insight-highlight">${this.getMoodName(lowestMood)}</span>时消费最理性，平均¥${lowestAmount.toFixed(2)}`);
        }

        // Calculate overall mood score
        const totalMoodScore = monthlyMoods.reduce((sum, mood) => sum + this.getMoodScore(mood.mood), 0);
        const avgMoodScore = totalMoodScore / monthlyMoods.length;
        
        if (avgMoodScore >= 4) {
            insights.push('本月整体心情<span class="insight-highlight">非常积极</span>，继续保持好心情！');
        } else if (avgMoodScore >= 3) {
            insights.push('本月心情<span class="insight-highlight">比较稳定</span>，消费也比较理性');
        } else {
            insights.push('本月心情<span class="insight-highlight">需要关注</span>，建议多做一些让自己开心的事情');
        }

        // Category insights
        const categoryTotals = {};
        monthlyExpenses.forEach(expense => {
            categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + expense.amount;
        });
        
        const topCategory = Object.entries(categoryTotals).sort(([,a], [,b]) => b - a)[0];
        if (topCategory) {
            insights.push(`本月在<span class="insight-highlight">${topCategory[0]}</span>上花费最多，共¥${topCategory[1].toFixed(2)}`);
        }

        return insights;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ExpenseTracker();
});
