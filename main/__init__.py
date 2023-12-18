import os

from flask import Flask, render_template, request, jsonify
from shaclapi.api import validation_and_statistics, only_reduce_shape_schema

from main.shacl.core.ShapeParser import ShapeParser

app = Flask(__name__)

@app.route("/graph3d")
def graph3d():
    path = request.args.get('path')
    shape_parser = ShapeParser()
    graph = shape_parser.parse_shapes_from_dir('./main/shacl/example/' + path + '/')
    shape_parser.prettify_graph(graph)

    return render_template('graph3d.html', graph=graph)


@app.route("/graph2d")
def graph2d():
    path = request.args.get('path')
    shape_parser = ShapeParser()
    graph = shape_parser.parse_shapes_from_dir('./main/shacl/example/' + path + '/')
    shape_parser.prettify_graph(graph)

    return render_template('graph2d.html', graph=graph)


# to-do check for folders within folders (folder explorer)
@app.route("/")
def home_page():
    path = request.args.get('path')
    if path is None:
        path = "/"
        full_path = "./main/shacl/example/"
    else:
        path = path + "/"
        full_path = "./main/shacl/example/" + path + "/"

    folders = sorted(os.listdir(full_path))
    data = []
    for name in folders:
        isNetwork = True
        dir = os.listdir(full_path + name)[0]
        if os.path.isdir(full_path + name + "/" + dir):
            isNetwork = False
        data.append({
            "isNetwork": isNetwork,
            "name": name,
            "dir": path + name,
            "filecount": len(os.listdir(full_path + name))
        })

    return render_template('home.html', data=data)


@app.route('/validation', methods=['POST'])
def validation_shacl_api():
    return validation_and_statistics(request.form)


@app.route('/reduce', methods=['POST'])
def reduce_shacl_api():
    node_order = only_reduce_shape_schema(request.form)
    return jsonify({'shapes': node_order})
