export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 只处理 HTML 请求
    if (url.pathname.endsWith('.html')) {
      const response = await env.ASSETS.fetch(request);
      let html = await response.text();
      
      // 替换占位符为实际值
      const apiBase = env.API_BASE || '';
      html = html.replace(/__API_BASE__/g, apiBase);
      
      return new Response(html, response);
    }
    
    // 其他文件直接返回
    return env.ASSETS.fetch(request);
  }
};
