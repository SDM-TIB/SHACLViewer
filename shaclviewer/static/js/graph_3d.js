/**
 * graph_3d.js — 3-D ForceGraph renderer for the SHACLViewer.
 *
 * This module:
 *  1. Reads the serialised graph + URL config from the JSON data island.
 *  2. Builds internal graph data via graph_shared.buildGraphData().
 *  3. Creates the ForceGraph3D instance.
 *  4. Delegates all shared UI wiring to graph_shared.initAll().
 *
 * The only page-specific logic kept here is the 3-D sprite rendering and
 * camera helper (focusNode, updateNode3d, updateLinkDistance, drawGraph).
 */

// CSS2DRenderer is intentionally omitted: the 3-D view renders node labels as
// SpriteText (THREE.Sprite), not CSS2D elements, so the CSS2DRenderer is unused
// and would only add an extra Three.js import on top of the copy bundled inside
// 3d-force-graph.min.js.
import SpriteText from 'SpriteText';
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

/** Build and configure a SpriteText object for a graph node. */
function buildSprite(node) {
    const sprite              = new SpriteText(node.text);
    sprite.material.depthWrite = false;
    sprite.textHeight          = 8;
    sprite.padding             = 2;
    sprite.borderRadius        = 2;
    sprite.borderWidth         = node.highlighted ? 2 : 1;
    sprite.backgroundColor     = isDarkMode()
        ? settings.nodeBackgroundColorDark
        : settings.nodeBackgroundColorLight;

    // Border colour by node role
    if (node.isClass) {
        sprite.borderColor = node.expanded
            ? settings.nodeBorderColorExpanded
            : settings.nodeBorderColor;
    } else if (node.isAttribute) {
        sprite.borderColor = settings.attributeBorderColor;
    } else {
        sprite.borderColor = settings.linkNodeBorderColor;
    }

    // Validation colouring
    const color = colorForRange(node.colorRange);
    if (!isDarkMode()) {
        sprite.backgroundColor = color;
    } else {
        sprite.color = color;
    }
    sprite.borderColor = color;

    // Data-graph overlay: override colours for un-retrieved nodes
    if (node.isClass && isDataGraphMode()) {
        const dark        = isDarkMode();
        const notRetrieved = !node.retrieved;
        sprite.color           = dark
            ? (notRetrieved ? settings.nodeColorNotRetrievedDark  : settings.nodeColorDark)
            : (notRetrieved ? settings.nodeColorNotRetrievedLight : settings.nodeColorLight);
        sprite.borderColor     = sprite.color;
        sprite.backgroundColor = dark
            ? (notRetrieved ? settings.nodeBackgroundColorNotRetrievedDark  : settings.nodeBackgroundColorDark)
            : (notRetrieved ? settings.nodeBackgroundColorNotRetrievedLight : settings.nodeBackgroundColorLight);
    }

    return sprite;
}

let isGraphInit = false;
const elem      = document.getElementById('3d-graph');
let Graph       = ForceGraph3D();

function drawGraph() {
    Graph = ForceGraph3D()  // no extraRenderers: CSS2DRenderer is not needed here
        (elem)
        .graphData(getVisibleLists())
        .linkCurvature('curvature')
        .linkCurveRotation('rotation')
        .nodeAutoColorBy('group')
        .linkOpacity(1)
        .backgroundColor('#212121')
        .linkColor(link => link.highlighted ? 'rgb(255,64,0)' : '#909090')
        .linkWidth(link => link.highlighted ? 2 : 0)
        .linkDirectionalParticles('particles')
        .linkDirectionalParticleSpeed(d => d.particles * 0.002)
        .linkDirectionalParticleWidth(link => link.highlighted ? 4 : 2)
        .nodeThreeObject(node => buildSprite(node))
        .onNodeHover(node => { elem.style.cursor = node?.isClass ? 'pointer' : 'unset'; });
    // onNodeClick is wired by initAll
}

/** Stored after drawGraph() so updateLinkDistance() can reference it. */
let linkForce = null;

function updateLinkDistance() {
    linkForce?.distance(link => getLinkLength(link.linkType));
    Graph.numDimensions(3); // re-heat simulation
}

function updateNode3d() {
    if (!isGraphInit) return;
    Graph
        .nodeColor(Graph.nodeColor())
        .nodeThreeObject(Graph.nodeThreeObject())
        .linkWidth(Graph.linkWidth())
        .linkDirectionalParticleWidth(Graph.linkDirectionalParticleWidth());
}

function focusNode(node) {
    const distance  = 400;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
    Graph.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        1000,
    );
}

drawGraph();
linkForce  = Graph.d3Force('link');
isGraphInit = true;

document.querySelector('#navigationBar').innerHTML =
    `<li class="nav-item">` +
    `<a class="nav-link" href="${config.altViewUrl}?path=${config.path}">2D</a>` +
    `</li>` +
    `<li class="nav-item active">` +
    `<a class="nav-link" href="?path=${config.path}">3D <span class="sr-only">(current)</span></a>` +
    `</li>`;

initAll(Graph, config, { updateNode3d, focusNode, updateLinkDistance });
