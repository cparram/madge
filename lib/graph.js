'use strict';

const path = require('path');
const pify = require('pify');
const graphviz = require('graphviz');

const exec = pify(require('child_process').exec);
const writeFile = pify(require('fs').writeFile);

/**
 * Set color on a node.
 * @param  {Object} node
 * @param  {Object} config
 */
function setNodeColor(node, config, id) {
	const assetsColor = (/^assets/.test(id) && config.assetsColor)
	const componentsColor = (/^components/.test(id) && config.componentsColor)
	const hocsColor = (/^hocs/.test(id) && config.hocsColor)
	const hooksColor = (/^hooks/.test(id) && config.hooksColor)
	const pagesColor = (/^pages/.test(id) && config.pagesColor)
	const rootColor = (/^root/.test(id) && config.rootColor)
	const utilsColor = (/^utils/.test(id) && config.utilsColor)
	const initColor = (/^init/.test(id) && '#FEC8D8')

	const color = assetsColor || componentsColor || hocsColor || hooksColor || pagesColor || rootColor || utilsColor || initColor || '#ffffff';

	node.set('fillcolor', color);
	node.set('style', 'filled,rounded');
}

/**
 * Check if Graphviz is installed on the system.
 * @param  {Object} config
 * @return {Promise}
 */
function checkGraphvizInstalled(config) {
	if (config.graphVizPath) {
		const cmd = path.join(config.graphVizPath, 'gvpr -V');
		return exec(cmd)
			.catch(() => {
				throw new Error('Could not execute ' + cmd);
			});
	}

	return exec('gvpr -V')
		.catch((error) => {
			throw new Error('Graphviz could not be found. Ensure that "gvpr" is in your $PATH.\n' + error);
		});
}

/**
 * Return options to use with graphviz digraph.
 * @param  {Object} config
 * @return {Object}
 */
function createGraphvizOptions(config) {
	const graphVizOptions = config.graphVizOptions || {};

	return {
		// Graph
		G: Object.assign({
			overlap: false,
			pad: 0.3,
			rankdir: config.rankdir,
			layout: config.layout,
			bgcolor: config.backgroundColor
		}, graphVizOptions.G),
		// Edge
		E: Object.assign({
			color: config.edgeColor
		}, graphVizOptions.E),
		// Node
		N: Object.assign({
			fontname: config.fontName,
			fontsize: config.fontSize,
			color: config.nodeColor,
			shape: config.nodeShape,
			style: config.nodeStyle,
			height: 0,
			fontcolor: config.nodeColor
		}, graphVizOptions.N)
	};
}

/**
 * Creates the graphviz graph.
 * @param  {Object} modules
 * @param  {Array} circular
 * @param  {Object} config
 * @param  {Object} options
 * @return {Promise}
 */
function createGraph(modules, circular, config, options) {
	const g = graphviz.digraph('G');
	const nodes = {};
	const cyclicModules = circular.reduce((a, b) => a.concat(b), []);

	if (config.graphVizPath) {
		g.setGraphVizPath(config.graphVizPath);
	}

	Object.keys(modules).forEach((id) => {
		nodes[id] = nodes[id] || g.addNode(id.replace(/^(assets|hocs|pages|root|utils|hooks|components|init)\//, ''));

		// TODO: Set edge color for cyclics.
		setNodeColor(nodes[id], config, id)


		modules[id].forEach((depId) => {
			nodes[depId] = nodes[depId] || g.addNode(depId.replace(/^(assets|hocs|pages|root|utils|hooks|components|init)\//, ''));
			setNodeColor(nodes[depId], config, depId)

			g.addEdge(nodes[id], nodes[depId]);
		});
	});
	return new Promise((resolve, reject) => {
		g.output(options, resolve, (code, out, err) => {
			reject(new Error(err));
		});
	});
}

/**
 * Return the module dependency graph XML SVG representation as a Buffer.
 * @param  {Object} modules
 * @param  {Array} circular
 * @param  {Object} config
 * @return {Promise}
 */
module.exports.svg = function (modules, circular, config) {
	const options = createGraphvizOptions(config);

	options.type = 'svg';

	return checkGraphvizInstalled(config)
		.then(() => createGraph(modules, circular, config, options));
};

/**
 * Creates an image from the module dependency graph.
 * @param  {Object} modules
 * @param  {Array} circular
 * @param  {String} imagePath
 * @param  {Object} config
 * @return {Promise}
 */
module.exports.image = function (modules, circular, imagePath, config) {
	const options = createGraphvizOptions(config);

	options.type = path.extname(imagePath).replace('.', '') || 'png';

	return checkGraphvizInstalled(config)
		.then(() => {
			return createGraph(modules, circular, config, options)
				.then((image) => writeFile(imagePath, image))
				.then(() => path.resolve(imagePath));
		});
};

/**
 * Return the module dependency graph as DOT output.
 * @param  {Object} modules
 * @param  {Array} circular
 * @param  {Object} config
 * @return {Promise}
 */
module.exports.dot = function (modules, circular, config) {
	const options = createGraphvizOptions(config);

	options.type = 'dot';

	return checkGraphvizInstalled(config)
		.then(() => createGraph(modules, circular, config, options))
		.then((output) => output.toString('utf8'));
};
