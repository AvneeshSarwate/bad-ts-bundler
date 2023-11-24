import * as fs from "fs";
import * as path from "path";

function extractImports(content: string, currentDir: string): string[] {
  const importExportRegex = /^(import|export) .* from ['"].*['"];\s*$/gm;
  const imports: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = importExportRegex.exec(content)) !== null) {
    // console.log("ay", match[0]);
    const importPathMatch = match[0].match(/from ['"](.*)['"]/);
    if (importPathMatch && importPathMatch[1]) {
      const importPath = importPathMatch[1];
      const resolvedPath = path.resolve(
        currentDir,
        `${importPath}.ts`
      );
      imports.push(resolvedPath);
    }
  }

  return imports;
}

// Function to detect circular dependencies
function hasCircularDependencies(entryFilePath: string): boolean {
  const fileDependencies = new Map<string, string[]>();
  const visitedFiles = new Set<string>();
  const recStack = new Set<string>();

  function detectCycle(filePath: string): boolean {
    if (recStack.has(filePath)) {
      return true;
    }

    if (visitedFiles.has(filePath)) {
      return false;
    }

    visitedFiles.add(filePath);
    recStack.add(filePath);

    const content = fs.readFileSync(filePath, "utf8");
    const imports = extractImports(content, path.dirname(filePath));
    fileDependencies.set(filePath, imports);

    for (const importPath of imports) {
      if (detectCycle(importPath)) {
        return true;
      }
    }

    recStack.delete(filePath);
    return false;
  }

  return detectCycle(entryFilePath);
}

// Function to bundle TypeScript files
function bundleTypescript(entryFilePath: string, outputPath: string): void {
  const processedFiles = new Set<string>();
  let outputContent = "";

  function processFile(filePath: string): void {
    if (processedFiles.has(filePath)) {
      return;
    }

    console.log(`Processing ${filePath}`);

    const content = fs.readFileSync(filePath, "utf8");
    const imports = extractImports(content, path.dirname(filePath));

    // Process each import recursively in DFS manner
    imports.forEach((importFilePath) => processFile(importFilePath));

    // Write file content after processing all dependencies
    if (!processedFiles.has(filePath)) {
      outputContent += `\n// File: ${filePath}\n${content.replace(
        /^import .* from '.*';\s*$/gm,
        ""
      )}`;
      processedFiles.add(filePath);
    }
  }

  if (hasCircularDependencies(entryFilePath)) {
    console.error(
      "Circular dependencies detected. Cannot proceed with bundling."
    );
    return;
  }

  processFile(entryFilePath);
  fs.writeFileSync(outputPath, outputContent);
  console.log(`Bundled TypeScript files into ${outputPath}`);
}

const entryFilePath = process.argv[2];
const outputPath = "bundle.ts";

if (!entryFilePath) {
  console.error("No entry file specified.");
} else {
  bundleTypescript(entryFilePath, outputPath);
}
