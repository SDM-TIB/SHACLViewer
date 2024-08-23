import os

from SPARQLWrapper import SPARQLWrapper, JSON
from flask import Flask, render_template, request, jsonify
from shaclapi.api import validation_and_statistics, only_reduce_shape_schema

from shaclviewer.shacl import prettify_graph
from shaclviewer.shacl.ShapeParser import ShapeParser

app = Flask(__name__)

@app.route("/graph3d")
def graph3d():
    path = request.args.get('path')
    shape_parser = ShapeParser()
    graph = shape_parser.parse_shapes_from_dir('/shapes/' + path + '/')
    prettify_graph(graph)

    return render_template('graph_3d.jinja2', graph=graph)


@app.route("/graph2d")
def graph2d():
    path = request.args.get('path')
    shape_parser = ShapeParser()
    graph = shape_parser.parse_shapes_from_dir('/shapes/' + path + '/')
    prettify_graph(graph)

    return render_template('graph_2d.jinja2', graph=graph)


@app.route("/")
def home_page():
    path = request.args.get('path')
    if path is None:
        path = "/"
        full_path = "/shapes/"
    else:
        path = path + "/"
        full_path = "/shapes/" + path + "/"

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


@app.route('/validation', methods=['POST'])
def validation_shacl_api():
    return validation_and_statistics(request.form)


@app.route('/reduce', methods=['POST'])
def reduce_shacl_api():
    node_order = only_reduce_shape_schema(request.form)
    return jsonify({'shapes': node_order})


@app.route('/dataNode', methods=['POST'])
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
