import os.path
import shutil

from cssmin import cssmin
from rjsmin import jsmin

STATIC_DIR = 'shaclviewer/static/'
NPM_PATH = 'node_modules/'
JS_PATH = 'js/libs/'
CSS_PATH = 'css/'
WEBFONTS_BOOTSTRAP_PATH = os.path.join(STATIC_DIR, CSS_PATH, 'fonts/')
WEBFONTS_FONTAWESOME_PATH = os.path.join(STATIC_DIR, 'webfonts/')

class Bundle(object):
    def __init__(self, *contents, **options):
        self.contents = contents
        self.output = options.pop('output', None)
        self.filters = options.pop('filters', None)
        self.name = options.pop('name', None)

        if self.output is not None:
            self.output = STATIC_DIR + self.output

    def build(self):
        print('Building bundle: ' + self.name)
        if self.contents is None or self.output is None:
            return

        content = ''
        for file in self.contents:
            if not os.path.isfile(file):
                continue

            content += open(file, 'r').read()
            if not content.endswith('\n'):
                content += '\n'

        if self.filters == 'cssmin':
            content = cssmin(content)
        elif self.filters == 'rjsmin':
            content = jsmin(content, keep_bang_comments=False)
        else:
            raise NotImplementedError('Filter ' + self.filters + ' not implemented.')

        out_dir = os.path.dirname(self.output)
        os.makedirs(out_dir, exist_ok=True)
        open(self.output, 'w').write(content)

# jQuery
Bundle(
    NPM_PATH + 'jquery/dist/jquery.min.js',
    filters='rjsmin',
    output=JS_PATH + 'jquery.min.js',
    name='jQuery'
).build()

# bootstrap JS
Bundle(
    NPM_PATH + 'bootstrap/dist/js/bootstrap.bundle.min.js',
    filters='rjsmin',
    output=JS_PATH + 'bootstrap.bundle.min.js',
    name='Bootstrap JS'
).build()

# bootstrap CSS
Bundle(
    NPM_PATH + 'bootstrap/dist/css/bootstrap.min.css',
    NPM_PATH + 'bootstrap-icons/font/bootstrap-icons.min.css',
    filters='cssmin',
    output=CSS_PATH + 'bootstrap.min.css',
    name='Bootstrap CSS'
).build()

shutil.rmtree(WEBFONTS_BOOTSTRAP_PATH)
shutil.copytree(os.path.join(NPM_PATH, 'bootstrap-icons/font/fonts'), WEBFONTS_BOOTSTRAP_PATH, dirs_exist_ok=True)

# datatables.net JS
Bundle(
    NPM_PATH + 'datatables.net/js/jquery.dataTables.min.js',
    filters='rjsmin',
    output=JS_PATH + 'jquery.dataTables.min.js',
    name='DataTables JS'
).build()

# datatables.net CSS
Bundle(
    NPM_PATH + 'datatables.net-dt/css/jquery.dataTables.min.css',
    filters='cssmin',
    output=CSS_PATH + 'jquery.dataTables.min.css',
    name='DataTables CSS'
).build()

# force-graph
Bundle(
    NPM_PATH + 'force-graph/dist/force-graph.min.js',
    filters='rjsmin',
    output=JS_PATH + 'force-graph.min.js',
    name='Force Graph'
).build()

# 3d-force-graph
Bundle(
    NPM_PATH + '3d-force-graph/dist/3d-force-graph.min.js',
    filters='rjsmin',
    output=JS_PATH + '3d-force-graph.min.js',
    name='3D Force Graph'
).build()

# three
Bundle(
    NPM_PATH + 'three/build/three.module.js',
    filters='rjsmin',
    output=JS_PATH + 'three.mjs',
    name='Three'
).build()

# three-CSS2DRenderer
Bundle(
    NPM_PATH + 'three/examples/jsm/renderers/CSS2DRenderer.js',
    filters='rjsmin',
    output=JS_PATH + 'three-CSS2DRenderer.mjs',
    name='CSS 2D Renderer'
).build()

# three-spritetext
Bundle(
    NPM_PATH + 'three-spritetext/dist/three-spritetext.mjs',
    filters='rjsmin',
    output=JS_PATH + 'three-spritetext.mjs',
    name='Three Spritetext'
).build()

# simple-treeview
Bundle(
    NPM_PATH + 'simple-treeview/dist/treeview.bootstrap.js',
    filters='rjsmin',
    output=JS_PATH + 'simple-treeview.bootstrap.min.js',
    name='Treeview'
).build()

# fontawesome
Bundle(
    NPM_PATH + '@fortawesome/fontawesome-free/css/all.min.css',
    filters='cssmin',
    output=CSS_PATH + 'fontawesome.all.min.css',
    name='Fontawesome'
).build()

shutil.rmtree(WEBFONTS_FONTAWESOME_PATH)
shutil.copytree(os.path.join(NPM_PATH, '@fortawesome/fontawesome-free/webfonts'), WEBFONTS_FONTAWESOME_PATH, dirs_exist_ok=True)
