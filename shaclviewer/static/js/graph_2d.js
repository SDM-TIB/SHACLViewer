/**
 * graph_2d.js — 2-D ForceGraph renderer for the SHACLViewer.
 *
 * This module:
 *  1. Reads the serialised graph + URL config from the JSON data island.
 *  2. Builds internal graph data via graph_shared.buildGraphData().
 *  3. Creates the ForceGraph (2-D) instance.
 *  4. Delegates all shared UI wiring to graph_shared.initAll().
 *
 * The only page-specific logic kept here is the 2-D canvas rendering and
 * camera helpers (roundRect, focusNode, updateNode3d, updateLinkDistance).
 */

import { CSS2DRenderer } from 'CSS2DRenderer';
import {
    buildGraphData,
    getVisibleLists,
    initAll,
    settings,
    getLinkLength,
    isDarkMode,
    isDataGraphMode,
} from 'graph_shared';

const config = JSON.parse(document.getElementById('shacl-config').textContent);
buildGraphData(config.graph);

/** Map a node's colorRange to a hex colour string. */
function colorForRange(colorRange) {
    switch (colorRange) {
        case 0: return '#0af';
        case 1: return '#0c0';
        case 2: return '#ff0';
        case 3: return '#f80';
        case 4: return '#c00';
        case 5: return isDarkMode() ? '#ccc' : '#666';
        default: return '#aaa';
    }
}

/** Draw a rounded rectangle on the canvas context. */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

/** Paint a single node onto the canvas. */
function paintNode(node, ctx, globalScale) {
    const label      = node.text;
    const fontSize   = 18 / globalScale;
    ctx.font         = `${fontSize}px Sans-Serif`;
    const textWidth  = ctx.measureText(label).width;
    const bckgDim    = [textWidth, fontSize].map(n => n + fontSize * 0.5);

    // Validation colouring — updates shared settings so 3-D renderer stays in sync
    const color = colorForRange(node.colorRange);
    settings.nodeColorDark                = color;
    settings.nodeBackgroundColorLight     = color;
    settings.nodeBorderColor              = color;
    settings.nodeBorderColorExpanded      = color;
    settings.attributeBorderColor         = color;
    settings.linkNodeBorderColor          = color;

    const dark        = isDarkMode();
    const notRetrieved = isDataGraphMode() && !node.retrieved;

    // Background fill
    ctx.fillStyle = dark
        ? (notRetrieved ? settings.nodeBackgroundColorNotRetrievedDark  : settings.nodeBackgroundColorDark)
        : (notRetrieved ? settings.nodeBackgroundColorNotRetrievedLight : settings.nodeBackgroundColorLight);

    // Border colour
    if (node.isClass) {
        ctx.strokeStyle = node.expanded ? settings.nodeBorderColorExpanded : settings.nodeBorderColor;
    } else if (node.isAttribute) {
        ctx.strokeStyle = settings.attributeBorderColor;
    } else {
        ctx.strokeStyle = settings.linkNodeBorderColor;
    }

    const borderThickness = 4;
    roundRect(
        ctx,
        node.x - bckgDim[0] / 2,
        node.y - bckgDim[1] / 2,
        (textWidth + borderThickness) * 1.01 + 2,
        fontSize * 1.1 + borderThickness,
        2,
    );

    // Text fill
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = dark
        ? (notRetrieved ? settings.nodeColorNotRetrievedDark  : settings.nodeColorDark)
        : (notRetrieved ? settings.nodeColorNotRetrievedLight : settings.nodeColorLight);
    ctx.fillText(label, node.x, node.y);

    node.__bckgDimensions = bckgDim; // reused by nodePointerAreaPaint
}

let isGraphInit = false;
const elem      = document.getElementById('3d-graph');

const Graph = ForceGraph({ extraRenderers: [new CSS2DRenderer()] })
    (elem)
    .graphData(getVisibleLists())
    .linkCurvature('curvature')
    .backgroundColor('#212121')
    .linkColor(link => link.highlighted ? 'rgb(255,64,0)' : '#909090')
    .linkWidth(link => link.highlighted ? 2 : 0)
    .linkDirectionalParticles('particles')
    .linkDirectionalParticleSpeed(d => d.particles * 0.002)
    .linkDirectionalParticleWidth(link => link.highlighted ? 4 : 2)
    .nodeCanvasObject((node, ctx, globalScale) => paintNode(node, ctx, globalScale))
    .nodePointerAreaPaint((node, color, ctx) => {
        ctx.fillStyle = color;
        const d = node.__bckgDimensions;
        if (d) ctx.fillRect(node.x - d[0] / 2, node.y - d[1] / 2, ...d);
    })
    .onNodeHover(node => { elem.style.cursor = node?.isClass ? 'pointer' : 'unset'; });
// onNodeClick is wired by initAll

const linkForce = Graph.d3Force('link').distance(link => getLinkLength(link.linkType));
Graph.d3Force('charge').strength(-520);

function updateLinkDistance() {
    linkForce.distance(link => getLinkLength(link.linkType));
    Graph.d3ReheatSimulation();
}

function updateNode3d() {
    if (!isGraphInit) return;
    Graph
        .nodeCanvasObject(Graph.nodeCanvasObject())
        .linkWidth(Graph.linkWidth())
        .linkDirectionalParticleWidth(Graph.linkDirectionalParticleWidth());
}

function focusNode(node) {
    Graph.centerAt(node.x, node.y, 1000);
    Graph.zoom(2, 1000);
}

isGraphInit = true;

document.querySelector('#navigationBar').innerHTML =
    `<li class="nav-item active">` +
    `<a class="nav-link" href="?path=${config.path}">2D <span class="sr-only">(current)</span></a>` +
    `</li>` +
    `<li class="nav-item">` +
    `<a class="nav-link" href="${config.altViewUrl}?path=${config.path}">3D</a>` +
    `</li>`;

initAll(Graph, config, { updateNode3d, focusNode, updateLinkDistance });
