import os
import tempfile
from urllib.parse import urlsplit

from SPARQLWrapper import SPARQLWrapper, JSON
from flask import Blueprint, Flask, abort, current_app, jsonify, render_template, request
from rdflib.plugins.sparql.parser import parseQuery
from shaclapi.api import validation_and_statistics, only_reduce_shape_schema

from shaclviewer.shacl import prettify_graph
from shaclviewer.shacl.ShapeParser import ShapeParser

bp = Blueprint(
    'shaclviewer', __name__,
    template_folder='templates',
    static_folder='static',
    static_url_path='/static',  # served below the blueprint's url_prefix
)

DEFAULT_SHAPES_DIR = '/shapes'
DEFAULT_OUTPUT_DIR = os.path.join(tempfile.gettempdir(), 'shaclviewer-output')

# Parameters of the shaclAPI that must never be taken from the client:
# the schema location (and the config file, which can point anywhere on the
# file system) as well as the output location are decided by the server.
_SERVER_CONTROLLED_PARAMS = (
    'config',
    'schemaDir', 'schema_directory',
    'outputDirectory', 'output_directory',
)


def _shapes_dir():
    return os.path.realpath(current_app.config['SHACLVIEWER_SHAPES_DIR'])


def _resolve_shapes_path(path):
    """Resolve a user-supplied sub-path under the shapes directory, rejecting
    any attempt (e.g. via '../') to escape outside of it."""
    shapes_dir = _shapes_dir()
    candidate = os.path.realpath(os.path.join(shapes_dir, (path or '').strip('/')))
    if candidate != shapes_dir and not candidate.startswith(shapes_dir + os.sep):
        abort(400)
    return candidate


@bp.before_request
def _run_access_check():
    check = current_app.config.get('SHACLVIEWER_ACCESS_CHECK')
    if check is not None:
        return check()


def _normalize_endpoint(url):
    return url.strip().rstrip('/')


def _allowed_endpoints():
    """The endpoints the client may choose from as list, or None if the
    configuration does not enumerate them (no restriction or a callable)."""
    allowed = current_app.config['SHACLVIEWER_ALLOWED_ENDPOINTS']
    if allowed is None or callable(allowed):
        return None
    return [allowed] if isinstance(allowed, str) else list(allowed)


def _check_endpoint(url):
    """Abort unless the server may query the SPARQL endpoint `url`.

    The endpoint is chosen by the client, so the server would otherwise send
    requests to any address it can reach, e.g., services in its internal
    network. Only http(s) URLs are accepted and, if the application is
    configured with `allowed_endpoints`, only those.
    """
    if any(ch.isspace() or ord(ch) < 32 for ch in url):
        abort(400)
    try:
        parts = urlsplit(url)
        parts.port  # raises ValueError for an invalid port
    except ValueError:
        abort(400)
    if parts.scheme not in ('http', 'https') or not parts.hostname:
        abort(400)

    allowed = current_app.config['SHACLVIEWER_ALLOWED_ENDPOINTS']
    if allowed is None:
        return
    if callable(allowed):
        permitted = bool(allowed(url))
    else:
        permitted = _normalize_endpoint(url) in {_normalize_endpoint(a) for a in _allowed_endpoints()}
    if not permitted:
        abort(403)


def _is_select_query(query):
    """Return True only if `query` is a single, syntactically valid SPARQL
    SELECT query.

    SPARQLWrapper decides based on the query text whether to send a request
    to the query or the update endpoint, so forwarding unchecked queries
    would let a client modify the data of the endpoint (e.g., `DROP ALL`).
    Parsing with the SPARQL grammar is exact: updates, other query forms, and
    anything appended to a SELECT query (e.g., `; DROP ALL`) are rejected.
    """
    try:
        return parseQuery(query)[1].name == 'SelectQuery'
    except Exception:
        return False


def _shaclapi_params():
    """Build the parameters for the shaclAPI from the request.

    The client only names the shape schema by its path relative to the shapes
    directory (parameter `path`). The absolute locations are set here.
    """
    params = request.form.to_dict()
    path = params.pop('path', None)
    if path is None:
        abort(400)
    for key in _SERVER_CONTROLLED_PARAMS:
        params.pop(key, None)
    if 'query' in params and not _is_select_query(params['query']):
        abort(400)
    if 'external_endpoint' in params:
        _check_endpoint(params['external_endpoint'])
    params['schemaDir'] = _resolve_shapes_path(path)
    params['outputDirectory'] = current_app.config['SHACLVIEWER_OUTPUT_DIR']
    return params


def _graph_to_json(graph):
    """Serialize a parsed SHACL graph to a JSON-safe list of dicts.

    This replaces the Jinja2 loop-based data-injection that previously built
    JS arrays inline in the templates.  The result is embedded as a JSON data
    island (<script type="application/json">) that graph_2d.js / graph_3d.js
    read with JSON.parse() — keeping all data-wrangling out of the templates.
    """
    return [
        {
            "id":          node.id,
            "targetQuery": node.targetQuery,
            "prefixes":    node.prefixes,
            "targetDef":   node.targetDef,
            "constraints": [
                {
                    "path":     c.path,
                    "pathURL":  c.pathURL,
                    "min":      str(c.min),
                    "max":      str(c.max),
                    # Python None / the string "None" both become JSON null so
                    # the JS side can do  `constraint.shapeRef === null`
                    "shapeRef": None if (c.shapeRef is None or str(c.shapeRef) == "None")
                                     else c.shapeRef,
                }
                for c in node.constraints
            ],
        }
        for node in graph
    ]


@bp.route("/graph3d")
def graph3d():
    path = request.args.get('path')
    shape_parser = ShapeParser()
    graph = shape_parser.parse_shapes_from_dir(_resolve_shapes_path(path) + '/')
    prettify_graph(graph)

    return render_template(
        'shaclviewer/graph_3d.jinja2',
        graph_json=_graph_to_json(graph),
        endpoints=_allowed_endpoints(),
    )


@bp.route("/graph2d")
def graph2d():
    path = request.args.get('path')
    shape_parser = ShapeParser()
    graph = shape_parser.parse_shapes_from_dir(_resolve_shapes_path(path) + '/')
    prettify_graph(graph)

    return render_template(
        'shaclviewer/graph_2d.jinja2',
        graph_json=_graph_to_json(graph),
        endpoints=_allowed_endpoints(),
    )


@bp.route("/")
def home_page():
    path = request.args.get('path')
    if path is None:
        path = "/"
    else:
        path = path + "/"
    full_path = _resolve_shapes_path(path) + "/"

    folders = sorted(os.listdir(full_path))
    data = []
    for name in folders:
        is_network = True
        directory = os.listdir(full_path + name)[0]
        if os.path.isdir(full_path + name + "/" + directory):
            is_network = False
        data.append({
            "isNetwork": is_network,
            "name": name,
            "dir": path + name,
            "filecount": len(os.listdir(full_path + name))
        })

    return render_template('shaclviewer/home.jinja2', data=data)


@bp.route('/validation', methods=['POST'])
def validation_shacl_api():
    return validation_and_statistics(_shaclapi_params())


@bp.route('/reduce', methods=['POST'])
def reduce_shacl_api():
    node_order = only_reduce_shape_schema(_shaclapi_params())
    return jsonify({'shapes': node_order})


@bp.route('/dataNode', methods=['POST'])
def get_data_node():
    query = request.form.get('query')
    endpoint = request.form.get('endpoint')
    if query is None or endpoint is None:
        return jsonify({})
    _check_endpoint(endpoint)
    if not _is_select_query(query):
        abort(400)
    sparql = SPARQLWrapper(endpoint)
    sparql.setQuery(query)
    sparql.setReturnFormat(JSON)
    results = sparql.queryAndConvert()
    return jsonify(results)


def init_app(app, url_prefix='/shaclviewer', shapes_dir=None, output_dir=None, allowed_endpoints=None,
             access_check=None):
    """Mount the SHACLViewer into an existing Flask application.

    :param app: the Flask application to register the viewer with
    :param url_prefix: the URL below which the viewer is served; use '/' to
                       serve it at the root of the application
    :param shapes_dir: directory containing the SHACL shape schemas to
                       visualize; defaults to the environment variable
                       SHACLVIEWER_SHAPES_DIR or, if unset, '/shapes'
    :param output_dir: directory the shaclAPI may write its output to;
                       defaults to the environment variable
                       SHACLVIEWER_OUTPUT_DIR or, if unset, a directory in
                       the system's temporary directory
    :param allowed_endpoints: the SPARQL endpoints the viewer may query, as
                       list of URLs (compared without trailing slash) or as
                       function that takes a URL and returns whether it is
                       allowed. If None, any http(s) endpoint is allowed,
                       so the server can be made to send requests to any
                       address it can reach. Defaults to the comma-separated
                       URLs in the environment variable
                       SHACLVIEWER_ALLOWED_ENDPOINTS, if set and not empty.
    :param access_check: function without arguments that is called before
                       every request to the viewer (pages, API, and static
                       files). It works like a Flask `before_request`
                       function: return None to let the request pass, or
                       return a response (e.g., a redirect to a login page)
                       or call abort() to stop it. Without it, the viewer is
                       as public as the application it is mounted into.
    """
    # explicit argument > value already in app.config > environment > default
    for key, value, env, default in (
            ('SHACLVIEWER_SHAPES_DIR', shapes_dir, 'SHACLVIEWER_SHAPES_DIR', DEFAULT_SHAPES_DIR),
            ('SHACLVIEWER_OUTPUT_DIR', output_dir, 'SHACLVIEWER_OUTPUT_DIR', DEFAULT_OUTPUT_DIR),
    ):
        if value is not None:
            app.config[key] = value
        else:
            app.config.setdefault(key, os.environ.get(env, default))
    if allowed_endpoints is not None:
        app.config['SHACLVIEWER_ALLOWED_ENDPOINTS'] = allowed_endpoints
    elif 'SHACLVIEWER_ALLOWED_ENDPOINTS' not in app.config:
        from_env = os.environ.get('SHACLVIEWER_ALLOWED_ENDPOINTS', '')
        app.config['SHACLVIEWER_ALLOWED_ENDPOINTS'] = [e.strip() for e in from_env.split(',') if e.strip()] or None
    if access_check is not None:
        app.config['SHACLVIEWER_ACCESS_CHECK'] = access_check
    app.register_blueprint(bp, url_prefix=url_prefix)


def create_app(**config):
    """Create a standalone Flask application serving only the SHACLViewer.

    Keyword arguments (`shapes_dir`, `output_dir`, `allowed_endpoints`,
    `access_check`) are passed to `init_app`.
    """
    # The blueprint ships its own static files, so the app needs none.
    app = Flask(__name__, static_folder=None)
    init_app(app, url_prefix='/', **config)
    return app
