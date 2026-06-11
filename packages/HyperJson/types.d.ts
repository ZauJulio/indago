/// <reference types="vite/client" />
/// <reference types="bun-types" />

declare module "virtual:hyperjson-config" {
  import type { HyperJsonConfiguration } from "@virtus/hyper-json/lib";
  const config: HyperJsonConfiguration;
  export default config;
}
