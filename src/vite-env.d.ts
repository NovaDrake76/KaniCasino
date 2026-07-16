/// <reference types="vite/client" />

// react 18.2 has no typing for fetchpriority and warns on the camelCase spelling, but
// passes the lowercase attribute straight through to the dom, which is what we want
import "react";

declare module "react" {
  interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    fetchpriority?: "high" | "low" | "auto";
  }
}
