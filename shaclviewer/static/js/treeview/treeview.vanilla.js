/**
 * Tree node state.
 */
var CollapsibleState;
(function (CollapsibleState) {
    /** Node cannot be neither collapsed nor expanded. It is a leaf. */
    CollapsibleState["None"] = "";
    /** Node is collapsed and can be expanded. */
    CollapsibleState["Collapsed"] = "collapsed";
    /** Node is expanded and can be collapsed. */
    CollapsibleState["Expanded"] = "expanded";
})(CollapsibleState || (CollapsibleState = {}));
/**
 * Core implementation of tree view component providing the basic functionality.
 * @abstract
 */
class TreeView {
    /**
     * Initializes a new tree view.
     * @param container HTML element that will host the tree view.
     * @param options Additional options.
     */
    constructor(container, options) {
        this.container = container;
        this.provider = options.provider;
        this.onSelectionChanged = options.onSelectionChanged;
        this.root = document.createElement('div');
        this._onRootClick = this._onRootClick.bind(this);
        this.attach();
    }
    /**
     * Attaches the tree view to the DOM.
     */
    attach() {
        this.root.addEventListener('click', this._onRootClick);
        this.container.appendChild(this.root);
        this._render(undefined, 0);
    }
    /**
     * Detaches the tree view from the DOM.
     */
    detach() {
        this.root.removeEventListener('click', this._onRootClick);
        this.container.removeChild(this.root);
    }
    _onRootClick(ev) {
        let el = ev.target;
        while (!this._hasMetadata(el) && el.parentElement) {
            el = el.parentElement;
        }
        const metadata = this._getMetadata(el);
        switch (metadata.state) {
            case CollapsibleState.Collapsed:
                this._expandNode(el);
                break;
            case CollapsibleState.Expanded:
                this._collapseNode(el);
                break;
            default:
                this.onNodeClicked(metadata, el);
                if (this.onSelectionChanged) {
                    this.onSelectionChanged([metadata]);
                }
                break;
        }
        return false;
    }
    async _render(id, level, insertAfterEl) {
        const root = this.root;
        const children = await this.provider.getChildren(id);
        for (const { id, label, icon, state } of children) {
            const metadata = { id, label, level, icon, state: state || CollapsibleState.None, loading: false };
            const el = this.renderNode(metadata);
            el.style.paddingLeft = `${level}em`;
            this._setMetadata(el, metadata);
            if (insertAfterEl) {
                insertAfterEl.insertAdjacentElement('afterend', el);
            }
            else {
                root.appendChild(el);
            }
            insertAfterEl = el;
            if (metadata.state === CollapsibleState.Expanded) {
                this._expandNode(el);
            }
        }
    }
    _expandNode(el) {
        const metadata = this._getMetadata(el);
        if (!metadata.loading) {
            metadata.loading = true;
            this._setMetadata(el, metadata);
            this.onNodeLoading(metadata, el);
            this._render(metadata.id, metadata.level + 1, el)
                .then(() => {
                metadata.loading = false;
                metadata.state = CollapsibleState.Expanded;
                this._setMetadata(el, metadata);
                this.onNodeExpanded(metadata, el);
            });
        }
    }
    _collapseNode(el) {
        const root = this.root;
        const metadata = this._getMetadata(el);
        if (!metadata.loading) {
            while (el.nextSibling && this._getMetadata(el.nextSibling).level > metadata.level) {
                root.removeChild(el.nextSibling);
            }
            metadata.state = CollapsibleState.Collapsed;
            this._setMetadata(el, metadata);
            this.onNodeCollapsed(metadata, el);
        }
    }
    _getMetadata(el) {
        console.assert(el.hasAttribute('data-treeview'));
        return JSON.parse(el.getAttribute('data-treeview'));
    }
    _setMetadata(el, metadata) {
        el.setAttribute('data-treeview', JSON.stringify(metadata));
    }
    _hasMetadata(el) {
        return el.hasAttribute('data-treeview');
    }
}

const NodeClass = 'treeview-node';
const CollapsedNodeClass = 'treeview-node-collapsed';
const ExpandedNodeClass = 'treeview-node-expanded';
const LeafNodeClass = 'treeview-node-leaf';
const LoadingNodeClass = 'treeview-node-loading';
/**
 * Tree view component built using vanilla JavaScript and CSS.
 *
 * The component makes use of [Font Awesome](https://fontawesome.com) icons, so classes
 * such as `fa-folder` or `fa-clock` can be used in {@link INode}'s `icon` property.
 */
class VanillaTreeView extends TreeView {
    renderNode(node) {
        const el = document.createElement('div');
        el.classList.add(NodeClass);
        switch (node.state) {
            case CollapsibleState.Collapsed:
                el.classList.add(CollapsedNodeClass);
                break;
            case CollapsibleState.Expanded:
                el.classList.add(ExpandedNodeClass);
                break;
            case CollapsibleState.None:
                el.classList.add(LeafNodeClass);
                break;
        }
        const icon = document.createElement('div');
        icon.classList.add('far');
        if (node.icon) {
            icon.classList.add(node.icon);
        }
        el.appendChild(icon);
        const label = document.createElement('label');
        label.innerText = node.label;
        el.appendChild(label);
        return el;
    }
    /**
     * Reacts to the event of a tree node being clicked.
     * @param node Tree node metadata.
     * @param el Tree node HTML element.
     */
    onNodeClicked(node, el) {
        alert(`Clicked on ${node.label} (id: ${node.id})`);
    }
    /**
     * Reacts to the event of a tree node loading its children.
     * @param node Tree node metadata.
     * @param el Tree node HTML element.
     */
    onNodeLoading(node, el) {
        el.classList.remove(ExpandedNodeClass, CollapsedNodeClass);
        el.classList.add(LoadingNodeClass);
    }
    /**
     * Reacts to the event of a tree node being collapsed.
     * @param node Tree node metadata.
     * @param el Tree node HTML element.
     */
    onNodeCollapsed(node, el) {
        el.classList.remove(ExpandedNodeClass, LoadingNodeClass);
        el.classList.add(CollapsedNodeClass);
    }
    /**
     * Reacts to the event of a tree node being expanded.
     * @param node Tree node metadata.
     * @param el Tree node HTML element.
     */
    onNodeExpanded(node, el) {
        el.classList.remove(CollapsedNodeClass, LoadingNodeClass);
        el.classList.add(ExpandedNodeClass);
    }
}

export { VanillaTreeView };
