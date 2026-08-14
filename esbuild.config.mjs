import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { fileInliner } from "./build/file-inliner.mjs";

const banner =
`/*
This is a generated bundle created by esbuild.
To view the source, visit this plugin's GitHub repository.
*/
`;

const prod = (process.argv[2] === "production");

// Inline imported files into CSS.
const fileInlinerPlugin = {
	name: 'file-inliner-plugin',
	setup(build) {
	  build.onEnd(async () => {
		try {
			await fileInliner('src/Styles/styles.css', 'styles.css');
		} catch {
			process.exit(1);
		}
	  });
	},
};

const context = await esbuild.context({
	banner: {
		js: banner,
	},
	entryPoints: ["main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins],
	format: "cjs",
	target: "ES2022",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	minify: prod,
	plugins: [fileInlinerPlugin],
});

if (prod) {
	await context.rebuild();
	process.exit(0);
} else {
	await context.watch();
}
