/**
 * graph_shared.js — shared graph logic for 2-D and 3-D views.
 *
 * Usage:
 *   1. Call buildGraphData(rawGraph) to populate the internal nodes/links
 *      arrays from the JSON data island.
 *   2. Use getVisibleLists() when initialising the ForceGraph instance.
 *   3. Call initAll(Graph, settings, config, { updateNode3d, focusNode,
 *      updateLinkDistance }) after the ForceGraph instance is ready.
 */

import { BootstrapTreeView } from 'simple-treeview';

const nodes        = [];
const links        = [];
const nodesById    = {};
const linksById    = {};
const backupNodes  = [];
const backupLinks  = [];

let selectedNode        = null;
let bachupSelectedNode  = null;
let isShowingDataGraph  = false;

const shapeCheckList = {};
const requestMap     = {};

const validationData = {
    settings: { highValidPercent: 10, lowValidPercent: 40 },
    validatedNodes: [],
    totalShapes:  0,
    totalValid:   0,
    totalInvalid: 0,
    allValid:     0,
    low:  0,
    med:  0,
    high: 0,

    add(node) {
        // colorRange: 0 = unvalidated, 1 = allValid, 2 = low, 3 = medium,
        //             4 = high, 5 = validating
        if (this.validatedNodes.includes(node)) return;
        this._assignColorRange(node);
        updateNode3dCb();
        this.totalValid   += node.valid;
        this.totalInvalid += node.invalid;
        this.validatedNodes.push(node);
    },

    updateRange() {
        this.low = this.med = this.high = this.allValid =
            this.totalValid = this.totalInvalid = 0;
        this.validatedNodes.forEach(node => {
            this._assignColorRange(node);
            if (requestMap[node.id]) node.colorRange = 5;
            this.totalValid   += node.valid;
            this.totalInvalid += node.invalid;
        });
    },

    _assignColorRange(node) {
        switch (true) {
            case node.validPercent < this.settings.highValidPercent:
                this.high++; node.colorRange = 4; break;
            case node.validPercent < this.settings.lowValidPercent:
                this.med++;  node.colorRange = 3; break;
            case node.validPercent < 100:
                this.low++;  node.colorRange = 2; break;
            default:
                this.low++;  node.colorRange = 1;
        }
    }
};

// Callbacks set by initAll so inner helpers can call them without circular refs
let updateNode3dCb      = () => {};
let updateGraphCb       = () => {};
let updateLinkDistCb    = () => {};

class Statistics {
    attributes  = 0;
    constraints = 0;
    partOff     = 0;
}

/**
 * Populate internal nodes/links arrays from the JSON data island.
 * Must be called before getVisibleLists() or the ForceGraph is created.
 *
 * @param {Array}  rawGraph  - Parsed graph array from window.SHACL_CONFIG.
 */
export function buildGraphData(rawGraph) {
    validationData.totalShapes = rawGraph.length;

    rawGraph.forEach(rawNode => {
        let nodeName = rawNode.id.replace('<', '&lt;').replace('>', '&gt;');
        if (nodeName.includes('&lt;')) {
            nodeName = nodeName.substring(4, nodeName.length - 4);
        }

        const currentNode = {
            id:         rawNode.id,
            group:      rawNode.id,
            text:       nodeName,
            isClass:    true,
            expanded:   false,
            isHidden:   false,
            highlighted:false,
            childLinks: [],
            parentLinks:[],
            query:      rawNode.targetQuery,
            prefix:     rawNode.prefixes,
            targetDef:  rawNode.targetDef,
            valid:      -1,
            invalid:    -1,
            columns:    [],
            data:       [],
            colorRange: 0
        };
        nodes.push(currentNode);

        let linkCount = -1;
        let rot       = 0;

        rawNode.constraints.forEach(constraint => {
            linkCount++;
            const cid = `${rawNode.id},${linkCount}-${constraint.path}`;

            if (constraint.shapeRef === null) {
                // Intra-constraint: attribute that references the same shape
                nodes.push({
                    id:          cid,
                    group:       rawNode.id,
                    text:        constraint.path,
                    predicate:   constraint.pathURL,
                    min:         constraint.min,
                    max:         constraint.max,
                    isClass:     false,
                    expanded:    true,
                    isHidden:    false,
                    highlighted: false,
                    childLinks:  [],
                    parentLinks: [],
                    isAttribute: true
                });
                links.push({
                    id:           `1|linkOutToConstraint,${rawNode.id},${linkCount}-${constraint.path}`,
                    source:       rawNode.id,
                    target:       cid,
                    text:         constraint.path,
                    min:          constraint.min,
                    max:          constraint.max,
                    isClass2Class:false,
                    collapsed:    true,
                    isHidden:     false,
                    highlighted:  false,
                    length:       25,
                    isAttribute:  true,
                    linkType:     1
                });
            } else {
                // Inter-constraint: property that references another shape
                links.push({
                    id:           `0|${linkCount}.linkClass:${rawNode.id},toClass:${constraint.shapeRef}`,
                    source:       rawNode.id,
                    target:       constraint.shapeRef,
                    text:         constraint.path,
                    min:          constraint.min,
                    max:          constraint.max,
                    isClass2Class:true,
                    collapsed:    false,
                    isHidden:     false,
                    highlighted:  false,
                    particles:    0,
                    curvature:    0.2,
                    rotation:     rot / 10,
                    length:       100,
                    isAttribute:  false,
                    linkType:     0
                });

                // Intermediate constraint node
                nodes.push({
                    id:          cid,
                    group:       rawNode.id,
                    text:        constraint.path,
                    predicate:   constraint.pathURL,
                    min:         constraint.min,
                    max:         constraint.max,
                    isClass:     false,
                    expanded:    true,
                    isHidden:    false,
                    highlighted: false,
                    childLinks:  [],
                    parentLinks: [],
                    isAttribute: false
                });
                links.push({
                    id:           `3|linkToConstraintFrom,${rawNode.id},To,${rawNode.id},${linkCount}-${constraint.path}`,
                    source:       rawNode.id,
                    target:       cid,
                    finalTarget:  constraint.shapeRef,
                    text:         constraint.path,
                    min:          constraint.min,
                    max:          constraint.max,
                    isClass2Class:false,
                    collapsed:    true,
                    isHidden:     false,
                    highlighted:  false,
                    particles:    2,
                    length:       25,
                    isAttribute:  false,
                    linkType:     3
                });
                links.push({
                    id:           `4|linkFromConstraint,${rawNode.id},${linkCount}-${constraint.path},To,${constraint.shapeRef}`,
                    source:       cid,
                    target:       constraint.shapeRef,
                    text:         constraint.path,
                    min:          constraint.min,
                    max:          constraint.max,
                    isClass2Class:false,
                    collapsed:    true,
                    isHidden:     false,
                    highlighted:  false,
                    particles:    2,
                    length:       50,
                    isAttribute:  false,
                    linkType:     4
                });
                rot += 12;
            }
        });
    });

    resetGraphMaps();
}

export function resetGraphMaps(removeDuplicates) {
    Object.keys(nodesById).forEach(k => delete nodesById[k]);
    Object.keys(linksById).forEach(k => delete linksById[k]);
    Object.assign(nodesById, Object.fromEntries(nodes.map(n => [n.id, n])));
    Object.assign(linksById, Object.fromEntries(links.map(l => [l.id, l])));

    if (removeDuplicates) {
        nodes.length = 0;
        nodes.push(...Object.values(nodesById));
    }

    nodes.forEach(n => { n.childLinks = []; n.parentLinks = []; });
    links.forEach(link => {
        getNodeFromLink(link.source).childLinks.push(link);
        getNodeFromLink(link.target).parentLinks.push(link);
    });
    nodes.forEach(node => {
        const stat = new Statistics();
        node.childLinks.forEach(link => {
            if (link.isClass2Class) stat.constraints++;
            else if (link.isAttribute) stat.attributes++;
        });
        node.parentLinks.forEach(link => { if (link.isClass2Class) stat.partOff++; });
        node.statistics = stat;
    });
}

export function getNodeFromLink(linkTarget) {
    if (typeof linkTarget === 'object') return linkTarget;
    const res = nodesById[linkTarget];
    if (typeof res === 'object') return res;
    // Fallback: linear search in backup nodes
    return backupNodes.find(n => n.id === linkTarget);
}

export function getVisibleLists() {
    const visibleNodes = [];
    const visibleLinks = [];
    const checkListUl  = document.getElementById('nodeChecklist')
                                  .getElementsByTagName('ul')[0];
    const enableUpdate = checkListUl.innerHTML !== '';

    nodes.forEach(node => {
        if (node.isAttribute && hideAttributes) return;
        if (node.isHidden) return;
        if (!node.expanded || node.isClass) visibleNodes.push(node);

        if (enableUpdate && node.isClass) {
            shapeCheckList[node.id]?.classList.toggle('checked', !node.isHidden);
        }
    });

    links.forEach(link => {
        if (link.isAttribute && hideAttributes) return;
        if (!link.isHidden && !link.collapsed) visibleLinks.push(link);
    });

    updateNode3dCb();
    return { nodes: visibleNodes, links: visibleLinks };
}

export function updateHiddenLinks() {
    links.forEach(link => {
        switch (link.linkType) {
            case 3: {
                const source      = getNodeFromLink(link.source);
                const constraint  = getNodeFromLink(link.target);
                const finalTarget = getNodeFromLink(link.finalTarget);
                const hidden = source.isHidden || finalTarget.isHidden;
                constraint.isHidden = hidden;
                constraint.parentLinks.forEach(l => l.isHidden = hidden);
                constraint.childLinks.forEach(l => l.isHidden = hidden);
                break;
            }
            case 1: {
                const srcHidden = getNodeFromLink(link.source).isHidden;
                link.isHidden = srcHidden;
                getNodeFromLink(link.target).isHidden = srcHidden;
                break;
            }
            default:
                link.isHidden = (
                    getNodeFromLink(link.source).isHidden ||
                    getNodeFromLink(link.target).isHidden
                );
        }
    });
}

export function updateClassState(node) {
    node.childLinks.forEach(link => {
        if (link.isClass2Class) {
            link.collapsed = node.expanded;
            if (hideUnrelatedClasses) link.isHidden = false;
        } else {
            link.collapsed = !node.expanded;
            const constraint = getNodeFromLink(link.target);
            constraint.expanded = !node.expanded;
            if (!constraint.isClass) {
                constraint.childLinks.forEach(l => {
                    l.collapsed = !node.expanded;
                    if (hideUnrelatedClasses) {
                        l.isHidden = false;
                        const target = getNodeFromLink(l.target);
                        target.isHidden = false;
                        target.childLinks.forEach(cl => {
                            if (cl.isClass2Class) cl.isHidden = getNodeFromLink(cl.target).isHidden;
                        });
                        target.parentLinks.forEach(cl => {
                            if (cl.isClass2Class) cl.isHidden = getNodeFromLink(cl.source).isHidden;
                        });
                    }
                });
                if (hideUnrelatedClasses) {
                    link.isHidden = false;
                    constraint.isHidden = false;
                }
            }
        }
    });
    updateGraphCb();
}

export function highlightNode(node) {
    if (!highlightSelectedNode) return;
    nodes.forEach(n => n.highlighted = false);
    links.forEach(l => l.highlighted = false);
    node.highlighted = true;
    if (node.isClass) {
        node.childLinks.forEach(link => {
            link.highlighted = true;
            if (!link.isClass2Class) {
                const constraintNode = getNodeFromLink(link.target);
                constraintNode.highlighted = true;
                constraintNode.childLinks.forEach(l => l.highlighted = true);
            }
        });
    } else {
        node.childLinks.forEach(l => l.highlighted = true);
        node.parentLinks.forEach(l => l.highlighted = true);
    }
    updateNode3dCb();
}

export function getLinkLength(linkType) {
    switch (linkType) {
        case 0: return settings.linkLengthClass2Class;
        case 1: return settings.linkLengthAttribute;
        case 3: return settings.linkLengthToConstraint;
        case 4: return settings.linkLengthFromConstraint;
        default: return 1;
    }
}

export const settings = {
    linkLengthClass2Class:    100,
    linkLengthAttribute:       25,
    linkLengthToConstraint:    25,
    linkLengthFromConstraint:  50,
    nodeColorDark:                   '#0af',
    nodeColorLight:                  '#000',
    nodeColorNotRetrievedDark:       '#a0f',
    nodeColorNotRetrievedLight:      '#000',
    nodeBackgroundColorDark:         '#000',
    nodeBackgroundColorLight:        '#0af',
    nodeBackgroundColorNotRetrievedDark:  '#000',
    nodeBackgroundColorNotRetrievedLight: '#a0f',
    nodeBorderColorExpanded: 'rgb(0,255,0,1)',
    nodeBorderColor:         '#0af',
    attributeBorderColor:    'rgb(0,0,0,1)',
    linkNodeBorderColor:     'rgb(255,64,0)'
};

let hideAttributes       = false;
let hideUnrelatedClasses = false;
let highlightSelectedNode= true;
let darkMode             = true;
let isNavOpen            = false;
let isRightNavOpen       = false;
let isRightNavOpenedBefore = false;

/**
 * Wire all shared DOM event handlers.
 *
 * @param {object} Graph          - ForceGraph / ForceGraph3D instance.
 * @param {object} config         - Parsed JSON from the shacl-config data island.
 * @param {object} callbacks
 * @param {function} callbacks.updateNode3d      - Re-render nodes (renderer-specific).
 * @param {function} callbacks.focusNode         - Fly/zoom camera to a node.
 * @param {function} callbacks.updateLinkDistance- Recalculate link distances.
 */
export function initAll(Graph, config, { updateNode3d, focusNode, updateLinkDistance }) {
    // Expose callbacks to module-level helpers
    updateNode3dCb   = updateNode3d;
    updateGraphCb    = () => Graph.graphData(getVisibleLists());
    updateLinkDistCb = updateLinkDistance;

    function viewNodeInfo(node) {
        // Fill statistics panel
        const stat = document.getElementById('infoStatistic');
        if (node.isClass) {
            stat.innerHTML =
                `<p>Intra-Constraints: ${node.statistics.attributes}</p>` +
                `<p>Inter-Constraints: ${node.statistics.constraints}</p>` +
                `<p>Constraints targeting this shape: ${node.statistics.partOff}</p>` +
                `<p>Target: ${node.targetDef.replace('<', '&lt;').replace('>', '&gt;')}</p>`;
        } else {
            const range = buildRangeText(node.min, node.max, '</p><p>');
            stat.innerHTML = range ? `<p>${range}</p>` : '';
        }

        // Fill constraints tree
        document.getElementById('infoTree').innerHTML = '';
        new BootstrapTreeView(document.getElementById('infoTree'), {
            provider: {
                async getChildren(id) {
                    if (!id) {
                        selectedNode = node;
                        return [{
                            id:    node.id,
                            label: node.text,
                            icon:  { classes: ['fa', 'fa-project-diagram'] },
                            state: 'expanded'
                        }];
                    }

                    const n = nodesById[id];
                    if (n) {
                        function subCallback(n) {
                            if (n.isHidden) {
                                n.isHidden = false;
                                updateHiddenLinks();
                                updateClassState(n);
                            } else if (n !== selectedNode && !n.expanded && !isShowingDataGraph) {
                                n.expanded = true;
                                updateClassState(n);
                            }

                            if (!n.isClass) {
                                id = n.parentLinks[0].id;
                            } else {
                                const res = [], resSelf = [];
                                n.childLinks.forEach(link => {
                                    if (!link.isClass2Class) {
                                        const entry = {
                                            id:    link.id,
                                            label: link.text,
                                            state: 'collapsed'
                                        };
                                        if (link.isAttribute) {
                                            entry.icon = { classes: ['bi', 'bi-align-middle'] };
                                            resSelf.push(entry);
                                        } else {
                                            entry.icon = { classes: ['bi', 'bi-arrow-left-right'] };
                                            res.push(entry);
                                        }
                                    }
                                });
                                return [...resSelf, ...res];
                            }
                        }

                        if (isShowingDataGraph && n.isClass && !n.retrieved) {
                            updateDataGraph(n, () => subCallback(n));
                        } else {
                            return subCallback(n);
                        }
                    }

                    const l = linksById[id];
                    if (l) {
                        const returnList = [];
                        const range = buildRangeText(l.min, l.max, ', ');
                        if (range) {
                            returnList.push({
                                id:    l.id + ',range',
                                label: range,
                                icon:  { classes: ['fa', 'fa-drafting-compass'] }
                            });
                        }
                        if (l.finalTarget) {
                            const ft = nodesById[l.finalTarget];
                            returnList.push({
                                id:    ft.id,
                                label: ft.text,
                                icon:  { classes: ['fa', 'fa-project-diagram'] },
                                state: 'collapsed'
                            });
                        } else if (isShowingDataGraph && l.linkType === 1) {
                            returnList.push({
                                id:    l.id + ',text',
                                label: getNodeFromLink(l.target).text,
                                icon:  { classes: ['fa-regular', 'fa-file-lines'] }
                            });
                        }
                        return returnList;
                    }
                    return [];
                }
            }
        });
    }

    function resetShapeCheckList() {
        const checklist = document.getElementById('nodeChecklist').getElementsByTagName('ul')[0];
        checklist.innerHTML = '';

        checklist.addEventListener('click', ev => {
            const li = ev.target.closest('li');
            if (!li) return;
            li.classList.toggle('checked');
            const shapeNode = nodesById[li.getAttribute('nodeId')];
            shapeNode.isHidden = !li.classList.contains('checked');

            if (shapeNode.isHidden) {
                shapeNode.childLinks.forEach(link => {
                    link.isHidden = true;
                    if (link.linkType === 1) {
                        getNodeFromLink(link.target).isHidden = true;
                    } else if (link.linkType === 3) {
                        const constraint = getNodeFromLink(link.target);
                        constraint.isHidden = true;
                        constraint.childLinks[0].isHidden = true;
                    }
                });
            }
            updateHiddenLinks();
            updateGraphCb();
        }, false);

        nodes.forEach(node => {
            if (!node.isClass) return;
            const li = document.createElement('li');
            li.setAttribute('nodeId', node.id);
            li.appendChild(document.createTextNode(node.text));
            if (!node.isHidden) li.classList.add('checked');
            checklist.appendChild(li);
            shapeCheckList[node.id] = li;
        });
    }

    function onNodeClicked(node) {
        if (isShowingDataGraph && node.isClass && !node.retrieved) {
            updateDataGraph(node, () => onNodeClicked(node));
            return;
        }

        if (node === selectedNode && node.isClass) {
            node.expanded = !node.expanded;
            updateClassState(node);
        }

        if (hideUnrelatedClasses) {
            node.childLinks.forEach(link => {
                if (node.expanded) {
                    if (link.linkType === 3) {
                        link.isHidden = false;
                        getNodeFromLink(link.target).isHidden = false;
                        getNodeFromLink(link.finalTarget).isHidden = false;
                    }
                } else {
                    if (link.linkType === 0) {
                        link.isHidden = false;
                        getNodeFromLink(link.target).isHidden = false;
                    }
                }
            });
            updateHiddenLinks();
            updateGraphCb();
        }

        if (!isRightNavOpenedBefore) {
            openRightNav('info');
            isRightNavOpenedBefore = true;
        }

        viewNodeInfo(node);
        fillValidationData();
        highlightNode(node);
    }

    // Expose onNodeClicked so graph_2d / graph_3d can pass it to .onNodeClick()
    Graph.onNodeClick(node => onNodeClicked(node));

    function requestValidationData(node) {
        const endpoint = document.getElementById('endpointInputBox').value;
        if (!endpoint) {
            window.flashMessage('Select the validation endpoint.', 'warning');
            document.querySelector('#flash').append(window.flashMessage('Select the validation endpoint.', 'warning'));
            openAccordion(document.querySelector('#ValidationEndpointAccordion'));
            document.getElementById('endpointInputBox').focus();
            return false;
        }

        const requestConfig = {
            external_endpoint: endpoint,
            outputDirectory:   './output/',
            query:             `PREFIX ub:<http://swat.cse.lehigh.edu/onto/univ-bench.owl#> PREFIX :<http://example.com/>${node.query}`,
            schemaDir:         '/shapes' + config.path,
            targetShape:       node.id.replace('&lt;', '<').replace('&gt;', '>'),
            backend:           'travshacl',
            output_format:     'test'
        };

        const ajaxError = (jqXHR, exception, targetNode) => {
            const errorMap = {
                0:   ': Cannot connect to shaclAPI',
                404: ': Requested page not found. [404]',
                500: ': Internal Server Error [500].'
            };
            const exceptionMap = {
                parsererror: ': Requested JSON parse failed.',
                timeout:     ': Time out error.',
                abort:       ': Ajax request aborted.'
            };
            const msg = errorMap[jqXHR.status] || exceptionMap[exception] ||
                        ': Uncaught Error.\n' + jqXHR.responseText;
            $('#flash').append(window.flashMessage(targetNode.id + msg, 'danger'));
            delete requestMap[targetNode.id];

            const current = selectedNode?.isClass ? selectedNode : selectedNode?.parentLinks[0];
            if (current && targetNode.id.replace('<', '&lt;').replace('>', '&gt;') === current.id) {
                requestBtnClicked(false);
            }
        };

        const request_validation = $.ajax({
            url:  '/validation',
            type: 'POST',
            data: requestConfig,
            success(data) {
                saveToCache(document.getElementById('endpointInputBox').id, endpoint);
                Object.keys(data).forEach(shapeId => {
                    const shape = nodesById[shapeId];
                    shape.valid   = data[shapeId].valid;
                    shape.invalid = data[shapeId].invalid;
                    shape.validPercent = (shape.valid === 0 && shape.invalid === 0)
                        ? 100
                        : Math.floor(10000 * shape.valid / (shape.valid + shape.invalid)) / 100;
                    shape.columns = data[shapeId].columns;
                    shape.data    = data[shapeId].results;
                    validationData.add(shape);
                    delete requestMap[shapeId];

                    const current = selectedNode?.isClass ? selectedNode : selectedNode?.parentLinks[0];
                    if (current && shapeId.replace('<', '&lt;').replace('>', '&gt;') === current.id) {
                        fillValidationData();
                    } else {
                        updateTotalValidation();
                    }
                });
                requestBtnClicked(false);
            },
            error: (jqXHR, exception) => ajaxError(jqXHR, exception, node)
        });
        requestMap[node.id] = request_validation;
        node.colorRange = 5;

        $.ajax({
            url:  '/reduce',
            type: 'POST',
            data: requestConfig,
            success(data) {
                data.shapes.forEach(shapeId => {
                    const shape = nodesById[shapeId];
                    if (shape.valid === -1 || shape.invalid === -1) {
                        requestMap[shapeId] = request_validation;
                        shape.colorRange = 5;
                    }
                });
                updateNode3dCb();
            },
            error: (jqXHR, exception) => ajaxError(jqXHR, exception, node)
        });

        return true;
    }

    function fillValidationData() {
        updateTotalValidation();
        const shapeNode = selectedNode?.isClass
            ? selectedNode
            : getNodeFromLink(selectedNode.parentLinks[0].source);

        const statNode = document.getElementById('selectedValidationData');
        if (shapeNode.valid < 0) {
            document.getElementById('requestValidationBtn').style.display = 'block';
            document.getElementById('ViewDataBtn').style.display          = 'none';
            requestBtnClicked(!!requestMap[shapeNode.id]);
            statNode.innerHTML = '';
        } else {
            document.getElementById('requestValidationBtn').style.display = 'none';
            document.getElementById('ViewDataBtn').style.display          = 'block';
            statNode.innerHTML =
                `<p>Valid Percentage:</p>` +
                `<p style="background: linear-gradient(90deg, rgb(0 192 0) 0%, rgb(0 192 0) ${shapeNode.validPercent}%, rgb(192 0 0) ${shapeNode.validPercent}%, rgb(192 0 0) 100%);" class="powerbar">${shapeNode.validPercent}%</p>` +
                `<table><tr><td>Valid: ${shapeNode.valid}</td><td>Invalid: ${shapeNode.invalid}</td></tr></table>`;
        }
    }

    function updateTotalValidation() {
        const total     = validationData.allValid + validationData.low + validationData.med + validationData.high;
        const allValidP = 100 * validationData.allValid / total;
        const lowP      = 100 * (validationData.allValid + validationData.low) / total;
        const medP      = 100 * (validationData.allValid + validationData.low + validationData.med) / total;
        const vdp = (validationData.totalValid === 0 && validationData.totalInvalid === 0)
            ? 100
            : Math.floor(10000 * validationData.totalValid / (validationData.totalValid + validationData.totalInvalid)) / 100;

        document.getElementById('totalValidationData').innerHTML =
            `<p>Shapes processed: ${validationData.validatedNodes.length}/${validationData.totalShapes}</p>` +
            `<p style="background: linear-gradient(90deg, rgb(0 192 0) 0%, rgb(0 192 0) ${allValidP}%, rgb(255 255 0) ${allValidP}%, rgb(255 255 0) ${lowP}%, rgb(255 128 0) ${lowP}%, rgb(255 128 0) ${medP}%, rgb(192 0 0) ${medP}%, rgb(192 0 0) 100%);" class="powerbar"></p>` +
            `<table><tr><td>Low: ${validationData.low}</td><td>Medium: ${validationData.med}</td><td>High: ${validationData.high}</td></tr></table>` +
            `<p>Validation Data:</p>` +
            `<p style="background: linear-gradient(90deg, rgb(0 192 0) 0%, rgb(0 192 0) ${vdp}%, rgb(192 0 0) ${vdp}%, rgb(192 0 0) 100%);" class="powerbar">${vdp}%</p>` +
            `<table><tr><td>Valid: ${validationData.totalValid}</td><td>Invalid: ${validationData.totalInvalid}</td></tr></table>`;
    }

    function requestBtnClicked(clicked) {
        const btn = document.getElementById('requestValidationBtn');
        btn.classList.toggle('sending',      clicked);
        btn.classList.toggle('btn-secondary',clicked);
        btn.classList.toggle('btn-primary',  !clicked);
        btn.textContent = clicked ? 'Validating, click to cancel' : 'Request Validation';
        btn.blur();
    }

    const suggestions = nodes.filter(n => n.isClass).map(n => n.text);
    const searchWrapper = document.querySelector('#search-wrapper');
    const inputBox      = searchWrapper.querySelector('#search-input');
    const suggBox       = searchWrapper.querySelector('#search-sugg');

    function renderSuggestions(targetBox, list, fallback) {
        targetBox.innerHTML = list.length ? list.join('') : `<li>${fallback}</li>`;
    }

    function suggest(e) {
        const userData  = e.target.value;
        const filtered  = suggestions
            .filter(d => userData ? d.toLocaleLowerCase().startsWith(userData.toLocaleLowerCase()) : true)
            .map(d => `<li>${d}</li>`);
        searchWrapper.classList.add('active');
        renderSuggestions(suggBox, filtered.sort(), userData);

        let clicked = false;
        suggBox.querySelectorAll('li').forEach(li => {
            li.onclick = () => {
                clicked = true;
                inputBox.value = li.textContent;
                viewNodeInfo(nodesById[li.textContent]);
                const n = nodesById[li.textContent];
                if (n.isHidden) {
                    if (hideUnrelatedClasses) hideAllButSelectedNode();
                    else { n.isHidden = false; updateHiddenLinks(); updateGraphCb(); }
                } else {
                    updateClassState(n);
                }
                searchWrapper.classList.remove('active');
            };
            if (highlightSelectedNode) {
                li.onmouseover = () => highlightNode(nodesById[li.textContent]);
            }
        });
        suggBox.onmouseout = () => {
            if (highlightSelectedNode) {
                if (clicked) { clicked = false; return; }
                nodes.forEach(n => n.highlighted = false);
                links.forEach(l => l.highlighted = false);
                updateNode3dCb();
            }
        };
    }

    let mouseInsideSearch = false;
    searchWrapper.onmouseover = () => { mouseInsideSearch = true; };
    searchWrapper.onmouseout  = () => { mouseInsideSearch = false; };
    inputBox.onkeyup  = e => suggest(e);
    inputBox.onfocus  = e => { inputBox.value = ''; suggest(e); };
    document.querySelector('body').onmouseup = () => {
        if (!mouseInsideSearch) searchWrapper.classList.remove('active');
    };

    const endpointWrapper  = document.querySelector('#endpointWrapper');
    const endpointInputBox = endpointWrapper.querySelector('#endpointInputBox');
    const endpointSuggBox  = endpointWrapper.querySelector('#endpointSuggBox');
    const endpointIcon     = endpointWrapper.querySelector('#endpointIcon');
    const defaultEndpoints = [
        'http://host.docker.internal:9000/sparql',
        'http://127.0.0.1:9000/sparql',
        'http://192.168.111.1:14000/sparql'
    ];
    saveToCacheDefaultValues(endpointInputBox.id, defaultEndpoints);

    function endpointSuggest(userData) {
        const filtered = getFromCache(endpointInputBox.id)
            .filter(d => userData ? d.toLocaleLowerCase().startsWith(userData.toLocaleLowerCase()) : true)
            .map(d => `<li>${d}</li>`);
        endpointWrapper.classList.add('active');
        renderSuggestions(endpointSuggBox, filtered.sort(), userData || '');
        endpointSuggBox.querySelectorAll('li').forEach(li => {
            li.onclick = () => {
                endpointInputBox.value = li.textContent;
                endpointWrapper.classList.remove('active');
            };
        });
    }

    let mouseInsideEndpoint = false;
    endpointWrapper.onmouseover = () => { mouseInsideEndpoint = true; };
    endpointWrapper.onmouseout  = () => { mouseInsideEndpoint = false; };
    endpointInputBox.onkeyup = e => endpointSuggest(e.target.value);
    endpointInputBox.onfocus = e => endpointSuggest(e.target.value);
    endpointIcon.onclick     = () => endpointSuggest();
    document.querySelector('body').onmouseup = () => {
        if (!mouseInsideEndpoint) endpointWrapper.classList.remove('active');
    };

    const TAB_CONFIG = {
        info:       { btn: 'infoBtn',       menu: 'infoMenu'       },
        shape:      { btn: 'shapeBtn',      menu: 'nodeChecklist'  },
        validation: { btn: 'validationBtn', menu: 'validationMenu' }
    };

    function openRightNav(selectedTab) {
        isRightNavOpenedBefore = true;
        isRightNavOpen         = true;
        document.getElementById('myRightSidenav').classList.remove('closeRightNav');
        document.getElementById('rightTabs').classList.add('tabs-openRightNav');
        document.getElementById('topRightButtons').classList.add('tabs-openRightNav');
        document.getElementById('data-table-container').style.marginRight = '400px';

        Object.entries(TAB_CONFIG).forEach(([tab, { btn, menu }]) => {
            const isSelected = tab === selectedTab;
            document.getElementById(btn).classList.toggle('selected', isSelected);
            document.getElementById(menu).classList.toggle('disable', !isSelected);
        });
    }

    function closeRightNav() {
        isRightNavOpen = false;
        document.getElementById('myRightSidenav').classList.add('closeRightNav');
        document.getElementById('rightTabs').classList.remove('tabs-openRightNav');
        document.getElementById('topRightButtons').classList.remove('tabs-openRightNav');
        document.getElementById('data-table-container').style.marginRight = '0px';
        Object.values(TAB_CONFIG).forEach(({ btn }) =>
            document.getElementById(btn).classList.remove('selected')
        );
    }

    function openNav() {
        isNavOpen = true;
        document.getElementById('mySidenav').classList.remove('closeLeftNav');
        document.getElementById('data-table-container').style.marginLeft = '285px';
    }

    function closeNav() {
        isNavOpen = false;
        document.getElementById('mySidenav').classList.add('closeLeftNav');
        document.getElementById('data-table-container').style.marginLeft = '0';
    }

    document.querySelector('#optionBtn').onclick = () => isNavOpen ? closeNav() : openNav();

    Object.entries(TAB_CONFIG).forEach(([tab, { btn }]) => {
        document.getElementById(btn).onclick = () => {
            const isSelected = document.getElementById(btn).classList.contains('selected');
            if (isRightNavOpen && isSelected) closeRightNav();
            else openRightNav(tab);
        };
    });

    document.querySelector('#collapseAll').onclick = () => {
        nodes.forEach(n => { n.expanded = n.isClass ? false : true; });
        links.forEach(l => { l.collapsed = l.isClass2Class ? false : true; });
        updateGraphCb();
    };

    document.querySelector('#expandAll').onclick = () => {
        nodes.forEach(n => { n.expanded = n.isClass ? true : false; });
        links.forEach(l => { l.collapsed = l.isClass2Class ? true : false; });
        updateGraphCb();
    };

    document.querySelector('#centerGraph').onclick = () => Graph.zoomToFit(400);

    document.querySelector('#focusNode').onclick = () => {
        if (selectedNode == null) {
            $('#flash').append(window.flashMessage('Select a Shape first.', 'warning'));
        } else {
            focusNode(selectedNode);
        }
    };

    document.querySelector('#hideUnrelatedClasses').onclick = () => {
        const checkbox = $('#hideUnrelatedClasses').find('input[type="checkbox"]').first();
        if (selectedNode == null) {
            $('#flash').append(window.flashMessage('Select a shape first.', 'warning'));
            return;
        }
        if (hideUnrelatedClasses) {
            checkbox.prop('checked', false);
            hideUnrelatedClasses = false;
            nodes.forEach(n => n.isHidden = false);
            links.forEach(l => l.isHidden = false);
            updateGraphCb();
        } else {
            checkbox.prop('checked', true);
            hideUnrelatedClasses = true;
            hideAllButSelectedNode();
        }
        openRightNav('shape');
    };

    function hideAllButSelectedNode() {
        nodes.forEach(n => n.isHidden = true);
        selectedNode.isHidden = false;
        selectedNode.childLinks.forEach(link => {
            if (link.isClass2Class) getNodeFromLink(link.target).isHidden = false;
        });
        updateHiddenLinks();
        updateGraphCb();
    }

    document.querySelector('#highlightSelectedNode').onclick = () => {
        const checkbox = $('#highlightSelectedNode').find('input[type="checkbox"]').first();
        if (highlightSelectedNode) {
            checkbox.prop('checked', false);
            highlightSelectedNode = false;
            nodes.forEach(n => n.highlighted = false);
            links.forEach(l => l.highlighted = false);
            updateNode3dCb();
        } else {
            checkbox.prop('checked', true);
            highlightSelectedNode = true;
            highlightNode(selectedNode);
        }
    };

    document.querySelector('#hideAttributes').onclick = () => {
        const checkbox = $('#hideAttributes').find('input[type="checkbox"]').first();
        hideAttributes = !hideAttributes;
        checkbox.prop('checked', hideAttributes);
        updateGraphCb();
    };

    document.querySelector('#darkMode').onclick = () => {
        const checkbox = $('#darkMode').find('input[type="checkbox"]').first();
        darkMode = !darkMode;
        checkbox.prop('checked', darkMode);
        document.documentElement.setAttribute('data-theme',    darkMode ? 'dark' : 'light');
        document.documentElement.setAttribute('data-bs-theme', darkMode ? 'dark' : 'light');
        Graph.backgroundColor(
            getComputedStyle(document.documentElement).getPropertyValue('--main-background').trim()
        );
        updateNode3dCb();
    };

    function initSlider(id, valueKey, obj, onChangeFn) {
        const slider = document.querySelector(`#${id}`);
        slider.value = obj[valueKey];
        slider.nextElementSibling.value = obj[valueKey];
        slider.oninput = function () {
            this.nextElementSibling.value = this.value;
            obj[valueKey] = +this.value;
            onChangeFn();
        };
    }

    initSlider('class2classLinkSlider',    'linkLengthClass2Class',   settings, updateLinkDistCb);
    initSlider('attributeLinkSlider',       'linkLengthAttribute',     settings, updateLinkDistCb);
    initSlider('toConstraintLinkSlider',    'linkLengthToConstraint',  settings, updateLinkDistCb);
    initSlider('fromConstraintLinkSlider',  'linkLengthFromConstraint',settings, updateLinkDistCb);
    initSlider('lowValidationPercentage',  'lowValidPercent',  validationData.settings, () => { validationData.updateRange(); updateNode3dCb(); updateTotalValidation(); });
    initSlider('HighValidationPercentage', 'highValidPercent', validationData.settings, () => { validationData.updateRange(); updateNode3dCb(); updateTotalValidation(); });

    // The validation sliders expose the inverse (100 - %) so correct the initial value
    document.querySelector('#lowValidationPercentage').value =
        100 - validationData.settings.lowValidPercent;
    document.querySelector('#HighValidationPercentage').value =
        100 - validationData.settings.highValidPercent;
    document.querySelector('#lowValidationPercentage').nextElementSibling.value =
        100 - validationData.settings.lowValidPercent;
    document.querySelector('#HighValidationPercentage').nextElementSibling.value =
        100 - validationData.settings.highValidPercent;
    document.querySelector('#lowValidationPercentage').oninput = function () {
        this.nextElementSibling.value = this.value;
        validationData.settings.lowValidPercent = 100 - this.value;
        validationData.updateRange();
        updateNode3dCb();
        updateTotalValidation();
    };
    document.querySelector('#HighValidationPercentage').oninput = function () {
        this.nextElementSibling.value = this.value;
        validationData.settings.highValidPercent = 100 - this.value;
        validationData.updateRange();
        updateNode3dCb();
        updateTotalValidation();
    };

    function toggleAccordion(btn) {
        const panel = btn.nextElementSibling;
        if (btn.classList.contains('active')) {
            panel.style.maxHeight = 'fit-content';
            if (panel.style.overflow) panel.style.overflow = 'visible';
        } else {
            panel.style.maxHeight = null;
            if (panel.style.overflow) panel.style.overflow = 'hidden';
        }
    }

    function openAccordion(btn) {
        const panel = btn.nextElementSibling;
        panel.style.maxHeight = 'fit-content';
        if (panel.style.overflow) panel.style.overflow = 'visible';
    }

    document.querySelectorAll('.accordion').forEach(btn => {
        toggleAccordion(btn);
        btn.addEventListener('click', function () {
            this.classList.toggle('active');
            toggleAccordion(this);
        });
    });

    document.querySelector('#requestValidationBtn').onclick = () => {
        const shapeNode = selectedNode?.isClass
            ? selectedNode
            : getNodeFromLink(selectedNode.parentLinks[0].source);
        if (requestMap[shapeNode.id]) {
            delete requestMap[shapeNode.id];
            requestBtnClicked(false);
        } else {
            if (requestValidationData(shapeNode)) requestBtnClicked(true);
        }
    };

    document.querySelector('#ViewDataBtn').onclick = () => {
        const dataIndex = selectedNode.columns.indexOf('Data');
        let html = '<table id="myTable" class="display"><thead><tr>';
        selectedNode.columns.forEach(col => { html += `<th>${col}</th>`; });
        html += '<th>View Data</th></tr></thead><tbody>';
        selectedNode.data.forEach(row => {
            html += '<tr>';
            row.forEach(cell => { html += `<td>${cell}</td>`; });
            html += `<td><button query-data="${row[dataIndex]}" class="btn btn-primary view-data-graph btn-view-data">View</button></td>`;
            html += '</tr>';
        });
        html += '</tbody></table>';
        document.getElementById('data-table').innerHTML = html;
        $('#myTable').DataTable();
        $('#myTable').on('click', '.view-data-graph', function () {
            showDataGraph(selectedNode, $(this).attr('query-data'));
            closeDataTable();
        });
        showDataTable();
    };

    document.querySelector('#close-table-btn').onclick  = () => closeDataTable();
    document.querySelector('#closeDataGraph').onclick   = () => {
        document.getElementById('topRightButtons').style.display = 'none';
        document.getElementById('validationBtn').style.display   = 'block';
        openRightNav('validation');
        showDataTable();
        showShapeGraph();
    };

    const graphElem = document.getElementById('3d-graph');

    function showDataTable() {
        graphElem.style.display = 'none';
        document.getElementById('data-table-container').style.display = 'block';
        Graph.pauseAnimation();
    }

    function closeDataTable() {
        graphElem.style.display = 'block';
        document.getElementById('data-table-container').style.display = 'none';
        Graph.resumeAnimation();
    }

    function getQueryString(shape, data) {
        let query = 'SELECT DISTINCT ?p ?o WHERE { VALUES ?p { ';
        shape.childLinks.forEach(link => {
            if (link.linkType === 1 || link.linkType === 3) {
                query += getNodeFromLink(link.target).predicate + ' ';
            }
        });
        query += '} OPTIONAL { <' + data + '> ?p ?o }}';
        return query;
    }

    function requestDataNode(shape, id, callbackSuccess, callbackFail) {
        const endpoint = document.getElementById('endpointInputBox').value;
        const formData = new FormData();
        formData.append('query',    getQueryString(shape, id));
        formData.append('endpoint', endpoint);
        fetch(new Request('/dataNode', { method: 'POST', body: formData }))
            .then(res  => res.json())
            .then(res  => callbackSuccess(res))
            .catch(err => {
                console.error(err);
                $('#flash').append(window.flashMessage('There has been an error, please, check the logs.', 'danger'));
                callbackFail();
            });
    }

    function buildConstraintsMap(shape) {
        const res = new Map();
        shape.childLinks.forEach(link => {
            if (link.linkType === 1 || link.linkType === 3) {
                const constraint = getNodeFromLink(link.target);
                res.set(constraint.text, constraint);
            }
        });
        return res;
    }

    function createNonClassNode(incremental, constraint, dataNode, name, min, max, isAttribute) {
        const node = {
            id:          `${incremental}|${dataNode.id},${name}`,
            group:       dataNode.id,
            text:        name,
            min,
            max,
            isClass:     false,
            expanded:    true,
            isHidden:    false,
            highlighted: false,
            childLinks:  [],
            parentLinks: [],
            isAttribute
        };
        node.constraint = constraint;
        return node;
    }

    function createDataNode(id, shape, retrieved) {
        const existing = nodesById[id];
        if (existing) return existing;
        const node = {
            id,
            group:       id,
            text:        id.split('/').pop(),
            isClass:     true,
            expanded:    false,
            isHidden:    false,
            highlighted: false,
            childLinks:  [],
            parentLinks: [],
            query:       shape.query,
            prefix:      shape.prefix,
            targetDef:   shape.targetDef,
            valid:       -1,
            invalid:     -1,
            columns:     [],
            data:        [],
            colorRange:  0
        };
        node.shape     = shape;
        node.retrieved = retrieved;
        return node;
    }

    function createLink(incremental, text, from, to, type, min, max) {
        const link = {
            id:          `${incremental}|${type}|from:${from.id},to:${to.id}`,
            source:      from.id,
            target:      to.id,
            text,
            min,
            max,
            isHidden:    false,
            highlighted: false,
            length:      getLinkLength(type),
            linkType:    type
        };
        switch (type) {
            case 0: link.isClass2Class = true;  link.collapsed = false; link.isAttribute = false; break;
            case 1: link.isClass2Class = false; link.collapsed = true;  link.isAttribute = true;  break;
            case 3:
            case 4: link.isClass2Class = false; link.collapsed = true;  link.isAttribute = false; break;
            default: return null;
        }
        return link;
    }

    function creatDataNetwork(shape, id, json) {
        const dataGraphNodeList = [];
        const dataGraphLinkList = [];
        const constraintMap     = buildConstraintsMap(shape);
        const dataNode          = createDataNode(id, shape, true);
        let i = 0;

        json.results.bindings.forEach(obj => {
            i++;
            if (typeof obj.o === 'undefined') return;

            const constraintString   = obj.p.value.split('#').pop();
            const constraintValue    = obj.o.value;
            const currentConstraint  = constraintMap.get(constraintString);
            if (!currentConstraint) return;

            if (currentConstraint.isAttribute) {
                const attribute = createNonClassNode(i, currentConstraint, dataNode, constraintValue, currentConstraint.min, currentConstraint.max, true);
                const link      = createLink(i, constraintString, dataNode, attribute, 1, currentConstraint.min, currentConstraint.max);
                dataGraphNodeList.push(attribute);
                dataGraphLinkList.push(link);
            } else {
                const n            = getNodeFromLink(currentConstraint.childLinks[0].target);
                const nextDataNode = createDataNode(constraintValue, n, false);
                const constraint   = createNonClassNode(i, currentConstraint, dataNode, constraintString, currentConstraint.min, currentConstraint.max, false);
                const link0 = createLink(i, constraintString, dataNode, nextDataNode, 0, currentConstraint.min, currentConstraint.max);
                const link3 = createLink(i, constraintString, dataNode, constraint,   3, currentConstraint.min, currentConstraint.max);
                const link4 = createLink(i, constraintString, constraint, nextDataNode, 4, currentConstraint.min, currentConstraint.max);
                link3.finalTarget = nextDataNode.id;
                dataGraphNodeList.push(constraint, nextDataNode);
                dataGraphLinkList.push(link0, link3, link4);
            }
        });
        return { main: dataNode, nodes: dataGraphNodeList, links: dataGraphLinkList };
    }

    function showDataGraph(shape, id) {
        loading(true);
        requestDataNode(shape, id, json => {
            const graph = creatDataNetwork(shape, id, json);
            backupNodes.push(...nodes);
            backupLinks.push(...links);
            bachupSelectedNode = selectedNode;
            nodes.length = 0; links.length = 0;
            nodes.push(graph.main, ...graph.nodes);
            links.push(...graph.links);
            selectedNode       = graph.main;
            isShowingDataGraph = true;
            resetGraphMaps(true);
            resetShapeCheckList();
            updateGraphCb();
            viewNodeInfo(selectedNode);
            highlightNode(selectedNode);
            openRightNav('info');
            document.getElementById('validationBtn').style.display = 'none';
            document.getElementById('topRightButtons').style.display = 'flex';
            loading(false);
        }, () => loading(false));
    }

    function showShapeGraph() {
        nodes.push(...backupNodes); links.push(...backupLinks);
        // Restore only (don't prepend; nodes was already cleared by showDataGraph)
        nodes.length = 0; links.length = 0;
        nodes.push(...backupNodes); links.push(...backupLinks);
        selectedNode = bachupSelectedNode;
        backupNodes.length = 0; backupLinks.length = 0;
        bachupSelectedNode = null;
        isShowingDataGraph = false;
        resetGraphMaps();
        resetShapeCheckList();
        updateGraphCb();
        viewNodeInfo(selectedNode);
        fillValidationData();
    }

    function updateDataGraph(node, callback) {
        loading(true);
        requestDataNode(node.shape, node.id, json => {
            const graph = creatDataNetwork(node.shape, node.id, json);
            node.retrieved = true;
            nodes.push(...graph.nodes);
            links.push(...graph.links);
            resetGraphMaps(true);
            resetShapeCheckList();
            updateGraphCb();
            loading(false);
            callback();
        }, () => loading(false));
    }

    function loading(startLoading) {
        const loader = document.querySelector('#loader');
        if (startLoading) loader.classList.add('loader');
        else loader.removeAttribute('class');
    }

    resetShapeCheckList();
    document.querySelector('#loader').removeAttribute('class');
}

/** Returns the current dark-mode state. */
export function isDarkMode() { return darkMode; }

/** Returns true while the data-node graph overlay is visible. */
export function isDataGraphMode() { return isShowingDataGraph; }

export function saveToCache(id, value) {
    const existing = localStorage.getItem(id);
    const arr = existing ? [...new Set([...JSON.parse(existing), value])] : [value];
    localStorage.setItem(id, JSON.stringify(arr));
}

export function saveToCacheDefaultValues(id, array) {
    if (!localStorage.getItem(id)) {
        localStorage.setItem(id, JSON.stringify(array));
    }
}

export function getFromCache(id) {
    const c = localStorage.getItem(id);
    return c ? JSON.parse(c) : [];
}

/**
 * Build a human-readable cardinality string from min/max values.
 * Both values use "-1" to signal "unbounded".
 *
 * @param {string} min
 * @param {string} max
 * @param {string} [separator='</p><p>'] - HTML separator between min and max parts.
 * @returns {string}
 */
export function buildRangeText(min, max, separator = '</p><p>') {
    if (min === '-1' && max === '-1') return '';
    if (min !== '-1') {
        if (min === max) return `equal: ${min}`;
        let text = `min: ${min}`;
        if (max !== '-1') text += separator + `max: ${max}`;
        return text;
    }
    return `max: ${max}`;
}
