import type { NextConfig } from "next";

const apiTarget = process.env.API_PROXY_TARGET ?? "http://localhost:3100";

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
    // 页面均为客户端组件 + TanStack Query 拉取数据，无法在服务端预渲染
    // 阶段验证 instant navigation；仅对显式配置 instant 的段做校验。
    instantInsights: {
      validationLevel: "manual-warning",
    },
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
