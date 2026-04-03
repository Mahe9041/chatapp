/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_WS_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Tell TypeScript that .scss files imported as modules return an object
declare module '*.module.scss' {
    const classes: Record<string, string>;
    export default classes;
}

declare module '*.module.css' {
    const classes: Record<string, string>;
    export default classes;
}