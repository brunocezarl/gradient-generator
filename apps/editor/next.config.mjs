/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@shadercanvas/engine",
    "@shadercanvas/scene-schema",
    "@shadercanvas/runtime-sdk",
  ],
};

export default nextConfig;
