/**
 * 博客系统API接口模块
 * 处理前端与后端的通信
 */

// 根据环境设置API基础URL
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'  // 开发环境
  : '/api';  // 生产环境

// WebSocket连接管理
const wsManager = {
  ws: null,
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectInterval: 3000,
  listeners: new Map(),

  // 初始化WebSocket连接
  init() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('WebSocket连接已建立');
      this.reconnectAttempts = 0;
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.notifyListeners(data);
      } catch (error) {
        console.error('WebSocket消息处理错误:', error);
      }
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket连接已关闭');
      this.reconnect();
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket错误:', error);
    };
  },

  // 重连机制
  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.init(), this.reconnectInterval);
    } else {
      console.error('WebSocket重连失败，已达到最大重试次数');
    }
  },

  // 添加事件监听器
  addListener(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);
  },

  // 移除事件监听器
  removeListener(type, callback) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(callback);
    }
  },

  // 通知所有监听器
  notifyListeners(data) {
    const { type, payload } = data;
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => callback(payload));
    }
  },

  // 发送消息
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket未连接，无法发送消息');
    }
  }
};

// 初始化WebSocket连接
wsManager.init();

// 数据缓存管理
const cacheManager = {
  cache: new Map(),
  lastSync: new Map(),

  // 设置缓存
  setCache(key, data, ttl = 60000) { // 默认缓存1分钟
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  },

  // 获取缓存
  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  },

  // 清除缓存
  clearCache(key) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  },

  // 更新最后同步时间
  updateLastSync(endpoint) {
    this.lastSync.set(endpoint, Date.now());
  },

  // 检查是否需要同步
  needsSync(endpoint, syncInterval = 30000) { // 默认30秒同步一次
    const lastSync = this.lastSync.get(endpoint);
    return !lastSync || (Date.now() - lastSync > syncInterval);
  }
};

// 全局错误处理
function handleError(error) {
  console.error('API错误:', error);
  
  // 如果是跨域错误，提供更友好的错误信息
  if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
    return Promise.reject('无法连接到服务器，请检查网络连接或服务器状态');
  }
  
  if (error.response && error.response.data && error.response.data.message) {
    return Promise.reject(error.response.data.message);
  }
  
  return Promise.reject('网络请求失败，请稍后重试');
}

// 统一的API请求封装
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const cacheKey = `${options.method || 'GET'}:${url}`;
  
  // 如果是GET请求且缓存有效，直接返回缓存数据
  if (options.method === 'GET' || !options.method) {
    const cachedData = cacheManager.getCache(cacheKey);
    if (cachedData && !cacheManager.needsSync(endpoint)) {
      return cachedData;
    }
  }
  
  // 获取存储的令牌
  const token = localStorage.getItem('authToken');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  // 如果有令牌，则添加到头部
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // 添加这行以支持跨域请求时发送cookies
    });
    
    // 检查响应状态
    if (!response.ok) {
      // 尝试解析错误信息
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || `请求失败: ${response.status}`);
      } catch (e) {
        throw new Error(`请求失败: ${response.status}`);
      }
    }
    
    // 尝试解析JSON响应
    const data = await response.json();
    
    // 缓存GET请求的响应
    if (options.method === 'GET' || !options.method) {
      cacheManager.setCache(cacheKey, data);
      cacheManager.updateLastSync(endpoint);
    } else {
      // 非GET请求成功后清除相关缓存
      cacheManager.clearCache();
      // 发送WebSocket消息通知其他客户端
      wsManager.send({
        type: 'dataUpdate',
        payload: {
          endpoint,
          method: options.method,
          data
        }
      });
    }
    
    return data;
  } catch (error) {
    return handleError(error);
  }
}

// API模块
const api = {
  // 内容相关接口
  contents: {
    // 获取内容列表
    getList: (params = {}) => {
      const queryParams = new URLSearchParams();
      
      if (params.type) queryParams.append('type', params.type);
      if (params.category) queryParams.append('category', params.category);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.page) queryParams.append('page', params.page);
      
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      
      return apiRequest(`/articles${queryString}`, {
        method: 'GET'
      });
    },
    
    // 获取内容详情
    getDetail: (id) => {
      return apiRequest(`/articles/${id}`, {
        method: 'GET'
      });
    },
    
    // 创建内容
    create: (data) => {
      return apiRequest('/articles', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    
    // 更新内容
    update: (id, data) => {
      return apiRequest(`/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    
    // 删除内容
    delete: (id, username) => {
      return apiRequest(`/articles/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ username })
      });
    },
    
    // 添加评论
    addComment: (contentId, data) => {
      return apiRequest(`/articles/${contentId}/comments`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    
    // 点赞/取消点赞
    toggleLike: (contentId, username) => {
      return apiRequest(`/articles/${contentId}/like`, {
        method: 'POST',
        body: JSON.stringify({ username })
      });
    }
  },
  
  // 用户相关接口
  users: {
    // 用户注册
    register: (data) => {
      return apiRequest('/users/register', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    
    // 用户登录
    login: (data) => {
      return apiRequest('/users/login', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    
    // 获取当前用户信息
    getCurrentUser: () => {
      return apiRequest('/users/me', {
        method: 'GET'
      });
    },
    
    // 获取用户内容
    getUserContents: (username, params = {}) => {
      const queryParams = new URLSearchParams();
      
      if (params.type) queryParams.append('type', params.type);
      if (params.limit) queryParams.append('limit', params.limit);
      if (params.page) queryParams.append('page', params.page);
      
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      
      return apiRequest(`/users/${username}/contents${queryString}`, {
        method: 'GET'
      });
    },
    
    // 更新用户信息
    updateUser: (id, data) => {
      return apiRequest(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    }
  },
  
  // 统计相关接口
  stats: {
    // 获取访问统计
    getVisits: () => {
      return apiRequest('/stats/visits', {
        method: 'GET'
      });
    },
    
    // 获取内容统计
    getContentStats: () => {
      return apiRequest('/stats/contents', {
        method: 'GET'
      });
    },
    
    // 获取热门内容
    getPopular: (limit = 5) => {
      return apiRequest(`/stats/popular?limit=${limit}`, {
        method: 'GET'
      });
    },
    
    // 获取类别统计
    getCategories: () => {
      return apiRequest('/stats/categories', {
        method: 'GET'
      });
    },
    
    // 获取每日发布统计
    getDailyStats: (days = 30) => {
      return apiRequest(`/stats/daily?days=${days}`, {
        method: 'GET'
      });
    }
  },

  // 添加数据同步方法
  sync: {
    // 强制同步所有数据
    forceSync: async () => {
      cacheManager.clearCache();
      return Promise.all([
        api.contents.getList(),
        api.stats.getContentStats(),
        api.stats.getCategories()
      ]);
    },

    // 检查更新
    checkUpdates: async () => {
      const needsUpdate = Array.from(cacheManager.lastSync.entries())
        .some(([endpoint, lastSync]) => cacheManager.needsSync(endpoint));
      
      if (needsUpdate) {
        return api.sync.forceSync();
      }
      return null;
    }
  },

  // WebSocket相关方法
  ws: {
    // 添加数据更新监听器
    onDataUpdate: (callback) => {
      wsManager.addListener('dataUpdate', callback);
    },

    // 移除数据更新监听器
    offDataUpdate: (callback) => {
      wsManager.removeListener('dataUpdate', callback);
    }
  }
};

// 导出API模块
window.api = api;

// 添加自动同步机制
setInterval(() => {
  api.sync.checkUpdates().catch(console.error);
}, 30000); // 每30秒检查一次更新 