import express, { type Express } from "express";
import fs from "fs";
import path from "path";

const __dirname = path.resolve();

export function serveStatic(app: Express) {
  // Try multiple possible paths to find the frontend build
  // In bundled production: dist/index.cjs runs, public is sibling folder
  // The build outputs to dist/public
  const possiblePaths = [
    path.resolve(__dirname, "public"),                    // When running from dist/index.cjs
    path.resolve(process.cwd(), "dist", "public"),        // Fallback using cwd
  ];

  let distPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, "index.html"))) {
      distPath = p;
      break;
    }
  }

  if (!distPath) {
    throw new Error(
      `Could not find the build directory. Tried: ${possiblePaths.join(", ")}. Make sure to build the client first.`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.get("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
