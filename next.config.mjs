

const isProd = process.env.NODE_ENV === "production";

const nextConfig = {
  output: "export",
  basePath: isProd ? "/whatsapp-chat-reader" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
