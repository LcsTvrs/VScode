import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const eslintConfig = [
  { ignores: [".next/**", ".local/**", ".vercel/**", "out/**", "build/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/features/**/components/**/*.{ts,tsx}", "src/features/**/hooks/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["@/lib/prisma", "**/lib/prisma", "@/features/*/server/**", "**/server/**"], message: "Componentes e hooks de interface não podem importar módulos de servidor; use a API HTTP." },
      ] }],
    },
  },
];

export default eslintConfig;
