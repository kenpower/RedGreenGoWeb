import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import css from 'rollup-plugin-css-only';
import json from '@rollup/plugin-json';
import fs from 'fs';

const production = !process.env.ROLLUP_WATCH;

// Ships the student helper next to the bundle so the app can offer it as a
// same-origin download (public/build/rgg_server.py, and docs/ after publish).
function helperScript() {
	const file = 'rgg_server.py';
	return {
		buildStart() {
			this.addWatchFile(file);
		},
		generateBundle() {
			this.emitFile({ type: 'asset', fileName: file, source: fs.readFileSync(file) });
		}
	};
}

// Writes build/version.txt (git short hash + build time). The page fetches it with
// cache: "no-store" and loads bundle.js?v=<it>, so a release is picked up at once even
// though GitHub Pages lets browsers cache files for 10 minutes.
function versionFile() {
	return {
		generateBundle() {
			let hash = 'dev';
			try {
				hash = require('child_process').execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
			} catch (e) {}
			this.emitFile({ type: 'asset', fileName: 'version.txt', source: `${hash}-${Date.now().toString(36)}` });
		}
	};
}

function serve() {
	let server;

	function toExit() {
		if (server) server.kill(0);
	}

	return {
		writeBundle() {
			if (server) return;
			server = require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
				stdio: ['ignore', 'inherit', 'inherit'],
				shell: true
			});

			process.on('SIGTERM', toExit);
			process.on('exit', toExit);
		}
	};
}

export default {
	input: 'src/main.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
		file: 'public/build/bundle.js'
	},
	plugins: [
		svelte({
			compilerOptions: {
				// enable run-time checks when not in production
				dev: !production
			}
		}),
		// we'll extract any component CSS out into
		// a separate file - better for performance
		css({ output: 'bundle.css' }),

		// If you have external dependencies installed from
		// npm, you'll most likely need these plugins. In
		// some cases you'll need additional configuration -
		// consult the documentation for details:
		// https://github.com/rollup/plugins/tree/master/packages/commonjs
		resolve({
			browser: true,
			dedupe: ['svelte']
		}),
		commonjs(),
		helperScript(),
		versionFile(),

		// In dev mode, call `npm run start` once
		// the bundle has been generated
		!production && serve(),

		// Watch the `public` directory and refresh the
		// browser on changes when not in production
		!production && livereload('public'),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		production && terser(),

		json()
	],
	watch: {
		clearScreen: false
	}
};
