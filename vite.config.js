import { join, dirname } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  root: join(__dirname, "client"),
  plugins: [react()],
  base: "./",
  build: {
    outDir: join(__dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
};
