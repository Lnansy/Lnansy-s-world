/**
 * 博客系统API接口模块
 * 处理前端与后端的通信
 */

const API_BASE_URL = '/api';

// 全局错误处理
function handleError(error) {
  console.error('API错误:', error);
  
  if (error.response && error.response.data && error.response.data.message) {
    return Promise.reject(error.response.data.message);
  }
  
  return Promise.reject('网络请求失败，请稍后重试');
}

// 统一的API请求封装
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
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
      headers
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
  }
};

// 导出API模块
window.api = api; 