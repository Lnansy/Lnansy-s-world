// API 请求函数
const api = {
    async getArchives() {
        const response = await fetch('/api/archives');
        return response.json();
    }
};

// 页面功能管理器
const archiveManager = {
    // 加载归档数据
    async loadArchives() {
        try {
            const archives = await api.getArchives();
            const archiveList = document.querySelector('.archive-list');
            
            if (archives.length === 0) {
                archiveList.innerHTML = '<li class="archive-item">暂无文章</li>';
                return;
            }

            archiveList.innerHTML = archives.map(archive => `
                <li class="archive-item">
                    <a href="#" class="archive-link" data-year-month="${archive.yearMonth}">
                        <span>${archive.displayDate}</span>
                        <span>(${archive.count})</span>
                    </a>
                </li>
            `).join('');

            this.bindArchiveEvents();
        } catch (error) {
            console.error('加载归档数据失败:', error);
            const archiveList = document.querySelector('.archive-list');
            archiveList.innerHTML = '<li class="archive-item error-message">加载归档失败，请稍后重试</li>';
        }
    },

    // 绑定归档相关事件
    bindArchiveEvents() {
        document.querySelectorAll('.archive-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const yearMonth = e.currentTarget.dataset.yearMonth;
                window.location.href = `records.html?date=${yearMonth}`;
            });
        });
    },

    // 初始化
    init() {
        this.loadArchives();
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    archiveManager.init();
}); 