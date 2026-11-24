import os
import tempfile

from SPARQLWrapper import SPARQLWrapper, JSON
from flask import Blueprint, Flask, abort, current_app, jsonify, render_template, request
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
        'graph_3d.jinja2',
        graph_json=_graph_to_json(graph),
    )


@bp.route("/graph2d")
def graph2d():
    path = request.args.get('path')
    shape_parser = ShapeParser()
    graph = shape_parser.parse_shapes_from_dir(_resolve_shapes_path(path) + '/')
    prettify_graph(graph)

    return render_template(
        'graph_2d.jinja2',
        graph_json=_graph_to_json(graph),
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

    return render_template('home.jinja2', data=data)


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
    sparql = SPARQLWrapper(endpoint)
    sparql.setQuery(query)
    sparql.setReturnFormat(JSON)
    results = sparql.queryAndConvert()
    return jsonify(results)


def init_app(app, url_prefix='/shaclviewer', shapes_dir=None, output_dir=None):
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
    app.register_blueprint(bp, url_prefix=url_prefix)


def create_app(**config):
    """Create a standalone Flask application serving only the SHACLViewer.

    Keyword arguments (`shapes_dir`, `output_dir`) are passed to `init_app`.
    """
    # The blueprint ships its own static files, so the app needs none.
    app = Flask(__name__, static_folder=None)
    init_app(app, url_prefix='/', **config)
    return app
