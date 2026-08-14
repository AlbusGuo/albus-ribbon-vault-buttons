// Inlines imported files into the provided CSS.
// Usage: @import "./settings.css".

import fs from 'fs/promises';
import path from 'path';

export async function fileInliner(inputCssPath, outputCssPath) {
	try {
		const css = await fs.readFile(inputCssPath, 'utf8');
		let result = css;

		// 简单的 @import 处理器
		const importRegex = /@import\s+["']([^"']+)["'];/g;
		let match;
		const imports = [];

		while ((match = importRegex.exec(css)) !== null) {
			imports.push({
				statement: match[0],
				filePath: match[1],
			});
		}

		// 按顺序处理所有 import
		for (const imp of imports) {
			const fullPath = path.resolve(path.dirname(inputCssPath), imp.filePath);
			try {
				const fileContent = await fs.readFile(fullPath, 'utf8');
				result = result.replace(imp.statement, fileContent);
			} catch (err) {
				console.error(`\x1b[31m[file-inliner] error reading file:\x1b[0m ${fullPath}`, err);
				throw err;
			}
		}

		await fs.writeFile(outputCssPath, result);
		console.log('[file-inliner] CSS processing complete');
	} catch (error) {
		console.error('[file-inliner] CSS processing failed:', error);
		throw error;
	}
}
