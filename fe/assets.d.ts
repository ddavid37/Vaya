// Ambient modules for static assets imported by the UI.

declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const src: import("next/image").StaticImageData;
  export default src;
}
