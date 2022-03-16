import os
from main import app
from flask import render_template, redirect, url_for, flash, json, request
from main.forms import RegisterForm, LoginForm
from main import db
from flask_login import login_user
from main.shacljson.core.ShapeParser import ShapeParser


@app.route("/graph3d")
def graph3d():
    path = request.args.get('path')
    shape_parser = ShapeParser()
    graph = shape_parser.parse_shapes_from_dir('./main/shacljson/example/shapes/' + path + '/')
    shape_parser.prettify_graph(graph)

    # increase graph size to test performance
    # graph = shape_parser.duplicate_graph(graph, 4)

    print(f'path => {path}')
    print(f'graph => {len(graph)}')
    return render_template('graph3d.html', graph=graph)


@app.route("/graph2d")
def graph2d():
    path = request.args.get('path')
    shape_parser = ShapeParser()
    graph = shape_parser.parse_shapes_from_dir('./main/shacljson/example/shapes/' + path + '/')
    shape_parser.prettify_graph(graph)

    # increase graph size to test performance
    # graph = shape_parser.duplicate_graph(graph, 4)

    # graph = shape_parser.parse_shapes_from_dir('./main/shacljson/example/shapes/LUBM/')
    # graph = shape_parser.parse_shapes_from_dir('./main/shacljson/example/shapes/Shapes_LUBM/')
    # graph = shape_parser.parse_shapes_from_dir('./main/shacljson/example/shapes/WatDiv/')
    return render_template('graph2d.html', graph=graph)

# to-do check for folders within folders (folder explorer)
@app.route("/")
def home_page():
    path = request.args.get('path')
    if path is None:
        folders = os.listdir("./main/shacljson/example/shapes")
    else:
        folders = os.listdir("./main/shacljson/example/shapes/" + path)

    data = []
    for name in folders:
        data.append({
            "name": name,
            "filecount": len(os.listdir("./main/shacljson/example/shapes/" + name))
        })

    return render_template('home.html', data=data)
